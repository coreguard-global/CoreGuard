---
name: stellar-x402-to-stellar-settlement
description: Use when an agent pays an x402 challenge and settles on Stellar, to authorize the challenge against policy and then verify the Stellar settlement evidence against the same approval.
---

# x402 to Stellar settlement

Two protocols, one approval. Parse the challenge, authorize it against policy, and require the Stellar settlement to match the authorization you issued.

## When to use

- An agent receives an HTTP 402 challenge and pays it with a Stellar asset.
- A facilitator reports settlement and the agent must not trust the report alone.
- A retry could pay the same challenge twice.
- Finance needs the challenge, the authorization and the settlement in one trace.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_parse_x402_challenge` | normalize scheme, network, asset, amount and pay-to |
| 2 | `coreguard_authorize_x402_payment` | bind the payment to policy and a pinned time |
| 3 | `coreguard_verify_x402_settlement` | check the facilitator's settlement evidence |
| 4 | `coreguard_verify_stellar_submission_evidence` | check the Stellar submission against the binding |
| 5 | `coreguard_reconcile_payment` | one verdict across both views |

## Workflow

1. Parse the challenge and keep its digest; never re-parse a challenge to "fix" a mismatch.
2. Authorize against a policy that names the network, asset and pay-to address.
3. Treat the facilitator's `success` as a claim: verify the Stellar submission evidence separately.
4. Reconcile both views; a settlement that the chain evidence does not support is `NOT_CHECKED`, not success.
5. Store the authorization digest with the settlement for later dispute review.

## Failure handling

| Result | Action |
|---|---|
| challenge asset not allowed | do not pay; escalate to the owner |
| settlement evidence missing | mark `NOT_CHECKED` and do not retry the payment |
| reconcile mismatch | freeze the agent and preserve both payloads |
| duplicate challenge | treat as replay; do not pay twice |

## Boundaries

- No HTTP call, facilitator call, Stellar RPC or broadcast.
- `VERIFIED ≠ SAFE`: a settled micro-payment does not prove the resource was delivered.
- x402 economics and facilitator trust are outside this procedure.
