---
name: coredao-delegation-evidence
description: Use when a Core DAO delegation or staking packet needs chain-id, validator and unbonding checks without RPC.
---

# Coredao Delegation Evidence

Use when a Core DAO delegation or staking packet needs chain-id, validator and unbonding checks without RPC.

## When to use

- use when a Core DAO delegation or staking packet needs chain-id, validator and unbonding checks without RPC.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_coredao_delegation_evidence` | Check chain 1116, validator allowlist, amount and unbonding policy. |
| 2 | `coreguard_verify_coredao_settlement_evidence` | Cross-check related settlement evidence. |
| 3 | `coreguard_export_evidence_pack` | Export the delegation packet for review. |

## Workflow

1. No Core DAO RPC or contract call is made; the verdict describes the supplied packet only.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
