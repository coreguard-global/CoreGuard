# Independent handover observer — reading a delivery record from outside

`CG-HANDOVER/1` · observer `coreguard-observer:cli` · runs of 2026-11-27 on two
public handovers issued by Zambo.

Brennan's question was narrow: when a task moves from one agent to another, can a
third party read the record from outside the issuer, recompute what it can, and
publish a verdict that a receiving agent can act on — including when that verdict
is **no** or **not checked**?

This page is the answer with two runs, not a description of an intention.

## The two runs

| | `e2ef637d…` (zamback) | `60b51198…` (adctx rowcheck) |
|---|---|---|
| steps | 41 | 4 |
| step receipts recomputed | 41 / 41 | 4 / 4 |
| receipt failures | 0 | 0 |
| operations not checked | 1 (step 18, refused at the free limit) | 0 |
| workflow Merkle root | matched (`seq-output-v1`) | matched (`seq-output-v1`) |
| workflow-close receipt | verified, `metadata_hash` present | verified, `metadata_hash` present |
| bundle digest | `sha256:9ff930d5…f3720` | `sha256:5f3a41ab…a4f41` |
| verdict digest | `sha256:16b42597…7012` | `sha256:75634942…317b` |
| receiver policy | **hold** — one operation did not complete | **proceed** — every required receipt and operation verified |

The refusal is the interesting one. Step 18's receipt bytes verify; the step's
recorded status is `refused`. The observer reports exactly that split: receipt
`verified`, operation `not_checked`, bundle `verified`, receiver `hold`. A system
that promoted the run to a clean success would have thrown away the only fact the
receiving agent needed.

## What the observer recomputes

- SHA-256 over each step's decoded canonical bytes, and the text and base64 forms
  agree
- each step through `CG-AER1/1`, including the id binding
- the workflow Merkle root under the construction the bundle declares
- the workflow-close receipt's commitment and schema-0.4 `metadata_hash` presence
- the handover id the caller already holds

It never calls Zambo's verification page, and `receipt_checks` is copied under
`issuerClaims` for comparison only, never used as CoreGuard's verdict.

## What it does not establish

- **issuer identity** — no pinned signing key is published in the bundle
- **outside time** — no independent time source is consulted
- **result correctness** — unchanged bytes are not correct work
- **`steps_digest` / `metadata_hash` preimages** — the public material does not
  define them, so both are `not_checked` with that reason

These are printed on every report. `VERIFIED ≠ SAFE` is not a footer decoration;
it is the boundary that makes the verified state worth something.

## State mapping

| AER-1 | CG-HANDOVER/1 |
|---|---|
| `verified` | all receipts recomputed, workflow root matched, required members present |
| `verification_failed` | an integrity check failed |
| `not_checked` | a step's operation did not complete; its bytes may still verify |
| `absent` | a required member is missing |
| `rejected: unresolvable record` | the bundle could not be read |

Observer-only states: `unavailable` (nothing judged), `unsupported` (draft or
schema not implemented), `inconclusive` (judged, evidence insufficient).

## Decision trace

The verdict says what the record is; the trace says what a receiver did with it.
`CG-HANDOVER-TRACE/1` records both decisions — `decision_before` from the
issuer's summary alone, `decision_after` from the verdict — with the basis, the
`verdict_digest`, the first named reason that moved it, and `simulated: true`
because the receiver is a published policy, not an independent agent.

On the two records: zamback `proceed → hold` (step 18 refused, operation
`not_checked`), adctx `proceed → proceed`. The second result matters as much as
the first: a trace that only fires on disagreement is a demo.

## Reproduce

```text
curl -fsS -o /tmp/handover.json https://zambo.dev/handover/e2ef637d-663e-4020-bdc9-c69fbb1fa4de.json
node packages/handover-observer/cli.mjs --file /tmp/handover.json \
  --expected-id e2ef637d-663e-4020-bdc9-c69fbb1fa4de \
  --read-at 2026-11-27T12:00:00.000Z \
  --out /tmp/verdict.json --html /tmp/report.html
```

Exit code is `0` for `verified`, `1` for `verification_failed`, `2` when the
source cannot be read. A gate that always succeeds is a report, not a gate.

Evidence, including the exact bundles and both reports, is in
[`evidence/handover-observer/`](../evidence/handover-observer/).
