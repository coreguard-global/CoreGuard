---
name: stellar-fee-sponsor-check
description: Use when a third party pays Stellar fees for an agent (fee bump or sponsored reserve) and the owner must confirm the sponsor is allowed and the inner transaction is the one that was approved.
---

# Stellar fee-sponsor check

A sponsored fee is a counterparty relationship. Bind the fee bump to the approved inner transaction, check the sponsor against policy, and cap the fee.

## When to use

- A fee-bump envelope arrives from a relayer or sponsor service.
- An agent account is created or maintained with sponsored reserves.
- A sponsor asks to raise the fee to prioritize a transaction.
- An auditor asks who paid for a transaction and whether that was approved.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_assess_stellar_fee_bump` | inner hash binding, sponsor allowlist, fee ceiling, source separation |
| 2 | `coreguard_verify_stellar_sponsored_reserve` | sponsor allowlist, sponsored account, entry count, reserve ceiling |
| 3 | `coreguard_verify_stellar_asset_allowlist` | confirm the sponsored asset identity |
| 4 | `coreguard_export_evidence_pack` | redacted pack for the owner or an auditor |

## Workflow

1. Pass `expectedInnerTxHash` so the fee bump is bound to the transaction the owner approved; an unbound fee bump can carry any inner transaction.
2. Check the fee against `maxFeeMinor`. A sponsor raising the fee is changing the deal, not optimizing it.
3. Confirm the outer source is on `allowedFeeSponsors` and differs from the inner source.
4. For reserves, check both entry count and reserve ceiling; sponsorship can be withdrawn later.
5. Export a redacted evidence pack and store its digest with the approval.

## Failure handling

| Result | Action |
|---|---|
| `HASH_MATCH` fails | reject the fee bump; it wraps a different transaction |
| `SPONSOR_ALLOWED` fails | do not sign; escalate to the owner |
| `FEE` fails | reject and ask for a new envelope inside the cap |
| `SEPARATION` fails | a self-sponsored bump is not sponsorship; re-check intent |

## Boundaries

- Nothing is signed, submitted or broadcast, and no fee is paid by this procedure.
- `VERIFIED ≠ SAFE`: an allowed sponsor can still be unreliable or withdraw support.
- Reserves and balances are caller-supplied facts, not ledger reads.
