---
name: loan-file-evidence
description: Use when a loan file needs deterministic checks on application metrics, collateral and ownership packets.
---

# Loan File Evidence

Use when a loan file needs deterministic checks on application metrics, collateral and ownership packets.

## When to use

- use when a loan file needs deterministic checks on application metrics, collateral and ownership packets.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_loan_application` | Check DTI, amount and tenor against policy. |
| 2 | `coreguard_verify_collateral_packet` | Check valuation, expiry and evidence digest. |
| 3 | `coreguard_verify_ubo_evidence` | Check the ownership packet for the applicant entity. |

## Workflow

1. No credit bureau, bank core or regulatory credit decision is made; evidence only.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
