# Partner Outreach Messages — 18 drafts (dated instrument, NEVER SENT)

**Date:** 2026-11-15 · **Status:** DRAFT · **NOT SENT** · every send is OWNER-GATED. No contact, integration or endorsement exists with any named party. No outcome (reply, partnership, revenue) is promised or predicted — revenue **$0**, funding **$0**. Each draft cites only dated public facts. Every order in every referenced artifact is synthetic.

Rule for every message: ask for a **technical review of one question**, never for adoption, endorsement, or money. If a reply never comes, nothing is lost and nothing is claimed.

---

## M1 · OpenAI — commerce developer lane

**Fact cited (public, dated):** ChatGPT Wallet approval "creates a clear record of the purchase the user authorized" (2026-11-13); developers invited to build MCP/WebMCP tools.
**Subject:** An independently re-derivable version of the approval record — offline-verifiable, provider-independent.
**Body draft:** We built a small open verification layer that binds an agent's approval to the exact executed order bytes as a re-derivable receipt (CGCR/1) and refuses post-approval drift fail-closed (AGR/1: recipient swap, total escalation, injected items, credential swap, expiry, replay). It is provider-independent, runs offline, and is positioned beside existing checkout flows — not as a required wallet component. The committed suite (`examples/agent-commerce-security-suite`) blocks 8/8 named post-approval attacks deterministically. Would a technical review of the binding model be useful? No integration or endorsement is implied — we are asking for a check of one mechanism.

## M2 · OpenAI — the decline problem (risk-systems lane)

**Fact cited:** OpenAI's own published caveat that correctly tokenized, user-approved purchases can still be flagged, "leading to declines or cancellations" (2026-11-13).
**Subject:** Per-field evidence for "this executed order matches what the user approved" — a signal for decline triage.
**Body draft:** A risk system deciding on a tokenized agent purchase today cannot see whether the executed order still matches the approval. We ship deterministic, named, per-field drift evidence (payee, total, items, credential, window) computed offline over the approval↔execution binding — an adjunct signal, not a replacement for any fraud system, and never a score. Happy to walk a reviewer through the committed battery and fail-closed semantics. No contact with any network is claimed and none is requested beyond this question.

## M3 · Forter

**Fact cited (public, dated):** Forter is named by OpenAI among fraud-prevention partners for ChatGPT Wallet (2026-11-13).
**Subject:** Authorization-drift evidence as a new input class for agent-transaction risk.
**Body draft:** Your systems see tokenized agent transactions; what they cannot see is whether the executed order drifted from the user's approval. We produce a deterministic, re-derivable receipt binding the two, with named violation classes (RECIPIENT_SUBSTITUTION, VALUE_ESCALATION, ITEM_MUTATION, CREDENTIAL_SUBSTITUTION, EXPIRED_AUTHORIZATION, …) — evidence, not a score, `VERIFIED ≠ SAFE`. Would a 30-minute technical review be useful? No integration or endorsement is implied.

## M4 · Riskified

**Fact cited:** Riskified is named among OpenAI's fraud-prevention partners for ChatGPT Wallet (2026-11-13).
**Subject draft:** same question as M3, framed for Riskified's stack.
**Body:** as M3, replacing the class list with "the committed taxonomy ships eight named classes with severities".

## M5 · Sardine

**Fact cited:** Sardine is named among OpenAI's fraud-prevention partners for ChatGPT Wallet (2026-11-13).
**Body:** as M3.

## M6 · Signifyd

**Fact cited:** Signifyd is named among OpenAI's fraud-prevention partners for ChatGPT Wallet (2026-11-13).
**Body:** as M3.

## M7 · Adyen

**Fact cited:** Adyen is named among OpenAI's payment service providers for ChatGPT Wallet (2026-11-13).
**Subject:** Verification of approval↔execution for agent checkouts you process.
**Body draft:** For any agent checkout you process, our REST face (`/v1/authorize`, `/v1/verify`, `/v1/risk-assess`) returns a fail-closed verdict over the approval↔execution binding — offline-reproducible, provider-independent, with named drift classes. We are an open-source verification layer, not a payment provider and not a competitor to any PSP. Would a technical review be useful? No integration is claimed.

## M8 · Checkout.com

**Fact cited:** Checkout.com is named among OpenAI's PSPs for ChatGPT Wallet (2026-11-13).
**Body:** as M7.

## M9 · Stripe

**Fact cited (public, dated):** Stripe co-developed the Agentic Commerce Protocol with OpenAI (ACP beta, stable 2026-04-17, MCP transport binding) and offers Shared Payment Tokens for agent purchases.
**Subject:** Binding ACP/Shared-Token purchases to an independently re-derivable consent receipt.
**Body draft:** ACP scopes the credential; we bind the APPROVAL to the EXECUTED order and make the binding re-derivable by anyone holding the receipt. The two are complementary: scoped tokens protect card data, CGCR/1 protects the authorization↔execution link, fail-closed, with named drift classes. The committed suite and spec are public and offline-verifiable. Would a technical review of the binding model be useful? No integration or endorsement is implied.

