---
name: robot-fleet-ops
description: Use when a robot fleet needs mission receipts, handoff chains and SLA evidence reviewed together.
---

# Robot Fleet Ops

Use when a robot fleet needs mission receipts, handoff chains and SLA evidence reviewed together.

## When to use

- use when a robot fleet needs mission receipts, handoff chains and SLA evidence reviewed together.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_robot_mission_receipt` | Bind a mission to zone, budget and window. |
| 2 | `coreguard_verify_robot_handoff_chain` | Verify machine-to-machine handoffs. |
| 3 | `coreguard_assess_machine_sla` | Assess downtime from caller-supplied events. |

## Workflow

1. No robot control or telemetry feed is used; VERIFIED ≠ SAFE for physical operations.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
