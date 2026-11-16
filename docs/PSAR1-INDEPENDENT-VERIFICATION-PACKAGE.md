# PSAR/1 — Independent Verification Package

**Protocol:** PSAR/1 (`coreguard.psar/1`) — Pre-sign Authorization Receipt for Stellar transactions  
**Package purpose:** enable an independent developer to understand, run, and verify PSAR/1 behavior from a clean clone, without trusting project claims.  
**Status (honest):** code **BUILT**, execution **TEST_EXECUTED** (deterministic, offline), wallet integration **NOT_BUILT**, external adoption **NOT YET**. No endorsement, partnership, merge, or adoption is claimed.

> **Rule for this package:** do not claim what is not implemented, do not describe what is not tested, and do not request trust unsupported by reproducible evidence.

---

## 1) Protocol specification and security boundaries

### 1.1 What PSAR/1 is
PSAR/1 binds a pre-sign authorization decision to the **exact unsigned transaction bytes** (XDR string) and allows a verifier to check that binding **locally and offline** before signing.

A receipt attests only **pre-sign authorization** (`scope: PRE_SIGN_AUTHORIZATION`). It never proves on-chain execution: every result carries `executionProof: "NOT_INCLUDED"`.

### 1.2 Receipt contents (closed shape)
The receipt is the fixed field set (unknown fields are rejected):
- ADR fields: `v`, `scope`, `network`, `xdrFingerprint`, `policy`, `issuedAt`, `expiresAt`, `issuer`
- Plus: `digest`, `signature`

Key semantics:
- `xdrFingerprint`: `sha256` over the **exact UTF-8 XDR string** (byte-exact binding).
- `digest`: `sha256` over canonical (sorted-key, no-whitespace) JSON of ADR fields.
- `signature`: Ed25519 signature by the issuer over the same canonical ADR bytes, verified against a **caller-pinned** public key.
- `issuer`: must equal the pinned verification key (receipt cannot validly claim a different issuer identity).
- `network`: one of the supported network labels (e.g. TESTNET/PUBLIC/FUTURENET/SANDBOX as implemented).
- `policy`: the authorized policy object as represented; verification checks **canonical equality** to the verifier’s expected policy (object equality), not semantic XDR/policy decoding in v1.
- `issuedAt` / `expiresAt`: validity window evaluated with an **injected clock** (no wall-clock reads inside verification logic).

### 1.3 Verification outcomes (fail-closed)
- Decisions are two-valued: **`PASS`** or **`BLOCK`** (no soft pass).
- Any failed check, malformed input, or verifier-internal error results in **`BLOCK`** with a named reason code.
- Frozen reject-code vocabulary (as shipped): `MALFORMED_RECEIPT`, `MALFORMED_INPUT`, `BAD_DIGEST`, `BAD_SIGNATURE`, `ISSUER_MISMATCH`, `XDR_BINDING_MISMATCH`, `NETWORK_MISMATCH`, `POLICY_MISMATCH`, `NOT_YET_VALID`, `RECEIPT_EXPIRED`, `VERIFIER_ERROR`.

### 1.4 Explicit boundaries (v1)
- **Byte-binding, not semantic decoding:** PSAR/1 verifies exact XDR bytes and policy-object equality; it does **not** decode transaction semantics/operations and does not derive network from envelope bytes.
- **No execution proof:** pre-sign receipt ≠ submitted/executed transaction.
- **No signing/broadcast/wallet keys:** module never signs Stellar transactions, never holds wallet keys, never reads Horizon, never submits.
- **Trust root is external:** verifier requires a **pinned issuer public key** supplied by the caller/wallet trust configuration (key distribution/rotation/revocation policy is outside PSAR/1).
- **Issuer implementation note:** `createInMemoryIssuer` is a **DEMO/DEV-only** deterministic stand-in for offline demos/tests; not a production issuer.
- **Integration status:** no wallet embedding; no external pilot/adopter claimed.

**Primary references (committed):**
- `packages/stellar/presign.mjs`
- `test/integrations/stellar-presign.test.mjs`
- `examples/stellar-presign/demo.mjs`
- `docs/psar-security-review-2026-11-12.md`
- `docs/freighter-presign-integration-proposal-2026-11-12.md`

---

## 2) Steps to run and test from a clean clone

### 2.1 Prerequisites
- Git
- Node.js (repo-supported; repo declares Node >= 18)
- Network access only for cloning/installing dependencies (verification/demo logic runs offline)

### 2.2 Reproduce
```text
git clone https://github.com/coreguard-global/CoreGuard.git
cd CoreGuard
git checkout <pinned-commit-or-tag>
npm install

# Run the PSAR/1 offline demo (builds a real unsigned envelope locally; no signing, no wallet, no network calls)
npm run stellar:presign

# Run the PSAR/1 integration contract tests
node --test test/integrations/stellar-presign.test.mjs

# (Optional) run broader repo checks as context
npm test
npm run boundary:audit
```

**Expected:** demo exits successfully on the exact PASS/BLOCK arc described below; PSAR/1 tests pass. Record commit hash and outputs for an independent report.

---

