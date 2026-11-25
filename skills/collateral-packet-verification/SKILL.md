---
name: collateral-packet-verification
description: Use when verifying collateral evidence packets for valuation, expiry, owner, and evidence digest before credit decisions.
---

# Collateral packet verification

Use when verifying collateral evidence packets for valuation, expiry, owner, and evidence digest before credit decisions.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_collateral_packet` | Use in workflow step 1 |
| 2 | `coreguard_assess_loan_application` | Use in workflow step 2 |
| 3 | `coreguard_audit_transaction` | Use in workflow step 3 |

## Workflow

1. Verify collateral, feed into loan assessment, audit decision.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
