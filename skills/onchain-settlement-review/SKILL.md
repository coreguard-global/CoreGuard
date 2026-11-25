---
name: onchain-settlement-review
description: Use when settlement evidence spans Stellar, EVM and Core DAO and must be checked on one deterministic surface.
---

# Onchain Settlement Review

Use when settlement evidence spans Stellar, EVM and Core DAO and must be checked on one deterministic surface.

## When to use

- use when settlement evidence spans Stellar, EVM and Core DAO and must be checked on one deterministic surface.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_path_payment` | Check Stellar path-payment evidence. |
| 2 | `coreguard_verify_evm_permit_evidence` | Check EVM permit evidence. |
| 3 | `coreguard_verify_coredao_delegation_evidence` | Check Core DAO delegation evidence. |

## Workflow

1. No chain RPC or Horizon call is made; each tool checks only the supplied packet.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
