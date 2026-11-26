---
name: stellar-sep10-signin-check
description: Use when an agent authenticates to a Stellar anchor with SEP-10 and the deployment must prove the challenge belongs to the expected home domain, server key and network before signing.
---

# SEP-10 sign-in check

A SEP-10 challenge is a signed login. Verify whose challenge it is, which network it is for, and that the nonce and window are the ones your client requested.

## When to use

- An agent signs in to a Stellar anchor or wallet service.
- A challenge transaction is received and must be checked before the client key signs it.
- A test environment accidentally points at mainnet.
- An incident review needs the exact home domain and server key that were trusted.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_sep10_challenge` | home domain, web-auth domain, server key, network, nonce, window |
| 2 | `coreguard_verify_stellar_session_key_scope` | the signer is allowed to authenticate for this scope |
| 3 | `coreguard_verify_stellar_time_bounds` | the challenge window is still open at the pinned clock |
| 4 | `coreguard_issue_stellar_session_receipt` | record the authentication decision |

## Workflow

1. Pass the expected `homeDomain`, `webAuthDomain`, `serverSigningKey` and `networkPassphrase`; never accept these from the challenge itself.
2. Confirm the nonce in a manage-data operation matches the nonce the client generated.
3. Reject a challenge whose window has expired, even by one second.
4. Check `clientDomain` when the integration uses one; a missing client domain changes who the anchor attributes the session to.
5. Record the decision with a receipt; do not reuse a challenge across sessions.

## Failure handling

| Result | Action |
|---|---|
| `SERVER_KEY` fails | stop; possible impersonation |
| `NETWORK` fails | stop; testnet/mainnet confusion is a real incident |
| `NONCE` fails | reject and request a new challenge |
| `TIME_BOUNDS` fails | request a fresh challenge; never widen the window |

## Boundaries

- No anchor or Horizon call; the challenge is caller-supplied evidence.
- `VERIFIED ≠ SAFE`: a well-formed challenge does not prove the anchor is trustworthy or regulated.
- This procedure never signs the challenge transaction.
