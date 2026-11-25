---
name: web3-approval-safety
description: Use when an agent holds token approvals and you need permit, revocation and signature evidence reviewed together.
---

# Web3 Approval Safety

Use when an agent holds token approvals and you need permit, revocation and signature evidence reviewed together.

## When to use

- use when an agent holds token approvals and you need permit, revocation and signature evidence reviewed together.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_evm_permit_evidence` | Check permit structure and policy. |
| 2 | `coreguard_verify_token_approval_revocation` | Check revocation evidence. |
| 3 | `coreguard_verify_web3_signature_evidence` | Check recovered/claimed signer evidence. |

## Workflow

1. No wallet, key custody, RPC or signature recovery is performed by these tools.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
