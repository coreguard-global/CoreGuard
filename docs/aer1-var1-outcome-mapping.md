# AER-1 × VAR/1 — outcome mapping and canonicalization notes

**Status:** working note, revision 8, 2026-11-19. Written in reply to Brennan
Zambo's review of VAR/1 in ACP discussion #328. Revision 2 records the AER-1
side's answers to the three canonicalization questions (section 3) and the
consequence for our own code vocabulary; revision 3 records their run of the
five scenarios (section 4b); revision 4 records the split and the layer landing
in code, so this note now describes shipped files rather than intentions;
revision 5 records the first external run of the pilot kit and maps its fifteen
rows onto AER-1's outcomes, including the two rows where the vocabularies
answer differently (section 4c); revision 6 records the AER-1 side's acceptance
of the vector and of the two layer names, and the seeded external run this tree
re-derived byte for byte (section 4d); revision 7 adds the anchor-layer vector
that closes the row section 4d had left open, pinned in both columns with its
controls (section 4d); revision 8 separates acceptance from publication, because
revision 6 could be read as claiming the vector was already in the live corpus,
and records the third-machine confirmation of the seeded run (section 4d). It is
not an ACP artifact, not a SEP, and not a claim of agreement beyond what section
4d quotes by name.

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
`unresolvable` outcome expressible at all — before the split, we had nowhere to
put it.

**Built, revision 4** — `CG-ID/1`, `packages/agent-commerce/identity.mjs`. The
split is exactly the three fields named above: `recordId` over
`{issuer, scope, subject}`, `contentDigest` supplied by the caller and never
derived from it, and `anchorRef` as `{kind, locator}`. The two properties that
motivated the change are asserted rather than described: same record with new
bytes keeps its name while its digest moves (`drifted: true`), and adding an
anchor does not rename a record. Nine must-fail fixtures in
`test/integrations/identity-split.test.mjs`, including the one that matters for
the thread — an unresolvable anchor must never read as an absence, because "we
could not reach the ledger" is a weaker claim than "there was nothing there".

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

## 4b. Their run of the four scenarios (and the fifth)

Reported by the AER-1 side in the thread on 2026-11-18 (`aer1-verify 0.2.31`), and reproduced here as they stated it rather than paraphrased:

| scenario | their reported result |
|---|---|
| present-and-matched | verdict PASS; the anchor block independently reports `absent` because the receipt carries no anchor |
| present-and-drifted | verdict FAIL on the check "sha256(canonical_bytes) equals output_hash" (committed `c2258bdf…`, recomputed `dc3ad40f…`) |
| absent | checking an id that does not exist at the resolver returns "NO SUCH RECEIPT" — nothing is rendered as a failure |
| intentionally-not-evaluated | record verdict PASS, anchor `present`, `evaluated: false`, outcome `not checked` |
| present, anchor unresolvable | record verdict PASS, anchor `present`, `evaluated: true`, outcome `rejected: unresolvable record` |

They also reported one live production case that argues our own point better than we did: a Zambo receipt where the identity verdict is `matched` and the server asserts `verified`, while the local verifier still returns FAIL on one check — the receipt carries an `input_hash` and the committed payload withholds the inputs, so that commitment cannot be recomputed and the verifier fails closed. Three layers, three answers, each correct about its own layer. A single PASS/BLOCK at the top would have hidden the only interesting fact in the run.

That case is now a fixture in this tree rather than a quote: see `test/integrations/outcomes-layer.test.mjs`, "three layers disagreeing must not collapse into one PASS/BLOCK".

## 4c. The pilot kit's fifteen rows, judged as AER-1 would judge them

`examples/var1-pilot-kit` was run from a clean clone on 2026-11-19 at the commit
the external report named (`5a1f3bd`) and again at the tip that carried the
daily content sync: fifteen rows, exit 0, the same row outcomes both times. That
report quotes its own receipt id; an unseeded run draws a fresh merchant key, so
the id differs per machine by design, and `--seed` with `--at` is what makes the
bytes reproducible.

This is the mapping that report asked for: the same fifteen rows judged under
AER-1's vocabulary rather than ours. Where the answers differ, the difference is
named. A table that agreed on every row would be describing one model twice.

