# @coreguard/agent-commerce

[![Coreguard Agent Commerce MCP server](https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg)](https://mcprush.com/to/coreguard-agent-commerce-mcp?ref=badge)

Consent receipts and fail-closed execution verification for agentic purchases —
an offline, deterministic surface for binding a user's approval to the exact
bytes approved, and for verifying any executed trace against that receipt.

- **CGCR/1 consent receipts** — the approved order (intent + policy + declared
  submit payload) is committed as an independently re-derivable receipt; every
  verification recomputes the commitments from the record's own approved bytes.
- **Fail-closed execution verification** — a consent plus an executed trace
  yields a verdict with named drift classes (AGR/1 taxonomy); incomplete or
  ambiguous evidence is never treated as a pass.
- **stdio MCP server** (JSON-RPC 2.0, protocol `2025-06-18`) exposing 119 tools,
  all offline, all deterministic, zero keys.
- **CG-W6/1 Stellar smart accounts** — 20 of those tools reason about agent
  session keys: policy compile/evaluate with a counterfactual, signer and
  threshold policy, envelope time/ledger bounds, memo and asset binding with
  confusable-code detection, trustline capacity, Soroban authorization entries,
  Stellar Asset Contract allowances, fee bumps, claimable balances, sponsored
  reserves, sequence/replay guards, operation-set drift, DEX slippage, SEP-10
  and SEP-24 evidence, and session-scoped receipts. Offline: no RPC, no
  signing, no broadcast.

MIT. Node ≥ 18. No network calls, no stored credentials, no wall clock.

## MCP client configuration

```json
{
  "mcpServers": {
    "coreguard-agent-commerce": {
      "command": "npx",
      "args": ["-y", "@coreguard/agent-commerce"]
    }
  }
}
```

Per client, the same stdio command in each one's own file:

- **Claude Code** — `claude mcp add coreguard-agent-commerce -- npx -y @coreguard/agent-commerce`
- **Claude Desktop** — the `mcpServers` block above in `claude_desktop_config.json`
- **Cursor** — the same block in `.cursor/mcp.json`
- **VS Code (Copilot MCP)** — `{"servers": {"coreguard-agent-commerce": {"type": "stdio", "command": "npx", "args": ["-y", "@coreguard/agent-commerce"]}}}` in `.vscode/mcp.json`
- **Codex CLI** — `[mcp_servers.coreguard]` with `command = "npx"` and `args = ["-y", "@coreguard/agent-commerce"]` in `config.toml`
- **Gemini CLI / Zed / Windsurf** — stdio server entry, same command

What "supported" means here: the transport and schemas are what the CI harness
exercises against a real spawned child process. No third-party client has been
launched by us yet — the status vocabulary and the append-only run log are in
`docs/agent-commerce-mcp-compatibility.md`. Do not read the list above as a test
report.

## Tools

Every tool declares `inputSchema` and `outputSchema`, and returns
`structuredContent` next to the JSON text content. All ten are offline and
deterministic. Every tool accepts optional `callerContext` (object) which is echoed
in `structuredContent.callerContext` and never used as a cryptographic input.

### `coreguard_authorize`

Binds an approval as a CGCR/1 consent receipt.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `intent` | object | yes | CGEP/1 intent: merchant, items, total, `credentialRef`, validity window, `singleUse` |
| `policy` | object | yes | CGEP/1 policy: value limit, target / recipient / selector allowlists |
| `declaredTrace` | object | yes | the exact submit-order payload the approval covers |
| `nowSeconds` | string (digits) | yes | pinned approval epoch; a number is rejected, the wall clock is never read |

Output: `{ spec: "CGCR/1", receipt, … }` — the commitments are re-derivable by
anyone holding the record.

### `coreguard_verify_consent`

Recomputes every commitment against the record's own approved bytes.

| Input | Type | Required |
|---|---|---|
| `consent` | object | yes — a record returned by `coreguard_authorize` |

Output: an integrity verdict; any tampered byte fails closed rather than throwing.

### `coreguard_verify_execution`

Compares an executed order to the receipt.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `consent` | object | yes | CGCR/1 record |
| `trace` | object | yes | the executed order as observed |

Output: `{ spec, verdict, risk, consumed, consumedLedger }`.

- `verdict` = `VERIFIED` only on an exact re-derivation with no drift class fired.
- `verdict` = `INVALID` otherwise, with the drifted fields named in
  `risk.violations[].code` (`VALUE_ESCALATION`, `ITEM_MUTATION`,
  `TARGET_MISMATCH`, `RECIPIENT_MISMATCH`, `POLICY_VIOLATION`, …).
- `consumed` becomes `true` after the first verified execution of a single-use
  consent. **The ledger is process-local** (durable anchoring is `NOT_BUILT`), so
  this is not replay protection across processes or hosts.

### `coreguard_assess_risk`

Deterministic AGR/1 classification of one executed order against one approval.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `intent` | object | yes | the approved order |
| `policy` | object | yes | the committed policy |
| `trace` | object | yes | the executed order |
| `consumed` | boolean | no | whether the authorization was already consumed (default `false`) |

Output: `{ classification, violations[], … }`. A rule-based conformance
classification, **not** a probabilistic fraud score.

### `coreguard_inspect_identity`

Inspects CG-ID/1 identity split (recordId/contentDigest/anchor facts), with optional comparison.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `issuer` | string | yes | identity issuer |
| `scope` | string | yes | identity scope |
| `subject` | string | yes | identity subject |
| `contentDigest` | string | yes | 64-char lowercase hex digest (no `0x` prefix) |
| `anchor` | object | no | `{ kind, locator }` anchor reference |
| `other` | object | no | another identity object for comparison |

Output: `{ identity, anchorFacts, comparison? }`.

### `coreguard_build_attestation`

Builds a CGXA/1 offline execution attestation. No broadcast; no chain/network contact.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `consent` | object | yes | CGCR/1 consent record |
| `executedTrace` | object | yes | executed trace observed by caller |
| `adapterId` | string | yes | CGXA adapter id |
| `nowSeconds` | integer or digit string | yes | pinned epoch; never wall clock |

Output: `{ spec, attestation, attestationId }`.

### `coreguard_verify_attestation`

Verifies a CGXA/1 attestation against consent and executed trace. Offline, fail-closed.

| Input | Type | Required |
|---|---|---|
| `attestation` | object | yes |
| `attestationId` | string | yes |
| `consent` | object | yes |
| `executedTrace` | object | yes |

Output: attestation verification result including `decision` (e.g. `VERIFIED`/refused) and boundary details.

### `coreguard_decide_outcome`

Maps a verification report to CG-OUT/1 outcome and authorization decision.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `report` | object | yes | verification report / bridge-compatible report |
| `receiptId` | string | no | receipt id for optional profile reference |

Output: `{ outcome, decision, profileReference? }`. `ABSENT`/`NOT_CHECKED` never render as BLOCK; `VERIFIED ≠ SAFE`.

### `coreguard_profile_reference`

Creates or parses a CG-OUT/1 profile reference.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `action` | string | yes | `make` or `parse` |
| `receiptId` | string | for make | receipt id |
| `reference` | object/string | for parse | reference to parse |

Output: `{ action, profileReference? , parsed? }`.

### `coreguard_consumption_status`

Checks/consumes/releases a receiptId in a consumption ledger.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `receiptId` | string | yes | receipt/consent key |
| `action` | string | no | `check` (default), `consume`, or `release` |
| `storePath` | string | no | AC-CS/1 file-backed store path; defaults to `COREGUARD_CONSUMPTION_STORE` when set |

Output: `{ receiptId, action, consumed, ledger, boundary }`.

**Boundary:** the default ledger is **process-local** to this MCP server process. With `storePath` (or `COREGUARD_CONSUMPTION_STORE`), the AC-CS/1 store is used: lock-guarded and atomic across processes **on one host**. Cross-host reconciliation is CG-SPEND/1 log merge (`spend.mjs`), not this file. **NOT_BUILT:** a distributed/global register, consensus, HA replication, on-chain anchoring.

### Wave 1 — Machine Economy (CG-ME/1, deterministic offline)

These 10 tools extend CoreGuard into x402/machine/delegation evidence flows. **Boundaries:** no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; signature trust roots/device attestation/physical-world truth NOT proven here. `VERIFIED != SAFE`.

| Tool | Purpose |
|---|---|
| `coreguard_parse_x402_challenge` | Parse/normalize x402 402 accepts; fail-closed on missing fields. |
| `coreguard_authorize_x402_payment` | Evaluate challenge against policy (maxAmount, allowedNetworks/Assets/PayTo); decision only, no payment. |
| `coreguard_verify_x402_settlement` | Verify caller-supplied settlement evidence against challenge; no network confirmation. |
| `coreguard_reconcile_payment` | Reconcile authorization, settlement evidence, and receipt. |
| `coreguard_meter_agent_usage` | Deterministic usage/cost metering from event amounts. |
| `coreguard_register_machine` | Create local machine registration record from manifest; no external attestation. |
| `coreguard_create_machine_task` | Create deterministic task record with terms/price/SLA. |
| `coreguard_verify_telemetry` | Verify telemetry structure/digest/signature presence; trust/physical truth not proven. |
| `coreguard_verify_task_completion` | Verify completion evidence against task; evidence acceptance != physical proof. |
| `coreguard_verify_delegation_chain` | Verify delegation chain structure/continuity; signatures not cryptographically verified without trust roots. |

### Wave 2 — CGCP/1 Mapping + Trusted Signatures

6 MCP tools map the missing/partial proposed contracts to the self-hosted CGCP/1 control plane (file-backed, single host, hash-chained audit). Additionally, `coreguard_verify_telemetry` and `coreguard_verify_delegation_chain` now perform real Ed25519 signature verification when an optional `trust` object with public keys/keyring is supplied. Verification covers signature validity over the supplied payload; it does not prove device identity, key custody, or physical-world truth.

| Tool | CGCP/1 mapping |
|---|---|
| `coreguard_create_intent` | `requestApproval` (intent/approval request) |
| `coreguard_issue_receipt` | `recordExecution` (execution receipt record) |
| `coreguard_verify_receipt` | audit-chain verification + receipt lookup |
| `coreguard_check_limits` | `evaluate` (policy/limit decision) |
| `coreguard_revoke_consent` | `decideApproval` / `revokeAgent` / `revokePolicy` |
| `coreguard_audit_transaction` | `auditReport` with optional filters |

### Wave 3 — reasoning, supply chain, evidence, operations (CG-W3/1)

20 deterministic tools that answer questions the receipt layer could only imply. All offline, zero keys, no wall clock in any commitment.

| Tool | Purpose |
|---|---|
| `coreguard_compile_policy` | Compile a compact spend spec into a canonical CGEP/1 policy + stable digest. |
| `coreguard_explain_decision` | Per-rule verdict plus the smallest single change that clears the first block. |
| `coreguard_simulate_spend` | Dry-run a batch against a policy; no state written. |
| `coreguard_diff_policies` | Rule-level diff, limit delta, tightness, re-consent flag. |
| `coreguard_generate_boundary_cases` | At/±1 the limit, unlisted target/recipient, closed window, wrong currency — verdicts computed by the engine. |
| `coreguard_audit_server_manifest` | Risk card for a third-party MCP `server.json` before install. |
| `coreguard_scan_tool_descriptions` | Byte-level scan for bidi/tag/zero-width characters, HTML comments, imperative payloads. |
| `coreguard_check_lookalike` | Homoglyph, mixed-script and punycode impersonation check. |
| `coreguard_diff_tool_surface` | Rug-pull detector between two `tools/list` snapshots. |
| `coreguard_verify_evidence_bundle` | Recompute bundle + item digests offline. |
| `coreguard_redact_receipt` | Share a receipt with a redaction manifest and both digests. |
| `coreguard_attest_batch` | Merkle root + per-item inclusion proofs over many receipts. |
| `coreguard_verify_batch_proof` | Offline inclusion proof verification. |
| `coreguard_freeze_agent` | Revoke an agent and reject its open approvals in one audited operation. |
| `coreguard_budget_runway` | Straight-line runway from pinned inputs; exhaustion epoch. |
| `coreguard_detect_spend_anomaly` | Median/MAD outlier scan with explicit threshold. |
| `coreguard_incident_timeline` | Sequence-ordered ledger events, gaps and chain status. |
| `coreguard_translate_receipt` | Structural ACP/x402/CGCR mapping with an explicit loss list. |
| `coreguard_emit_test_vectors` | Integration vectors with the verdicts the enforcer computes. |
| `coreguard_describe_surface` | Capability card/badge a directory can quote verbatim. |

**Wave 3 boundary:** every answer is arithmetic over caller-supplied JSON. A finding is evidence for a human decision, not a verdict on a third party; the manifest and description audits do not execute the server. `VERIFIED ≠ SAFE`.

## Errors

Failures are tool results, never exceptions and never a process exit:

```
MISSING_ARGUMENT: nowSeconds is required
INVALID_ARGUMENT: nowSeconds must be a pinned unix-seconds string (digits only), not a number and never the wall clock
UNKNOWN_TOOL: unknown tool: coreguard_nope
TOOL_ERROR: <message from the engine>
```

and machine-readable as `structuredContent: { ok: false, error: { code, detail } }`.
Codes are exported from `mcp.mjs` as `ERROR_CODES`. JSON-RPC level errors stay
separate (`-32700` parse, `-32600` invalid request, `-32601` method not found); a
bad line never terminates the server.

## Try it without a client

```bash
# Runnable demo (approve → refuse → verify → malformed)
node examples/agent-commerce-mcp/run.mjs

# Runtime smoke check (real stdio MCP child, publish/MCPRush readiness evidence)
node scripts/agent-commerce-mcp-smoke.mjs
```

The demo ends in `PASS (8/8)`. The smoke check ends in `11/11 PASS` and exits non-zero on any failure.
Expected demo output: `examples/agent-commerce-mcp/README.md`.

```bash
# Control plane: policies, approvals, spend caps, revocation, audit chain (HTTP, offline)
node examples/agent-commerce-control-plane/run.mjs
```

## Policy & Evidence Control Plane (CGCP/1)

Beyond the per-order check, a team needs the operational layer: which agents exist,
which policy each runs under, what was approved, what was executed, what was
verified, what has been spent, and what was revoked. CGCP/1 is that layer, in this
package and self-hosted.

```js
import { createControlPlane } from "@coreguard/agent-commerce/control-plane.mjs";

const cp = createControlPlane({ storePath: "./control-plane.json" });
cp.upsertPolicy({ id: "p1", spendLimitMinor: "5000", dailyLimitMinor: "20000",
  requireApprovalAboveMinor: "2000", allowMerchants: ["merchant-a"] });
cp.upsertAgent({ id: "a1", policyId: "p1" });

cp.evaluate({ agentId: "a1", merchant: "merchant-a", amountMinor: "2500" });
// { allowed: false, reasons: ["APPROVAL_REQUIRED"], ... }
const ap = cp.requestApproval({ agentId: "a1", policyId: "p1", merchant: "merchant-a", amountMinor: "2500" });
cp.decideApproval(ap.id, { decision: "approved", decidedBy: "ops@example" });
cp.commitExecution({ agentId: "a1", merchant: "merchant-a", amountMinor: "2500", approvalId: ap.id });

cp.verifyLedger(); // { ok: true, chain: { ok: true, length, headHash } }
```

- Immutable policy versions (an upsert appends, never rewrites history).
- Per-transaction, trailing-24h and lifetime spend caps; merchant/address allow+deny lists.
- Approvals bound to one order (agent, policy, merchant, address, amount) with expiry.
- Commits re-evaluate, so a revocation or a limit breach between authorise and commit is refused.
- Append-only hash-chained audit with `verifyAuditChain()`; tamper detection names the first broken entry.
- Lock-guarded single-host store; authenticated HTTP API (`control-plane-http.mjs`) and CLI (`control-plane-cli.mjs`).

```text
node packages/agent-commerce/control-plane-cli.mjs serve --port 8787
```

**NOT_BUILT:** multi-tenant isolation, RBAC/SSO/SCIM, distributed HA/consensus, KMS/HSM,
managed SLA, payment custody. One host, one API key, one JSON store. Architecture:
`docs/control-plane-architecture.md`; operations: `docs/control-plane-runbook.md`.

## SDK, without MCP

```js
import { createConsent, verifyExecution } from "@coreguard/agent-commerce";
```

The MCP tools are thin wrappers over these functions; nothing is added or hidden
by going through MCP.

## Smart-account adapter (CG-W6/1)

Maps one caller-supplied snapshot to the arguments of the signer-set, threshold
and Soroban-authorization checks. It does not read the network, sign or decide
authorization; it re-sorts the evidence and digests it so a tamper is visible.

```js
import { fromSmartAccountSnapshot } from "@coreguard/agent-commerce/smart-account-adapter.mjs";

const mapped = fromSmartAccountSnapshot({
  network: "testnet",
  accountId: "C...",
  masterWeight: 0,
  thresholds: { low: 1, medium: 2, high: 3 },
  signers: [{ key: "G...", kind: "passkey", weight: 2 }],
});
// mapped.toolCalls -> 2 calls (3 when `soroban` is supplied)
// mapped.snapshotDigest -> changes if a weight, kind or ledger changes
```

Snapshot fields: `network` (`testnet` | `mainnet` | `futurenet`), `accountId`,
`masterWeight`, `thresholds { low, medium, high }`, `signers[]` with
`key` (or `publicKey` / `address`), optional `kind` and `weight`, optional
`presentedSigners[]` (defaults to all signers), and optional `soroban` with
`entry { contractId, functionName, argsDigest, signatureExpirationLedger,
rootInvocation?, subInvocations? }`, `expected { contractId, functionName,
argsDigest }`, `currentLedger` and optional `allowedContracts`.

Refusal codes (returned as `{ ok: false, error: { code, detail, field? } }`, with
no `toolCalls`): `INVALID_SNAPSHOT`, `UNSUPPORTED_NETWORK`, `MISSING_ACCOUNT_ID`,
`INVALID_MASTER_WEIGHT`, `INVALID_THRESHOLDS`, `THRESHOLD_ORDER`, `NO_SIGNERS`,
`INVALID_SIGNER`, `MISSING_SIGNER_KEY`, `INVALID_WEIGHT`, `DUPLICATE_SIGNER`,
`INVALID_PRESENTED_SIGNERS`, `INVALID_PRESENTED_SIGNER`,
`UNKNOWN_PRESENTED_SIGNER`, `INVALID_LEVEL`, `INVALID_SOROBAN`,
`SOROBAN_ENTRY_MISSING`, `SOROBAN_EXPECTED_MISSING`, `CURRENT_LEDGER_MISSING`.

## Boundaries (standing)

- Synthetic demo data is the caller's; nothing here contacts any commerce
  platform or payment network, and no contact/integration/endorsement is claimed
  with any provider.
- **VERIFIED ≠ SAFE** — a verdict states that commitments re-derive; it is not a
  guarantee of any broader outcome.
- Single-use consumption is process-local by default; the AC-CS/1 store makes it durable and atomic across processes on one host. Cross-host reconciliation is CG-SPEND/1 log merge; a global/on-chain register is `NOT_BUILT`.
- The executed trace is caller-supplied. Fetching it from a chain or a PSP is an
  integration this package does not contain.
- No third-party security review, no certification. Marketplace grades are
  automated heuristics, not audits — see
  `docs/agent-commerce-mcp-security.md`.
- `serverInfo.version` is read from this package's `package.json`; CI fails if
  they diverge.

License: MIT.


## Release readiness / MCPRush evidence

- **Release notes:** `docs/releases/0.5.0.md` (latest, run `45838608694`) · `docs/releases/0.4.0.md` · `docs/releases/0.3.0.md`
- **Publish readiness checklist:** `docs/releases/0.1.3-publish-readiness.md`
- **Security & threat model:** `docs/agent-commerce-mcp-security.md`
- **Client compatibility matrix + run log:** `docs/agent-commerce-mcp-compatibility.md`
- **Runtime smoke (real stdio):** `node scripts/agent-commerce-mcp-smoke.mjs`
- **60s demo script:** `docs/agent-commerce-mcp-demo-60s.md`
- **MCP contract tests:** `node --test test/integrations/agent-commerce-mcp.test.mjs`
- **Control plane architecture / runbook:** `docs/control-plane-architecture.md` · `docs/control-plane-runbook.md`
- **Control plane demo (HTTP, offline):** `node examples/agent-commerce-control-plane/run.mjs`

## Honest boundaries (read before integrating)

- **`VERIFIED ≠ SAFE`** — verification means the observed execution matches the approved/committed bytes under the checked rules; it is not a blanket safety or fraud guarantee.
- **Offline / no external contacts** — this package does not contact commerce platforms, payment networks, wallets, or PSPs.
- **Single-use consumption scope** — process-local by default; AC-CS/1 gives a lock-guarded file ledger across processes on one host; CG-SPEND/1 merges logs across hosts; a global register and on-chain anchoring are `NOT_BUILT`.
- **Caller-supplied observed trace** — execution verification checks the trace you provide against the consent; it does not independently fetch or prove external payment/network truth.
- **No fake "Tested" claims** — client compatibility is marked CONFIG-DOCUMENTED until a real run is recorded in the compatibility run log.
