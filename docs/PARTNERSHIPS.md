# Partnerships

Two tables, kept strictly apart: what exists, and what we are pursuing. Mixing
them is how a target list becomes a fake traction slide.

## Table A — actual (verifiable)

| Relationship | What it is | Where it is recorded |
|---|---|---|
| **Zambo / AER-1 team** — independent standards group | Reproduced our open VAR/1 pilot kit on a fresh clone, counted CI checks themselves, re-derived a seeded receipt byte-for-byte on three machines. **A technical reproduction, not a pilot, customer or endorsement.** | [ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328) |
| **Stellar / Freighter** (#3087) | Public technical evaluation comment on PSAR/1 pre-sign receipts. **An issue comment, not an integration and not a review.** | [stellar/freighter#3087](https://github.com/stellar/freighter/issues/3087) |
| **Signed pilots** | **None.** | — |
| **Paid customers** | **None.** | — |
| **Resellers, channel partners, endorsements** | **None.** | — |

If a slide, a page or an email implies anything in the lower half of that table
exists, it is wrong and must be corrected the same day.

## Table B — target segments

| Target | The offer they are pitched | First commercial wedge |
|---|---|---|
| **Web3 wallet companies** | Transaction authorization & verification: show the user what they approved, refuse the mismatch by name | PSAR/1 + `verifyAuthorizationReceipt` behind a feature flag |
| **DEX / AMM platforms** | DEX execution firewall: conditions and swap parameters enforced, with evidence a third party checks | DEX-GATE/1 rules + offline receipt |
| **Escrow operators** | Verifiable execution receipts: replace a dispute argument with a check | DDE/1 delivery + dispute evidence |
| **Agentic AI companies** | AI agent payment security: consent, spend limits, refusals, audit trail | AGENT-GATE/1 policy + receipts |
| **Payment gateways** | Payment integrity layer: prove the executed charge matched the authorized one | Presign + execution comparison |
| **FinTech / audit-heavy firms** | Independent execution verification and audit trail export | Managed verification + enterprise pack |

## What the first deal looks like

Not a six-figure contract. A **two-week scoped pilot** on one flow, priced so the
partner can say yes without a procurement cycle, ending in a written report that
includes the failures and a go / no-go decision. The artifact is the sales asset:
if their engineer cannot verify the receipt on their own machine, the deal is not
real.

**The first cohort — three slots, filled in this order.** One Stellar team (wallet
or DEX), one Core DAO team, and one agentic-commerce company. One signed pilot is
enough to start and to publish; three is the target before the independent
review, because a review of a layer nobody uses reviews a library. Every slot
gets the same two-week scope below, with no bespoke promises, so the reports stay
comparable and a failure in one is legible against the others.

| Week | Deliverable |
|---|---|
| 1 | Wire the authorization/verification path behind a flag on one real flow; capture envelopes and policy fields |
| 2 | Adversarial cases (amount, destination, expiry, network, replay) + evidence bundle verified outside this repo + read-out |

Send-ready: [PILOT-SOW.md](PILOT-SOW.md) (sign and start without a call) · [PILOT-REPORT-TEMPLATE.md](PILOT-REPORT-TEMPLATE.md) (the report, failures included).

Offer details: [PILOT-KIT.md](PILOT-KIT.md). Plan: [AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md](AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md).

## Outreach discipline

- One named problem per message, one named flow, one two-week scope.
- Never open with "we are a platform" — open with the refusal their system cannot
  produce today.
- Claims in an outreach email must exist in the repository, re-derivable. The
  doc-number scanner and claims registry are the enforcement; a mail that quotes
  a number CI cannot produce is a self-inflicted credibility loss.
- Templates: [AGENT-COMMERCE-OUTREACH-PACK-2026-11-16.md](AGENT-COMMERCE-OUTREACH-PACK-2026-11-16.md) ·
  [salla-shop-pi/OUTREACH-DRAFTS.md](proposals/salla-shop-pi/OUTREACH-DRAFTS.md)

## Target list hygiene

1. A target stays a target until there is a document both sides signed, or a
   public artifact the other side authored.
2. "In conversation" is never written as "partner".
3. Every accepted pilot gets its own dated file under `docs/`, with scope,
   success criteria and the measured result — including a null result.
