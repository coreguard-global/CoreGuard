# MCPRush listing — copy-paste sheet (0.2.0)

Everything below is written to be pasted into the studio at `mcprush.com/studio#manage`. Where a value is factual it is measured in this repository; where it is a choice, the choice is named. Nothing here claims installs, revenue, users, partnership or an audit.

**Why 0.2.0:** the server grew from 26 to **46 tools** and now ships **10 agent skills**. Wave 3 (CG-W3/1) adds policy reasoning with counterfactuals, MCP supply-chain auditing (manifest risk cards, tool-poisoning scans, rug-pull diffs, lookalike checks), evidence tooling (redaction, Merkle batch attestation, bundle verification), and operations (freeze, runway, anomaly scan, incident timeline). Everything stays offline, deterministic, zero-key. `server.json` ships in the tarball and the description stays inside the registry's 100-character limit.

---

## 1. Title and address

| Field | Paste |
|---|---|
| Title | `Coreguard Agent Commerce` |
| Address | `mcprush.com/eslam-x/coreguard-agent-commerce-mcp` |

Keep the address. It changes at most once in 30 days, the old install command keeps working, and every existing link (README badge, org profile, release notes) points at it.

## 2. Listing copy

**Short description** (the line on the card; 78/200 used, and the first two lines are all a card shows):

```
Fail-closed consent receipts and execution verification for agentic purchases.
```

Optional longer variant, still under 200 characters, if you want the offline guarantee on the card:

<!-- generated: listing-short — run `npm run docs:surface`, do not edit -->
```
Fail-closed consent receipts and execution verification for agentic purchases. 46 offline MCP tools, zero keys, no network.
```

<sub>123/200 characters · tool count read from `tools/list` at generation time.</sub>
<!-- /generated: listing-short -->

**What it does** (the section that opens the listing page):

```
Bind a buyer's approval to the exact order bytes, then verify any executed trace against that receipt — offline, deterministic, fail-closed. 46 MCP tools: consent receipts (CGCR/1), execution verification with named drift classes (AGR/1), x402 payment authorization and settlement-evidence checks, machine task and telemetry evidence, delegation chains, a file-backed CGCP/1 control plane for policies, approvals, spend caps, revocation and a hash-chained audit — plus Wave 3 reasoning: policy compilation and counterfactuals, MCP server manifest risk cards, tool-poisoning and lookalike scans, rug-pull diffs, redaction, Merkle batch attestation, agent freeze, budget runway and incident timelines.

VERIFIED means the executed bytes matched the approved bytes. It is not a safety, fraud or settlement guarantee, and the server contacts no payment network, chain or provider. No sign-in, no keys, no wall clock: every call is reproducible from its inputs.
```

**A shorter fallback**, if the field feels long on the page:

```
Fail-closed consent receipts and execution verification for agentic purchases. Approve the exact bytes, verify what executed, and see the named drift when they differ — offline and deterministic. Includes x402 authorization, machine-economy evidence, delegation chains, and a self-hosted control plane for limits, approvals and audit.
```

## 3. Sign-in and keys

| Field | Paste |
|---|---|
| Sign-in | `no sign-in` |
| Variables declared | none |

That is accurate and worth keeping: the server reads no environment variable at all. The only optional path a user can set is `COREGUARD_CONSUMPTION_STORE` (or the `storePath` argument) for a file-backed single-use ledger; it is a file path, not a credential.

## 4. Licence

`MIT` — read from the package. Nothing to change.

## 5. Tool surface

<!-- generated: mcp-surface — run `npm run docs:surface`, do not edit -->
**Generated from `tools/list`** — server `coreguard-agent-commerce@0.2.0`, protocol `2025-06-18`, **46 tools**, tools digest `sha256:d785db585c6ad5b9e59f53894c21f32739b01d4334fa218de697d89010bf7112`.

| Group | Tools |
|---|---|
| Consent + execution (10) | `coreguard_authorize`, `coreguard_verify_consent`, `coreguard_verify_execution`, `coreguard_assess_risk`, `coreguard_inspect_identity`, `coreguard_build_attestation`, `coreguard_verify_attestation`, `coreguard_decide_outcome`, `coreguard_profile_reference`, `coreguard_consumption_status` |
| x402 + machine economy (10) | `coreguard_parse_x402_challenge`, `coreguard_authorize_x402_payment`, `coreguard_verify_x402_settlement`, `coreguard_reconcile_payment`, `coreguard_meter_agent_usage`, `coreguard_register_machine`, `coreguard_create_machine_task`, `coreguard_verify_telemetry`, `coreguard_verify_task_completion`, `coreguard_verify_delegation_chain` |
| CGCP/1 control plane (6) | `coreguard_create_intent`, `coreguard_issue_receipt`, `coreguard_verify_receipt`, `coreguard_check_limits`, `coreguard_revoke_consent`, `coreguard_audit_transaction` |
| Wave 3 · policy reasoning + MCP supply chain (10) | `coreguard_compile_policy`, `coreguard_explain_decision`, `coreguard_simulate_spend`, `coreguard_diff_policies`, `coreguard_generate_boundary_cases`, `coreguard_audit_server_manifest`, `coreguard_scan_tool_descriptions`, `coreguard_check_lookalike`, `coreguard_diff_tool_surface`, `coreguard_verify_evidence_bundle` |
| Wave 3 · evidence + operations + interop (10) | `coreguard_redact_receipt`, `coreguard_attest_batch`, `coreguard_verify_batch_proof`, `coreguard_freeze_agent`, `coreguard_budget_runway`, `coreguard_detect_spend_anomaly`, `coreguard_incident_timeline`, `coreguard_translate_receipt`, `coreguard_emit_test_vectors`, `coreguard_describe_surface` |

