# Control Plane Runbook (CGCP/1)

Operational steps for the self-hosted plane. Read the boundary first: one host, one API
key, a file-backed store. There is no HA, no multi-tenant isolation and no managed SLA.

## 1. First run

```text
export COREGUARD_CONTROL_PLANE_STORE=/var/lib/coreguard/control-plane.json
export COREGUARD_CONTROL_PLANE_API_KEY="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"

cp=packages/agent-commerce/control-plane-cli.mjs
node $cp init
node $cp policy upsert --id default --spend-limit 5000 --daily-limit 20000 \
  --require-approval-above-minor 2000 --allow-merchants merchant-a
node $cp agent upsert --id agent-1 --policy default
node $cp verify
```

`verify` must print `"ok": true` before the plane is put behind traffic.

## 2. Serving the API

```text
node packages/agent-commerce/control-plane-cli.mjs serve --port 8787
```

- Bind to `127.0.0.1` unless the plane is on a private network; the CLI defaults to loopback.
- Terminate TLS and authenticate operators at a reverse proxy. The plane's bearer key is
  **host-level** authorisation, not a user identity — anyone with the key is the operator.
- Put the proxy in front of `/v1/*`; leave `/health` reachable for liveness probes.
- The store directory must be writable by the serving user (lock file + temp rename).

## 3. Key rotation

1. Generate a new key.
2. Stop the server (or start the replacement on another port behind the proxy).
3. Restart with the new `COREGUARD_CONTROL_PLANE_API_KEY`.
4. Update clients, then confirm old-key calls return `401`.

There is no key history, no per-client key and no revocation list for keys. Rotate by
replacing the single key; plan a brief cutover.

## 4. Backup and restore

- Back up `control-plane.json` **and** treat it as sensitive: it contains agent ids,
  merchant/address lists, approvals and amounts.
- Copy while the plane is idle, or copy the temp-rename result; the file is always a
  complete JSON document.
- Restore = stop the service, replace the file, start, then run `verify`.
- Never hand-edit the file: the audit chain will (correctly) fail. If a restore is
  incomplete, treat it as an incident, not a formatting problem.

## 5. Daily checks

| Check | Command | Expected |
|---|---|---|
| Chain + record hashes | `node control-plane-cli.mjs verify` | `ok: true` |
| Spend by agent | `... spend --agent agent-1` | expected trailing-24h and lifetime totals |
| Recent refusals | `... report` | named reasons, no unexpected `UNKNOWN_AGENT` |
| Policy drift | `GET /v1/policies/:id` | `currentVersion` is the version you intended |

A failing `verify` means the stored evidence no longer matches its own hashes. Preserve the
file, stop writes, and investigate before continuing — do not "repair" the chain.

## 6. Incident: stop one agent or one policy

```text
node control-plane-cli.mjs agent revoke --id agent-1 --reason "incident-1234"
node control-plane-cli.mjs policy revoke --id default --reason "incident-1234"
```

Revocation is immediate for the next evaluation **and** for any commit that was authorised
but not yet committed (commit re-evaluates). A revoked agent or policy cannot be
reactivated; issue a new id. Both actions land in the audit chain with the reason.

## 7. Spend-limit semantics

- Limits are integer minor units, as decimal strings.
- `spendLimitMinor` is per transaction.
- `dailyLimitMinor` is the trailing 24 hours of **committed** executions for that agent +
  policy, plus the transaction being evaluated.
- `totalLimitMinor` is lifetime committed spend for that agent + policy, plus this
  transaction.
- Refusals do not consume budget. A failed commit records nothing in spend.
- `authorize` does not reserve budget: two dry runs can both look affordable.

## 8. Approvals

- The default expiry is 15 minutes; pass `expiresAt` to shorten or extend.
- An approval is bound to `agentId`, `policyId`, `merchant`, `address` and `amountMinor`.
  Changing any of them is `APPROVAL_MISMATCH`.
- Decide with `approved` or `rejected` and record `decidedBy`; it is written to the audit chain.
- There is no self-service approval UI; the CLI/API is the surface.

## 9. Growth and limits

- The store is one JSON file rewritten per mutation; it is suitable for a team-scale
  plane, not for high-frequency write traffic.
- Executions are scanned to compute rolling spend. Tens of thousands of records are fine;
  millions are not.
- When this stops being enough, the honest next step is a real database-backed service with
  per-tenant isolation and RBAC — a separate project, not a config flag. The HTTP routes
  and the JSON shapes in `docs/control-plane-architecture.md` are the contract to preserve.

## 10. What this runbook does not give you

No SSO, no per-user roles, no tenant separation, no HA/failover, no KMS/HSM, no managed
SLA, no external notarisation of the audit head. Do not promise those to a customer while
running this plane.
