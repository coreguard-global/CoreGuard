---
name: stellar-agent-authority-audit
description: Use when auditing whether an AI agent's Stellar authority is genuinely derived from its principal, including delegation chains, session scopes and smart-account signer policy.
---

# Stellar agent authority audit

Authority is a chain, not a claim. Walk from principal to session key to signer policy and name every scope that is not inherited.

## When to use

- A security review asks what an agent can actually authorize on Stellar.
- A delegation chain crosses two or three services.
- A session key's scope list looks broader than the owner's intent.
- A signer policy change must be justified against the principal's authority.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_verify_stellar_session_key_scope` | session vs principal vs requested scope intersection |
| 2 | `coreguard_verify_agent_authority_intersection` | generic principal/agent scope arithmetic |
| 3 | `coreguard_verify_payment_authorization_chain` | delegation continuity, expiry and signature markers |
| 4 | `coreguard_verify_stellar_smart_account_signers` | the signers that can exercise the authority |

## Workflow

1. Start from the principal's approved scope list; do not accept a scope list produced by the agent.
2. Intersect with the session scope and with what the action requests. Any non-empty overreach list is a finding.
3. Walk the delegation chain: each delegate must be the next delegator, scopes may only narrow, and expiry must be in the future at a pinned time.
4. Check the signer set can actually reach the threshold; authority that cannot be exercised is a different risk from authority that is too broad.
5. Record the digests, not the prose, in the audit finding.

## Failure handling

| Result | Action |
|---|---|
| `SESSION_WITHIN_PRINCIPAL` fails | finding: session key over-broad; rotate it |
| `REQUEST_WITHIN_SESSION` fails | block the action; the agent asked for more than it holds |
| chain discontinuity | finding: broken delegation; treat downstream authority as unproven |
| threshold unreachable | finding: operational deadlock risk |

## Boundaries

- Offline reasoning over caller-supplied scopes; no IdP, chain or policy service is contacted.
- `VERIFIED ≠ SAFE`: a clean scope chain does not prove the principal understood what they approved.
- This is an evidence review, not a security certification.
