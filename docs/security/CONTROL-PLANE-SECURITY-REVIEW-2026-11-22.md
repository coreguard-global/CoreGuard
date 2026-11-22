# Control Plane (CGCP/1) — security review

**Date:** 2026-11-22 · **Surface:** `packages/agent-commerce/control-plane.mjs` (923 lines) and `control-plane-http.mjs` (275 lines)
**Commit reviewed:** `fdfbb05` (main) · **Review type:** static read + executable probes against a temporary store
**Status of findings:** all OPEN — this document does not fix them. Nothing here is a claim that the plane is safe.

**Scope of the surface:** a self-hosted, single-host, file-backed plane with one bearer API key, an `O_EXCL` lock file, an append-only hash-chained audit log, spend accounting over committed executions, and approval gating.

---

## 1. Summary

| ID | Finding | Severity | Status |
|---|---|---|---|
| CP-01 | Omitting `amountMinor` commits an execution that bypasses every spend limit and the approval threshold | **High** | OPEN |
| CP-02 | Omitting `merchant` / `address` / `currency` skips the allow/deny lists and the currency check | **High** | OPEN |
| CP-03 | A malformed `expiresAt` never expires — the approval is accepted indefinitely | **High** | OPEN |
| CP-04 | `releaseLock()` deletes the lock file without checking ownership | Medium | OPEN |
| CP-05 | Stale-lock breaking can delete a *live* holder's lock (slow writer > 30 s) | Medium | OPEN |
| CP-06 | A missing store is silently treated as an empty plane — spend history resets | Medium | OPEN |
| CP-07 | `id: "__proto__"` is accepted, reported as created, then lost on save | Medium | OPEN |
| CP-08 | Unauthenticated `/health` runs a full ledger verification on every request | Low | OPEN |
| CP-09 | `?limit=abc` (or `0`, or negative) returns the entire collection | Low | OPEN |
| CP-10 | Error responses echo absolute store/lock paths; lock contention is returned as `400` | Low | OPEN |
| CP-11 | API key can arrive as a CLI flag (visible in `ps`); no rotation, no rate limit on 401 | Low | OPEN |
| CP-12 | The audit chain has no HMAC, signature or external anchor | Info | Boundary |
| CP-13 | No `fsync` before `rename` — a crash can lose the last acknowledged mutation | Info | Boundary |
| CP-14 | Audit entries carry no actor, source IP or request id | Info | Boundary |

**The three High findings share one root cause:** every policy check is written as `field != null && …`. A request that simply *omits* a field is therefore treated as "no constraint to apply", not as "evidence missing, refuse". That is the opposite of the fail-closed rule stated elsewhere in this repository.

---

## 2. High findings

### CP-01 — Missing `amountMinor` bypasses spend limits and approval

**Where:** `control-plane.mjs:343-355` (limit checks), `:246-252` (approval threshold), `:687-760` (`commitExecution`).

Every limit is guarded:

```js
const amount = amountMinor == null ? null : BigInt(amountMinor);
if (amount != null && spec.spendLimitMinor != null && amount > BigInt(spec.spendLimitMinor)) { … }
```

`commitExecution` never requires `amountMinor`, and `spendTotals` skips records whose amount is `null` (`:203`). A caller can commit an unlimited execution by leaving the amount out, and the spend totals stay at zero forever.

**Verified:** policy with `spendLimitMinor: "1000"`, `dailyLimitMinor: "1000"`, `requireApprovalAboveMinor: "500"`:

| Request | Result |
|---|---|
| `amountMinor: "5000"` | `["SPEND_LIMIT_EXCEEDED","DAILY_LIMIT_EXCEEDED","APPROVAL_REQUIRED"]` — refused |
| `amountMinor` omitted | `{"committed": true}` — no limits evaluated |

**Impact:** the spend ceiling and the approval requirement are both advisory. Any agent that omits one field operates without a budget, and the resulting record cannot be counted afterwards because it has no amount.

