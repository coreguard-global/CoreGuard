# CoreGuard — Evidence Provenance & Adversarial Identity Resolution Spec (v1 Draft)

**Status:** DRAFT (design/specification, pre-implementation).  
**Scope:** AER-1 Section 9–style receipt-id resolution path (`bindReceiptIdentity`) as implemented and tested on pinned revisions (e.g. `688d260` / `000d1aa`), and the next hardening step: **evidence provenance and source trust**.  
**Non-claims:** This document is **not** a security audit, formal proof, certification, production-readiness claim, or evidence of adoption/integration/funding/partnership. It defines questions, boundaries, and acceptance criteria to guide evidence-driven work.

---

## 1. Purpose
Strengthen Section 9 resolution from **value-consistency binding** toward **evidence-grounded verification** by explicitly separating:
1. **Identity/digest binding** — do the compared values agree?
2. **Evidence provenance/authenticity** — is the resolved record trustworthy for its claimed source and context?
3. **Fail-closed verdicting** — do ambiguity, conflict, or missing trust evidence remain non-passing (`UNKNOWN`/explicit refusal), never upgraded to `BOUND`?

## 2. Current baseline (measured/implemented)
- **Implemented behavior (fail-closed):** agreement on claimed id + artifact committed digest vs resolved record → `BOUND` (`RECEIPT_ID_BOUND`); disagreement → `MISMATCH` (`RECEIPT_ID_MISMATCH`); incomplete/uncomparable resolution evidence → `UNKNOWN` (`RECEIPT_ID_RESOLUTION_UNSUPPORTED`).
- **Evidence in-repo:** vendored AER-1 id-binding corpus vectors (including resolution agreement/disagreement), identity-binding controls/mutation proof, adversarial/boundary/property-style tests, and a small in-test reference comparison. CI green on pinned commits (see repository history/tags/issues for exact runs).
- **Key question (answered):** *Is `resolvedRecord` cryptographically authenticated by a trusted source in the current implementation?*  
  **No.** `bindReceiptIdentity` currently evaluates **caller-supplied records by value comparison only**. It does **not** verify issuer identity, cryptographic signature/proof of origin, network/context binding, freshness, or revocation of the resolved record.

## 3. Trust boundary (normative distinction)
| Concept | Meaning | Current proof |
|---|---|---|
| **Value-consistent binding** | Compared id/digest values agree | **Yes** (when evidence is complete/comparable) |
| **Authentic/provenant resolved record** | Record is issued/attested by a trusted source for the correct context | **No** (out of scope today; separate evidence required) |
| **Execution/semantic correctness** | Transaction executed as intended / semantics valid | **No** |

**Rule:** `BOUND` (current) MUST be interpreted as *bound by compared values*, **not** as proof of record authenticity, trusted provenance, or execution. Introducing provenance MUST NOT silently widen the meaning of existing verdicts without explicit, versioned semantics.

## 4. Threats and failure modes to address (v1 focus)
- **Forged-but-consistent records:** attacker supplies a self-consistent resolved record (matching id/digest) from an untrusted source.
- **Context confusion:** valid-looking record bound to wrong network, chain, ledger height/version, environment, or time window.
- **Conflicting evidence:** multiple resolved records for the same claim/context disagree (digest, issuer, or version).
- **Malformed/ambiguous inputs:** missing fields, type confusion, unexpected encodings/algorithms/versions, partial records.
- **Replay/staleness:** outdated or revoked records presented as current (where model applies).
- **Trust lifecycle gaps:** key rotation, revocation, expiration, algorithm agility not handled fail-closed.
- **Regression/permissiveness drift:** implementation becomes more accepting than the spec/reference/corpus.

## 5. Evidence Provenance Layer — design questions (to resolve before implementation)

### 5.1 Issuer identity & trust anchors
- Who may issue/attest a resolved record? (identified issuers, allowlisted keys, registries, or out-of-band trust)
- How are trust anchors distributed, pinned, rotated, and revoked?
- What is the verification path (direct key, chain of trust), and what is explicitly unsupported?

