---
name: robot-handoff-chain
description: Use when a robot task is handed from one machine to another and you need continuity and digest-linkage checks.
---

# Robot Handoff Chain

Use when a robot task is handed from one machine to another and you need continuity and digest-linkage checks.

## When to use

- use when a robot task is handed from one machine to another and you need continuity and digest-linkage checks.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_robot_handoff_chain` | Check task id, continuity, time order and digest chain. |
| 2 | `coreguard_verify_robot_mission_evidence` | Verify execution evidence against the mission receipt. |
| 3 | `coreguard_assess_machine_sla` | Assess downtime around the handoffs. |

## Workflow

1. No telemetry source is contacted; every handoff record is caller-supplied.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
