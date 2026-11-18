# Execution Trust Layer — one page, for someone deciding whether to look closer

*Written for an evaluator, a grant reviewer, or a partner's engineer. Every claim below is a file in this repository that you can open, run, or contradict.*

## The question

An agent says it did something. A receipt says what it was authorized to do. The gap between those two sentences is where money is lost, and it is not a gap in cryptography — it is a gap in **vocabulary**. A verifier can say "this record failed its checks". It has no good way to say:

> nobody handed us a record, or somebody handed us one that no one has judged.

Most systems render both of those as a failure, because "failure" is the only word they own. That single choice is why opt-in verification dies in production: every party that never adopted gets scored as having failed a verification it never took part in, and the honest answer — *we do not know* — has nowhere to live.

## What exists

Five outcomes, above the reject codes, composed over three layers:

| outcome | what it means | travels as a block? |
|---|---|---|
| `VERIFIED` | the record was evaluated and its checks passed | no |
| `VERIFICATION_FAILED` | evaluated, a check failed, the code is named | yes |
| `ABSENT` | no record was presented | **never** |
| `NOT_CHECKED` | presented, deliberately not evaluated | **never** |
| `UNRESOLVABLE_RECORD` | well formed, its anchor cannot be resolved | yes |

The three layers are the receipt, the identity, and the anchor. They are allowed to disagree, and when they do, the report says so instead of collapsing three answers into one badge.

- the layer: `packages/agent-commerce/outcomes.mjs`
- identity split, so a record's name is not a function of its bytes and can carry an anchor: `packages/agent-commerce/identity.mjs`
- the pointer a protocol would carry (`receipt_id`, `profile`, `profile_version`): `packages/agent-commerce/profile-ref.mjs`
- the seams to the surfaces that already exist: `packages/agent-commerce/outcomes-bridge.mjs`

## What it refuses to say

- `VERIFIED` does not mean the outcome was correct, safe, or delivered. It means the receipt's own checks passed. This boundary is repeated in every module header and in every report.
- `ABSENT` is not a judgement about a party. It is a statement that nothing was presented.
- A risk engine fed an absent or unevaluated receipt returns **no decision** — not clean, not blocked. `packages/agent-commerce/risk.mjs` names that state `NO_DECISION`, because `CLEAN` would assert an authorization nobody produced.

## Where it plugs in

The layer sits on top of surfaces that already ship, without breaking their words or exit codes:

- `verify-run` prints `Outcome:` beside `Verdict:`, and an unevaluated run reads `NOT_CHECKED` rather than a failure.
- PSAR/1 pre-sign receipts carry `outcome` beside `decision`; a receipt claiming a version this build does not implement reads `NOT_CHECKED` with the version named, while the decision stays fail-closed.
- AGR/1 accepts a receipt outcome and will not answer `CLEAN` without one.

## Check it yourself, five minutes

```
node --test test/integrations/outcomes-layer.test.mjs
node --test test/integrations/identity-split.test.mjs
node --test test/integrations/profile-reference.test.mjs
node --test test/integrations/outcome-surfaces.test.mjs
node packages/cli/src/index.js verify-run --receipt evidence/gate-3.3-anchorproof.json
```

The tests are written as must-fail fixtures: each one names the defect it would catch, and the first is the one that matters commercially — a non-adopter's silence is not a failed verification.

## What is not built

- No adoption claim: no wallet, no protocol, and no payment network embeds this today. The standards conversation behind it is public and cited in `docs/aer1-var1-outcome-mapping.md`.
- No parser for the AER-1 record shape, so their cross-version corpus cannot be run here. The note says which vectors we execute and which we cannot, with the reason — a run that only reports agreement is not evidence.
- No anchoring service of our own: `anchorRef` describes where a copy sits; resolving it is the caller's job.
- No claim of safety, fraud detection, or delivery conformity. Different layers, different documents.

## Why this is worth a look anyway

Because the hard part is not the cryptography — it is agreeing on what a verifier is allowed to say, and then proving it with tests that fail when someone gets it wrong. That part is small, finished, and readable, and it is the part every agent-payment stack will need before an agent's receipt can be trusted by anyone who did not write it.
