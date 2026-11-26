---
name: stellar-soroban-auth-review
description: Use when an agent submits a Soroban contract invocation and the owner must confirm the authorization entry, the Stellar Asset Contract allowance and the exact operation set before signing.
---

# Soroban authorization review

Soroban auth entries are where an agent's intent and its actual authority diverge. Review the entry, the SAC allowance and the operation set as three separate facts.

## When to use

- An agent is about to authorize a Soroban invocation with a session key.
- A Stellar Asset Contract `approve` / `transfer_from` allowance is part of the flow.
- A reviewer needs proof the args digest matches what the owner approved.
- A sub-invocation could reach a contract the policy never allowed.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_soroban_auth_entry` | contract, function, args digest, root flag, expiration ledger |
| 2 | `coreguard_verify_stellar_sac_allowance` | owner, spender, amount, expiration and spender allowlist |
| 3 | `coreguard_verify_stellar_operation_set` | the submitted operations match the approved list positionally |
| 4 | `coreguard_issue_stellar_session_receipt` | bind the approved policy, action and spend into one receipt |

## Workflow

1. Hash the exact argument bytes yourself and pass that digest; never hash a re-serialized approximation.
2. Require `rootInvocation: true` when the policy says the agent may only sign the root call.
3. Check `signatureExpirationLedger` against a pinned ledger; an expired entry is a silent denial.
4. Verify the SAC allowance independently: an auth entry can be legitimate while the allowance is far larger than the payment.
5. Issue a session receipt so a later reviewer can re-derive what was allowed.

## Failure handling

| Result | Action |
|---|---|
| `ARGS_DIGEST` fails | stop; the authorization does not cover these arguments |
| `FUNCTION` fails | stop; a different contract function was approved |
| `EXPIRATION` fails | rebuild the auth entry with owner approval |
| `SPENDER_ALLOWED` fails | escalate as a possible key-compromise path |

## Boundaries

- No Soroban RPC and no contract call; nothing is simulated or executed.
- `VERIFIED ≠ SAFE`: matching digests do not prove the contract is honest or bug-free.
- Allowances are evidence only; this procedure never creates one.
