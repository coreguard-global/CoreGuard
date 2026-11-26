---
name: stellar-replay-defense
description: Use when an agent retries Stellar submissions or processes a batch of payments, to prove no sequence or transaction hash is replayed and that each operation set matches what was approved.
---

# Stellar replay defense

Retries are where agents double-pay. Keep a seen set, enforce strict forward sequences, and compare every operation set to the approved one.

## When to use

- A submission timed out and the agent wants to retry.
- A batch of payments is processed by several workers.
- An operator needs evidence that a duplicate was blocked.
- A post-incident review asks how many times a transaction hash appeared.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_sequence_guard` | unseen sequence and hash, strictly forward, bounded gap |
| 2 | `coreguard_verify_stellar_operation_set` | count, order, type, destination, asset, amount and memo drift |
| 3 | `coreguard_verify_execution` | compare the executed trace to the approval receipt |
| 4 | `coreguard_issue_stellar_session_receipt` | chained receipt per accepted action |

## Workflow

1. Maintain a seen set of `{sequence, txHash}` per account and pass it on every check.
2. On timeout, check the hash before resubmitting: a timeout is not proof of failure.
3. Treat `NOT_REPLAYED_HASH` failure as a duplicate; never "retry harder".
4. Compare the operation set on every retry; a rebuilt envelope can silently change the memo or the destination.
5. Keep the receipt chain so the accepted count is auditable.

## Failure handling

| Result | Action |
|---|---|
| `NOT_REPLAYED_SEQ` / `NOT_REPLAYED_HASH` fails | stop; reconcile with the ledger owner |
| `FORWARD_ONLY` fails | refresh the account sequence from the owner, not from guesswork |
| `GAP` fails | investigate skipped sequences before continuing |
| `NO_DRIFT` fails | re-approve the operation set |

## Boundaries

- Offline only; the seen set and sequences are caller-supplied.
- `VERIFIED ≠ SAFE`: a clean guard does not prove the payment landed.
- This procedure never submits, cancels or replaces a transaction.
