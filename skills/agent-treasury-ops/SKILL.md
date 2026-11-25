---
name: agent-treasury-ops
description: Use when operating an agent treasury with spend limits, runway, anomaly detection, and freeze controls.
---

# Agent treasury ops

Use when operating an agent treasury with spend limits, runway, anomaly detection, and freeze controls.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_budget_runway` | Use in workflow step 1 |
| 2 | `coreguard_detect_spend_anomaly` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |
| 4 | `coreguard_audit_transaction` | Use in workflow step 4 |

## Workflow

1. Monitor runway, detect anomalies, freeze on breach, audit all actions.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
