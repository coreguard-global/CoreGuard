# CoreGuard Policy & Evidence Control Plane — Architecture (CGCP/1)

**Status:** CGCP/1 implemented and tested in this repository.  
**Package surface:** `@coreguard/agent-commerce` (`control-plane.mjs`, `control-plane-http.mjs`, `control-plane-cli.mjs`).  
**Boundary:** self-hosted, single host, single API key, file-backed. It is **not** a multi-tenant
distributed enterprise service, and this document does not describe one.

## What the plane is for

An agent can be pointed at a payment rail and given a receipt. The harder operational
questions are around it:

- Which agents exist, and is each one still allowed to act?
- Which policy does each agent run under, and what did that policy say *last week*?
- Who approved this purchase, and was the approval for *this* merchant and *this* amount?
- How much has this agent spent today, and how much in total?
- What was refused, and why — in a form an auditor can re-check?
- Can an operator stop one agent, or one policy, without redeploying anything?

CGCP/1 answers those locally, deterministically, with every mutation appended to a
hash-chained audit log.

## Shape

```
        agent runtime / CI / console
                    │
      ┌─────────────┴──────────────┐
      │  HTTP API (bearer key)     │   control-plane-http.mjs
      │  /v1/agents /policies ...  │
      └─────────────┬──────────────┘
                    │
      ┌─────────────┴──────────────┐        ┌────────────────────┐
      │  CGCP/1 plane              │◀──────▶│  CLI (operator)    │
      │  control-plane.mjs         │        │  control-plane-cli │
      └─────────────┬──────────────┘        └────────────────────┘
                    │ exclusive lock + atomic rename
              control-plane.json
              control-plane.json.lock
```

Nothing in the plane calls a payment network, a merchant, a chain, or any external
service. It records decisions and evidence about orders the caller already has.

## Data model

| Record | Fields that matter | Notes |
|---|---|---|
| Agent | `id`, `name`, `status` (`active/inactive/revoked`), `policyId`, `metadata` | A revoked agent cannot be reactivated; issue a new id. |
| Policy | `id`, `name`, `status`, `currentVersion`, `versions[]` | Every upsert **appends** an immutable version with its own `hash`. History is never rewritten. |
| Policy version spec | `spendLimitMinor`, `dailyLimitMinor`, `totalLimitMinor`, `requireApprovalAboveMinor`, `currency`, allow/deny merchants, allow/deny addresses, `rules[]` | Amounts are integer minor-unit **strings** (no floats). |
| Approval | `agentId`, `policyId`, `merchant`, `address`, `amountMinor`, `currency`, `status`, `expiresAt`, `decidedBy`, `hash` | Bound to one order: a different amount, merchant, address or agent is `APPROVAL_MISMATCH`. Default expiry 15 minutes. |
| Execution | `id`, `agentId`, `policyId`, `policyVersion`, `amountMinor`, `approvalId`, `receiptId`, `verdict`, `at`, `decisionHash`, `hash` | Append-only. Duplicate `id` is refused, never double-counted. |
| Verification | `executionId`, `receiptId`, `verdict`, `checks`, `source` | The plane stores the verdict; it does not re-run the verifier for you. |
| Revocation | `agentId`, `reason`, `at` | Also recorded in the agent status. |
| Audit entry | `seq`, `type`, `at`, `detail`, `prevHash`, `hash` | The chain. `verifyAuditChain()` re-derives every hash. |

## Decision reasons (frozen vocabulary)

| Reason | Fires when |
|---|---|
| `UNKNOWN_AGENT` | The agent id is not registered. |
| `AGENT_REVOKED_OR_INACTIVE` | The agent exists but is not `active`. |
| `UNKNOWN_POLICY` | No policy is bound and none was supplied. |
| `POLICY_INACTIVE` | The policy exists but is not `active`. |
| `POLICY_UNREADABLE` | The active version has no readable spec. |
| `MERCHANT_DENIED` / `MERCHANT_NOT_ALLOWED` | On the deny list / not on a non-empty allow list. |
| `ADDRESS_DENIED` / `ADDRESS_NOT_ALLOWED` | Same, for the payee address. |
| `CURRENCY_MISMATCH` | Policy pins a currency and the request differs. |
| `SPEND_LIMIT_EXCEEDED` | This transaction is over the per-transaction cap. |
| `DAILY_LIMIT_EXCEEDED` | Committed spend in the trailing 24h **plus this transaction** is over the daily cap. |
| `TOTAL_LIMIT_EXCEEDED` | Lifetime committed spend plus this transaction is over the total cap. |
| `APPROVAL_REQUIRED` | Above the approval floor and no approval id was supplied (or it is unknown). |
| `APPROVAL_NOT_APPROVED` / `APPROVAL_EXPIRED` | The approval is not approved / has expired. |
| `APPROVAL_MISMATCH` | The approval is for a different agent, policy, merchant, address or amount. |

`allowed` is true only when the reason list is empty. Unreadable policy data refuses
with a named reason; it is never guessed past.

## Commit re-evaluates

`authorize()` is a dry run that records the decision in the audit chain. `commitExecution()`
runs the **same evaluation again at commit time** and only then appends the execution and
its spend. This is deliberate: if an agent is revoked, a policy is retired, or another
purchase consumes the remaining daily budget between the dry run and the commit, the commit
is refused. A decision is not a reservation.

