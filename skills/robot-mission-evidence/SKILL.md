---
name: robot-mission-evidence
description: Use when verifying robot/agent mission execution evidence against a previously issued mission receipt.
---

# Robot mission evidence

Use when verifying robot/agent mission execution evidence against a previously issued mission receipt.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_robot_mission_evidence` | Use in workflow step 1 |
| 2 | `coreguard_create_incident_war_room` | Use in workflow step 2 |
| 3 | `coreguard_audit_transaction` | Use in workflow step 3 |

## Workflow

1. Verify mission evidence; open incident on drift; audit outcome.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
