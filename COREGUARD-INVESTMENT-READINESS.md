# CoreGuard Global — Investment Readiness

**Independent Execution Trust Infrastructure** — security and verification
infrastructure for AI agents, wallets, payments and decentralized applications.

This document is written to be read by someone who intends to check it. Every
claim points at an artifact in this repository or a public chain, and every gap
is named in section 6 rather than left for diligence to discover.

- Company: **CoreGuard Global** (organisation, accountability, hiring)
- Product and protocol: **CoreGuard** (software, receipts, verifier, integrations)
- Commercial product: **CoreGuard Agent Execution Security**
- Canonical positioning: [docs/POSITIONING.md](docs/POSITIONING.md)

Last reviewed: 20 Nov 2026, against commit on `main`. Numbers come from
[docs/state-snapshot.json](docs/state-snapshot.json), regenerated on every push.

---

## 1 · What We Build

A layer that answers one question the rest of the stack cannot answer about
itself: **did what executed match what was authorized?** — and produces evidence
an independent party re-checks offline.

| Component | Question | Output |
|---|---|---|
| **Authorization Firewall** | Is this the thing that was approved, byte for byte? | Signed authorization bound to the exact transaction bytes |
| **Execution Verification** | Did what ran match what was signed? | `PASS`, or `BLOCK` with a named reason |
| **Verifiable Consent Receipts** | Can an outsider verify it later? | Artifact + offline verifier, no secret, no network |

Design rule that is also the commercial argument: **`UNKNOWN` is never success.**
The operation halts or holds until evidence closes it. Everything else in the
repository is either a proof of one of these three or a supporting unit.

We do not replace the wallet, the DEX, the payment rail or the chain. CoreGuard
is an independent verification layer beside them.

## 2 · Problem & Market

Agents now sign faster than humans can review. Wallets show what a transaction
*looks like*; the gap between that and what was *approved* — or between the
approval and what actually *executed* — is where money is lost and disputes
start. Logs are self-reported; dashboards are trusted; neither is evidence a
counterparty can check.

| Market | The problem | CoreGuard's answer |
|---|---|---|
| AI Agents | The agent executes an action that was not intended | Authorization & Execution Gate |
| Wallets | Approval and execution diverge | Transaction Verification |
| DeFi / DEX | Execution risk on swaps and conditions | DEX Execution Verification |
| Escrow | Disputes over whether an obligation was executed | Verifiable Receipts |
| Agentic Commerce | Agent purchases without consent or payment evidence | Consent & Payment Evidence |
| FinTech | Proving process integrity to an auditor | Execution Audit Trail |

**Beachhead: AI agent payments and agentic commerce.** It is the only segment
where all three components already have code behind them and the buyer's pain is
concrete enough to pay for. Wallets and DEXs are the second wave; enterprise
policy packs are the third.

**Why the positioning is defensible:** the value is not a detection model that
ages, it is a receipt format, a fail-closed policy engine and an offline
verifier. A competitor can copy a dashboard; copying verifiability means
matching the evidence contract and getting third parties to accept it.

## 3 · Technology & Architecture

Four mechanical stages, one direction, no hidden steps:

| Stage | What happens | Where it lives |
|---|---|---|
| 1 · Authorize | A signed receipt binds intent, policy, deadline to the exact transaction bytes | `packages/stellar/presign.mjs` (PSAR/1), `packages/agent-gate/` |
| 2 · Enforce | Field-by-field conformance; `PASS` or a named refusal, never a score | `packages/agent-gate/`, `examples/stellar-dex-integration/` (DEX-GATE/1) |
| 3 · Prove | Delivery/dispute evidence and execution comparison | `packages/delivery/`, `packages/evidence/` (DDE/1) |
| 4 · Verify anywhere | Offline verifier in JS, Rust, WASM, C/Python with parity | `packages/independent-verifier/`, `test/verifier-c/` |

Anchoring (the optional durability layer) is a Soroban contract and a Core DAO
evidence registry — not required to verify a receipt, used to make one
tamper-evident over time.

Engineering discipline is part of the product: deterministic suites, an
adversarial corpus, a boundary audit that fails CI on prose that contradicts the
measured state, a claims registry whose ceiling rule forbids asserting a status
stronger than the evidence cites, and a doc scanner that fails on any stale
number. In the current tree that is **1925/1925 tests**, 43/43 Foundry proofs,
0 boundary violations across the scanned files.

Architecture detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/EXECUTION-TRUST-LAYER.md](docs/EXECUTION-TRUST-LAYER.md).

## 4 · Mainnet Evidence

Executed, not planned:

