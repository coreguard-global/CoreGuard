# MCPRush listing — copy-paste sheet (0.1.5)

Everything below is written to be pasted into the studio at `mcprush.com/studio#manage`. Where a value is factual it is measured in this repository; where it is a choice, the choice is named. Nothing here claims installs, revenue, users, partnership or an audit.

**Why 0.1.5:** `0.1.4` published the 26-tool server and corrected the manifest. `0.1.5` makes the published npm tarball carry `server.json` (the MCP registry manifest) and wires MCP registry publishing into the gated release workflow after npm publish (GitHub OIDC preferred; `MCP_REGISTRY_GITHUB_TOKEN` fallback when the configured namespace is not publishable via repo OIDC). No tool behaviour changed.

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

```
Fail-closed consent receipts and execution verification for agentic purchases. 26 offline tools, zero keys, no network.
```

**What it does** (the section that opens the listing page):

```
Bind a buyer's approval to the exact order bytes, then verify any executed trace against that receipt — offline, deterministic, fail-closed. 26 MCP tools: consent receipts (CGCR/1), execution verification with named drift classes (AGR/1), x402 payment authorization and settlement-evidence checks, machine task and telemetry evidence, delegation chains, and a file-backed CGCP/1 control plane for policies, approvals, spend caps, revocation and a hash-chained audit.

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

After `0.1.5` is published, the listing should read **26 tools**. `0.1.5` is published on npm and the MCP Registry listing reports `0.1.5` active/latest for `io.github.EslaM-X/coreguard-agent-commerce`. The set, as `tools/list` returns it:

| Group | Tools |
|---|---|
| Consent + execution (10) | `coreguard_authorize`, `coreguard_verify_consent`, `coreguard_verify_execution`, `coreguard_assess_risk`, `coreguard_inspect_identity`, `coreguard_build_attestation`, `coreguard_verify_attestation`, `coreguard_decide_outcome`, `coreguard_profile_reference`, `coreguard_consumption_status` |
| x402 + machine economy (10) | `coreguard_parse_x402_challenge`, `coreguard_authorize_x402_payment`, `coreguard_verify_x402_settlement`, `coreguard_reconcile_payment`, `coreguard_meter_agent_usage`, `coreguard_register_machine`, `coreguard_create_machine_task`, `coreguard_verify_telemetry`, `coreguard_verify_task_completion`, `coreguard_verify_delegation_chain` |
| CGCP/1 control plane (6) | `coreguard_create_intent`, `coreguard_issue_receipt`, `coreguard_verify_receipt`, `coreguard_check_limits`, `coreguard_revoke_consent`, `coreguard_audit_transaction` |

Paste-ready per-tool reference, with every example executed against the shipped server: [`docs/mcprush/tool-reference.md`](./mcprush/tool-reference.md).

## 6. Pricing and sale

| Field | Recommendation | Reason |
|---|---|---|
| Price | `Free` | The package is MIT and the value is the integration, not the binary. A price on the listing adds a checkout step in front of a free npm package. |
| Sell it | `free · not for sale` | If a paid tier is ever wanted, make it a hosted control plane with an SLA — that does not exist yet, and selling it before it does is the one claim that would undo everything else on this page. |

## 7. Releases

0.1.5 is published (`@coreguard/agent-commerce@0.1.5`, npm tarball includes `server.json`, MCP Registry `0.1.5` active/latest). After the MCPRush studio refresh, the listing's release row should read `stable 0.1.5`. Re-scan the grade only if the scan is older than the new tarball; the badge on the page is the last scan on record, not a review.

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

Use the numbers as they are printed by those commands, and do not add a percentage, a user count or a revenue figure — none of them is measured anywhere.

## 10. Owner-only clicks (this repository cannot perform them)

- [x] Publish `0.1.5` through the gated release workflow. npm publish succeeded and the MCP Registry was updated to `0.1.5` active/latest.
- [ ] Confirm `npx -y @coreguard/agent-commerce@0.1.5` reports `0.1.5` and `tools/list` returns 26 tools (owner/clean environment).
- [ ] In the studio: save the listing copy from §2, confirm sign-in/keys from §3, cut the release so the tool surface re-reads.
- [ ] If the grade is stale relative to the new tarball, request the once-a-day rescan; the grade is deterministic and re-runnable, so a rescan is a measurement, not an appeal.
- [ ] Deprecate nothing, unpublish nothing. The listing is the distribution; the funnel is the repository.