### 5.2 Cryptographic authenticity
- What proof authenticates the record? (signature scheme, MAC in symmetric contexts where applicable, or other verifiable attestation)
- Which canonical bytes/payload are covered by the proof? (exact field set and encoding)
- Algorithm/version agility: accepted suites, downgrade resistance, and fail-closed behavior on unknown/disabled algorithms.

### 5.3 Context binding
- Which context dimensions MUST bind to the record (e.g. network/chain identifier, environment, contract/app scope, ledger/reference point, issuance/validity time)?
- How is “same context” determined, and what mismatches yield `MISMATCH` vs `UNKNOWN`?

### 5.4 Conflicting records & resolution policy
- Input model: single record, set of records, or prioritized sources?
- Deterministic policy for conflicts: refuse (`UNKNOWN`/conflict state), require quorum, or select by rule — MUST be fail-closed and unambiguous.
- No silent preference that can be influenced to bypass contradiction.

### 5.5 Trust lifecycle
- Validity windows, expiration, not-before/after semantics (with pinned/injected time where determinism is required).
- Revocation/status checks: availability assumptions and fail-closed behavior when status is unavailable but required.
- Key compromise/rotation procedures and their effect on prior vs new records.

## 6. Verdict model (proposed separation, v1 target)
Preserve fail-closed guarantees and avoid semantic overloading:

- **Binding verdict (existing axis):** consistency of id/digest (and, when modeled, resolved binding) — `BOUND` / `MISMATCH` / `UNKNOWN` as defined.
- **Provenance/authenticity verdict (new/explicit axis, to be specified):** e.g. `AUTHENTICATED` / `NOT_AUTHENTICATED` / `UNVERIFIABLE` (names illustrative; final vocabulary to be frozen with codes), reported **separately** from binding consistency.
- **Composition rule (to specify):** a claim requiring trusted provenance MUST NOT be treated as satisfied when binding is consistent but provenance is unverified/unverifiable. Composition MUST be deterministic and fail-closed.

*(Any code changes to verdict surfaces require frozen vocabularies, tests, and doc alignment in the same change.)*

## 7. Adversarial verification plan (v1, pre/post implementation)
- **Negative/adversarial cases:** forged-but-consistent records, wrong-context records, conflicting/duplicate records, stale/revoked (when modeled), malformed/type-confused/empty fields, algorithm/version mismatches, partial evidence.
- **Property-oriented checks:** no `BOUND`/positive provenance verdict when required evidence differs or is missing; determinism for identical inputs; monotonicity (adding contradiction must not increase trust).
- **Permissiveness guard:** implementation MUST NOT be more permissive than the spec and reference corpus/expected outcomes (fail the build on drift).
- **Independent reference:** maintain/extend a reference evaluator **independently specified** from the implementation under test; compare implementation vs reference vs corpus expectations. (Independence must be real, not a copy of the same logic/bug.)
- **Reproducibility:** pinned revisions, recorded environment/commands/outputs, and reviewable artifacts; distinguish environment issues from package/spec issues in reports.

## 8. Deliverables for v1 (incremental, evidence-driven)
1. **This spec (refined):** resolved design choices, frozen evidence contract, verdict vocabulary/codes, and threat-model assumptions.
2. **Conformance vectors:** positive/negative/conflict/context cases with expected outcomes and provenance.
3. **Minimal implementation:** only after spec freeze for the targeted subset, with fail-closed defaults and explicit unsupported states.
4. **Tests:** corpus + adversarial + property/mutation-guard coverage proportionate to risk.
5. **Documentation:** trust boundaries, “what is proven / not proven”, and operator/reviewer guidance.

## 9. Open decisions (tracked)
- Chosen authenticity mechanism(s) and canonicalization/signing payload.
- Trust anchor model and distribution.
- Context dimensions required for v1.
- Conflict policy and verdict composition.
- Handling of unavailable revocation/freshness signals.

## 10. Review checklist (before claiming progress)
- [ ] Key question answered and documented (current: consistency-only, no provenance auth)
- [ ] `BOUND` vs “authentic/trusted source” kept distinct
- [ ] Fail-closed behavior specified for unknown/missing/conflicting evidence
- [ ] Adversarial cases and non-permissiveness guards defined
- [ ] Claims limited to reproducible, pinned evidence
