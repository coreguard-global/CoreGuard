---
name: multi-ledger-reconciliation
description: Use when payment, invoice and internal ledger records must be reconciled and the breaks named explicitly.
---

# Multi Ledger Reconciliation

Use when payment, invoice and internal ledger records must be reconciled and the breaks named explicitly.

## When to use

- use when payment, invoice and internal ledger records must be reconciled and the breaks named explicitly.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_reconcile_multi_ledger` | Compare every source to expected amount/currency and list breaks. |
| 2 | `coreguard_verify_invoice_match` | Match invoice fields to payment evidence. |
| 3 | `coreguard_export_evidence_pack` | Bundle the reconciliation for review. |

## Workflow

1. Reconcile with caller-supplied sources only. A break is a named field, never a silent adjustment.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
