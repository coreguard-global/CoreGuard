# MCPRush studio refresh — 0.5.0 → 99 tools, 72 skills

**Status:** `OWNER-ONLY CLICKS` — the repository is ready; the studio has not been refreshed.
This sheet exists because the listing still serves an old surface while npm is four
releases ahead.

## The measured gap (read it before clicking)

| Where | What it says now | How it was measured |
|---|---|---|
| MCPRush public badge | **26 tools** | `curl https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg` → `aria-label="… 26 tools, works with 14 clients"`, read 2026-11-26 |
| npm `latest` | **0.5.0** | `npm view @coreguard/agent-commerce version` |
| Published artifact re-read | **99 tools**, `serverInfo.version` `0.5.0` | install `@coreguard/agent-commerce@0.5.0` in a scratch dir, send `initialize` + `tools/list` on the stdio bin |
| Repository surface | **99 tools / 72 skills** | `docs/mcprush/CAPABILITY-CARD.md`, `docs/skills.json` |

26 tools is the pre-Wave-3 surface (`0.2.0`). MCPRush re-reads a listing when the
publisher asks it to, not when npm changes — its own docs say so: a stdio server
buyers reach directly "releases the tools on its **Tool surface** row in Manage".
So the fix is three studio actions, not a code change.

## Steps, in order

### 1. Confirm the package first (30 seconds)

```text
npm view @coreguard/agent-commerce version        # 0.5.0
npm view @coreguard/agent-commerce@0.5.0 mcpName  # io.github.EslaM-X/coreguard-agent-commerce
```

If either is not `0.5.0` / that mcpName, stop — publishing precedes the listing.

### 2. Cut the release (only if 0.5.0 is not already on the listing)

Studio → **Releases** → **Add new release** → **MCP server**

| Field | Value |
|---|---|
| Listing | `Coreguard Agent Commerce` (`mcprush.com/eslam-x/coreguard-agent-commerce-mcp`) |
| Version | `0.5.0` |
| What changed | the block below |

```text
0.5.0 — 99 offline MCP tools, 72 skills.

• Stellar Agent Gate (CG-SG/1), 5 tools: preflight refusal by name, binding an ALLOW
  decision to the exact XDR envelope bytes, verification of caller-supplied submission
  evidence, redacted evidence pack, and 16 named adversarial vectors.
• Wave 5, 24 tools: payment-authority chains, KYC/UBO/travel-rule/AML/sanctions-version
  packets, FX locks, multi-ledger and camt.054/MT103 reconciliation, beneficiary-change
  defense, Stellar path-payment / EVM permit / Core DAO delegation / Pi attestation /
  ERC-4337 userOp / approval-revocation evidence, machine budget leases, robot handoffs,
  inference receipts and redacted evidence packs.
• Wave 4, 24 tools: cross-border, bank, chain, bridge/DeFi, robot/SLA, loan and escrow
  evidence.
• Tool surface: 94 → 99. Skills: 72 (unchanged).
• Offline, deterministic, zero keys. VERIFIED means saved bytes matched; it is not a
  safety, settlement, sanctions or KYC/AML guarantee.
```

Versions are spent once. If the studio already holds a `0.5.0` release, **do not add
it again** — go to step 3.

If Settings → **Publish a release as soon as it is cut** is off, the release waits as
*held*: click **Serve it again**.

### 3. Re-read the tool surface (this is the step that fixes "26 tools")

Studio → **MCP Servers** → **Manage** → the **Tool surface** row → read/refresh the
tools. Expected result: **99 tools**, and no added/removed/widened tool waiting.

Why a release alone is not enough: the release records the version; the Tool surface
row is what the listing page and the badge count read for a server buyers reach
directly.

### 4. Accept or hold the new tools, deliberately

Studio → **Dashboard** → **Changes**. A release that adds, removes or widens a tool
creates a row. 99 − 26 means many new tools land here:

- **Accept** them if the listing should advertise all 99;
- **Hold** keeps calls to the new tools refused while everything else works.

Nothing on MCPRush can approve a tool on your behalf; a write/network-widening tool
waits for a human by design.

### 5. Request the rescan (only if the grade should move)

Studio → **MCP Servers** → **Manage** → **Security** → **Request a rescan**.

- Limit: **once a day per listing**, five a day across listings.
- The grade becomes whatever the scan finds. It is a scan of a code snapshot, not a
  review, and a rescan is a measurement, not an appeal.
- **Contest this finding** sends one finding to a person.

The tool-count refresh in step 3 does not depend on this; do not spend the daily
rescan just to update a number.

### 6. Verify from outside the studio

```text
curl -s https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg | head -c 400
```

The `aria-label` must read `99 tools`. The tool count is the observable; the grade is
separate.

Then check the listing page while signed out: the install line must name
`@coreguard/agent-commerce@0.5.0`, and the tool list must show the Wave 4/5 and
CG-SG/1 names (`coreguard_preflight_stellar_agent_payment`,
`coreguard_verify_payment_authorization_chain`, …).

## Paste fields

Use [MCPRUSH-LISTING.md](../MCPRUSH-LISTING.md) §2 (short/long description, already
generated from `tools/list`), §3 (`no sign-in`, no variables) and §6 (free, not for
sale). Do not paste a percentage, a user count or a revenue figure: none is measured.

## What this refresh still will not say

No install count, user count, pilot, customer, sponsor, audit, funding, partnership,
endorsement or adoption is created by a listing refresh. The listing is distribution;
`VERIFIED ≠ SAFE` and the CG-SG/1 boundaries travel with it. `ops/production` stays
`INTEGRATION_READY, NOT_PROVISIONED`.

## If something disagrees

| Symptom | Cause | Fix |
|---|---|---|
| Badge still 26 after step 3 | cached badge or the Tool surface row was not refreshed | hard-refresh the badge URL with a query string (`…card.svg?v=2`), then re-open **Manage → Tool surface** |
| Release published but tools unchanged | for a direct-reach stdio server the release does not re-read tools | step 3 |
| New tools refused for a buyer | they sit in **Dashboard → Changes** | **Accept**, or **Hold** on purpose |
| Version rejected as already used | versions are spent once | keep the existing release; refresh the surface instead |

Sources for the studio path names: MCPRush docs, "Cut a release" and "Security and
trust → Publishers" (`mcprush.com/docs`), read 2026-11-26.