## M10 · Shopify

**Fact cited (public, dated):** Shopify added Checkout WebMCP tools (September 2026) that submit an order only after buyer confirmation.
**Subject:** Consent receipts for WebMCP checkout — the buyer's confirmation, re-derivable.
**Body draft:** Your WebMCP checkout already gates submission on buyer confirmation; we bind that confirmation to the exact submitted order bytes as a receipt any auditor can re-derive offline, and fail closed on post-approval drift (cart injection, payee swap, total escalation). Spec + committed attack battery are public. Would a technical review be useful? No integration is claimed.

## M11 · Cloudflare

**Fact cited (public, dated):** Cloudflare's WebMCP-for-commerce partnership work (blog, 2026) turns on structured agent tools "in a secure way".
**Subject:** Authorization↔execution evidence alongside signed agent traffic.
**Body draft:** Web Bot Auth authenticates who the agent is; it does not prove the executed order matches the user's approval. Our layer adds exactly that proof — deterministic, offline-re-derivable, named drift classes — as an optional signal beside signed traffic. Public spec, public battery, no network claims. Would a technical review be useful?

## M12 · BigCommerce

**Fact cited (public, dated):** BigCommerce documents server-side MCP for agents alongside WebMCP.
**Subject draft:** same question as M10, framed for server-side MCP checkouts.
**Body:** as M10, replacing WebMCP with "server-side MCP checkout tools".

## M13 · Google (UCP / AP2 at FIDO)

**Fact cited (public, dated):** UCP (Google+Shopify, v2026-08-25) powers agent checkout on Google surfaces; AP2 moved to the FIDO Alliance.
**Subject:** Verifiable authorization receipts as the evidence leg for delegated purchase mandates.
**Body draft:** AP2's mandates and UCP's carts describe what the user authorized; we make the executed order provably match it — re-derivable receipts, fail-closed verification, named drift classes, no keys, offline. Spec and committed battery are public. Would a technical review be useful? No endorsement or integration is implied.

## M14 · Stellar (Stellar Community Fund lane)

**Fact cited (repo fact):** SCF #46 RFP-2 submission is under review (the repo's only publishable external fact); Part A/B build form deadline 2026-11-20 9:00 AM PT.
**Subject:** — (this lane is the OWNER's application action, not an outreach message; recorded here so the queue is complete).
**Status:** OWNER ACTION REQUIRED — Build form Part A/B before the deadline. No award claimed; funding received $0.

## M15 · Core DAO ecosystem

**Fact cited (repo fact):** CoreGuard commitment anchors are LIVE/RECORDED on Core Mainnet chainId 1116; the agent-commerce family runs on the committed CGEP/1 machinery.
**Subject:** — (funding/integration application path, owner-gated; recorded for queue completeness).
**Status:** CANDIDATE PATH — nothing submitted; owner decides.

## M16 · A non-custodial wallet team (archetype)

**Subject:** Consent receipts behind your checkout — the approval, re-derivable.
**Body draft:** When your wallet lets an agent spend, our CGCR/1 receipt binds the approval to the exact executed order bytes; anyone (auditor, regulator, the user) re-derives it offline with no keys. Fail-closed on drift; deterministic taxonomy; `VERIFIED ≠ SAFE`. The committed suite blocks 8/8 named post-approval attacks. Would a technical review be useful? No integration is claimed.

## M17 · An MCP-platform provider (archetype)

**Subject:** A stdio MCP server that refuses drifted commerce actions — a pilot?
**Body draft:** We ship a real MCP server (`coreguard-agent-commerce`, JSON-RPC 2.0, protocol 2025-06-18) exposing authorize/verify/assess-risk; the committed suite drives it live and shows it refusing a drifted order. Publication is a pending owner decision, so a sandbox pilot would start from the committed tree. Would a technical review be useful? No integration is claimed.

## M18 · W3C WebMCP Community Group (public-forum note draft)

**Subject draft:** Security considerations input: bind the page-declared action to the user's approval as re-derivable evidence.
**Body draft:** The WebMCP draft's security section (2026) names five issues; we would contribute one concrete pattern — the browser-executed tool call should carry a re-derivable binding to the approval it claims to represent (our CGCR/1 does this off-page today; committed code + battery are public). Contributed as feedback only, no working-group membership implied. Owner-gated before posting.

---

## Send-gate discipline (standing)

1. Nothing above has been sent; nothing is scheduled; the queue is the owner's alone (§6 of the outreach dossier).
2. Before any send: approve the exact text, the channel, and the named recipient.
3. After any send: record the fact (date + channel) in a NEW dated instrument — never rewrite this one.
4. No reply, no partnership, no revenue is promised, predicted, or implied. All figures remain $0.
