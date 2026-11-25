---
name: incident-freeze-drill
description: Use when an agent must be stopped immediately — freeze it, reject its open approvals in one audited operation, then reconstruct the timeline for review.
---

# Incident freeze drill

Contain first, explain second. The kill switch must be one deterministic call, and the resulting ledger must be readable.

## When to use

- A verification failed, a receipt was replayed, or a tool description was poisoned.
- An owner says "stop this agent now".
- You are rehearsing incident response before an agent goes live (do this drill monthly).

## Tools

| Step | Tool |
|---|---|
| Freeze the agent and reject its open approvals | `coreguard_freeze_agent` |
| Confirm the agent now fails closed | `coreguard_check_limits` (or `evaluate`) |
| Reconstruct the sequence | `coreguard_incident_timeline` |
| Preserve the receipts | `coreguard_redact_receipt`, `coreguard_attest_batch` |

## Workflow

1. **Freeze:**

   ```json
   { "storePath": "var/control-plane.json", "agentId": "agent-0002",
     "reason": "policy violation drill", "decidedBy": "owner@example" }
   ```

   The call revokes the agent and rejects every `pending`/`approved` approval it holds, in one audited operation. Keep `chain.headHash` — it is the ledger state you froze at.

2. **Confirm containment.** Evaluate the next intended purchase; the reasons must include `AGENT_REVOKED_OR_INACTIVE`. If they do not, the agent is bound elsewhere — freeze that one too.

3. **Build the timeline.** Pass the audit report (from `coreguard_audit_transaction`) or the `storePath` to `coreguard_incident_timeline`. Check `chain.ok`, then read `gaps`: any gap in `seq` means records are missing.

4. **Preserve evidence.** Redact receipts for the incident channel; attest the batch and publish only the root if the timeline must be provable to a third party.

5. **Write the incident note** with: freeze time (from the ledger, not your clock), `headHash`, rejected approval ids, the failing verdict, and what the agent could still do (nothing through this control plane — but key material outside it is a separate question).

## Rehearsal checklist

- [ ] Freeze works on an agent with two open approvals (both rejected, zero failures).
- [ ] A blocked evaluation returns the revoked reason.
- [ ] Timeline shows the freeze event and chain `ok`.
- [ ] The owner knows where `storePath` lives and who can write it.

## Boundaries

- Revocation is local to this single-host control plane; it does not propagate to a chain, a merchant, or an external IdP (`NOT_BUILT`).
- Freezing does not invalidate key material or stop work already executed elsewhere.
