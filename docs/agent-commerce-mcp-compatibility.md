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
| Control-plane HTTP arc (real server, ephemeral port) | **CI-SMOKE** | `node --test test/integrations/agent-commerce-control-plane-http.test.mjs` |

## Client matrix

| Client | Status | Config | Notes |
|---|---|---|---|
| Claude Code | CONFIG-REGISTERED | `claude mcp add coreguard-agent-commerce -- npx -y @coreguard/agent-commerce` | Registered and connected (`claude mcp list` → `✔ Connected`); a model-driven tool call still needs a signed-in session. |
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
| 2026-11-22 | CI / agent session | Raw stdio MCP client harness (`node --test test/integrations/agent-commerce-mcp.test.mjs`, 11 tests) | local workspace `0.1.3` | **CI-SMOKE PASS** | test output | Not a third-party client; proves initialize/tools/list/ten `structuredContent` calls over a real child process. |
| 2026-11-22 | agent session | Clean `npm i @coreguard/agent-commerce@0.1.3` + raw stdio | npm `@coreguard/agent-commerce@0.1.3` | **CI-SMOKE PASS** | install + initialize transcript | Published artifact (not the workspace): `serverInfo.version` `0.1.3`, 10 tools listed, `control-plane*.mjs` present. |
| 2026-11-22 | agent session | Claude Code CLI 2.1.329 | `@coreguard/agent-commerce` (user scope) | **CONFIG-REGISTERED** | `claude mcp add --scope user …` then `claude mcp list` → `✔ Connected` | The client connected to the stdio server over its own transport; no model turn or tool call ran (no signed-in session), so this is **not** a RUN-BY-HAND. |
| 2026-11-22 | agent session | Claude Code CLI 2.1.329 | n/a | **BLOCKED** | `claude -p` → “Not logged in · Please run /login” | CLI is installed in this environment but has no account session; no client run is claimed. |
| _TBD_ | _TBD_ | Claude Code | `@coreguard/agent-commerce@0.3.0` (prepared; publish pending) | PENDING |  | Needs a signed-in session to exercise the 70 tools after publication; connection alone is already recorded above. |

## Minimum acceptance for a "RUN-BY-HAND" entry

- [ ] Client discovers 70 tools (26 core + 10 Wave 1 + 10 CGCP/1 + 10 Wave 3 policy + 10 Wave 3 evidence/ops + 24 Wave 4; full inventory in `docs/mcprush/tool-reference.md`).
- [ ] Tool schemas/parameters visible in client UI (or inspectable).
- [ ] `coreguard_authorize` returns CGCR/1 record with `structuredContent`.
- [ ] `coreguard_verify_execution` exact trace returns `VERIFIED`.
- [ ] Escalated/changed trace returns `INVALID` with named drift (e.g. `VALUE_ESCALATION`).
- [ ] Malformed input returns structured error; server remains responsive to next call.
- [ ] Version reported by initialize matches published package version.