**Fix:** require a non-negative `amountMinor` for `commitExecution` and `authorize` (reject with a named reason such as `AMOUNT_REQUIRED`), or evaluate the policy as `POLICY_UNREADABLE`/`AMOUNT_MISSING` when the field is absent. Keep `amountMinor: null` only for explicitly non-monetary records, in a separate method that cannot satisfy an agent policy.

### CP-02 — Missing `merchant` / `address` / `currency` skips the allowlists

**Where:** `control-plane.mjs:299-311` (merchant and address), `:331-335` (currency).

```js
if (merchant != null && spec.allowMerchants.length > 0 && !spec.allowMerchants.includes(merchant)) { … }
```

With `allowMerchants: ["m-good"]` and `allowAddresses: ["0xgood"]`, committing `{ amountMinor: "400" }` with **no** merchant and **no** address returned `{"committed": true}`.

**Impact:** an allowlist is only enforced against fields the caller chooses to send. Omitting them converts a restrictive policy into an open one.

**Fix:** when a policy declares a non-empty allowlist, treat a null value as `MERCHANT_MISSING` / `ADDRESS_MISSING` and refuse. Same for `currency` when the policy pins one. Add a regression test per field, because this pattern repeats.

### CP-03 — A malformed `expiresAt` never expires

**Where:** `control-plane.mjs:254`.

```js
if (approval.expiresAt && Date.parse(approval.expiresAt) < nowMs) return "APPROVAL_EXPIRED";
```

`Date.parse("not-a-date")` is `NaN`, and `NaN < nowMs` is `false`, so the approval never expires. `requestApproval` stores `request.expiresAt` verbatim with no validation (`:596`).

**Verified:** approval with `expiresAt: "not-a-date"`, decided `approved`, evaluated 500-unit policy threshold → `{"allowed": true, "reasons": []}`. The same approval with `expiresAt: "2000-01-01T00:00:00Z"` → `APPROVAL_EXPIRED`.

**Impact:** a permanent approval. A caller who controls the approval request can make a one-off approval valid forever, and the audit trail will look correct.

**Fix:** validate `expiresAt` as an ISO-8601 instant at creation (throw `TypeError`), and at evaluation treat an unparseable value as `APPROVAL_EXPIRED` or `POLICY_UNREADABLE` — never as valid. Also require a bounded maximum TTL.

---

## 3. Medium findings

### CP-04 — Lock release deletes a lock this process may not own

**Where:** `control-plane.mjs:434-438`.

```js
function releaseLock() { try { unlinkSync(lockPath); } catch {} }
```

There is no token check. The lock file contains `{ pid, at }` (`:414-417`) but that content is never read. If the lock was broken as stale (CP-05) or replaced by another writer, the original holder's `finally` deletes the **new** holder's lock. From that point two processes mutate concurrently and `saveState` (whole-file replace) keeps only the last writer — losing audit entries and committed executions silently.

**Fix:** write a random `ownerToken` into the lock file and, on release, read it back and unlink only when it matches. Prefer `link()`/`rename()` based locking, or a real advisory lock (`flock`) through a small native dependency, and document that the token check is best-effort on filesystems without atomic compare-and-delete.

### CP-05 — Stale-lock breaking can evict a live writer

**Where:** `control-plane.mjs:418-427`.

A lock older than `staleLockMs` (30 s default) is unlinked. A live process can exceed 30 s legitimately: a large store, a synchronously loaded filesystem, a suspended process, or a debugger stop. The lock is then broken while its owner still believes it holds it.

**Impact:** overlapping writers → lost updates, and the audit chain stays internally consistent while silently missing entries (there is no cross-check that `audit.length` matches the number of applied mutations).

**Fix:** never break by age alone. Store the holder `pid` + process start time and break only when the pid is gone; or require an operator flag (`--break-lock`) with an audit entry. Reduce the blast radius by making mutations small and by fsyncing.

### CP-06 — A missing store silently becomes an empty plane

**Where:** `control-plane.mjs:167-176` (`loadState` returns `null` on `ENOENT`), `:440-442` (`read()` falls back to `defaultState()`).