| # | the row | VAR/1 outcome | AER-1 outcome | comment |
|---|---|---|---|---|
| 1 | approval committed by digest | no record yet | no row | AER-1 judges records; an approval before a receipt is outside it |
| 2 | merchant executes and signs | record produced | no verdict | issuance is the issuer's business in both models |
| 3 | fetched by its content-addressed id | `resolved` (locator) | identity `resolved` | their `id-resolution-agreement` vector, same fact |
| 4 | signature, pin, intent and execution agree | `VERIFIED` | `verified` | the same word on the same bytes, and the claims are not the same size: AER-1 says the saved result did not change, VAR/1 also says the execution matched the approval |
| 5 | a valid receipt from an unpinned key | `NOT_CHECKED` | `not checked` | section 13 leaves issuer authentication outside AER-1; the pin lives at the profile layer in both |
| 6-10 | spent once, second claim, second system, four processes, HTTP replay | `spent` / `conflict` / one winner / replayed | no row | consumption and transport are outside a receipt's claim in both models |
| 11 | a mirror serves wrong bytes on the right path | `VERIFICATION_FAILED` | `verification failed`, identity `mismatched` | the digest does not re-derive; content and identity fail together |
| 12 | a valid signature over a surcharged execution | `VERIFICATION_FAILED` (`total_minor`) | `verified` | **the first divergence** — see below |
| 13 | a content-addressed name nobody can produce | `UNRESOLVABLE_RECORD` | `absent` | **the second divergence** — the same bytes, a different word |
| 14 | a locator with nothing behind it | `ABSENT` | `absent` | agreement, and the reason row 13 has to differ |
| 15 | outcome to decision, six cells | the table | no row | AER-1 ends at the verdict; a decision is a consumer's policy |

### Row 12: the receipt is honest, the execution is not

One row asserts four things at once: `signature_ok: true`, `key_status:
trusted`, `resolution.state: resolved`, and `outcome: VERIFICATION_FAILED` on
`total_minor`. The merchant really did sign that execution, so AER-1's
`verified` is correct about the bytes. Our `DECLINE` is a claim one layer up:
the execution is not the one that was approved. Neither verdict should move,
and the pair is the clearest statement of why the layers exist — a system that
only asks the first question approves the surcharge, with a valid signature.
Proposed corpus vector: `present-consistent-nonconforming`.

### Rows 13 and 14: one word, two facts

AER-1's `absent` means the resolver has nothing under that id, and it renders
nothing as a failure on purpose. Row 14 is exactly that, and both models agree.
Row 13 is not, because our id is content-addressed: `urn:sha256:...` is not a
place, it is a claim about bytes, so a resolver with nothing under it has not
answered "no record" — it has left a claim unsatisfied. Hence
`UNRESOLVABLE_RECORD`.

AER-1 also uses the phrase `rejected: unresolvable record`, for a different
fact: a record that is present whose anchor cannot be resolved. The same words
therefore name two different rows across the two vocabularies — ours is a
record-resolution failure, theirs an anchor failure. That is the inverse of the
defect this thread keeps naming: not two facts printed as one word, but one word
printed for two facts. The corpus should pin the layer in the vector name
(`record-unresolvable` against `anchor-unresolvable`) before either side quotes
the other's string. Both sides adopted that spelling, and section 4d carries the
fixture that pins the two layers apart rather than the sentence proposing it.

The one AER-1 outcome the kit cannot produce is `rejected: unresolvable
record`, because the kit writes no chain anchor. `CG-ID/1` has that fixture;
the kit does not, and a row this tree cannot run is not a row it gets to claim.

### What this table is not

It is not a request to widen AER-1, and not a finding that AER-1 is incomplete.
A receipt standard that answers "did the saved result change" and a commerce
layer that answers "was this the thing that was approved" are two questions,
and the second one needs the first. The divergence in row 12 is the argument for
keeping them apart, not for merging them.

## 4d. What the other side adopted, and the run that can be checked

Recorded after the mapping landed in the thread on 2026-11-19. This section
quotes the AER-1 side where the wording carries weight, and marks the rest as
our reading of it.

**Names.** `present-consistent-nonconforming` is accepted as the vector's name,
with both columns pinned and neither printed without the other. Accepted is not
published, and revision 8 fixes that wording: on 2026-11-19 the live corpus is
still draft -26 at 143 vectors, and neither this name nor the two layer names
appear in it. What exists is a commitment to the next corpus publication, with
the set digest recomputed then and this note as its first citation, while the
status itself is kept in `docs/aer1-corpus-publication.json`, checked on the date
above. The layer spelling from section 4c is adopted as well: `record-unresolvable` against
`anchor-unresolvable`, so the corpus pins the layer in the vector name. The
vector itself lives in this tree as
`test/fixtures/var1-corpus-v1/present-consistent-nonconforming.json`, asserted
by `test/integrations/var1-corpus-vector.test.mjs`.

**The run that can be checked.** The public record for this exchange is one
outside run, reported by `buidl25` for **AgentBadge** on 2026-11-19: a fresh
clone at `76b3a63`, node **v23.3.0** — a major outside our v24/v26 set. Unseeded
15/15, exit 0. Then a seeded run, seed
`1dd12dd553b67b172a324d59eb0bf020ffacf306052bfd8dbd73755ed160bb7f` (sha256 of
`agentbadge-external-seeded-run-2026-11-19`, so the seed carries no secret) with
the clock at `2026-11-19T16:40:00Z`, run twice with a fresh `--out` each time:
15/15 and exit 0 both times, receipt
`urn:sha256:98bc587f2ced2054ff2265b79b4ec43dbcd2f4f5d6c138a6e33a291ec86f876b`
identical across both. That is byte-determinism produced on someone else's
hardware: the canonicalization claim held on v23.

