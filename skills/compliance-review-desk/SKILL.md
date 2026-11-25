---
name: compliance-review-desk
description: Use when assembling a human compliance review packet from travel-rule, AML and evidence-pack checks.
---

# Compliance Review Desk

Use when assembling a human compliance review packet from travel-rule, AML and evidence-pack checks.

## When to use

- use when assembling a human compliance review packet from travel-rule, AML and evidence-pack checks.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_travel_rule_packet` | Check packet completeness. |
| 2 | `coreguard_verify_aml_alert_disposition` | Check alert disposition evidence. |
| 3 | `coreguard_export_evidence_pack` | Export a redacted review pack. |

## Workflow

1. No filing, submission or regulatory decision is performed; the reviewer stays in the loop.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
