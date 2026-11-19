# MVP Spec & Test Plan — Price + Payment Integrity (Salla Shop Pilot)

**Companion to:** `COREGUARD-SALLA-SHOP-TECHNICAL-PILOT-PROPOSAL-v1.0.md`  
**Scope:** Phase 1 pilot (sandbox-first). This document defines proposed artifacts, interfaces, reason codes, and acceptance tests for a narrow, measurable integration.

---

## 1. Objectives

1. Prove that CoreGuard can independently verify consistency between an **approved quote/consent**, a **server-observed payment**, and the **order context**.
2. Produce **named outcomes** (`VERIFIED`, `MISMATCH`, `EXPIRED`, `REPLAY_DETECTED`, `PENDING`, `UNKNOWN`) with machine-readable reason codes.
3. Demonstrate replay/idempotency handling and webhook/event robustness in sandbox scenarios.
4. Deliver an evidence/report package suitable for technical evaluation.

**Non-goals (Phase 1):** replacing Salla payment/escrow/dispute systems, production rollout, mainnet/live-funds operation, automated dispute adjudication, or guarantees of fraud prevention.

---

## 2. Domain objects (proposed)

### 2.1 Verifiable Price Quote (VPQ)
A bound record of what was priced and shown for approval.

**Suggested fields (minimum):**
- `quote_id` (unique)
- `order_id` / `cart_id` / line-item references (as applicable)
- `merchant_id` and/or receiving context reference
- `fiat_amount` + `fiat_currency` (e.g. `100.00 EGP`)
- `pi_amount` + precision/rounding rule
- `rate_source` metadata (provider, pair/symbol, endpoint/classification, timestamp, raw inputs used)
- `fx_context` (if conversion path requires intermediate FX)
- `calculation_version` / formula reference
- `created_at`, `expires_at`
- `integrity` (hash/signature/binding metadata per chosen profile)

### 2.2 Consent/Approval Receipt (CGCR)
A bound record that the user approved a specific quote/order intent.

**Suggested fields (minimum):**
- `consent_id`
- `quote_id` (binding)
- `approved_amount` (Pi and/or fiat context as displayed)
- `approved_recipient` / merchant context
- `approved_at`
- `actor_context` (pseudonymous/session reference as permitted)
- `policy_profile` / scope
- `integrity` metadata

### 2.3 Payment Observation (server-side)
Normalized input from Salla backend (not client UI).

**Suggested fields (minimum):**
- `order_id`, `payment_id` / tx reference
- `observed_amount`, `asset/currency`, `network/environment`
- `payer/payee` or recipient/wallet context (as available/appropriate)
- `status` and confirmation/finality indicators
- `event_id`, `event_type`, `event_time`, `idempotency_key`
- `webhook_signature_valid` (or verification result)
- source metadata (API query vs webhook, timestamps)

---

## 3. Verification states and reason codes

### 3.1 Primary states
| State | Meaning | Typical handling (policy-defined) |
|---|---|---|
| `VERIFIED` | Required checks passed | Proceed / record evidence |
| `MISMATCH` | Data conflict detected | Hold/review/block per policy |
| `EXPIRED` | Validity window elapsed | Request new quote/consent |
| `REPLAY_DETECTED` | Reuse/duplicate settlement signal | Block duplicate effect; alert/review |
| `PENDING` | Awaiting required confirmation/evidence | Wait/retry with backoff |
| `UNKNOWN` | Insufficient or untrusted evidence | Fail closed for settlement-critical actions |

### 3.2 Proposed reason codes (initial set)
| Code | State | Description |
|---|---|---|
| `AMOUNT_UNDERPAID` | `MISMATCH` | Observed amount < approved amount (beyond tolerance) |
| `AMOUNT_OVERPAID` | `MISMATCH` | Observed amount > approved amount (beyond tolerance) |
| `RECIPIENT_MISMATCH` | `MISMATCH` | Payee/recipient differs from approved/expected context |
| `ORDER_BINDING_MISMATCH` | `MISMATCH` | `order_id` / `payment_id` linkage inconsistent |
| `ORDER_CONTEXT_MISMATCH` | `MISMATCH` | Order terms changed after consent without re-approval |
| `CURRENCY_OR_NETWORK_MISMATCH` | `MISMATCH` | Asset/network/environment differs from expected |
| `QUOTE_EXPIRED` | `EXPIRED` | Quote/approval expired before valid completion |
| `PAYMENT_REUSED` | `REPLAY_DETECTED` | Same payment proof/tx applied to conflicting context |
| `DUPLICATE_EVENT` | `REPLAY_DETECTED` / idempotent-noop | Event key already processed (no second effect) |
| `CONFIRMATION_PENDING` | `PENDING` | Observed but required confirmation threshold not met |
| `EVIDENCE_INSUFFICIENT` | `UNKNOWN` | Missing required fields/source confirmation |
| `WEBHOOK_INVALID` | `UNKNOWN` / rejected | Signature invalid, schema invalid, or untrusted event |

> Final taxonomy to be aligned with Salla domain semantics during discovery.

---

## 4. Adapter and API shape (proposed for pilot)

