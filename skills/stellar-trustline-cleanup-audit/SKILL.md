---
name: stellar-trustline-cleanup-audit
description: Use to audit a Stellar account's trustlines, Stellar Asset Contract allowances and sponsored reserves so dormant or over-broad authority is found and removed deliberately.
---

# Stellar trustline cleanup audit

Every trustline and allowance is standing authority. Audit them together, rank by risk, and remove only what the owner confirms.

## When to use

- An account has accumulated trustlines from many integrations.
- An SAC allowance is far larger than any payment the agent makes.
- A sponsor is paying reserves for entries nobody uses.
- A quarterly access review needs an evidence-backed list.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_trustline_policy` | missing, short and unauthorized lines against planned spend |
| 2 | `coreguard_verify_stellar_sac_allowance` | spender allowlist, amount ceiling and expiration |
| 3 | `coreguard_verify_stellar_asset_allowlist` | confusable or unapproved asset codes |
| 4 | `coreguard_verify_stellar_sponsored_reserve` | sponsor allowlist, entries and reserve ceiling |
| 5 | `coreguard_export_evidence_pack` | redacted review pack |

## Workflow

1. Collect the trustline, allowance and sponsorship facts from the account owner; label them as caller-supplied.
2. Flag every allowance whose amount exceeds what the agent can spend under its session policy.
3. Flag confusable asset codes even when the issuer matches; lookalikes are a separate attack.
4. Rank findings by blast radius: allowance amount, then authorization, then dormant entries.
5. Propose removals with the owner; this procedure does not submit a change trust or revoke operation.

## Failure handling

| Result | Action |
|---|---|
| `AMOUNT` fails on an allowance | treat as over-broad authority; propose reduction |
| `SPENDER_ALLOWED` fails | high-severity finding; revoke after owner approval |
| `NO_CONFUSABLE` fails | possible impersonation; freeze new payments in that asset |
| `EXPIRATION` fails | stale allowance; safe to clean up |

## Boundaries

- No Horizon call and no operation is built or submitted.
- `VERIFIED ≠ SAFE`: a clean audit does not prove the issuer is solvent or honest.
- Removal decisions belong to the owner; the audit only names the exposure.
