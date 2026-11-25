---
name: incident-war-room
description: Use when a payment/agent/robot incident occurs and you need a deterministic evidence packet with timeline and actions.
---

# Incident war room

Use when a payment/agent/robot incident occurs and you need a deterministic evidence packet with timeline and actions.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_incident_war_room` | Use in workflow step 1 |
| 2 | `coreguard_incident_timeline` | Use in workflow step 2 |
| 3 | `coreguard_redact_receipt` | Use in workflow step 3 |

## Workflow

1. Assemble war-room packet, build timeline, redact sensitive fields for sharing.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
