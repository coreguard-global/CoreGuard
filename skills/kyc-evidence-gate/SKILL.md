---
name: kyc-evidence-gate
description: Use when a counterparty supplies KYC evidence and you need a freshness/document gate without claiming a live KYC decision.
---

# Kyc Evidence Gate

Use when a counterparty supplies KYC evidence and you need a freshness/document gate without claiming a live KYC decision.

## When to use

- use when a counterparty supplies KYC evidence and you need a freshness/document gate without claiming a live KYC decision.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_kyc_evidence` | Check result, freshness, documents and provider allowlist. |
| 2 | `coreguard_verify_ubo_evidence` | Cross-check the ownership packet for the same entity. |
| 3 | `coreguard_generate_payment_compliance_packet` | Bundle the evidence for human review. |

## Workflow

1. Gate on caller-supplied evidence only. A PASS means the packet is complete and fresh at the pinned time, not that identity is verified by a provider.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
