---
name: incident-escalation-packet
description: Use when a verification break must be escalated with a local war-room packet and exportable evidence.
---

# Incident Escalation Packet

Use when a verification break must be escalated with a local war-room packet and exportable evidence.

## When to use

- use when a verification break must be escalated with a local war-room packet and exportable evidence.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_incident_war_room` | Package incident metadata, events and actions. |
| 2 | `coreguard_export_evidence_pack` | Export a redacted evidence pack. |
| 3 | `coreguard_freeze_agent` | Freeze the agent in the local control plane when a store is configured. |

## Workflow

1. No external pager, regulator or counterparty is contacted; escalation stays a human decision.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
