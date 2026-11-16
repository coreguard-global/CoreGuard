# Letter of intent — CoreGuard × AER-1 (draft)

**Status: DRAFT — NOT SENT — NOT SIGNED.** No counterparty has reviewed this
text. It records an intent to keep two receipt vocabularies in sync, and it
obliges nobody to anything beyond attribution.

**From:** CoreGuard (CoreGuard Global), issuer of the CGEP/1 execution-receipt
draft and the L1 verification ladder.
**To:** Brennan Zambo, author of AER-1 (`draft-zambo-aer1-26`), Agent Execution
Receipt format.
**Date of draft:** 2026-11-16.

---

## 1. What each side already published

**AER-1.** A fail-closed receipt format anchored on a SHA-256 commitment over
the receipt's published canonical bytes, with no chain anchor and no signature
required for verification. It enumerates the receipt id as a separate axis
(`absent` / `unverified` / `matched` / `resolved` / `mismatched`) precisely
because the id sits outside the committed payload, and it carries a conformance
corpus that is public and digest-pinned (kit v1.5.7, 143 vectors, 146 checks,
one `evaluated_set_digest`).

**CoreGuard.** A verification layer for agent payment mandates with three
outcomes — `VERIFIED`, `MISMATCH`, `UNKNOWN` — where `UNKNOWN` always carries a
named reason and never collapses into a pass. Its L1 receipt verifier now binds
the receipt identity to the committed digest on its own axis, after the defect
disclosed in issue #56: a digest that verified perfectly could be relabeled with
a *different* receipt's id and still return `VERIFIED`.

## 2. What this letter proposes

A reciprocal, non-exclusive exchange, with no money on either side:

1. **Vectors, in both directions.** CoreGuard has vendored six of AER-1's
   id-binding vectors, byte-for-byte, with both pins recorded —
   `evaluated_set_digest` for the evaluated set and the sha256 of the vendored
   file — so a silent edit to a fixture fails CI by name rather than changing
   what the vectors mean. AER-1 may lift, in the same way, any vector from
   CoreGuard's L1 identity battery, including the mutation control that proves
   the guard is load-bearing.
2. **One published mapping.** CoreGuard maintains a mapping table from AER-1
   verdicts into CGEP/1 codes, in `docs/sep-receipt-semantics-draft-2026-11-11.md`
   §7: digest pass → `VERIFIED`; commitment contradiction → `MISMATCH`; id
   `matched` → `RECEIPT_ID_BOUND`; id `absent`/`unverified` →
   `RECEIPT_ID_UNBOUND`; id `mismatched` → `RECEIPT_ID_MISMATCH`; and the one
   asymmetry it does not paper over — AER-1's resolution step has no CGEP/1
   analogue, so a *resolved* id is reported as
   `RECEIPT_ID_RESOLUTION_UNSUPPORTED` (an `UNKNOWN` with a named reason), never
   as agreement.
3. **Version-bump notice.** When AER-1's kit version or `evaluated_set_digest`
   changes, a short notice — one line is enough — so the pins are updated in a
   single commit instead of drifting silently until someone notices a mismatch
   between two public documents. The same notice flows the other way if CGEP/1's
   verdict vocabulary changes.
4. **Attribution, preserved permanently.** Every vendored vector keeps its
   origin, kit version and corpus digest in `PROVENANCE.md` next to it. Neither
   party relicenses the other's corpus, and neither claims authorship of it.

## 3. What this letter explicitly does not do

- It does not transfer ownership, license, or exclusivity of any artifact.
- It does not commit either party to integrate the other's code, ship it, or
  endorse it. A mapping between vocabularies is not an endorsement, and both
  documents will say so.
- It does not create a joint venture, a partnership for the purposes of
  fundraising, or any obligation to mention the other in an application.
- It does not involve payment, equity, tokens, or revenue share. There is
  nothing to pay: the corpus is public and the mapping work is small.

## 4. Term and termination

Ninety days from the later signature, renewable by a one-line reply from both
sides. Either party may terminate at will with seven days' written notice; on
termination the attribution clauses, and the pins already committed, survive.
Nothing here is exclusive, so termination costs neither side a capability.

## 5. What is binding

Only §2.4 (attribution), §3 (no endorsement claimed) and §5 itself. Every other
paragraph is a statement of intent, and neither party's failure to act on it is
a breach. This letter is governed by no particular jurisdiction, because it
obliges no performance; if a signature requires a governing law, the parties
will name one at signature rather than invent one here.

## 6. Signatures

| Party | Name | Title | Signature | Date |
|---|---|---|---|---|
| CoreGuard | | | | |
| AER-1 | Brennan Zambo | Author, `draft-zambo-aer1-26` | | |

*Draft prepared 2026-11-16. This file is an instrument, not an agreement, and it
must not be cited anywhere as evidence of a relationship until a signed copy
exists and is linked from [`README.md`](README.md).*
