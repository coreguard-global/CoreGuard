---
name: cross-border-payment-review
description: Use when reviewing a cross-border payment end to end from canonical intent through corridor policy to reconciliation.
---

# Cross Border Payment Review

Use when reviewing a cross-border payment end to end from canonical intent through corridor policy to reconciliation.

## When to use

- use when reviewing a cross-border payment end to end from canonical intent through corridor policy to reconciliation.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_canonicalize_payment_instruction` | Freeze the instruction bytes and digest. |
| 2 | `coreguard_verify_cross_border_instruction` | Check corridor, currency, amount and cutoff policy. |
| 3 | `coreguard_reconcile_multi_ledger` | Reconcile payment, ledger and settlement sources. |

## Workflow

1. Keep every stage caller-supplied and pinned; this skill never contacts a bank, SWIFT or a regulator.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
