# VAR/1 pilot kit — the command, the failures, and the report

A verification layer is only as good as the failures it is willing to show. The
pilot kit is one command that runs a local merchant, a signed VAR/1 receipt, and
a verifier that refuses the receipt in three different ways — then prints the
row it expected, the row it got, and exits non-zero if they differ.

`node examples/var1-pilot-kit/run.mjs`

It needs Node 18 or newer, opens no port beyond loopback, and writes
`report.json`, `REPORT.md` and the exact receipt bytes into
`examples/var1-pilot-kit/artifacts/<run>/`. Nothing is fetched from the
internet, no account is created, and no key is sent to CoreGuard.

## What the run actually does

The merchant holds one Ed25519 key. It commits an approval by digest, executes
the order, and signs a receipt that is two things kept apart: a canonical body
saying what happened, and a CG-ANCHOR/1 attestation over those body bytes. The
receipt id is the sha256 of the canonical envelope, so the name is the bytes.

The verifier is a separate role. It pins the merchant's public key out of band —
from the merchant's startup output, not from the receipt and not from the
merchant's key endpoint — then fetches the receipt by its content-addressed id
over HTTP and runs the checks in this order:

1. the fetched bytes hash to the id;
2. the bytes parse, and the schema and profile are the expected ones;
3. the attestation's subject is the body digest;
4. the signature verifies over canonical JSON;
5. the issuer key was trusted at `issued_at`;
6. the receipt names the intent the verifier already held;
7. the executed fields equal the approved fields, one by one;
8. the executed total equals the sum of its lines.

Only after all eight does it say `VERIFIED`. The interesting part is not the
happy path; it is the four rows that are not a pass.

## The row that matters most

Row 12 is a valid receipt over a surcharged execution. The merchant's signature
is correct, the key is pinned, the receipt resolves by its id, and the payment
still declines because `total_minor` moved by 500 minor units after approval.
The verifier compares the executed order against the order it held before
execution, not against the receipt's own copy of the approval. A signature
proves who spoke, not that what they said was what was approved.

Row 11 is its twin from the other side. A hostile mirror answers 200 on the
exact well-known path the id names, serving bytes with one digit changed. The id
refuses the bytes before any signature is consulted. A locator proves where
bytes came from, never what they are.

## Three rows that are not a verdict

The kit keeps apart three states that production systems collapse:

- an unpinned key: the signature verifies, the key is unknown, the outcome is
  `NOT_CHECKED` — not `VERIFIED`, and explicitly not `forged`;
- a content-addressed name nobody can produce: `UNRESOLVABLE_RECORD`, which
  holds the payment instead of declining it (and allows it unverified under the
  `availability` policy — still never `VERIFIED`);
- a locator that answers nothing: `ABSENT`, which allows without verification
  and carries `unverified: true`, so nobody downstream can mistake it for a
  pass.

The fourth outcome, `VERIFICATION_FAILED`, is the only one allowed to decline.
The decision table is asserted cell by cell; a bare `ALLOW` can only come from
`VERIFIED`, and every `ALLOW_UNVERIFIED` carries `unverified: true` so it is a
decision to proceed without evidence, never a verification result.

## Single use across processes and systems

The approval is spent by appending a signed entry to a log under an OS-level
lock. The kit then shows the three outcomes that matter:

- the same log, second claim: `spent`;
- a second system with a different nonce for the same approval: `conflict`,
  which names the double spend at the moment it becomes detectable;
- four real child processes racing one approval: exactly one winner and three
  readers of `spent`.

The limit is in the module header and repeated in the report: the ledger is only
as global as the logs a verifier can see. Publishing the log head is how a
merchant tightens that. This kit demonstrates the primitive, not a public
ledger.

## Reproducing the bytes

`--seed` and `--at` fix the merchant key, the receipt body and therefore the
receipt id. `--out` chooses where the report lands. The merchant origin changes
between runs because the sandbox takes an ephemeral loopback port; the origin is
deliberately not part of the receipt, because a locator is not part of the thing
it locates.

The exit code is the verdict: 0 only when every row is the row the report says
it should be. A pilot that passes by accident is worse than no pilot.

## Boundary

This is a local reference merchant written for the kit, not a customer, not a
PSP, not an auditor, and not a pilot with a third party. The order is synthetic.
A receipt proves what the merchant signed, never that goods were delivered or a
card was charged; delivery conformity is a separate gate (DDE/1). No chain is
written to, nothing is broadcast, and no mainnet path exists in the kit.

The report repeats these limits in the section a reader is most likely to skip.
That is deliberate: the limits are the product.
