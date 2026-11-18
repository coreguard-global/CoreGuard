# AER-1 × VAR/1 — outcome mapping and canonicalization notes

**Status:** working note, revision 2, 2026-11-18. Written in reply to Brennan
Zambo's review of VAR/1 in ACP discussion #328. Revision 2 records the AER-1
side's answers to the three canonicalization questions (section 3) and the
consequence for our own code vocabulary. It is not an ACP artifact, not a SEP,
and not a claim of agreement by anyone but us.

**What this note is for.** Two models can describe the same artifact and still
mean different things by "verified". This note puts the two vocabularies side by
side, states which of our bindings is weakest and why, lists what we can actually
execute today, and names what we cannot execute instead of implying it.

**What it is not.** It is not a comparison of quality, not an endorsement, and not
evidence of adoption. Zambo has not reviewed this note; the AER-1 authors may
disagree with parts of it, and where they do, they are right about their own
format.

## 1. The five outcomes

AER-1 separates the outcome of a verification from the reject codes underneath
it. Our vocabulary stops at the codes, which is the gap this section records.

| AER-1 outcome | What it asserts | VAR/1 today | What VAR/1 must add |
|---|---|---|---|
| `verified` | the digest re-derives over the committed bytes | `PASS`, with `executionProof: NOT_INCLUDED` | nothing — the boundary sentence below is the missing part |
| `verification failed` | the bytes are present and the digest does not re-derive | `BLOCK` plus one of the frozen codes | nothing, provided drift never gets its own bespoke failure string |
| `absent` | no record was presented at all | **no representation** | `ABSENT` as an outcome that never travels as `BLOCK` |
| `not checked` | a record was presented and deliberately not evaluated | **no representation at the receipt level** | `NOT_CHECKED` as an outcome |
| `rejected: unresolvable record` | the record is present but its anchor cannot be resolved | **no representation** | a first-class code, not a borrowed one |

The two rows that matter for an opt-in layer are `absent` and `not checked`.
If absence is rendered as failure, every party that never opted in is scored as
having failed a verification it never took part in, and opt-in becomes a
liability. If "not evaluated" collapses into either neighbour, a verifier gets
credit for work it did not do.

One correction to our own earlier framing: the vocabulary is not foreign to this
tree. The vendored AER-1 fixture in `test/fixtures/aer1-corpus-v1.5.7/` pins
`expected_id_verdict` values of `unverified`, `matched`, `mismatched`, `resolved`
and `absent`, and we execute those six vectors on every push. What is missing is
not the words — it is the **receipt-level outcome** above our reject codes.
Field-level verdicts exist here; the layer that decides what a risk system is
allowed to conclude does not.

## 2. The three bindings, and which one of ours is weakest

Three claims travel in one artifact and they fail in different places:

1. **Intent digest** — what the wallet saw the user approve.
   `sha256(canonicalJson(intent))`, sorted keys, no insignificant whitespace.
2. **Execution hash** — what the merchant's order system recorded as executed.
3. **Receipt identity** — which copy of which record, resolved against which
   anchor.

Ours collapses (3) into the content digest of the canonical receipt
(`receipt.digest`, returned as `receiptId` by the verifier). That is a strength
in one direction — two copies of the same record cannot claim different
identities — and a loss in the other: an identity that is a function of content
cannot carry anything the content does not, and **the anchor a record is supposed
to resolve against is exactly such a thing**.

AER-1's `metadata_hash` covers that separately. VAR/1 should too: a `record_id`
computed over identity material (issuer, series, issuance counter) and an
`anchor_ref`, with the content digest left to do only the content job. This is
the change we would make first, and it is the one that makes an
`unresolvable` outcome expressible at all — today we have nowhere to put it.

## 3. Canonicalization: what is settled and what is not

Settled on our side, and unchanged by this note:

- **JSON** — sorted keys, no insignificant whitespace, UTF-8 (`canonicalJson()`);
  digests are sha256 over those bytes.
- **Clock** — verification takes an injected `nowSeconds`. Nothing in the
  verifier reads wall-clock time, so a verdict is reproducible from the record
  alone.
- **Decision surface** — two decisions, `PASS` and `BLOCK`, and eleven frozen
  reject codes: `MALFORMED_RECEIPT`, `MALFORMED_INPUT`, `BAD_DIGEST`,
  `BAD_SIGNATURE`, `ISSUER_MISMATCH`, `XDR_BINDING_MISMATCH`, `NETWORK_MISMATCH`,
  `POLICY_MISMATCH`, `NOT_YET_VALID`, `RECEIPT_EXPIRED`, `VERIFIER_ERROR`. A new
  code lands with a must-fail fixture, never as an open-ended string.

Settled by the corpus, and adopted here without argument:

