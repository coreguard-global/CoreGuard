---
name: machine-economy-treasury
description: Use when metering agent usage, budgeting machine spend and checking runway for a machine-economy deployment.
---

# Machine Economy Treasury

Use when metering agent usage, budgeting machine spend and checking runway for a machine-economy deployment.

## When to use

- use when metering agent usage, budgeting machine spend and checking runway for a machine-economy deployment.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_machine_budget_lease` | Create a scoped spend lease. |
| 2 | `coreguard_meter_agent_usage` | Meter usage events for the agent. |
| 3 | `coreguard_budget_runway` | Check runway against pinned spend events. |

## Workflow

1. Deterministic local accounting only; no treasury custody, payout or settlement is performed.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
