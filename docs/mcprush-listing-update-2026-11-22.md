# MCPRush listing update — 0.1.3 (paste-ready)

Prepared 2026-11-22 after `@coreguard/agent-commerce@0.1.3` became the npm
`latest`. This file exists because the MCPRush account is not accessible from
the project workspace: the fields below are meant to be pasted into the listing
form as they are.

## Facts the listing may state

| Field | Value |
|---|---|
| Package | `@coreguard/agent-commerce` |
| Version on npm | `0.1.3` (`latest`, published 2026-11-22) |
| `mcpName` | `io.github.EslaM-X/coreguard-agent-commerce` |
| Transport | stdio, JSON-RPC 2.0, offline |
| Tools | 10 |
| Runtime | Node.js >= 18 |
| Credentials required | none — no network calls, no keys, no PAN |
| License | MIT |

Verified on the published artifact (fresh directory, `npm i
@coreguard/agent-commerce@0.1.3`): `serverInfo.version` = `0.1.3`, ten tools
listed, `control-plane*.mjs` present. The MCP Registry entry was republished to `0.1.3` (active, `isLatest`) on the
same day; MCPRush is still a separate directory entry, so do not describe the
two as the same listing.

## Paste-ready fields

**Name**

```
CoreGuard Agent Commerce
```

**Tagline (<= 80 chars)**

```
Consent receipts and fail-closed verification for agent purchases
```

**Short description**

```
Ten MCP tools that authorize an agent purchase, verify what executed, assess risk, inspect identity, build and verify attestations, decide outcomes, resolve profile references, and report a host-persisted spend ledger — offline, deterministic, zero credentials.
```

**Long description**

```
CoreGuard Agent Commerce gives an agent a pre-execution gate and a post-execution review for commerce actions.

Before anything runs, coreguard_authorize binds a committed policy to the declared request and returns a CGCR/1 consent receipt. After execution, coreguard_verify_execution compares the receipt with the observed trace and returns VERIFIED or INVALID with named drift (for example VALUE_ESCALATION). Supporting tools assess risk, inspect identity, build and verify CGXA/1 attestations, map five outcomes (CG-OUT/1), resolve profile references, and report consumption from a host-persisted ledger (AC-CS/1).

Everything runs offline over stdio with no API keys and no network calls. Verdicts are deterministic for the same inputs.

VERIFIED means the trace matched the authorized request. It is not a safety, fraud or compliance guarantee.
```

**Install**

```bash
npx -y @coreguard/agent-commerce
```

**Client config (Claude Code / Claude Desktop / Cursor / VS Code / Codex)**

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

**Tools**

```
coreguard_authorize
coreguard_verify_consent
coreguard_verify_execution
coreguard_assess_risk
coreguard_inspect_identity
coreguard_build_attestation
coreguard_verify_attestation
coreguard_decide_outcome
coreguard_profile_reference
coreguard_consumption_status
```

**Links**

```
npm:      https://www.npmjs.com/package/@coreguard/agent-commerce
source:   https://github.com/coreguard-global/CoreGuard
security: https://github.com/coreguard-global/CoreGuard/blob/main/docs/agent-commerce-mcp-security.md
clients:  https://github.com/coreguard-global/CoreGuard/blob/main/docs/agent-commerce-mcp-compatibility.md
```

**Categories / tags**

```
agent-commerce, payments, authorization, consent-receipt, verification, attestation, security, offline
```

## Claims to avoid

- Do not say "audited", "certified", "enterprise-ready" or "production-proven".
- Do not say "tested with <client>" for any client that has not produced a
  RUN-BY-HAND entry in `docs/agent-commerce-mcp-compatibility.md`. Today that
  list is empty; Claude Code is recorded as CONFIG-REGISTERED only.
- Do not claim live payment, wallet, PSP or on-chain integration: none is
  contacted by the package.
- Do not present `VERIFIED` as "safe". The package's own copy says
  `VERIFIED ≠ SAFE`, and the listing should not contradict it.

## After publishing the listing

Record the listing URL and date in `docs/agent-commerce-mcp-compatibility.md`
(or `docs/PARTNERSHIPS.md` if MCPRush requests a directory entry), and update
`docs/STATUS.md` only with the version that the listing actually shows.
