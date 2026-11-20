# Positioning — CoreGuard Global and CoreGuard

This file is the canonical answer to "what is this, who is it for, and what do we
sell". If any other surface (README, org profile, site page, deck, email)
contradicts this page, this page wins and the other surface is a bug.

## 1 · Two names, two jobs

| Name | What it is | Where it lives |
|---|---|---|
| **CoreGuard Global** | The organisation. A company and a legal/operational identity: who signs, who hires, who is accountable. | GitHub org `coreguard-global`, this repository |
| **CoreGuard** | The product and the protocol: the software, the receipts, the verifier, the network integrations. | The repository, npm packages, the site |

Do not use "CoreGuard" as the company name, and do not use "CoreGuard Global"
as the product name. A funder invests in CoreGuard Global; a customer buys
CoreGuard.

## 2 · The positioning statement

> **CoreGuard — Independent Execution Trust Infrastructure.**
> Security and verification infrastructure for AI agents, wallets, payments and
> decentralized applications.

Two consequences of the word *independent*:

1. **It sits beside the systems that already exist.** CoreGuard does not replace
   the wallet, the DEX, the payment rail or the chain. It is an extra layer that
   answers one question those systems cannot answer about themselves: *did the
   thing that executed match the thing that was authorized?*
2. **The evidence is checkable without us.** A third party re-derives the
   verdict from public artifacts. Nobody has to trust CoreGuard's dashboard,
   endpoint, or word.

## 3 · The one product we sell

**Execution Verification & Authorization Layer** — the commercial name for the
first product is **CoreGuard Agent Execution Security**. It has exactly three
components, and everything else in the repository is either a proof of one of
them or a unit that supports them:

| Component | Question it answers | What ships |
|---|---|---|
| **Authorization Firewall** | Is this the thing that was approved, byte for byte? | Signed pre-sign authorization bound to the exact transaction bytes; `PASS` or a named refusal |
| **Execution Verification** | Did what ran match what was signed? | Envelope-vs-execution comparison with named outcomes (`BLOCK` + `XDR_BINDING_MISMATCH`, `RECEIPT_EXPIRED`, …) |
| **Verifiable Consent Receipts** | Can an outsider check it later? | Offline-verifiable receipt + verifier that needs no secret and no network |

The rest of the catalogue — anchors on multiple networks, delivery/dispute
evidence, reputation findings, reputation/pricing harnesses — are **supporting
units and integrations**, not the pitch. A buyer should never have to read
twenty protocols to understand what they are paying for.

## 4 · Markets, and why this positioning is defensible

One layer, several markets, no claim to replace any incumbent:

| Market | The problem | What CoreGuard supplies |
|---|---|---|
| **AI Agents** | The agent executes something that was not the intended action | Authorization & Execution Gate |
| **Wallets** | What the user approved and what got signed do not match | Transaction Verification |
| **DeFi / DEX** | Execution risk on swaps, routing, conditions | DEX Execution Verification |
| **Escrow** | Disputes over whether an obligation was executed | Verifiable Receipts |
| **Agentic Commerce** | Agents buy on behalf of people; where is the consent and payment evidence? | Consent & Payment Evidence |
| **FinTech** | Proving the process ran as designed to an auditor | Execution Audit Trail |

### The beachhead: AI agent payments and agentic commerce

Not because the other markets are unattractive, but because this is the only
segment where all four pillars already have code behind them and the buyer's
pain is concrete enough to pay for: *an agent moved money it should not have.*
Wallets and DEXs are the second wave. Enterprise policy packs are the third.

## 5 · The canonical message map

Use these strings verbatim so the org and the repository cannot drift apart
again (they did: one surface said "execution trust layer for Stellar", another
said "for Bitcoin DeFi", while the code covers Stellar, Core and a planned Pi
lane).

| Surface | Text |
|---|---|
| **Tagline** | Independent Execution Trust Infrastructure |
| **Sub-line** | Security and verification infrastructure for AI agents, wallets, payments and decentralized applications. |
| **One product** | CoreGuard Agent Execution Security — Authorization Firewall · Execution Verification · Verifiable Consent Receipts |
| **One sentence** | CoreGuard makes the gap between "what was authorized" and "what actually executed" measurable, refusable, and independently checkable. |
| **Boundary line** | `VERIFIED` ≠ `SAFE`. Verification describes the checks on the evidence presented — never a promise that an outcome is safe, profitable, or endorsed. |

### Networks are integrations, not identity

Stellar, Core DAO and Pi appear in messages as **where evidence exists**, never
as the company's definition:

| Network | Status (measured) |
|---|---|
| **Stellar** | Mainnet anchor + first gated funded swap executed — evidence in [EVIDENCE.md](EVIDENCE.md) |
| **Core DAO** | EvidenceRegistry live on mainnet, 43/43 Foundry proofs |
| **Pi Network** | Prepared / DRY_RUN / PLAN_ONLY — no status promotion |

"Bitcoin DeFi" is **not** a current positioning and must not appear in the org
description, the repo About text, or a new page. One market story, one company
identity.

## 6 · What we never claim

- No revenue, no customers, no signed pilots, no partnerships, no third-party
  security audit, no wallet integration and no mainnet deployment of the
  authorized lane.
- One independent *technical reproduction* is public (ACP discussion #328). It is
  not a pilot, customer, audit or endorsement, and it is never described as one.
- Requested funding is not awarded funding. The $150,000 SCF ask is a request.
- No "prevents all exploits", no "100% secure", no safety score. Refusals carry
  names, not grades.

Claim discipline is enforced by the repository, not by intent: the claims
registry, the boundary audit and the doc-number scanner fail CI when a document
contradicts the measured snapshot.

## 7 · Where to go next

| For | Read |
|---|---|
| Investor / funder | [COREGUARD-INVESTMENT-READINESS.md](../COREGUARD-INVESTMENT-READINESS.md) · [INVESTORS.md](INVESTORS.md) |
| Buyer / design partner | [PRODUCT.md](PRODUCT.md) · [PARTNERSHIPS.md](PARTNERSHIPS.md) · [PILOT-KIT.md](PILOT-KIT.md) |
| Security reviewer | [SECURITY-REVIEWS.md](SECURITY-REVIEWS.md) · [AUDIT-READINESS-PACK-2026-11-16.md](AUDIT-READINESS-PACK-2026-11-16.md) |
| Engineer | [START-HERE.md](START-HERE.md) · [ARCHITECTURE.md](ARCHITECTURE.md) |
| Proof, not promises | [EVIDENCE.md](EVIDENCE.md) · [STATUS.md](STATUS.md) |
