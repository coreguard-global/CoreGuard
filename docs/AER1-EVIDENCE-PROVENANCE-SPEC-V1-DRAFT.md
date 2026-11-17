# CoreGuard — Evidence Provenance & Adversarial Identity Resolution Spec (v1)

**Status:** FROZEN (v1 minimal-slice contract decisions) — implementation/test coverage applies to this frozen slice; broader provenance features remain future work unless explicitly specified and evidenced.  
**Scope:** AER-1 Section 9–style receipt-id resolution path (`bindReceiptIdentity`) and a **separate, fail-closed provenance verification** slice for resolved records (`scripts/ladder/resolved-record-provenance.mjs`, CG-RRP/1).  
**Reference baseline:** `d3cd7a0` (green) for prior Section 9/boundary work; this spec records frozen v1 provenance decisions layered on that baseline.  
**Non-claims:** Not a security audit, formal proof, certification, production-readiness claim, or evidence of adoption/integration/funding/partnership. Provenance verification proves only what the frozen contract states.

---

## 1. Purpose
Strengthen Section 9 resolution from **value-consistency binding** toward **evidence-grounded verification** by explicitly separating:
1. **Identity/digest binding** — do the compared values agree? (existing axis: `BOUND`/`MISMATCH`/`UNKNOWN`)
2. **Evidence provenance/authenticity** — is the resolved record authentic for the expected trust anchor and context? (**new separate axis, CG-RRP/1**)
3. **Fail-closed verdicting** — ambiguity, conflict, missing/invalid trust evidence, or context mismatch remain **non-passing** (never upgraded to success).

## 2. Current baseline (answered)
- `bindReceiptIdentity` evaluates caller-supplied resolved records by **value comparison only**. It does **not** verify issuer identity, cryptographic origin, network/context binding, freshness/revocation beyond caller inputs, or trust anchors.
- **Rule:** `BOUND` means *bound by compared values* only — **not** proof of authentic/trusted source, correct context, or execution.

## 3. Frozen v1 contract decisions (minimal slice: CG-RRP/1)

### 3.1 Trust anchor (external, pinned by caller)
- **MUST** be supplied by the verifier/caller as an explicit input: `trustAnchor = { keyId: string, publicKeyHex: string }`.
- `publicKeyHex`: 32-byte Ed25519 public key encoded as 64 lowercase/uppercase hex chars (normalized for comparison as specified by implementation; invalid encoding → fail-closed).
- **Non-negotiable:** the resolved record **MUST NOT** select or supply the trust key/anchor. The record declares `issuerKeyId` which **MUST equal** the provided anchor `keyId`; otherwise provenance is **not** established.

### 3.2 Signed payload (covered fields) and canonicalization
- Canonicalization: **canonical JSON** (UTF-8) with recursively sorted object keys and no insignificant whitespace (deterministic; equivalent to `JSON.stringify` over sorted keys as implemented in-repo).
- **Signed payload object** (all required unless noted):
  - `v`: `"CG-RRP/1"`
  - `recordId`: non-empty string (resolved record id)
  - `artifactDigest`: non-empty string (committed/artifact digest to bind; compared as provided string)
  - `context`: plain object with **required** `network` (non-empty string) and `chainId` (string or integer normalized to string in canonical form as implemented) — minimal required context dimensions for v1
  - `issuerKeyId`: non-empty string (must match external trust anchor)
  - `issuedAt`: optional integer seconds (Unix epoch) — if present, must be a safe/non-negative integer
  - `expiresAt`: optional integer seconds — if present, must be a safe/non-negative integer and `>= issuedAt` when both present
- **Signature:** Ed25519 over the UTF-8 bytes of the canonicalized signed payload. `signature` is a 64-byte hex string (128 hex chars). Algorithm is **fixed** to Ed25519 for v1; unknown/other algorithms are unsupported (fail-closed).

### 3.3 Record envelope (input)
- `provenantRecord = { payload: <signed payload>, signature: <hex> }` (plain objects; unknown top-level fields on the envelope are rejected as malformed for this strict v1 slice).
- Multiple/conflicting records: **not accepted** in a single verification call in v1 — supplying more than one record (or an ambiguous set) yields a deterministic **conflict/fail-closed** result (no selection).

### 3.4 Context binding
- Caller provides `expectedContext` with required `network` and `chainId`.
- Verification **requires exact match** of canonicalized/normalized `network` and `chainId` between signed payload context and `expectedContext`. Mismatch → **fail-closed** (context mismatch), never a pass.

