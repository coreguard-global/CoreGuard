---
name: mcp-server-due-diligence
description: Use before installing, pinning, or approving a third-party MCP server, to turn its published manifest into a deterministic risk card a reviewer can act on.
---

# MCP server due diligence

Read the record before you run the code. This skill produces evidence, not a verdict on the vendor.

## When to use

- An MCP client, marketplace, or platform is about to list or install a server.
- A team asks "is this server safe to add to our agent?".
- You need a repeatable pre-install check that does not depend on the vendor's marketing page.

## Tools

| Tool | Output you keep |
|---|---|
| `coreguard_audit_server_manifest` | risk level, findings with severities, manifest digest |
| `coreguard_scan_tool_descriptions` | hidden-instruction and spoofing findings in `tools/list` metadata |
| `coreguard_check_lookalike` | homoglyph/punycode impersonation signals on the package or domain |
| `coreguard_diff_tool_surface` | what changed since the surface you approved |

## Workflow

1. **Fetch the manifest** (`server.json` from the registry, or the record the vendor publishes). Do not edit it before hashing: the digest is what you approved.

2. **Audit it:**

   ```json
   { "manifest": { "name": "io.github.vendor/server", "version": "1.2.3",
                   "repository": { "url": "https://github.com/vendor/server" },
                   "packages": [{ "registryType": "npm", "identifier": "@vendor/server", "version": "1.2.3", "transport": { "type": "stdio" } }] } }
   ```

   Read the findings, not just `risk`:
   - `REMOTE_ENDPOINT` — the client trusts bytes it never ran; demand the endpoint's auth and rate-limit story.
   - `UNPINNED_PACKAGE` / `VERSION_NOT_PINNED` — you cannot reproduce what runs.
   - `NO_REPOSITORY` — provenance cannot be checked from the record.
   - `SECRET_REQUIRED` — list every secret and confirm least privilege; a server that wants a broad key gets a scoped one or nothing.

3. **Scan the live surface.** Connect, call `tools/list`, and pass `[{ "name": ..., "description": ... }]` to `coreguard_scan_tool_descriptions`. `DANGEROUS` means stop: bidi overrides, Unicode tag characters or imperative phrases in metadata are tool-poisoning patterns.

4. **Check the name.** Run `coreguard_check_lookalike` with the package/domain as `candidate` and the vendor's canonical name as `reference`. `LOOKALIKE` is a stop-and-verify; `DISTINCT` is not an endorsement.

5. **Pin the surface.** Store the digest from `coreguard_diff_tool_surface` (`after` entry `newDigest`) and re-run the diff on every upgrade. `requiresReconsent: true` means the approval you gave no longer covers the tool.

## Reporting

Quote the digest, the findings and the boundary sentence verbatim. Never write "safe" — write "no high-severity findings in the record, surface pinned at `sha256:…`, reviewed on <date>".

## Boundaries

- The audit is structural: it does not execute the server or observe its network behaviour.
- Absence of findings is not proof of safety; presence of findings is not proof of malice.
- `VERIFIED ≠ SAFE`.
