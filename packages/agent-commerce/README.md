# @coreguard/agent-commerce

Consent receipts and fail-closed execution verification for agentic purchases —
an offline, deterministic surface for binding a user's approval to the exact
bytes approved, and for verifying any executed trace against that receipt.

- **CGCR/1 consent receipts** — the approved order (intent + policy + declared
  submit payload) is committed as an independently re-derivable receipt; every
  verification recomputes the commitments from the record's own approved bytes.
- **Fail-closed execution verification** — a consent plus an executed trace
  yields a verdict with named drift classes (AGR/1 taxonomy); incomplete or
  ambiguous evidence is never treated as a pass.
- **stdio MCP server** (JSON-RPC 2.0, protocol `2025-06-18`) exposing four tools,
  all offline, all deterministic, zero keys.

MIT. Node ≥ 18. No network calls, no stored credentials, no wall clock.

## MCP client configuration

```json
{
  "mcpServers": {
    "coreguard-agent-commerce": {
      "command": "npx",
      "args": ["-y", "@coreguard/agent-commerce"]
    }
  }
}
```

Per client, the same stdio command in each one's own file:

- **Claude Code** — `claude mcp add coreguard-agent-commerce -- npx -y @coreguard/agent-commerce`
- **Claude Desktop** — the `mcpServers` block above in `claude_desktop_config.json`
- **Cursor** — the same block in `.cursor/mcp.json`
- **VS Code (Copilot MCP)** — `{"servers": {"coreguard-agent-commerce": {"type": "stdio", "command": "npx", "args": ["-y", "@coreguard/agent-commerce"]}}}` in `.vscode/mcp.json`
- **Codex CLI** — `[mcp_servers.coreguard]` with `command = "npx"` and `args = ["-y", "@coreguard/agent-commerce"]` in `config.toml`
- **Gemini CLI / Zed / Windsurf** — stdio server entry, same command

What "supported" means here: the transport and schemas are what the CI harness
exercises against a real spawned child process. No third-party client has been
launched by us yet — the status vocabulary and the append-only run log are in
`docs/agent-commerce-mcp-compatibility.md`. Do not read the list above as a test
report.

## Tools

Every tool declares `inputSchema` and `outputSchema`, and returns
`structuredContent` next to the JSON text content. All four are offline and
deterministic.

### `coreguard_authorize`

Binds an approval as a CGCR/1 consent receipt.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `intent` | object | yes | CGEP/1 intent: merchant, items, total, `credentialRef`, validity window, `singleUse` |
| `policy` | object | yes | CGEP/1 policy: value limit, target / recipient / selector allowlists |
| `declaredTrace` | object | yes | the exact submit-order payload the approval covers |
| `nowSeconds` | string (digits) | yes | pinned approval epoch; a number is rejected, the wall clock is never read |

Output: `{ spec: "CGCR/1", receipt, … }` — the commitments are re-derivable by
anyone holding the record.

### `coreguard_verify_consent`

Recomputes every commitment against the record's own approved bytes.

| Input | Type | Required |
|---|---|---|
| `consent` | object | yes — a record returned by `coreguard_authorize` |

Output: an integrity verdict; any tampered byte fails closed rather than throwing.

### `coreguard_verify_execution`

Compares an executed order to the receipt.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `consent` | object | yes | CGCR/1 record |
| `trace` | object | yes | the executed order as observed |

Output: `{ spec, verdict, risk, consumed, consumedLedger }`.

- `verdict` = `VERIFIED` only on an exact re-derivation with no drift class fired.
- `verdict` = `INVALID` otherwise, with the drifted fields named in
  `risk.violations[].code` (`VALUE_ESCALATION`, `ITEM_MUTATION`,
  `TARGET_MISMATCH`, `RECIPIENT_MISMATCH`, `POLICY_VIOLATION`, …).
- `consumed` becomes `true` after the first verified execution of a single-use
  consent. **The ledger is process-local** (durable anchoring is `NOT_BUILT`), so
  this is not replay protection across processes or hosts.

### `coreguard_assess_risk`

Deterministic AGR/1 classification of one executed order against one approval.

| Input | Type | Required | Meaning |
|---|---|---|---|
| `intent` | object | yes | the approved order |
| `policy` | object | yes | the committed policy |
| `trace` | object | yes | the executed order |
| `consumed` | boolean | no | whether the authorization was already consumed (default `false`) |

Output: `{ classification, violations[], … }`. A rule-based conformance
classification, **not** a probabilistic fraud score.

## Errors

Failures are tool results, never exceptions and never a process exit:

```
MISSING_ARGUMENT: nowSeconds is required
INVALID_ARGUMENT: nowSeconds must be a pinned unix-seconds string (digits only), not a number and never the wall clock
UNKNOWN_TOOL: unknown tool: coreguard_nope
TOOL_ERROR: <message from the engine>
```

and machine-readable as `structuredContent: { ok: false, error: { code, detail } }`.
Codes are exported from `mcp.mjs` as `ERROR_CODES`. JSON-RPC level errors stay
separate (`-32700` parse, `-32600` invalid request, `-32601` method not found); a
bad line never terminates the server.

## Try it without a client

```
node examples/agent-commerce-mcp/run.mjs
```

Spawns the real server and prints approve → refuse → verify → malformed call,
ending in `PASS (8/8)`. Expected output and what each line proves:
`examples/agent-commerce-mcp/README.md`.

## SDK, without MCP

```js
import { createConsent, verifyExecution } from "@coreguard/agent-commerce";
```

The MCP tools are thin wrappers over these functions; nothing is added or hidden
by going through MCP.

## Boundaries (standing)

- Synthetic demo data is the caller's; nothing here contacts any commerce
  platform or payment network, and no contact/integration/endorsement is claimed
  with any provider.
- **VERIFIED ≠ SAFE** — a verdict states that commitments re-derive; it is not a
  guarantee of any broader outcome.
- Single-use consumption is process-local; durable anchoring is `NOT_BUILT`.
- The executed trace is caller-supplied. Fetching it from a chain or a PSP is an
  integration this package does not contain.
- No third-party security review, no certification. Marketplace grades are
  automated heuristics, not audits — see
  `docs/agent-commerce-mcp-security.md`.
- `serverInfo.version` is read from this package's `package.json`; CI fails if
  they diverge.

License: MIT.
