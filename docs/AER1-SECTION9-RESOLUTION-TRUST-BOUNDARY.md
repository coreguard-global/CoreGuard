# AER-1 Section 9 Resolution — Trust Boundary & Verification Notes

**Scope:** `scripts/ladder/verification-levels.mjs` → `bindReceiptIdentity(...)` (receipt-id binding, including AER-1 Section 9–style resolution handling).  
**Status:** implementation and tests in-repo; **not** an independent security audit, formal proof, or production certification.

## 1) What is implemented
When a `resolvedRecord` is provided, `bindReceiptIdentity` evaluates identity binding by **value comparison** (fail-closed):

- **BOUND** (`RECEIPT_ID_BOUND`): the claimed receipt id matches `resolvedRecord.id` **and** the artifact’s committed digest matches the resolved record’s committed digest (agreement on the compared values).
- **MISMATCH** (`RECEIPT_ID_MISMATCH`): the resolved record for the claimed id does **not** agree with the artifact’s committed digest (contradicted/borrowed label) — never a pass.
- **UNKNOWN** (`RECEIPT_ID_RESOLUTION_UNSUPPORTED`): resolution evidence is **incomplete or not comparable** (missing/empty id or digest) — unestablished identity is **never** treated as success.

Supported digest fields (best-effort, string comparison): `output_hash` / `outputHash` / `commitmentDigest` / `digest` (resolved record) compared against artifact/commitment/options digests as provided.

## 2) Critical trust boundary (current model)
**`bindReceiptIdentity` checks consistency of the values it is given; it does not, by itself, verify the authenticity or provenance of a caller-supplied `resolvedRecord`.**

- A `resolvedRecord` that is internally consistent with the artifact (matching id and digest) will yield **BOUND** based on those values — even if the record’s origin, issuer, signature, network context, or freshness was not independently established.
- Therefore: **“consistent/bound by compared values” ≠ “resolved record is trustworthy/authentic”**. Establishing that the resolved record comes from a trusted source (and is the correct record for the intended context/network/time) is a **separate evidence/trust requirement** outside this function’s proof.
- The function is **fail-closed on ambiguity and contradiction of provided evidence**, not a substitute for source authentication.

## 3) What BOUND / MISMATCH / UNKNOWN mean (and do not mean)
| Verdict | Means (given inputs) | Does **not** mean |
|---|---|---|
| `BOUND` | Compared id and committed digest agree | The resolved record is authentic/trusted, the transaction executed, semantics are correct, or the system is secure |
| `MISMATCH` | Compared id/digest disagree (contradiction/borrowed label) | Anything beyond the compared binding evidence |
| `UNKNOWN` | Evidence insufficient/uncomparable to establish binding | Safe to treat as success; it is explicitly **not** a pass |

## 4) Evidence and reproducibility (in-repo)
- Vendored AER-1 id-binding corpus vectors replayed in CI: `test/integrations/aer1-id-binding-fixtures.test.mjs` (including resolution agreement/disagreement; provenance pinned with the fixture set).
- Identity-binding must-fail controls and mutation-control proof: `test/integrations/l1-identity-binding.test.mjs`.
- Adversarial/boundary/property-style checks and an independent reference comparison for resolution cases: `test/integrations/aer1-resolution-adversarial.test.mjs`.
- Spec/mapping notes: `docs/sep-receipt-semantics-draft-2026-11-11.md`.

## 5) Known gaps / next hardening directions (not claimed as done)
- **Provenance/source authentication:** cryptographic verification of resolved-record origin/issuer, network/context binding, freshness/replay protections where applicable.
- **Richer adversarial coverage:** fuzzing, broader property-based generation, multi-source/conflicting resolved records, version/algorithm negotiation cases as models evolve.
- **Independent external evaluation:** third-party reproduction/review of results and threat model (distinct from in-repo CI and tests).

*This document states boundaries to keep claims precise and evidence-driven.*