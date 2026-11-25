---
name: machine-to-machine-micropayments
description: Use when machines/agents make high-frequency micropayments and need metering, budget, and settlement evidence checks.
---

# Machine-to-machine micropayments

Use when machines/agents make high-frequency micropayments and need metering, budget, and settlement evidence checks.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_meter_agent_usage` | Use in workflow step 1 |
| 2 | `coreguard_budget_runway` | Use in workflow step 2 |
| 3 | `coreguard_verify_x402_settlement` | Use in workflow step 3 |
| 4 | `coreguard_assess_credit_line_utilization` | Use in workflow step 4 |

## Workflow

1. Meter usage, enforce runway/credit line, verify settlement evidence.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
