# CoreGuard × Salla Shop — Technical Pilot Proposal v1.0

**Status:** Draft proposal (for discussion)  
**Date:** 2026-11-19  
**Prepared by:** CoreGuard (Eslam Kora)  
**Proposed design partner / pilot candidate:** Salla Shop ecosystem (`https://mall.salla-shop.com`)  
**Document intent:** Define a concrete, low-risk pilot to validate CoreGuard as an independent verification and evidence layer for price, payment, and execution integrity in Pi-denominated commerce flows.

---

## 1. Executive summary

Salla Shop (as presented on `mall.salla-shop.com`) appears to operate as a multi-vertical commerce and services ecosystem (marketplace, food, services, local, delivery, care) with Pi payments, escrow/hold-until-delivery behavior, refunds, disputes, order tracking, and a payment API surface. That makes the core risk and trust challenge broader than a single storefront: **price representation, user approval, payment execution, settlement/escrow actions, and dispute outcomes must remain consistent across the same financial path**.

**CoreGuard proposal:** integrate CoreGuard as an **independent Trust & Execution Verification Layer** (not a replacement for Salla’s wallet, payment, escrow, or dispute-decision systems). CoreGuard would verify that the approved quote, the observed payment, and the recorded execution events match under explicit rules — and produce named, reviewable outcomes and evidence artifacts.

**Recommended first integration:** **Price + Payment Integrity** (fastest path to measurable value), followed by phased expansion toward **Commerce Shield** (execution/escrow/refund checks) and **Dispute Evidence** support.

**What success looks like:** a sandbox-backed pilot with reproducible test scenarios, machine-readable verification results (including named mismatch/replay/expiry/pending states), and an evidence report Salla can evaluate operationally — without claiming to prevent all fraud or to replace platform controls.

---

## 2. Problem framing (why this matters)

In Pi-priced commerce flows with dynamic conversion and multi-step settlement, common integrity gaps include:

- **Quote drift:** the amount charged/executed differs from what the user approved (or approval expired).
- **Payment mismatch:** order/payment IDs, amount, recipient, network/environment, or confirmation state do not align.
- **Replay / duplication:** the same payment proof, webhook event, or execution path is applied more than once.
- **Escrow/refund inconsistency:** release or refund actions do not match approved amounts, order state, or policy.
- **Dispute opacity:** evidence is fragmented across systems, slowing review and increasing error risk.

These are verification problems: they benefit from an **independent layer** that checks declared intent/approval against observed execution and emits auditable, reason-coded results.

---

## 3. Product direction

### 3.1 Working name
**CoreGuard Commerce Shield** — *Verifiable Price, Payment & Execution Infrastructure*

### 3.2 Core capabilities (phased)
1. **Price Integrity** — bind and verify the quote shown/approved (amount, source inputs, calculation context, validity window).
2. **Payment Integrity** — verify payment facts against the approved order/quote (server-side observed data).
3. **Execution Integrity** — verify order/escrow/release/refund actions against authorization and policy.
4. **Dispute Evidence** — assemble a structured evidence package to support human review (not automated adjudication).

### 3.3 Design principles
- **Independent verification:** CoreGuard returns verification outcomes and evidence; Salla retains custody/control of funds, wallet operations, escrow execution, and final dispute decisions.
- **Named outcomes, not scores:** results use explicit states/reason codes (e.g. mismatch type, expiry, replay detected).
- **Fail-closed where evidence is insufficient:** unknown/missing evidence must not be treated as verified success.
- **Server-side truth:** payment verification must rely on Salla/backend-confirmed payment data, not client-only UI signals.
- **Pilot-first, measurable:** prove value in a narrow flow before broad rollout.

---

## 4. Current CoreGuard baseline (honest starting point)

CoreGuard already provides relevant building blocks in-repo (locally implemented and test-executed in project context), including:

- **Agent Commerce HTTP API (local):** `packages/agent-commerce/http.mjs`
  - `GET /health`
  - `POST /v1/authorize` — create/bind an authorization/consent record
  - `POST /v1/verify` — verify execution against consent
  - `POST /v1/consent-verify` — verify consent integrity
  - `POST /v1/risk-assess` — classify drift/risk signals
- **Consent, verification, risk, and evidence-oriented components** across Agent Commerce / firewall / risk / delivery-evidence modules (to be mapped and adapted to Salla’s domain objects).

**Important boundary (current state):**
- No Salla-specific Pi payment adapter, no OKX quote adapter, and no live Salla/Pi integration exist yet.
- Existing HTTP service is **not** presented here as production-hardened or internet-exposed as-is (allowlist/rate-limiting posture, multi-instance replay/state durability, authn/authz, secrets handling, observability, and deployment controls must be addressed for production).
- CoreGuard verifies recorded inputs, bindings, and consistency checks; it does **not** independently prove external market-data correctness (e.g. that an exchange price was economically "correct" or uncompromised) without trusted source attestations/controls.

---

## 5. Proposed MVP scope (Phase 1: Price + Payment Integrity)