- **Base64** — standard alphabet, padded, not URL-safe. One spelling, byte for
  byte, or every implementation re-derives a different digest from the same
  record.

Asked here, and answered by the AER-1 side in the same thread on 2026-11-18.
Recorded because the answers change what our codes mean:

1. **An empty tool scope** is a record-layer rejection, not a policy result. The
   corpus pins it as `ax-tool-empty-scope` with `"scope": ""` and the reason
   "tool is not an object with name/version/scope strings". A record that fails a
   shape rule fails for every conforming verifier alike, so the outcome is a
   failed verification **of that record**. Their sharpening is the part worth
   keeping: the outcome is a property of the record under the spec's rules, not
   of which layer a given verifier happened to reach first. Our "policy could
   not be evaluated" is a different fact and keeps its own answer — `not
   checked` for that layer.
   *Mapped to our vocabulary:* `MALFORMED_RECEIPT`, never `POLICY_MISMATCH`.
2. **A February 29 in 1900** is a calendar rule, not a range check: the date must
   exist in the proleptic Gregorian calendar, and the positive side is pinned in
   the same set (`feb29-leap`, 2024-02-29, valid). 2100-02-29 fails for the same
   reason as 1900 — divisible by 100, not by 400 — which is exactly the case a
   range check gets wrong.
   *Mapped to our vocabulary:* `MALFORMED_RECEIPT` (a `created_at` that is not a
   valid calendar instant), never `NOT_YET_VALID`.
3. **Version negotiation** — our position held, and the corpus pins the adjacent
   case: a record whose committed bytes claim a version different from its
   envelope is invalid outright (`version-downgrade`: envelope 0.3, bytes 0.4).
   For a genuinely newer, self-consistent record meeting an older verifier, the
   answer is `not checked` with the version named as the reason. Printing
   `verification failed` condemns a record that was never evaluated; printing
   `verified` claims an evaluation that never ran.
   *Mapped to our vocabulary:* a new outcome, not a new reject code — nothing in
   our eleven codes is honest here.

## 4. What we can execute today

Measured on the committed tree, not paraphrased:

- The vendored fixture is bit-identical to the published artifact. The SHA-256 of
  the vendored bytes equals the digest published for that path in the corpus
  index (`78cb42cb…`), so the six vectors below are the publisher's bytes and not
  a re-encode. `PROVENANCE.md` records the retrieval date and both digests.
- `node --test test/integrations/aer1-id-binding-fixtures.test.mjs
  test/integrations/aer1-resolution-adversarial.test.mjs` → **22 checks, 22
  pass**, including a fail-closed lattice assertion: no vector is ever more
  permissive here than upstream.
- The six published vectors, replayed through AER-1's own rules:

| vector | published verdict | published id verdict |
|---|---|---|
| `id-alone-unverified` | pass | `unverified` |
| `id-expected-match` | pass | `matched` |
| `id-expected-mismatch` | fail | `mismatched` |
| `id-resolution-agreement` | pass | `resolved` |
| `id-resolution-disagreement` | fail | `mismatched` |
| `id-absent` | fail | `absent` |

The interesting one for VAR/1 is the first: the committed digest verifies while
the identity binds to nothing. A conformance receipt that returns one digest for
both jobs cannot express that state, which is the argument for the split in
section 2.

## 5. What we cannot execute, and why

- **The full cross-version set** — 143 vectors, 146 checks. We vendor one file
  from it (`base/id-binding-vectors.json`) and we do not have a parser for the
  AER-1 receipt shape, so a run of the whole set against VAR/1 does not exist.
  Saying otherwise would be the exact defect the rest of this tree is built to
  prevent.
- **Resolution** — exercising `resolved` against a live resolver needs an anchor
  resolver we do not ship. Our resolution tests use caller-supplied records and
  check them for consistency only; they verify no provenance. That limit is
  asserted in the suite rather than left to memory.

## 6. What changes in VAR/1 as a result

1. Outcome layer above the reject codes: `ABSENT`, `NOT_CHECKED`, and a named
   code for an unresolvable anchor, each with its own must-fail fixture. The
   `ABSENT` fixture asserts that a non-adopter's silence is **not** a failed
   verification.
2. Identity split: `record_id` and `anchor_ref` as separate bindings from the
   content digest.
3. The boundary, printed above the first heading rather than in a footnote:
   *a receipt proves the saved result was not changed after the fact; it does not
   prove the result was right.*
4. A thin ACP reference — receipt id plus profile version — rather than an annex
   ACP owns. Canonicalization, hash construction and the outcome vocabulary
   version on their own clock.

## 7. Non-claims

No integration with ACP, no endorsement by its maintainers, no partnership with
OpenAI, Stripe or any payment network, no production deployment, no external
customer. The measurements above are of this repository's own fixtures and its
own suite; every one of them is reproducible from the committed tree.
