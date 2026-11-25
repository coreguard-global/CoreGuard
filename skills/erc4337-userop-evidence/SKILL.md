---
name: erc4337-userop-evidence
description: Use when an ERC-4337 UserOperation packet needs sender, nonce, gas and paymaster checks before bundling by a human.
---

# Erc4337 Userop Evidence

Use when an ERC-4337 UserOperation packet needs sender, nonce, gas and paymaster checks before bundling by a human.

## When to use

- use when an ERC-4337 UserOperation packet needs sender, nonce, gas and paymaster checks before bundling by a human.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_erc4337_userop_evidence` | Check calldata digest, signature marker, gas and paymaster policy. |
| 2 | `coreguard_verify_evm_permit_evidence` | Cross-check any related permit evidence. |
| 3 | `coreguard_export_evidence_pack` | Record the reviewed UserOperation evidence. |

## Workflow

1. No bundler or paymaster call and no signature recovery; this is packet-level evidence only.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