If `storePath` points at a different path than the one holding history (typo, changed working directory, container without its volume), the plane starts empty. Spend totals restart at zero, revocations disappear, and the audit chain starts again from `ZERO_HASH` with no complaint. Every mutation then writes that empty state to the new path.

**Impact:** a configuration mistake disables every limit without any error. This is a fail-open on operator error.

**Fix:** require an explicit `create: true` for the first write, or write a marker file; otherwise throw `STORE_MISSING`. For an existing plane, verify the chain on open and refuse to append to a state whose `schema`/`version`/boundary fields are absent. Consider pinning the expected head hash in the deployment config.

### CP-07 — `__proto__` as an identifier is accepted and then lost

**Where:** `control-plane.mjs:449-470` (`upsertAgent`), `:472-556` (`upsertPolicy`); ids are validated only by `requiredString` (`:826`).

`state.agents[id] = record` with `id === "__proto__"` assigns the object's prototype instead of an own property. The mutation returns success and appends `agent.created` to the audit chain, but `JSON.stringify` does not serialize a prototype, so the record vanishes on save.

**Verified:** after `upsertAgent({ id: "__proto__" })`, `listAgents()` returned `["agent-1"]` and `getAgent("__proto__")` returned `null`, while the audit chain grew.

**Impact:** silent data loss with a successful response — the audit log claims a mutation that the store does not contain. In a product whose value is auditability, a successful-but-lost write is worse than a rejected one.

