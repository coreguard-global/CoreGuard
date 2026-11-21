# CoreGuard Agent Commerce MCP — client compatibility

What this page is: the honest state of CoreGuard's `@coreguard/agent-commerce` MCP
server on each client we point people at. What it is not: a claim that every
client has been driven by us. The page exists because the listing on any
marketplace shows a platform, not a test run, and because writing "tested" next
to a client we never launched is the kind of claim this repository refuses.

## Status vocabulary (used verbatim below)

- **TESTED-IN-CI** — a real stdio child process is spawned on every CI run and
  driven through `initialize` → `tools/list` → `tools/call`
  (`test/integrations/agent-commerce-mcp.test.mjs`, 11 tests).
- **RUN-BY-HAND** — a person launched that client against the server and saw the
  four tools; recorded with date and version in this file.
- **CONFIG-DOCUMENTED** — we publish the configuration for that client, and the
  transport it needs (stdio) is what the CI harness exercises. We have **not**
  launched that client against the server. This is the default for every client
  below until a run is recorded.
- **NOT-VERIFIED** — we know too little to say anything. No config published.

A status moves from CONFIG-DOCUMENTED to RUN-BY-HAND only with a dated entry in
the log at the bottom of this page.

## The server surface

- Transport: **stdio**, newline-delimited JSON-RPC 2.0 (one object per line).
- Protocol version answered: `2025-06-18`.
- Command: `npx -y @coreguard/agent-commerce` (bin: `coreguard-agent-commerce-mcp`).
- Tools: `coreguard_authorize`, `coreguard_verify_consent`,
  `coreguard_verify_execution`, `coreguard_assess_risk`.
- Every tool declares `inputSchema` **and** `outputSchema`, and returns
  `structuredContent` alongside the text content — so a client that reads
  schemas can render arguments and results without reading this repository.
- Offline: no network calls, no keys, no wall clock. `nowSeconds` is always a
  caller-supplied pinned epoch.
- `serverInfo.version` is read from `package.json`; CI fails if they diverge.

## Clients

| Client | Transport it needs | Configuration | Status |
|---|---|---|---|
| Claude Desktop | stdio | `mcpServers` entry with the npx command | CONFIG-DOCUMENTED |
| Claude Code | stdio | `claude mcp add coreguard-agent-commerce -- npx -y @coreguard/agent-commerce` | CONFIG-DOCUMENTED |
| Cursor | stdio | `mcp.json` → `mcpServers` entry with the npx command | CONFIG-DOCUMENTED |
| VS Code (Copilot MCP) | stdio | `.vscode/mcp.json` → `servers` entry | CONFIG-DOCUMENTED |
| Codex CLI | stdio | `[mcp_servers.coreguard] command = "npx"` in `config.toml` | CONFIG-DOCUMENTED |
| OpenAI Agents SDK | in-process (import) | import `@coreguard/agent-commerce` directly, no MCP hop | CONFIG-DOCUMENTED |
| Gemini CLI | stdio | settings `mcpServers` entry | CONFIG-DOCUMENTED |
| Zed | stdio | `context_servers` entry | CONFIG-DOCUMENTED |
| Windsurf | stdio | `mcp_config.json` → `mcpServers` | CONFIG-DOCUMENTED |
| MCPRush listing | n/a (catalogue) | listing points at the npm package | see note below |
| MCP Registry | n/a (registry) | `io.github.EslaM-X/coreguard-agent-commerce` | published metadata only |

**Note on MCPRush.** The listing showed the tool schemas as unread and showed
"security A". Those are the platform's own extraction and heuristic; they are not
a review by us and not an audit by anyone. See
`docs/agent-commerce-mcp-security.md` for what a grade like that can and cannot
mean, and why we do not embed it.

The copy-paste configuration for each client lives in
`packages/agent-commerce/README.md`, next to the tool reference, so there is one
place to fix when a client changes its config format.

## Verify a client yourself in about a minute

1. Run `node examples/agent-commerce-mcp/run.mjs` from a clone. It spawns the
   real server and prints eight PASS lines, ending in `PASS (8/8)`. If that does
   not pass, the problem is the server, not your client.
2. Point the client at `npx -y @coreguard/agent-commerce` and ask it to list MCP
   tools. You should see the four `coreguard_*` names.
3. Ask it to authorize a synthetic 470.00 order (the exact argument object is in
   the runnable example), then verify a 570.00 execution. The correct answer is
   `INVALID` with `VALUE_ESCALATION` named.

If step 2 or 3 differs, that is a real finding. Record the client, version, date
and what you saw in the log below; do not "fix" it by editing the status table.

## Run log (append only)

Nothing has been run by hand yet, on any client, at any version. The first entry
will name the client, its version, the date, the package version, and the four
tool names it listed.

Standing rule: no README, listing, deck or page in this repository may describe a
client as tested while this section is empty for that client.
