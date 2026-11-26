# Mainnet settlement runbook — CG-SG/1 + CG-W6/1 (owner-gated)

**Status of Mainnet in this repository: NOT PERFORMED.** The owner has authorized the *lane*; this document is the procedure, not evidence that a Mainnet payment happened. No Mainnet signing key, funded account or broadcast exists in this workspace, and no agent may claim otherwise.

Everything here is reversible until step 6. Steps 6-7 are the only irreversible ones and they are performed by the owner's own wallet/tooling, never by the repository.

## 0. What this runbook is for

Move one small, real, owner-authorized payment from an agent-controlled Stellar account to a named destination on **Mainnet**, with:

- an offline gate that refuses out-of-policy actions before any signature exists;
- a binding between the approval and the exact envelope bytes;
- post-submission evidence verification that is independent of the submitter's claims;
- one redacted evidence pack for the owner and any reviewer.

## 1. Preconditions (all must be true)

| # | Precondition | Why |
|---|---|---|
| 1 | Owner decision recorded in a committed document naming network, amount ceiling, destination and expiry | an authorization without an expiry is not a limit |
| 2 | A dedicated agent account on Mainnet, funded only with the intended spend + fee headroom | never reuse an account that holds other value |
| 3 | The agent key is a **session key** with a policy compiled by `coreguard_compile_stellar_session_policy` | the policy, not the prompt, is the limit |
| 4 | Signer set verified with `coreguard_verify_stellar_smart_account_signers` (master disabled or thresholded) | a single hot key is a single point of loss |
| 5 | Asset, issuer and trustline verified (`coreguard_verify_stellar_asset_allowlist`, `coreguard_verify_stellar_trustline_policy`) | the wrong issuer is unrecoverable |
| 6 | A Testnet rehearsal completed with the same policy and the same operation shape | the gate must already have refused something |
| 7 | The owner can read the unsigned XDR and the destination address themselves | approval of a hash is not approval of a payment |

If any precondition is false, stop. Do not substitute a smaller amount for a missing precondition.

## 2. Build the unsigned envelope (owner tooling)

Build it with the owner's wallet or the official SDK. The repository does not build Mainnet envelopes, and everything below operates on bytes you already have.

Required envelope properties:

- `networkPassphrase` = Mainnet, never testnet;
- `timeBounds.maxTime` short (minutes, not days) and inside the owner decision's expiry;
- a `MEMO_TEXT` or `MEMO_HASH` that matches the case/invoice reference;
- exactly one destination, matching the owner decision;
- `fee` inside the owner-approved ceiling;
- sequence read from the account immediately before building.

## 3. Offline gate (no keys, no network)

Run the same three calls the Testnet rehearsal used, with `network: "mainnet"` in the policy allowlist:

1. `coreguard_preflight_stellar_agent_payment` — pass the operation projection and the policy. A `REFUSED` result ends the procedure; do not ask the owner to sign a refused action.
2. `coreguard_bind_stellar_authorization` — bind the ALLOW to the **exact** envelope XDR string and the observed projection. Any byte change after this point invalidates the binding.
3. `coreguard_verify_stellar_sequence_guard` — pass the sequence and the seen set. `NOT_REPLAYED_SEQ` or `FORWARD_ONLY` failure stops the run.

Then, still offline:

4. `coreguard_verify_stellar_time_bounds` on the envelope's bounds at a pinned `nowSeconds`.
5. `coreguard_verify_stellar_memo_binding` against the case reference.
6. `coreguard_verify_stellar_operation_set` with the approved operation list versus the envelope's operations.

Store every result. They are the evidence pack's contents; a missing step is `NOT_CHECKED`, never `VERIFIED`.

## 4. Owner review (the actual approval)

Give the owner, in one message:

- the destination address and asset, as text they can read;
- the amount in minor units and the fee;
- `maxTime` in UTC and the ledger window;
- the envelope hash and the CG-SG/1 binding digest;
- the preflight verdict and every WARN.

The owner signs **in their own wallet**. The agent never receives the seed, the secret key or a signing capability.

## 5. Submission

The owner submits. Record the transaction hash they report, and nothing else, until step 6 confirms it.

## 6. Post-submission verification

1. Fetch the transaction from a source you trust (owner's explorer or Horizon) — outside this repository's offline tools.
2. Pass that evidence to `coreguard_verify_stellar_submission_evidence` together with the binding from step 3.
3. The verdict is `VERIFIED` only when the saved bytes and the named fields agree. It is **not** settlement finality, and it says nothing about the counterparty.
4. If evidence is unavailable, record `NOT_CHECKED`. Do not infer success from a timeout, a 200, or the submitter's message.

## 7. Evidence pack

`coreguard_export_stellar_evidence_pack` with the preflight, binding, sequence guard, time/memo/operation checks and the submission verification, redacting any customer identifier. Store the pack digest next to the owner decision.

## 8. Rollback and incident

| Situation | Action |
|---|---|
| preflight REFUSED | stop; no incident |
| owner declines after seeing the XDR | stop; nothing was signed |
| binding byte drift before signing | rebuild and restart at step 2 |
| submitted but no evidence | treat as unknown; do not resubmit; use `coreguard_verify_stellar_sequence_guard` before any retry |
| evidence contradicts the approval | freeze the agent (`coreguard_freeze_agent`), preserve bytes, follow `stellar-smart-account-incident-freeze` |

## 9. Standing boundaries

- No secrets in prompts, logs, docs, commits or evidence packs. A secret pasted into a chat must be rotated, not used.
- No Mainnet action without the owner's explicit, time-bounded decision for that specific payment.
- `VERIFIED ≠ SAFE`; Mainnet finality is a ledger fact, not a business fact, and neither this repository nor the agent can certify it.
- The absence of a Mainnet transaction in the repository is deliberate. Silence is not evidence of success.
