---
name: stellar-dex-slippage-guard
description: Use when an agent executes a Stellar DEX path payment or swap and the owner needs the effective slippage in basis points checked against a quote before signing.
---

# Stellar DEX slippage guard

Path payments hide slippage in the path and the amounts. Compare the executed destination amount to the quote and enforce a basis-point ceiling.

## When to use

- An agent swaps between two Stellar assets on behalf of a user.
- A path payment is proposed with several hops and a `sendMax`.
- A quote is stale and the destination amount moved.
- An operator asks why a swap executed at a worse rate than quoted.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_dex_path` | mode, hop count, amounts and effective slippage in bps |
| 2 | `coreguard_verify_stellar_asset_allowlist` | both assets are the approved ones |
| 3 | `coreguard_verify_stellar_trustline_policy` | the destination asset trustline can receive the amount |
| 4 | `coreguard_verify_stellar_path_payment` | settlement evidence once the swap lands |

## Workflow

1. Pin the quote: destination asset, destination amount and quote time. A quote without a reference amount cannot bound slippage.
2. Run the path check with an explicit `maxSlippageBps`; the default is deliberately tight.
3. Reject `strict_receive` envelopes whose `destAmount` is below the quote-derived floor.
4. Confirm both assets are allowlisted and the receiving trustline has capacity.
5. After settlement, verify the path-payment evidence and compare to the quote.

## Failure handling

| Result | Action |
|---|---|
| `SLIPPAGE` fails | do not sign; request a fresh quote |
| `PATH` fails | a direct payment may be cheaper; escalate instead of guessing hops |
| `MODE` fails | stop; unknown payment modes cannot be bounded |
| `SEND_MAX` fails | the cap is below the send amount and the envelope is inconsistent |

## Boundaries

- No DEX, order-book or Horizon call; quotes are caller-supplied.
- `VERIFIED ≠ SAFE`: slippage math does not model liquidity, fees or MEV.
- Decimal comparisons are exact; nothing is rounded to a float.
