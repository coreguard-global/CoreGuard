<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/coreguard-banner-dark.png">
  <img src="brand/coreguard-banner-dark.png" alt="CoreGuard — Verify • Protect • Empower" width="92%">
</picture>

# CoreGuard

### Independent Execution Trust Infrastructure
**Security and verification infrastructure for AI agents, wallets, payments and decentralized applications.**

*One company: **CoreGuard Global**. One product: **CoreGuard Agent Execution Security** — Authorization Firewall · Execution Verification · Verifiable Consent Receipts. Stellar, Core DAO and Pi are integrations, not the identity.*

<sub><b>VERIFY</b> &nbsp;•&nbsp; <b>PROTECT</b> &nbsp;•&nbsp; <b>EMPOWER</b> &nbsp;—&nbsp; More than security. It's trust.</sub>

<br>

[![Website](https://img.shields.io/badge/Website-Investors%20%26%20Reviewers-FF8A00?style=for-the-badge&labelColor=0B0F14)](https://coreguard-trust-and-defense.lovable.app/)
[![Stellar](https://img.shields.io/badge/Stellar-Mainnet%20evidenced-F5F7FA?style=for-the-badge&logo=stellar&logoColor=0B0F14&labelColor=FF8A00)](https://coreguard-trust-and-defense.lovable.app/stellar)
[![Core DAO](https://img.shields.io/badge/Core%20DAO-Live%20on%20Mainnet-FF8A00?style=for-the-badge&labelColor=0B0F14)](https://coreguard-trust-and-defense.lovable.app/networks/core-dao)
[![SCF](https://img.shields.io/badge/SCF%20%2346-%24150K%20requested-4A5568?style=for-the-badge&labelColor=0B0F14)](docs/SCF-BUILD-APPLICATION-V3.md)

[**Website**](https://coreguard-trust-and-defense.lovable.app/) · [**Product**](docs/PRODUCT.md) · [**Investor readiness**](COREGUARD-INVESTMENT-READINESS.md) · [**Stellar review**](https://coreguard-trust-and-defense.lovable.app/stellar) · [**Docs & catalog**](https://coreguard-global.github.io/CoreGuard/) · [**Roadmap**](ROADMAP.md) · [**Brand kit**](brand/)

</div>

<!-- COREGUARD:MCPRUSH:BEGIN -->
## CoreGuard Agent Commerce — Now listed on MCPRush

<p align="center"><a href="https://mcprush.com/to/coreguard-agent-commerce-mcp?ref=badge"><img width="380" height="200" src="https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg" alt="Coreguard Agent Commerce MCP server — MCPRush grade badge" loading="lazy" /></a></p>

**Graded A on MCPRush — before anyone installs.** A live badge that updates itself. It is MCPRush's automated directory grade, not an independent security audit.

**Discover the open-source consent and execution-verification tools.**
CoreGuard Agent Commerce appears in the [MCPRush directory](https://mcprush.com/eslam-x/coreguard-agent-commerce-mcp).
This is a publicly indexed marketplace listing, checked on 21 November 2026; it is **not** a partnership, endorsement, funding award or independent security audit.
The observed listing is unclaimed and free, runs locally from its publisher's package, and is not hosted or billed by the marketplace.

[**Explore the package**](https://www.npmjs.com/package/@coreguard/agent-commerce) · [**Documentation**](https://coreguard-global.github.io/CoreGuard/DOCS.html) · [**Announcement & film**](https://coreguard-trust-and-defense.lovable.app/developments#mcprush) · [**Discuss a pilot**](https://coreguard-trust-and-defense.lovable.app/partners)

**VERIFY • PROTECT • EMPOWER.** Directory discovery is not adoption evidence. `VERIFIED ≠ SAFE`.
<!-- COREGUARD:MCPRUSH:END -->


---

## ⛨ In 30 seconds

AI agents and apps now sign transactions faster than any human can review them. Wallets show *what a transaction looks like*. **CoreGuard proves *what actually executed is what was authorized*** — and hands anyone an offline-verifiable receipt.

The product is one layer with three parts: an **Authorization Firewall** (a signed authorization bound to the exact transaction bytes), **Execution Verification** (a named `PASS` or refusal — never a score), and **Verifiable Consent Receipts** (an artifact plus an offline verifier). It runs *beside* the wallet, DEX, payment rail or chain — it does not replace them. Canonical positioning: [docs/POSITIONING.md](docs/POSITIONING.md).

<table>
<tr>
<td width="25%" valign="top"><h3>1 · Authorize</h3>A signed receipt bound to the <b>exact transaction bytes</b>.</td>
<td width="25%" valign="top"><h3>2 · Enforce</h3><code>PASS</code> or <code>BLOCK</code> with a named reason — <b>never a score</b>.</td>
<td width="25%" valign="top"><h3>3 · Verify</h3>Compare what ran against the signed envelope and result.</td>
<td width="25%" valign="top"><h3>4 · Prove</h3>Artifact + offline verifier. No secret, no network, no trust in us.</td>
</tr>
</table>

```bash
npm install && npm run trust:demo   # four pillars, three named refusals, one receipt digest — offline, no keys
```

### What that command prints

Verbatim output of `npm run trust:demo` on the committed tree — no network,
no key, no chain call. (The transcript line prints an absolute path; the
repo-relative path is shown here. Nothing else is edited.)

```text
────────────────────────────────────────────────────────────────────────
CoreGuard — Execution Trust Layer · four pillars, offline
────────────────────────────────────────────────────────────────────────
✓ AUTHORIZATION        PASS                   the conforming envelope is authorized
✓ AUTHORIZATION        NOT_INCLUDED           the receipt never claims execution
✓ EXECUTION FIREWALL   BLOCK                  a tampered amount is refused
✓ EXECUTION FIREWALL   XDR_BINDING_MISMATCH   the refusal names the binding
✓ EXECUTION FIREWALL   BLOCK                  an expired window is refused
✓ EXECUTION FIREWALL   RECEIPT_EXPIRED        the refusal names the clock
✓ VERIFIABLE EXECUTION PASS                   the same receipt still passes inside its window
✓ IMMUTABLE EVIDENCE   0                      a third party verifies with the public key alone
✓ IMMUTABLE EVIDENCE   PASS                   the outsider's verdict
✓ IMMUTABLE EVIDENCE   2                      a one-field edit is refused
✓ IMMUTABLE EVIDENCE   BAD_DIGEST             the refusal names the digest
────────────────────────────────────────────────────────────────────────
receipt digest   890fc4e2e968ce9e244ef26e28f77bac8cf82e0a2bb85d9000f535f33a9ebb64
envelope sha256  02ddf278aa29b585684a02cbab51bfd137201650f2e91a9092b9d05f2208f74f
transcript       examples/execution-trust/out/transcript.json
────────────────────────────────────────────────────────────────────────
Not proven here: execution. A pre-sign receipt says what was AUTHORIZED.
Execution proof is the ledger read-back after submission, and nothing in this demo submits.
```

`PASS` appears only where the envelope conforms. Every refusal carries a
named code — `BLOCK` with `XDR_BINDING_MISMATCH`, `BLOCK` with
`RECEIPT_EXPIRED`, `BAD_DIGEST` — and the closing lines state what this demo
does **not** prove. Wire-level settlement, broadcast and execution are
outside it.

---

## 🧭 Choose your path

| You are… | Start here | Then |
|---|---|---|
| **Stellar / SCF reviewer** | [Stellar review page](https://coreguard-trust-and-defense.lovable.app/stellar) | [SCF application v3](docs/SCF-BUILD-APPLICATION-V3.md) · [Evidence matrix](docs/EVIDENCE-MATRIX.md) |
| **Investor or funder** | [Investment readiness](COREGUARD-INVESTMENT-READINESS.md) | [Business model](docs/BUSINESS-MODEL.md) · [Roadmap](ROADMAP.md) · [Funding request form](https://coreguard-trust-and-defense.lovable.app/funding) |
| **Incubator or partner** | [Partnerships](https://coreguard-trust-and-defense.lovable.app/partnerships) | [Pilot Kit](docs/PILOT-KIT.md) — two weeks, one verifiable artifact |
| **Developer** | [Start here](docs/START-HERE.md) · [Developer quickstart](docs/DEVELOPER-QUICKSTART.md) | [SDK reference](https://coreguard-global.github.io/CoreGuard/DDE-SDK-REFERENCE.html) · [Products](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html) |
| **Security reviewer** | [Audit readiness pack](docs/AUDIT-READINESS-PACK-2026-11-16.md) | [Competitive landscape](docs/COMPETITIVE-LANDSCAPE.md) |

---

## 🟢 External reproduction — a machine that had never touched this kit

> **19 Nov 2026 · public record:** [ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328)

An outside payments team — **AgentBadge** (buidl25) — reported an independent run of the VAR/1 pilot kit on a machine that had never touched it: **15/15 rows, exit 0, run twice**, with a byte-identical seeded receipt on a Node runtime outside our tested set. The same public report names one **disagreeing row**: an identical rerun into the same `outDir` reopens a ledger that already recorded the spend, so 3 rows fail on the second run — a real kit limitation, documented rather than hidden. The **AER-1 team** reviewed the model separately in the same thread; that is standards feedback, not a trial, and their name is not attached to the external run.

| Signal | Result | Source |
|---|:--:|---|
| Pilot-kit rows on a fresh clone, run twice | **15 / 15 · exit 0** | [external report](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328#discussioncomment-19722647) |
| Seeded receipt across the reporter's runs | **byte-identical** | [seeded run](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328#discussioncomment-19750155) |
| Same-`outDir` rerun (reported disagreement) | **12 / 15** — stateful spend rows | same report |
| AER-1 team review in the same thread | **standards feedback, not a trial** | [ACP #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328) |
| AER-1 × VAR/1 outcome mapping agreed in public | **5 outcomes mapped** | [mapping note](docs/aer1-var1-outcome-mapping.md) |

**What shipped in that window (our work, not the reporter's):** `VAR/1` one-command pilot kit · `CG-OUT/1` outcome layer (five outcomes; `ABSENT` / `NOT_CHECKED` never travel as a block) · `CG-ID/1` record identity split · AER-1 parser + full 72-file corpus run · `CG-ANCHOR/1` own anchor service + `CG-COMPOSE/1` composition policy · Agent Commerce discovery, key trust, spend ledger and payment policy · two-column corpus vectors (`present-consistent-nonconforming`, `anchor-unresolvable`).

> **Scope, stated plainly:** this is an independent *technical reproduction* of our open kit by an outside payments team (AgentBadge). It is **not** a commercial pilot, customer, partnership, audit or endorsement, and it is **not** an AER-1 trial. `VERIFIED ≠ SAFE`.

**Founder:** [EslaM HeshAM (MR-X)](https://coreguard-trust-and-defense.lovable.app/founder) · Website: [coreguard-trust-and-defense.lovable.app](https://coreguard-trust-and-defense.lovable.app)

---

## ✅ Proof, not promises

| Network | What is evidenced | Status |
|---|---|---|
| **Stellar Mainnet** | Soroban commitment anchor `CCKA2GYV…QMMXPSP` · first `commit()` tx `69044807…5dbc9fec` (ledger 65,337,373) | ✅ EXECUTED |
| **Stellar Mainnet** | First signed funded swap gated by DEX-GATE/1 · tx `ac2a7990…640b9097` · **ledger 65,338,112** | ✅ CONFIRMED |
| **Stellar** | PSAR/1 pre-sign authorization receipts · 11 frozen reject codes · [Freighter technical comment](https://github.com/stellar/freighter/issues/3087) | 🟠 BUILT · wallet integration not built |
| **Core DAO Mainnet** | EvidenceRegistry `0x037dF08F…6AFf9EA6E` · verified agent execution · 43/43 Foundry proofs | ✅ LIVE |
| **Agent Commerce** | AC-FW/1 · CGCR/1 · AGR/1 · AC-CS/1 on synthetic fixtures | 🟠 BUILT · TEST_EXECUTED |
| **Pi Network** | Execution-truth plan prepared | ⏳ DRY_RUN / PLAN_ONLY |

Every hash above is re-derivable offline from `docs/evidence/`. Full detail is in the technical reference below.

---

## 💠 SCF #46 — $150,000, released only against evidence

<table>
<tr>
<td align="center" width="33%"><h2>$40K</h2><b>T1 · M1</b><br>SDK v1 + measured 15-minute quickstart, API reference, error-code catalogue</td>
<td align="center" width="33%"><h2>$55K</h2><b>T2 · M2 + M3</b><br>Soroban <code>commit_authorized</code> lane from CI wasm · two external two-week pilots</td>
<td align="center" width="33%"><h2>$55K</h2><b>T3 · M4</b><br>Independent review closed · enterprise policies, SLA, pricing, support</td>
</tr>
</table>

**Use of funds:** engineering $84K · independent security review $18K · audit retainer $12K · pilot support $12K · infrastructure $6K · legal $6K · docs & DX $6K · contingency $6K (max 5%). Source: [SCF Build application v3](docs/SCF-BUILD-APPLICATION-V3.md).

> **Requested, not awarded.** No signed commercial pilot yet — one **independent external technical reproduction** is public ([ACP #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328)); no third-party audit is complete, and no revenue is claimed. That honesty is the product: `VERIFIED ≠ SAFE`.

---

## 🤝 Work with CoreGuard

| Fund | Partner | Integrate | Talk |
|:--:|:--:|:--:|:--:|
| [Funding request →](https://coreguard-trust-and-defense.lovable.app/funding) | [Incubator & partnership →](https://coreguard-trust-and-defense.lovable.app/partnerships) | [Pilot Kit →](docs/PILOT-KIT.md) | [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com) |

<div align="center">
<br>
<img src="brand/coreguard-trust-3d.png" width="200" alt="More than security. It's trust.">
<br><sub><b>More than security. It's trust.</b></sub>
</div>

---

<div align="center">

## 📚 Technical reference

<sub>Everything below is the full, evidence-linked engineering record. Each claim points to a file in this repository.</sub>

</div>

### ★ New — Agent Commerce Security, Phase 2 (16 Nov 2026)

| Module | What it does | Status |
|---|---|---|
| **AC-FW/1** Agent Authorization Firewall | Pre-execution authorization + post-execution review with named refusals | BUILT · TEST_EXECUTED |
| **CGCR/1** Verifiable Consent Receipts | Approval bound to the exact approved bytes, re-derivable by anyone | BUILT · TEST_EXECUTED |
| **AGR/1** Risk Engine + CLI | Frozen drift vocabulary, JSON/JSONL assessment persistence | BUILT · TEST_EXECUTED |
| **AC-CS/1** Durable consumption store | Same-host, cross-process single-use anchoring (not distributed / on-chain) | BUILT · TEST_EXECUTED |
| **CGXA/1 + CGXA-SOROBAN/1** | Offline execution attestation + Soroban consent-binding preparation — **no broadcast** | DRY_RUN |

**Evidence:** [Showcase](docs/AGENT-COMMERCE-EVIDENCE-SHOWCASE-2026-11-16.md) · [Partner & funding one-pager](docs/AGENT-COMMERCE-PARTNER-FUNDING-ONE-PAGER-2026-11-16.md) · [Pilot plan](docs/AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md) · [Outreach pack](docs/AGENT-COMMERCE-OUTREACH-PACK-2026-11-16.md) · [Roadmap](ROADMAP.md) · [Brand kit](brand/)

> Synthetic fixtures only. No interception of real wallet/card flows, no provider endorsement, no customers, revenue, audit or awarded funding are claimed. `VERIFIED ≠ SAFE`.

### The Execution Trust Layer for Stellar
**VERIFY · PROTECT · PROVE**

**CoreGuard doesn't tell you whether a transaction looks safe.**
**It proves whether what executed is what was authorized — and hands a stranger the receipt.**

| Pillar | Question it answers | What you get |
|---|---|---|
| **1 · Authorization** | What was this human or agent allowed to do? | a signed receipt bound to the exact transaction bytes |
| **2 · Execution Firewall** | Is what is about to be signed still that thing? | `PASS` or `BLOCK` with a named code — never a score |
| **3 · Verifiable Execution** | Did what ran match what was authorized? | a comparison against the signed envelope and the result |
| **4 · Immutable Evidence** | Can a third party check this without trusting us? | an artifact + an offline verifier: no secret, no network |

**See it in one command — offline, no keys:** `npm install` → `npm run trust:demo` — four pillars, three refusals by name, one receipt digest.

Then: **[Developer quickstart](docs/DEVELOPER-QUICKSTART.md)** (three calls) · **[Pilot kit](docs/PILOT-KIT.md)** (two weeks, one artifact a stranger can verify) · **[Positioning](docs/POSITIONING.md)** · **[Competitive landscape](docs/COMPETITIVE-LANDSCAPE.md)** (cited) · **[SCF Build application v3](docs/SCF-BUILD-APPLICATION-V3.md)** · **[Evidence matrix](docs/EVIDENCE-MATRIX.md)** (code, execution and adoption, kept apart) · **[Audit readiness pack](docs/AUDIT-READINESS-PACK-2026-11-16.md)** (scope, invariants, out-of-scope) · **[Two draft LOIs](docs/loi/README.md)** (drafts: not sent, not signed).

**Honest status today:** the four pillars are BUILT and TEST_EXECUTED in this repository; external adoption is **NOT_BUILT** — zero external projects, zero signed pilots, no third-party audit, and the Soroban authorized lane is source-only, not deployed.

### Agent Commerce product family — The Trust Layer for Autonomous Execution

> **Positioning:** CoreGuard — The Trust Layer for Autonomous Execution. **Verifiable authorization. Deterministic enforcement. Independent evidence.**
>
> **Boundary (non-negotiable):** offline, deterministic, synthetic orders only (placeholder credentials, never a PAN). No contact, integration, or endorsement is claimed with OpenAI, American Express, Mastercard, Visa, or any provider. npm publication and any live external use are OWNER-GATED. `VERIFIED ≠ SAFE`; not a probabilistic fraud score. Funding **$0**.

| Product | What it does (committed) | Status | Entry point |
|---|---|---|---|
| **1 · Agent Authorization Firewall** | Refuses an action that diverges from the authorized intent, fail-closed (offline). | BUILT · TEST_EXECUTED · integration NOT_BUILT | [`packages/agent-gate/index.mjs`](packages/agent-gate/index.mjs) · `test/integrations/agent-payment-gate.test.mjs` |
| **2 · Verifiable Consent Receipts (CGCR/1)** | Binds the user's approval to the exact approved order bytes as an independently re-derivable receipt; verification on divergence is fail-closed `INVALID` with the drifted field named. | BUILT · TEST_EXECUTED · integration NOT_BUILT | [`packages/agent-commerce/index.mjs`](packages/agent-commerce/index.mjs) · `test/integrations/agent-commerce-sdk.test.mjs` |
| **3 · Agent Risk Engine (AGR/1)** | Deterministic authorization-drift taxonomy (named classes + severities). | BUILT · TEST_EXECUTED · integration NOT_BUILT | [`packages/agent-commerce/risk.mjs`](packages/agent-commerce/risk.mjs) · `test/integrations/agent-commerce-sdk.test.mjs` |
| **4 · Agent Commerce SDK + MCP + REST API** | The commerce arc as SDK + stdio MCP server (JSON-RPC) + REST (`/v1/authorize`, `/v1/verify`, `/v1/risk-assess`), offline. | BUILT · TEST_EXECUTED · integration NOT_BUILT · npm publication OWNER-GATED | [`packages/agent-commerce/`](packages/agent-commerce/) · `test/integrations/agent-commerce-{sdk,mcp,http}.test.mjs` |
| **5 · Cross-Chain Execution Attestation** | The consent↔execution arc attested against a chain's COMMITTED binding record (CGXA/1: consent receiptId + executed-order commitment + the frozen adapter registry + verification level COMMITTED_EVIDENCE). | **BUILT · TEST_EXECUTED (offline attestation surface)** — on-chain broadcast legs **OWNER-GATED / NOT_PERFORMED** | [AGENT-COMMERCE-SECURITY-SPEC-V1.0](docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md) §8 · `packages/agent-commerce/attest.mjs` · `test/integrations/agent-commerce-attestation.test.mjs` (16 tests) · `examples/agent-commerce-attestation/run.mjs` (per-chain facts committed and pinned: Core DAO anchors LIVE/RECORDED on chainId 1116; Stellar anchor contract per the evidence matrix) |

> Spec & console & dashboard: [docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md](docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md) · [docs/agent-commerce-console.html](docs/agent-commerce-console.html) · [docs/agent-commerce-dashboard.html](docs/agent-commerce-dashboard.html) (offline operator view: decisions + receipts + honest gaps) · [docs/POSITIONING.md](docs/POSITIONING.md) · [docs/PRODUCTS.md](docs/PRODUCTS.md) · [integration guide](docs/agent-commerce-integration-guide-2026-11-15.md).
>
> Beyond the five products, three committed family surfaces: the **named attack battery** (`test/integrations/agent-commerce-attack-battery.test.mjs` — deterministic six-vector prompt-injection fuzz set, post-approval swaps/drifts, replay, the documented cross-session consumption gap, expiry, receipt tamper), the **TypeScript declaration surface** (`packages/agent-commerce/index.d.ts` — structural contract, no tsc lane in CI, stated honestly), and the **bilingual operator dashboard** (data island equals the committed artifacts byte-for-byte). Outreach/funding materials are instruments only (no contact claimed): [outreach dossier](docs/agent-commerce-openai-outreach-dossier-2026-11-15.md) · [18 partner message drafts, never sent](docs/partner-outreach-messages-2026-11-15.md) · [weekly opportunities 2026-11-15](docs/agentic-commerce-weekly-opportunities-2026-11-15.md).

[![CI](https://github.com/coreguard-global/CoreGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/coreguard-global/CoreGuard/actions/workflows/ci.yml)
[![Core DAO Killer](https://coreguard-global.github.io/CoreGuard/assets/badges/core-dao-killer.svg)](docs/COREDAO-KILLER-FEATURES.md)
[![Stellar Killer](https://img.shields.io/badge/Stellar-KILLER%20FEATURES-7B61FF.svg?logo=stellar&logoColor=white)](docs/STELLAR-KILLER-FEATURES.md)
[![Pi Network Killer](https://img.shields.io/badge/Pi%20Network-KILLER%20FEATURES-F5A623.svg?logo=pi-network&logoColor=white)](docs/PI-KILLER-FEATURES.md)
[![Trinity](https://img.shields.io/badge/CORE%20%2B%20STELLAR%20%2B%20PI-TRINITY-00D4AA.svg)](docs/TRINITY-CORE-STELLAR-PI.md)
[![DDE Evidence Cycle](https://github.com/coreguard-global/CoreGuard/actions/workflows/dde.yml/badge.svg)](https://github.com/coreguard-global/CoreGuard/actions/workflows/dde.yml)
[![Docs](https://img.shields.io/badge/docs-API%20reference%20live-0969DA.svg?logo=githubpages&logoColor=white)](https://coreguard-global.github.io/CoreGuard/DDE-API-REFERENCE.html)
[![Intake Pipeline](https://github.com/coreguard-global/CoreGuard/actions/workflows/intake.yml/badge.svg)](https://github.com/coreguard-global/CoreGuard/actions/workflows/intake.yml)
[![DDE perf · engine](docs/badges/perf-engine.svg)](benchmarks/perf-history.jsonl)
[![DDE perf · wire](docs/badges/perf-wire.svg)](benchmarks/perf-history.jsonl)
[![DDE perf · sdk](docs/badges/perf-sdk.svg)](benchmarks/perf-history.jsonl)
[![DDE perf · all](docs/badges/perf-all.svg)](benchmarks/perf-history.jsonl)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Solidity](https://img.shields.io/badge/solidity-0.8.24-363636.svg?logo=solidity&logoColor=white)](https://github.com/foundry-rs/foundry)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Spec](https://img.shields.io/badge/CGEP%2F1-Draft-yellow.svg)](spec/CGEP-1.md)
[![Full Inventory - ALL-IN-ONE](https://img.shields.io/badge/Full%20Inventory-ALL--IN--ONE-0f766e)](docs/ALL-IN-ONE-CATALOG.md)

## Official website, films & judges review

<!-- COREGUARD-WEBSITE-SYNC:START -->
### Live website content sync

> Updated automatically after an authorized CoreGuard administrator saves website content. Only this managed block and the judges-language summary are changed by the website sync. Funding remains requested, not awarded; VERIFIED ≠ SAFE.

**Last synced:** 2026-11-21T14:17:22.710Z · [Open the official website](https://coreguard-trust-and-defense.lovable.app/) · [Investor brief](https://coreguard-trust-and-defense.lovable.app/investors) · [Research blog](https://coreguard-trust-and-defense.lovable.app/blog) · [Judges — English](https://coreguard-trust-and-defense.lovable.app/stellar#stellar-review) · [الحكّام — العربية](https://coreguard-trust-and-defense.lovable.app/ar/stellar#stellar-review)

**Brand settings:** orange #FF8A00 · glow #FFB547 · background #0B0F14 · logo Official CoreGuard shield

#### Current network messaging

| Network | English headline | العنوان بالعربية |
|---|---|---|
| Core DAO | The execution truth layer for Bitcoin DeFi on Core. | طبقة حقيقة التنفيذ لـ Bitcoin DeFi على Core. |
| Stellar | Fail-closed execution for Soroban and Stellar DEX flows. | تنفيذ آمن (fail-closed) لعمليات Soroban و Stellar DEX. |
| Pi Network | Execution truth for Pi Network — commerce shield, wallet guard, verified badge, 7-run ladder, mainnet anchor (prepared), attestation service (planned), cross-network with Core + Stellar. | حقيقة تنفيذ لـ Pi Network — درع تجارة، حماية محفظة، شارة تاجر موثّق، سلم 7 درجات، مرساة شبكة رئيسية (مستعدة)، خدمة توثيق (مخطط لها)، ومرساة مشترك مع Core وStellar. |

#### Current product messaging

| Product | Status | English tagline | الوصف بالعربية |
|---|---|---|---|
| ★ Stellar DEX-GATE/1 — Signed Swap Gate | LIVE | First signed funded swap on Stellar mainnet: 4.0598146 XLM → 0.6306239 USDC, both gates VERIFIED before submission (ledger 65,338,112). | أول تبديل موقّع وممول على Stellar Mainnet: ‎4.0598146 XLM → 0.6306239 USDC، والبوابتين VERIFIED قبل الإرسال (ledger 65,338,112). |
| ★ SOROBAN/1 Commitment Anchor | LIVE | Live Soroban contract; first commit(proofId, commitment) invoked on mainnet with byte-exact read-back (ledger 65,337,373). | عقد Soroban شغّال؛ أول commit اتنفّذ على Mainnet وقراءته رجعت مطابقة بالبايت (ledger 65,337,373). |
| CGEP/1 Execution Receipts | LIVE | Intent → policy → commitment → receipt → independent verifier → anchor. | نية ← سياسة ← التزام ← إيصال ← مُحقِّق مستقل ← مرساة. |
| Execution Firewall | SHIPPED | Wrap any action — swap, lend, bridge, vote, agent proposal — with ALLOW / DENY / HOLD. | لف أي عملية — swap أو قرض أو bridge أو تصويت أو اقتراح وكيل — بقرار ALLOW / DENY / HOLD. |
| x402 Reserve-before-sign | SHIPPED | Payment-gated escrow with deterministic replay and on-chain commission. | ضمان مشروط بالدفع مع إعادة تشغيل حتمية وعمولة على السلسلة. |
| ESCROW/1 — Bounty Escrow Mirror | DRY_RUN | SHIPPED JS mirror · NOT LAUNCHED. Verify-before-release, digest-bound signatures, single-spend release and full refund; no chain calls or funds moved. | نسخة JS جاهزة · لم تُطلق. تحقق قبل الإفراج، توقيع مربوط بالدليل، إفراج مرة واحدة واسترداد كامل؛ من غير اتصال بالشبكة أو حركة أموال. |
| AgentProof | SHIPPED | Declared, signer-bound actor provenance — never a behavioural guess. | إثبات هوية المنفّذ مربوط بالتوقيع — مش تخمين سلوكي. |
| DDE/1 Dispute Boundary | SHIPPED | Execution/acceptance disputes resolved with offline, deterministic evidence packages. | نزاعات التنفيذ والقبول بتتحل بحزم أدلة حتمية بتشتغل بدون إنترنت. |
| Independent Verifier | SHIPPED | JS / Rust-WASM / Python verifiers. Trust never depends on us running a hosted check. | مُحققات JS و Rust-WASM و Python. الثقة مش معتمدة إننا نشغّل فحص عندنا. |
| Badge Shield | SHIPPED | Embeddable verification badges rendered only from anchored manifests. | شارات تحقق تتحط في أي موقع، بتطلع بس من بيانات متثبّتة على السلسلة. |
| ★ PSAR/1 Pre-Sign Authorization Receipts | SHIPPED | A Stellar transaction carries its own authorization proof before any signature — PASS / BLOCK, bound to the exact XDR bytes. 37 tests; v1 does not semantically decode XDR. | معاملة Stellar بتشيل إثبات التصريح بتاعها قبل أي توقيع — PASS أو BLOCK، مربوطة بنفس بايتات المعاملة بالظبط. 37 اختبار؛ والإصدار الأول مش بيفك محتوى XDR دلاليًا. |
| ★ Agent Commerce Security — AC-FW/1 · CGCR/1 · AGR/1 | SHIPPED | Agent authorization firewall, verifiable consent receipts and risk engine — SDK, MCP server and REST API. 1958/1958 tests, offline and fail-closed. | جدار تفويض للوكلاء، وإيصالات موافقة قابلة للتحقق، ومحرك مخاطر — SDK وخادم MCP وREST API. ‏1958/1958 اختبار، دون اتصال ورفض آمن. |
| CGXA/1 + CGXA-SOROBAN/1 — Execution Attestation | DRY_RUN | Offline attestation of the approval↔execution arc with Soroban consent-binding preparation. No broadcast; on-chain action is owner-gated. | شهادة دون اتصال لمسار الموافقة↔التنفيذ مع تجهيز ربط الموافقة على Soroban. بدون بث؛ التنفيذ على السلسلة بقرار المالك. |
| Trust Gate · Labs · Verify Bot | RESEARCH | Investor portal (TRUST.md) live; CoreGuard Labs evidence lab DRAFT; Telegram/Discord verify bot PLAN_ONLY. | بوابة المستثمر (TRUST.md) شغالة؛ معمل الأدلة CoreGuard Labs مسودة؛ بوت التحقق لسه خطة. |
| @coreguard/sdk + CLI | GATED | Two-line SDK integration and `npx coreguard demo`. 13-package npm closure, release-gated. | دمج في سطرين و`npx coreguard demo`. 13 حزمة npm بانتظار بوابة الإصدار. |
<!-- COREGUARD-WEBSITE-SYNC:END -->

**One public starting point for investors, Stellar judges and ecosystem reviewers:** [coreguard-trust-and-defense.lovable.app](https://coreguard-trust-and-defense.lovable.app/). The website brings the product story, public evidence, films, funding path, partnerships and contact routes together; this repository remains the source of implementation truth.

| Destination | What investors and reviewers can inspect |
|---|---|
| **[Official CoreGuard website](https://coreguard-trust-and-defense.lovable.app/)** | The Execution Trust Layer vision, products, networks, public evidence and the focused Stellar launch order |
| **[Stellar judges presentation — English & Arabic](https://coreguard-trust-and-defense.lovable.app/stellar#stellar-review)** | Four trust layers, authorized AI-agent payments, the integration surface, function-by-function comparison, two-week pilot scorecard, team evidence, future Personal/Enterprise packaging and the five-stage execution plan |
| **[Stellar Mainnet evidence](https://coreguard-trust-and-defense.lovable.app/stellar#request)** | The owner-operated Soroban commit and first signed funded gated swap, with explorer links and the requested **$40K / $55K / $55K** milestone presentation |
| **[Core DAO execution evidence](https://coreguard-trust-and-defense.lovable.app/networks/core-dao)** | Execution receipts, fail-closed firewall and dispute-evidence surfaces for Core DAO |
| **[Products](https://coreguard-trust-and-defense.lovable.app/products) · [Developments](https://coreguard-trust-and-defense.lovable.app/developments) · [Security & code reviews](https://coreguard-trust-and-defense.lovable.app/reviews)** | The current catalog, dated repository developments and published review findings with their limitations kept visible |
| **[Funding](https://coreguard-trust-and-defense.lovable.app/funding?network=Stellar&kind=grant) · [Pilot & partnership proposal](https://coreguard-trust-and-defense.lovable.app/partnerships) · [Contact](https://coreguard-trust-and-defense.lovable.app/contact)** | Direct routes for grant interest, a documented pilot, incubation, partnerships and investor conversations |

### Watch the two CoreGuard films

| Film | Watch with its evidence context | Direct MP4 | Exact purpose and boundary |
|---|---|---|---|
| **PSAR/1 × Freighter — 89.6 seconds** | [Open the PSAR/1 film and technical boundary](https://coreguard-trust-and-defense.lovable.app/stellar#psar-demo) | [Watch/download the PSAR/1 MP4](https://coreguard-trust-and-defense.lovable.app/__l5e/assets-v1/53014dad-fcdc-43b6-9f59-721cdc4d4536/coreguard_psar1_freighter_90s.mp4) | English voiceover and captions; a **visual replay of captured clean-clone output**, not a live wallet recording. It shows exact-XDR receipt binding, PASS, then BLOCK for changed bytes and an expired receipt. Wallet integration and external adoption are **not built**. |
| **Stellar Mainnet & SCF — 90 seconds** | [Open the Mainnet film and on-chain evidence](https://coreguard-trust-and-defense.lovable.app/stellar#mainnet-demo) | [Watch/download the Mainnet MP4](https://coreguard-trust-and-defense.lovable.app/__l5e/assets-v1/44aa5a83-961c-450e-9ca2-fc2a65bed0db/coreguard_stellar_scf_90s_v2.mp4) | English voiceover covering the live Soroban commitment anchor, first signed funded swap, execution-truth story and requested $150K roadmap. This is separate from the offline PSAR/1 pre-sign demonstration. |

### Judges' direct review path

1. **See the whole presentation:** [Stellar judges & ecosystem review](https://coreguard-trust-and-defense.lovable.app/stellar#stellar-review) — the complete presentation is available in English and Arabic, each with direct README, Pilot Kit and comparison actions.
2. **Inspect the implementation narrative:** [README](README.md) · [Positioning](docs/POSITIONING.md) · [Developer quickstart](docs/DEVELOPER-QUICKSTART.md).
3. **Evaluate the next proof:** [Two-week Pilot Kit](docs/PILOT-KIT.md) — one named counterparty, one flow, measured integration effort, replayable artifacts and a publishable report including failures.
4. **Compare by function, not hype:** [Cited competitive landscape](docs/COMPETITIVE-LANDSCAPE.md) — simulation, wallet security, smart-contract monitoring and AI-agent guardrails, with CoreGuard presented as a complementary evidence layer rather than a universal replacement.
5. **Share the short visual preview:** [6-second animated judges loop](https://coreguard-trust-and-defense.lovable.app/__l5e/assets-v1/c2d810f1-aa9b-42d4-809d-e74a39d7b20c/og-judges-preview.mp4) — a silent brand preview for link sharing, not a substitute for the two evidence films or the full review.

**Reviewer truth boundary:** public implementation surfaces, tests and owner-operated Mainnet evidence exist; zero external customers, zero signed pilots and zero production integrations are recorded. Funding is **requested, not awarded**; stable SDK publication, independent security review, staffed specialist roles and external adoption remain separate evidence milestones. **VERIFIED ≠ SAFE.**

---

## 🟠 SCF #46 — RFP Track · RFP-2: XDR/CAP-Coverage Audit Tool and Indexer-Hardening Guide

> **SUBMISSION-READY before the deadline (2026-11-20, 9 AM PT) — every artifact below is committed, and a reviewer re-runs the whole thing from a fresh clone. Nothing is claimed beyond "submitted"; funding stays $0 until an award lands.**

| What an SCF reviewer can check, right now | Where (committed evidence) |
|---|---|
| **The paste-ready instrument** — interest-form answers + the full technical annex: every RFP deliverable mapped to its quoted acceptance check, testable milestones M0–M5, architecture diagram, draft manifest schema v0, sample corpus entries, honest familiarity statement (incl. *"no indexer authored yet"*) | [docs/SCF-46-RFP2-XDR-AUDIT-SUBMISSION-2026-11-13.md](docs/SCF-46-RFP2-XDR-AUDIT-SUBMISSION-2026-11-13.md) |
| **The RFP's mandatory reviewability gate** — draft manifest schema + sample corpus entries + evidence of reproducing one sighting class from the RFP itself: the `js-stellar-sdk#1766` ordering divergence (strkey-string order vs XDR-byte order genuinely disagree), reproduced offline and deterministically, with a CRC negative control | `node scripts/scf-rfp2-sighting-repro.mjs` (offline · no keys · no network) · [docs/evidence/scf-rfp2-sighting-repro.json](docs/evidence/scf-rfp2-sighting-repro.json) |
| **Interest-form status (measured on the SCF dashboard, 2026-11-14)** | Submitted **2026-11-06/07** — before the RFPs opened — and **under review**; the platform enforces one interest form per cycle (button disabled: *"You already have an interest under review"*); **RFP Track — RFP 2 interest flagged in the Stellar Developers Discord `#scf-general`** under the owner's account (2026-11-14); the handbook's second official channel is `communityfund@stellar.org` (owner-only) |
| **Honest boundary (standing, non-negotiable)** | The M0–M5 deliverables — per-CAP corpus, replay harness, JS/Go/Rust conformance runner, Go linter, indexer-hardening guide, wallet-backend findings — are the **proposed funded work itself, not built**; *"submitted"* is the only publishable fact; no endorsement, adoption or partnership is claimed anywhere |

**60-second reviewer path:** clone → `npm install` → `node scripts/scf-rfp2-sighting-repro.mjs` → read the instrument's Part B (the technical proposal annex) → the same facts are tabled in [docs/PRODUCTION-ROADMAP.md §11](docs/PRODUCTION-ROADMAP.md) and [docs/STATUS.md](docs/STATUS.md).

### Newest engineering surface — pre-sign authorization receipts (PSAR/1)

A Stellar transaction can now carry its own authorization proof **before any signature exists**: CoreGuard issues a receipt bound to the exact transaction XDR bytes (sha256 over canonical JSON + Ed25519 against a pinned issuer key), and a wallet re-derives the whole decision itself — fail-closed, two decisions only (`PASS` / `BLOCK`), eleven frozen reject codes, and `executionProof: NOT_INCLUDED` on every verdict (a pre-sign receipt never claims execution). Change one byte of the transaction after the approval and verification fails closed with `XDR_BINDING_MISMATCH`.

Run the offline arc: `npm run stellar:presign` — no signing, no wallet, no network (build a real unsigned envelope → issue the receipt → PASS → tampered amount → BLOCK → lapsed window → BLOCK). Spec: `packages/stellar/presign.mjs` · tests: `test/integrations/stellar-presign.test.mjs` (PSAR/1 battery, machine-pinned in the suite) · proposal: [docs/freighter-presign-integration-proposal-2026-11-12.md](docs/freighter-presign-integration-proposal-2026-11-12.md) · critical self-review: [docs/psar-security-review-2026-11-12.md](docs/psar-security-review-2026-11-12.md) · 90s demo video (visual replay of captured clean-clone demo output, not a live screen recording): [assets/coreguard_psar1_freighter_90s.mp4](assets/coreguard_psar1_freighter_90s.mp4) · linked on [PRODUCTS.html](docs/PRODUCTS.html) and [STELLAR-INTEGRATION-GUIDE.md](docs/STELLAR-INTEGRATION-GUIDE.md). A scoped **technical evaluation** comment (feasibility/boundaries only; no endorsement, merge or adoption requested or received) was posted on Freighter `stellar/freighter#3087` and recorded in [STATUS.md](docs/STATUS.md) / [campaign-ops-outreach-kit-2026-09-25.md](docs/campaign-ops-outreach-kit-2026-09-25.md): https://github.com/stellar/freighter/issues/3087#issuecomment-6834273239. Integration status **NOT_BUILT**: a proposal/comment/demo is not adoption, and no wallet embeds this yet.

### Recent developments — Nov 10–14 2026 (by network, measured & evidenced)

> Canonical measured state for this cycle: **1958 / 1958 tests**, **1420 files scanned / 0 violations**, **docs-node 133 executed · 82 skip-listed · 30 covered**, **Foundry 43/43 pass** — [docs/state-snapshot.json](docs/state-snapshot.json) · [docs/STATUS.md](docs/STATUS.md). Every item below is labeled by its committed evidence; nothing implies revenue, customers, partnerships, external adoption, or a third-party audit.

#### Stellar — pre-sign receipts, agent-gate envelope path, Freighter evaluation, DEX integration

| Development | What landed (committed) | Honest status / evidence |
|---|---|---|
| **SCF #46 RFP-2 submission kit (XDR/CAP-Coverage Audit Tool and Indexer-Hardening Guide)** | The SCF RFP-2 reviewability gate satisfied BEFORE submission: a dated paste-ready instrument (`docs/SCF-46-RFP2-XDR-AUDIT-SUBMISSION-2026-11-13.md` — interest-form answers + full technical annex mapping every RFP deliverable to its quoted acceptance check, milestones M0–M5, architecture diagram, draft manifest schema v0, sample corpus entries, honest familiarity statement incl. "no indexer authored yet") + committed offline reproduction evidence: the js-stellar-sdk#1766 ordering-divergence class reproduced deterministically from two public throwaway strkeys (strkey-string order vs XDR-byte order genuinely disagree — base32 ASCII sorts '2'-'7' before 'A'-'Z' while the encoded 5-bit groups sort the opposite way), 4 synthetic byte-round-trip-verified corpus entries (pool-share divergent issuers; CAP-0027 muxed account with its SEP-0023 M-strkey; CAP-0040 signed-payload signer; the #1789 colliding-native-keys map recorded against the installed SDK's fail-closed error verbatim), CRC negative control, no key material committed | **SUBMISSION-READY — interest form submitted 2026-11-06/07 (before the RFPs opened) and under review — measured on the dashboard 2026-11-14, one interest per cycle enforced; RFP Track — RFP 2 flagged in `#scf-general` (2026-11-14); funding $0 until awarded; "submitted" is the only publishable fact** — [SCF-46-RFP2-XDR-AUDIT-SUBMISSION-2026-11-13.md](docs/SCF-46-RFP2-XDR-AUDIT-SUBMISSION-2026-11-13.md) · [scf-rfp2-sighting-repro.mjs](scripts/scf-rfp2-sighting-repro.mjs) · [scf-rfp2-sighting-repro.json](docs/evidence/scf-rfp2-sighting-repro.json) |
| **PSAR/1 pre-sign authorization receipts** | `packages/stellar/presign.mjs` (receipt bound to exact XDR bytes, sha256 + Ed25519 over canonical JSON, pinned issuer key, injected clock/window), fail-closed `PASS`/`BLOCK`, 11 frozen reject codes, `executionProof: NOT_INCLUDED` on every verdict; offline demo `npm run stellar:presign`; hardening & self-review (issuer identity/proven key equality, safe window integers, hostile-input fail-closed, no XDR semantic decode in v1, explicit unsigned-envelope/network boundary) | **BUILT · TEST_EXECUTED · integration NOT_BUILT** — `test/integrations/stellar-presign.test.mjs`, `examples/stellar-presign/demo.mjs`, [psar-security-review-2026-11-12.md](docs/psar-security-review-2026-11-12.md), [freighter-presign-integration-proposal-2026-11-12.md](docs/freighter-presign-integration-proposal-2026-11-12.md), `docs/surface-status.json` (`stellar-presign-receipt`) |
| **Freighter #3087 technical evaluation (posted, recorded)** | Scoped feasibility/boundaries comment on `stellar/freighter#3087` (with `@JakeUrban`), posted after explicit owner approval; recorded in outreach ledger + STATUS; no further unsolicited comments (await technical reply) | **COMMENT POSTED** (no endorsement/merge/adoption requested or received) — [#3087 comment](https://github.com/stellar/freighter/issues/3087#issuecomment-6834273239), [STATUS.md](docs/STATUS.md), [campaign-ops-outreach-kit-2026-09-25.md](docs/campaign-ops-outreach-kit-2026-09-25.md) |
| **PSAR/1 × Freighter demo video (90s)** | Presentation demo / visual replay of captured clean-clone demo output (not a live screen recording), added to Stellar/docs pages and mirrored to root assets for repo visibility | **SHIPPED (asset/docs)** — [assets/coreguard_psar1_freighter_90s.mp4](assets/coreguard_psar1_freighter_90s.mp4), [docs/assets/video/coreguard_psar1_freighter_90s.mp4](docs/assets/video/coreguard_psar1_freighter_90s.mp4), [PRODUCTS.html](docs/PRODUCTS.html), [STELLAR-INTEGRATION-GUIDE.md](docs/STELLAR-INTEGRATION-GUIDE.md) |
| **AGENT-GATE/1 signed-envelope lane (Stellar)** | Three-axis status unification (`docs/surface-status.json`, `test/ci/surface-status.test.mjs`); envelope build/decode + signed-envelope verification (`AGENT-XDR/1`, Freighter adapter contract, verifier CLI 0/2/3/4, bench evidence); authorized intent bound to signed envelope bytes field-by-field; real testnet signature carried through the lane (committed evidence); runnable browser demo for a judge; Freighter extension-signature attestation/promotion path (writes evidence only after server-verified Ed25519 by declared key) | **BUILT / TEST_EXECUTED (per surface) · integration NOT_BUILT** — [AGENT-PAYMENT-GATE.md](docs/AGENT-PAYMENT-GATE.md), [STELLAR-STATUS-UNIFICATION.md](docs/STELLAR-STATUS-UNIFICATION.md), `packages/agent-gate/` (+ adapters/CLI/bench), `docs/evidence/agent-gate-testnet-signature.json`, `docs/evidence/agent-gate-bench.json`, `examples/agent-gate-browser/`, `scripts/agent-gate-freighter-attest.mjs`, `docs/surface-status.json` (agent-gate surfaces) |
| **Stellar DEX integration example (Soroban swap + gates)** | End-to-end example: Soroban swap calls gated by DEX-GATE/1 and DDE/1 fail-closed escrow, with offline/testnet-verifiable flow and tests | **TESTNET/OFFLINE VERIFIED (example)** — `examples/stellar-dex-integration/` (`run-dex-swap.mjs`, `dex-gate.mjs`, `verify-offline.mjs`, `test.mjs`), [PRODUCTS.md §11](docs/PRODUCTS.md) |
| **Stellar status/docs coherence** | Status unification across code/docs/evidence axes; Stellar killer/features, Trinity, evidence matrix and guide surfaces kept aligned with committed artifacts and honest labels | **SHIPPED (docs/contracts)** — `docs/STELLAR-KILLER-FEATURES.md`, `docs/TRINITY-CORE-STELLAR-PI.md`, `docs/EVIDENCE-MATRIX.md`, `docs/surface-status.json` |

#### Core DAO — evidence-registry proofs & measured hardening

| Development | What landed (committed) | Honest status / evidence |
|---|---|---|
| **Invariant + fuzz proofs over the Evidence Registry (Core 1116 lane)** | Foundry invariant suite and fuzz properties added/exercised over the evidence registry contracts, with deterministic seed/config in `foundry.toml`; invariants run as the test contract's own actions (not a cheatcode target) and the Foundry count pinned to what `forge` actually reports | **SHIPPED / CI-measured** — Foundry **43/43 pass** (`forge test --match-path "test/contract/*"`), `.github/workflows/ci.yml` (invariants/fuzz step), `test/contract/*invariant*`, [STATUS.md](docs/STATUS.md) |
| **Core Mainnet anchors (context, unchanged claims)** | Live commitment anchors on Core **chainId 1116** remain the recorded on-chain truth (V1 `0x037d…EA6E`, V2 `0x6626…13fd`, Gate 4.1 intent committed — governance pending where stated); no new broadcast claimed in this cycle | **LIVE / recorded** — [STATUS.md §On-chain truth](docs/STATUS.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md) |

#### Pi Network — honesty-preserved (no new live claim)

| Development | What landed (committed) | Honest status / evidence |
|---|---|---|
| **Documentation/state sync only** | Pi Network surfaces (killer features, Trinity, grant/application docs) kept consistent with the measured snapshot and cross-network truth table; no Pi mainnet transaction, anchor deployment, live integration, customer, or revenue claimed | **PREPARED / DRY_RUN / PLAN_ONLY** as previously evidenced — [PI-KILLER-FEATURES.md](docs/PI-KILLER-FEATURES.md), [TRINITY-CORE-STELLAR-PI.md](docs/TRINITY-CORE-STELLAR-PI.md) (no status promotion) |

#### Cross-network products & ecosystem (shipped artifacts, honesty-labeled)

| Development | What landed (committed) | Honest status / evidence |
|---|---|---|
| **ESCROW/1 bounty-escrow mirror + catalog/docs** | `ESCROW/1` bounty-escrow mirror (CG-BTY-007) and owner click-runbook shipped; `PSAR/1` and `ESCROW/1` added to the products catalog and DDE reference i18n/docs refreshed | **SHIPPED (artifacts/docs)** — [PRODUCTS.md](docs/PRODUCTS.md), [PRODUCTS.html](docs/PRODUCTS.html), commits `7be2d5c`, `dee6ef4` |
| **Contributor / bounty program hub** | Bounty/contributor program hub with issue templates, manifest, and claim verifier to make scoped work and acceptance criteria explicit | **SHIPPED (repo tooling/docs)** — `.github/ISSUE_TEMPLATE/`, `docs/bounties.json` / bounty manifest & claim verifier surfaces, commit `b38969c` (reward funding/payability remains as labeled in the manifest/issues; no funding award claimed) |

### The Badge Shield — exclusive-source plates · درع الشارات بمصادر حصرية

[![CoreGuard Badge Shield](https://coreguard-global.github.io/CoreGuard/assets/badges/wall-badge-shield.svg)](https://coreguard-global.github.io/CoreGuard/assets/badges/wall-badge-shield.svg)

**The official brand page — [docs/BRAND.html](https://coreguard-global.github.io/CoreGuard/BRAND.html) · صفحة الهوية الرسمية**: the shield, lockups, the audited color system (Core Orange #FF8A00 · Deep Core #0B0F14 · Graphite #4A5568 · Ice White #F5F7FA), the official gradient, the mark law, and the full downloadable asset kit.

### The trust gate · legal node · the lab · the bot — بوابة الثقة والعقدة القانونية

- **Trust gate — investor portal · بوابة الثقة**: [docs/TRUST.md](docs/TRUST.md) — the live Core Mainnet anchor (chainId 1116), the independent-verify ladder, the evidence matrix, and what we never claim.
- **Legal node · العقدة القانونية**: [LICENSE.md](LICENSE.md) — MIT code, brand-and-trademark posture, bilingual.
- **CoreGuard Labs — the evidence lab · مخبر الأدلة**: [docs/LABS.md](docs/LABS.md) — independent re-derivation, reviewer kits, incubation/program evidence packs.
- **Verify bot (Telegram/Discord) · بوت التحقق**: [docs/VERIFY-BOT.md](docs/VERIFY-BOT.md) — committed engineering spec, honest PLAN_ONLY status.
- **Verify a receipt in a browser · تحقّق من الإيصال في المتصفح**: [docs/verify.html](docs/verify.html) — the page reads a `#v1.<base64url>` bundle from the URL fragment (never the query string, so no server logs it) and re-derives the verdict inside the tab with WebCrypto (SHA-256 + Ed25519): no network, no install, no key. Its logic is the same module the Node verifier runs, and `test/integrations/verify-page.test.mjs` fails if the two ever disagree.

Seven brand plates, each minted from ONE committed file that exclusively owns its surface — Execution Firewall, Verifier X3, Stellar Agent, Trinity, the CG-BDG/1 engine, the CGEP/1 receipt, and the Core Mainnet anchor. Every plate's artwork names its source and carries that file's full `sha256` digest in a machine payload; the audit re-derives every digest from the committed tree, offline, and fails loudly on any drift — a plate can never silently drift from the bytes it certifies:

```bash
node scripts/badge-wall.mjs --audit   # re-derive all 7 plate digests from the committed tree (CG-WALL/1, offline)
node scripts/badge-wall.mjs           # regenerate plates + the composed wall after source changes
```  *Off-chain engine · Solidity registry · CGEP/1 draft spec. Real Core Mainnet execution verified · on-chain anchor live on Core (chainId 1116) · VERIFIED ANCHOR INTEGRITY — CoreGuard Verify · Protect · Empower*


---

## The Killer Ladder — seven rungs, pinned per ecosystem · سلّم المنتجات القاتلة

Every ecosystem entry — Core DAO · Stellar · Pi Network — pins the same seven rungs against committed evidence in its own facts file, no prose claims. The unified view:

| Rung | What it closes, on every network |
|---|---|
| **Killer Feature** | Intent-to-Evidence Binding — every intent carries tamper-evident, replayable evidence; break the binding and verification fails closed |
| **Killer Use** | AI Agent Payment Gate — agent proposals verified against policy + deterministic replay BEFORE submission; VERIFIED only, never auto-pay |
| **Killer On-Chain** | Per-network Commitment Anchor — Core anchor live on chainId 1116 · Soroban anchor MAINNET DEPLOYED (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`) and EXECUTED against real ledger data: the first commitment-anchor CALL is INVOKED (owner-authorized `commit(proofId, commitment)`, tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373, on-chain read-back verified), the **first SIGNED FUNDED DEX swap is now EXECUTED** on the real mainnet order book (owner-authorized `pathPaymentStrictSend` **CONFIRMED** — swap tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112; `4.0598146 XLM → 0.6306239 USDC` via the DEX-GATE/1 gated plan, wire read-back equals `fee_charged` to the stroop), and the gate surfaces (agent gate STELLAR-AGENT/1, DEX gate on the real mainnet order book DEX-GATE/1, universal DApp-shield arms) carry committed execution artifacts under `docs/evidence/` — later signed mainnet sweeps stay credential-gated · Pi anchors carried honestly as DRY_RUN/PLAN_ONLY |
| **Killer Utility** | Universal DApp Shield — wrap ANY app action (swap, lend, borrow, bridge, vote); ALLOW/DENY/HOLD with a verifiable commitment |
| **Killer Adoption** | One-line integration across wallets, DEXs, contracts and AI agents of each ecosystem |
| **Killer Reference** | Deterministic replay-before-submit: audit trail + replayHash + diff + report, re-runnable by anyone |
| **Killer Customer** | Named per network — Core: DeFi, DApps, wallets, AI agents, validators, escrow/A2A · Stellar: Freighter, Soroban DEXs, agents · Pi: Browser DApps, Pi Wallet, Pi Commerce, bridges |

One ladder, three ecosystems, one Trinity view: [Core DAO](docs/COREDAO-KILLER-FEATURES.md) · [Stellar](docs/STELLAR-KILLER-FEATURES.md) · [Pi Network](docs/PI-KILLER-FEATURES.md) · [Trinity](docs/TRINITY-CORE-STELLAR-PI.md).

**Stellar mainnet — verified then executed · ستيلار موثّق ثم منفّذ:** the wallet is live (`GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U`, first tx `0.1 XLM → SDF` at ledger 65,308,317), the Soroban anchor contract is MAINNET DEPLOYED (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`, third-party-listed with its wasm hash), and the first commitment-anchor CALL is now EXECUTED too — owner-authorized `commit(proofId, commitment)` **INVOKED** (`docs/evidence/stellar-soroban-commit-executed.json`, digest-checked; tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373; on-chain read-back `read(proofId)` = `{hash, seq}` exact) — the **first SIGNED FUNDED DEX swap is now EXECUTED** as well — owner-authorized `pathPaymentStrictSend` **CONFIRMED** on the real mainnet order book (swap tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112; trustline tx `09243337fd04d7ead8e369a8a5d5ef48648179db84608b262d5379f34fa72d76`, ledger 65,338,111; `4.0598146 XLM → 0.6306239 USDC` at rate 0.1553331, destMin `0.6011661` cleared; digest `sha256:837d063903f4905ececb6f051d9b2f5638079c2f35f4cc03163e9443e553ac2c`) — and the gate surfaces are EXECUTED with committed, digest-checked artifacts: agent gate `docs/evidence/stellar-agent-gate-executed.json` · real-mainnet-book DEX gate `docs/evidence/stellar-dex-gate-executed.json` · universal DApp-shield arms `docs/evidence/universal-dapp-shield-executed.json`. Full row-by-row truth table: [docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md).

## Proof-first: run it, don't trust it

The agent-economy primitives run with zero keys and zero money:

- **Live playground:** [PLAYGROUND.html](https://coreguard-global.github.io/CoreGuard/PLAYGROUND.html) — open a job, lock escrow, carve shares, reserve before signing, deliver evidence, and watch ACCEPTED / REJECTED / UNKNOWN.
- **Terminal demo:** the same cycle in one command, ending with `UNKNOWN → HELD`.
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — `agreed → executed → proven`, and why `UNKNOWN` stays held.
- **Facts only:** [docs/ONE-PAGER.md](docs/ONE-PAGER.md).

```bash
node demo.mjs
```

Real code, not slides:
[`packages/budget/ledger.mjs`](packages/budget/ledger.mjs) ·
[`packages/acceptance/index.mjs`](packages/acceptance/index.mjs) ·
[`packages/x402/index.mjs`](packages/x402/index.mjs) ·
[`packages/job-integration/index.mjs`](packages/job-integration/index.mjs) ·
[`packages/refusal-audit/index.mjs`](packages/refusal-audit/index.mjs)

## Products & services — the complete catalog

Every protocol, SDK, dispute layer, job-economy primitive, integration surface
and service that exists in this repository, with its honest status (SHIPPED /
LIVE / DRY_RUN / GATED / RESEARCH), is listed in one place:

- **[docs/ALL-IN-ONE-CATALOG.md](docs/ALL-IN-ONE-CATALOG.md)** — **EVERYTHING**:
  all 38 packages, all 70 npm scripts, all workflows, all examples/templates,
  all HTML surfaces, and a complete file index of every file in the repo (no
  `node_modules/.git`), with paths and runnable commands.
- **[docs/PRODUCTS.md](docs/PRODUCTS.md)** — curated complete catalog, each row
  mapped to a committed path or an executed command.
- **[docs/PRODUCTS.html](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html)** —
  the bilingual (AR/EN) catalog page.

Nothing in these catalogs claims revenue, customers, partners, funding, a price, a
third-party badge issuance, a live external integration or a third-party audit. Those stay
`UNKNOWN` / `GATED` until a named event with evidence exists.

## Protocol ecosystem

CoreGuard is now a **stack of sealed protocols**: each layer consumes the
previous layer's pinned output, re-verifies it, and never rewrites it.

```
 CGEP/1   execution truth — intent/policy → commitment → receipt → verifier → anchor
   │        (live on Core Mainnet 1116; on-chain anchor VERIFIED)
   └─► EVP/1   evidence labels — consent tri-state (FULL/PARTIAL/UNKNOWN), never a
       │        boolean; evidenceStatus/actualStatus split; SHA-256 pins
       └─► ADAL/1   dispute package — positions, closure window, award slot
            │        UNKNOWN-by-design, escrow reference-only, adapter NOT_BUILT
            ├─► Adapters   structural mapping onto documented tribunal surfaces
            │               (People's Court Partner API v2 + x402) — offline dry-run,
            │               credential-gated, network-call NOT_PERFORMED
            ├─► Reference tribunal   local synthetic adjudicator + mock escrow,
            │               fail-closed settlement semantics (no funds, no broadcast)
            └─► Conformance   per-stage PASS / FAIL / UNKNOWN / NOT_BUILT /
                              NOT_AUTHORIZED suite (CI-pinned)
   +  SDK + CLI surfaces (guard.*, verify*, evidence/dispute packages)
```

| Layer | Standard | Artifacts |
|---|---|---|
| Execution truth | [CGEP/1](spec/CGEP-1.md) | receipt, verifier, [anchor](docs/DEPLOYMENT.md), `packages/` (SDK/CLI/guard) |
| Evidence labels | [EVP/1](docs/evidence-package-standard.md) | `scripts/make-evidence-package.mjs` (EVP_OK, 11/11), committed fixture pairs |
| Dispute package | [ADAL/1](docs/dispute-package-standard.md) | `scripts/make-dispute-package.mjs` (DP_OK, 25-check verifier), reference-A/B |
| Adapter (dry-run) | [`@coreguard/peoples-court-adapter`](packages/peoples-court-adapter/README.md) | `npm run peoples-court:prepare`, schemas, dry-run fixtures |
| Reference tribunal | [examples/reference-tribunal](examples/reference-tribunal/README.md) | sim-tribunal + mock-escrow (synthetic, fail-closed) |
| Conformance | [integration-surface-map](docs/integration-surface-map-2026-09.md) | `test/delivery/interop-conformance.test.mjs` |
| Article | [The Missing Verification Layer for Agentic Disputes](docs/article-missing-verification-layer-agentic-disputes.md) | publish-ready drafts (X thread, LinkedIn) |

The stack's boundary promise: **execution, consent, adjudication, and settlement
authority are four different layers.** CoreGuard pins the first two, freezes the
record for the third, and maps (without executing) toward the fourth. Every
artifact refuses to claim more — see the [adapter](packages/peoples-court-adapter/README.md)
and [tribunal](examples/reference-tribunal/README.md) honesty notes.

```bash
# the full evidence→dispute→tribunal-ready path, offline and deterministic
npm run evidence-package -- --out evidence-package-output
npm run dispute-package -- --case A --out dispute-package-output
npm run peoples-court:prepare -- --case dispute-package-output
```

## Start here

| You are… | Your path | Time |
|---|---|---|
| **A reviewer** examining a converted fixture (or its ZIP attachment) — People's Court / Epistemic Labs, auditor, third party | [REVIEW-GUIDE.md](REVIEW-GUIDE.md) — pin integrity → engine gate → tamper probe → conformity records → intake projection | <10 min |
| **A platform integrating** — payout gating, agent marketplace, escrow, settlement | [INTEGRATION.md](INTEGRATION.md) — the boundary, the wire API, the release law; every curl executed in CI | ~5 min |
| **A party with a real case** — one real paid transaction, both sides reachable and willing | [real-fixture intake kit](examples/real-fixture-intake/) — signed disclosure scope → fail-closed gate → one-command conversion | 1 session |

---

## The problem

Programmable money moved to Bitcoin. Core gives BTC a native programmable layer, and
every swap, strategy, vault interaction and BTCFI position is executed by code — and
**execution is not the same as intent**. A front-run, a reentrancy, a hidden hop or a
mutated calldata can make the transaction "go through" while doing something
completely different from what was authorized.

Existing transaction-security and simulation systems address important parts of this
problem, but CoreGuard focuses on the missing end-to-end evidence workflow:
predeclared intent and policy → observed execution → independently reproducible
evidence → Core-native commitment anchoring.

## What CoreGuard is

CoreGuard is an **execution-truth protocol**: a deterministic pipeline that turns a
declared intent + policy and an on-chain execution into a single, cryptographically
committed **Execution Receipt** that anyone can independently re-verify — with zero
RPC, zero trust in the issuer, and an on-chain anchor on Core.

```
 DECLARED (before execution)          OBSERVED (after execution)
 ─────────────────────────────        ─────────────────────────────
 INTENT  ──┐                                 ┌── on-chain tx
 POLICY  ──┼── canonical hash ──┐            ├── receipt
 EXPECTED ─┘                    │            ├── block (state pinned)
                                │            └── trace / state delta
                                ▼                       │
                        COMMITMENT (anchor)             │
                                │                       │
                                └──► COMPARISON ◄───────┘
                                       │
                                       ▼
                             EVIDENCE BUNDLE
                                       │
                                       ▼
                              EXECUTION RECEIPT
                                       │
         ┌─────────────────────────────┴──────────────┐
         ▼                                           ▼
  INDEPENDENT VERIFIER                    EVIDENCE ANCHOR
  (no RPC, no trust)                      on Core (commitments only)
```

### Verification levels

| Level | Meaning |
|---|---|
| **L0 · Commitment** | Intent + policy committed (hashed) before execution |
| **L1 · Chain Receipt** | Execution captured from chain, receipt pinned to block hash |
| **L2 · Deterministic Replay** | Production-grade: step-by-step audit trail, cryptographic replay hash, diff, report; MATCH/MISMATCH/UNKNOWN — no partial success ever upgrades to MATCH |
| L3 · Merkle proof | Compact, privacy-friendly proof of a receipt sub-tree |
| L4 · Zero-knowledge | Fully private execution proofs (research phase) |

### Honest scope

- **VERIFIED ≠ SAFE.** CoreGuard answers *"did execution conform to authorization?"* —
  never *"is this strategy profitable / safe?"* Risk is reported as discrete findings,
  never a fuzzy score.
- **Anchor ≠ execution proof.** The registry proves that a specific commitment was
  anchored on Core. The execution claim is supported by the independently verifiable
  evidence/replay bound to that commitment.
- `v0.1` ships deterministic, evaluation-free rules: VALUE_LIMIT · TARGET_ALLOWLIST ·
  RECIPIENT_ALLOWLIST · SELECTOR_ALLOWLIST · DEADLINE · SLIPPAGE_BPS (+ ORACLE_BOUND guardrail).
- On-chain `v0.1` is a **single contract** storing commitments only — evidence lives
  off-chain, in the receipt. No surveillance, no oracles, no protocol custody.

## Testnet2 validation (funding-gated, not yet executed)

The on-chain Core Testnet2 (1114) hardening campaign is **`PREPARED /
FUNDING-BLOCKED`** — the operator wallet holds **0 tCORE2** (see
[docs/COMMUNITY.md](docs/COMMUNITY.md)), so **no live broadcast has been made**.
The staged campaign (deploy EvidenceRegistry → commitIntent → anchorProof →
three-proof on-chain verification) is ready to run the moment funding arrives.

The engine itself is proven on the **deterministic 73/73 adversarial corpus** and
the **frozen live Core Mainnet anchor** below.

### On-chain anchor: live on Core Mainnet

The anchor flow (deploy → commitIntent → anchorProof → verifyCommitment) is
**live on Core Mainnet (chainId 1116)**:

```
Registry:       0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E
Receipt ID:     0xeaa87ec1…44eb6   (deterministically recomputable)
Commitment:     0xc0dbfb45…1052
Proof ID:       0xecd9e6b3…a6b8
Verdict:        VERIFIED ANCHOR INTEGRITY  (A+B+C)
```

Independent cross-RPC verification (rpc.coredao.org + rpc.ankr.com) confirms the
contract bytecode, both `commitIntent`/`anchorProof` receipts, their events, and
`verifyCommitment(receiptId|proofId, commitment) == true` on-chain.
Full evidence bundle: [scripts/verify-live.json](scripts/verify-live.json)
(frozen historical record; live re-runs write to `scripts/verify-live.regenerated.json`).
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for how to reproduce every value.

## Stellar mainnet — verified & executed · شبكة ستيلار الرئيسية — موثّقة ثم منفّذة

CoreGuard's Stellar lane is no longer a plan: the same execution-truth stack —
wallet, Soroban commitment anchor, agent/DEX gates, universal shield — is
**verified then executed on Stellar mainnet**, with every step pinned to a
committed, digest-checked artifact. Same shape as the Core anchor above:

```
Wallet:        GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U   (live Horizon account · first tx 0.1 XLM → SDF, ledger 65,308,317)
Anchor:        CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP   (Soroban MAINNET DEPLOYED · deployment untouched, no re-deploy)
Commit CALL:   commit(proofId, commitment) INVOKED · owner-authorized
               tx 69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec · ledger 65,337,373 · read-back {hash, seq} exact
Swap:          pathPaymentStrictSend CONFIRMED · owner-signed, real mainnet order book
               tx ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097 · ledger 65,338,112
Executed:      4.0598146 XLM → 0.6306239 USDC (rate 0.1553331 · destMin 0.6011661 cleared · DEX-GATE/1 preflight VERIFIED before submission)
Verdict:       MAINNET VERIFIED (anchor call + funded swap) + three executed gate surfaces — later signed sweeps stay credential-gated
```

### Stellar on-chain truth · حقيقة ستيلار على السلسلة

| Item | Value |
|---|---|
| Mainnet wallet — live | `GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U` — live Horizon account · first tx `0.1 XLM → SDF` at ledger **65,308,317** |
| Soroban anchor (mainnet) | **MAINNET DEPLOYED** `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` — third-party-listed (stellar.expert: creator = the CoreGuard wallet, wasm hash recorded) · deployment untouched, no re-deploy |
| Soroban anchor (testnet) | TESTNET VERIFIED `CCERTRITP7A6U4PQ7NUKHXKWL2BNRMSBLVAAAWWMRAZTICUN7ZGC5Q4R` — 11/11 tests |
| First commitment-anchor CALL | **MAINNET VERIFIED** — owner-authorized `commit(proofId, commitment)` **INVOKED**: tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec` · ledger **65,337,373** · the exact chainId-1116 pair (proofId `0xecd9e6b3…cada6b8` = commitment `0xc0dbfb45…f31052`) · on-chain read-back `read(proofId)` = `{hash, seq}` exact |
| First SIGNED FUNDED DEX swap | **CONFIRMED** — DEX-GATE/1 preflight VERIFIED (both gates) → owner-signed `pathPaymentStrictSend`: swap tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097` · ledger **65,338,112** (trustline tx `09243337fd04d7ead8e369a8a5d5ef48648179db84608b262d5379f34fa72d76` · ledger 65,338,111) · `4.0598146 XLM → 0.6306239 USDC` (0.1553331 USDC/XLM) · destMin `0.6011661` cleared · wallet-bounded within the real-depth ceiling · wire read-back equals `fee_charged` to the stroop · digest `sha256:837d063903f4905ececb6f051d9b2f5638079c2f35f4cc03163e9443e553ac2c` |
| AI Agent Payment Gate (STELLAR-AGENT/1) | **POLICY-GATE EXECUTED** — VERIFIED / REJECTED / HELD matrix · submission stays credential-gated (never auto-pay) |
| DEX gate (DEX-GATE/1) | **REAL-BOOK EXECUTED** — five verdicts against the REAL mainnet XLM/USDC order book (issuer network-discovered · depth-derived ceiling) · 9/9 tests |
| Universal DApp Shield (guard.*) | **ARM-MODEL EXECUTED** — 2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED (Q-FW10) |
| Wallet & submit surfaces | BUILT (credential-gated): Freighter wrapper `packages/stellar/freighter.mjs` · Mainnet Executor `packages/stellar/mainnet-executor.mjs` · mainnet config `packages/stellar/mainnet.mjs` |

### Verify every Stellar claim offline · تحقق من كل ادعاء ستيلار دون اتصال

```bash
node scripts/stellar-soroban-commit-executed.mjs --verify   # anchor CALL re-derived · digest faithful · commit anchored on mainnet
node scripts/stellar-dex-swap-executed.mjs --verify         # funded swap re-derived from raw wire read-backs · digest faithful
node scripts/stellar-dex-gate-real.mjs --verify             # DEX-GATE/1 re-derived from the stored REAL mainnet book
node scripts/stellar-agent-gate-executed.mjs --verify       # STELLAR-AGENT/1 verdict matrix intact
node scripts/universal-shield-executed.mjs --verify         # shield arms intact (2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED)
```

Full Stellar deliverable catalog: [docs/PRODUCTS.md §11](docs/PRODUCTS.md) — every
deliverable with its honest network-verified status · row-by-row evidence matrix:
[docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md) · killer facts:
[docs/STELLAR-KILLER-FEATURES.md](docs/STELLAR-KILLER-FEATURES.md) · integration guides:
[docs/STELLAR-ECOSYSTEM-INTEGRATION.md](docs/STELLAR-ECOSYSTEM-INTEGRATION.md) · [docs/STELLAR-INTEGRATION-GUIDE.md](docs/STELLAR-INTEGRATION-GUIDE.md) ·
mainnet tx record: [docs/STELLAR-MAINNET-TX.md](docs/STELLAR-MAINNET-TX.md) · intent-to-execution proof:
[docs/INTENT-TO-EXECUTION-PROOF.md](docs/INTENT-TO-EXECUTION-PROOF.md) · one Trinity view with Core + Pi:
[docs/TRINITY-CORE-STELLAR-PI.md](docs/TRINITY-CORE-STELLAR-PI.md).

**Stellar honesty mirror (what is NOT claimed):** signed mainnet funded transfers
beyond the ONE owner-authorized anchor commit CALL and the ONE owner-authorized
gated swap — credential-gated owner decisions · npm SDK publication — double-gated
pending `NPM_TOKEN` · SaaS live payment — owner rails pending · revenue, customers
or partnerships — none.

**Claim taxonomy pointer:** what each honesty word means and what each proof
does NOT imply — [docs/CLAIMS-TAXONOMY.md](docs/CLAIMS-TAXONOMY.md).
The Soroban contract's **authorized lane** (identity enforced at the contract
level, additive to the deployed/1 ABI family — `commit_authorized` derives the
id in-contract from the owner + hash so a wrong value never occupies the right
id, and `owner.require_auth()` makes the write host-gated) is documented in
[soroban/commitment-anchor](soroban/commitment-anchor/README.md); the live
mainnet instance remains the deployed/1 binary — no deploy, no restatement.

### Stellar Phase 5 — live verification · التحقق الحي · verdict **LIVE-VERIFIED**

The Phase-5 live verification runner (`scripts/stellar-soroban-deploy-live-verify.mjs`) closed the owner-authorized Soroban deploy lane against Stellar mainnet: exit `0` → verdict **LIVE-VERIFIED** — `MAINNET AUTHORIZED-LANE DEPLOY LIVE-VERIFIED (create proven from its own result meta; fresh-vault readback SIMULATED_NONE; balance arithmetic exact to the stroop)`.

- create transaction proven from its own result meta — contract `CAZ3LQEMB37KICXEANKVMRNWMB5MD3O4FBC5GORB7QVUJE2WCPAHQPZB` (wasm `65da850c…c8257`) created at ledger **65408001** (latest ledger **65408223**);
- fresh-vault readback → `SIMULATED_NONE` (`decodedKind: NONE`, `submitted: false`) — read-only, no submit;
- balance arithmetic exact to the stroop — expected/live `81099724` stroops (`8.1099724` XLM) == live balance; deployer recorded balance `195069800`; create fee `178113` + upload fee `113791963`;
- deploy-only readback did not return the expected empty lane → the deploy verdict is saved **NOT_CONFIRMED** (fail-closed) in `docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json`;
- evidence digest `sha256:102959d2d42429ab1d8505a08d46c6dc55255b10ea5bc38c43077a8c0cc52c10` · run finished `2026-11-10T16:12:42Z`.

### Stellar dedicated truth table · جدول الحقيقة المخصص

Like Core's on-chain anchor table above, the Stellar lane carries its own dedicated truth table — one row per executed surface, machine-checked, honest labels only:

| # | Stellar surface | Lane fact | Honest status | Evidence |
|---|---|---|---|---|
| 1 | Mainnet wallet | `GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U` — live Horizon account · first tx `0.1 XLM → SDF` @ ledger 65,308,317 | LIVE | [docs/EVIDENCE-MATRIX.md](docs/EVIDENCE-MATRIX.md) |
| 2 | Soroban anchor (mainnet) | `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` — **MAINNET DEPLOYED** · deployment untouched, no re-deploy | MAINNET DEPLOYED | [docs/evidence/stellar-soroban-wasm-manifest-42519059778.json](docs/evidence/stellar-soroban-wasm-manifest-42519059778.json) |
| 3 | Commitment-anchor CALL (mainnet) | owner-authorized `commit(proofId, commitment)` **INVOKED** — tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec` · ledger 65,337,373 · on-chain read-back `read(proofId)` = `{hash, seq}` exact | MAINNET VERIFIED | [docs/evidence/stellar-soroban-commit-executed.json](docs/evidence/stellar-soroban-commit-executed.json) |
| 4 | First SIGNED FUNDED swap (mainnet) | owner-authorized `pathPaymentStrictSend` **CONFIRMED** — tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097` · ledger 65,338,112 (trustline ledger 65,338,111) · `4.0598146 XLM → 0.6306239 USDC` · digest `sha256:837d0639…ac2c` | CONFIRMED | [docs/evidence/stellar-dex-swap-executed.json](docs/evidence/stellar-dex-swap-executed.json) |
| 5 | AI Agent Payment Gate | STELLAR-AGENT/1 — **EXECUTED** · VERIFIED / REJECTED / HELD matrix · submission credential-gated, never auto-pay | EXECUTED | [docs/evidence/stellar-agent-gate-executed.json](docs/evidence/stellar-agent-gate-executed.json) |
| 6 | Real-book DEX gate | DEX-GATE/1 — **EXECUTED** · five verdicts vs the REAL XLM/USDC mainnet order book · issuer network-discovered · depth-derived ceiling · 9/9 tests | EXECUTED | [docs/evidence/stellar-dex-gate-executed.json](docs/evidence/stellar-dex-gate-executed.json) |
| 7 | Universal DApp Shield | `guard.*` — **EXECUTED** · 2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED (Q-FW10) | EXECUTED | [docs/evidence/universal-dapp-shield-executed.json](docs/evidence/universal-dapp-shield-executed.json) |
| 8 | Phase 5 live verify | owner-authorized Soroban deploy lane — **LIVE-VERIFIED** · fresh-vault readback `SIMULATED_NONE` · balance arithmetic exact to the stroop | LIVE-VERIFIED | [docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json](docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json) |
| 9 | Products & services shipped | `packages/stellar` (intent→policy→gate · Soroban DEX · mainnet runner · Freighter) + Stellar killer docs · honest labels only | SHIPPED | [docs/PRODUCTS.md §11](docs/PRODUCTS.md) |
| 10 | Honest mirror | signed mainnet funded transfers beyond the ONE owner-authorized anchor CALL + ONE gated swap — credential-gated owner decisions · npm double-gated · SaaS owner rails pending | HONEST | — |

### Security posture — what execution proof does (and does not) prove

CoreGuard answers one question with evidence: **did this execution conform to what was authorized?** It does not, and never claims to, answer adjacent questions. The separation is enforced by the honesty layer (`npm run claims:audit`, `npm run release:gate`), not by prose:

- **Execution proof ≠ security audit.** A VERIFIED receipt proves that a specific on-chain execution matched a pre-declared intent + policy. It does NOT prove that every Soroban transaction type is protected, that the Execution Firewall cannot be bypassed, that a wallet can integrate without additional security work, or that the protocol withstands a determined attacker. Those are separate, larger claims; each stays `UNKNOWN`/`GATED` until a named test or review closes it.
- **Permissionless vs. authorized anchor (Soroban).** The permissionless `commit(id, hash)` lane is an **open anchor** (anyone may anchor their own commitment; first-write-wins; a different hash for the same id is rejected fail-closed). It does NOT enforce owner identity at the contract level — by design, so anyone can prove their own execution. The race (a stranger pre-registering a wrong hash at a known id) is closed by the **authorized lane** `commit_authorized(owner, hash)`: the id is derived in-contract as `sha256(AUTH_DOMAIN ‖ strkey(owner) ‖ hash)`, and `owner.require_auth()` makes the write host-gated, so a stranger cannot occupy the owner's derived id. `assert_anchored_authorized` re-checks the full (id, owner, hash) triple. The two lanes are isolated storage namespaces; the deployed/1 mainnet instance keeps the permissionless ABI byte-identical (no redeploy, no restatement).
- **What a successful swap proves — and only that.** The first SIGNED funded mainnet swap (tx `ac2a7990…`, ledger 65,338,112) proves that DEX-GATE/1 preflight VERIFIED and that the owner-signed `pathPaymentStrictSend` was CONFIRMED on the real mainnet order book, with wire read-back equal to `fee_charged` to the stroop. It proves nothing about other transaction types, other wallets, or other order books.
- **Dated instruments.** Numbers in dated instruments (FINAL-REPORT, OWNER-DECISIONS, campaign kits) record what was measured on that date and are never rewritten; the single source of truth for the current suite total is `docs/state-snapshot.json#testsTotal` (enforced by `scripts/run-tests.mjs` and `test/ci/doc-numbers.test.js`). Current docs (README, STATUS, AGENTS, FINAL-REPORT-2026-11-09) all cite the same measured total.

## Quick start

```bash
# 1. Install (no framework, zero runtime deps — Node ≥ 18 + Foundry optional)
npm install

# 2. Test + benchmark
npm test              # 1958 tests (machine-pinned) — canonicalization, policy, tamper, anchor, verifier, P1/P2, provenance, pricing, encoding, attack-lab, DDE delivery/dispute suites (incl. doc-curl contract), pages-settle guard, verification-platform suite, executed-evidence contract (agent gate · real-book DEX gate · universal shield · first funded signed mainnet swap), the PSAR/1 pre-sign receipt suite (offline PASS/BLOCK demo), owner-authorized deploy battery
git config core.hooksPath .githooks   # install the Pages settle pre-push guard — every main push waits for the Pages build
npm run corpus        # deterministic 73-scenario adversarial corpus
npm run benchmark     # 73/73 pass
# Authoritative numbers live in docs/STATUS.md (one source of truth).

# 3. Runnable demos
node examples/transfer/run-demo.js    # transfer: valid → mutate → tamper → INVALID
node examples/swap/run-demo.js        # swap: slippage guard + substitution → INVALID
node examples/multistep/run-demo.js   # batch strategy: commitment binds one execution
node examples/live/live-verify.js     # verify any on-chain tx via public RPC (read-only, needs no funds)

# 4. Phase 1 — Execution Firewall + protocol SDK (plan-90d-repo §2)
npm run demo:vault                    # reference Vault ladder: deposit ALLOW → VERIFIED → anchor plan
npm run demo:attack                   # re-runs the same intent; six attacks BLOCKED + post INVALID
npm run create:integration -- my-dapp # scaffold a consumer integration (intent/policy/verifier/tests)
```

### Verification & Integration Platform (offline, no credentials)

```bash
npm run verify:levels       # L0-L4 machine: commitment, chain-confirmed receipt, replay, merkle, L4 boundary
npm run integration:states  # 13-state integration machine: doorway records + no-silent-pass verdict
npm run partner:sandbox     # 8 partner scenarios, offline mock chain (VERIFIED / MISMATCH / UNKNOWN / REJECTED)
npm run attack-lab          # 10 tamper cases — tampered → FAIL, unknown → UNKNOWN, valid → VERIFIED
npm run passport:v2         # the portable Evidence Passport (deterministic object)
npm run adapters:status     # four provider surfaces, all DRY_RUN — no live claim
npm run observability       # local event sink self-check
npm run webhook             # CG-WH/1 receiver: HMAC + replay window + idempotency
npm run x402                # X402/1 harness: no price opens a payment gate without an owner-locked quote
npm run conformance:report  # writes docs/conformance-report.json (CG-CR/1, badgeIssuers 0)
npm run quickstart          # the three-verb integration path: commit / capture / verify
```

Map and rules: [docs/verification-and-integration-platform-2026-09-26.md](docs/verification-and-integration-platform-2026-09-26.md).
Commercial tiers (prices LOCKED, revenue $0): [docs/commercial-packaging-2026-09-26.md](docs/commercial-packaging-2026-09-26.md).

### Claim ceiling, badges & the release gate (what this repo may say, and what may ship)

The four commands below are the honesty layer. They do not make the project look
better; they make it harder to describe than it is. Everything here runs offline
with no credentials and no network.

```bash
npm run claims               # CG-CL/1: 28 claims derived from committed sources, one status each
npm run claims:audit         # fails if a VERIFIED claim has no evidence, or an evidence path is missing
npm run badge:verify         # CG-BDG/1: re-derive every badge digest from its record, byte for byte
npm run badge -- --issued             # list every badge the owner has ever issued (docs/badge-issuances.json)
npm run partner:journey      # CG-PJ/1: ten integration legs over one bundle
npm run integration:replay   # CG-IR/1: replay a bundle through L0-L3, no partial credit
npm run release:gate         # CG-RG/1: 18 legs, and the gate audits its own source
npm run release:gate:independence   # the gate's self-audit alone — fast, no test run
```

Four rules that the machine enforces, not the prose:

- **`VERIFIED` requires a chain authority; `MISMATCH` requires that someone was ASKED.**
  The verdict turns on **whether anyone was asked**. No authority at all → `UNKNOWN/NO_CHAIN_EVIDENCE` (nobody was asked). An authority that does not know the `txHash` → `MISMATCH/TX_NOT_FOUND` (it was asked, and it contradicted you). A receipt too malformed to ask with → `UNKNOWN/EVIDENCE_INCONSISTENT`. Only the middle case is a contradiction; the two `UNKNOWN` cases are absent evidence, never absolution, and neither is `VERIFIED`. Identity is bound separately, because a genuine `txHash`/`blockHash` pair says nothing about which receipt it is: a receipt that names no commitment is `UNKNOWN/RECEIPT_ID_UNBOUND` and one that names a different commitment than the one presented is `MISMATCH/RECEIPT_ID_MISMATCH`, so evidence relabeled onto another receipt never verifies.
- **A clean partner journey is `MATCH`, not `VERIFIED`.** L2 is the weakest
  link, and inflating it would inflate the evidence.
- **A badge's artwork is its proof.** Hand-edit one byte and `verifyBadge()`
  fails. `issuerCount` is 0: nothing is auto-issued, and only two `NOT ISSUED`
  specimens exist, and the one recorded issuance is first-party only: the CG-CS/1 self record minted to CoreGuard itself (`DF6E20C032A8`, listed by `npm run badge -- --issued`) proving the machine end-to-end — never third-party validation, and never a badge for any counterparty. Issuance is an explicit owner decision:
  `npm run badge -- --issue --record <file> --i-am-the-owner-and-competent-to-issue`
  mints ISSUED artwork under `docs/badges/issued/` ONLY from a committed
  CG-CS/1 record whose six criteria all pass, records it in
  `docs/badge-issuances.json`, and refuses a non-conformant record outright.
- **A gate that cannot assert anything fails.** A leg that proves nothing is
  `FAIL`, never a quiet pass — a green check with no assertion behind it is
  worse than no check, because it gets trusted.

What is **not** claimed anywhere: third-party badge issuance, a named integrator, an
unlocked price, external review, a live-chain authority, or any revenue. See
[docs/badge-system-2026-09-26.md](docs/badge-system-2026-09-26.md) and §9 of
[docs/owner-decisions-and-claimable-facts-2026-09.md](docs/owner-decisions-and-claimable-facts-2026-09.md).

### Phase 1 cheat sheet (`npx coreguard demo`, `@coreguard/sdk`)

```bash
npx coreguard demo allow     # DEPOSIT 1 BTC → Vault A, recipient = mine, slippage ≤ 50bps
npx coreguard demo attack    # same intent, six attacks BLOCKED (target · recipient · amount
                             # · callback · expired · calldata) + mutated execution → INVALID
```

The `@coreguard/sdk` guard surface drives this whole ladder in three calls:

```js
import { createGuard } from "@coreguard/sdk";
const guard = createGuard();
const pre   = await guard.authorize(intent, { declaration, policy, activePolicyIds, simulation, authorityAtState, evm });
const v     = await guard.verify({ chain, intent, policy, trace });   // VERIFIED | INVALID | …
const plan  = await guard.anchor(v.receipt);                          // CGEP/1:PROOF commitment + proofId
```

`authorize` is PRE-only and fail-closed (never ALLOWs unmodeled context); `verify`
recomputes every receiptId from the payload; `anchor` is a pure offline commitment
plan. See [docs/plan-90d-repo.md](docs/plan-90d-repo.md) §2.

### CLI

```bash
node packages/cli/src/index.js analyze    --intent <...> --policy <...> --trace <...>   # on-chain or offline
node packages/cli/src/index.js verify     --receipt <...> [--intent <...> --policy <...> --trace <...>]
node packages/cli/src/index.js verify-run --receipt <...> [--evidence <...> --intent <...> --policy <...> --trace <...>] [--rpc <url>] [--json]
                                           # CGEP/1:VERIFY-RUN surface; exit 0=VERIFIED 2=INVALID 3=UNVERIFIED 4=INCONCLUSIVE
                                           # e.g. --bundle examples/transfer/verify-bundle.json
node packages/cli/src/index.js verify-provenance --manifest <...> --evidence <...> [--json]
                                           # CGEP/1:VERIFY-PROVENANCE surface (AgentProof); same exit-code discipline
node packages/cli/src/index.js report     --receipt <...>                               # human-readable receipt
node packages/cli/src/index.js demo   allow|attack     # reference Vault ladder (allow | attack)
npx create-coreguard-integration <name>                # scaffold a consumer integration project
```

`verify-run` is read-only: `--rpc` performs chainId/transaction/receipt/block
binding only — it never sends or broadcasts. See [docs/VERIFY-RUN.md](docs/VERIFY-RUN.md).

## Payment gating integration (DDE/1)

The Delivery & Dispute Evidence layer is embeddable: any agent platform, escrow
provider or settlement tooling can hold a payout until delivery evidence **and**
an explicit party acceptance say otherwise — while never letting execution proof
decide conformity. One sentence binds every report the SDK returns:

> **Execution verification does not decide delivery conformity.**

### The lock/release arc

The gate has exactly one key, and it is not a receipt:

| Act | What happens | Gate |
|---|---|---|
| pending | delivery submitted, no verdict yet | 🔒 HOLD |
| party act | client records **REJECTED** on a named criterion (e.g. C-QUALITY: 2 color tokens, 3 required) | 🔒 HOLD |
| tamper | provider re-submits after flipping one artifact byte → `422`, E3 names the byte and both hashes | 🔒 HOLD |
| **the boundary** | evidence **VERIFIED** on the wire, client's **REJECTED** verdict on file — execution and payment settlement proven, **neither decides conformity** | 🔒 HOLD |
| counterfactual | client records **ACCEPTED** on the same criteria evaluations | ✓ **RELEASE** |

The only thing that opens the gate is a party acceptance record resting on
criterion evaluations. Signatures, receipts and settlement are admissible
evidence — never a verdict.

### One-command scaffold for new projects

```bash
node scripts/create-integration.mjs my-escrow-dapp --dde   # from this repo
```

Generates a working DDE/1 payment-gate scaffold under `./my-escrow-dapp/`:
ten pinned evidence records (`dde-fixture/` + `hashes.json`), a standalone
boundary engine (`engine-dde.mjs`, zero dependencies, CI-checked against the
in-repo engine on the shipped fixture), a one-command verifier, the release
loop with both scenarios, and 5 contract tests — runnable immediately:

```bash
cd my-escrow-dapp
node verify-dde.mjs     # → VERIFIED · EXECUTION_EVIDENCE_ADMISSIBLE — CONFORMITY_UNDECIDED_BY_ENGINE
node payout-gate.mjs    # → HOLD (party REJECTED) — then swap in your ACCEPTED record to release
node --test             # 5/5 green
```

The shipped fixture is honestly labeled (`SYNTHETIC`, `realDisputeExists:
false`) and its execution record is an `OWNER-DECLARED` placeholder —
`paymentSettled: false`, a zero txHash, provably settling nothing — so nothing
in the scaffold can be mistaken for a verified execution claim.

### Scaffold from a real intake candidate instead of the static fixture

For a case you already drove through the prelude gate
(`examples/real-fixture-intake/` — secret scan, consent replay, pin
integrity), pass the gate-green candidate directory and the generator
converts it in place of the static synthetic bytes:

```bash
node scripts/create-integration.mjs my-escrow-dapp-real --dde --fixture-real <candidate-dir>

cd my-escrow-dapp-real
node verify-dde.mjs
```

The gate runs first through its own entry point — a RED gate scaffolds
nothing at all; the converter re-pins SHA-256 over the real records and
requires the committed boundary engine to verdict `VERIFIED`, or the whole
scaffold is rolled back. Origin becomes `REAL` without ever becoming an
adjudication: the payout gate keeps releasing only through party consent, not
through engine verification or payment settlement.

### Two-line SDK integration

```js
import { verifyFixture, releaseWhen } from "@coreguard/delivery/sdk";

const report = await verifyFixture({ fixtureDir: "./cases/case-17" }); // or { fixture }
const gate   = releaseWhen(report, () => acceptanceOnFile() === "ACCEPTED"); // YOUR condition
if (!gate.release) holdPayout(gate.reasons); // named reasons, never vague symbols
else releasePayout();
```

- `verifyFixture` runs the **full fail-closed gate** (F0–F3, E3–E5, B1–B3) —
  zero checks added, zero stripped. Every report carries the boundary banner
  (`boundaryCode: "DDE-BOUNDARY"`), so quoting a report quotes the boundary.
- `releaseWhen` **structurally refuses** release without a VERIFIED report,
  even if your predicate says yes; a throwing predicate is a HOLD, not a crash.
- Consent replay (E5) runs only with an EVM adapter you inject; absent →
  `NOT_RUN`, never fabricated. The SDK never signs, never broadcasts, never
  judges conformity.

**See it run in the browser** — the two live reference pages replay these
examples over the real fixture in your tab: the honest fixture → [HOLD on the
API page](https://coreguard-global.github.io/CoreGuard/DDE-API-REFERENCE.html#run=honest) and [HOLD on the SDK page](https://coreguard-global.github.io/CoreGuard/DDE-SDK-REFERENCE.html#run=verify) · the
counterfactual ACCEPTED → [RELEASE](https://coreguard-global.github.io/CoreGuard/DDE-SDK-REFERENCE.html#run=accepted) · a flipped artifact byte → [422 on the
API page](https://coreguard-global.github.io/CoreGuard/DDE-API-REFERENCE.html#run=tamper) and [REFUSED on the SDK page](https://coreguard-global.github.io/CoreGuard/DDE-SDK-REFERENCE.html#run=tamper).

(Inside this repo, import from `packages/delivery/sdk.js` — the package
specifier above is the installed surface with the same exports.)

### npm publishing (13-package closure, gated)

`@coreguard/sdk` resolves the full guard closure (canonical, crypto, policy,
trace, evidence, replay, evm, provenance, intent, verifier, firewall) and
`@coreguard/delivery` adds the DDE/1 layer — 13 packages total, all held to
the same publish bar:

```bash
npm run publish:check   # tarball contents, escaped imports, dependency truth,
                        # and INSTALL PARITY: every package is packed, installed
                        # from its tarball with its real deps, and its public
                        # specifiers are import-probed — in CI on every push
npm run release:dry     # the release plan: token gate + 13-package dependency-ordered publish list
```

Actual publishing is a manual, double-gated workflow
(`Actions → npm release (gated)`, type `RELEASE`, environment `npm-release`):
it runs `scripts/release-please.mjs`, which refuses without `NPM_TOKEN`, runs
the full publish gate, then publishes with `--provenance --access public` in
dependency order — fail-fast, nothing half-published. Every push CI-rechecks
the gate, so the registry-bound surface can never silently rot.

### Or verify over HTTP

```bash
# from a repo checkout — loopback by default; a public bind is a deliberate act
node -e "import('./packages/delivery/http.js').then(m => m.startDeliveryEndpoint({ port: 8787 }))"

# from an installed package: import { startDeliveryEndpoint } from "@coreguard/delivery/http";
curl -sS -X POST http://127.0.0.1:8787/verify \
  -H "content-type: application/json" --data-binary @fixture.json
# → 200 VERIFIED (decision: EXECUTION_EVIDENCE_ADMISSIBLE — CONFORMITY_UNDECIDED_BY_ENGINE)
#   or 422 FIXTURE_REJECTED with the failing check named
```

Per-address rate limiting (429 + `retry-after`, `/health` exempt), a pre-parse
1 MiB size gate, and a decision vocabulary that never exceeds
`EXECUTION_EVIDENCE_ADMISSIBLE — CONFORMITY_UNDECIDED_BY_ENGINE` /
`FIXTURE_REJECTED` — no network path can decide conformity. Full status-code
table and wire honesty rules: [docs/delivery-dispute-boundary.md](docs/delivery-dispute-boundary.md) §6.

### Run the worked example

```bash
node examples/agent-platform-integration/run-integration-demo.mjs  # SDK arc — 4 holds, 1 release (exit contract)
node examples/agent-platform-integration/run-http-payout-gate.mjs  # wire-level — 9 scenarios incl. mutual acceptance, a later dispute freezing the payout, and a procedure-closed record
npm run benchmark:dde                                              # verify perf: median < 50ms budget (measured ~0.7ms)
```

Both demos exit `0` only on the exact arc: HOLD ×4 → RELEASE ×1 (SDK) and the
nine-wire arc — escrow stays HELD through acceptance disputes, an unproven
closure claim (422), and only RELEASES once `closedAtUtc` establishes the
record is closed — any drift from the boundary fails them, and CI runs both on
every push. Fixture and
records: [examples/delivery-fixture/](examples/delivery-fixture/) · live
bilingual demo: [DELIVERY-DISPUTE-DEMO.html](https://coreguard-global.github.io/CoreGuard/DELIVERY-DISPUTE-DEMO.html) ·
HTTP endpoint reference with an **in-page live engine**: [DDE-API-REFERENCE.html](https://coreguard-global.github.io/CoreGuard/DDE-API-REFERENCE.html)
(all six wire codes captured from the real DDE/1 handler running in the browser tab) ·
SDK reference with `verifyFixture` + `releaseWhen` **running live in-page**: [DDE-SDK-REFERENCE.html](https://coreguard-global.github.io/CoreGuard/DDE-SDK-REFERENCE.html)
(the honest gate arc — HOLD, RELEASE, structural REFUSED — captured from the real SDK over the real fixture) ·
one-page shareable integration summary (drop-in for discussions and social posts):
[INTEGRATION.md](https://github.com/coreguard-global/CoreGuard/blob/main/INTEGRATION.md)
— its every runnable fence executes in CI against the real endpoint.

Got a **real** paid transaction with two consenting parties? The
[real-fixture intake kit](examples/real-fixture-intake/) converts it into a
redacted review-ready fixture: bilateral consent with a named disclosure
scope, a removal checklist, a fail-closed pre-publication gate, and
`convert-to-fixture.mjs` — one command from a gate-green candidate to the
ten records with re-pinned hashes and an engine-verified verdict
(exit 0 ready · 1 gate red/rejected · 2 usage) — with a `--out-zip` mode
producing a byte-deterministic, audit-manifested archive ready to attach
to a GitHub discussion comment. The whole path is CI-exercised on every
push (candidate build → gate → both conversion modes → unzip → engine on
the extraction → red-path refusal), so the route a real case will travel
is watched continuously, not trusted from unit tests alone. Reviewers
get a one-page path through any converted fixture:
[REVIEW-GUIDE.md](REVIEW-GUIDE.md) — pin integrity, engine gate, tamper
probe, conformity records, and the intake projection in under 10 minutes.

## AgentProof — actor provenance

**Who is actually behind this execution?** AgentProof extends the receipt with a
two-part answer that is *declared, never inferred*:

- **executorType** (CGEP/1 §4 taxonomy): `HUMAN` · `AI_AGENT` · `BOT` ·
  `AUTOMATION` · `ORGANIZATION` · `MULTISIG` · `CUSTODIAN` ·
  `SMART_CONTRACT` · `PROTOCOL` · `UNKNOWN`
- **cryptographic authority**: an EIP-712-signed REGISTRATION (identity root)
  + per-execution STAMP manifest, replay-verified against the actual `tx.from`
  (direct or via signed delegation chain), anchored to the EvidenceRegistry.

A human is **never** shown as proven from behavior — human-ness renders
`DECLARED` or `ATTESTED` at most (personality is never guessed). Badge states
come from the open verifier only, so every badge is reproducible by `npm run
verify-provenance`. Phase A = EOA signer binding; smart-contract/multisig
authorization needs EIP-1271 (Phase B). Spec: [spec/CGEP-1-AGENT-PROVENANCE.md](spec/CGEP-1-AGENT-PROVENANCE.md).

```bash
npm run verify-provenance -- --manifest examples/provenance/manifest.json --evidence examples/provenance/evidence.json
# exit code: 0=verified · 1=cli/input error · 2=invalid · 3=not proven/unverified · 4=inconclusive
```

## Who ran this? — the moment, and why now

Autonomous actors now move value: AI agents, keeper bots, trading robots,
treasury daemons and company-controlled multisigs. The fastest-growing question
in that world has no verifiable answer today — **not "is this transaction
risky?", but "who declared responsibility for this exact execution, under what
authority, and can anyone prove it afterward?"** CoreGuard is the execution-
provenance + cryptographic-authority layer for that question, and AgentProof
answers *who* as a **declared, signer-bound** fact (never a behavioral guess).

> The honest positioning line, safe to repeat: **CoreGuard verifies declared
> execution provenance and cryptographic authority for a specific execution.**
> It is not an agent-identity registry, not a trust-score system, not an
> "AI detector". See `spec/agent-provenance-prior-art.md` (Gate G-1).

### The moment around us (dated, sourced)

2026 made agent trust a crowded field — but from *other* layers: **x401**
(Proof, 2026-06-25) authorizes actions at request time (who authorized + scope);
**World ID + Coinbase AgentKit** (2026-03) anchors agents to biometric-verified
humans with x402 payments; **Self Protocol** (2026-04) binds human↔agent in zk
on ERC-8004; **Arkose Agent Trust Manager** (2026-06-16) classifies agent
traffic behaviorally. **Post-execution on-chain provenance — "did the
transaction match the declared authority, re-derivable by anyone" — is the
layer none of them ship.** That is the CoreGuard layer. The dated matrix and
the overtake roadmap live in
[docs/competitive-intelligence-overtake-2026-09-20.md](docs/competitive-intelligence-overtake-2026-09-20.md).

**The moment arrived at consumer scale — ChatGPT Wallet (OpenAI, 2026-11-13,
built with American Express, Mastercard, Visa).** Agent-initiated payments are
now real: agents pay with tokenized credentials, every purchase needs a user
approval + security check, and the announcement itself names *pre-approved
delegation within set parameters (spending limits, categories, time periods)*
as future work. Tokenization protects card data — it does not bind the
executed order to the approved order bytes, and an approval record held only
by the issuing platform is a record, not independent evidence. That binding is
what CoreGuard commits today, offline: the approval-binding arc
(`examples/agent-commerce-approval-binding/run-demo.js` — APPROVE → EXECUTE
exact → VERIFIED · total drift → INVALID with the field named · merchant swap →
INVALID · record tamper → INVALID, zero keys, zero network, synthetic orders),
with the full dated mapping in
[docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md](docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md).
No contact, integration or endorsement is claimed with OpenAI or any named
provider — this is the layer the flow needs, demonstrated on committed
machinery.

## Built for Core

CoreGuard is built for Core's stack — the native programmable layer for
Bitcoin — and is already proven live there (chainId 1116; anchor verdict
VERIFIED ANCHOR INTEGRITY; independent cross-RPC readback). The product surface
[DApp](docs/coreguard-dapp-core.html) carries **Core's visual identity (gold)
alongside CoreGuard's own (deep green)**: consistent with the ecosystem, never
a rebrand — every party keeps its own color and fingerprint.

Aligned Core programs are tracked as **public, dated, planning-only facts**
(never eligibility claims): Core Connect Global Buildathon (AI + Web3 infra
categories), Core Commit Program (business-model / PMF criteria), and Core
Ignition Builders' Incentive. Details + the criteria pre-mapping live in
[docs/adoption/](docs/adoption/), and the honest "how CoreGuard drives CORE
usage/scarcity + where it sits in Core's 2026 roadmap" mapping is in
[docs/adoption/coreguard-core-value.md](docs/adoption/coreguard-core-value.md).

## Plans and pricing (hypothesis — gate-locked)

The product shows a three-tier structure — **Starter (free, 10/week)** →
**Pro** → **Enterprise / Core team** — and the on-chain commission side is real:
`EvidenceRegistryV3` charges a **flat, explicit `feeWei`** paid atomically with
the anchor (any mismatch reverts), routed to an operator-only treasury, with
`feeWei = 0` degenerating to the free path.

**No committed pricing.** Per standing governance, pricing stays locked until
the Decision Gate opens (after Counterparty #1). The machine view stamps
`gated: true` on every output and never bills. See [docs/pricing.md](docs/pricing.md)
for the **proposed — not published** model: five tiers from a free integration
tier sized for CI (10,000 verified receipts/month) to enterprise, with a stated
per-verification price and overage above each included volume. Those figures are
a proposal to argue with, not an offer, and nothing in this repository meters or
charges.

## On-chain

| Network | Chain ID | RPC |
|---|---|---|
| Core **Testnet2** | 1114 | `https://rpc.test2.btcs.network` |
| Core Mainnet | 1116 | `https://rpc.coredao.org` |
| **Stellar Mainnet** (Soroban) | Soroban — no EVM chainId (Horizon network) | `https://horizon.stellar.org` |

```bash
forge build                                   # 0.1 evidence registry (clean)
powershell -File scripts/anchor-local.ps1      # or: bash scripts/anchor-local.sh
                                              # local anvil fork anchor → scripts/anchor-proof.json
npm run anchor:plan                           # → scripts/live-anchor-planned.json (offline proofId plan)
npm run anchor:verify                         # → scripts/verify-live.regenerated.json (frozen bundle stays)
```

## Repository layout

```
spec/        CGEP/1 (draft) · master spec · canonical encoding · receipt · levels ·
             threat model · privacy model · competitive kill matrix · killer memos
packages/    canonical · intent · policy · trace · evidence · firewall · verifier · evm · sdk · cli · delivery · provenance · pricing · stellar (Soroban lane: dex-gating · soroban-dex · freighter · mainnet-executor)   (ESM)
             — sdk/guard.js = guard.authorize/verify/anchor Phase-1 surface
             — provenance = Actor Identity Card + AgentProof surfaces (declared, never detected)
             — pricing = hypothesis plan table, Decision-Gate-locked (no enforcement, never bills)
             — delivery = DDE/1 execution/acceptance boundary (engine + SDK + HTTP endpoint, zero-dep)
             — peoples-court-adapter = ADAL/1 → uploaded-surface dry-run mapper (offline, credential-free)
contracts/   EvidenceRegistry.sol — commitment registry (deployable, `--legacy`)
benchmarks/  generator + 73-scenario corpus: valid/invalid/mutations/tamper/performance
test/        canonicalization · policy · tamper suites + adversarial runner + P1 suites
             · firewall/ (engine + ws1) · firewall/attack-lab · sdk (verifyBinding + guard)
examples/    transfer · swap · multistep · live · vault (Phase-1 reference ladder) (runnable, with READMEs + artifacts)
             delivery-fixture/ — DDE/1 bilateral dispute fixture (synthetic, replayable: node examples/delivery-fixture/verify-fixture.mjs)
             agent-platform-integration/ — payout gated on DDE: SDK arc + wire-level gate with a criteria-based scenario rejection (runnable)
             real-fixture-intake/ — real-case intake: consent + signed disclosure scope → removal gate → convert-to-fixture.mjs → review-ready REAL fixture
             reference-tribunal/ — local synthetic adjudicator + mock escrow (fail-closed settlement semantics; NOT People's Court)
             — external integration path (three tiers): delivery-fixture = schema proof · agent-platform-integration = embed the gate · real-fixture-intake = go real
templates/   integration/ — consumer scaffold for create-coreguard-integration
scripts/     anchor-local.ps1/.sh — local fork anchor proof ·
             compute-commitment — offline commitment plan ·
             verify-anchor — three-proofs anchor checker
docs/        deployment · funding · contributing · security · delivery-dispute-boundary.md (DDE/1) · pricing.md
             evidence-package-standard.md (EVP/1) · dispute-package-standard.md (ADAL/1)
             article-missing-verification-layer-agentic-disputes.md + publish-ready X/LinkedIn drafts
             integration-surface-map-2026-09.md (Phase C) · funding-roadmap-2026.md (Phase D)
             revenue-path-2026-09.md (Phase E) · ip-workstream-2026-09.md (Phase F)
             DELIVERY-DISPUTE-DEMO.html — live bilingual DDE demo
             DDE-API-REFERENCE.html — live HTTP endpoint reference (engine runs in-page)
             INTEGRATION.md (repo root) — one-page shareable integration summary (CI-executed fences)
             coreguard-dapp-core.html — Core-branded DApp surface (identity · plans · treasury · on-Core)
docs/adoption/  WS-5 — adoption & institutional proof (demand/evidence layer)
submission/  Investor / Core Submission Pack (15 items) — run `npm run demo:90s`
```

## Roadmap

| Milestone | Status |
|---|---|
| **v0.1 — Evidence protocol** (intent → trace → evidence → receipt → verifier → anchor) | 🔬 Testnet2 campaign PREPARED / FUNDING-BLOCKED (engine 73/73 PASS, live Mainnet anchor below) |
| **v0.1 — On-chain anchor on Core** | ✅ live on Mainnet `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E` (VERIFIED ANCHOR INTEGRITY) · V2 `0x6626…13fd` + Gate 4.1 intent commit recorded — [STATUS.md](docs/STATUS.md) |
| **v0.1 — Soroban commitment anchor on Stellar** | ✅ **MAINNET DEPLOYED** `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` (deployment untouched · creator = the CoreGuard wallet, first tx `0.1 XLM → SDF` ledger 65,308,317) + first `commit(proofId, commitment)` call **INVOKED** (owner-authorized · tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec` · ledger 65,337,373 · on-chain read-back exact) — `docs/evidence/stellar-soroban-commit-executed.json` |
| **v0.2 — Stellar gate surfaces executed** (Agent Payment Gate · DEX gate · Universal Shield) | ✅ three EXECUTED surfaces with digest-checked artifacts: **STELLAR-AGENT/1** policy gate (VERIFIED / REJECTED / HELD matrix · submission credential-gated, never auto-pay) · **DEX-GATE/1** — five verdicts against the REAL XLM/USDC mainnet order book (issuer network-discovered, depth-derived ceiling) · **universal DApp-shield arms** (2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED) — `docs/evidence/stellar-agent-gate-executed.json` · `docs/evidence/stellar-dex-gate-executed.json` · `docs/evidence/universal-dapp-shield-executed.json` (each re-derivable offline — see the Stellar mainnet section) |
| **v0.2 — First signed funded mainnet swap (Stellar)** | ✅ **CONFIRMED** — DEX-GATE/1 preflight VERIFIED (both gates) → owner-authorized `pathPaymentStrictSend` on the real mainnet order book: swap tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097` · ledger **65,338,112** (trustline tx `09243337fd04d7ead8e369a8a5d5ef48648179db84608b262d5379f34fa72d76` · ledger 65,338,111) · `4.0598146 XLM → 0.6306239 USDC` (0.1553331 USDC/XLM) · destMin `0.6011661` cleared · wire read-backs equal `fee_charged` to the stroop · evidence digest `sha256:837d063903f4905ececb6f051d9b2f5638079c2f35f4cc03163e9443e553ac2c` — `docs/evidence/stellar-dex-swap-executed.json` |
| **Stellar products & services** (shipped surfaces) | ✅ `packages/stellar` — intent→policy→gate engine (`index.mjs`) · Soroban DEX gating (`dex-gating.mjs`, `soroban-dex.mjs`) · mainnet runner (`mainnet.mjs`, `mainnet-executor.mjs`, credential-gated) · Freighter wallet wrapper (`freighter.mjs`, credential-gated) · Stellar killer-facts + guides: [docs/STELLAR-KILLER-FEATURES.md](docs/STELLAR-KILLER-FEATURES.md) · [docs/STELLAR-ECOSYSTEM-INTEGRATION.md](docs/STELLAR-ECOSYSTEM-INTEGRATION.md) · [docs/STELLAR-INTEGRATION-GUIDE.md](docs/STELLAR-INTEGRATION-GUIDE.md) · [docs/STELLAR-MAINNET-TX.md](docs/STELLAR-MAINNET-TX.md) · [docs/INTENT-TO-EXECUTION-PROOF.md](docs/INTENT-TO-EXECUTION-PROOF.md) · [docs/GRANT-APPLICATION-STELLAR.md](docs/GRANT-APPLICATION-STELLAR.md) · Phase-3 plan [docs/STELLAR-PHASE3-2026-10.md](docs/STELLAR-PHASE3-2026-10.md) · [docs/STELLAR-PHASE3-2026-10-ar-2026-10.md](docs/STELLAR-PHASE3-2026-10-ar-2026-10.md) · one Trinity view with Core + Pi [docs/TRINITY-CORE-STELLAR-PI.md](docs/TRINITY-CORE-STELLAR-PI.md) — honest labels only: signed mainnet sweeps stay credential-gated, SaaS live payment awaits owner rails |
| **v0.2 — Soroban authorized lane** (owner-gated `commit_authorized`, additive to the deployed/1 ABI family) | ✅ contract-level identity enforced in-contract (`commit_authorized` derives the id from the owner + hash so a wrong value never occupies the right id; `owner.require_auth()` makes the write host-gated) · JS runners: rehearsal + live-verify (fee solvency pre-send · artifact self-decode · binding hoist) · live mainnet instance remains the deployed/1 binary — no deploy, no restatement · `soroban/commitment-anchor` · `scripts/stellar-soroban-authorized-deploy.mjs` · `scripts/stellar-soroban-deploy-live-verify.mjs` |
| **v0.2 — Soroban authorized-lane Phase 5 live verify** | ✅ **LIVE-VERIFIED** (owner-authorized) — create ledger **65408001** (latest 65408223) · contract `CAZ3LQEMB37KICXEANKVMRNWMB5MD3O4FBC5GORB7QVUJE2WCPAHQPZB` (wasm `65da850c…c8257`) · fresh-vault readback `SIMULATED_NONE` · balance arithmetic exact to the stroop (`81099724` stroops) · deploy verdict saved **NOT_CONFIRMED** (fail-closed) · evidence digest `sha256:102959d2…52c10` — `docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json` |
| **v0.2 — Soroban authorized-lane Phase 3 (first attempt, captured fail-closed)** | ✅ upload `txInsufficientBalance` self-decoded from its own bytes · redeployed cleanly via Phase-5 runner · `docs/evidence/stellar-soroban-deploy-first-attempt-rejected-2026-11-10.json` · `docs/evidence/stellar-soroban-authorized-deploy.json` |
| **v0.2 — Stellar agent-gate signed-envelope lane (AGENT-GATE/1, Nov 10–12 2026)** | ✅/🔬 **BUILT · TEST_EXECUTED · integration NOT_BUILT** (per `docs/surface-status.json`): three-axis status unification; `AGENT-XDR/1` build/decode; Freighter adapter contract; verifier CLI (0/2/3/4) + in-process bench; authorized-intent ↔ signed-envelope field binding; real testnet signature carried through the lane (`docs/evidence/agent-gate-testnet-signature.json`); runnable browser demo (`examples/agent-gate-browser/`); Freighter extension-signature attestation/promotion path (`scripts/agent-gate-freighter-attest.mjs`, evidence written only after server-verified Ed25519 by declared key). No real extension has signed in CI; no external adopter/audit. |
| **v0.2 — PSAR/1 pre-sign authorization receipts (Stellar/Freighter, Nov 12 2026)** | ✅/🔬 **BUILT · TEST_EXECUTED · integration NOT_BUILT**: receipt bound to exact XDR bytes (sha256 + Ed25519, pinned issuer, injected clock), fail-closed `PASS`/`BLOCK`, 11 frozen reject codes, `executionProof: NOT_INCLUDED`, offline demo `npm run stellar:presign`, security self-review, proposal for Freighter, 90s demo video (visual replay of captured clean-clone output), scoped technical-evaluation comment **posted** on `stellar/freighter#3087` (no endorsement/merge/adoption). No wallet embeds it. |
| **v0.2 — Stellar DEX integration example** | ✅ **TESTNET/OFFLINE VERIFIED (example)**: Soroban swap calls gated by DEX-GATE/1 and DDE/1 fail-closed escrow — `examples/stellar-dex-integration/` |
| **v0.2 — Execution Firewall** (simulation-gated smart accounts, intent-based authorization) | ✅ Phase 1 delivered: engine (`packages/firewall`, attack-lab) + `@coreguard/sdk` guard.* + reference Vault ladder (`npx coreguard demo allow|attack`) + `coreguard-verify` CI action (plan-90d-repo §2) |
| **v0.2 — Core DAO evidence-registry proofs (chain 1116, Nov 11 2026)** | ✅ **SHIPPED / CI-measured**: Foundry invariant + fuzz proofs over the Evidence Registry, deterministic seed/config (`foundry.toml`), invariants run as the test contract's own actions, CI step `forge test --match-path "test/contract/*invariant*"` — **43/43 Foundry tests pass** (per `forge`/STATUS) |
| **v0.3 — Passport / reputation + risk findings** | ✅ first-pass shipped (2026-09-25): integration state machine + unified states · CoreGuard Conformance Suite (CG-CS/1) · **Evidence Passport** machine-readable registry · **Reputation (CG-RP/1) + risk-findings (CG-RF/1)** as enforced deterministic code (`npm run ladder:status` / `ladder:passport` / `ladder:dashboard` / `ladder:findings` / `ladder:reputation` — scratch `docs/live-integration-and-adoption-ladder-2026-09-25.md`); reputation = recorded external milestones only (never an amount); findings are risk findings only, never a fuzzy safety score |
| **v0.3.1 — Verification & Integration Platform** | ✅ shipped (2026-09-26, continuous build): L0–L4 machine (`verify:levels` — L1 now needs a chain confirmation, structure alone is UNKNOWN) · 13-state integration machine (`integration:states`) · six-method **adapter contract** with DRY_RUN honesty (`adapters:status`) · **Partner Sandbox** 8 offline scenarios (`partner:sandbox`) · **Attack Lab** 10 tamper cases (`attack-lab`) · **Evidence Passport v2** (`passport:v2`) · dashboard **Control Plane** (derived only, `$0`/0/0 stay visible); map: `docs/verification-and-integration-platform-2026-09-26.md` |
| **v0.3.2 — Commercial surfaces** | ✅ shipped (2026-09-26): the two roadmap rows that were prose-only are now real code — **CG-WH/1** webhook receiver (`npm run webhook`: domain-separated HMAC over exact bytes, replay window that rejects stale AND future-dated deliveries, mandatory Idempotency-Key whose replay never re-runs the handler; no keyless mode, DRY_RUN never performs) · **X402/1** harness (`npm run x402`: canonical 402 challenge, and no price — none, zero, or unlocked — opens a payment gate; `settle()` books $0) · **CG-CR/1** machine-readable conformance report with `badgeIssuers: 0` (`conformance:report`) · three-verb **quickstart** (`quickstart`) · five-tier **commercial packaging** with prices LOCKED and a build-failing test that checks every cited path and any `$` amount (`docs/commercial-packaging-2026-09-26.md`) |
| **v0.4 — ZK privacy proofs (L4)** | 🔬 research |
| **Pi Network (cross-network)** | **PREPARED / DRY_RUN / PLAN_ONLY** — execution-truth layer and killer-feature plan prepared for Pi mainnet; no Pi mainnet TX/anchor verified, no live integration/customer/revenue claimed in this cycle — [PI-KILLER-FEATURES.md](docs/PI-KILLER-FEATURES.md) |

**Stellar honesty mirror (what is NOT claimed):** signed mainnet funded transfers
beyond the ONE owner-authorized anchor commit CALL and the ONE owner-authorized
gated swap — credential-gated owner decisions · npm SDK publication — double-gated
pending `NPM_TOKEN` · SaaS live payment — owner rails pending · revenue, customers
or partnerships — none.

## Work with us

CoreGuard is looking for funding and builders — milestone-based, Core-native,
auditor-honest. Details: [docs/FUNDING.md](docs/FUNDING.md).

Evaluating us? Start with the [Core Submission Pack (15 items)](submission/) —
`npm install && npm run demo:90s` reproduces the Mainnet-verified demo in seconds.

## License

MIT — see [LICENSE](LICENSE). Protocol spec `CGEP/1` is a draft for open discussion, not a claim of standard.