| Network | Evidence | Status |
|---|---|---|
| **Stellar mainnet** | Soroban commitment anchor `CCKA2GYV…QMMXPSP`, first `commit()` tx `69044807…5dbc9fec`, ledger 65,337,373 | EXECUTED |
| **Stellar mainnet** | First signed funded swap gated by DEX-GATE/1, tx `ac2a7990…640b9097`, ledger 65,338,112 | CONFIRMED |
| **Core DAO mainnet** | Evidence registry `0x037dF08F…6AFf9EA6E`, verified agent execution, 43/43 Foundry proofs | LIVE |
| **Pi Network** | Execution-truth plan | PREPARED / DRY_RUN — no status promotion |

What is **not** deployed: the authorized lane on Stellar mainnet, the Soroban
`commit_authorized` path in production, and any wallet integration. Those are
the funded milestones, not current facts.

Full per-surface matrix: [docs/EVIDENCE.md](docs/EVIDENCE.md) ·
[docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md).

## 5 · Independent Reproduction

On 19 Nov 2026 the **Zambo / AER-1** team — authors of an independent
agent-execution-receipt standard, with no relationship to this project — cloned
the repository at a pinned commit, counted the CI checks themselves, and ran the
VAR/1 pilot kit with one command. The seeded receipt re-derived byte-for-byte on
three machines across two Node runtimes.

| Signal | Result |
|---|---|
| Pilot-kit rows on a fresh clone, run twice | 15 / 15, exit 0 |
| CI check runs counted externally on the commit | 12 / 12 |
| Seeded receipt identical on three machines | byte-identical |
| AER-1 × VAR/1 outcome mapping agreed in public | 5 outcomes mapped |

Public record: [ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328).

**Limits of this signal, stated plainly:** it is a technical reproduction of an
open kit by another standards team. It is not a customer, a commercial pilot, a
partnership, an audit or an endorsement. It proves reproducibility by someone who
does not work here — nothing more.

## 6 · Current Limitations

This section is deliberately first-person and uncomfortable.

| # | Limitation | Consequence |
|---|---|---|
| 1 | **Zero external adopters, zero signed pilots, zero revenue** | No product-market evidence yet; the first pilots are the test |
| 2 | **No third-party security review** | The one gap tests cannot close; budgeted, not bought |
| 3 | **Solo founder** | Delivery and distribution compete for the same hours |
| 4 | **Authorized lane not deployed on mainnet** | Today's evidence is anchor + gated swap, not a production lane |
| 5 | **No wallet integration** | Freighter evaluation is a comment, not a shipped feature |
| 6 | **Reputation/risk surfaces are findings, not a score** | Not sellable as a safety rating, by design |
| 7 | **Pi lane is a plan** | No evidence claim of any kind |
| 8 | **Multi-chain breadth can look like focus loss** | Answered by one product, three components ([POSITIONING](docs/POSITIONING.md)) |

If any of these is described otherwise in a deck, the deck is wrong.

## 7 · Business Model

Open core, commercial operation. The verifier and receipt format stay MIT and
free to run offline — charging for the ability to check a receipt would destroy
the premise.

| Product | Revenue | Buyer |
|---|---|---|
| **CoreGuard SDK** | Subscription or enterprise licence | Wallet/DEX/agent-platform engineering teams |
| **Managed Verification** | Per-verification service fee | Teams that want evidence without running infrastructure |
| **Enterprise Integration** | Integration fee + annual support/SLA | FinTech, payment gateways, escrow, exchanges |

Detail, open-core boundary and licence discipline: [docs/BUSINESS-MODEL.md](docs/BUSINESS-MODEL.md).

## 8 · Funding Requirements

**$150,000 requested — not awarded.** Milestone-gated, four months, XLM-equivalent.

| Tranche | Amount | Released when |
|---|---:|---|
| **T1** | $40,000 | M1 accepted |
| **T2** | $55,000 | M2 accepted |
| **T3** | $55,000 | M3 and M4 accepted |

| Line | Amount | What it buys |
|---|---:|---|
| Engineering (2 contractors: Soroban + SDK/DX) | $84,000 | M1–M2 delivery and the pilot integrations in M3 |
| Independent security review (signed envelope + contracts) | $18,000 | The one gap tests cannot close |
| Contract audit retainer (Soroban + EVM increment) | $12,000 | Fixes after review, second-pass verification |
| Pilot integration support and incentives | $12,000 | Two two-week scopes; removes the "no budget to try" objection |
| Infrastructure (RPC, CI minutes, artifact hosting) | $6,000 | Testnet/mainnet operations and reproducible builds |
| Legal, licensing, data-handling terms | $6,000 | Enterprise pilots need paper before code |
| Documentation and DX (reference site, examples, video) | $6,000 | Time-to-first-pass is a deliverable |
| Contingency (≤5%) | $6,000 | Released only against a named risk |

