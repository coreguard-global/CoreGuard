---
name: fx-quote-risk-gate
description: Use when an agent is about to accept an FX quote and you need expiry, spread, and provider policy checks at a pinned time.
---

# FX quote risk gate

Use when an agent is about to accept an FX quote and you need expiry, spread, and provider policy checks at a pinned time.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_fx_quote_risk` | Use in workflow step 1 |
| 2 | `coreguard_explain_decision` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |

## Workflow

1. Assess quote at pinned nowSeconds; deny/freeze if expired or spread exceeds policy.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
