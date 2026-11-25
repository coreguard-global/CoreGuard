---
name: agent-authority-scope-check
description: Use when an agent or subagent requests a new capability and you need to prove its authority is inherited, scoped and unexpired.
---

# Agent Authority Scope Check

Use when an agent or subagent requests a new capability and you need to prove its authority is inherited, scoped and unexpired.

## When to use

- use when an agent or subagent requests a new capability and you need to prove its authority is inherited, scoped and unexpired.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_payment_authorization_chain` | Check delegation continuity, expiry and signature markers. |
| 2 | `coreguard_verify_agent_authority_intersection` | Intersect principal, agent and requested scopes; name overreach. |
| 3 | `coreguard_verify_delegation_chain` | Verify the existing machine-economy delegation chain shape. |

## Workflow

1. Read the delegation chain, verify continuity and expiry, intersect scopes, and refuse any requested capability outside the inherited authority.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
