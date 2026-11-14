# The agentic-commerce moment — ChatGPT Wallet (2026-11-13) and the layer CoreGuard commits today

**Dated instrument — records what was measured on 2026-11-14.** A dated instrument is never rewritten; a later cycle supersedes with a new dated document.

## 1. What happened (verified, dated, sourced)

On **2026-11-13** OpenAI announced **ChatGPT Wallet**: agent-initiated payments where the agent pays with **tokenized credentials** (the network substitutes a payment token for the real card details), every purchase requires a **user review + approval with a security check** (Face ID or fingerprint), built **in partnership with American Express, Mastercard and Visa**, initially for ChatGPT Pro subscribers in the US, alongside a **Commerce Partner Playbook** for merchants and named **fraud/risk partners (Forter, Riskified, Sardine, Signifyd)** and **payment service providers (Adyen, Checkout.com, Stripe)**. OpenAI's own page states the approval *"creates a clear record of the purchase the user authorized the agent to make"*, and names as **future work**: *"users to be able to delegate purchases entirely to their agent by setting clear parameters—such as spending limits, purchase categories, or time periods—and pre-approve those purchases with enhanced safeguards."*

Sources (all read 2026-11-14): [openai.com/index/introducing-chatgpt-wallet](https://openai.com/index/introducing-chatgpt-wallet) · [CNBC](https://www.cnbc.com/2026/11/13/openai-chatgpt-wallet-dot-purchases.html) · [The Verge](https://www.theverge.com/ai-artificial-intelligence/1033425/openai-chatgpt-wallet) · [Bloomberg Law](https://news.bloomberglaw.com/artificial-intelligence/openai-launches-chatgpt-wallet-for-agentic-payments) · [Reuters via investing.com](https://www.investing.com/news/stock-market-news/openai-launches-chatgpt-wallet-letting-ai-agents-pay-for-purchases-5026114) · [ChatGPT Wallet terms](https://openai.com/policies/chatgpt-wallet-terms/).

## 2. What this changes

Agent-initiated payments moved from conference demos to **consumer reality at ChatGPT's scale**. The open question for every wallet platform, merchant and bank is no longer "can an agent pay?" but **"can anyone prove, later and independently, that the executed order is the order the user approved?"** Tokenization answers card-data exposure. It does not bind **execution to authorization** — and an approval record held only by the issuing platform is a record, not independent evidence.

## 3. The mapping — what is shipped, what is named as future, and what CoreGuard commits today

| Agentic-commerce need (per the announcement) | Status per the announcement | The gap | The committed CoreGuard surface (re-derivable offline) |
|---|---|---|---|
| Per-purchase user approval + security check | **Shipped** | The approval is a record held by the issuing platform; no independent party can re-derive it | Approval bound as a **receipt to exact canonical bytes** (intent + policy): `packages/canonical` (`hashIntent`/`hashPolicy`/`computeReceiptId`) · `packages/evidence` (`createReceipt`) |
| "A clear record of the purchase the user authorized" | **Shipped** (platform-held) | A record is not evidence anyone can replay | The record is **independently re-verifiable by anyone holding it**: `packages/verifier` (`verifyReceipt` recomputes every hash; any byte of the record that drifts fails closed) |
| Tokenized payment credentials | **Shipped** (protects card data) | Tokenization ≠ execution truth — the executed order can still differ from the approved order | **Execution-to-authorization binding, fail-closed on drift**: `packages/verifier` (INTENT_EXECUTION_BINDING · TRACE_HASH · POLICY_EVAL) — demonstrated in `examples/agent-commerce-approval-binding/run-demo.js` |
| Future: *"delegate purchases entirely ... spending limits, purchase categories, or time periods ... pre-approve ... with enhanced safeguards"* | **Named as future work** | The delegation shape does not exist yet on the platform side | The delegation shape is **already committed here**: intent + policy with VALUE_LIMIT / TARGET_ALLOWLIST / RECIPIENT_ALLOWLIST / DEADLINE · pre-sign receipts bound to exact transaction bytes (PSAR/1: `packages/stellar/presign.mjs`) · fail-closed agent gate (`packages/agent-gate/`) · Execution Firewall (`packages/firewall`) |
| Dispute protections for eligible transactions | **Shipped** (network-level) | "Eligible" needs evidence both sides can inspect | The **acceptance/dispute boundary**: DDE/1 — execution verification never decides delivery conformity; party acceptance records open and close the payout gate (`packages/delivery`) · evidence/dispute packages (EVP/1 · ADAL/1) |
| Merchant/risk recognition of legitimate agent purchases | **Shipped** (partner programs) | Risk systems decide risk; they do not pin authorization records | **Adjacent, not competing**: CoreGuard is the evidence/authorization-binding layer such systems can consume — it pins what the user authorized and whether execution conformed |

## 4. The offline demonstration (synthetic, zero keys, zero network)

`examples/agent-commerce-approval-binding/run-demo.js` runs the full arc with the repo's own machinery and exits 0 **only** on the exact outcome set:

| Step | Outcome |
|---|---|
| APPROVE (user reviews merchant/items/total/credential) | receipt bound to exact canonical bytes, re-derivable by anyone |
| EXECUTE exact | **VERIFIED** — every check PASSes |
| TOTAL DRIFT (a surcharge appears after approval) | **INVALID** — fail-closed, the drifted field is named (TRACE_HASH · VALUE_LIMIT · binding) |
| MERCHANT SWAP (payee changes after approval) | **INVALID** — fail-closed, the drifted field is named (TRACE_HASH · TARGET/RECIPIENT allowlists · binding) |
| RECORD TAMPER (a byte of the stored record changes) | **INVALID** — RECEIPT_COMMITMENT mismatch |

Committed deterministic artifacts: `examples/agent-commerce-approval-binding/artifacts.json` — the approved intent/policy, the receipt id, the four verdicts, and the named drifts. Re-running regenerates it byte-identically. Boundary (standing): **execution verification does not decide delivery conformity** — the DDE/1 payout gate opens only on party acceptance records.

## 5. Honest boundaries (standing, non-negotiable)

- **No contact, relationship, integration, partnership or endorsement is claimed** with OpenAI, American Express, Mastercard, Visa, or any provider named above — this document maps a verified public event to committed, runnable artifacts. Nothing here was requested or received from any of them.
- Every order in the demonstration is **synthetic**; the payment credential is a placeholder string (never a PAN); the run is offline with zero keys and zero network; nothing is sent anywhere.
- CoreGuard answers **"did execution conform to what was authorized?"** — never "is this purchase profitable/safe?" and never a fraud score. VERIFIED ≠ SAFE.
- No revenue, funding award, customer or adoption is claimed; funding is **$0** until an award lands. Commercial pricing stays locked under the standing Decision Gate.
- The actor in the demonstration is **declared, never detected** (AgentProof taxonomy): a demo agent address labeled `declared — never detected`; human-vs-agent provenance is a separate, declared surface.

## 6. Reviewer path (60 seconds)

Clone the repository, then run `node examples/agent-commerce-approval-binding/run-demo.js` (offline, no keys, no network — exits 0 only on the exact arc above) and read `examples/agent-commerce-approval-binding/artifacts.json` next to `examples/agent-commerce-approval-binding/README.md`. The same machinery's Stellar face (byte-level pre-sign receipts) is `npm run stellar:presign` — see `docs/freighter-presign-integration-proposal-2026-11-12.md`.
