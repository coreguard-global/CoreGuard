---
name: inference-receipt
description: Use when an agent makes a model call and you need a deterministic receipt binding prompt, output, policy, cost and latency.
---

# Inference Receipt

Use when an agent makes a model call and you need a deterministic receipt binding prompt, output, policy, cost and latency.

## When to use

- use when an agent makes a model call and you need a deterministic receipt binding prompt, output, policy, cost and latency.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_inference_receipt` | Bind caller-supplied digests and metrics to a receipt digest. |
| 2 | `coreguard_redact_receipt` | Redact sensitive fields before sharing. |
| 3 | `coreguard_export_evidence_pack` | Export the receipt for review. |

## Workflow

1. A receipt is not a correctness, safety or permission claim; it only binds the supplied digests.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
