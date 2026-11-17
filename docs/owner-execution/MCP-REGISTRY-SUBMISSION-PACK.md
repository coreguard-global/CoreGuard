# MCP Registry — Submission Pack (preparation only)

**Status:** preparation artifact for the CoreGuard Agent Commerce MCP server. **No registry submission/listing performed.** Submission is an **external, owner-performed** action (account/approval/process dependent).  
**Server implementation:** `packages/agent-commerce/mcp.mjs` (stdio, newline-delimited JSON-RPC 2.0). **Evidence:** CI-pinned tests and demos on `main` (1795/1795, 1288 files/0 violations context; see `docs/state-snapshot.json`).

## 1) Server summary (for listing)

- **Name (suggested):** `coreguard-agent-commerce` (see `SERVER_INFO` in `mcp.mjs`)
- **Version:** `1.0.0` (server info; align with package/release versioning policy before submission)
- **Protocol:** MCP over **stdio**, JSON-RPC 2.0, one JSON object per line; protocol version declared `2025-06-18` (as implemented).
- **Purpose:** offline, deterministic, fail-closed verification/binding surfaces for agent commerce — bind approvals (consent), verify consent, verify execution, assess risk (AGR/1). No network calls to commerce/payment providers.
- **Boundary (must be stated):** synthetic/demo data only; `VERIFIED ≠ SAFE`; single-use consumption is process-local unless a host provides durable anchoring (AC-CS/1 is same-host, not distributed/on-chain); no contact/integration/endorsement claimed with OpenAI, AmEx, Mastercard, Visa, or any provider.

## 2) Tools exposed (4)

| Tool | Description (concise) | Required inputs (high level) |
|---|---|---|
| `coreguard_authorize` | Bind user approval as CGCR/1 consent record (pinned receipt) over exact approved bytes | `intent`, `policy`, `declaredTrace`, `nowSeconds` (pinned epoch string) |
| `coreguard_verify_consent` | Verify consent record integrity/binding; tamper fails closed | `consent` |
| `coreguard_verify_execution` | Verify executed trace against consent; fail-closed verdict + AGR/1 taxonomy/named drift | `consent`, executed trace (per schema) |
| `coreguard_assess_risk` | AGR/1 risk report over intent/policy/trace | `intent`, `policy`, `trace` |

> **Source of truth:** tool schemas/descriptions in `packages/agent-commerce/mcp.mjs`. Before submission, extract and include the exact JSON schemas and any runtime notes (e.g. `nowSeconds` must be caller-supplied/pinned; server never reads wall clock into commitments).

## 3) How to run (local)

```text
# from repo root (Node >=18 as per repo engines)
node packages/agent-commerce/mcp.mjs
# stdio transport: send/receive newline-delimited JSON-RPC 2.0 messages
```

(For packaged distribution, define an installable command/bin once a publishable package exists; document accordingly.)

## 4) Security & privacy notes (include in submission)
- **Offline/deterministic:** no outbound calls to payment networks/merchants by the server logic.
- **No secrets:** do not send PANs, private keys, or credentials; examples use synthetic placeholders.
- **Fail-closed:** malformed/unreadable evidence refused, not guessed.
- **Limits/boundaries:** process-local consumption unless caller injects durable same-host store; no on-chain broadcast; not a fraud guarantee.
- **Supply chain:** pin to a reviewed commit/release; run in least-privilege environments.

## 5) Evidence links (public)
- Repo: https://github.com/coreguard-global/CoreGuard
- Spec: `docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md`
- Evidence showcase: `docs/AGENT-COMMERCE-EVIDENCE-SHOWCASE-2026-11-16.md`
- Integration/pilot docs: `docs/AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md`
- Demos: `examples/agent-commerce-security-suite/`, `examples/agent-commerce-firewall/`, `examples/agent-commerce-attestation/`

## 6) Submission checklist (owner)
- [ ] Confirm target registry’s current requirements/metadata format and naming rules.
- [ ] Freeze reviewed commit/tag; include exact version and integrity info.
- [ ] Attach accurate tool schemas, run instructions, and security boundaries (no overclaims).
- [ ] Submit from owner account; respond to review feedback with reproducible evidence.
- [ ] After listing, verify install/run flow independently and update docs with the listing URL.

*Preparation only; no listing performed.*
