# OpenAI Ecosystem Outreach Dossier — CoreGuard Agent Commerce Security (dated instrument)

**Date:** 2026-11-15 · **Status:** INSTRUMENT ONLY — nothing has been sent, no contact exists, no relationship is claimed or implied. Every send is OWNER-GATED (§6). Revenue **$0**, funding **$0**.

**Honesty header (standing).** CoreGuard claims no contact, integration, or endorsement with OpenAI, American Express, Mastercard, Visa, or any provider. Nothing below is a statement about any company's intentions. Every claim about another company is a dated citation of a public source. Every order in every artifact is synthetic (placeholder credentials, never a PAN). `VERIFIED ≠ SAFE`.

## 1. The positioning (one sentence)

CoreGuard is an independent trust layer for agent commerce — it binds the user's approval to the exact executed order bytes as an independently re-derivable receipt (CGCR/1), refuses post-approval drift fail-closed (AGR/1), and proves both offline, provider-independently — **it is not a required component of any wallet and works with existing checkout pages.**

## 2. The wedge — OpenAI's own published facts (dated citations)

| Public fact | Source (date) | Why it is the wedge |
|---|---|---|
| "OpenAI says each approval creates a clear record of the purchase the user authorized the agent to make" | OpenAI announcement, 2026-11-13 | CoreGuard makes that record **independently re-derivable and bound to execution**: not just a record of intent, a receipt that fails closed when the executed order drifts. |
| Payment/risk systems may still flag legitimate agent purchases, "leading to declines or cancellations" | OpenAI announcement, 2026-11-13 | A decline decision today cannot distinguish an executed order that matches the approval from one that does not. AGR/1 gives the risk system named, per-field evidence of exactly that. |
| OpenAI expects future delegated purchases within spending limits, categories and time periods | OpenAI announcement, 2026-11-13 | Delegation is exactly what a bound authorization receipt + policy evaluation (value limits, recipient/selector allowlists, expiry windows) is built to verify after the fact. |
| Commerce Partner Playbook; developers invited to build MCP/WebMCP tools | OpenAI announcement, 2026-11-13 | CoreGuard ships a real stdio MCP server (JSON-RPC 2.0), a REST verification API and an SDK — the invited shape, provider-independent. |
| ChatGPT Wallet works with merchants' existing payment pages; no special integration required | OpenAI announcement, 2026-11-13 | CoreGuard is positioned as an optional verification layer beside existing flows — never as a component required to run anyone's wallet. |

## 3. What a reviewer can run today (all committed, offline, zero keys)

1. **The security-suite arc:** `node examples/agent-commerce-security-suite/run.mjs` — exit 0 only on the exact arc (consent VERIFIED → exact execution VERIFIED → 8/8 named attacks INVALID → real MCP child refuses a drifted order → real loopback REST verifies the exact order); deterministic `artifacts.json`.
2. **The named attack battery:** `test/integrations/agent-commerce-attack-battery.test.mjs` — a deterministic six-vector prompt-injection fuzz set, post-approval recipient swap, tax/shipping/fee escalation, credential substitution, replay, expiry, receipt tamper, and the honestly documented cross-session consumption gap.
3. **The MCP server:** `node packages/agent-commerce/mcp.mjs` — newline-delimited JSON-RPC 2.0 on stdio (`initialize` → `tools/list` → `tools/call`).
4. **The REST API:** `POST /v1/authorize` · `/v1/verify` · `/v1/consent-verify` · `/v1/risk-assess` (AC-API/1) — loopback-first, allowlist guard-0, token-bucket limiter with the documented `/health` exemption split.
5. **The operator views:** `docs/agent-commerce-console.html` and `docs/agent-commerce-dashboard.html` — bilingual, fully offline, embedding the committed artifacts verbatim.

## 4. What we would ask for (a technical review only)

A working-session review of one question: **does independent re-derivable authorization↔execution binding add verifiable value to agentic commerce?** No endorsement is requested or promised in either direction; no integration is pre-claimed; the outcome (a call, a "no", silence) is the reviewer's alone. All materials above are public in the committed tree and verifiable offline.

## 5. What we would NOT claim (standing)

- No partnership, integration, adoption or endorsement with OpenAI, American Express, Mastercard, Visa, or any fraud/PSP provider — none exists.
- No claim to be a required component of ChatGPT Wallet or any wallet.
- No replacement of any payment network's fraud systems — AGR/1 is a deterministic authorization-drift taxonomy, not a probabilistic fraud score; `VERIFIED ≠ SAFE`.
- No revenue, customer, funding or adoption figures — all $0 / none.
- Other agent-security and policy-firewall tooling exists; the defensible position is the precise binding of authorization → execution → independently re-derivable receipt with committed replayable evidence — not a first-mover claim.

## 6. Owner-gated actions queue

1. Decide whether any outreach happens at all, and approve the exact message text (drafts: `docs/partner-outreach-messages-2026-11-15.md`) — nothing has been sent.
2. Choose the channel (the public Commerce Partner Playbook routes at `developers.openai.com/commerce` are the documented paths).
3. Approve the npm/MCP publication lane before any distribution claim (`packages/agent-commerce` currently ships without package.json by design — see `docs/agent-commerce-integration-guide-2026-11-15.md`).
4. Commission the patentability study named in the spec (§10) before further public disclosure of candidate mechanisms.

**Facts as of 2026-11-15.** This instrument records proposals and paths only.