**Fix:** reject reserved keys (`__proto__`, `prototype`, `constructor`) and apply a conservative id pattern (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`). Use `Object.create(null)` maps, or `Map`, for the id-keyed collections and convert at the JSON boundary.

---

## 4. Low findings

### CP-08 — Unauthenticated `/health` performs a full ledger verification

`control-plane-http.mjs:99-107` calls `controlPlane.verifyLedger()`, which reads and parses the entire store and re-hashes every execution (`control-plane.mjs:866-888`). `/health` is intentionally public. An unauthenticated caller can therefore force full-store work per request, and the response exposes `chain.length`. It also returns HTTP `200` when `ok: false`.

**Fix:** make `/health` a constant-time liveness check that returns version and boundary only; move ledger verification behind auth (it already exists at `/v1/audit/verify`) and return `503` when the chain is broken.

### CP-09 — `limit` is not validated

`control-plane-http.mjs:184, 207, 213` pass `Number(url.searchParams.get("limit") ?? N)` straight into `slice(-limit)`. `Number("abc")` → `NaN`, and `slice(-NaN)` is `slice(0)` — the whole collection. `limit=0` does the same; negative values discard the newest records. Verified: `GET /v1/audit?limit=not-a-number` returned all 7 entries.

**Fix:** parse with `Number.parseInt`, require `1 ≤ limit ≤ MAX`, and default on failure. Apply the same bound to `listExecutions`, `listVerifications` and `auditReport`.

### CP-10 — Error details disclose internal paths; lock contention is a `400`

`control-plane-http.mjs:217-221` returns `err.message` verbatim. A held lock produces, with a real absolute path:

```
400 {"error":{"code":"INVALID_REQUEST","detail":"CGCP/1: store is locked by another process (/tmp/cp-http-…/cp.json.lock)"}}
```

Verified over HTTP. This discloses filesystem layout to any authenticated caller, misclassifies a transient conflict as a client error, and gives the wrong signal to retry logic.

**Fix:** map errors to a small public taxonomy (`INVALID_REQUEST`, `CONFLICT`, `STORE_UNAVAILABLE`, `INTERNAL`) with stable messages; log the internal detail server-side only; use `503` for lock contention and `409` for conflicts. No stack traces are currently leaked — keep it that way.

### CP-11 — API key handling

`control-plane-cli.mjs:227-228` accepts `--api-key`, which is visible in `ps` and shell history on a shared host; the environment variable path is the safer one. Additionally: a single static key with no expiry or rotation, no rate limiting or lockout on repeated `401`s, and `safeEqual` returns early on length mismatch (`control-plane-http.mjs:34-39`) so the key length is observable by timing (negligible, but it is the one place the comparison is not constant-time).

**Fix:** drop `--api-key` (or read it from a file descriptor), require ≥32 bytes of entropy, add a token-rotation list (accept old+new during a window) and a small per-source 401 throttle. Compare fixed-length digests of both values so length does not short-circuit.

---

## 5. Boundaries (stated, not defects to be fixed here)

- **CP-12 — audit tamper-evidence is local only.** The chain is `sha256` over `{seq, type, at, detail, prevHash}` (`:184-190`), with no HMAC, signature or external anchor. Anyone with write access to the store can rewrite history consistently, and **truncating the tail is undetectable** by design: there is no expected head hash to compare against. It detects accidental corruption and naive edits, not a malicious host. Anchoring the head hash externally is `NOT_BUILT`.
- **CP-13 — durability.** `saveState` writes a temp file and `rename`s it (`:178-184`) but never `fsync`s the file or the directory. `rename` keeps readers from seeing a partial file; it does not keep the last acknowledged mutation through a power loss.
- **CP-14 — attribution.** Audit `detail` records ids and amounts only; there is no actor, source IP, request id or user agent, and `authorize` decisions cannot be attributed to a caller. With one shared key, "who" is unknowable at this layer.
- **Not a multi-user system.** One bearer key is host-level authorization, not identity. No RBAC, SSO/SCIM, tenant isolation, KMS/HSM, HA/consensus, managed SLA or payment custody. These are `NOT_BUILT` and repeated in `CONTROL_PLANE_BOUNDARY`.
- **Deployment.** No TLS in-process; the default bind is `127.0.0.1`, and `host: "0.0.0.0"` is accepted without a warning. TLS termination and an authenticating reverse proxy are deployment responsibilities.
- **Process-local semantics.** Revocation and spend are enforced at commit time against the file store on one host; cross-host coordination is not implemented.

---

## 6. What is already right

- Bearer comparison uses `timingSafeEqual` for equal-length inputs.
- Bodies are capped at 256 KiB and over-size requests are drained before the `413` is written.
- `cache-control: no-store` on every response; no stack traces returned.
- Mutations take the lock, **reload** state under it, then write — so a stale in-process copy cannot clobber a peer's write while the lock is genuinely held.
- Commits re-evaluate policy at commit time, so a revocation between authorize and commit is caught.
- `commitExecution` is idempotent by `executionId` and reports `DUPLICATE_EXECUTION` instead of double-charging.
- Reads do not lock, but `rename` makes each read see a complete file. This was checked and is **not** a finding.
- Every mutation appends to the audit chain, including refusals and dry-run authorizations.

---

## 7. Verification performed, and its limits

**Performed**
- Full read of both modules at `fdfbb05`.
- Executable probes against temporary stores for CP-01, CP-02, CP-03, CP-07, CP-09, CP-10 and the `/health` behaviour; each result above is an observed output, not an inference.
- Line references checked against the reviewed commit.

**Not performed (so not claimed)**
- No multi-process stress or crash/fault-injection test of the lock (CP-04/CP-05 are established from the code path, not from an observed lost update).
- No fuzzing of the HTTP parser or the JSON body.
- No TLS/proxy deployment test, no penetration test, no timing measurement beyond reading `safeEqual`.
- No test of a store whose chain was deliberately truncated or rewritten (CP-12 is a structural statement).

---

## 8. Recommended order

1. **CP-01, CP-02, CP-03** — same class (missing/malformed evidence treated as permissive); fix together with one regression test per field and a shared "required for policy" helper.
2. **CP-04, CP-05** — lock ownership token and pid-based stale detection; add a two-process contention test.
3. **CP-06, CP-07** — refuse to start on a missing store; reject reserved ids; use null-prototype maps.
4. **CP-08 to CP-11** — HTTP hardening: health, limits, error taxonomy, key handling.
5. **CP-12 to CP-14** — publish as boundaries, or close by anchoring the audit head (external witness) and adding actor attribution.

*VERIFIED ≠ SAFE: this review establishes what the code does, not that the plane is safe to expose.*
