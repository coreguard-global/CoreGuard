---
name: stablecoin-reserve-evidence
description: Use when evaluating caller-supplied stablecoin reserve/attestation evidence for freshness and reserve ratio policy.
---

# Stablecoin reserve evidence

Use when evaluating caller-supplied stablecoin reserve/attestation evidence for freshness and reserve ratio policy.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stablecoin_reserve_evidence` | Use in workflow step 1 |
| 2 | `coreguard_generate_payment_compliance_packet` | Use in workflow step 2 |
| 3 | `coreguard_freeze_agent` | Use in workflow step 3 |

## Workflow

1. Check freshness and ratio; package evidence; freeze dependent flows on failure.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
