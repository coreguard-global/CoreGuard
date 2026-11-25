---
name: bridge-transfer-risk
description: Use when an agent plans a cross-chain bridge transfer and you need deterministic risk checks on route, quote expiry, and slippage.
---

# Bridge transfer risk

Use when an agent plans a cross-chain bridge transfer and you need deterministic risk checks on route, quote expiry, and slippage.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_bridge_risk` | Use in workflow step 1 |
| 2 | `coreguard_explain_decision` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |

## Workflow

1. Assess route at pinned time; block expired quotes or excessive slippage.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
