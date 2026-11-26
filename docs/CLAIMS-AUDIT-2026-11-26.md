# Stale-claims audit — 2026-11-26 (0.5.1 preparation)

Scope: every surface in this repository that quotes a tool count, a skill count, a version, a digest or an external status. Method: search the tree for the previous numbers, regenerate everything that is derived from `tools/list`, then re-run the machine gates.

## What was stale, and what it is now

| # | Surface | Was | Now | How it is proven |
|---|---|---|---|---|
| 1 | npm `package.json` description | "94 tools" (shipped in 0.5.0's tarball metadata) | "119 tools" | `scripts/mcp-surface.mjs` parses the number from the description and fails if it differs from `tools/list` |
| 2 | `packages/agent-commerce/server.json` | `0.5.0`, "99 MCP tools" | `0.5.1`, "119 MCP tools" | release workflow refuses a package/server version mismatch |
| 3 | `docs/mcprush/tool-reference.md` | 99 tools, 99 examples | 119 tools, **every example executed** | generator exits non-zero if any example fails or any tool lacks one |
| 4 | `docs/mcprush/capability-card.json` + `CAPABILITY-CARD.md` | 99 | 119, new tools digest | generated from `initialize` + `tools/list` + `coreguard_describe_surface` |
| 5 | `docs/assets/badges/mcp-tools.svg` | 99 | 119 | generated badge text |
| 6 | `docs/SKILLS.html`, `docs/skills.json` | 72 skills | 92 skills | skills are scanned from `skills/*/SKILL.md`; any skill naming a non-existent tool fails generation |
| 7 | `docs/MCPRUSH-LISTING.md` | 0.5.0 copy, 99/72, old trust-card digest | 0.5.1 copy, 119/92, new digest | generated blocks + manual prose checked against the generated block |
| 8 | `docs/trust-cards/sources/coreguard-tools-list.json` and the card | 99 tools, card `sha256:0bb32d8b…` | 119 tools, card `sha256:4406238b…` | `npm run trust:cards:check` re-derives the card and fails on drift |
| 9 | `packages/agent-commerce/README.md` | 99 tools | 119 tools + a CG-W6/1 paragraph | `grep -c` plus the MCP contract test |
| 10 | `README.md` status table | "0.5.0, 99 tools / 72 skills" presented as the current surface | 0.5.0 publication recorded as history; 0.5.1 branch state stated explicitly, publish pending | the row distinguishes *published* from *in this branch* |
| 11 | `docs/STATUS.md` | 99/72 as the latest measured surface | a 0.5.1 row with 119/92 | state snapshot + gates |
| 12 | `docs/agent-commerce-mcp-compatibility.md` | "discovers 99 tools" | "discovers 119 tools", Wave 6 named in the inventory | manual, checked against `tools/list` |
| 13 | `docs/mcprush-conversion-strategy.md` | "(99 tools…)" | 119 tools + a 0.5.1 checklist line | manual, cross-checked with the generated listing |

## Claims that were deliberately *not* upgraded

| Claim | Status | Why |
|---|---|---|
| npm `latest` = `0.5.1` | **VERIFIED** (published after this audit) | gated release run `45875511065` on `379fa7a`; `npm view` → `0.5.1`/latest; tarball `sha256:350d9dcb…`; artifact re-read at 119 tools |
| MCP Registry `0.5.1` active/latest | **VERIFIED** (published after this audit) | registry API returns `0.5.1` with `isLatest: true`, `status: active` |
| MCPRush badge = 119 tools | **NOT CLAIMED** | the badge is the listing's cached value; owner-only studio clicks + rescan change it |
| Mainnet settlement | **NOT PERFORMED** | no key material, funded account or broadcast exists here; the runbook is the deliverable |
| Customers, pilots, sponsors, audits, funding, endorsements, adoption | **NOT CLAIMED** | external parties; inventing them would be the one claim that invalidates every other number |
| Third-party signed-in MCP client `RUN-BY-HAND` | **NOT CLAIMED** | a connection is not a run; the compatibility log stays `PENDING` |

## Audit checks and their result

| Check | Command | Result |
|---|---|---|
| Full suite | `npm test` | recorded in `docs/state-snapshot.json` for this commit |
| Generated surface | `npm run docs:mcprush:check` | green |
| Generated surface (skills + card) | `npm run docs:surface:check` | green |
| Trust card | `npm run trust:cards:check` | PASS at 119 tools |
| Publishability | `npm run publish:check` | 14/14 packages |
| Claim registry | `npm run claims:audit` | PASS, no stale derived claim |
| Boundary audit | `npm run boundary:audit` | 0 violations, count in the snapshot |

## Rule adopted

Derived numbers are never typed. A tool count lives in exactly one place — `tools/list` — and every other surface is generated from it or fails a gate. The guard that enforces this on the npm description is the one that caught the 94-vs-99 gap that shipped in 0.5.0.

`VERIFIED ≠ SAFE`: this audit establishes that the numbers match the measured server, not that the product is secure, adopted or endorsed.
