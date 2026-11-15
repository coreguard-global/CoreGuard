# Agent Commerce Integration Guide (dated instrument)

**Date:** 2026-11-15 · **Audience:** a platform, wallet, or agent builder evaluating the Agent Commerce family. **Honesty header:** everything below runs offline from the committed tree; there is no hosted service, no key, no account; npm/MCP-registry publication is OWNER-GATED; no external adoption exists (integration NOT_BUILT). Every order is synthetic. `VERIFIED ≠ SAFE`.

## 1. What you get (three lanes, one engine)

| Lane | Surface | How it runs |
|---|---|---|
| SDK | `packages/agent-commerce/index.mjs` (AC-SDK/1) | import directly from the committed tree; typed façade in `index.d.ts` |
| MCP | `packages/agent-commerce/mcp.mjs` | stdio JSON-RPC 2.0 (protocol 2025-06-18), tools `coreguard_authorize` / `coreguard_verify` / `coreguard_assess_risk` + one more; newline-delimited messages |
| REST | `packages/agent-commerce/http.mjs` (AC-API/1) | `GET /health` · `POST /v1/authorize` · `/v1/verify` · `/v1/consent-verify` · `/v1/risk-assess`; exact-address allowlist guard-0; token-bucket limiter (`/health` limiter-exempt, allowlist-NOT-exempt); 1 MiB body cap |

All three lanes compose the same committed CGEP/1 machinery (canonical hashing, evidence bundles, the 10-check verifier, policy evaluation) — one engine, three transports, no new trust assumptions.

## 2. The arc you integrate (prose, no fences)

1. **Approve.** Your platform collects the user's approval over a specific order (merchant, items, total, credential reference, window). Call `createConsent({ intent, policy, declaredTrace, nowSeconds })` — `nowSeconds` is caller-pinned (the wall clock is never read). The return is a CGCR/1 consent record: the approval bound as a receipt to the EXACT approved bytes.
2. **Execute.** Your agent/platform submits the order. The submitted payload must equal the `declaredTrace` bytes.
3. **Verify.** Call `verifyExecution(consent, executedTrace, { consumedSet })`. Exact bytes → `VERIFIED`. Any drift → `INVALID`, fail-closed, with the drifted field named by the engine check, the AGR/1 class, and the human-readable `driftNamed`.
4. **Consume.** A `singleUse` consent is consumed by its first verified execution. Today the default ledger is process-local (durable single-use anchoring is NOT_BUILT, documented on every report); across processes or sessions, pass a SHARED `consumedSet` — that is the integration answer until durable anchoring exists.
5. **Store/forward.** The consent record is the evidence artifact. Anyone holding it re-derives the binding offline with `verifyConsent` — no keys, no network, no trust in the issuer.

## 3. The fail-closed semantics (what you can rely on)

- Any tampered byte of the consent record → commitment mismatch → INVALID.
- Any unreadable field the taxonomy must decide on → `MALFORMED_EXECUTION` → INVALID (never guessed into a pass).
- A trace-less or partial claim can never be VERIFIED — the verifier compares the trace hash unconditionally whenever a trace is supplied.
- Execution verification never decides delivery conformity (DDE/1) — payment-conformity evidence, not delivery quality.
- The AGR/1 taxonomy is deterministic: same inputs, byte-identical report, `boundary` travels inside every report. It is never a probabilistic fraud score.

## 4. What this is NOT (read before evaluating)

- Not a wallet, not a checkout, not a payment rail — an optional verification layer beside existing flows.
- Not connected to any platform: no contact, integration or endorsement is claimed with OpenAI, American Express, Mastercard, Visa, or any provider.
- Not a fraud engine and not a substitute for one; `VERIFIED ≠ SAFE`; the actor is declared, never detected.

## 5. Distribution status (honest)

`packages/agent-commerce` ships WITHOUT a `package.json` by design (the workspace rule requires a lockfile regen for any new package.json; publication is a pending owner decision). Adoption today means importing the committed modules directly from a checkout or a pinned commit. The npm lane (`NPM_TOKEN` + the release workflow) and any MCP-registry listing are OWNER-GATED and currently NOT_PERFORMED.

## 6. Verify everything yourself (offline)

- Full arc: run `examples/agent-commerce-security-suite/run.mjs` — exit 0 only on the exact arc; `artifacts.json` regenerates byte-identically.
- Contract tests: the four integration files plus the named attack battery, the types contract and the dashboard contract under `test/integrations/agent-commerce-*.test.mjs` run inside the repo suite.
- Docs: `docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md` (schema + verdict semantics + §8 cross-chain design), `docs/agent-commerce-console.html` and `docs/agent-commerce-dashboard.html` (offline operator views embedding the committed artifacts verbatim).

**Facts as of 2026-11-15.**
