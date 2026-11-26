---
name: stellar-multisig-recovery-drill
description: Use to rehearse recovery of a Stellar smart account — prove the backup signer set still meets thresholds, that the auth entry matches, and that the drill is documented before a real key is lost.
---

# Stellar multisig recovery drill

Recovery plans are unverified until exercised. Drill the signer set, the threshold reachability and the authorization path against the current policy.

## When to use

- A smart account holds value and its recovery path has never been tested.
- A signer is being retired and the remaining set must still reach `HIGH`.
- An incident requires using backup signers under time pressure.
- An auditor asks for evidence that recovery was rehearsed.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_smart_account_signers` | current signer set, kinds, thresholds, master weight |
| 2 | `coreguard_verify_stellar_multisig_thresholds` | backup weights reach the required level |
| 3 | `coreguard_verify_stellar_soroban_auth_entry` | the recovery invocation is the approved one |
| 4 | `coreguard_incident_timeline` | timestamped drill record with evidence |
| 5 | `coreguard_export_evidence_pack` | redacted pack for the auditor |

## Workflow

1. Snapshot the current signer configuration and its digest before touching anything.
2. Remove the "lost" signer from the present set and re-run the threshold check; this is the actual drill.
3. Verify the recovery invocation's contract, function and args digest against the approved recovery procedure.
4. Record the drill in the incident timeline with pinned epochs and the evidence digests.
5. Export a redacted pack; keep the signer keys out of it entirely.

## Failure handling

| Result | Action |
|---|---|
| `THRESHOLD_MET` fails | the recovery plan is broken; fix it before an incident |
| `MASTER_DISABLED` fails unexpectedly | escalate; a live master key changes the threat model |
| `ARGS_DIGEST` fails | the recovery call differs from the documented one |
| `UNIQUE_KEYS` fails | the backup set is not independent; redesign it |

## Boundaries

- No chain call, no key handling and no signing.
- `VERIFIED ≠ SAFE`: a successful drill does not prove the human process will be followed under stress.
- Signer keys must never be placed in an evidence pack or a prompt.
