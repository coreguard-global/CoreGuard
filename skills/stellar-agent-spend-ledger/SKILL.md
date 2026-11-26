---
name: stellar-agent-spend-ledger
description: Use when an autonomous agent spends XLM or Stellar assets across many actions and you need a lease, a cumulative ledger and per-action receipts that prove the budget was never exceeded.
---

# Stellar agent spend ledger

Budgets fail at the seams: two workers, a retry, a second asset. Combine a time-boxed lease, exact consumption checks and per-action receipts.

## When to use

- An agent runs a long task with a fixed budget.
- Several workers share one Stellar account and must not double-spend a lease.
- A finance owner asks for the remaining budget at a point in time.
- A replay or duplicate reference could consume budget twice.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_create_machine_budget_lease` | time-boxed, scope-bound, digest-addressed budget |
| 2 | `coreguard_evaluate_stellar_session_key` | per-action ALLOW/DENY at the current cumulative spend |
| 3 | `coreguard_verify_machine_budget_consumption` | duplicate references, window and scope breaks, exact remaining |
| 4 | `coreguard_issue_stellar_session_receipt` | per-action receipt with before/after spend |

## Workflow

1. Create the lease with an explicit window, scope list and amount ceiling; keep `leaseDigest`.
2. For each action, pass `spentTodayMinor` from the lease ledger, not from the agent's own counter.
3. Record a unique `reference` per spend. The consumption check treats a repeated reference as a break and refuses to count it twice.
4. Emit a receipt per accepted action and chain `previousReceiptDigest`.
5. Reconcile remaining budget daily; a lease is a ceiling, not an entitlement.

## Failure handling

| Result | Action |
|---|---|
| `DUPLICATE_REFERENCE` | stop the worker; treat as a retry bug |
| `WINDOW` break | reject the spend; the lease has expired |
| `SCOPE` break | reject; the action is outside the lease |
| `BUDGET` fails | halt the agent and ask the owner for a new lease |

## Boundaries

- No chain call and no custody; the ledger is caller-maintained and process-local unless persisted by you.
- `VERIFIED ≠ SAFE`: a balanced ledger does not prove the merchant delivered.
- Receipts are evidence, not settlement proof.
