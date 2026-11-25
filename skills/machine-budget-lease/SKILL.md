---
name: machine-budget-lease
description: Use when a robot or machine needs a scoped, time-bounded spending lease before it performs work.
---

# Machine Budget Lease

Use when a robot or machine needs a scoped, time-bounded spending lease before it performs work.

## When to use

- use when a robot or machine needs a scoped, time-bounded spending lease before it performs work.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_machine_budget_lease` | Bind lease id, machine, scope, window and amount ceiling to a digest. |
| 2 | `coreguard_verify_machine_budget_consumption` | Verify later spend events against the lease. |
| 3 | `coreguard_meter_agent_usage` | Meter agent usage for the same period. |

## Workflow

1. Create the lease offline and never give a machine an unbounded scope; the tool does not control any device.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
