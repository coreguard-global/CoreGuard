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
| External MCP client run (official SDK 1.32.2, stdio, published 0.5.1) | **RUN-BY-HAND** | `docs/evidence/mcp-client-run-0.5.1.json` |

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
| 2026-11-25 | agent session | Published npm artifact + raw stdio (`npx -y -p @coreguard/agent-commerce@0.3.0 coreguard-agent-commerce-mcp`) | npm `@coreguard/agent-commerce@0.3.0` | **ARTIFACT RE-READ** | `initialize` `0.3.0`, `tools/list` 70 tools | Published artifact, not the workspace; not a third-party client run. |
| 2026-11-25 | agent session | Published npm artifact + raw stdio (`npx -y -p @coreguard/agent-commerce@0.4.0 coreguard-agent-commerce-mcp`) | npm `@coreguard/agent-commerce@0.4.0` | **ARTIFACT RE-READ** | `initialize` `0.4.0`, `tools/list` 94 tools | Published artifact, not the workspace; not a third-party client run. |
| 2026-11-26 | agent session | Published npm artifact + raw stdio (`npx -y -p @coreguard/agent-commerce@0.5.0 coreguard-agent-commerce-mcp`) | npm `@coreguard/agent-commerce@0.5.0` | **ARTIFACT RE-READ** | `initialize` `0.5.0`, `tools/list` 99 tools with input/output schemas; 5 CG-SG/1 tools included | Published artifact, not the workspace; not a third-party client run. Registry `active` + `isLatest`; tarball `sha256:b7dc09ea43390aa8188023df1028df753e6cf6be13df21bae2f4d807498980a0`. |
| 2026-11-26 | agent session | Published npm artifact + raw stdio (`@coreguard/agent-commerce@0.5.1` installed in a scratch dir, run through `bin/mcp.mjs`) | npm `@coreguard/agent-commerce@0.5.1` | **ARTIFACT RE-READ** | `initialize` `0.5.1`, `tools/list` **119 tools** with input/output schemas; 20 CG-W6/1 tools included | Published artifact, not the workspace; not a third-party client run. Registry `0.5.1` `active` + `isLatest`; tarball `sha256:350d9dcb71bbf5c416afc88f72e17e903188a390ac84d0537f43d45c7a726543`. |
| 2026-11-26 | agent session (Codebuff, isolated cloud workspace) | Official MCP SDK client `@modelcontextprotocol/sdk` 1.32.2 (`Client` + `StdioClientTransport`, Node 24.22.1) | npm `@coreguard/agent-commerce@0.5.1` | **RUN-BY-HAND PASS** | `docs/evidence/mcp-client-run-0.5.1.json` (per-call transcript, 12 calls) | 119 tools discovered; `initialize` version `0.5.1`; `coreguard_describe_surface` card reports 119; `coreguard_authorize` returned a CGCR/1 record; exact trace -> `VERIFIED` (CLEAN); 57000-vs-47000 trace -> `INVALID` / VIOLATIONS with named `VALUE_ESCALATION`; `U5DC` against a `USDC` allowlist -> `FAIL` with `NO_CONFUSABLE`; malformed input returned a structured `MISSING_ARGUMENT` error and the next call succeeded. This is the official SDK client over stdio, **not** the Claude Code or VS Code UI, and no model turn was involved. |
| 2026-11-26 | agent session | Claude Code CLI | `@coreguard/agent-commerce@0.5.1` | **PENDING** | — | The CLI binary is not installed in this cloud workspace and no signed-in session exists, so no model-driven tool call was attempted. Config stays `CONFIG-REGISTERED`; this row is not a run. |
| 2026-11-26 | agent session | VS Code + GitHub Copilot (MCP) | `@coreguard/agent-commerce@0.5.1` | **PENDING** | — | No GUI and no Copilot sign-in in this workspace. The `.vscode/mcp.json` shape stays `CONFIG-DOCUMENTED`; no run is claimed. |
| 2026-11-26 | agent session | Cursor | `@coreguard/agent-commerce@0.5.1` | **PENDING** | — | No GUI or account session in this workspace; `.cursor/mcp.json` shape stays `CONFIG-DOCUMENTED`. |

## Minimum acceptance for a "RUN-BY-HAND" entry

- [ ] Client discovers 119 tools (26 core + 10 Wave 1 + 10 CGCP/1 + 10 Wave 3 policy + 10 Wave 3 evidence/ops + 24 Wave 4 + 24 Wave 5 + 5 CG-SG/1 Stellar Agent Gate + 20 CG-W6/1 Stellar smart accounts; full inventory in `docs/mcprush/tool-reference.md`).
- [ ] Tool schemas/parameters visible in client UI (or inspectable).
- [ ] `coreguard_authorize` returns CGCR/1 record with `structuredContent`.
- [ ] `coreguard_verify_execution` exact trace returns `VERIFIED`.
- [ ] Escalated/changed trace returns `INVALID` with named drift (e.g. `VALUE_ESCALATION`).
- [ ] Malformed input returns structured error; server remains responsive to next call.
- [ ] Version reported by initialize matches published package version.
