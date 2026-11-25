---
name: credit-line-utilization
description: Use when monitoring credit line utilization and enforcing deterministic threshold actions.
---

# Credit line utilization

Use when monitoring credit line utilization and enforcing deterministic threshold actions.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_credit_line_utilization` | Use in workflow step 1 |
| 2 | `coreguard_budget_runway` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |

## Workflow

1. Assess utilization, compute runway, freeze/alert on breach.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
