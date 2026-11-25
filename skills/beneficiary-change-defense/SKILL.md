---
name: beneficiary-change-defense
description: Use when an executed payment shows a different beneficiary, account or bank than the approved instruction.
---

# Beneficiary Change Defense

Use when an executed payment shows a different beneficiary, account or bank than the approved instruction.

## When to use

- use when an executed payment shows a different beneficiary, account or bank than the approved instruction.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_beneficiary_change` | Name changed fields and require re-approval. |
| 2 | `coreguard_verify_swift_remittance_evidence` | Check remittance evidence against expected accounts. |
| 3 | `coreguard_create_incident_war_room` | Package the drift for incident review. |

## Workflow

1. Treat any beneficiary/account/bank change as a critical break unless a fresh approval covers the executed values.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
