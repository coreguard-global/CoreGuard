---
name: cross-border-payment-guard
description: Use when an agent initiates cross-border payments and you need corridor, amount, currency, and cutoff checks before execution.
---

# Cross-border payment guard

Use when an agent initiates cross-border payments and you need corridor, amount, currency, and cutoff checks before execution.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_cross_border_instruction` | Use in workflow step 1 |
| 2 | `coreguard_assess_fx_quote_risk` | Use in workflow step 2 |
| 3 | `coreguard_assess_sanctions_screening_evidence` | Use in workflow step 3 |
| 4 | `coreguard_freeze_agent` | Use in workflow step 4 |

## Workflow

1. Verify instruction against corridor policy, assess FX quote freshness/spread, check screening evidence, freeze on critical failure.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
