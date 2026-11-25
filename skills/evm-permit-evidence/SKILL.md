---
name: evm-permit-evidence
description: Use when an EVM permit/allowance packet must be checked for spender, value, deadline and nonce before an agent signs anything.
---

# Evm Permit Evidence

Use when an EVM permit/allowance packet must be checked for spender, value, deadline and nonce before an agent signs anything.

## When to use

- use when an EVM permit/allowance packet must be checked for spender, value, deadline and nonce before an agent signs anything.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_evm_permit_evidence` | Check token, spender allowlist, value, deadline and nonce. |
| 2 | `coreguard_verify_web3_signature_evidence` | Check the caller-supplied signature evidence structure. |
| 3 | `coreguard_verify_token_approval_revocation` | Confirm any cleanup revocation evidence later. |

## Workflow

1. No RPC call and no signature recovery: the caller supplies every field and the tool checks structure and policy.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