### 4.1 Integration approach
- Implement a **Salla Integration Adapter** (backend-side) that normalizes Salla objects/events into CoreGuard verification inputs.
- Reuse/extend existing CoreGuard Agent Commerce verification primitives where they fit (`authorize`, `consent-verify`, `verify`, `risk-assess`) and add pilot-specific endpoints/modules only as needed.

### 4.2 Illustrative pilot endpoints (to be finalized)
| Method | Endpoint (illustrative) | Purpose |
|---|---|---|
| `POST` | `/v1/pilot/quote` | Register/bind a VPQ |
| `POST` | `/v1/pilot/consent` | Register/bind CGCR against quote |
| `POST` | `/v1/pilot/payment/verify` | Verify server-observed payment against quote/consent/order |
| `POST` | `/v1/pilot/webhook/verify` | Validate and idempotently process webhook event signal |
| `GET` | `/v1/pilot/report/:id` | Retrieve verification report/evidence summary |
| `GET` | `/health` | Liveness |

### 4.3 Verification report (minimum contents)
- `result_state`, `reason_codes[]`
- Evaluated identifiers (`quote_id`, `consent_id`, `order_id`, `payment_id`, `event_id`)
- Check-by-check outcomes (quote validity, amount, recipient, binding, confirmation, replay/idempotency)
- Evidence references (hashes/IDs/timestamps; source class)
- Verifier metadata (name: CoreGuard, version/profile, evaluation time/context)
- Explicit limitations/unknowns for the evaluation

---

## 5. Test plan (sandbox)

### 5.1 Test environment prerequisites
- Sandbox/test API access and credentials (scoped, non-production).
- Ability to generate or replay sanitized sample events: quote creation, approval, payment status updates, webhooks (including duplicates/invalid cases).
- Agreement on confirmation threshold(s) and rounding/tolerance rules.
- Isolated idempotency/replay store for test runs.

### 5.2 Core scenarios (10)

| ID | Scenario | Setup | Expected state | Expected reason/check |
|---|---|---|---|---|
| T-01 | Happy path | Quote valid; amount/recipient/bindings match; confirmation met | `VERIFIED` | All required checks pass |
| T-02 | Underpayment | Observed amount below approved | `MISMATCH` | `AMOUNT_UNDERPAID` |
| T-03 | Overpayment | Observed amount above approved | `MISMATCH` | `AMOUNT_OVERPAID` |
| T-04 | Recipient substitution | Different recipient/wallet context | `MISMATCH` | `RECIPIENT_MISMATCH` |
| T-05 | Quote expiry | Payment completes after `expires_at` | `EXPIRED` | `QUOTE_EXPIRED` |
| T-06 | Payment reuse | Same tx/payment proof applied to second order | `REPLAY_DETECTED` | `PAYMENT_REUSED` |
| T-07 | Duplicate webhook | Same `event_id` delivered twice | No double effect | `DUPLICATE_EVENT` (idempotent handling) |
| T-08 | Invalid webhook | Bad signature or malformed payload | Rejected/`UNKNOWN` (policy-defined) | `WEBHOOK_INVALID` |
| T-09 | Pending confirmation | Payment seen, confirmation threshold not met | `PENDING` | `CONFIRMATION_PENDING` |
| T-10 | Post-consent order change | Order terms changed without new consent | `MISMATCH` | `ORDER_CONTEXT_MISMATCH` |

### 5.3 Extended scenarios (recommended)
| ID | Scenario | Expected outcome |
|---|---|---|
| T-11 | Partial refund exceeds remaining refundable amount | `MISMATCH` / policy violation (refund-integrity code) |
| T-12 | Refund to unexpected recipient/context | `MISMATCH` |
| T-13 | Conflicting status events (out-of-order delivery) | Deterministic resolution per state model or `UNKNOWN` with evidence gap |
| T-14 | Rate/quote source metadata missing | `UNKNOWN` (`EVIDENCE_INSUFFICIENT`) for quote-integrity claims |

### 5.4 Acceptance criteria (pilot)
- All T-01–T-10 scenarios execute in sandbox with documented inputs/outputs.
- Each non-`VERIFIED` result includes at least one actionable reason code and evidence reference.
- Duplicate events (T-07) produce no double settlement side-effect in the verification/idempotency layer.
- Reports clearly distinguish `PENDING`/`UNKNOWN` from `VERIFIED` and from `MISMATCH`.
- Limitations and unverified assumptions are recorded explicitly.

---

## 6. Deliverables

1. **Integration spec (discovery output):** field mappings, source-of-truth matrix, event/state diagrams.
2. **Pilot adapter + configuration:** sandbox-capable Salla/CoreGuard mapping and verification flow.
3. **Test evidence package:** scenario definitions, inputs (sanitized), outputs, logs/reports.
4. **Pilot evaluation report:** results, observed gaps, security/ops recommendations, Phase 2 plan.
5. **Brand-attributed verification report template:** CoreGuard verifier metadata and attribution placement (subject to partner approval).

---

## 7. Open decisions (to finalize in discovery)

- Authoritative confirmation/finality threshold for "payment verified" in Pi/Salla context.
- Allowed rounding/tolerance rules for fiat↔Pi conversion.
- Quote TTL/expiry policy and re-consent behavior.
- Canonical identifiers for idempotency keys across webhooks and API queries.
- Data retention, redaction, and evidence access model.
- Production hardening scope and deployment ownership boundaries.
