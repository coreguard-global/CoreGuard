# MCP Registry — Submission Record (post-publish truth sync)

**Status:** listing published/active on **2026-11-18** (owner-authorized). This document retains the submission-pack context below and records the executed listing.  
**Server implementation:** `packages/agent-commerce/mcp.mjs` (stdio, newline-delimited JSON-RPC 2.0). **Evidence context:** CI-pinned tests and demos on `main` (1841/1841, 1312 files/0 violations context; see `docs/state-snapshot.json`).

## 0) Listing outcome (recorded)

- **Registry:** https://registry.modelcontextprotocol.io/
- **Server name:** `io.github.EslaM-X/coreguard-agent-commerce`
- **Version:** `0.1.3` (npm `latest`); registry listing republished 2026-11-22 and reports `active` / `isLatest`
- **Package:** npm `@coreguard/agent-commerce@0.1.3` (stdio transport), with `mcpName` aligned to `io.github.EslaM-X/coreguard-agent-commerce`
- **Artifacts updated in repo:** `packages/agent-commerce/server.json` and `packages/agent-commerce/package.json` reflect published/listed version and naming.
- **Boundaries:** listing does not imply endorsement, adoption, integration, or production guarantees (`VERIFIED ≠ SAFE`; synthetic/demo scope as documented).

## 1) Server summary (for listing)

- **Name (suggested):** `coreguard-agent-commerce` (see `SERVER_INFO` in `mcp.mjs`)
- **Version:** `1.0.0` (server info; align with package/release versioning policy before submission)
- **Protocol:** MCP over **stdio**, JSON-RPC 2.0, one JSON object per line; protocol version declared `2025-06-18` (as implemented).
- **Purpose:** offline, deterministic, fail-closed verification/binding surfaces for agent commerce — bind approvals (consent), verify consent, verify execution, assess risk (AGR/1). No network calls to commerce/payment providers.
- **Boundary (must be stated):** synthetic/demo data only; `VERIFIED ≠ SAFE`; single-use consumption is process-local unless a host provides durable anchoring (AC-CS/1 is same-host, not distributed/on-chain); no contact/integration/endorsement claimed with OpenAI, AmEx, Mastercard, Visa, or any provider.

## 2) Tools exposed (4 at first submission; 10 on 0.1.3 — see `mcp.mjs`)

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

## 4a) Credential handling for registry auth (required)

**Rule.** Authenticate to the registry with the **GitHub device flow** (`mcp-publisher login github`) or, in CI, with **GitHub OIDC**. If a token is genuinely unavoidable, use a **fine-grained PAT** scoped to this single task — profile read only, no repository or organization permissions, shortest practical expiry — and treat it as disposable.

**Release workflow automation (exact secret name).** `.github/workflows/release.yml` now publishes the MCP registry entry after a successful npm publish. It uses **GitHub OIDC** (`permissions: id-token: write`) and verifies the `mcp-publisher` Sigstore bundle before publishing. **Exact secret name required for MCP registry publishing: none.** The only repository/environment secret required by that workflow is **`NPM_TOKEN`** (npm publish). Do not add an MCP registry PAT unless you intentionally switch away from OIDC; if that ever happens, use a dedicated least-privilege secret name such as `MCP_REGISTRY_GITHUB_TOKEN` and keep it separate from `NPM_TOKEN`.

**Why this note exists.** The 0.1.3 republication on 2026-11-22 exchanged a **classic** personal access token through `POST /v0/auth/github-at`. That token carried broad scopes, including `admin:org`, `delete_repo`, `repo` and `workflow`. It was transmitted only over HTTPS to `registry.modelcontextprotocol.io` and was never written into the repository, a log file, or this document — but a credential with that blast radius should not authorize a directory write. A classic token is also the wrong shape for the registry: it cannot be limited to "publish this one server".

**Rotation steps (no secret values anywhere in this list).**

1. **Revoke the exposed credential.** GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)* → the token used → **Delete**. For a fine-grained token: *Tokens (fine-grained)* → **Revoke**.
2. **Review its activity.** On the same settings page, open the token's activity (and the account security log) for the last 24 hours: look for unfamiliar registry calls, new deploy keys, new organization members, or package deletions.
3. **Re-issue with least privilege, only if still needed.** Fine-grained PAT → owner = your account → repository access = *No repositories* → permissions = *Profile: read-only* → expiry ≤ 7 days. Nothing else.
4. **Replace every reference.** Update the workspace/CI secret that supplies `GH_TOKEN` and any local shell profile that exports it. Do not paste the value into chat, an issue, a commit, a `server.json`, or a log.
5. **Prove the rotation.** Exchange the replacement credential, read the server version back from the registry, and confirm the old token now fails with `401`. Confirm `isLatest` still points at the intended version.
6. **Separate the concerns.** The npm release path uses its own granular `NPM_TOKEN`; never reuse it for registry auth, and never reuse the registry credential for npm, GitHub API automation or git pushes.
7. **Record the outcome** in this checklist (date + which credential type), without the credential itself.

## 5) Evidence links (public)
- Repo: https://github.com/coreguard-global/CoreGuard
- Spec: `docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md`
- Evidence showcase: `docs/AGENT-COMMERCE-EVIDENCE-SHOWCASE-2026-11-16.md`
- Integration/pilot docs: `docs/AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md`
- Demos: `examples/agent-commerce-security-suite/`, `examples/agent-commerce-firewall/`, `examples/agent-commerce-attestation/`

## 6) Submission checklist (owner) — recorded
- [x] Confirmed target registry requirements/metadata format and naming rules (including npm ownership validation alignment).
- [x] Published package version `@coreguard/agent-commerce@0.1.2` with corrected `mcpName` and bin.
- [x] Submitted and published listing: `io.github.EslaM-X/coreguard-agent-commerce@0.1.2` (active).
- [x] Republished the listing for 0.1.3 (2026-11-22) via the registry API after a GitHub token exchange; the API reports `active` / `isLatest`. Note: the registry caps `description` at 100 characters.
- [ ] Rotate the classic token used for that exchange and switch future republications to device flow or a fine-grained least-privilege token (section 4a). **OPEN**
- [ ] (Recommended follow-up) Independently verify install/run flow from a clean environment and capture reproducible evidence for any public claim.

*Post-publish truth sync recorded 2026-11-18; retains submission-pack context for auditability.*
