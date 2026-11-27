# CG-X402-IDEM/1 — second harness and cross-language matrix

This document records the second harness shape promised in the x402 #4198 thread: the same scenario matrix is executed by two independent implementations and the results must be byte-identical. It is a control against semantic drift, not a new product surface.

## The two harnesses

- Node: `scripts/x402-matrix-run.mjs` drives `packages/x402/idempotency.mjs`.
- Python: `implementations/python/x402_idempotency.py` drives a stdlib-only port of the same module.

Both read the identical document at `test/fixtures/x402/idempotency-matrix.json`. Neither opens a socket, signs anything, settles anything, or reads a key. The store and the clock are injected; the in-process store is labelled as in-process only. A cross-process deployment must inject an atomic insert-if-absent store. `VERIFIED ≠ SAFE` applies unchanged: the matrix constrains who may enter the signer and what a duplicate receives, and says nothing about the safety, finality or value of the purchase.

## The matrix

Fourteen named cases are pinned in the fixture: first reserve; seven duplicates waiting in `PENDING`; duplicate → artifact → replay of the original; authenticated owner only; explicit intent mismatch with both digests; distinct owners as distinct purchases; opaque conflict on a purchase-id-only store; construction failure when the reservation TTL is shorter than the scheme timeout; retention outliving the reservation; late attach refused; the lapsed-reservation read/write boundary found in review; receipt replay after settlement; facilitator dedup gated on the verified payer; and the purchase-id-only lookup shape under a lapsed window — opaque cross-owner conflict and the same read/write agreement in the deployment that has no owner in its key.

Every case carries a pinned `expect` array of normalized results. Normalization keeps only comparable fields — `code`, `state`, TTLs, `replay`, artifact/receipt ids and payer-visible digests — and reduces artifacts and receipts to their ids. Both runners print one canonical JSON line with sorted keys, so the comparison is byte-level rather than "looks the same".

At the pinned commit the two outputs are identical across 12,705 bytes and 14 cases, including `RESERVATION_LAPSED`, `RESERVATION_EXPIRED`, `OWNER_CONFLICT`, `RECEIPT_REPLAY` and `PAYER_CONFLICT`.

Two precision notes belong with the matrix, because the spec text outlives the code. `PENDING` and `RESERVATION_LAPSED` are read views of one `RESERVED` row, before and after its expiry; the store holds `RESERVED`, `SIGNED` and `SETTLED` only. And the opaque conflict is a response-shape guarantee produced after the same lookups as the detailed path — constant-time behavior is a deployment property recorded as an implementation note, not a claim a conformance test can read off a response.

## Commands

- `npm run x402:matrix` — Node leg, verifies the pinned expectations.
- `npm run x402:matrix:python` — Python leg, verifies the same pinned expectations.
- `npm run x402:matrix:unit` — five Python unit tests, including digest parity with the Node canonical encoding.
- `node --test test/integrations/x402-idempotency-parity.test.mjs` — runs both legs, compares their stdout byte for byte, runs the Python unit tests, and executes a negative control.

The negative control copies the fixture to a temporary path, changes the lapsed-window expectation from `RESERVATION_LAPSED` back to `PENDING` — the exact bug the reviewer reproduced — and requires both runners to fail with `MATRIX DRIFT`. A matrix that cannot fail proves nothing; this one is checked for that.

## What parity does and does not establish

It establishes that the documented state machine has one behavior across two runtimes and two independently written implementations, and that the reviewer's edge is locked in both. It does not establish cross-process atomicity, chain finality, signature validity, safety, compliance, compatibility or endorsement. Those remain outside this module's boundary and are not claimed here.

No new MCP tool or skill is exposed by this harness, and nothing here is published to npm or any registry.
