# Agentic Commerce Weekly Opportunities — Week 2026-11-09 → 2026-11-15 (dated instrument)

**Date:** 2026-11-15 · **Cadence:** weekly · **Prepared for:** the owner. **Scope:** public, dated facts about the agentic-commerce shift, each mapped to one concrete CoreGuard action. No contact, integration or endorsement exists with any named party; every action below the line is OWNER-GATED unless it is pure repo work. Revenue **$0**, funding **$0** (one SCF application under review — the repo's only publishable external fact).

## 1. This week's facts (all public, all dated)

| # | Date | Fact | Source class |
|---|---|---|---|
| F1 | 2026-11-10 | "Businesses in ChatGPT" beta opened; Business Hub lets merchants claim listings and upload product feeds | OpenAI announcement (reported 2026-11-10) |
| F2 | 2026-11-13 | **ChatGPT Wallet launched**: agents pay with network payment tokens (built with American Express, Mastercard, Visa); user approves each purchase with a security check (Face ID / fingerprint examples); the approval "creates a clear record of the purchase the user authorized"; rollout via dots for eligible US ChatGPT Pro subscribers (18+, eligible US-issued cards) | OpenAI announcement (2026-11-13) |
| F3 | 2026-11-13 | Fraud-prevention partners named: Forter, Riskified, Sardine, Signifyd; PSPs named: Adyen, Checkout.com, Stripe | OpenAI announcement (2026-11-13) |
| F4 | 2026-11-13 | OpenAI's published caveat: correctly tokenized, user-approved purchases can still be flagged by risk systems, "leading to declines or cancellations"; merchants asked to work with payment/risk providers | OpenAI announcement (2026-11-13) |
| F5 | 2026-11-13 | Site access via **Web Bot Auth** (signed agent traffic); optional plugins and **WebMCP** tools; Commerce Partner Playbook published (developers.openai.com/commerce) | OpenAI announcement (2026-11-13) |
| F6 | 2026-11-13 | No delegated purchases at launch; OpenAI expects future delegation within spending limits, categories, time periods | OpenAI announcement (2026-11-13) |
| F7 | 2026 (running) | ACP (OpenAI+Stripe) beta — latest stable spec 2026-04-17 (carts, orders, delegated 3DS2, MCP transport binding); maintainers OpenAI, Stripe, Meta | ACP repo/docs (checked 2026-11-02) |
| F8 | 2026-08-25 | UCP (Google + Shopify) latest release; powers checkout in Google AI surfaces | UCP release notes (checked 2026-11-02) |
| F9 | 2026 (running) | AP2 (Google's payment-authorization protocol) moved under the FIDO Alliance | FIDO Alliance (checked 2026-11-02) |
| F10 | 2026 (running) | WebMCP is a W3C community-group draft with origin trials in Chrome 149 and Edge 150; WebKit opposes, Mozilla neutral; the HTML-form variant was removed (Oct 2026), leaving the JS API | W3C CG + browser docs (checked 2026-11-10) |
| F11 | 2026-04 | HUMAN Security measured agentic traffic growth of 7,851% in 2025 and reports legitimate and malicious automation looking "almost identical" | HUMAN Security report (April 2026) |
| F12 | 2026-08 | Forrester advised against betting on a single protocol; keep discovery, commerce, identity, execution and settlement separable | Forrester note (August 2026) |
| F13 | 2026-11-20 | **Owner deadline:** Stellar Community Fund #46 RFP-2 — Build form Part A/B due 2026-11-20 9:00 AM PT (application submitted, under review) | repo instrument `docs/agent-commerce-funding-and-partnerships-2026-11-14.md` |

## 2. Opportunity → action map (one row each, owner decides)

| # | Opportunity (from the facts) | CoreGuard's concrete action | Status / gate |
|---|---|---|---|
| O1 | F2/F4 — the decline problem: approved-then-drifted orders are invisible to risk triage | Position the AGR/1 named-drift evidence as an ADJUNCT input for decline triage (M2–M6 drafts) | repo work DONE (battery + taxonomy committed); sends OWNER-GATED |
| O2 | F2 — the approval record is central but not independently re-derivable | CGCR/1 makes the approval↔execution binding re-derivable offline — the technical-review offer (M1) | repo work DONE; sends OWNER-GATED |
| O3 | F6 — delegated limits are the declared future | Policy evaluation over value limits / recipient-recipient allowlists / expiry windows already runs against the EXECUTED order; keep the spec §10 mechanism list current | repo work DONE (spec §10) |
| O4 | F5 — MCP/WebMCP tools invited | Ship the committed stdio MCP server + REST as the reviewable artifact; npm/MCP publication decision | publication OWNER-GATED |
| O5 | F3 — fraud/PSP partners named | The four fraud + three PSP drafts are personalized to each party's published role | drafts DONE; sends OWNER-GATED |
| O6 | F7/F8/F9 — three commerce protocols in flight, none claims authorization↔execution evidence | CoreGuard is protocol-adjacent by design (provider-independent, works with existing checkout pages); do NOT bind the pitch to one protocol | positioning DONE (outreach dossier §1) |
| O7 | F10 — WebMCP execution moves into the page | Contribute the "bind the page-declared action to the approval as re-derivable evidence" pattern as public feedback | draft M18 ready; posting OWNER-GATED |
| O8 | F11 — legitimate vs malicious automation look identical | Independent re-derivable evidence is a discriminant between the two classes; cite as the standing argument (never a fraud-score claim) | argument DONE (dossier §2) |
| O9 | F12 — separable layers win | Keep CoreGuard as the evidence layer (Authorization/Enforcement/Evidence/Interoperability) — matches the Forrester shape | positioning DONE |
| O10 | F13 — SCF #46 deadline | **Owner action before 2026-11-20 9:00 AM PT:** Build form Part A/B | OWNER ACTION REQUIRED |

## 3. What changed in the repo this week (measured, committed)

- The five-product Agent Commerce Security family (all five BUILT · TEST_EXECUTED offline; product 5 = the CGXA/1 offline attestation surface, its on-chain broadcast legs OWNER-GATED / NOT_PERFORMED) — spec, security suite, console, SDK/MCP/REST, risk taxonomy, cross-chain attestation.
- The named attack battery (deterministic prompt-injection fuzz set, post-approval swaps/drifts, replay, documented cross-session gap, expiry, tamper), the TypeScript declaration surface, and the bilingual operator dashboard — see `docs/surface-status.json` for the per-surface truth.
- Dated instruments: the ChatGPT-Wallet moment note (2026-11-14), the funding/partnerships snapshot (2026-11-14), this report, the outreach dossier, the 18 message drafts, the integration guide, the video script.

## 4. Standing boundaries (never drift)

No contact, integration, endorsement or adoption exists with OpenAI, American Express, Mastercard, Visa, or any provider or partner. `VERIFIED ≠ SAFE`. The taxonomy is deterministic, never a probabilistic fraud score. The actor is declared, never detected. Every order is synthetic. Funding **$0**, revenue **$0**, customers none. Next report: 2026-11-22 (same rules).
