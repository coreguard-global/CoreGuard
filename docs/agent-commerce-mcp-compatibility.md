# Agent Commerce MCP — Client Compatibility Matrix

**Package:** `@coreguard/agent-commerce` (stdio MCP, JSON-RPC 2.0, `protocolVersion 2025-06-18`)  
**Server:** `coreguard-agent-commerce`  
**Source of truth:** `packages/agent-commerce/server.json` + `packages/agent-commerce/package.json`

## Status vocabulary (use exactly)

| Status | Meaning |
|---|---|
| **CONFIG-DOCUMENTED** | Install/config snippet documented; not run by us in that client. |
| **RUN-BY-HAND** | Manually run and recorded in Run Log with date, operator, version, evidence. |
| **CI-SMOKE** | Automated in CI against real spawned MCP child process / client harness. |
| **BLOCKED** | Attempted; blocked by environment/client issue (document issue). |

> **Rule:** Do not mark any client as "Tested/Supported" in marketing/docs without a Run Log entry.

## Automated repo-side evidence (CI/local, real stdio child)

| Check | Status | Evidence |
|---|---|---|
| MCP contract tests (11 tests, real stdio child) | **CI-SMOKE** | `node --test test/integrations/agent-commerce-mcp.test.mjs` |
| Runtime smoke check (real stdio child, success + drift + malformed) | **CI-SMOKE** | `node scripts/agent-commerce-mcp-smoke.mjs` |
| Runnable example | **CI-SMOKE** | `node examples/agent-commerce-mcp/run.mjs` |

## Client matrix

| Client | Status | Config | Notes |
|---|---|---|---|
| Claude Code | CONFIG-DOCUMENTED | `claude mcp add coreguard-agent-commerce -- npx -y @coreguard/agent-commerce` | Prioritize first real RUN-BY-HAND after npm publish. |
| Claude Desktop | CONFIG-DOCUMENTED | `mcpServers.coreguard-agent-commerce.command=npx`, `args=["-y","@coreguard/agent-commerce"]` | JSON config file. |
| Cursor | CONFIG-DOCUMENTED | `.cursor/mcp.json` same stdio command |  |
| VS Code (Copilot MCP) | CONFIG-DOCUMENTED | `.vscode/mcp.json` `servers` entry, type stdio |  |
| Codex CLI | CONFIG-DOCUMENTED | `config.toml` `[mcp_servers.coreguard-agent-commerce]` |  |
| Gemini CLI | CONFIG-DOCUMENTED | stdio MCP config, same command |  |
| Zed / Windsurf / others | CONFIG-DOCUMENTED | stdio MCP config, same command | Validate before claiming support. |

## Run Log (append-only)

Add an entry only after an actual run. Include evidence (command output snippet, screenshot path, or transcript reference).

| Date (UTC) | Operator | Client + version | Package/version | Result | Evidence | Notes |
|---|---|---|---|---|---|---|
| _TBD_ | _TBD_ | Claude Code | `@coreguard/agent-commerce@0.1.3` (post-publish) | PENDING |  | First target client |

## Minimum acceptance for a "RUN-BY-HAND" entry

- [ ] Client discovers 4 tools (`coreguard_authorize`, `coreguard_verify_consent`, `coreguard_verify_execution`, `coreguard_assess_risk`).
- [ ] Tool schemas/parameters visible in client UI (or inspectable).
- [ ] `coreguard_authorize` returns CGCR/1 record with `structuredContent`.
- [ ] `coreguard_verify_execution` exact trace returns `VERIFIED`.
- [ ] Escalated/changed trace returns `INVALID` with named drift (e.g. `VALUE_ESCALATION`).
- [ ] Malformed input returns structured error; server remains responsive to next call.
- [ ] Version reported by initialize matches published package version.
