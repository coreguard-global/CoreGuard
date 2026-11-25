---
name: ubo-packet-verification
description: Use when you receive a beneficial-ownership packet and need deterministic checks on ownership sums and disclosure thresholds.
---

# Ubo Packet Verification

Use when you receive a beneficial-ownership packet and need deterministic checks on ownership sums and disclosure thresholds.

## When to use

- use when you receive a beneficial-ownership packet and need deterministic checks on ownership sums and disclosure thresholds.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_ubo_evidence` | Check owner ids, percentage sum and disclosure threshold. |
| 2 | `coreguard_generate_payment_compliance_packet` | Attach the packet digest to a review bundle. |
| 3 | `coreguard_export_evidence_pack` | Export a redacted pack for a compliance reviewer. |

## Workflow

1. Check that percentages sum to 100 and that at least one owner crosses the disclosure threshold; treat missing owners as a WARN, not a silent pass.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
