# AER-1 — what comes after the observation family (brainstorm, ranked)

Written after Brennan's answer on the thread: the run-level dictionary stays as it is, the observation family is welcome as a layer, and the rows should be built against the same set and digest so both sides can join them. This page is the queue behind that, ordered by what it would prove per unit of work. Nothing here is a claim of work done; each item names the evidence it would produce.

## 1. A kit-side runner for the rows (small, unlocks the join)

**What:** publish the rows in a shape the kit can consume directly — `docs/aer1-observation-rows.json` already carries `joinKey: "name"`, 143 rows, the observer, scope, outcome and reason, plus the file-level reads.

**What it proves:** that the join is a column operation on both sides, not a narrative. If their runner produces a column keyed the same way, the diff is mechanical.

**Cost:** a formatter and one conversation. **Risk:** none to the outcome layer; the rows are additive.

## 2. A conformance section per observer, not per implementation

**What:** instead of "is this implementation conformant", ask "does this observer's read hold up": scope recorded, bytes recomputed, reason named, order preserved.

**What it proves:** that a 403 and a failed verification can be separated in an audit without reading the implementation.

**Cost:** the profile draft in `ACP-VERIFICATION-PROFILE-V1-DRAFT.md` is already shaped for it. **Open question:** whether ACP wants that as a section or a separate registry entry.

## 3. Anchor resolution as observed evidence

**What:** today an anchor is judged against a pinned resolution fact computed offline; a `.invalid` log is `unresolvable_record`. The next version records the resolver's own read — who resolved, when, from which source — as an observation on top of the anchor outcome.

**What it proves:** the difference between "the log did not answer" and "we did not ask". That distinction is currently a comment in the code.

**Cost:** medium; the observation shape already fits. **Risk:** a resolver is a network call, so the replay-determinism guarantee has to be scoped to "with recorded resolver input", not lost.

## 4. Two independent verifiers, one digest

**What:** run a second, independent implementation (the reference kit's parser) over the same receipts and record both readers as observers of the same subject digest. Divergence becomes a named row, not a debate.

**What it proves:** that interop is measurable at the observation layer, not only at the verdict layer.

**Cost:** low on our side (the kit column already joins); depends on the other side running it. **Risk:** two implementations agreeing is not correctness — the page must say so.

## 5. Delegation chains as observations

**What:** a delegation chain currently verifies as a structure. Recording each hop's read (who asserted the delegation, what scope they held, when) makes a chain auditable at the hop that broke.

**What it proves:** which hop failed, not just that the chain failed.

**Cost:** medium. **Risk:** scope strings become a vocabulary of their own; freeze them before the first release or they will drift.

## 6. Negative controls for the ledger itself

**What:** a public set of forged observations — a backdated row, a `verified` with no bytes, a reason on a finding, a duplicate name, an observer that contradicts itself — with the expected refusal code for each.

**What it proves:** the layer's rules are enforced by code, not by discipline. The reference already refuses these; publishing the set makes the refusal checkable from outside.

**Cost:** low. **Risk:** none. This is the cheapest credibility available and it is half-written already.

## 7. Redacted observers

**What:** record a role plus a stable pseudonym where the identity is sensitive, keeping the ability to dedupe confirmations and to show that two reads were the same reader.

**What it proves:** the profile can be deployed by a party that cannot publish who its auditors are.

**Cost:** low on the data model, medium on the rules. **Risk:** a pseudonym that is not stable across runs silently turns one observer into two confirmations — the exact failure the aggregate exists to prevent. Needs a dedupe rule before it ships.

## 8. Where this should not go

- **No second outcome dictionary.** Five words, the draft's spelling, forever. A layer that mints its own words forces every reader to reconcile two vocabularies, and the first reconciler that guesses wrong inherits a verdict.
- **No boolean verdict on a run.** A pass/fail column invites exactly the collapse this work exists to prevent.
- **No coverage percentage.** "94% verified" is not a measurement of anything a reader can act on; `verified_by` with names is.
- **No clock on a fixture read.** If a row needs a time, the time has to come from an authority, not from the generator's imagination.
- **No conformance claim until the false-accept list is empty on both sides.** It is empty on ours against the pinned set; that is not the same as a conformance claim, and the pages say so.

## Sequencing

If the other side runs the rows (#1), the next two that pay for themselves are #6 (negative controls, cheap and checkable) and #3 (anchor resolution, where the honest gap is largest). #2 is a conversation, not an implementation, and should follow whichever shape ACP prefers rather than lead it.