### 5.1 MVP modules
| Module | Responsibility | MVP output |
|---|---|---|
| **VPQ (Verifiable Price Quote)** | Capture and bind quote inputs: product/order context, base fiat amount, Pi conversion inputs, rate source metadata, calculation/rounding rules, quote timestamp, expiry, quote ID | Signed/bound quote record (verifiable artifact) |
| **CGCR (Consent/Approval Receipt)** | Bind user-approved quote/order terms to a verifiable approval record | Consent receipt linked to quote/order/payment intent |
| **Pi Payment Integrity Adapter** | Compare backend-confirmed payment facts to approved quote/order and expected recipient/context | Match/mismatch/replay/pending/unknown result with reason codes |
| **Replay & Idempotency Guard** | Prevent reuse/double-application of payment proof or webhook event within defined scope | Replay/duplicate detection outcome |
| **Verification Report** | Human + machine-readable summary of checks, evidence references, and final state | Report artifact for ops/review/audit trail |

### 5.2 Verification result states (MVP)
- **`VERIFIED`** — all required checks passed for the evaluated scope.
- **`MISMATCH`** — one or more checked fields differ (reason-coded: amount, recipient, order binding, currency/network, state, etc.).
- **`EXPIRED`** — quote/approval validity window elapsed before valid completion.
- **`REPLAY_DETECTED`** — payment proof/event/authorization reuse detected.
- **`PENDING`** — required confirmation/finality not yet observed.
- **`UNKNOWN`** — insufficient or unavailable evidence to determine a verified pass.

> Note: a non-`VERIFIED` result is not, by itself, proof of malicious intent; it is a named integrity condition requiring policy-defined handling.

### 5.3 Core checks (initial)
- Quote validity: not expired at payment/commit point; quote ID and parameters unchanged.
- Amount integrity: paid/authorized amount matches approved quote (within defined rounding/tolerance rules, if any).
- Recipient integrity: destination/payee/wallet context matches approved merchant/flow configuration.
- Binding integrity: `order_id` ↔ `payment_id`/transaction reference consistency.
- State integrity: backend-observed payment/confirmation status meets required threshold.
- Replay/idempotency: no prior accepted use of same transaction/payment proof/webhook event key for conflicting settlement.
- Environment integrity: correct network/environment/context (as applicable).

---

## 6. Illustrative flow (100 EGP example)

1. **Merchant/order context** defines base price (e.g. 100 EGP) and product/order identifiers.
2. **Price source adapter** retrieves conversion inputs (e.g. OKX pair + any required FX context) and records source/timestamp.
3. **VPQ** computes/binds Pi amount, rounding rules, quote time, expiry, and quote ID.
4. **Customer approval** is captured as **CGCR** against that exact quote (no silent repricing after approval).
5. **Payment occurs** in Salla/Pi flow; Salla backend provides server-side payment/transaction facts.
6. **Pi Payment Adapter + verification** evaluates match/mismatch/expiry/replay/pending/unknown.
7. **Verification report + evidence references** are emitted for operational use; Salla systems remain the source of execution authority.

**Example mismatch:** approved 2 Pi to recipient A; observed payment 2 Pi to recipient B for same order binding → `MISMATCH` with `RECIPIENT_MISMATCH` (and policy may block/review).

---

## 7. Sandbox test matrix (initial 10 scenarios)

All tests should run in **sandbox/test environments first** (no real funds).

| # | Scenario | Expected result |
|---|---|---|
| 1 | Quote, amount, recipient, bindings all match; required confirmation reached | `VERIFIED` |
| 2 | Paid amount lower than approved | `MISMATCH` (`AMOUNT_UNDERPAID`) |
| 3 | Paid amount higher than approved | `MISMATCH` (`AMOUNT_OVERPAID`) |
| 4 | Recipient/wallet differs from approved destination | `MISMATCH` (`RECIPIENT_MISMATCH`) |
| 5 | Quote expired before valid payment completion | `EXPIRED` |
| 6 | Same transaction/payment proof reused for another order/settlement | `REPLAY_DETECTED` |
| 7 | Duplicate webhook/event delivery (same event key) | Single-effect processing; duplicate flagged/ignored safely |
| 8 | Invalid/tampered webhook signature or malformed event payload | Rejected / `UNKNOWN` or policy-defined failure state |
| 9 | Payment observed but required confirmation/finality not yet reached | `PENDING` |
| 10 | Order terms changed after approval without new consent | `MISMATCH` (`ORDER_CONTEXT_MISMATCH`) |

Additional pilot-relevant cases (recommended): partial refunds exceeding remaining refundable amount, inconsistent refund recipient/context, conflicting escrow state transitions.

---

## 8. Integration architecture (proposed)

```text
Salla Shop Backend (orders, pricing context, payment status, escrow/refunds, webhooks)
            |
            |  server-side events / normalized records
            v
CoreGuard Integration Adapter (Salla-specific mapping layer)
            |
            v
CoreGuard Verification API (authorize/consent/verify/risk + pilot extensions)
            |
            v
Verification Results + Evidence Artifacts / Report
            |
            v
Salla Ops / Review Tools (consume results; Salla keeps decision authority)
```

