---
name: defi-position-risk
description: Use when monitoring DeFi positions from supplied snapshots for health factor, LTV, and oracle freshness. No onchain call.
---

# DeFi position risk

Use when monitoring DeFi positions from supplied snapshots for health factor, LTV, and oracle freshness. No onchain call.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_defi_position_risk` | Use in workflow step 1 |
| 2 | `coreguard_detect_spend_anomaly` | Use in workflow step 2 |
| 3 | `coreguard_create_incident_war_room` | Use in workflow step 3 |

## Workflow

1. Assess position, detect anomalies, open incident packet on critical risk.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
