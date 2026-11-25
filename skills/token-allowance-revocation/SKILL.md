---
name: token-allowance-revocation
description: Use when cleaning up token approvals and you need evidence that a previous allowance was reduced to zero.
---

# Token Allowance Revocation

Use when cleaning up token approvals and you need evidence that a previous allowance was reduced to zero.

## When to use

- use when cleaning up token approvals and you need evidence that a previous allowance was reduced to zero.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_token_approval_revocation` | Check positive previous allowance and zero current allowance. |
| 2 | `coreguard_verify_evm_settlement_evidence` | Check the caller-supplied revocation transaction evidence. |
| 3 | `coreguard_create_incident_war_room` | Open a packet if a revocation cannot be evidenced. |

## Workflow

1. No transaction is broadcast and no chain state is read; the tool checks a caller-supplied receipt.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
