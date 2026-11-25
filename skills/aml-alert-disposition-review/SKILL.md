---
name: aml-alert-disposition-review
description: Use when reviewing a caller-supplied AML alert disposition packet for reviewer, rationale, timing and case linkage.
---

# Aml Alert Disposition Review

Use when reviewing a caller-supplied AML alert disposition packet for reviewer, rationale, timing and case linkage.

## When to use

- use when reviewing a caller-supplied AML alert disposition packet for reviewer, rationale, timing and case linkage.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_aml_alert_disposition` | Check disposition, reviewer, rationale and review sequence. |
| 2 | `coreguard_verify_evidence_bundle` | Verify the integrity of attached evidence. |
| 3 | `coreguard_create_incident_war_room` | Open a local war-room packet if the disposition is incomplete. |

## Workflow

1. Inspect the disposition packet, confirm review follows detection, and escalate incomplete packets to a human reviewer; no alert is generated or reported.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
