---
name: stellar-anchor-withdrawal-reconciliation
description: Use when an agent withdraws from a Stellar anchor to fiat and the payout, the Stellar payment and the internal ledger must reconcile into one evidence-backed verdict.
---

# Stellar anchor withdrawal reconciliation

Withdrawals fail quietly: the Stellar leg succeeds, the fiat leg stalls, and the ledger disagrees with both. Reconcile all three before closing a case.

## When to use

- A withdrawal is marked complete by an anchor but the bank credit is missing.
- A customer disputes the amount received after fees.
- The internal ledger shows a different amount than the Stellar transaction.
- Month-end reconciliation needs one verdict per withdrawal.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_sep24_anchor_evidence` | status, amounts, fee, quote expiry, Stellar tx id |
| 2 | `coreguard_verify_stellar_submission_evidence` | the Stellar leg against the bound authorization |
| 3 | `coreguard_reconcile_multi_ledger` | named breaks across anchor, chain and ledger |
| 4 | `coreguard_export_evidence_pack` | redacted pack per case |

## Workflow

1. Verify the anchor transaction evidence first; a `COMPLETED` status without a Stellar transaction id is not reconcilable.
2. Verify the Stellar submission against the authorization that covered it.
3. Reconcile the three sources on amount, currency and reference. Each break is named per source, so do not merge them into one "mismatch".
4. Report the fee explicitly; a withdrawal that nets less is not an error by itself.
5. Export one pack per case with customer identifiers redacted.

## Failure handling

| Result | Action |
|---|---|
| `FINAL` fails | keep the case open; the Stellar leg is unproven |
| `BREAKS` non-empty | route to the owning source, not to the customer |
| amount break only on fees | document, do not escalate as fraud |
| reference break | treat as a linkage risk and re-check the memo |

## Boundaries

- No anchor, bank or Horizon call; all three sources are caller-supplied.
- `VERIFIED ≠ SAFE`: reconciliation proves the numbers agree, not that the money is available.
- Nothing is paid out, reversed or filed by this procedure.
