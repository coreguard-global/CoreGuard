---
name: stellar-operation-drift-forensics
description: Use after a Stellar transaction differs from what was approved, to name the exact drift class (count, order, type, destination, asset, amount, memo) and produce a reviewable evidence pack.
---

# Stellar operation drift forensics

When a payment goes wrong, the useful answer is not "it drifted" but which field, at which index, from what to what. Produce that, then package it.

## When to use

- A dispute or incident review needs the exact difference between approved and executed operations.
- An agent reports success but the merchant reports a different amount or destination.
- A batch shows more operations than were approved.
- An auditor asks for reproducible evidence rather than screenshots.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_operation_set` | positional drift with named classes and indexes |
| 2 | `coreguard_verify_stellar_memo_binding` | the memo that travelled versus the approved one |
| 3 | `coreguard_verify_stellar_time_bounds` | whether the envelope window explains a late submission |
| 4 | `coreguard_export_evidence_pack` | redacted, digest-rooted pack for review |

## Workflow

1. Reconstruct the approved operation list from the consent receipt, not from memory or logs.
2. Reconstruct the executed list from the envelope bytes or the submission evidence.
3. Run the comparison and record every drift entry with its index; do not summarize away the index.
4. Check the memo and the time window as separate causes before concluding intent.
5. Export a pack with customer identifiers redacted and record its root digest.

## Failure handling

| Result | Action |
|---|---|
| `COUNT_DRIFT` | treat as a possible injected operation; escalate immediately |
| `DESTINATION_DRIFT` | freeze the agent and preserve the envelope bytes |
| `AMOUNT_DRIFT` | quote the exact minor-unit difference in the report |
| `NO_DRIFT` but value moved | the drift is outside the operations; investigate the asset and fee |

## Boundaries

- Offline comparison only; nothing is fetched from Horizon.
- `VERIFIED ≠ SAFE`: a clean comparison does not prove the payment was legitimate.
- The pack is evidence for humans, not a legal filing or an audit opinion.
