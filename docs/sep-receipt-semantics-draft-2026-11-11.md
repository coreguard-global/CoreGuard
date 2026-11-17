# SEP draft: fail-closed execution-receipt semantics for Stellar

*العربية: [نسخة عربية من هذه المسوّدة](sep-receipt-semantics-draft-2026-11-11-ar.md) — the Arabic edition is a declared pair: its provenance line pins this file's digest, and `test/ci/bilingual-pairs.test.js` fails when the two drift apart.*

**DRAFT instrument, 2026-11-11.** Authored under owner-delegated authority
(the owner granted full delegation this date). This is a DRAFT proposal only:
it is NOT submitted to any standards body, and any external submission
requires the owner's per-step sign-off per standing rule. Supersede with a
newer dated instrument rather than editing.

Reference implementation: CoreGuard (this repository) - L1 receipt semantics
`verifyReceipt(receipt, commitment, chain)` as specified in
`docs/verification-and-integration-platform-2026-09-26.md` §1, with the live
Soroban commitment anchor on Stellar mainnet as the working authority.

---

## Abstract

This proposal defines one verdict vocabulary and one fail-closed rule for
"did this execution happen as authorized?" questions on Stellar. Every
integrated action (an agent payment, a DEX swap, a dispute filing) carries a
deterministic receipt; a verifier answers exactly one of three outcomes -
`VERIFIED`, `MISMATCH`, or `UNKNOWN` with a named reason code - and an
ecosystem in which wallets, explorers, DEXes, and AI agents all speak the same
three outcomes can compose trust without each party inventing its own.

## Motivation

