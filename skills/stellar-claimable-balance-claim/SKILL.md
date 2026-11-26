---
name: stellar-claimable-balance-claim
description: Use when an agent is offered a Stellar claimable balance (escrow, payout, refund) and must verify the claimants, amount, asset and time predicate before claiming.
---

# Stellar claimable-balance claim

A claimable balance is only as good as its predicate and its claimant list. Verify both before the agent spends a claim.

## When to use

- A counterparty funds a claimable balance as escrow or a delayed payout.
- An agent must decide whether it can claim now, later, or never.
- A refund arrives as a claimable balance instead of a payment.
- A reviewer needs the exact balance id and predicate that was accepted.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_claimable_balance` | claimants, amount, asset, sponsor and predicate window |
| 2 | `coreguard_verify_stellar_asset_allowlist` | the claimed asset is the approved one |
| 3 | `coreguard_verify_stellar_memo_binding` | bind the claim to the invoice or case reference |
| 4 | `coreguard_issue_stellar_session_receipt` | record the claim decision and cumulative spend |

## Workflow

1. Pin `nowSeconds`; predicate evaluation is meaningless against a moving clock.
2. Check `PREDICATE_TO` first. A not-after that has passed makes the balance unclaimable no matter what else matches.
3. Confirm the expected destination is a claimant, and that the amount and asset equal the approved values exactly (decimal strings, no rounding).
4. Bind the memo or case reference so the claim reconciles to the invoice.
5. Record the balance id and receipt digest; do not re-use a claim decision for a different balance.

## Failure handling

| Result | Action |
|---|---|
| `PREDICATE_TO` fails | report an expired offer; do not attempt a claim |
| `CLAIMANT` fails | the agent cannot claim; escalate |
| `AMOUNT` fails | reject partial or inflated offers |
| `ASSET` fails | stop; the asset identity is wrong |

## Boundaries

- No Horizon call and no claim operation is built or submitted.
- `VERIFIED ≠ SAFE`: a valid predicate does not prove the balance still exists on ledger.
- Predicates are simplified absolute-time checks; complex `and`/`or` predicates are caller-flattened.
