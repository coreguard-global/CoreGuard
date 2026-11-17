# CoreGuard — Partner & Funding One-Pager (evidence-first, honest)

**Date:** 2026-11-16 (measured) · **Contact:** CoreGuard maintainers (GitHub: coreguard-global/CoreGuard) · **Stage:** open-source, evidence-backed prototype surfaces (not a deployed commercial product)

## 1) Problem
As AI agents initiate purchases and value transfers, the critical trust gap is **post-approval drift**: was the executed action *exactly* what the user approved (merchant/recipient, items, amounts/fees/taxes, credential binding, time window), and can an independent party verify that binding later without trusting the agent or a single log?

## 2) What CoreGuard provides (built & verifiable)
An independent, **offline/deterministic/fail-closed** verification layer for agent commerce:
- **Agent Authorization Firewall (AC-FW/1):** pre-execution authorization + post-execution review with named refusal reasons.
- **Verifiable Consent Receipts (CGCR/1):** approval bound to exact approved bytes; independently re-derivable checks.
- **Agent Risk Engine (AGR/1) + CLI:** named drift/risk classes (frozen vocabulary) with JSON/JSONL assessment persistence.
- **SDK + MCP server (stdio JSON-RPC 2.0) + REST API (AC-API/1):** integration surfaces to authorize/verify programmatically.
- **Cross-Chain Execution Attestation (CGXA/1):** offline attestation of the approval↔execution arc against committed binding records; **Soroban consent-binding preparation (CGXA-SOROBAN/1)** provided offline (no broadcast).
- **Durable same-host consumption anchoring (AC-CS/1):** file-backed, cross-process on host (not distributed/on-chain).

**Measured proof (CI-pinned):** 1795/1795 tests · 1288 files / 0 boundary violations · docs-node 133/82/30 · CI green on `main`. Runnable demos: `examples/agent-commerce-security-suite/`, `firewall/`, `attestation/` (synthetic fixtures).

## 3) Why it’s differentiated (defensible angle)
- **Precise binding:** authorization ↔ execution ↔ independently re-derivable receipt/evidence (not a generic “AI safety” claim).
- **Fail-closed & named:** refusals are explicit and testable (no silent pass on missing/malformed evidence).
- **Composable & provider-independent:** designed to complement existing checkout/payment rails (not positioned as a required wallet component).

## 4) Honest boundaries (non-negotiable)
- `VERIFIED ≠ SAFE`. No claim of fraud-proofing, production guarantees, or interception of real ChatGPT Wallet/card flows.
- Synthetic/offline demos only; **no live integrations, no endorsements**, no on-chain broadcast performed.
- AC-CS/1 is **same-host** (not distributed/on-chain). npm/MCP-registry publication and on-chain actions are **owner-gated/not performed**.
- **Traction today:** $0 revenue, no paying customers, no awarded funding, no signed partnerships (one submitted application may be under review as separately documented; no award claimed).

## 5) What we are seeking (proposals / paths)
| Track | What we offer | What we ask for | Success signal |
|---|---|---|---|
| **Design/Integration Pilot** | 2-week scoped integration (one flow) producing a third-party-verifiable evidence bundle | 1 named engineer (~4h/wk), one flow’s exact bytes/policy, permission to publish numbers | Reproducible PASS/REFUSE results on partner side |
| **Ecosystem/Grant** | Reproducible security primitives for agent commerce (Stellar/Soroban, Core, agent ecosystems) | Milestone-based support aligned to verifiable deliverables | Funded milestones with public artifacts |
| **Research/Standards** | Verifiable approval↔execution receipt concepts (evidence-first) | Feedback, sponsorship/collaboration on spec work where appropriate | Iterated, testable proposal with implementers |

## 6) Near-term milestones (evidence-led)
- Deliver a partner pilot with a **published, re-verifiable artifact bundle** (or a written no-go with numbers).
- Harden integration ergonomics (SDK/MCP/REST examples) driven by pilot feedback.
- Pursue targeted grants/accelerators with milestone-tied, verifiable outputs (no outcome guarantees).

*This document states capabilities evidenced in-repo and proposals only; it makes no claims of endorsement, integration, adoption, revenue, or funding beyond what is independently documented.*
