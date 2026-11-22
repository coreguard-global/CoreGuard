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
number. The measured totals (suite total, contract proofs, boundary files,
violations) are not restated here: the single source is
[docs/STATUS.md](docs/STATUS.md) and its machine-pinned
[state-snapshot.json](docs/state-snapshot.json).

Architecture detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
positioning: [docs/POSITIONING.md](docs/POSITIONING.md) ·
product: [docs/PRODUCT.md](docs/PRODUCT.md).

## 4 · Mainnet Evidence

Transaction ids, ledgers and per-surface statuses live in one place:
**[docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md)** (three axes per surface,
with the evidence path for each row). In one sentence, without restating the
records: the Stellar mainnet anchor and the first gated funded swap are executed
and confirmed; the Core DAO evidence registry is live; Pi is prepared, with no
status promotion.

What is **not** deployed: the authorized lane on Stellar mainnet, the Soroban
`commit_authorized` path in production, and any wallet integration. Those are
the funded milestones, not current facts — and the matrix is the file that says
so per surface.

## 5 · Independent Reproduction

On 19 Nov 2026 an outside payments team — **AgentBadge** (buidl25), with no
relationship to this project — reported an independent run of the VAR/1 pilot kit
on a machine that had never touched it: 15/15 rows, exit 0, run twice, with a
byte-identical seeded receipt on a Node runtime outside our tested set. The same
public report names one disagreeing row (an identical rerun into the same
`outDir` reopens a spent ledger) — a kit limitation we document. The AER-1 team
reviewed the model separately in that thread; that is standards feedback, not a
trial, and their name is not attached to the external run.

| Signal | Result |
|---|---|
| Pilot-kit rows on a fresh clone, run twice | 15 / 15, exit 0 |
| CI check runs counted externally on the commit | 12 / 12 |
| Seeded receipt identical on three machines | byte-identical |
| AER-1 × VAR/1 outcome mapping agreed in public | 5 outcomes mapped |

Public record: [ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328).

**Limits of this signal, stated plainly:** it is a technical reproduction of an
open kit by an outside payments team; it is not an AER-1 trial. It is not a customer, a commercial pilot, a
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

Three lines, stated once — SDK subscription or licence, managed verification per
receipt, enterprise integration with support and SLA. Pricing shapes, the
open-core boundary, the MIT caveats and what we would refuse to sell are in
**[docs/BUSINESS-MODEL.md](docs/BUSINESS-MODEL.md)**; they are not repeated here
so a pricing experiment cannot leave two documents disagreeing.

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

### Funding routes, run in parallel rather than sequentially

Grants are one route, not the plan. These run at the same time, and none of them
is counted as income until it is in writing:

| Route | What it is | Current state | Next concrete step |
|---|---|---|---|
| **SCF #46 Build Award** (this ask) | $150,000 milestone-gated, four months | **Submitted and under review** — one interest form per cycle, so no second submission is possible this round | Follow the review; answer questions with artifacts, not narrative |
| **SCF RFP track — RFP-2 (XDR/CAP coverage audit tool and indexer hardening)** | A separate, scoped RFP instrument: manifest schema, corpus, JS/Go/Rust conformance runner, indexer-hardening guide | **Submission package ready and committed**; the deliverables are proposed work, not built | Submit through the RFP channel named in the current handbook; keep the reviewer path one command long |
| **Referral from a Stellar developer or organisation** | The fastest credibility multiplier: a named team that has read the code vouches for the work | One public technical exchange exists (Freighter #3087, ACP #328); **no referral has been requested or given** | Ask the reviewer who already reproduced the kit for a sentence we may quote, and for an introduction to one wallet or DEX team |
| **Programmes listed in the SCF handbook** (e.g. Instawards, Audit Bank — verify eligibility against the current handbook before applying) | Smaller, faster instruments for a specific deliverable or a review-shaped cost | **Not applied** — eligibility and timing must be read from the live handbook, not assumed | Pick the one programme whose deliverable matches a milestone already defined here; never submit the same ask twice |
| **Commercial partner pilots** | A two-week scoped pilot paid by the partner, independent of any grant | **None signed** | The target list and offer are in [docs/PARTNERSHIPS.md](docs/PARTNERSHIPS.md); run it in parallel with the grant, not after it |

Two rules for this table. First, every route is **requested, not awarded**, until
a signed document or a paid invoice exists. Second, no route is allowed to change
the product story to fit a funder's language: the milestones above are what gets
delivered, whichever instrument pays for them.

**What this ask is not.** It is a milestone-gated development request to a grant
programme, not an equity round. **$150,000 is not a valuation**: it prices no
shares, it implies no cap and no ownership, and it is not evidence that the
company is worth any particular number or that the money will be granted. Every
figure above is a cost estimate attached to a named artifact, and the review and
pilot lines buy work that has not happened yet. If a deck, a conversation or a
summary turns this ask into a valuation, a priced round or an assurance of
funding, that framing is wrong and this file is the one to quote.

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
| **M3** Two pilots | One DEX/wallet and one AI-agent payments partner; written scope and success criteria before work starts ([PILOT-SOW.md](docs/PILOT-SOW.md), frozen at signature); published report per pilot including failures ([PILOT-REPORT-TEMPLATE.md](docs/PILOT-REPORT-TEMPLATE.md)) | Two external teams ran CoreGuard against their own flow; at least one paid engagement or signed LOI; both reports published |

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
| 2 | [docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md) | What is executed on each surface, and what is not |
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
