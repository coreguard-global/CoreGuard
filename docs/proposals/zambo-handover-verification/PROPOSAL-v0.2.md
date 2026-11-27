# CoreGuard × Zambo
## Independent handover verification — POC v0.2

**Prepared by:** Eslam H. · **Status:** working POC, awaiting technical review · **Date:** 27 November 2026
**Target:** `draft-zambo-aer1-26` · receipt schema 0.4 · kit 1.6.1
**Basis:** the two public handovers supplied for this POC, not synthetic fixtures.

---

## 1. What changed since v0.1

v0.1 proposed an observer. v0.2 is the observer, run on the two records:

- `e2ef637d-663e-4020-bdc9-c69fbb1fa4de` — 41 steps, one refused at the free limit
- `60b51198-98fa-40c1-be0c-5566eded0feb` — 4 journal steps, one probed endpoint silent

Both bundles were fetched from `zambo.dev` on 2026-11-27 and verified offline from
their own bytes. No call was made to Zambo's verification endpoint, and the
issuer's `receipt_checks` was not used as CoreGuard's verdict.

| | zamback | adctx |
|---|---|---|
| step receipts recomputed | 41 / 41 | 4 / 4 |
| receipt failures | 0 | 0 |
| operations not checked | 1 (step 18, refused) | 0 |
| Merkle root (`seq-output-v1`) | matched | matched |
| workflow-close receipt | verified | verified |
| schema-0.4 `metadata_hash` | present, format checked | present, format checked |
| receiver decision | **hold** | **proceed** |

The split in the first row is the product: a refused step keeps a verified
receipt and a `not_checked` operation. The observer does not promote it, and the
receiver does not mistake it for an integrity failure.

## 2. Use case

A task moves from Agent A to Agent B. Zambo records and issues the receipts.
CoreGuard re-reads the record from outside, recomputes what the record commits,
and publishes its own verdict beside it. Agent B consumes the verdict under its
own policy — proceed, hold, or reject — without having to trust either agent's
summary or the issuer's own conclusion.

The receiver policy is deliberately small and published: a function from verdict
to decision with its reasons. A decision that cannot be re-derived from the
report is not evidence.

## 3. Architecture

```text
Agent A ── work ──▶ Zambo / AER-1 ── handover bundle ──▶ CoreGuard observer
                                                          │  recompute receipts
                                                          │  recompute Merkle
                                                          │  verify workflow close
                                                          │  carry limits
                                                          ▼
                                              CG-HANDOVER/1 verdict (JSON)
                                                          │
                                              receiver policy ──▶ decision + reasons
```

The observer is a pure function over the bundle text plus three caller facts:
observer identity, read time, and the handover id the caller already holds. It
has no network path in the POC, which is why a re-run reproduces the same
`verdictDigest`.

## 4. State mapping

| AER-1 | CG-HANDOVER/1 |
|---|---|
| `verified` | every receipt recomputed and the workflow root matched |
| `verification_failed` | an integrity check failed |
| `not_checked` | an operation did not complete; its receipt bytes may verify |
| `absent` | a required member is missing |
| `rejected: unresolvable record` | the bundle could not be read or resolved |

Observer states are separate and never replace an AER-1 outcome: `unavailable`,
`unsupported`, `inconclusive`.

## 5. What the verdict does not establish

Stated on every report, and worth repeating in the proposal:

- **issuer identity** — no pinned key is published in the bundle
- **outside timestamp** — no independent time source
- **result correctness** — a matching digest is not correct work
- **`steps_digest` and `metadata_hash` preimages** — the public material does not
  define them; both are `not_checked`, not guessed

`VERIFIED ≠ SAFE`. A verified record means the saved bytes are unchanged and
bound to this handover.

## 6. Acceptance criteria

| Criterion | State |
|---|---|
| read an AER-1 record from an external source | pass — two live bundles |
| recompute integrity from exact canonical bytes | pass — 45 / 45 receipts |
| do not copy the issuer's verdict | pass — issuer block kept separate |
| explicit `not_checked` with a reason | pass — refused step, missing preimages |
| machine-readable verdict + public report | pass — JSON + self-contained HTML |
| reject a single changed byte | pass — offline test |
| deterministic verdict | pass — fixed inputs, same digest |
| a receiving agent changes its decision because of the verdict | **not yet** — the policy shows `hold` vs `proceed`, but no independent agent has consumed it |

The last row is the one that matters and the one we are not claiming. The next
step needs a receiver that is not ours.

## 7. Threat model

| Threat | Control in the POC | Residual |
|---|---|---|
| tampered step bytes | SHA-256 + text/base64 agreement | none within the bundle |
| reordered or substituted step | Merkle root under the declared construction | none within the bundle |
| a verifier that trusts the issuer | issuer claims kept in a separate block | reader discipline |
| a stale or substituted handover | caller-supplied expected id + bundle digest | needs a trusted id source |
| a forged issuer | none | **open** — requires key pinning |
| a correct record of wrong work | none | **open** — outside any receipt |
| a record that cannot be read | `unavailable`, never `verified` | availability only |

## 8. Questions for review

1. Is the state split right — bundle `verified` with an operation `not_checked` —
   or should a single refused step change the bundle outcome itself?
2. Is the receiver decision trace (`proceed | hold | reject |
   request_more_evidence` with reasons and the verdict digest) the shape a real
   receiving agent would log and act on?
3. Which of the two open limits should be closed first: issuer key pinning in the
   bundle, or a published preimage for `steps_digest` / `metadata_hash`?

## 9. Scope and commercial boundary

This is a technical POC with no assumed commercial commitment. If an independent
receiver demonstrates a changed decision on a real handover, the next
conversation is about scope, integration and terms — with a customer in the
loop, as v0.1 already said. No funding, sponsorship, exclusivity or revenue
share is assumed by this document.

## 10. Reproduce

```text
node packages/handover-observer/cli.mjs --file test/fixtures/handover/zamback-e2ef637d.json \
  --expected-id e2ef637d-663e-4020-bdc9-c69fbb1fa4de --read-at 2026-11-27T12:00:00.000Z \
  --out /tmp/zamback.json --html /tmp/zamback.html

node --test test/integrations/handover-observer.test.mjs
```

Eleven offline tests, two live-record runs, one report per run.
