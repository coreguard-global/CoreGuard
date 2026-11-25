---
name: ai-agent-procurement
description: Use when an AI agent procures tools/services and you need manifest audit, poisoning scan, and spend controls before purchase.
---

# AI agent procurement

Use when an AI agent procures tools/services and you need manifest audit, poisoning scan, and spend controls before purchase.

## When to use

- When you need a deterministic, evidence-first workflow for this scenario.
- When outputs must be fail-closed and auditable.
- When you need to avoid claiming live network/bank/chain access unless evidence is supplied.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_audit_server_manifest` | Use in workflow step 1 |
| 2 | `coreguard_scan_tool_descriptions` | Use in workflow step 2 |
| 3 | `coreguard_check_lookalike` | Use in workflow step 3 |
| 4 | `coreguard_authorize` | Use in workflow step 4 |

## Workflow

1. Audit supplier manifest, scan descriptions, check lookalike, authorize only after policy pass.
2. Capture inputs/outputs as evidence digests where possible.
3. If any critical check fails, stop and escalate with `coreguard_freeze_agent` or an incident packet.
4. Record final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
