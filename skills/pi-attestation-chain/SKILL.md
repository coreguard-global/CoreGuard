---
name: pi-attestation-chain
description: Use when a Pi payment attestation chain must be checked for digest linkage and root agreement.
---

# Pi Attestation Chain

Use when a Pi payment attestation chain must be checked for digest linkage and root agreement.

## When to use

- use when a Pi payment attestation chain must be checked for digest linkage and root agreement.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_pi_attestation_chain` | Check link integrity and root digest. |
| 2 | `coreguard_verify_pi_payment_evidence` | Check the payment evidence packet against expectations. |
| 3 | `coreguard_export_evidence_pack` | Bundle the chain for a human reviewer. |

## Workflow

1. Attested/mock evidence only: no Pi API or mainnet settlement verification is performed.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
