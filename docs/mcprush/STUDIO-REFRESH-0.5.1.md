# MCPRush studio refresh — 0.5.1 (119 tools / 92 skills)

This is the complete studio packet: what to paste, where, in what order, and how to prove the listing actually re-read the new surface. It supersedes `STUDIO-REFRESH-0.5.0.md`; that sheet stays as the record of the 0.5.0 refresh.

The studio is owner-only (`mcprush.com/studio#servers`); the listing page returns 403 to automated reads, so every number below is derived from this repository's own generator, not from the listing page.

## 0. The gap this closes

| Surface | Value in this commit | Where it is measured |
|---|---|---|
| npm `latest` | `0.5.1`, **119 tools** (verified 2026-11-26, release run `45875511065`) | `npm view @coreguard/agent-commerce version` + artifact re-read |
| Server in this commit | `0.5.1`, **119 tools** | `node scripts/mcp-surface.mjs --check` |
| Skills | **92** | `docs/skills.json` |
| Public badge (last observed) | 26 tools | MCPRush badge `aria-label` |

The badge number is the listing's cached tool count. Nothing in this repository can change it; the studio release + tool-surface re-read does.

## 1. Pre-flight (run before opening the studio)

Run from the repository root, after `npm ci --ignore-scripts`:

    npm run docs:mcprush:check      # tool reference + skills page + listing block are current
    npm run trust:cards:check       # trust card PASS at the new tool count
    npm run claims:audit            # no stale claim survives
    node scripts/mcp-surface.mjs --check

Expected: `mcp surface: up to date (119 tools, 92 skills)`. The block is indented, not a `bash` fence, so the docs-node contract does not execute it on every CI run.

Keep the printed values; they are what you paste.

## 2. Releases → Add new release

1. Open `mcprush.com/studio#servers`, select **Coreguard Agent Commerce**.
2. **Releases → Add new release**, type **MCP server**.
3. **Version:** `0.5.1`.
4. **What changed** (paste, then trim to the field limit if it complains):

```
CG-W6/1 Stellar smart accounts and session keys. 20 new offline tools (119 total): session-policy
compile/evaluate with one counterfactual, scope intersection, smart-account signer and threshold
policy, envelope time/ledger bounds, memo binding, asset allowlist with confusable-code detection,
trustline capacity, Soroban auth entries, SAC allowances, fee bumps, claimable balances, sponsored
reserves, sequence/replay guard, exact operation-set drift, DEX slippage in bps, SEP-10 and
SEP-24/31 anchor evidence, session receipts. Skill library 72 → 92. Offline, deterministic, zero
keys: no RPC, no signing, no broadcast. VERIFIED ≠ SAFE.
```

5. **Publish** the release.

## 3. Manage → Tool surface

1. **Manage → Tool surface → Re-read** (or equivalent refresh control).
2. Wait for the re-read to finish, then confirm it reports **119** tools and the five new families: Wave 5, Stellar Agent Gate, **Wave 6**.
3. If it still reports 99 (or 26), the re-read ran against the old npm `latest`. Confirm the npm publish finished first (`npm view @coreguard/agent-commerce version` → `0.5.1`) and re-run the surface read.

## 4. Dashboard → Changes

Accept the pending change entries produced by the release. If a copy was already consumed and the entry shows **held**, use **Serve it again** rather than creating a duplicate release.

## 5. Manage → Security → Request a rescan

Only if the grade is stale relative to the new tarball. Limits: once per day per listing, five per day overall. A rescan is a measurement, not an appeal: the grade is deterministic and re-runnable.

## 6. Listing copy (paste from the generated sheet)

All copy lives in [`docs/MCPRUSH-LISTING.md`](../MCPRUSH-LISTING.md) and its tool-surface block is generated. Do not retype counts.

- Short description + the longer variant: §2.
- Sign-in: `no sign-in`; variables declared: none.
- Licence: `MIT`.
- Tool surface table: §5 (generated at 119).
- Skills: link `https://coreguard-global.github.io/CoreGuard/SKILLS.html`.

## 7. Verification after the clicks

| Check | How |
|---|---|
| release exists at `0.5.1` | studio Releases list |
| tool surface re-read | studio reports **119** tools |
| npm artifact | `npm view @coreguard/agent-commerce version` and `dist-tags.latest` |
| published artifact really serves 119 | install the tarball in a scratch dir and call `initialize` + `tools/list` through `bin/mcp.mjs` |
| public badge | badge `aria-label` reads `119 tools` (may lag the re-read) |
| skills page | 92 cards, each with an install line |

## 8. Honest limits

- These are owner-only clicks; this repository cannot perform them and does not claim they happened.
- A listing page read is not possible for automation (403); the badge is the only public signal available to an agent session.
- Publishing npm `0.5.1` requires the gated workflow and `NPM_TOKEN`; neither is in this workspace.
- The grade re-read measures the tarball, not this branch. Publish first, then refresh.
