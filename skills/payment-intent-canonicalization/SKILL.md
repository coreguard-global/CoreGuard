---
name: payment-intent-canonicalization
description: Use when an agent is about to approve a payment instruction and you need a canonical, digest-bound object before any consent receipt is issued.
---

# Payment Intent Canonicalization

Use when an agent is about to approve a payment instruction and you need a canonical, digest-bound object before any consent receipt is issued.

## When to use

- use when an agent is about to approve a payment instruction and you need a canonical, digest-bound object before any consent receipt is issued.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_canonicalize_payment_instruction` | Normalize payer, payee, amount, currency and corridor into one digest. |
| 2 | `coreguard_authorize` | Bind the canonical intent to consent after the digest is reviewed. |
| 3 | `coreguard_verify_cross_border_instruction` | Check corridor policy before the approval is spent. |

## Workflow

1. Canonicalize first, compare the digest with the human-readable instruction, then authorize and check corridor policy. Never let an agent rewrite fields to make a check pass.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
