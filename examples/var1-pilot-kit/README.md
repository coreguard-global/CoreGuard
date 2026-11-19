# VAR/1 pilot kit — one command, a local merchant, and the checks that refuse

A receipt is a claim. This kit makes it a claim someone else can check, on a
machine that has never talked to us: a local merchant executes a synthetic
order, signs a VAR/1 receipt, publishes it by content-addressed id, and a
separate verifier fetches it over HTTP, pins the key out of band, checks the
signature and the field-level binding, spends the approval once, and maps every
outcome to a payment decision.

`node examples/var1-pilot-kit/run.mjs`

The command prints fifteen rows, writes `report.json` and `REPORT.md`, and exits
0 only if every row is the row it should be. A single failed row exits 1.

## What runs

| # | Row | What it means |
|---|---|---|
| 1 | Approval committed by digest | The merchant binds the intent, not a later message. |
| 2 | Execution signs a VAR/1 receipt | The receipt is an envelope of canonical body bytes plus a CG-ANCHOR/1 attestation. |
| 3 | Fetched by content-addressed id | `urn:sha256:…` resolves over real HTTP; the bytes are hashed against the name. |
| 4 | Signature, pin and binding agree | Ed25519 over canonical JSON, issuer key trusted at `issued_at`, intent digest recomputed from the verifier's own copy, executed fields compared one by one. |
| 5 | A valid receipt from an unpinned key | Signature verifies, key is unknown: `NOT_CHECKED`, never `VERIFIED` and never `forged`. |
| 6 | Spent exactly once | A signed, append-only spend log, guarded by an OS-level lock. |
| 7 | Second claim refused | The same log says `spent`; the entry is returned, not a new one. |
| 8 | Second system, different nonce | Two logs that disagree produce `conflict`, the word that names the double spend instead of settling it later. |
| 9 | Four processes, one approval | Real child processes race; exactly one wins and three read `spent`. |
| 10 | HTTP replay is idempotent | The same order and idempotency key return the same receipt, not a second charge. |
| 11 | Wrong bytes on the right path | A hostile mirror answers 200 on the exact well-known path; the id refuses the bytes before the signature is consulted. |
| 12 | Valid signature, drifted execution | The merchant signs a surcharge it should not have applied; `total_minor` is named and the decision declines despite a perfect signature. |
| 13 | A name nobody can produce | `UNRESOLVABLE_RECORD` holds under `strict`/`balanced` and allows unverified under `availability`; it is not an absent record and not a failed check. |
| 14 | A locator that answers nothing | `ABSENT` allows without verification and carries `unverified: true`. |
| 15 | Outcome to decision | Six outcomes, four decisions, every row asserted. Only a failed check may decline. |

## What it proves

- The receipt is verifiable with no account, no vendor call, and no key handed
  to the verifier beyond the one pin the merchant publishes out of band.
- A correct signature is not a correct execution. Row 12 is the one that
  matters: the merchant's signature is valid, its key is pinned, and the
  payment still declines because the executed total is not the approved total.
- A locator cannot upgrade itself. Row 11 serves mutated bytes on the right
  path and is refused by the hash.
- Silence is not a verdict. Row 13 holds; row 14 allows and says so; row 5
  refuses to call an unknown key a forgery.
- `ALLOW_UNVERIFIED` is a decision to proceed without evidence, not a
  verification result. It exists so an opt-in layer does not break merchants who
  never adopted receipts, and it carries `unverified: true` so no reader can
  mistake it for a pass.

## What it does not prove

- The merchant is a local reference server in this repository. No third-party
  merchant, PSP, auditor or customer has run this kit here, and none is claimed.
- The order is synthetic. A receipt proves what the merchant signed, not that
  goods were delivered or a card was charged; delivery conformity is a separate
  gate (DDE/1).
- The spend ledger is only as global as the logs a verifier can see. Publishing
  the log head is how a merchant tightens that; this kit shows the primitive.
- The pin arrives from the merchant's startup output. Production needs a key
  directory or an allowlist, with rotation and revocation on the profile's
  clock.
- No chain, no broadcast, no mainnet.

## Reading the report

`report.json` is the machine record: every step, every check, the receipt id,
the body digest, the resolution attempts, the drift fields, and the decision
table with codes. `REPORT.md` is the same run for a person, including the two
sections above so a reader does not have to guess what was and was not shown.

The reproducibility path is a fixed clock and a fixed seed:

`node examples/var1-pilot-kit/run.mjs --seed 1111…1111 --at 2026-06-01T00:00:00Z --out ./var1-rerun`

The same pair reproduces the merchant key, the receipt body, and therefore the
receipt id. The merchant origin changes because the sandbox takes an ephemeral
port; the record does not include the port, because a locator is not part of the
thing it locates. Receipt bytes are deterministic for a given seed and clock;
consumption rows are stateful (spend logs live in the output directory), so
rerunning into the same `--out` reuses that ledger and will refuse already-spent
rows by design — use a fresh `--out` to reproduce the full run.

Options: `--out <dir>`, `--seed <64 hex>`, `--at <iso>`, `--policy
strict|balanced|availability`, `--quiet`, `--help`.

## Files

- `run.mjs` — the fifteen rows and the report writer.
- `merchant-sandbox.mjs` — the loopback merchant and the hostile mirror.
- `receipt.mjs` — build and inspect a VAR/1 receipt over CG-ANCHOR/1.
- `lib.mjs` — canonical bytes, digests, seeded keys, drift and fetch.
- `race-worker.mjs` — one contender in the cross-process race.

Requires Node 18 or newer. Everything runs on loopback; nothing is sent
anywhere.
