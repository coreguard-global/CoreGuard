# CoreGuard — Evidence-first Outreach & Messaging Pack (honest, customizable)

Use/adapt these drafts as-is in tone and claims discipline. **Do not** add guarantees of funding, partnerships, integration, adoption, revenue, passive income, rewards, or “trending”. Replace bracketed fields.

---
## A) OpenAI ecosystem / agent-commerce builders (MCP & verification angle)
**Subject:** Independent, verifiable approval↔execution receipts for agent purchases (open-source, reproducible)

Hi [Name/Team],

I’m sharing CoreGuard, an open-source, evidence-first verification layer for agent-initiated commerce. It focuses on a specific problem: binding **what a user approved** (merchant/recipient, items, amounts/fees/tax, time window) to **what executed**, with deterministic, fail-closed checks and independently re-derivable receipts/artifacts.

What’s runnable today (offline, synthetic demos, CI-pinned): an Agent Authorization Firewall (AC-FW/1), verifiable consent receipts (CGCR/1), a named drift/risk engine (AGR/1 + CLI), and SDK/MCP (stdio JSON-RPC 2.0)/REST surfaces — measured at **1761/1761 tests, 1244 files/0 violations, docs-node 133/81/30, CI green** (`main`). Demos: `examples/agent-commerce-security-suite/`, `firewall/`, `attestation/`.

Boundaries (explicit): this is **not** positioned as a required component of ChatGPT Wallet, does not claim interception of real wallet/card flows, and `VERIFIED ≠ SAFE`. It’s an independent verification layer meant to complement existing checkout/payment flows.

If useful, I’d welcome a technical conversation or a small scoped pilot to evaluate fit (one flow → re-verifiable evidence bundle). I can share a concrete pilot plan and reproducible steps.

Best,  
[Name] · CoreGuard (https://github.com/coreguard-global/CoreGuard)

---
## B) Stellar / Soroban ecosystem
**Subject:** Reproducible approval↔execution attestation primitives for Soroban/agent flows (offline prep + evidence)

Hi [Name/Team],

CoreGuard provides offline, deterministic verification primitives for binding approved intent to executed actions (consent receipts, firewall, named drift classes, attestations). On the Soroban path we provide **offline consent-binding preparation (CGXA-SOROBAN/1)** that derives/assembles `commit_authorized` payloads (no broadcast). Existing repo surfaces also include committed chain-related machinery documented with their real statuses.

Current evidence: **1761/1761 tests, 1244 files/0 violations, docs-node 133/81/30, CI green**; runnable synthetic demos and machine-pinned measurements. On-chain broadcasts/integration work remain owner-gated or not built as documented.

Would you be open to a scoped technical pilot/design discussion (e.g. one flow on testnet/staging with a re-verifiable evidence bundle) aligned to clear milestones?

Best,  
[Name] · CoreGuard

---
## C) Core DAO ecosystem
**Subject:** Evidence-backed execution authorization/verification surfaces (agent commerce) — pilot/milestone discussion

Hi [Name/Team],

CoreGuard ships deterministic, fail-closed approval↔execution verification surfaces (firewall, consent receipts, risk classes, SDK/MCP/REST, attestations) with reproducible demos and CI-pinned measurements (**1761/1761 tests, 1244 files/0 violations, CI green**). Where chain-specific facts exist in-repo they are stated with their verified status; new on-chain actions remain owner-gated.

I’m exploring a scoped pilot or milestone-based collaboration focused on verifiable artifacts (one flow, measurable criteria, publishable results). Happy to share a pilot plan and run through the evidence flow.

Best,  
[Name] · CoreGuard

---
## D) Generic partner (wallet / commerce platform / agent builder)
**Subject:** Verifiable “approved vs executed” evidence for agent-initiated actions (scoped pilot?)

Hi [Name],

We’ve built CoreGuard to produce independently verifiable evidence that an executed action matched the approved intent (exact bytes/policy/window), with fail-closed, named refusals on drift. It’s open-source, deterministic, and runnable offline on synthetic fixtures today (**1761/1761 tests, 1244 files/0 violations, CI green**).

We’re **not** claiming production guarantees or replacing existing fraud/custody systems — the aim is a complementary verification/receipt layer. If there’s a relevant flow, we can propose a **2-week, single-flow pilot** with clear success metrics and a re-verifiable evidence bundle (or a written no-go with numbers).

Would a short technical chat be useful?

Best,  
[Name] · CoreGuard

---
## E) Grant / accelerator (milestone & evidence framing)
**Problem:** post-approval drift in agent-initiated transactions lacks portable, independently verifiable evidence.  
**What exists (evidence):** built/tested offline surfaces (AC-FW/1, CGCR/1, AGR/1+CLI, SDK/MCP/REST, CGXA/1, AC-CS/1 same-host) with reproducible demos and CI-pinned metrics (1761/1761, 1244/0, docs-node 133/81/30, CI green).  
**Gap/risk:** no live external integration/adoption yet; on-chain broadcast and publication steps owner-gated; no revenue/customers.  
**Ask:** milestone-based support tied to verifiable deliverables (e.g. partner pilot bundle, integration hardening, documented testnet flow).  
**Non-claims:** no guaranteed adoption, revenue, or production safety outcomes.

---
## F) Short “evidence-first” reply template (community/technical)
> Thanks for the [review/question]. On the current green `main` (CI-pinned: 1761/1761 tests, 1244 files/0 violations, docs-node 133/81/30), [state what is demonstrated/reproducible]. [State the specific gap/unsupported case explicitly, if any]. This strengthens technical credibility but does not by itself imply funding, partnership, integration, adoption, or production guarantees — those depend on independent validation and external uptake. If helpful, next concrete step: [repro command / artifact / scoped test].
