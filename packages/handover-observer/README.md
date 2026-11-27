# CG-HANDOVER/1 — independent handover observer

Reads an AER-1 handover bundle published by Zambo, recomputes every step receipt
from the bundle's own bytes, and publishes a verdict next to the record. It does
not call Zambo's verification endpoint and does not copy the issuer's verdict.

## What it recomputes

- SHA-256 over each step's decoded `canonical_bytes_base64`
- the text and base64 forms of those bytes agree
- each step passes the vendored `CG-AER1/1` parser, including its id binding
- the workflow Merkle root under the declared construction (`seq-output-v1` here)
- the workflow-close receipt's own commitment and schema-0.4 `metadata_hash`
- the handover id, when the caller supplies the id it already holds

## What it does not

- issuer identity: the bundle publishes no pinned key
- outside time: no independent time source is consulted
- result correctness: unchanged bytes are not correct work
- `steps_digest` and `metadata_hash` preimages: not defined in the public
  material, reported `not_checked` rather than guessed

## Run

```text
node packages/handover-observer/cli.mjs \
  --url https://zambo.dev/handover/<id>.json \
  --expected-id <id> \
  --out evidence/handover-observer/<id>.json \
  --html evidence/handover-observer/<id>.html
```

`--file <path>` reads a local bundle. `--read-at <rfc3339>` fixes the read time
for a reproducible verdict. Exit codes: `0` verified, `1` verification failed,
`2` unreachable or unreadable, `3` usage.

## Output

The JSON carries the verdict, the observer identity and read time, the bundle and
verdict digests, per-step outcomes, the Merkle result, the workflow receipt, the
issuer's claims kept separate, every not-checked item with a reason, and every
limit the observer carries. `verdictDigest` is SHA-256 over the canonical JSON of
the verdict, so two observers can compare reports byte for byte.

The receiver policy in `receiver.mjs` is a small, inspectable function from
verdict to `proceed | hold | reject | request_more_evidence`. It is a policy, not
an agent: the claim is reproducibility, not autonomy.

## Outcome mapping

| AER-1 outcome | CG-HANDOVER/1 use |
|---|---|
| `verified` | every receipt in the bundle recomputed and the workflow root matched |
| `verification_failed` | an integrity check failed (bytes, parser, Merkle, id, metadata_hash) |
| `not_checked` | a step is recorded with a non-success status; its bytes may still verify |
| `absent` | a required member is missing |
| `rejected: unresolvable record` | the bundle could not be read or resolved |

| Observer state | Meaning |
|---|---|
| `unavailable` | source unreachable or unreadable; nothing was judged |
| `unsupported` | a draft or schema this build does not implement |
| `inconclusive` | judged, but the available evidence cannot support a conclusion |

`VERIFIED ≠ SAFE`. A verified record is unchanged and bound to its handover; it
is not proof that the delivery succeeded in the world.

## Tests

```text
node --test test/integrations/handover-observer.test.mjs
```

Eleven offline tests over the two published bundles: clean 41-step run, refused
step, clean 4-step run, one-byte tamper, duplicate member, wrong id, missing
`metadata_hash`, deterministic digest, unavailable source, and the missing
`graph.aer` case.