## 3) PASS and BLOCK cases (what to observe and why)

The committed offline demo (`examples/stellar-presign/demo.mjs`) executes the following deterministic arc (decisions deterministic; some envelope-derived values may vary run-to-run due to timebounds, but the binding property holds):

| Case | Scenario | Expected decision | Reason/code (illustrative) | Why |
|---|---|---|---|---|
| 1 | Verify receipt against the **exact** unsigned envelope it was issued for (same network, policy, within window, pinned issuer key) | **PASS** | — | Digest, signature, issuer identity, XDR fingerprint, network, policy, and time window all validate. |
| 2 | Tamper transaction bytes (e.g. amount changed, producing different XDR) then verify with the original receipt | **BLOCK** | `XDR_BINDING_MISMATCH` | `sha256` of exact XDR no longer matches the bound fingerprint; receipt does not authorize the modified bytes. |
| 3 | Advance injected clock beyond `expiresAt` and verify the original envelope/receipt | **BLOCK** | `RECEIPT_EXPIRED` | Verification is windowed and fail-closed at/after expiry (and `NOT_YET_VALID` before issuance window). |

**Additional fail-closed examples covered by tests (non-exhaustive):** `BAD_DIGEST`, `BAD_SIGNATURE`, `ISSUER_MISMATCH`, `NETWORK_MISMATCH`, `POLICY_MISMATCH`, `NOT_YET_VALID`, malformed/unknown fields, and verifier-internal error paths mapping to `VERIFIER_ERROR`.

**Interpretation rule:** `PASS` means the receipt verifies for the presented exact bytes/policy/network/window under the pinned issuer key. `PASS` does **not** mean “safe”, “wise”, or “executed”.

---

## 4) Threat model (protects / does not protect)

### 4.1 Protects against (within stated scope)
- **Post-approval byte substitution:** detecting that the transaction about to be signed differs from the exact XDR the receipt was issued for (`XDR_BINDING_MISMATCH`).
- **Receipt tampering/forgery without issuer key:** altered fields or mismatched signatures fail closed (`BAD_DIGEST`, `BAD_SIGNATURE`).
- **Issuer identity misclaim:** receipt claiming an issuer not matching the pinned/verified key is rejected (`ISSUER_MISMATCH`).
- **Context mismatch:** wrong network or non-equal policy object rejected (`NETWORK_MISMATCH`, `POLICY_MISMATCH`).
- **Stale/out-of-window use:** use before/after validity window rejected (`NOT_YET_VALID`, `RECEIPT_EXPIRED`).
- **Ambiguous failures:** verifier errors do not become passes (`VERIFIER_ERROR`).

### 4.2 Does not protect against / out of scope (v1)
- **Execution/outcome guarantees:** no proof funds moved or transaction succeeded on-chain (`executionProof: NOT_INCLUDED`).
- **Semantic transaction understanding:** no decoding of operations/amounts/destinations/assets inside XDR; no semantic policy-content verification (potential future scope, not v1).
- **User deception / bad approval decisions:** binds bytes to an issued decision, not the wisdom or informed consent of that decision.
- **Issuer key compromise or mis-pinning:** a malicious/compromised trusted issuer or wrong trust configuration can authorize harmful receipts; key distribution/rotation/revocation is an integrator responsibility.
- **Wallet compromise, malicious host, or UI spoofing:** PSAR/1 is a verification signal, not a complete wallet security model.
- **Network submission, sequencing, fees-on-chain behavior, or Soroban/wallet risk scanning replacement:** explicitly out of scope.

---

## 5) Instructions for an independent reviewer

1. **Pin the target:** record repo URL, commit hash/tag, and environment (OS, Node version). Use a fresh clone.
2. **Re-run without modification:** execute the clean-clone steps in §2; capture full outputs (demo transcript, test results). Do not rely on screenshots or narrated claims.
3. **Inspect the implementation:** review `packages/stellar/presign.mjs` for (a) byte-exact fingerprinting, (b) canonical digest/signature verification against a pinned key, (c) issuer identity check, (d) network/policy/window checks, (e) fail-closed handling.
4. **Inspect the tests:** review `test/integrations/stellar-presign.test.mjs` for known-answer vectors, negative/tamper cases, malformed/hostile inputs, and window/identity coverage. Confirm tests exercise the claimed behaviors.
5. **Cross-check claims vs. evidence:** verify that every stated guarantee maps to code/tests/demo behavior; flag any claim that exceeds evidence (especially execution proof, semantic decoding, production readiness, or adoption).
6. **Evaluate boundaries:** assess key-pinning model, issuer trust assumptions, and suitability as *one* signal alongside (not replacing) wallet UX/risk checks.
7. **Report:** produce a short, reproducible report listing commit, commands run, observed results, confirmed properties, limitations, and any discrepancies.

---

## Notes on provenance and presentation
- Any demo video or website presentation, if referenced elsewhere, should be treated as illustrative of reproducible outputs unless independently re-run; the authoritative evidence is the committed code, tests, and locally reproduced results.
- This package makes **no** request for endorsement, merge, or adoption and **no** claim of partnership or external validation.
