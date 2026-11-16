# Letters of intent — drafts, and nothing more

Two LOIs live here. Both are **drafts**: not sent, not signed, no counterparty
has seen them. The table below is the only place their status is recorded, and
a row may move to `SIGNED` only with a link to the signed artifact (a PDF, or a
public thread where the counterparty states the same thing). Until then the
adoption axis stays at zero, exactly as `docs/SCF-READINESS-AUDIT.md` §1 states.

| # | Counterparty | Instrument | Scope, in one line | Status |
|---|---|---|---|---|
| 1 | Brennan Zambo — AER-1 (`draft-zambo-aer1-26`) | [`LOI-AER1-ZAMBO-2026-11-16.md`](LOI-AER1-ZAMBO-2026-11-16.md) | Reciprocal exchange of fail-closed receipt vectors + a published cross-format mapping, no money, mutual attribution | **DRAFT — NOT SENT — NOT SIGNED** |
| 2 | *Named at send time* — a wallet, DEX, anchor, or agent platform on Stellar | [`LOI-PILOT-STELLAR-2026-11-16.md`](LOI-PILOT-STELLAR-2026-11-16.md) | A 30-day, zero-cost pilot that puts the gate in front of one real signing path and ends in one verifiable artifact | **DRAFT — NOT SENT — NOT SIGNED** |

## Why these two, and not a list of eighteen

The 18 partner messages in `docs/partner-outreach-messages-2026-11-15.md` are
broadcast: one artifact, many recipients, low information per send. These two
are the opposite — each asks for one specific thing that a single named party
can say yes to without a budget line.

- **The AER-1 letter** asks a format author to keep two vocabularies in sync.
  It costs him nothing and he already offered the vectors ("free to lift as
  fixtures, no strings attached"), so the ask is reciprocal rather than
  extractive: we pin his corpus, he gets a documented mapping into a second
  verdict function and a preserved attribution trail.
- **The pilot letter** asks an integrator for the only thing that moves the
  adoption axis: a signature path where the gate is actually in front of the
  wallet. It is zero-cost, 30 days, and exits at will, because a pilot that
  needs procurement is not a first pilot.

## What is needed before either can be sent

| # | Item | Who supplies it | Why it blocks the send |
|---|---|---|---|
| 1 | A verified contact address for the counterparty | Owner | Neither draft has a `To:` line; a letter to a guessed address is spam, and a guessed address in the tree is a false artifact |
| 2 | The entity name and address that signs for CoreGuard | Owner | The signature block requires the legal sender; a letter signed by a GitHub handle is not a letter |
| 3 | A public URL for the pilot's sample code (the repo is public, so this is the repo path) | Already available | The letter promises a runnable path, and it must exist at the moment of sending |
| 4 | A decision on whether the pilot participant may be named publicly | Owner | The draft defaults to anonymous; naming requires the counterparty's written consent, not ours |

Until items 1 and 2 exist, these remain what they are: instruments, not
commitments. That distinction is the whole reason `docs/CLAIMS-TAXONOMY.md`
insists that a drafted artifact is not an event.

## What a signed LOI would and would not change

It would move `adoption: 0` to `adoption: 1` on a *named* pilot — a fact with a
link, which is what C1 in the readiness audit asks for. It would not make
CoreGuard funded, audited, or integrated in production: a non-binding letter of
intent is a statement of intent, and the repo will keep calling it that.
