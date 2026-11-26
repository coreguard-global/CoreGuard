---
name: stellar-smart-account-incident-freeze
description: Use when a Stellar agent session key may be compromised, to freeze the agent, block replay, and build a timestamped incident timeline from evidence instead of memory.
---

# Stellar smart-account incident freeze

Freeze first, explain second. Stop new actions, prove what could still replay, then assemble a timeline that a reviewer can re-derive.

## When to use

- A session key leaked, or a signer set changed unexpectedly.
- An out-of-policy action was reported by a monitor.
- A sponsor or anchor reports activity the owner did not authorize.
- An incident review needs an ordered timeline with evidence digests.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_freeze_agent` | stop the agent in the local control plane |
| 2 | `coreguard_verify_stellar_sequence_guard` | find whether a pending sequence or hash can still land |
| 3 | `coreguard_verify_stellar_smart_account_signers` | confirm the current signer policy state |
| 4 | `coreguard_incident_timeline` | ordered, evidence-linked timeline |
| 5 | `coreguard_export_evidence_pack` | redacted pack for the reviewer |

## Workflow

1. Freeze the agent before investigating; analysis can wait, a second payment cannot.
2. Build the seen set from submission logs and check the suspect sequence and hash.
3. Verify the signer set and thresholds as they are now, and compare with the approved digest.
4. Assemble the timeline with pinned epochs and event digests; never backfill a timestamp from memory.
5. Export a redacted pack and hand the digest to the owner. Rotate the session key outside this procedure.

## Failure handling

| Result | Action |
|---|---|
| freeze reports `ALREADY_FROZEN` | continue; do not unfreeze to "retry cleanly" |
| `NOT_REPLAYED_HASH` fails | the transaction already landed; switch to reconciliation |
| `FORWARD_ONLY` fails | an old envelope may still be valid; escalate to the account owner |
| signer digest changed | treat as key compromise until proven otherwise |

## Boundaries

- The freeze is local to the caller's control plane; it does not revoke on-chain authority or rotate keys.
- No RPC, no broadcast, no key handling.
- `VERIFIED ≠ SAFE`: a timeline explains evidence, it does not establish who was at fault.
