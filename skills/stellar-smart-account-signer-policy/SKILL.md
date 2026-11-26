---
name: stellar-smart-account-signer-policy
description: Use when reviewing or changing the signer set of a Stellar smart account (Soroban custom account or multisig) so an agent session key can never exceed the owner's threshold policy.
---

# Stellar smart-account signer policy

Check a caller-supplied signer configuration against an owner policy before it is deployed or rotated. Offline set arithmetic over weights and thresholds.

## When to use

- A smart account is being created for an agent and the owner must approve the signer set first.
- A session key is added, rotated or removed and the thresholds must still be reachable.
- A recovery drill needs proof that the master key cannot act alone.
- An auditor asks whether the declared threshold can actually be met by the declared weights.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_smart_account_signers` | unique keys, thresholds, signer kinds, master weight, signer count |
| 2 | `coreguard_verify_stellar_multisig_thresholds` | prove the present weights reach LOW/MEDIUM/HIGH |
| 3 | `coreguard_verify_stellar_session_key_scope` | keep the session inside the principal's authority |
| 4 | `coreguard_verify_stellar_soroban_auth_entry` | confirm the auth entry really comes from the approved contract call |

## Workflow

1. Collect the **proposed** signer set, thresholds and master weight from the same source of truth that will be submitted.
2. Run the signer check with `requireMasterDisabled: true` when the owner must not retain a single-key path; a remaining master weight is reported, never silently accepted.
3. Run the threshold check at the level the operation requires (`HIGH` for value-moving admin changes).
4. Record the signer digest and threshold result next to the change request. The digest is what the owner approves; the JSON is evidence, not an audit.
5. Re-run both checks after the rotation and diff the digests.

## Failure handling

| Result | Action |
|---|---|
| `UNIQUE_KEYS` fails | reject the proposal; duplicate signers inflate weight |
| `THRESHOLDS` fails | reject; the account could become unusable |
| `THRESHOLD_MET` fails | the present signers cannot authorize the operation; do not attempt it |
| `MASTER_DISABLED` fails | escalate to the owner before deploying |

## Boundaries

- No account state is read from the network and no transaction is built or signed.
- `VERIFIED ≠ SAFE`: matching the policy does not prove key custody, signer honesty or recovery quality.
- Passkey and hardware-signer kinds are caller-declared labels, not attestations.
