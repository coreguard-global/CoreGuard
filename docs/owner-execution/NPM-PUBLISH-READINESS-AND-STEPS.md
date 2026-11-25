# npm Publication — Execution Record (post-publish truth sync)

**Status:** publication executed on **2026-11-18** (owner-authorized). This document retains the readiness/steps context below and records what was actually published.  
**Measured repo state (canonical):** 2097/2097 tests, 1312 files / 0 boundary violations (`docs/state-snapshot.json`), CI green on `main` context as recorded in repo docs.

## 0) Publication outcome (recorded)

- **Published to npmjs.org (public):** all 14 release-scope packages at `0.1.0` — `@coreguard/canonical`, `@coreguard/crypto`, `@coreguard/policy`, `@coreguard/trace`, `@coreguard/evidence`, `@coreguard/replay`, `@coreguard/evm`, `@coreguard/provenance`, `@coreguard/intent`, `@coreguard/verifier`, `@coreguard/firewall`, `@coreguard/delivery`, `@coreguard/sdk`, `@coreguard/agent-commerce`.
- **Follow-up publish:** `@coreguard/agent-commerce@0.1.1` (bin packaging fix) and `@coreguard/agent-commerce@0.1.2` (corrected `mcpName` to `io.github.EslaM-X/coreguard-agent-commerce` for MCP registry ownership validation, bin preserved). Latest on npm: `0.1.3` (published 2026-11-22 by the gated `npm release` workflow, run 45031522325; `latest` tag moved to `0.1.3`).
- **Verification (registry):** npm packument checks confirmed published versions/dist-tags (HTTP 200 / packument data) at time of publish.
- **Boundaries:** publication does not imply adoption, endorsement, production guarantees, or safety guarantees (`VERIFIED ≠ SAFE`). On-chain/product-specific owner-gated actions remain as documented elsewhere.

## 1) Monorepo/package inventory (current)

- Root: `coreguard@0.1.0`, `private: true`, workspaces `packages/*`.
- Publishable-looking manifests (examples): `@coreguard/sdk` (0.1.0, public), `@coreguard/canonical|verifier|policy|evidence|...` (0.1.0), `@coreguard-global/coreguard-badge` (1.1.0).
- Marked `private: true`: `@coreguard/agentic-escrow-arbitration`, `@coreguard/consensus`, `@coreguard/independent-verifier`, `@coreguard/peoples-court-adapter`, `@coreguard/recovery`, `@coreguard/verifier-c` (do not publish unless intentionally changed).
- **Agent Commerce surface:** implemented under `packages/agent-commerce/` (e.g. `index.mjs`, `mcp.mjs`, `http.mjs`, `risk-cli.mjs`, `attest.mjs`) but **no `packages/agent-commerce/package.json` currently** — therefore it is **not a standalone publishable npm package as-is** (requires explicit packaging decision: new package manifest, entrypoints/exports/files, name/scope, license, README, versioning).

## 2) Readiness checklist (per package you choose to publish)

Run from the package directory (or via workspace tooling) and record outputs:

```text
# metadata & contents
npm pkg get name version private license main module exports files publishConfig
npm pack --dry-run

# quality gates (repo-level, must remain green)
npm test
npm run boundary:audit
node scripts/pre-push-check.mjs
```

Verify:
- `name`/scope is owned/available on npm; `version` follows intended semver and is not already published.
- `private` is not `true` for packages intended for publish; `publishConfig.access` set appropriately for scoped packages.
- `files`/`exports` include only intended runtime artifacts (no secrets, no `.env`, no keys, no internal-only fixtures unless intentional).
- `README.md`, `LICENSE`/license field, repository/homepage/bugs fields are accurate.
- Dependency versions/ranges are correct for external consumers (workspace-internal deps resolved appropriately for publish).
- Types/declarations present where promised (e.g. `.d.ts`), and build/typecheck steps (if any) are clean.
- Changelog/release notes prepared; no claims of endorsement, production guarantees, or unsupported platforms.

## 3) Owner execution steps (actual publish — OWNER action)

1. **Decide scope:** which packages/versions to publish (e.g. `@coreguard/sdk` and required deps) and whether to package `agent-commerce` as a new npm module (separate decision/design).
2. **Auth & access:** `npm login` (or CI with `NPM_TOKEN` secret), confirm org/scope permissions and 2FA policy.
3. **Preflight:** clean working tree at intended commit, CI green, `npm pack --dry-run` reviewed for each target, provenance/signing policy as desired.
4. **Publish:** from each package dir (in dependency order) run `npm publish --access public` (or scoped equivalent) only when explicitly decided. Record published versions/tarball hashes.
5. **Post-publish:** tag/release notes, verify install in a clean project, update docs/registry entries to reference **published** versions only after success.
6. **Rollback awareness:** npm unpublish/deprecate policies are limited by time/usage; treat publish as irreversible in practice.

## 4) Honest boundaries (still binding)
- npm artifacts are live/published as recorded above; **do not** claim external adoption, integrations, endorsements, funding outcomes, or production/support guarantees from publication alone.
- Keep security boundaries explicit (offline/deterministic surfaces, `VERIFIED ≠ SAFE`, synthetic demos, owner-gated/on-chain actions not implied).

*Post-publish truth sync recorded 2026-11-18; retains readiness/steps context for auditability.*
