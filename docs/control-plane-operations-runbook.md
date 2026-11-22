# CGCP/1 Control Plane — Operations Runbook (Bounded)

**Status:** operational guidance for the self-hosted, single-host, file-backed CGCP/1 plane.  
**Boundary:** this is NOT an enterprise managed control-plane runbook. RBAC/SSO/SCIM, multi-tenant isolation, distributed HA/consensus, KMS/HSM, managed SLA, and payment custody remain **NOT_BUILT**.

## 1. Deployment posture

- Bind to `127.0.0.1` or a private network interface. Do not expose directly to the public internet.
- Put TLS termination and an authenticating reverse proxy in front of the HTTP API.
- Treat the single bearer API key as host-level authorization, not user identity.
- Keep the store file on trusted local storage with restricted permissions.

## 2. API key handling (CP-11)

### Preferred
- `COREGUARD_CONTROL_PLANE_API_KEY_FILE=/run/secrets/cgcp_api_key`
- or `--api-key-file /run/secrets/cgcp_api_key`

### Acceptable (less safe)
- `COREGUARD_CONTROL_PLANE_API_KEY` env var

### Deprecated / avoid
- `--api-key <value>`: visible in process listings/shell history on shared hosts. The CLI emits a deprecation warning.

### Key quality
- Use >= 32 chars high-entropy random secret (recommended 32+ bytes random, base64/hex encoded).
- The CLI warns on short keys; this is a warning, not a full entropy proof.

## 3. Key rotation (single-host bounded)

CGCP/1 HTTP supports `apiKeys` rotation list in code (`createControlPlaneHandler({ apiKeys: [newKey, oldKey] })`). Operational rotation procedure:

1. **Generate** a new high-entropy key in a secret manager or local secret file.
2. **Stage** both old+new keys in the server config/code path that constructs the handler (rolling window). For CLI serve, restart with new key file after clients updated; dual-key window requires code/config that passes `apiKeys`.
3. **Update clients** to use the new key.
4. **Remove old key** and restart/reload.
5. **Verify** old key returns 401; new key works; audit `/v1/audit/verify` is OK.
6. **Record** rotation in your external ops log (CGCP audit does not prove external key management).

**Limit:** no built-in key expiry, no per-user keys, no KMS/HSM integration, no automatic rotation. Those are NOT_BUILT.

## 4. Store safety

- Initialize explicitly: `create: true` for first-time store creation. Missing store without create refuses (`STORE_MISSING`).
- Keep backups of the store file if durability matters; fsync option improves best-effort durability but is not distributed HA.
- Verify integrity: `GET /v1/audit/verify` (auth) or CLI `verify`.
- Export local anchor head: CLI `anchor` / `GET /v1/audit/anchor`. Compare with `verifyAnchor` after restore/copy. This is local witness only, not external anchoring.

## 5. Lock contention / stale lock

- Lock files contain `{pid, at, ownerToken}`. Release only removes lock when ownerToken matches.
- Stale break requires age > `staleLockMs` **and** holder pid not alive. EPERM is treated as alive.
- If lock contention occurs, HTTP returns `503 STORE_UNAVAILABLE`. Retry with backoff; investigate stuck process before manual intervention.
- Do not manually delete a lock file unless you have confirmed the holder is dead and understand the risk.

## 6. Audit and boundaries

- Audit chain is hash-chained and detects accidental corruption/naive edits.
- Audit entries may include self-asserted `actor`, `requestId`, `source` meta. This is not strong identity.
- Truncation/rewrite by host with file access is not detectable without external witness. External witness/HSM/on-chain anchoring is **NOT_BUILT**.
- `rename` without fsync is best-effort durability; `fsync: true` improves it. Power-loss guarantees and distributed consensus are **NOT_BUILT**.

## 7. Incident quick checks

| Symptom | Check | Action |
|---|---|---|
| 401 spike | HTTP 429/401 logs, key mismatch | Check rotation window, source IP, throttle |
| 503 STORE_UNAVAILABLE | lock file age/pid, disk | Confirm holder dead/stuck; retry; restore from backup if corrupted |
| audit verify fails | `/v1/audit/verify` | Treat as integrity incident; preserve copy; restore known-good backup; investigate tamper/corruption |
| STORE_MISSING | path/config | Fix path or initialize intentionally with `create: true` |

## 8. Honest non-goals

This runbook does not provide: multi-user identity, RBAC/SSO/SCIM, tenant isolation, KMS/HSM, HA failover, replication, managed backup/SLA, payment custody, or on-chain settlement guarantees.
