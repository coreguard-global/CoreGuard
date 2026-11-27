# profile vectors — nachweis/v1

`nachweis-v1.vectors.json` is self-contained: the export, the `receipt_id` a checkout would carry, the minimal edit per case, and the expected `{ ok, codes }`. Run it with:

    node scripts/nachweis-vector-run.mjs

Expected output: `allow-clean` passes with no codes, `edited-amount` returns `HASH_MISMATCH` and `AMOUNT_DRIFT`.

## Submitting it unchanged

**To the ACP profile corpus** — the file is already the shape the thread proposed: `profile`, `receipt_id`, `export`, `expect`. Nothing in it depends on this repository. A runner only needs to apply `edit`, resolve, and compare `codes`.

**To prokura-verify** — `export` is the unmodified public demo export, including its signatures and proof, so their verifier can check `allow-clean` as-is. The second case is a profile-resolution test, not a signature test: it edits the execution amount after the id was computed, so a verifier that only checks signatures would still pass and only a recomputation catches it. State that distinction in the PR so the two layers are not confused.

## What the codes mean

- `HASH_MISMATCH` — the recomputed id of the record differs from the `receipt_id` the checkout carried.
- `AMOUNT_DRIFT` — the execution amount differs from the approved intent's amount.

They are emitted together on the edited case on purpose: one says "the export was changed", the other says "and here is the field". A runner that only checks the first would miss what changed; one that only checks the second would accept an edited record whose id was recomputed.

## Provenance and limits

Source: `prokura-network/prokura-verify`, `fixtures/nachweis-demo-allow.json`, Apache-2.0. The export is public demo data; no secret or personal data is included.

These vectors test resolution only. They do not test signature validity, the mandate credential, revocation, or policy correctness, and no claim is made about the upstream verifier's behaviour.
