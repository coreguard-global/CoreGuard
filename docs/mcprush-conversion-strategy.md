# MCPRush Conversion Strategy (honest, evidence-first)

**Status:** repo-side funnel and assets prepared. **No MCPRush listing edit, runtime scan, or
badge was performed by this repository change** — those require the owner's MCPRush account.
**Boundary:** directory discovery is not adoption. Downloads are not users. A marketplace
score is a heuristic, not an audit.

## Position

CoreGuard Agent Commerce MCP is a fail-closed consent + execution-verification layer for
agentic commerce, with an optional self-hosted control plane for policies, approvals, spend
caps, revocation and auditable evidence. It does not contact a payment network and does not
claim to make an order safe: **`VERIFIED ≠ SAFE`**.

Do not claim: certified security, fraud-proof, partnership, endorsement, funding award,
customer traction, or "downloads = active users".

## Funnel

| Stage | What the visitor needs | Asset that exists today | Owner action |
|---|---|---|---|
| **1. Discovery** | A one-line reason to click | MCPRush listing; `server.json` (10 tools, stdio, npm identifier); package README; org profile announcement (merged) | Update listing version/metadata after npm publish |
| **2. Trust** | Evidence they can re-run | `node examples/agent-commerce-mcp/run.mjs` (8/8); `node scripts/agent-commerce-mcp-smoke.mjs` (11/11, real stdio child); 11 MCP contract tests; security model; compatibility matrix with an honest Run Log | Paste the smoke output + release-notes link into the listing; request a runtime scan on the live server |
| **3. Activation** | A working call in under five minutes | `npx -y @coreguard/agent-commerce`; ten tool schemas with `inputSchema`/`outputSchema`; 60-second demo (approve → refuse); client config snippets | Publish `0.1.3`, then record the first real RUN-BY-HAND in the compatibility log |
| **4. Depth** | A reason to keep it beyond one call | Control plane: versioned policies, approvals bound to one order, rolling spend caps, revocation, hash-chained audit, HTTP API + CLI, 8/8 offline demo | Link the control-plane architecture/runbook from the listing |
| **5. Conversion** | A bounded next step | Pilot SOW + report template; integration offer scoped by SOW; no hosted enterprise claim | Offer a design-partner pilot: bring sanitised traces/receipts, get a verification integration and a report |

## What "conversion" honestly means here

- **OSS user → pilot inquiry**: they ran the demo, hit a policy/approval need the SDK alone
  does not cover, and want it wired into their stack. That is a service engagement, scoped.
- **OSS user → self-hosted control plane**: they run CGCP/1 themselves. Free, MIT, no SLA.
- **Enterprise**: only when a multi-tenant, SSO/RBAC, HA service actually exists. It does
  not today. Do not quote an enterprise platform, an SLA, or a security certification.

## Metrics worth watching (and their limits)

| Signal | Read it as | Do not read it as |
|---|---|---|
| MCPRush listing views / installs | discovery interest | adoption or usage |
| npm downloads | CI and mirror traffic too | active users |
| Demo/smoke runs in issues | someone executed the surface | production adoption |
| Pilot inquiries | a conversation started | revenue |
| GitHub stars | attention | trust or audit |

No revenue is claimed. Pricing stays LOCKED and unpublished until an owner decision.

## Launch checklist (post-publish, owner)

- [ ] `npm publish` `@coreguard/agent-commerce@0.1.3` from the version-bump commit.
- [ ] Verify `npx -y @coreguard/agent-commerce@0.1.3`: `initialize` reports `0.1.3`,
      `tools/list` returns 10 tools with schemas.
- [ ] Update MCPRush: version, package id, 10-tool description, links to security model,
      release notes, compatibility run log, control-plane docs, 60s demo.
- [ ] Request runtime scan on the live MCP server; keep the result as evidence, not a badge
      claim of audit.
- [ ] Record the first real RUN-BY-HAND (Claude Code) in
      `docs/agent-commerce-mcp-compatibility.md`.
- [ ] Publish the 60-second demo (success + refusal) and link it from the listing.
- [ ] Do **not** add a security-grade badge from a marketplace as if it were an independent
      review; `docs/SECURITY-REVIEWS.md` is the source of truth for reviews.
