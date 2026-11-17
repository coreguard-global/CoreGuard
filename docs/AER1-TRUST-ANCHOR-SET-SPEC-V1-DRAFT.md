# CoreGuard — Trust Anchor Set, Rotation & Revocation Spec (CG-TAS/1, v1)

**Status:** FROZEN (v1 minimal-slice contract decisions) — implementation/test coverage applies to this frozen slice; broader anchor infrastructure remains future work unless explicitly specified and evidenced.
**Scope:** The two open design decisions left open by `docs/AER1-EVIDENCE-PROVENANCE-SPEC-V1-DRAFT.md` §5 — **trust-anchor distribution** (its §3.1 left the anchor "caller-pinned" without defining the pinned artifact) and **key rotation/revocation** — answered as one implementable, fail-closed slice: `scripts/ladder/trust-anchor-set.mjs` (CG-TAS/1), composing over CG-RRP/1 (`scripts/ladder/resolved-record-provenance.mjs`, unchanged).
**Reference baseline:** `c19f9a8` (green, run 44091153922) for the CG-RRP/1 provenance layer; this spec freezes the v2-foundation decisions layered on that baseline.
**Authorization note:** owner directive 2026-11-17 — the v2 foundation wave (anchor set + rotation/revocation + fuzz/mutation campaigns) is explicitly authorized; the general feature-freeze posture otherwise stands.
**Non-claims:** Not a security audit, formal proof, certification, production-readiness claim, or evidence of adoption/integration/funding/partnership. CG-TAS/1 proves only what this frozen contract states. `VERIFIED ≠ SAFE`; `BOUND` semantics are untouched.

---

## 1. Purpose
Make the "external trust anchor" of CG-RRP/1 operable without weakening it:
1. **Distribution** — define the artifact the caller actually pins, so "the anchor comes from outside the record" becomes a concrete, digest-pinnable document.
2. **Rotation** — give keys deterministic validity windows judged only against caller-injected time.
3. **Revocation** — make revocation decisive and fail-closed regardless of signature validity.
4. **Non-negotiables preserved** — the record still cannot select or influence its trust key; ambiguity still fails closed; the `PROVENANCE_*` verdict axis is unchanged; no wall clock; no network.

## 2. Distribution model (frozen decision, v1)
- The trust anchor set is a **canonical-JSON document** supplied by the **caller**, obtained **out-of-band** (a repo commit, a config file, an owner-published digest). The verifier performs **no network access, no key discovery, no TOFU**.
- A caller **may** pin a **sha256 digest over the canonical bytes** (`anchorSetDigest`); a presented set whose canonical digest differs from the pin is a hard `PROVENANCE_CONFLICT` (`DIGEST_MISMATCH`). The digest is defined over **canonical bytes** (sorted keys, no whitespace), so formatting differences of the transported text never change the pin's meaning.
- **One set per verification.** A caller that pins both a set and a separate single trust anchor is ambiguous and fails closed (`CALLER_AMBIGUOUS_INPUT`).
- The set is **never read from the record**. A record that carries anchor material is ignored for trust purposes; resolution uses only the record's declared `issuerKeyId` looked up inside the caller-pinned set.

## 3. Document format (frozen, strict)
Top-level allowed fields (any other field → `PROVENANCE_CONFLICT` / `UNKNOWN_SET_FIELD`):
- `spec`: exactly `"CG-TAS/1"`.
- `anchorSetId`: non-empty string (opaque distribution identifier).
- `keys`: array of key entries (may be empty; an empty set resolves nothing).
- `generatedAt`: optional non-negative safe integer — **informational only, never read for decisions**.
- `annotations`: optional plain object — **non-decisional, never read for decisions**.

Key-entry allowed fields (any other field → `PROVENANCE_CONFLICT` / `UNKNOWN_KEY_FIELD`):
- `keyId`: non-empty string. Unique within the set by construction — **any duplicate `keyId` (even byte-identical duplicates) is a `DUPLICATE_KEY_ID` conflict**; a duplicated distribution is ambiguous and is never resolved by "first match".
- `publicKeyHex`: exactly 64 **lowercase** hex chars (32-byte Ed25519 public key). Lowercase-only is required so the canonical form — and therefore the digest pin — is unique (uppercase would be a second spelling of the same key and a second canonical form).
- `notBefore`, `notAfter`: optional non-negative safe integers (epoch seconds), `notAfter >= notBefore` when both present. Window bounds are **inclusive**: valid when `notBefore <= decisionTime <= notAfter`.
- `revoked`: optional boolean (default `false`).
- `revokedAt`: required non-negative safe integer **iff** `revoked === true`; must be **absent** otherwise. `revokedAt` is **informational** (audit trail) — the `revoked` flag alone is decisive.

