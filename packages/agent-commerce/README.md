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
- **stdio MCP server** (JSON-RPC 2.0) exposing four tools, all offline, all
  deterministic, zero keys: `coreguard_authorize`, `coreguard_verify_consent`,
  `coreguard_verify_execution`, `coreguard_assess_risk`.

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

`nowSeconds` is always a caller-supplied pinned epoch (unix seconds). The
server never reads the wall clock into any commitment.

## Boundaries (standing)

- Synthetic demo data is the caller's; nothing here contacts any commerce
  platform or payment network, and no contact/integration/endorsement is
  claimed with any provider.
- **VERIFIED ≠ SAFE** — a verdict states that commitments re-derive; it is not
  a guarantee of any broader outcome.
- Single-use consumption is process-local; durable anchoring is NOT_BUILT.
- Offline by construction: no network calls, no stored credentials, no keys.

License: MIT.
