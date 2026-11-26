---
name: stellar-anchor-deposit-verify
description: Use when an agent deposits fiat through a Stellar anchor (SEP-24/SEP-31) and must verify the authenticated anchor, the transaction status, amounts, fee and quote expiry before crediting an order.
---

# Stellar anchor deposit verification

Anchor flows cross three systems: the fiat rail, the anchor's API and Stellar. Verify the anchor identity and the transaction evidence, then reconcile the amounts.

## When to use

- A customer's fiat deposit is reported complete by a SEP-24 anchor.
- An agent credits an order only after an anchor says `completed`.
- A withdrawal must reconcile against the Stellar transaction that paid out.
- A fee or quote looks different from what the customer approved.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_sep10_challenge` | confirm the session belongs to the expected anchor and network |
| 2 | `coreguard_verify_stellar_sep24_anchor_evidence` | kind, status, amounts, fee, quote expiry and Stellar tx id |
| 3 | `coreguard_verify_stellar_memo_binding` | bind the deposit memo to the customer reference |
| 4 | `coreguard_export_evidence_pack` | redacted pack for finance review |

## Workflow

1. Authenticate first: verify the SEP-10 challenge against the anchor's known home domain and server key.
2. Require `stellarTransactionId` on any `COMPLETED` transaction; a completion without a Stellar transaction is unproven.
3. Compare `amountOut` to the approved floor, never to the anchor's own display value.
4. Check the fee is non-negative and matches the quoted fee; a fee change after approval is a new decision.
5. Reject expired quotes even when the status says pending, and export the evidence with sensitive fields redacted.

## Failure handling

| Result | Action |
|---|---|
| `FINAL` fails | do not credit; the anchor has not named a Stellar transaction |
| `MIN_OUT` fails | credit the actual amount only, with owner approval |
| `EXPIRY` fails | request a new quote; do not reuse the old one |
| `FEE` fails | escalate; a negative or unknown fee is a data error |

## Boundaries

- No anchor API, bank or Horizon call; all evidence is caller-supplied.
- `VERIFIED ≠ SAFE`: anchor evidence is not a licence, solvency proof or regulatory approval.
- The procedure never credits an account, moves fiat or submits a Stellar payment.