## 4. Resolution semantics (frozen)
`verifyResolvedRecordProvenanceViaAnchorSet(record, anchorSetSource, expectedContext, { nowSeconds, anchorSetDigest? })`

Deterministic order (first failure wins; every failure is a named, non-passing verdict):
1. **Set parse/shape** — text must parse as JSON; object must satisfy §3. Shape/parse/unknown-field failures → `PROVENANCE_CONFLICT` (trust-configuration conflicts), except `MISSING_DECISION_TIME` → `PROVENANCE_MALFORMED`.
2. **Digest pin** — present pin must equal the canonical digest → else `PROVENANCE_CONFLICT` / `DIGEST_MISMATCH`.
3. **Decision time** — `nowSeconds` (non-negative safe integer, **caller-injected**) is **always required** on the set path: rotation windows and revocation epochs are intrinsic to set semantics. Missing/invalid → `PROVENANCE_MALFORMED` / `MISSING_DECISION_TIME`. The wall clock is never read.
4. **Record keyId extraction** — the record must declare a non-empty `payload.issuerKeyId` → else `PROVENANCE_MALFORMED`. Full record validation stays with CG-RRP/1.
5. **Resolution** — exactly one key entry must carry the declared `keyId`; `0` → `UNKNOWN_KEY_ID`, `≥2` → `DUPLICATE_KEY_ID`. Revoked → `ANCHOR_REVOKED`. Outside the window → `ANCHOR_NOT_YET_VALID` / `ANCHOR_EXPIRED`.
6. **CG-RRP/1 verification** — signature, context binding and the record's own `issuedAt`/`expiresAt` window are verified by the unchanged CG-RRP/1 verifier under the resolved external anchor, with the **same** injected `nowSeconds`.

Set-failure mapping onto the frozen `PROVENANCE_*` axis (never a pass):

| Set-level reason | Verdict axis |
|---|---|
| `UNKNOWN_KEY_ID` | `INVALID` / `PROVENANCE_UNTRUSTED_ISSUER` |
| `ANCHOR_REVOKED` | `INVALID` / `PROVENANCE_UNTRUSTED_ISSUER` |
| `ANCHOR_NOT_YET_VALID` | `INVALID` / `PROVENANCE_NOT_YET_VALID` |
| `ANCHOR_EXPIRED` | `INVALID` / `PROVENANCE_EXPIRED` |
| `MISSING_DECISION_TIME` | `INVALID` / `PROVENANCE_MALFORMED` |
| shape/parse/`UNKNOWN_*`/`BAD_*`/`DUPLICATE_KEY_ID`/`DIGEST_MISMATCH`/`CALLER_AMBIGUOUS_INPUT` | `INVALID` / `PROVENANCE_CONFLICT` |

Unexpected internal errors → `UNKNOWN` / `PROVENANCE_UNVERIFIABLE` (fail-closed, never a pass).

## 5. Rotation model (frozen, v1)
- **Rotation is a document lifecycle, not an online protocol.** A publisher issues a new set (new `anchorSetId`, new keys with new `keyId`s and windows). No key is ever modified in place within a distributed set.
- **Overlap is allowed and resolved per record:** during a rotation overlap, old and new keyIds coexist in the pinned set; each record resolves strictly through its own declared `issuerKeyId`. There is no "pick a key" ambiguity because the record's declaration is matched against a uniquely-keyed set — and uniqueness is enforced (§3).
- **Era pinning:** the caller pins the era-appropriate set. Verifying a historical record signed by a rotated-out key requires a set that still contains that key inside its window (old sets are retained by the caller). Cross-era, multi-set orchestration (e.g. "try every set until one verifies") is **explicitly out of slice** — it would reintroduce selection ambiguity.

## 6. Revocation model (frozen, v1)
- A `revoked: true` key **fails closed forever within its set**, regardless of signature validity or record window: revocation dominates every other check in resolution.
- `revokedAt` records when the revocation took effect; it is **never** used to "un-revoke", gate, or time-scope the failure.
- **Scoping honesty:** revocation is authoritative **within the presented set**. Cross-set revocation propagation (a revocation registry consulted across distributions) is out of slice; the v1 mitigation is operational — publishers re-issue sets and callers re-pin by digest. This limitation is stated, not hidden.

