---
name: fx-rate-lock-verification
description: Use when an agent holds an FX quote and must prove the locked rate was still valid for the exact intent amount at a pinned time.
---

# Fx Rate Lock Verification

Use when an agent holds an FX quote and must prove the locked rate was still valid for the exact intent amount at a pinned time.

## When to use

- use when an agent holds an FX quote and must prove the locked rate was still valid for the exact intent amount at a pinned time.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_fx_rate_lock` | Check rate, amount, quote and expiry against expected values. |
| 2 | `coreguard_assess_fx_quote_risk` | Check spread, provider and quote expiry. |
| 3 | `coreguard_verify_execution` | Bind the executed trace back to the approved intent. |

## Workflow

1. Use a pinned nowSeconds, compare the locked quote to the expected quote and refuse expired locks; no market data feed is used.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