**Quoted capability card** (from `coreguard_describe_surface`; full JSON in [`docs/mcprush/CAPABILITY-CARD.md`](./mcprush/CAPABILITY-CARD.md)):

> coreguard-agent-commerce 0.2.0 — 46 MCP tools, stdio, protocol 2025-06-18. Offline · deterministic · zero keys · no custody · no broadcast · `VERIFIED ≠ SAFE`.

**Badge:** ![MCP tools: 46](./assets/badges/mcp-tools.svg)
<!-- /generated: mcp-surface -->

**Trust card** (CG-TC/1) — generated from the published `server.json` and a live `tools/list`, re-runnable with `npm run trust:cards:check`:

> **Trust card:** PASS · manifest risk `low` · tool descriptions `CLEAN` · 46 tools · card `sha256:c0c8ab49202a38b1ada59aed3ee0862b822f3ebb8aebf767ba892667b9246e63`
> Structural audit by CoreGuard (CG-TC/1) from the server record and a live `tools/list`. PASS ≠ SAFE.

Full card: [trust-cards/coreguard-agent-commerce.md](./trust-cards/coreguard-agent-commerce.md) · machine-readable sidecar: [trust-cards/coreguard-agent-commerce.json](./trust-cards/coreguard-agent-commerce.json). The same command works on any server record: see [TRUST-CARD.md](./TRUST-CARD.md), the third-party example [filesystem-mcp.md](./trust-cards/filesystem-mcp.md), and the blocked [poisoned fixture](./trust-cards/examples/poisoned-fixture.md).

Paste-ready per-tool reference, with every example executed against the shipped server: [`docs/mcprush/tool-reference.md`](./mcprush/tool-reference.md).

## 6. Pricing and sale

| Field | Recommendation | Reason |
|---|---|---|
| Price | `Free` | The package is MIT and the value is the integration, not the binary. A price on the listing adds a checkout step in front of a free npm package. |
| Sell it | `free · not for sale` | If a paid tier is ever wanted, make it a hosted control plane with an SLA — that does not exist yet, and selling it before it does is the one claim that would undo everything else on this page. |

## 7. Releases

0.2.0 is published (`@coreguard/agent-commerce@0.2.0`, npm tarball includes `server.json` and `wave3.mjs`, MCP Registry `0.2.0` active/latest). After the MCPRush studio refresh, the listing's release row should read `stable 0.2.0` and the tool surface **46**. Re-scan the grade only if the scan is older than the new tarball; the badge on the page is the last scan on record, not a review.

## 8. README badge

Already in `packages/agent-commerce/README.md` and in the org profile PR:

```markdown
[![Coreguard Agent Commerce MCP server](https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg)](https://mcprush.com/to/coreguard-agent-commerce-mcp?ref=badge)
```

That is the live badge code, not a screenshot of a grade. The studio's "Get the code" panel emits the same snippet keyed by the listing id; prefer its copy if the two ever differ, because the id survives a rename.

## 9. What to paste as evidence elsewhere (listing, README, replies)

| Claim | Where it is re-runnable |
|---|---|
| 26 tools, schemas, executed examples | `node scripts/mcprush-tool-reference.mjs --check` → `docs/mcprush/tool-reference.md` |
| MCP contract: initialize, tools/list, tools/call | `node --test test/integrations/agent-commerce-mcp.test.mjs` |
| Interop: 143 pinned vectors, 0 false accepts, 0 divergences | `node scripts/aer1-interop.mjs --check` → `docs/AER1-INTEROP-TABLE.md` |
| Observation family on the same set and digest | `node scripts/aer1-observation-join.mjs --check` → `docs/AER1-OBSERVATION-JOIN.md` |
| Offline demo, approve then refuse | `node examples/agent-commerce-mcp/run.mjs` |
| Trust card: manifest findings, poisoned-tool scan, inventory, digests | `npm run trust:cards:check` → `docs/trust-cards/*.md` |

Use the numbers as they are printed by those commands, and do not add a percentage, a user count or a revenue figure — none of them is measured anywhere.

## 10. Owner-only clicks (this repository cannot perform them)

- [x] Publish `0.1.5` through the gated release workflow. npm publish succeeded and the MCP Registry was updated to `0.1.5` active/latest.
- [ ] Publish `0.2.0` through the gated release workflow and confirm the MCP Registry reports `0.2.0` active/latest.
- [ ] Confirm `npx -y @coreguard/agent-commerce@0.2.0` reports `0.2.0` and `tools/list` returns 46 tools (owner/clean environment).
- [ ] Tell the agent-skills pack (`skills/`) to the integration story: 10 skills, each a folder with `SKILL.md`.
- [ ] In the studio: save the listing copy from §2, confirm sign-in/keys from §3, cut the release so the tool surface re-reads.
- [ ] If the grade is stale relative to the new tarball, request the once-a-day rescan; the grade is deterministic and re-runnable, so a rescan is a measurement, not an appeal.
- [ ] Deprecate nothing, unpublish nothing. The listing is the distribution; the funnel is the repository.
