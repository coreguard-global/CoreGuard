---
name: sanctions-list-version-gate
description: Use when a screening result cites a list version and you need to check the stamped version and age without downloading a list.
---

# Sanctions List Version Gate

Use when a screening result cites a list version and you need to check the stamped version and age without downloading a list.

## When to use

- use when a screening result cites a list version and you need to check the stamped version and age without downloading a list.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_sanctions_list_version` | Compare list name, version and publication age to policy. |
| 2 | `coreguard_assess_sanctions_screening_evidence` | Check the caller-supplied screening result packet. |
| 3 | `coreguard_export_evidence_pack` | Record the stamps for later review. |

## Workflow

1. This is version-stamp evidence only: no list download, no screening run, no sanctions clearance claim.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
