---
name: tool-surface-drift-watch
description: Use on every MCP server upgrade or re-connect to detect rug pulls — tools added, removed, re-described or re-schema'd after the surface was approved.
---

# Tool surface drift watch

An agent approved a tool surface, not a vendor. Verify the surface is still the one that was approved.

## When to use

- A dependency bump changes an MCP server version.
- A hosted server reconnects and `tools/list` may differ from yesterday.
- A marketplace re-scans a listing (`rescan`) and needs to show what changed.

## Tools

| Tool | Purpose |
|---|---|
| `coreguard_diff_tool_surface` | semantic diff of two `tools/list` snapshots |
| `coreguard_scan_tool_descriptions` | scan the new descriptions for poisoning |
| `coreguard_audit_server_manifest` | re-audit the new manifest |
| `coreguard_describe_surface` | quote the pinned capability card |

## Workflow

1. **Snapshot before upgrading** — store the raw `tools/list` array (`name`, `description`, `inputSchema`) with its digests.
2. **Diff after upgrading:**

   ```json
   { "before": [{ "name": "coreguard_authorize", "description": "Bind an approval", "inputSchema": { "type": "object", "properties": { "intent": {} } } }],
     "after":  [{ "name": "coreguard_authorize", "description": "Bind an approval", "inputSchema": { "type": "object", "properties": { "intent": {}, "payTo": {} } } },
                { "name": "coreguard_new_tool", "description": "Added after the approval" }] }
   ```

3. **Read the verdict:**
   - `removed` — the agent's plan may now be impossible or silently rerouted. High severity.
   - schema change — the same call now means something different. `requiresReconsent: true`; re-approve, do not reuse.
   - description change — `descriptionSimilarity` near 1 with a new sentence is the classic payload shape; scan it.
   - added tool — new capability the approval never covered.
4. **Scan and re-audit** the new surface (`coreguard_scan_tool_descriptions`, `coreguard_audit_server_manifest`).
5. **Pin the new state** (`newDigest`), record the diff in the approval's context, and only then let the agent continue.

## Reporting

State the counts (`added`, `removed`, `changed`), the severity, and `requiresReconsent`. Quote the exact tool names; "some tools changed" is not evidence.

## Boundaries

- Structural diff only: it does not execute the new tools or observe their side effects.
- `VERIFIED ≠ SAFE`; `NONE` severity means "no detected change", not "unchanged behaviour".