## Audit chain

```
entry_hash = sha256(canonicalJson({ seq, type, at, detail, prevHash }))
prevHash₀  = sha256:000…0
```

`verifyAuditChain(state)` walks the log and returns the first sequence that fails to
recompute, with a reason (`sequence gap or reorder`, `previous hash does not chain`,
`entry hash does not recompute`). `verifyLedger()` additionally re-derives every execution
and approval record hash. A rewritten, deleted or reordered entry is named, not silently
accepted.

The chain proves **internal consistency**: nobody edited the stored log without breaking it.
It does not prove the log was not replaced wholesale by someone who can rewrite the file —
that needs an external anchor, which is `OWNER-GATED / NOT_BUILT` for this plane.

## Concurrency

Every mutation:

1. takes `<store>.lock` with `O_EXCL` (holder pid + timestamp written),
2. breaks a stale lock older than `staleLockMs` (default 30 s),
3. **reloads** the store while holding the lock,
4. mutates, writes to a temp file, `rename()`s it into place,
5. releases the lock.

So two processes on one host cannot clobber each other, and a crashed holder does not wedge
the plane. Two hosts with two local files are two independent planes — there is no
replication.

## HTTP API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Public liveness: version, boundary, chain status/length. No data. |
| `GET` | `/v1/version` | Version + boundary. |
| `GET`/`POST` | `/v1/agents` | List / upsert an agent. |
| `POST` | `/v1/agents/:id/policy` | Bind a policy. |
| `POST` | `/v1/agents/:id/revoke` | Revoke an agent with a reason. |
| `GET`/`POST` | `/v1/policies` | List / append a policy version. |
| `GET` | `/v1/policies/:id` | Policy with its version history. |
| `POST` | `/v1/policies/:id/revoke` | Retire a policy. |
| `POST` | `/v1/evaluate` | Deterministic dry-run decision (no side effect). |
| `POST` | `/v1/authorize` | Dry-run decision **recorded** in the audit chain. |
| `POST` | `/v1/approvals` | Request an approval (bound to one order). |
| `GET` | `/v1/approvals/:id` | Read one approval. |
| `POST` | `/v1/approvals/:id/decide` | `approved` or `rejected`, with operator and reason. |
| `GET`/`POST` | `/v1/executions` | List / commit an execution. Refusal is `409` with reasons. |
| `POST` | `/v1/verifications` | Attach a receipt/consent verdict to an execution. |
| `GET` | `/v1/spend?agentId=&policyId=` | Trailing-24h and lifetime spend. |
| `GET` | `/v1/audit` / `/v1/audit/verify` | Recent entries / full chain verification. |
| `GET` | `/v1/report` | Counts, active specs, chain status, `reportHash`. |

Every `/v1` route requires `Authorization: Bearer <apiKey>`, compared in constant time.
`/health` is deliberately public and carries no customer data. Responses are `no-store`;
errors are `{ error: { code, detail } }` and never include a stack trace. Bodies over
`maxBodyBytes` (default 256 KiB) get `413`.

## CLI

```text
node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json policy upsert \
  --id p1 --spend-limit 5000 --daily-limit 20000 --approval-above 2000 \
  --allow-merchants m1 --deny-addresses 0xbad

node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json agent upsert --id a1 --policy p1
node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json evaluate --agent a1 --merchant m1 --amount 2500
node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json exec --agent a1 --merchant m1 --amount 2500
node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json report
node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json serve --port 8787
```

`serve` reads the key from `--api-key` or `COREGUARD_CONTROL_PLANE_API_KEY`.

## BUILT vs NOT_BUILT

**BUILT (this repository, tested):** agent registry and revocation, immutable policy
versioning, merchant/address allow and deny lists, per-transaction and rolling-24h and
lifetime spend caps, approval workflow with expiry and order binding, re-evaluating commit,
duplicate-execution refusal, verification records, hash-chained audit with tamper detection,
authenticated HTTP API, operator CLI, single-host cross-process locking, report with body hash.

**NOT_BUILT (do not sell or imply):**

- multi-user identity, RBAC/ABAC, SSO/SAML/OIDC/SCIM, tenant isolation;
- distributed storage, replication, consensus, HA, cross-region failover;
- KMS/HSM-backed key management, regulated secret custody;
- managed hosting, rate limiting/WAF, production SLO/SLA, on-call;
- payment processing, custody, or PSP integrations;
- an external anchor for the audit head (the chain is internally consistent, not notarised).

Those are a separate hardened service, not a flag on this one. The public OpenAPI-style
route list above is the contract to build against if that service is commissioned.

## Commercial split (honest)

| Layer | What it is | Model |
|---|---|---|
| OSS (MIT) | SDK, 10-tool MCP server, local verification, this self-hosted control plane | Free |
| Integration service | Wiring CoreGuard into a specific stack, scoped by SOW | Service |
| Enterprise platform (future) | Hosted, multi-tenant, SSO/RBAC, HA, SLA, audit exports | Only when actually built |

No claim of current enterprise availability, customer adoption, certification, or that
`VERIFIED` means safe. `VERIFIED ≠ SAFE` travels in every report.