## 7. Threat model coverage (v1 slice)
| Threat / case | Expected outcome |
|---|---|
| Record self-selects a trust key (declares a keyId absent from the pinned set) | `PROVENANCE_UNTRUSTED_ISSUER` (`UNKNOWN_KEY_ID`) |
| Revoked key with a valid signature (revocation replay) | `PROVENANCE_UNTRUSTED_ISSUER` (`ANCHOR_REVOKED`) — revocation dominates |
| Key used outside its validity window (with injected decision time) | `PROVENANCE_NOT_YET_VALID` / `PROVENANCE_EXPIRED` |
| Ambiguous distribution (duplicate keyId, even byte-identical) | `PROVENANCE_CONFLICT` (`DUPLICATE_KEY_ID`) — never "first match" |
| Tampered set behind a digest pin | `PROVENANCE_CONFLICT` (`DIGEST_MISMATCH`) |
| Set-shape smuggling (unknown fields, type confusion, malformed windows/revocation) | `PROVENANCE_CONFLICT` (named shape reason) |
| Caller pins both a set and a single anchor | `PROVENANCE_CONFLICT` (`CALLER_AMBIGUOUS_INPUT`) |
| Benign canonicalization (key reorder, whitespace, annotation/generatedAt edits) | Decisional fields unchanged → same verdict; set-content edits behind a pin → `DIGEST_MISMATCH` (correct, deterministic) |
| Wall-clock dependence | None — decisions use the injected `nowSeconds` only |

## 8. Composition with CG-RRP/1 (unchanged)
- The CG-RRP/1 verifier and its frozen verdicts are **not modified**; the direct single-anchor path still works exactly as frozen in `docs/AER1-EVIDENCE-PROVENANCE-SPEC-V1-DRAFT.md`.
- CG-TAS/1 only *resolves* which external anchor the caller's pinned set authorizes, then delegates. `BOUND` semantics and `bindReceiptIdentity` are untouched; provenance remains a separate axis.

## 9. Verification performed in this slice
- Unit/adversarial vectors: valid resolution, unknown/duplicate/revoked/out-of-window keys, inclusive window boundaries, digest pinning (correct + tampered), strict shape (unknown fields, lowercase-hex, type confusion), non-decisional field invariance, determinism, a non-permissiveness sweep, and the unchanged direct CG-RRP/1 path (`test/integrations/trust-anchor-set.test.mjs`).
- Deterministic fuzz campaign over the provenance boundary (fixed seed, offline, attack families + benign-canonicalization invariance + determinism sampling): `scripts/ladder/provenance-fuzz.mjs`, wired into the suite via `test/integrations/provenance-fuzz.test.mjs`.
- Source-mutation battery: named mutations of the provenance modules (keyId-match bypass, context/expiry/nowSeconds drops, revocation/duplicate/window/digest-pin drops) — each must **apply AND bite** (`test/integrations/provenance-mutations.test.mjs`).
- Measured totals are machine-pinned in `docs/state-snapshot.json` and not restated here.

## 10. Out of scope (v1 slice, explicitly not claimed)
- Multi-signature/quorum anchor sets, key-transparency logs, witness/CT-style gossip, on-chain anchor publication (owner-gated), HSM/KMS integration, automated rotation-expiry alerting.
- Cross-set revocation propagation; automated multi-set orchestration; network fetch of sets or records.
- Formal verification; exhaustive fuzzing assurance (the campaigns are deterministic and bounded, not proofs); any change to `BOUND` semantics or CG-RRP/1's frozen verdicts.
- Any claim of adoption, funding, partnership, or production readiness.

## 11. Deliverables in this slice
- Frozen decisions (this document).
- `scripts/ladder/trust-anchor-set.mjs` (CG-TAS/1) — strict validation, deterministic resolution, digest pinning, fail-closed composition over CG-RRP/1.
- `test/integrations/trust-anchor-set.test.mjs`, `test/integrations/provenance-fuzz.test.mjs`, `test/integrations/provenance-mutations.test.mjs`.
- `scripts/ladder/provenance-fuzz.mjs` — the deterministic campaign runner (its CLI gate applies the same zero-escapes discipline as the existing integrity mutation lab, and is exercised through the suite above).

*Claims limited to reproducible, pinned evidence for this slice.*
