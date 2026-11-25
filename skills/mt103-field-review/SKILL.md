---
name: mt103-field-review
description: Use when an MT103-like field map needs mandatory-tag and 32A shape checks before a human reviews the transfer.
---

# Mt103 Field Review

Use when an MT103-like field map needs mandatory-tag and 32A shape checks before a human reviews the transfer.

## When to use

- use when an MT103-like field map needs mandatory-tag and 32A shape checks before a human reviews the transfer.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_mt103_fields` | Check mandatory tags and parse the 32A date/currency/amount. |
| 2 | `coreguard_verify_swift_remittance_evidence` | Match the field map to remittance evidence. |
| 3 | `coreguard_verify_beneficiary_change` | Detect beneficiary drift against the approved instruction. |

## Workflow

1. Report present and missing tags explicitly; a missing mandatory tag is a refusal, not a guessed default.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
