---
name: sanctions-evidence-gate
description: Use when you must evaluate a provided screening evidence packet before a payment or onboarding step. No live screening is performed.
---

# Sanctions evidence gate

Use when you must evaluate a provided screening evidence packet before a payment or onboarding step. No live screening is performed.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_sanctions_screening_evidence` | Use in workflow step 1 |
| 2 | `coreguard_generate_payment_compliance_packet` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |

## Workflow

1. Check result freshness and clear/no-match status; package evidence; freeze on critical failure.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
