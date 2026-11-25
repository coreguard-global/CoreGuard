---
name: multi-chain-reconciliation
description: Use when reconciling payment evidence across Stellar, EVM, Core DAO, or Pi-supplied evidence packets.
---

# Multi-chain reconciliation

Use when reconciling payment evidence across Stellar, EVM, Core DAO, or Pi-supplied evidence packets.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_settlement_evidence` | Use in workflow step 1 |
| 2 | `coreguard_verify_evm_settlement_evidence` | Use in workflow step 2 |
| 3 | `coreguard_verify_coredao_settlement_evidence` | Use in workflow step 3 |
| 4 | `coreguard_verify_pi_payment_evidence` | Use in workflow step 4 |

## Workflow

1. Verify chain-specific evidence packets against expected intent and produce a reconciliation report.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
