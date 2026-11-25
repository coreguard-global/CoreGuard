---
name: bank-payment-ops
description: Use when a bank payment notification and transfer evidence must be checked together before an operator posts it.
---

# Bank Payment Ops

Use when a bank payment notification and transfer evidence must be checked together before an operator posts it.

## When to use

- use when a bank payment notification and transfer evidence must be checked together before an operator posts it.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_camt054_notification` | Validate the notification entries and balance. |
| 2 | `coreguard_verify_bank_transfer_evidence` | Match transfer evidence to expected values. |
| 3 | `coreguard_reconcile_multi_ledger` | Reconcile all caller-supplied sources. |

## Workflow

1. Operational evidence only: no bank core, statement feed or settlement finality is claimed.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
