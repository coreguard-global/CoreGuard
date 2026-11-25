---
name: payment-dispute-evidence
description: Use when assembling evidence for a payment dispute: receipt, execution, invoice, and redacted packet.
---

# Payment dispute evidence

Use when assembling evidence for a payment dispute: receipt, execution, invoice, and redacted packet.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_receipt` | Use in workflow step 1 |
| 2 | `coreguard_verify_execution` | Use in workflow step 2 |
| 3 | `coreguard_verify_invoice_match` | Use in workflow step 3 |
| 4 | `coreguard_generate_payment_compliance_packet` | Use in workflow step 4 |

## Workflow

1. Verify receipt/execution, match invoice, generate redacted compliance packet.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