Today the Stellar ecosystem has no shared semantics for execution-verification
verdicts. Each wallet, explorer, and service answers "was this executed?" with
ad-hoc language, and - critically - most implementations share one defect:
**a verification that cannot run is silently treated as a pass, or its
uncertainty is laundered into a softer success.** The most dangerous verdict
is not the failure; it is the unnamed green check ([C30]/[C31] lesson class,
measured repeatedly in this repository's own history).

CoreGuard has run these semantics in production-shaped code with a live
mainnet anchor (contract `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`,
third-party-listed on stellar.expert) and a CI-enforced rule that the
documentation must restate the machine exactly. The proposal generalizes that
working surface into a standard any project can implement without CoreGuard.

## Specification

### 1. The receipt

A receipt is a canonical, byte-determinable record of one authorized action:
what was authorized (policy/allowlist/deadline/size judgment made BEFORE
submit), what happened (the execution record), and where it landed
(`txHash` + network). Its digest is computed over its canonical byte form;
two verifiers given the same receipt derive the same digest.

### 2. The verdict function

`verifyReceipt(receipt, commitment, chain) -> { verdict, code }` where `chain`
is a chain authority able to look up a `txHash`. The verdict turns on
**whether anyone was asked**, and there are exactly three outcomes:

| Verdict | Code | Meaning |
|---|---|---|
| `UNKNOWN` | `NO_CHAIN_EVIDENCE` | No authority was passed at all - nobody was asked. Absent evidence, never absolution. |
| `MISMATCH` | `TX_NOT_FOUND` | An authority WAS asked and does not know the claimed `txHash`. The only contradiction verdict - the system's strongest signal. |
| `UNKNOWN` | `EVIDENCE_INCONSISTENT` | The receipt is too malformed to ask an authority with. Absent evidence again - never a silent pass. |
| `UNKNOWN` | `RECEIPT_ID_UNBOUND` | The authority confirmed the `txHash`, but the receipt names no identity (or none was presented), so nothing binds the evidence to this receipt. Absent evidence about the label - deliberately not a contradiction, and never a pass. |
| `MISMATCH` | `RECEIPT_ID_MISMATCH` | The receipt names a different identity than the one it was presented with. The evidence may be genuine and belong to another receipt: the borrowed-label case. |
| `VERIFIED` | (none) | The authority confirmed the `txHash`, the derived commitment matches, AND the receipt's identity is bound to the presented commitment. |

### 3. The fail-closed rule

1. `UNKNOWN` is never success. It may never be rendered by any wallet,
   explorer, or service as a checkmark, a pass, or an absence of warning.
2. `VERIFIED` requires an authority. A structurally perfect receipt nobody
   confirmed against a chain is `UNKNOWN/NO_CHAIN_EVIDENCE`, not `VERIFIED`.
3. `MISMATCH` is the loudest verdict, not the quietest: an authority that was
   asked and contradicted the claim must be surfaced as a contradiction,
   never folded into a generic "unverified" bucket alongside cases where
   nobody asked.
4. `NOT_APPLICABLE`/`ABSENT` never count as success for a mandatory check;
   a missing mandatory premise aborts, it does not skip.
5. **Identity is bound separately from evidence.** Confirming a `txHash`/`blockHash`
   pair says nothing about WHICH receipt it belongs to, so a receipt must name
   the commitment it belongs to, and that name must be the one presented. An
   unbound identity is `UNKNOWN/RECEIPT_ID_UNBOUND`; a borrowed label is
   `MISMATCH/RECEIPT_ID_MISMATCH`. Neither may be folded into `TX_NOT_FOUND`
   (in the swap case the authority was asked and *agreed*) and neither may be
   dropped as "unverified" alongside cases where nobody asked.

### 4. Offline re-derivation

Any party must be able to re-derive the verdict from the receipt's own bytes
plus a committed canonical tree, without network access beyond the optional
authority lookup: the receipt records the raw wire data it is derived from -
never a client-library proxy object whose scalar fields may silently carry
callables instead of values - and a corroborating arithmetic identity
(amounts conserved to the base unit) belongs in the artifact so a proxy
substitution cannot lie silently.

### 5. Anchoring (optional strengthening)

A commitment anchor (Soroban contract) may bind a receipt digest on-chain,
giving the authority a second, independent path: the verdict may then be
re-derived from the anchor's stored digest alone. Anchoring strengthens
`VERIFIED` but is never a substitute for the three-outcome rule itself.

## Rationale

- **Three outcomes, not two.** Compressing the rule to "format-valid but
  unconfirmed = UNKNOWN" loses the `MISMATCH` branch - the strongest signal
  the system produces - behind its weakest verdict. Every compressed
  restatement this repository has ever shipped was measured to drop exactly
  that branch, which is why the rule here is spelled out per-branch.
- **Named reason codes.** A verdict a human cannot distinguish ("unknown"
  vs "unknown") cannot be composed by an agent, and agents are the primary
  new class of Stellar transactor.
- **Fail-closed by default.** The standard must make the silent pass the
  hardest thing to build, not the easiest.

### 6. Identity binding (normative, added after review)

The id-binding swap is the first must-fail vector of this section: take a
receipt whose evidence verifies perfectly, relabel it with a different
receipt's identity, and the verdict must fail on the binding while the
commitment checks pass. Two enumerated codes exist so the failure is legible:
`RECEIPT_ID_UNBOUND` (nothing established about the label - `UNKNOWN`) and
`RECEIPT_ID_MISMATCH` (two artifacts we hold disagree - `MISMATCH`). Both must
be declared on the code axis as a frozen set a caller can enumerate, and both
sit on an axis independent of evidence: they can fire while every evidence
check passes, and no evidence failure may be reported under them. A format
that carries no receipt identifier at all, like this draft's reference
implementation before review, cannot express the distinction and therefore
cannot claim conformance.

The binding is proven, not asserted: the reference implementation's test suite
mutates the shipped module at run time by deleting exactly this branch and
shows the pre-fix code laundering the swap (`VERIFIED/RECEIPT_INTEGRITY` for a
borrowed label) before showing the shipped code refusing the same bytes. A
conformance kit that only tests the fixed code cannot tell a real branch from a
missing one.

### 7. External conformance vectors (AER-1)

The six published id-binding vectors of AER-1 (`draft-zambo-aer1-26`, corpus kit
v1.5.7) are vendored verbatim in `test/fixtures/aer1-corpus-v1.5.7/` with their
provenance and both digests recorded, and are replayed on every CI run. Nothing
here was paraphrased: the file's sha256 equals the digest the corpus index
publishes for that path, and the corpus `evaluated_set_digest` is pinned beside
it.

The mapping is not one-to-one, and the differences are the interesting part:

| AER-1 id verdict | this draft's outcome | note |
|---|---|---|
| `matched` | `BOUND` (`RECEIPT_ID_BOUND`) | the id agrees with an externally supplied expectation |
| `mismatched` | `MISMATCH` (`RECEIPT_ID_MISMATCH`) | the swap case: digest passes, label contradicts |
| `unverified` | `UNKNOWN` (`RECEIPT_ID_UNBOUND`) | a label checked against nothing is not a pass here either |
| `absent` | `UNKNOWN` (`RECEIPT_ID_UNBOUND`) | a missing required member is an absence, not a skip |
| `resolved` (agreement) | `BOUND` (`RECEIPT_ID_BOUND`) | Resolution exercised (AER-1 Section 9): the resolved record's committed digest agrees with the artifact, so the identity is bound. |
| `resolved` (disagreement) | `MISMATCH` (`RECEIPT_ID_MISMATCH`) | Resolution exercised (AER-1 Section 9): the resolved record for the claimed id does not agree with the artifact's committed digest (borrowed/contradicted label). Incomplete resolution evidence remains `UNKNOWN` (`RECEIPT_ID_RESOLUTION_UNSUPPORTED`), never a pass. |

Resolution (Section 9 shape) is implemented for cases where the resolved record and artifact committed digests can be compared; incomplete evidence is reported explicitly as unsupported/unknown rather than treated as agreement.

## Testability

Each verdict is reproducible from a clean clone: the negative cases (no
authority; asked-and-contradicted; malformed evidence; borrowed label;
absent identity) are ordinary unit tests, and the documentation of any implementation claiming conformance is
required to restate the three branches in the same paragraph - enforced in
this repository by a contract test that derives the codes from the module at
run time and fails the build when prose and machine diverge.

## Copyright

To be finalized under the license terms used by Stellar Enhancement
Proposals (Apache 2.0 pattern), on acceptance for submission.
