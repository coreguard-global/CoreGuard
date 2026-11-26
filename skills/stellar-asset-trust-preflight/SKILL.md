---
name: stellar-asset-trust-preflight
description: Use before an agent pays with a Stellar asset to confirm the code and issuer are the approved ones (no lookalike), the trustline can carry the amount, and any sponsorship is allowed.
---

# Stellar asset trust preflight

The cheapest way to lose money on Stellar is to pay the right amount in the wrong asset. This procedure checks the asset identity, the trustline capacity and sponsored reserves before anything is signed.

## When to use

- A payment or DEX swap names an asset code supplied by a counterparty or a model.
- A new issuer appears in a corridor and the allowlist must be enforced.
- A trustline must carry a planned spend without hitting its limit.
- A sponsor offers to fund reserves for an agent account.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_asset_allowlist` | exact code+issuer match and confusable-code detection |
| 2 | `coreguard_verify_stellar_trustline_policy` | limit, authorization and missing lines against planned spend |
| 3 | `coreguard_verify_stellar_sponsored_reserve` | sponsor allowlist, entry count and reserve ceiling |
| 4 | `coreguard_evaluate_stellar_session_key` | confirm the asset is inside the agent's session policy |

## Workflow

1. Normalize nothing by hand: pass the code exactly as it appears on the envelope and let the tool compare it to the allowlist.
2. Treat `NO_CONFUSABLE` failure as a hard stop. `U5DC` and `USDC` are different strings; the tool folds lookalikes on purpose to catch this.
3. Check every planned spend against its trustline, including authorization when the issuer controls it.
4. When a sponsor is involved, verify the sponsor and the reserve ceiling; a sponsor is a counterparty, not a convenience.
5. Confirm the session policy allows the asset, then proceed to the envelope checks.

## Failure handling

| Result | Action |
|---|---|
| `EXACT_MATCH` fails | do not pay; ask the owner to approve the issuer explicitly |
| `NO_CONFUSABLE` fails | freeze the flow and report a possible impersonation attempt |
| `LIMIT_BELOW_SPEND` | reduce the amount or create a trustline with owner approval |
| `NOT_AUTHORIZED` | the issuer has not authorized the line; stop |

## Boundaries

- No issuer, anchor, DEX or Horizon call: asset identity is caller-supplied.
- `VERIFIED ≠ SAFE`: an allowlisted asset can still be frozen or worthless; this is not asset truth.
- Sponsorship checks do not move funds or create accounts.
