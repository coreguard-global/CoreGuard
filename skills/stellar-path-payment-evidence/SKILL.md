---
name: stellar-path-payment-evidence
description: Use when a Stellar path-payment receipt needs structural verification without a Horizon call.
---

# Stellar Path Payment Evidence

Use when a Stellar path-payment receipt needs structural verification without a Horizon call.

## When to use

- use when a Stellar path-payment receipt needs structural verification without a Horizon call.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_path_payment` | Check status, assets, amounts, destination and path digest. |
| 2 | `coreguard_verify_stellar_settlement_evidence` | Cross-check the generic settlement evidence packet. |
| 3 | `coreguard_reconcile_multi_ledger` | Reconcile the payment with caller-supplied ledger sources. |

## Workflow

1. Evidence only: the tool does not query Horizon and does not claim settlement finality.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
