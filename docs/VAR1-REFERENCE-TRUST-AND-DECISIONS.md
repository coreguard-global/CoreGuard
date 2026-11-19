# VAR/1, the four hard questions

A reference field, a signature and a green check are the easy part of a receipt
profile. The four questions below are the ones that decide whether an integrator
can actually ship it, and each one is a module with tests in this repository
rather than a paragraph in a proposal.

## 1. Discovery: from `receipt_id` to bytes

`CG-REF/1` (`packages/agent-commerce/reference.mjs`).

A name is not evidence. Resolution therefore has one rule above all others: **a
name alone proves nothing**, and the module refuses to return `resolved` when the
identifier carries no checkable expectation.

Three identifier forms, in descending order of what the id itself proves:

| Form | What it proves before any network exists |
|---|---|
| `urn:sha256:<64 hex>` | content-addressed: whatever bytes arrive must hash to the id. The locator is irrelevant, so a mirror cannot lie. |
| `https://…` | a locator: it says *where*, never *what*. Bytes are checked against a registry entry or the caller's own expected digest. |
| opaque (`receipt-42`) | nothing. It can be looked up, but the outcome cannot be better than `unresolvable` unless the caller brings the expectation. |

Resolution order is fixed and each tier states what it can prove:

1. **inline** — the record travelled with the message.
2. **registry** — an index maps id to `{bytes, digest}`; a registry digest that
   disagrees with the id is `tampered` before the bytes are even judged.
3. **locator** — derived well-known paths (`/.well-known/var1/receipts/<sha256>`)
   or a locator id; fetched through an injected `fetchImpl`, with a hard byte cap
   and a timeout, and plain `http` refused unless the host is loopback and the
   caller explicitly opted in.

Four answers, never collapsed: `resolved`, `absent`, `unresolvable`, `tampered`.
`resolutionOutcome()` maps them onto CG-OUT/1 so the decision layer sees
`ABSENT` for silence and `UNRESOLVABLE_RECORD` for a present record that could
not be reached — two facts that are routinely merged and must not be.

## 2. Keys: trust, rotation, revocation

`CG-KEYS/1` (`packages/agent-commerce/trust.mjs`).

A signature proves a key signed. It does not prove the key is the right one.
Trust enters only by **pinning** (the verifier already believes this key) and
spreads only through **rotation statements signed by an already-trusted key**, so
a chain `A → B → C` verifies offline from a single pinned root, with no registry
and no key server. The public key embedded in an attestation is never used as
evidence of trust; it is exactly the input an attacker controls.

| Status | Meaning | Records signed then |
|---|---|---|
| `trusted` | in the closure, valid at `issuedAt` | accepted |
| `rotated` | genuine, but past its overlap window | refused after the overlap; earlier ones stay valid |
| `revoked` | a revocation applies at that time | refused, and retroactive revocation refuses history too |
| `expired` / `not-yet-valid` | outside the pinned validity window | refused |
| `unknown` | this keyring has no opinion | `NOT_CHECKED`, never `VERIFICATION_FAILED` |

Rotation carries an **overlap window**: the old key may still sign until a stated
instant, so a fleet rolls keys without a flag day, and a signature made after the
overlap is refused by name. Revocation carries **retroactivity**: a routine
retirement keeps yesterday's receipts valid, a compromise says they never were.
That distinction is the difference between a rotation and an incident, and a
vocabulary without it forces every consumer to guess which one happened.

## 3. Single use across sessions and systems

`CG-SPEND/1` (`packages/agent-commerce/spend.mjs`).

A receipt that says `used: false` is a receipt from before it was used. Single
use needs a log of spending, and the log has to survive three things: a restart,
a second worker, and a second party.

So the unit is a **signed spend attestation** — "this approval, under this nonce,
for this order, at this time, by this key" — appended to a log under an OS lock
(`wx` lock file, read-decide-append inside it, `fsync`, atomic rename). Four
concurrent processes racing for the same approval produce exactly one winner; the
losers see `spent`, and the log holds exactly one entry.

Across systems, the check is a fold over every log the verifier can see:

