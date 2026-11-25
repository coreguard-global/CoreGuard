---
name: travel-rule-packet-check
description: Use when a cross-border transfer needs a travel-rule packet reviewed for completeness before any human sends it.
---

# Travel Rule Packet Check

Use when a cross-border transfer needs a travel-rule packet reviewed for completeness before any human sends it.

## When to use

- use when a cross-border transfer needs a travel-rule packet reviewed for completeness before any human sends it.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_travel_rule_packet` | Check originator, beneficiary, VASP and amount fields. |
| 2 | `coreguard_verify_cross_border_instruction` | Check corridor and amount policy. |
| 3 | `coreguard_export_evidence_pack` | Export the packet and evidence for review. |

## Workflow

1. Verify packet completeness locally; this skill never transmits a travel-rule message or contacts a VASP.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
