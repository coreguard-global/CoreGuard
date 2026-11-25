---
name: evidence-pack-export
description: Use when a reviewer needs a redacted, digest-rooted pack of evidence items and nothing should be submitted automatically.
---

# Evidence Pack Export

Use when a reviewer needs a redacted, digest-rooted pack of evidence items and nothing should be submitted automatically.

## When to use

- use when a reviewer needs a redacted, digest-rooted pack of evidence items and nothing should be submitted automatically.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_export_evidence_pack` | Redact fields, check item digests and compute a root. |
| 2 | `coreguard_attest_batch` | Optionally attest a batch of receipts before export. |
| 3 | `coreguard_verify_evidence_bundle` | Verify any attached evidence bundle. |

## Workflow

1. The pack is for human review; no regulator, court or counterparty is contacted by this skill.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