### 3.5 Time/freshness (deterministic)
- No wall-clock reads. If `issuedAt`/`expiresAt` are present, caller **MUST** supply `nowSeconds` (injected integer seconds) to evaluate validity; missing `nowSeconds` when needed → fail-closed.
- `nowSeconds < issuedAt` → not yet valid (fail-closed). `nowSeconds > expiresAt` → expired (fail-closed). (Inclusive/exact boundaries per implementation; tested.)

### 3.6 Provenance verdicts (separate axis, frozen codes)
`verifyResolvedRecordProvenance(...) -> { verdict, verdictCode, reason }`

- `VERIFIED` / `PROVENANCE_VERIFIED`: signature valid for payload under **provided external trust anchor**, `issuerKeyId` matches anchor, context matches, and time checks (if applicable) pass.
- `INVALID` / `PROVENANCE_MALFORMED`: malformed/missing/typed/encoding/unknown-field/unsupported-version-or-algorithm input.
- `INVALID` / `PROVENANCE_UNTRUSTED_ISSUER`: `issuerKeyId` does not match provided trust anchor (or anchor missing/invalid) — record cannot select its own trust.
- `INVALID` / `PROVENANCE_BAD_SIGNATURE`: signature missing/invalid or does not verify for the canonical payload and anchor key.
- `INVALID` / `PROVENANCE_CONTEXT_MISMATCH`: required context does not match expected context.
- `INVALID` / `PROVENANCE_NOT_YET_VALID` / `PROVENANCE_EXPIRED`: time window checks fail (when applicable).
- `INVALID` / `PROVENANCE_CONFLICT`: conflicting/ambiguous/multiple records or irreconcilable provenance inputs (deterministic, no selection).
- `UNKNOWN` / `PROVENANCE_UNVERIFIABLE`: reserved for cases where required verification cannot be completed under this slice’s inputs without guessing (fail-closed, never a pass). *(v1 slice aims to classify deterministically; any unclassifiable internal/error path must not pass.)*

**Composition (frozen intent):** A claim requiring trusted provenance is **not satisfied** by binding consistency (`BOUND`) alone; provenance must be `PROVENANCE_VERIFIED` for the same record/context/anchor assumptions. `BOUND` meaning is unchanged.

### 3.7 Threat model coverage (v1 slice) and expected outcomes
| Threat / case | Expected outcome |
|---|---|
| Forged-but-consistent record (no/wrong signature or untrusted key) | `PROVENANCE_BAD_SIGNATURE` or `PROVENANCE_UNTRUSTED_ISSUER` (never verified) |
| Correct signature but wrong context (network/chainId) | `PROVENANCE_CONTEXT_MISMATCH` |
| Malformed/typed/unknown-field/unsupported version | `PROVENANCE_MALFORMED` |
| Missing required time input when window present | `PROVENANCE_MALFORMED`/fail-closed (unverifiable window) |
| Not-yet-valid / expired (with injected now) | `PROVENANCE_NOT_YET_VALID` / `PROVENANCE_EXPIRED` |
| Multiple/conflicting records supplied | `PROVENANCE_CONFLICT` |
| Valid under external pinned anchor + matching context + valid window | `PROVENANCE_VERIFIED` |

## 4. Adversarial verification (v1 implemented scope)
- Positive/negative vectors covering valid verification, bad signature, wrong key/issuer, context mismatch, malformed/type confusion/unknown fields, time window failures, and conflict.
- Determinism checks for identical inputs.
- Independent reference comparison within tests for representative cases (separately specified from implementation logic paths) and non-permissiveness assertions.
- **Note:** large-scale fuzzing/mutation campaigns and external independent review are valuable follow-ups; this slice provides deterministic, reproducible adversarial/property-oriented coverage in-repo, not a claim of exhaustive assurance.

## 5. Out of scope (v1 slice, explicitly not claimed)
- Revocation/status infrastructure, key rotation protocols, multi-anchor/quorum trust chains, network fetch of records, ledger/on-chain resolution, semantic execution proof, and production key management.
- Any change to `BOUND` semantics or to `bindReceiptIdentity`’s existing verdict meanings.

## 6. Deliverables in this slice
- Frozen spec decisions (this document) aligned with implementation and tests.
- `scripts/ladder/resolved-record-provenance.mjs` (CG-RRP/1) — fail-closed verification against external trust anchor.
- `test/integrations/resolved-record-provenance.test.mjs` — positive/negative/adversarial/determinism/reference vectors.

*Claims limited to reproducible, pinned evidence for this slice.* 