**Integration posture:**
- No rebuild of Salla systems required; adapter-based integration.
- CoreGuard consumes **authorized, minimized, server-side** data needed for checks.
- Evidence storage/retention/access controls to be agreed (including privacy/compliance requirements).

---

## 9. Information required from Salla (Technical Discovery)

To scope and implement the pilot accurately, we need **documentation and sanitized sandbox examples** (not production secrets or real user PII):

1. **SallaNet Pay / payment API documentation** relevant to Pi flows.
2. **Server-side payment status/query method** (source of truth for confirmation/state).
3. **Webhook/event schema**, delivery semantics (retries/duplicates), signing/authentication, and event IDs.
4. **Order ↔ payment identifier mapping** rules and lifecycle.
5. **Quote/pricing logic for Pi conversion** (including OKX/source usage, FX steps if any, rounding, refresh/expiry behavior).
6. **Escrow/refund/dispute state model** (for Phase 2 planning), including partial refund rules.
7. **Sandbox/test environment access** and sample transactions (sanitized/anonymized).
8. **Operational constraints:** latency expectations, environments, logging/audit requirements, and security/compliance constraints.

---

## 10. 30-day target plan (indicative, dependency-aware)

| Week | Focus | Key outputs |
|---|---|---|
| **Week 1** | Technical discovery & integration spec | Flow map, source-of-truth matrix, field mapping, pilot scope sign-off |
| **Week 2** | VPQ + consent/approval binding | Quote and approval artifact schema/binding, 100 EGP sample flow instrumentation plan |
| **Week 3** | Pi payment adapter + integrity checks | Sandbox adapter, replay/idempotency checks, core scenario execution |
| **Week 4** | Evidence/reporting + pilot review | Verification report format, test results summary, gaps/risks, Phase 2 recommendation |

**Dependencies/risks:** timeline depends on API/docs availability, sandbox access, responsiveness of a technical counterpart, and clarity of server-side payment truth sources.

---

## 11. Security, reliability, and production hardening (required before broad exposure)

Pilot implementation must progress with explicit hardening steps:

- **Access control:** authenticated service-to-service access, least privilege, environment separation.
- **Allowlist/network posture:** restrictive ingress; do not rely on permissive defaults.
- **Replay/state durability:** shared/persistent idempotency and replay stores for multi-instance deployments.
- **Webhook integrity:** signature verification, timestamp/replay windows, strict schema validation.
- **Data minimization & privacy:** collect/store only necessary fields; define retention and access policies.
- **Observability & auditability:** structured logs/metrics/traces and immutable-enough evidence references.
- **Failure handling:** explicit `PENDING`/`UNKNOWN` paths, safe retries, and operator-facing diagnostics.

---

## 12. CoreGuard brand presence in verification artifacts (proposed)

Where Salla agrees, verification outputs can carry clear CoreGuard attribution to preserve provenance and trust signaling, for example:

- **Verification reports / evidence passports:** CoreGuard name, mark/logo, verifier version/build identifier, timestamp, and artifact/checksum references.
- **Machine-readable results:** `verifier` metadata fields (name, version, policy/profile ID, reason codes).
- **Operator/reviewer UI surfaces (if integrated):** "Verified by CoreGuard" attribution with link/reference to report details.

Brand usage should be governed by a mutual agreement (placement, wording, and co-branding rules) and must not imply endorsement by Salla, Pi Network, or any third party.

---

## 13. Commercial and partnership framing (pilot-friendly)

- **Pilot objective:** demonstrate measurable verification value on a narrow, real workflow.
- **Commercial model (to be agreed):** can be structured to minimize friction for end users (e.g. pilot-period terms, platform-level agreement, volume/tiered verification pricing, or outcome-aligned packaging) — subject to mutual agreement.
- **Strategic intent:** use Salla as a potential **design partner** while keeping the verification model **portable** to other marketplaces, wallets, and payment providers.
- **Claims discipline:** no exclusivity, endorsement, funding, user-count, or ecosystem-status claims are implied by this proposal.

---

## 14. Future roadmap (post-pilot, optional)

- **Commerce Shield expansion:** escrow release/refund integrity checks, delivery-to-settlement linkage.
- **Dispute Evidence Passport:** unified, review-ready evidence bundles with source attribution; AI-assisted summarization/conflict detection as **decision support only** (human authority retained).
- **Portable verification receipts:** reusable verification artifacts across merchants/platforms.
- **Agentic commerce authorization:** policy-bounded verification for agent-initiated purchases (spend limits, merchant/scope constraints).

---

## 15. Requested next step

1. **30-45 min technical discovery call** with a Salla engineering/product counterpart.
2. **Share sandbox/API materials** listed in Section 9 (sanitized).
3. **Confirm pilot scope** (Price + Payment Integrity, 100 EGP scenario + test matrix).
4. **Nominate technical owners** and agree on pilot timeline/checkpoints.

**Contact:** Eslam Kora — CoreGuard (`https://github.com/coreguard-global/CoreGuard`)  
**Companion docs:** `MVP-SPEC-AND-TEST-PLAN.md`, `OUTREACH-DRAFTS.md` (same folder)
