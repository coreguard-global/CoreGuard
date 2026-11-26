---
name: stellar-mainnet-preflight-rehearsal
description: Use before an owner-authorized Stellar Mainnet payment to rehearse the full gate offline — policy preflight, exact-XDR binding, submission evidence and a redacted pack — with no signing and no broadcast.
---

# Stellar Mainnet preflight rehearsal

Mainnet is where rehearsal matters. Run the same gate that will judge the real submission, on the exact envelope bytes, before the owner signs anything.

## When to use

- An owner has authorized a Mainnet payment and wants the gate exercised first.
- A Testnet rehearsal passed and the same flow is being promoted.
- A reviewer asks what would have been refused, and why.
- You need the evidence pack structure before an incident, not during one.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_preflight_stellar_agent_payment` | policy, allowlists, amount ceiling, nonce, scopes, time bounds |
| 2 | `coreguard_bind_stellar_authorization` | bind the ALLOW to the exact envelope XDR and projection |
| 3 | `coreguard_verify_stellar_submission_evidence` | verify the submission evidence against the binding |
| 4 | `coreguard_export_stellar_evidence_pack` | redacted, digest-rooted pack |
| 5 | `coreguard_verify_stellar_sequence_guard` | ensure the sequence cannot replay |

## Workflow

1. Build the envelope elsewhere with the owner's tooling; this procedure never builds, signs or submits.
2. Run preflight with `network: "mainnet"` in the policy allowlist and a memo that matches the case reference.
3. Bind the decision to the exact XDR bytes. Any byte change after binding invalidates the authorization.
4. After the owner submits externally, verify the returned submission evidence against the binding and the recorded hash.
5. Export the pack and store its digest with the owner decision.

## Failure handling

| Result | Action |
|---|---|
| preflight `REFUSED` | stop; do not ask the owner to sign a refused action |
| binding byte drift | rebuild and re-approve; never patch the XDR |
| submission evidence mismatch | treat as unverified; do not report success |
| missing evidence | record `NOT_CHECKED`, never `VERIFIED` |

## Boundaries

- Offline and deterministic; nothing is signed, submitted or broadcast by this procedure.
- Mainnet signing and submission remain owner-gated external actions.
- `VERIFIED ≠ SAFE` and not settlement finality; a rehearsal is not a production guarantee.
