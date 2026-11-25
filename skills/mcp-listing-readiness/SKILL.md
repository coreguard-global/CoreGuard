---
name: mcp-listing-readiness
description: Use before publishing or listing an MCP server version to confirm the live tool surface, manifest and descriptions are current.
---

# Mcp Listing Readiness

Use before publishing or listing an MCP server version to confirm the live tool surface, manifest and descriptions are current.

## When to use

- use before publishing or listing an MCP server version to confirm the live tool surface, manifest and descriptions are current.
- When outputs must be fail-closed and auditable.
- When you need evidence for a human decision, not an automatic execution.
- When a claim must stay inside a caller-supplied, offline boundary.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_describe_surface` | Read the live capability card from the shipped server. |
| 2 | `coreguard_audit_server_manifest` | Audit the caller-supplied server manifest. |
| 3 | `coreguard_scan_tool_descriptions` | Scan descriptions for hidden or adversarial instructions. |
| 4 | `coreguard_diff_tool_surface` | Diff before/after surfaces for silent changes. |

## Workflow

1. This skill checks the server you can run locally; it does not edit any marketplace listing.
2. Capture the returned digests and named checks as evidence; do not rewrite inputs to force a pass.
3. If any critical check fails, stop and escalate with `coreguard_create_incident_war_room` or `coreguard_freeze_agent` where appropriate.
4. Record the final decision with `coreguard_audit_transaction` when a control-plane store is used.

## Boundaries

- Offline/deterministic verification over caller-supplied data only.
- No live SWIFT/bank/chain/PI/DeFi/compliance/identity network calls.
- `VERIFIED ≠ SAFE`; outputs are evidence for human/operator decision.