The same report names the row that disagrees. An identical rerun **into the same
`outDir`** fails 12/15 (rows 6, 8, 9 — `refused · spent`, `conflict`,
`0 winner · 4 spent`), because `outDir = f(at, seed)` and the spend logs live
inside it, so an identical rerun reopens a ledger that already recorded the
spend. A fresh `--out` restores 15/15 with identical bytes. That is a kit-level
limitation, recorded in this tree rather than argued away.

Our own seeded run (seed `e8cfcd1a…`, `--at 2026-11-19T14:00:00Z`, receipt
`8c6c12ba…`) re-derives locally; it is **our** run, not the external one, and
this note does not compare its digest to theirs.

**The vector that pins the layers.** The row above is closed as a fixture rather
than a promise: `test/fixtures/var1-corpus-v1/anchor-unresolvable.json`, asserted
by `test/integrations/var1-corpus-anchor-vector.test.mjs`. The execution is the
one that was approved, so the record layer has nothing to refuse and reads
VERIFIED and ALLOW; the receipt also carries an anchor whose log lives under an
RFC 2606 `.invalid` host, so the anchor layer reports
`rejected: unresolvable record`. Both columns are pinned in the file, and the
controls are what make the pins worth having:

| control | column it moves | what it rules out |
|---|---|---|
| anchor absent | `anchor_outcome: absent` | absence reading as a refusal, or as a failure |
| anchor not checked | `anchor_outcome: not checked` | a verifier that never attempted resolution looking like one that attempted and failed |
| resolvable log | `anchor_outcome: verified` | `unresolvable` as a standing verdict on anchors |
| leaf hash that does not match | `anchor_outcome: verification failed` | a content failure borrowing the resource word |
| name nobody can produce | `record_resolution: record-unresolvable` | a record failure borrowing `absent`, or borrowing the anchor column |
| anchor stripped after signing | VAR/1 `VERIFICATION_FAILED` | a receipt that sheds its anchor and still reads clean |

The last control deserves its own sentence, because it is the one that nearly
proved nothing. The signature still verifies after the anchor is removed: it
covers the attestation, and the attestation was not touched. What catches the
removal is the subject binding between that attestation and the body it claims to
be about. A verifier that checked only the signature would pass the stripped
receipt, so the fixture asserts that named check instead of the overall verdict.

**Still open, in the same vocabulary.** The kit writes no anchor, so
`rejected: unresolvable record` remains a row it cannot produce: this vector is
carried as a corpus fixture with the anchor inside the signed body, and `CG-ID/1`
holds the upstream-shaped one. Both anchor columns here are derived from AER-1's
published rules, not from running their verifier, and the fixture says so in its
own limits section.

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

1. Outcome layer above the reject codes — **implemented** as `CG-OUT/1`
   (`packages/agent-commerce/outcomes.mjs`): `ABSENT`, `NOT_CHECKED` and
   `UNRESOLVABLE_RECORD` as outcomes that compose over three layers (record,
   identity, anchor), with `ABSENT` and `NOT_CHECKED` never travelling as a
   block. Thirteen must-fail fixtures in
   `test/integrations/outcomes-layer.test.mjs`, including the one that leads:
   a non-adopter's silence is **not** a failed verification, asserted as a test
   rather than promised in prose.
2. Identity split — **implemented** as `CG-ID/1`
   (`packages/agent-commerce/identity.mjs`); see section 2 for what the split
   asserts and where its fixtures live.
3. The boundary, printed above the first heading rather than in a footnote:
   *a receipt proves the saved result was not changed after the fact; it does not
   prove the result was right.*
4. A thin ACP reference — receipt id plus profile version — rather than an annex
   ACP owns. Canonicalization, hash construction and the outcome vocabulary
   version on their own clock. **Implemented** as
   `packages/agent-commerce/profile-ref.mjs`: three fields (`receipt_id`,
   `profile`, `profile_version`), with a future `profile_version` refused by
   name instead of rounded to the one we implement.
5. The layer at the surfaces, not only in the library: `verify-run` prints an
   `Outcome:` beside its verdict, PSAR/1 receipts carry `outcome` beside
   `decision`, and AGR/1 answers `NO_DECISION` rather than `CLEAN` when the
   receipt it was given is absent or unevaluated
   (`packages/agent-commerce/outcomes-bridge.mjs`). A verifier that never
   reached a judgement now reads as `NOT_CHECKED` in all three places, while
   every existing verdict, exit code and reject code stays where consumers
   already parse it.

## 7. Non-claims

No integration with ACP, no endorsement by its maintainers, no partnership with
OpenAI, Stripe or any payment network, no production deployment, no external
customer. The measurements above are of this repository's own fixtures and its
own suite; every one of them is reproducible from the committed tree.