Why this shape: each payment buys a verifiable artifact, not elapsed time. The
review line exists because an unreviewed verification layer is a liability; the
audit retainer exists because a review without a fix window is theatre.

Full SCF application: [docs/SCF-BUILD-APPLICATION-V3.md](docs/SCF-BUILD-APPLICATION-V3.md).

## 9 · Milestones

Three phases. Dates are months from award, not calendar promises.

### Phase 1 — Productise (Month 1–2) · T1 + start of T2

| Milestone | Deliverable | Acceptance criterion (artifact-checkable) |
|---|---|---|
| **M1** SDK v1 | Published SDK, quickstart, API reference, error-code catalogue generated from the frozen list | A developer with no prior context goes from install to a `PASS`/`BLOCK` verdict in ≤ 15 minutes, and the quickstart's own transcript is committed |
| **M2** Authorized lane | Soroban `commit_authorized` deployed to testnet from CI-built wasm; TTL/archival policy; read-back artifact; foreign-key negative control refused by name | `docs/evidence/` shows deploy tx, authorized commit, read-back and the named refusal, reproducible from committed bytes |

### Phase 2 — Prove with outsiders (Month 3) · T3

| Milestone | Deliverable | Acceptance criterion |
|---|---|---|
| **M3** Two pilots | One DEX/wallet and one AI-agent payments partner; written scope and success criteria before work starts; published report per pilot including failures | Two external teams ran CoreGuard against their own flow; at least one paid engagement or signed LOI; both reports published |

### Phase 3 — Institutional readiness (Month 4) · T3

| Milestone | Deliverable | Acceptance criterion |
|---|---|---|
| **M4** Review closed + enterprise pack | Independent security review with findings and remediation; multi-approval, spend limits, audit export; SLA, pricing, support boundary published | Review report and remediation committed; a non-CoreGuard operator verifies a receipt using public artifacts only |

Every milestone is gated on an artifact a reviewer can inspect without asking us
anything. A milestone without its artifact is not a milestone.

## 10 · Team & Hiring Plan

| Role | Type | First deliverable |
|---|---|---|
| Founder · Protocol & Security (EslaM HeshAM / MR-X) | Full-time | Architecture, engine, evidence discipline, external technical communication |
| Protocol / Security Engineer | Contractor → full-time | Soroban authorized lane deployed from CI wasm (M2) |
| Smart Contract & Integration Engineer | Contractor | Two partner integrations behind flags with adversarial cases (M3) |
| Business Development / Partnerships | Contractor or advisor | Two scoped two-week pilots signed (M3) |

No large headcount is requested. The plan buys specific capacity and buys
**independence** where it cannot be self-supplied: the security review may not be
performed by the founder or by a contractor paid from the same tranche.

Roles, independence rules and advisor status: [docs/TEAM.md](docs/TEAM.md).

---

## Diligence pack — read these in this order

| # | Document | What it settles |
|:--:|---|---|
| 1 | [docs/STATUS.md](docs/STATUS.md) | Every measured number, regenerated per push |
| 2 | [docs/EVIDENCE.md](docs/EVIDENCE.md) | What is executed on mainnet, and what is not |
| 3 | [docs/POSITIONING.md](docs/POSITIONING.md) | One company, one product, six markets |
| 4 | [docs/PRODUCT.md](docs/PRODUCT.md) | What is actually being sold |
| 5 | [docs/BUSINESS-MODEL.md](docs/BUSINESS-MODEL.md) | Who pays, and for what |
| 6 | [docs/PARTNERSHIPS.md](docs/PARTNERSHIPS.md) | Actual relationships vs targets |
| 7 | [docs/SECURITY-REVIEWS.md](docs/SECURITY-REVIEWS.md) | Review status, honestly |
| 8 | [docs/TEAM.md](docs/TEAM.md) | Who is accountable, who is being hired |
| 9 | [ROADMAP.md](ROADMAP.md) | The same milestones with engineering detail |

## Contact

Founder: [coreguard-trust-and-defense.lovable.app/founder](https://coreguard-trust-and-defense.lovable.app/founder) ·
Email: [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com) ·
Repository: [github.com/coreguard-global/CoreGuard](https://github.com/coreguard-global/CoreGuard)

`VERIFIED` ≠ `SAFE`. A receipt proves conformance to declared intent; it does not
prove the intent was wise, the outcome profitable, or the system audited.