| State | Meaning |
|---|---|
| `unspent` | no supplied log mentions the approval |
| `spent` | the same approval and nonce is recorded |
| `conflict` | the same approval appears under a **different** nonce — two systems both believed they were first |
| `unreadable` | an entry fails its own signature; the log is not evidence any more |
| `busy` | the lock was not acquired; a refusal to guess, not a free pass |

`conflict` is the honest answer to the hard case. Two honest systems that
exchange logs end up with the same conflict list, which is what makes it
actionable: it names the double spend instead of picking a winner after the fact.

**Stated limit, not hidden:** the ledger is only as global as the logs supplied.
There is no world-wide register here. A deployment that needs stronger freshness
publishes the log head — the anchor module already produces a Merkle root — and
refuses approvals whose head is older than its policy. That is a deployment
decision with a number attached, not a claim this library makes for you.

## 4. Verification result → payment decision

`CG-DECIDE/1` (`packages/agent-commerce/decision.mjs`).

The mapping between "what we know" and "do we ship" is a policy, and most
integrations fail in one of two directions: a **false decline** (missing evidence
treated as a failure, which makes adoption lose money) or a **false trust**
(missing evidence rendered as green, which makes the record useless afterwards).
Four decisions, not two:

| Outcome | strict | balanced | availability |
|---|---|---|---|
| `VERIFIED` | ALLOW | ALLOW | ALLOW |
| `VERIFICATION_FAILED` | DECLINE | DECLINE | DECLINE |
| `UNRESOLVABLE_RECORD` | HOLD | HOLD | ALLOW_UNVERIFIED |
| `ABSENT` | ALLOW_UNVERIFIED | ALLOW_UNVERIFIED | ALLOW_UNVERIFIED |
| `NOT_CHECKED` | ALLOW_UNVERIFIED | ALLOW_UNVERIFIED | ALLOW_UNVERIFIED |

The invariants are enforced over all fifteen cells, not asserted in prose:

- only `VERIFICATION_FAILED` can ever `DECLINE`;
- `ALLOW_UNVERIFIED` always carries `unverified: true`, so a risk engine, an
  auditor or a disputes team can see that nothing was checked;
- a bare `ALLOW` can only come from `VERIFIED`;
- an unknown outcome throws instead of defaulting to an allow.

Every decision carries a one-sentence explanation, so a support ticket does not
need a codebook to say why a payment was held.

## What each party gets

This is the part a standards reviewer is entitled to ask for, so it is stated as
consequences rather than as intentions:

| Party | What changes for them |
|---|---|
| **Merchant** | Disputes become evidence: the executed order is compared field-by-field with the approved intent, and the comparison is replayable offline. No integration with CoreGuard is required to *receive* a receipt, and nothing about their checkout changes. |
| **Agent platform** | A liability boundary that is written down: an approval, its exact intent, the execution, and whether the platform checked it. The four-decision table is what stops "we verified" from meaning nothing. |
| **Payment service provider / risk** | A deterministic, named-class input instead of a score. `unverified` is visible rather than inferred, and `conflict` on consumption is a signal they cannot currently get from anyone. |
| **Auditor / regulator** | Offline verification with no account, no key and no call to either implementation. Key rotation and revocation history is itself signed data, so "was this key valid then" is answerable. |
| **Independent implementers** | Two implementations already disagree productively: AER-1 publishes a corpus (72 files, 143 vectors, one set digest) and CoreGuard runs it, judging one family end to end and naming the 137 it does not judge. Conformance is a command, not a claim. |
| **Consumers** | Fewer false declines: a merchant that never adopted receipts is not scored as failing, and a payment that had no receipt is not a payment that failed verification. |

None of this requires ACP to adopt anybody's schema. The interoperability surface
stays two optional string fields; everything above is the profile's business, on
the profile's own clock.

## Run it

The four mechanisms above are not a reading exercise. `docs/VAR1-PILOT-KIT.md`
and `examples/var1-pilot-kit/` carry one command that runs a local reference
merchant, signs a receipt, fetches it by content-addressed id, verifies it
offline against one pin, spends the approval once across processes, and prints
the rows where the verifier refuses. Exit 0 only if every row lands where the
report says it should.

## Boundary

No network in the modules except through injected functions. No private key in
this repository. No broadcast. `VERIFIED` is a claim about evidence, never about
safety, and the spend ledger is explicit about what it cannot see.
