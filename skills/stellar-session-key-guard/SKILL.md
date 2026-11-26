---
name: stellar-session-key-guard
description: Use when an AI agent holds a scoped Stellar session key and is about to sign or submit a payment, Soroban call, or DEX swap, and the owner needs a fail-closed ALLOW/DENY before any bytes are signed.
---

# Stellar session-key guard

Turn an owner-approved session policy into a deterministic decision for one concrete action, then emit a receipt the owner can audit later. Offline, exact-integer, no RPC.

## When to use

- An agent's Stellar session key is about to be used for a payment, a Soroban invoke, or a path payment.
- The owner needs to know *which* rule blocked an action, not just that it was blocked.
- A spend must be checked against both a per-action cap and a rolling daily budget.
- A reviewer asks "was this action inside the session the owner approved?".

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_compile_stellar_session_policy` | canonicalize scopes, assets, caps and the validity window into one digest |
| 2 | `coreguard_evaluate_stellar_session_key` | ALLOW/DENY one action at a pinned time and cumulative spend |
| 3 | `coreguard_verify_stellar_session_key_scope` | prove the session never exceeds the principal's authority |
| 4 | `coreguard_issue_stellar_session_receipt` | bind policy + action + spend into a chained receipt |

## Workflow

1. **Compile once per session.** Keep `policyDigest`; it is the version the owner approved. Amounts are integer minor units as strings, never floats.
2. **Evaluate every action.** Pass `nowSeconds` (pinned digits) and `spentTodayMinor` from your own ledger. The result is `ALLOW` or `DENY` with named reasons.
3. **Read the counterfactual as advice, not consent.** It names one change that would clear the first rule; applying it still requires the owner.
4. **Never retry a DENY with a rewritten action.** Surface the reason to the owner or stop the agent.
5. **Issue a receipt per allowed action** with `spentMinorBefore`/`spentMinorAfter` and `previousReceiptDigest` for the chain.

## Failure handling

| Result | Action |
|---|---|
| `DENY` with `PER_ACTION_CAP_EXCEEDED` | do not split the payment to dodge the cap; ask the owner |
| `DENY` with `DAILY_LIMIT_EXCEEDED` | stop until the owner raises the limit or the window rolls |
| `DENY` with `SESSION_EXPIRED` | request a new signed owner policy; never extend it yourself |
| `WARN` (HIGH checks failed) | treat as a stop for value-moving actions |

## Boundaries

- No Stellar RPC, Horizon or Soroban call; no signing, submission or broadcast.
- `VERIFIED ≠ SAFE`: an ALLOW means the action matched the supplied policy, not that the counterparty is honest or the asset is real.
- Every input is caller-supplied; the server never reads the wall clock into a commitment.
