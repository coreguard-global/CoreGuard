---
name: stellar-envelope-window-guard
description: Use before submitting a Stellar transaction envelope to confirm its time bounds, ledger bounds, memo binding and sequence are all valid and non-replayed at a pinned clock.
---

# Stellar envelope window guard

Four cheap offline checks that catch the most common agent-submission failures: a stale envelope, a memo that does not match the invoice, and a replayed sequence.

## When to use

- An envelope was built earlier (or by another service) and is now about to be submitted.
- A payment must carry an invoice-bound memo and you need proof it does.
- A retry loop might resubmit a transaction hash that already landed.
- An operator asks "is this envelope still valid right now?".

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_time_bounds` | min/max time, ledger window and maximum duration |
| 2 | `coreguard_verify_stellar_memo_binding` | memo type and value against the approved invoice digest |
| 3 | `coreguard_verify_stellar_sequence_guard` | sequence and hash unseen, strictly forward, gap within policy |
| 4 | `coreguard_verify_stellar_operation_set` | the operations inside the envelope match the approved set |

## Workflow

1. Pin `nowSeconds` and `currentLedger` from one observation and keep them for the whole check.
2. Verify the time and ledger window. A `maxTime` in the past is a hard stop, even if the envelope is otherwise valid.
3. Bind the memo. Reject `HASH` memos that are not 64 hex characters and `ID` memos outside the unsigned 64-bit range.
4. Compare the sequence to the seen set and to the highest observed sequence.
5. Compare the operation list positionally; count, order, type, destination, asset, amount and memo drift are reported separately.

## Failure handling

| Result | Action |
|---|---|
| `NOT_EXPIRED` fails | rebuild the envelope; never extend maxTime in place |
| `MEMO_PRESENT` / `VALUE_MATCH` fails | stop; a memo mismatch breaks reconciliation |
| `NOT_REPLAYED_SEQ` fails | treat as a duplicate submission, not a retry |
| `COUNT_DRIFT` | re-approve the whole operation set with the owner |

## Boundaries

- No Horizon call: the envelope facts are caller-supplied.
- `VERIFIED ≠ SAFE` and not settlement finality; a valid window does not make the payment correct.
- The guard never mutates an envelope or rebuilds it for you.
