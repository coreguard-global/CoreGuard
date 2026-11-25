---
name: camt054-notification-check
description: Use when a camt.054-like credit notification arrives and you need deterministic entry and balance checks before posting.
---

# Camt054 Notification Check

Use when a camt.054-like credit notification arrives and you need deterministic entry and balance checks before posting.

## When to use

- use when a camt.054-like credit notification arrives and you need deterministic entry and balance checks before posting.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_camt054_notification` | Parse entries, balance and message ids. |
| 2 | `coreguard_verify_bank_transfer_evidence` | Match the notification to bank transfer evidence. |
| 3 | `coreguard_reconcile_multi_ledger` | Include the notification in multi-ledger reconciliation. |

## Workflow

1. Check every entry's amount, currency and reference; no bank statement API is contacted.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
