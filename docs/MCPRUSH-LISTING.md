# MCPRush listing — copy-paste sheet (0.5.1)

Everything below is written to be pasted into the studio at `mcprush.com/studio#manage`. Where a value is factual it is measured in this repository; where it is a choice, the choice is named. Nothing here claims installs, revenue, users, partnership or an audit.

**Why 0.5.1:** Wave 6 (CG-W6/1) adds 20 deterministic, offline Stellar smart-account and session-key tools: session-policy compilation and ALLOW/DENY evaluation with a single counterfactual, scope intersection, smart-account signer/threshold policy, time and ledger bounds, memo binding, asset allowlists with confusable-code detection, trustline capacity, Soroban authorization entries, Stellar Asset Contract allowances, fee bumps, claimable balances, sponsored reserves, sequence/replay guards, exact operation-set drift, DEX path slippage in basis points, SEP-10 challenge and SEP-24/31 anchor evidence, and a session-scoped receipt. The skill library grows from 72 to **92 skills**. All tools are caller-supplied-evidence only; no live Stellar/bank/chain/PI/compliance network calls, no signing and no broadcast. `VERIFIED ≠ SAFE`.

**Cumulative:** the server ships **119 tools** and **92 skills**. Wave 3 added policy reasoning, MCP supply-chain audit, evidence, and operations; Wave 4 added cross-border/chain/machine/loan evidence; Wave 5 added authority, financial-compliance evidence, chain-specific packets and machine-economy operations; CG-SG/1 added the offline Stellar Agent Gate; Wave 6 adds Stellar smart-account and session-key reasoning plus SEP evidence. Everything stays offline, deterministic, zero-key.

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
Fail-closed consent receipts and execution verification for agentic purchases. 119 offline MCP tools, zero keys, no network.
```

<sub>124/200 characters · tool count read from `tools/list` at generation time.</sub>
<!-- /generated: listing-short -->

**What it does** (the section that opens the listing page):

```
Bind a buyer's approval to the exact order bytes, then verify any executed trace against that receipt — offline, deterministic, fail-closed. 119 MCP tools: consent receipts (CGCR/1), execution verification (AGR/1), x402/machine-economy evidence, CGCP/1 control plane, Wave 3 policy/supply-chain/evidence/ops/interop, Wave 4 cross-border/bank/chain settlement evidence, bridge/DeFi/Web3 risk, robot mission receipts, SLA/loan/collateral/credit-line checks, escrow milestones and incident war rooms, Wave 5 authority, KYC/AML, reconciliation, chain-specific evidence and machine-economy operations, plus CG-SG/1 Stellar Agent Gate preflight, exact-byte binding, submission-evidence verification and redacted evidence packs, plus CG-W6/1 Stellar smart-account and session-key policy, signer/threshold checks, envelope bounds, memo/asset/trustline checks, Soroban auth entries, SAC allowances, fee bumps, claimable balances, sequence guards, operation-set drift, DEX slippage, SEP-10/24 evidence and session receipts.

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
**Generated from `tools/list`** — server `coreguard-agent-commerce@0.5.1`, protocol `2025-06-18`, **119 tools**, tools digest `sha256:e00bc3076afa3892224f3a58a6c122c9252fbe40f806a4c4c4fb8609c209078e`.

| Group | Tools |
|---|---|
| Consent + execution (10) | `coreguard_authorize`, `coreguard_verify_consent`, `coreguard_verify_execution`, `coreguard_assess_risk`, `coreguard_inspect_identity`, `coreguard_build_attestation`, `coreguard_verify_attestation`, `coreguard_decide_outcome`, `coreguard_profile_reference`, `coreguard_consumption_status` |
| x402 + machine economy (10) | `coreguard_parse_x402_challenge`, `coreguard_authorize_x402_payment`, `coreguard_verify_x402_settlement`, `coreguard_reconcile_payment`, `coreguard_meter_agent_usage`, `coreguard_register_machine`, `coreguard_create_machine_task`, `coreguard_verify_telemetry`, `coreguard_verify_task_completion`, `coreguard_verify_delegation_chain` |
| CGCP/1 control plane (6) | `coreguard_create_intent`, `coreguard_issue_receipt`, `coreguard_verify_receipt`, `coreguard_check_limits`, `coreguard_revoke_consent`, `coreguard_audit_transaction` |
| Wave 3 · policy reasoning + MCP supply chain (10) | `coreguard_compile_policy`, `coreguard_explain_decision`, `coreguard_simulate_spend`, `coreguard_diff_policies`, `coreguard_generate_boundary_cases`, `coreguard_audit_server_manifest`, `coreguard_scan_tool_descriptions`, `coreguard_check_lookalike`, `coreguard_diff_tool_surface`, `coreguard_verify_evidence_bundle` |
| Wave 3 · evidence + operations + interop (10) | `coreguard_redact_receipt`, `coreguard_attest_batch`, `coreguard_verify_batch_proof`, `coreguard_freeze_agent`, `coreguard_budget_runway`, `coreguard_detect_spend_anomaly`, `coreguard_incident_timeline`, `coreguard_translate_receipt`, `coreguard_emit_test_vectors`, `coreguard_describe_surface` |
| Wave 4 · cross-border/bank/chain/machine/loan evidence (24) | `coreguard_parse_iso20022_payment`, `coreguard_verify_cross_border_instruction`, `coreguard_assess_fx_quote_risk`, `coreguard_verify_swift_remittance_evidence`, `coreguard_verify_bank_transfer_evidence`, `coreguard_assess_sanctions_screening_evidence`, `coreguard_verify_invoice_match`, `coreguard_generate_payment_compliance_packet`, `coreguard_verify_stellar_settlement_evidence`, `coreguard_verify_evm_settlement_evidence`, `coreguard_verify_coredao_settlement_evidence`, `coreguard_verify_pi_payment_evidence`, `coreguard_assess_bridge_risk`, `coreguard_assess_defi_position_risk`, `coreguard_verify_web3_signature_evidence`, `coreguard_verify_stablecoin_reserve_evidence`, `coreguard_create_robot_mission_receipt`, `coreguard_verify_robot_mission_evidence`, `coreguard_assess_machine_sla`, `coreguard_assess_loan_application`, `coreguard_verify_collateral_packet`, `coreguard_assess_credit_line_utilization`, `coreguard_verify_escrow_milestone`, `coreguard_create_incident_war_room` |
| Wave 5 · authority/KYC-AML/reconciliation/chain evidence/machine economy (24) | `coreguard_canonicalize_payment_instruction`, `coreguard_verify_payment_authorization_chain`, `coreguard_verify_kyc_evidence`, `coreguard_verify_ubo_evidence`, `coreguard_verify_travel_rule_packet`, `coreguard_verify_aml_alert_disposition`, `coreguard_verify_sanctions_list_version`, `coreguard_verify_fx_rate_lock`, `coreguard_reconcile_multi_ledger`, `coreguard_verify_camt054_notification`, `coreguard_verify_mt103_fields`, `coreguard_verify_beneficiary_change`, `coreguard_verify_stellar_path_payment`, `coreguard_verify_evm_permit_evidence`, `coreguard_verify_coredao_delegation_evidence`, `coreguard_verify_pi_attestation_chain`, `coreguard_verify_erc4337_userop_evidence`, `coreguard_verify_token_approval_revocation`, `coreguard_create_machine_budget_lease`, `coreguard_verify_machine_budget_consumption`, `coreguard_verify_robot_handoff_chain`, `coreguard_verify_agent_authority_intersection`, `coreguard_create_inference_receipt`, `coreguard_export_evidence_pack` |
| Stellar Agent Gate · exact XDR binding and submission evidence (5) | `coreguard_preflight_stellar_agent_payment`, `coreguard_bind_stellar_authorization`, `coreguard_verify_stellar_submission_evidence`, `coreguard_export_stellar_evidence_pack`, `coreguard_stellar_adversarial_vectors` |
| Wave 6 · Stellar smart accounts, session keys and SEP evidence (20) | `coreguard_compile_stellar_session_policy`, `coreguard_evaluate_stellar_session_key`, `coreguard_verify_stellar_session_key_scope`, `coreguard_verify_stellar_smart_account_signers`, `coreguard_verify_stellar_multisig_thresholds`, `coreguard_verify_stellar_time_bounds`, `coreguard_verify_stellar_memo_binding`, `coreguard_verify_stellar_asset_allowlist`, `coreguard_verify_stellar_trustline_policy`, `coreguard_verify_stellar_soroban_auth_entry`, `coreguard_verify_stellar_sac_allowance`, `coreguard_assess_stellar_fee_bump`, `coreguard_verify_stellar_claimable_balance`, `coreguard_verify_stellar_sponsored_reserve`, `coreguard_verify_stellar_sequence_guard`, `coreguard_verify_stellar_operation_set`, `coreguard_verify_stellar_dex_path`, `coreguard_verify_stellar_sep10_challenge`, `coreguard_verify_stellar_sep24_anchor_evidence`, `coreguard_issue_stellar_session_receipt` |

**Quoted capability card** (from `coreguard_describe_surface`; full JSON in [`docs/mcprush/CAPABILITY-CARD.md`](./mcprush/CAPABILITY-CARD.md)):

> coreguard-agent-commerce 0.5.1 — 119 MCP tools, stdio, protocol 2025-06-18. Offline · deterministic · zero keys · no custody · no broadcast · `VERIFIED ≠ SAFE`.

**Badge:** ![MCP tools: 119](./assets/badges/mcp-tools.svg)
<!-- /generated: mcp-surface -->

**Trust card** (CG-TC/1) — generated from the published `server.json` and a live `tools/list`, re-runnable with `npm run trust:cards:check`:

> **Trust card:** PASS · manifest risk `low` · tool descriptions `CLEAN` · 119 tools · card `sha256:4406238b16e3bf407e242e808410571770fe9a102fc808bc7d48f48aac14a3da`
> Structural audit by CoreGuard (CG-TC/1) from the server record and a live `tools/list`. PASS ≠ SAFE.

Full card: [trust-cards/coreguard-agent-commerce.md](./trust-cards/coreguard-agent-commerce.md) · machine-readable sidecar: [trust-cards/coreguard-agent-commerce.json](./trust-cards/coreguard-agent-commerce.json). The same command works on any server record: see [TRUST-CARD.md](./TRUST-CARD.md), the third-party example [filesystem-mcp.md](./trust-cards/filesystem-mcp.md), and the blocked [poisoned fixture](./trust-cards/examples/poisoned-fixture.md).

Paste-ready per-tool reference, with every example executed against the shipped server: [`docs/mcprush/tool-reference.md`](./mcprush/tool-reference.md).

**Agent skills** — 92 loadable `SKILL.md` procedures, each with when to use it, the tools it calls and its own copy-paste install line: [public skills page](https://coreguard-global.github.io/CoreGuard/SKILLS.html) · [`skills/README.md`](../skills/README.md). The page states no adoption: it names no install count, user, review or endorsement.

## 6. Pricing and sale

| Field | Recommendation | Reason |
|---|---|---|
| Price | `Free` | The package is MIT and the value is the integration, not the binary. A price on the listing adds a checkout step in front of a free npm package. |
| Sell it | `free · not for sale` | If a paid tier is ever wanted, make it a hosted control plane with an SLA — that does not exist yet, and selling it before it does is the one claim that would undo everything else on this page. |

## 7. Releases

**Published:** 0.5.1. Gated release run `45875511065` completed `success` on `379fa7a`; npm `latest` = `0.5.1`, MCP Registry `io.github.EslaM-X/coreguard-agent-commerce@0.5.1` is `active` and `isLatest`, and the published npm artifact re-reads at `0.5.1` / **119 tools** with schemas (tarball `sha256:350d9dcb71bbf5c416afc88f72e17e903188a390ac84d0537f43d45c7a726543`). The prior 0.5.0 release (run `45838608694`, 99 tools), 0.4.0 (run `45717671413`, 94 tools) and 0.3.0 (run `45688325860`, 70 tools) remain published. MCPRush Studio still requires the owner clicks in §10 — this repository cannot edit the listing.

## 8. README badge

Already in `packages/agent-commerce/README.md` and in the org profile PR:

```markdown
[![Coreguard Agent Commerce MCP server](https://mcprush.com/badge/coreguard-agent-commerce-mcp/card.svg)](https://mcprush.com/to/coreguard-agent-commerce-mcp?ref=badge)
```

That is the live badge code, not a screenshot of a grade. The studio's "Get the code" panel emits the same snippet keyed by the listing id; prefer its copy if the two ever differ, because the id survives a rename.

## 9. What to paste as evidence elsewhere (listing, README, replies)

| Claim | Where it is re-runnable |
|---|---|
| 119 tools, schemas, executed examples | `node scripts/mcprush-tool-reference.mjs --check` → `docs/mcprush/tool-reference.md` |
| MCP contract: initialize, tools/list, tools/call | `node --test test/integrations/agent-commerce-mcp.test.mjs` |
| Interop: 143 pinned vectors, 0 false accepts, 0 divergences | `node scripts/aer1-interop.mjs --check` → `docs/AER1-INTEROP-TABLE.md` |
| Observation family on the same set and digest | `node scripts/aer1-observation-join.mjs --check` → `docs/AER1-OBSERVATION-JOIN.md` |
| Offline demo, approve then refuse | `node examples/agent-commerce-mcp/run.mjs` |
| Trust card: manifest findings, poisoned-tool scan, inventory, digests | `npm run trust:cards:check` → `docs/trust-cards/*.md` |
| 0.2.1 behaviour fixes: normalisation, astral offsets, punycode, freeze honesty | `node --test test/integrations/agent-commerce-wave3.test.mjs` → `docs/releases/0.2.1.md` |
| 92 skills: when to use, tools each calls, per-skill install line, file digests | `npm run docs:surface:check` → `docs/SKILLS.html` + `docs/skills.json` |

Use the numbers as they are printed by those commands, and do not add a percentage, a user count or a revenue figure — none of them is measured anywhere.

## 9b. All skills — paste block for the studio (owner)

Paste this into the studio's skills field. 92 entries, one line each: skill name linked to its anchor on the public skills page, the situation it is for, and the number of tools the procedure calls. It carries no adoption number, no install count, no review and no endorsement — only what each skill does.

**If the field caps at a few hundred characters, paste this instead:**

> 92 loadable procedures: session-key policy, consent and execution verification, x402 settlement, anchor evidence, bank and cross-border checks, lending and collateral, robotics and machine leases. Each names when to use it and the tools it calls: https://coreguard-global.github.io/CoreGuard/SKILLS.html

**Full block (92 lines):**

- **[acp-interop-mapping](https://coreguard-global.github.io/CoreGuard/SKILLS.html#acp-interop-mapping)** — A partner (agent commerce platform, gateway, marketplace) asks for receipts in their shape. · 5 tools
- **[agent-authority-scope-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#agent-authority-scope-check)** — use when an agent or subagent requests a new capability and you need to prove its authority is inherited, scoped and un… · 6 tools
- **[agent-purchase-guard](https://coreguard-global.github.io/CoreGuard/SKILLS.html#agent-purchase-guard)** — An agent is about to place an order, pay an invoice, settle an x402 challenge, or call a merchant API that moves value. · 10 tools
- **[agent-spend-control](https://coreguard-global.github.io/CoreGuard/SKILLS.html#agent-spend-control)** — Use when setting, reviewing, or explaining an agent's spending limits — compile the policy, simulate the month, prove t… · 7 tools
- **[agent-treasury-ops](https://coreguard-global.github.io/CoreGuard/SKILLS.html#agent-treasury-ops)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[ai-agent-procurement](https://coreguard-global.github.io/CoreGuard/SKILLS.html#ai-agent-procurement)** — When you need a deterministic, evidence-first workflow for this scenario. · 6 tools
- **[aml-alert-disposition-review](https://coreguard-global.github.io/CoreGuard/SKILLS.html#aml-alert-disposition-review)** — use when reviewing a caller-supplied AML alert disposition packet for reviewer, rationale, timing and case linkage. · 5 tools
- **[bank-payment-ops](https://coreguard-global.github.io/CoreGuard/SKILLS.html#bank-payment-ops)** — use when a bank payment notification and transfer evidence must be checked together before an operator posts it. · 6 tools
- **[bank-transfer-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#bank-transfer-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[beneficiary-change-defense](https://coreguard-global.github.io/CoreGuard/SKILLS.html#beneficiary-change-defense)** — use when an executed payment shows a different beneficiary, account or bank than the approved instruction. · 5 tools
- **[bridge-transfer-risk](https://coreguard-global.github.io/CoreGuard/SKILLS.html#bridge-transfer-risk)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[camt054-notification-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#camt054-notification-check)** — use when a camt.054-like credit notification arrives and you need deterministic entry and balance checks before posting. · 6 tools
- **[collateral-packet-verification](https://coreguard-global.github.io/CoreGuard/SKILLS.html#collateral-packet-verification)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[compliance-review-desk](https://coreguard-global.github.io/CoreGuard/SKILLS.html#compliance-review-desk)** — use when assembling a human compliance review packet from travel-rule, AML and evidence-pack checks. · 6 tools
- **[coredao-delegation-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#coredao-delegation-evidence)** — use when a Core DAO delegation or staking packet needs chain-id, validator and unbonding checks without RPC. · 6 tools
- **[coredao-settlement-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#coredao-settlement-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[credit-line-utilization](https://coreguard-global.github.io/CoreGuard/SKILLS.html#credit-line-utilization)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[cross-border-payment-guard](https://coreguard-global.github.io/CoreGuard/SKILLS.html#cross-border-payment-guard)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[cross-border-payment-review](https://coreguard-global.github.io/CoreGuard/SKILLS.html#cross-border-payment-review)** — use when reviewing a cross-border payment end to end from canonical intent through corridor policy to reconciliation. · 6 tools
- **[defi-position-risk](https://coreguard-global.github.io/CoreGuard/SKILLS.html#defi-position-risk)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[erc4337-userop-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#erc4337-userop-evidence)** — use when an ERC-4337 UserOperation packet needs sender, nonce, gas and paymaster checks before bundling by a human. · 6 tools
- **[escrow-milestone-release](https://coreguard-global.github.io/CoreGuard/SKILLS.html#escrow-milestone-release)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[evidence-pack-export](https://coreguard-global.github.io/CoreGuard/SKILLS.html#evidence-pack-export)** — use when a reviewer needs a redacted, digest-rooted pack of evidence items and nothing should be submitted automaticall… · 6 tools
- **[evm-permit-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#evm-permit-evidence)** — use when an EVM permit/allowance packet must be checked for spender, value, deadline and nonce before an agent signs an… · 6 tools
- **[evm-settlement-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#evm-settlement-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[fx-quote-risk-gate](https://coreguard-global.github.io/CoreGuard/SKILLS.html#fx-quote-risk-gate)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[fx-rate-lock-verification](https://coreguard-global.github.io/CoreGuard/SKILLS.html#fx-rate-lock-verification)** — use when an agent holds an FX quote and must prove the locked rate was still valid for the exact intent amount at a pin… · 6 tools
- **[incident-escalation-packet](https://coreguard-global.github.io/CoreGuard/SKILLS.html#incident-escalation-packet)** — use when a verification break must be escalated with a local war-room packet and exportable evidence. · 4 tools
- **[incident-freeze-drill](https://coreguard-global.github.io/CoreGuard/SKILLS.html#incident-freeze-drill)** — A verification failed, a receipt was replayed, or a tool description was poisoned. · 6 tools
- **[incident-war-room](https://coreguard-global.github.io/CoreGuard/SKILLS.html#incident-war-room)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[inference-receipt](https://coreguard-global.github.io/CoreGuard/SKILLS.html#inference-receipt)** — use when an agent makes a model call and you need a deterministic receipt binding prompt, output, policy, cost and late… · 6 tools
- **[invoice-payment-reconciliation](https://coreguard-global.github.io/CoreGuard/SKILLS.html#invoice-payment-reconciliation)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[iso20022-payment-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#iso20022-payment-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[kyc-evidence-gate](https://coreguard-global.github.io/CoreGuard/SKILLS.html#kyc-evidence-gate)** — use when a counterparty supplies KYC evidence and you need a freshness/document gate without claiming a live KYC decisi… · 6 tools
- **[loan-application-risk](https://coreguard-global.github.io/CoreGuard/SKILLS.html#loan-application-risk)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[loan-file-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#loan-file-evidence)** — use when a loan file needs deterministic checks on application metrics, collateral and ownership packets. · 6 tools
- **[machine-budget-lease](https://coreguard-global.github.io/CoreGuard/SKILLS.html#machine-budget-lease)** — use when a robot or machine needs a scoped, time-bounded spending lease before it performs work. · 6 tools
- **[machine-economy-treasury](https://coreguard-global.github.io/CoreGuard/SKILLS.html#machine-economy-treasury)** — use when metering agent usage, budgeting machine spend and checking runway for a machine-economy deployment. · 6 tools
- **[machine-sla-assessment](https://coreguard-global.github.io/CoreGuard/SKILLS.html#machine-sla-assessment)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[machine-to-machine-micropayments](https://coreguard-global.github.io/CoreGuard/SKILLS.html#machine-to-machine-micropayments)** — When you need a deterministic, evidence-first workflow for this scenario. · 6 tools
- **[mcp-listing-readiness](https://coreguard-global.github.io/CoreGuard/SKILLS.html#mcp-listing-readiness)** — use before publishing or listing an MCP server version to confirm the live tool surface, manifest and descriptions are… · 7 tools
- **[mcp-server-due-diligence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#mcp-server-due-diligence)** — An MCP client, marketplace, or platform is about to list or install a server. · 4 tools
- **[merchant-impersonation-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#merchant-impersonation-check)** — Use when an agent is about to pay a merchant, domain, or package whose name resembles a known brand, or when a payment… · 2 tools
- **[merchant-onboarding-verification](https://coreguard-global.github.io/CoreGuard/SKILLS.html#merchant-onboarding-verification)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[mt103-field-review](https://coreguard-global.github.io/CoreGuard/SKILLS.html#mt103-field-review)** — use when an MT103-like field map needs mandatory-tag and 32A shape checks before a human reviews the transfer. · 6 tools
- **[multi-chain-reconciliation](https://coreguard-global.github.io/CoreGuard/SKILLS.html#multi-chain-reconciliation)** — When you need a deterministic, evidence-first workflow for this scenario. · 6 tools
- **[multi-ledger-reconciliation](https://coreguard-global.github.io/CoreGuard/SKILLS.html#multi-ledger-reconciliation)** — use when payment, invoice and internal ledger records must be reconciled and the breaks named explicitly. · 6 tools
- **[onchain-settlement-review](https://coreguard-global.github.io/CoreGuard/SKILLS.html#onchain-settlement-review)** — use when settlement evidence spans Stellar, EVM and Core DAO and must be checked on one deterministic surface. · 6 tools
- **[payment-compliance-packet](https://coreguard-global.github.io/CoreGuard/SKILLS.html#payment-compliance-packet)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[payment-dispute-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#payment-dispute-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 6 tools
- **[payment-intent-canonicalization](https://coreguard-global.github.io/CoreGuard/SKILLS.html#payment-intent-canonicalization)** — use when an agent is about to approve a payment instruction and you need a canonical, digest-bound object before any co… · 6 tools
- **[pi-attestation-chain](https://coreguard-global.github.io/CoreGuard/SKILLS.html#pi-attestation-chain)** — use when a Pi payment attestation chain must be checked for digest linkage and root agreement. · 6 tools
- **[pi-payment-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#pi-payment-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[receipt-forensics](https://coreguard-global.github.io/CoreGuard/SKILLS.html#receipt-forensics)** — Use when reconstructing what happened to a payment or approval — redact a receipt for sharing, verify an evidence bundl… · 5 tools
- **[robot-fleet-ops](https://coreguard-global.github.io/CoreGuard/SKILLS.html#robot-fleet-ops)** — use when a robot fleet needs mission receipts, handoff chains and SLA evidence reviewed together. · 6 tools
- **[robot-handoff-chain](https://coreguard-global.github.io/CoreGuard/SKILLS.html#robot-handoff-chain)** — use when a robot task is handed from one machine to another and you need continuity and digest-linkage checks. · 6 tools
- **[robot-mission-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#robot-mission-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[robot-mission-receipt](https://coreguard-global.github.io/CoreGuard/SKILLS.html#robot-mission-receipt)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[sanctions-evidence-gate](https://coreguard-global.github.io/CoreGuard/SKILLS.html#sanctions-evidence-gate)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[sanctions-list-version-gate](https://coreguard-global.github.io/CoreGuard/SKILLS.html#sanctions-list-version-gate)** — use when a screening result cites a list version and you need to check the stamped version and age without downloading… · 6 tools
- **[stablecoin-reserve-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stablecoin-reserve-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[stellar-agent-authority-audit](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-agent-authority-audit)** — A security review asks what an agent can actually authorize on Stellar. · 4 tools
- **[stellar-agent-spend-ledger](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-agent-spend-ledger)** — An agent runs a long task with a fixed budget. · 4 tools
- **[stellar-anchor-deposit-verify](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-anchor-deposit-verify)** — A customer's fiat deposit is reported complete by a SEP-24 anchor. · 4 tools
- **[stellar-anchor-withdrawal-reconciliation](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-anchor-withdrawal-reconciliation)** — A withdrawal is marked complete by an anchor but the bank credit is missing. · 4 tools
- **[stellar-asset-trust-preflight](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-asset-trust-preflight)** — A payment or DEX swap names an asset code supplied by a counterparty or a model. · 4 tools
- **[stellar-claimable-balance-claim](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-claimable-balance-claim)** — A counterparty funds a claimable balance as escrow or a delayed payout. · 4 tools
- **[stellar-dex-slippage-guard](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-dex-slippage-guard)** — An agent swaps between two Stellar assets on behalf of a user. · 4 tools
- **[stellar-envelope-window-guard](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-envelope-window-guard)** — An envelope was built earlier (or by another service) and is now about to be submitted. · 4 tools
- **[stellar-fee-sponsor-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-fee-sponsor-check)** — A fee-bump envelope arrives from a relayer or sponsor service. · 4 tools
- **[stellar-mainnet-preflight-rehearsal](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-mainnet-preflight-rehearsal)** — An owner has authorized a Mainnet payment and wants the gate exercised first. · 5 tools
- **[stellar-multisig-recovery-drill](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-multisig-recovery-drill)** — A smart account holds value and its recovery path has never been tested. · 5 tools
- **[stellar-operation-drift-forensics](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-operation-drift-forensics)** — A dispute or incident review needs the exact difference between approved and executed operations. · 4 tools
- **[stellar-path-payment-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-path-payment-evidence)** — use when a Stellar path-payment receipt needs structural verification without a Horizon call. · 6 tools
- **[stellar-replay-defense](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-replay-defense)** — A submission timed out and the agent wants to retry. · 4 tools
- **[stellar-sep10-signin-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-sep10-signin-check)** — An agent signs in to a Stellar anchor or wallet service. · 4 tools
- **[stellar-session-key-guard](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-session-key-guard)** — An agent's Stellar session key is about to be used for a payment, a Soroban invoke, or a path payment. · 4 tools
- **[stellar-settlement-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-settlement-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[stellar-smart-account-incident-freeze](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-smart-account-incident-freeze)** — A session key leaked, or a signer set changed unexpectedly. · 5 tools
- **[stellar-smart-account-signer-policy](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-smart-account-signer-policy)** — A smart account is being created for an agent and the owner must approve the signer set first. · 4 tools
- **[stellar-soroban-auth-review](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-soroban-auth-review)** — An agent is about to authorize a Soroban invocation with a session key. · 4 tools
- **[stellar-trustline-cleanup-audit](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-trustline-cleanup-audit)** — An account has accumulated trustlines from many integrations. · 5 tools
- **[stellar-x402-to-stellar-settlement](https://coreguard-global.github.io/CoreGuard/SKILLS.html#stellar-x402-to-stellar-settlement)** — An agent receives an HTTP 402 challenge and pays it with a Stellar asset. · 5 tools
- **[swift-remittance-verification](https://coreguard-global.github.io/CoreGuard/SKILLS.html#swift-remittance-verification)** — When you need a deterministic, evidence-first workflow for this scenario. · 5 tools
- **[token-allowance-revocation](https://coreguard-global.github.io/CoreGuard/SKILLS.html#token-allowance-revocation)** — use when cleaning up token approvals and you need evidence that a previous allowance was reduced to zero. · 5 tools
- **[tool-poisoning-triage](https://coreguard-global.github.io/CoreGuard/SKILLS.html#tool-poisoning-triage)** — Use when tool descriptions or prompts look off, arrive from an untrusted MCP server, or an agent starts behaving as if… · 6 tools
- **[tool-surface-drift-watch](https://coreguard-global.github.io/CoreGuard/SKILLS.html#tool-surface-drift-watch)** — A dependency bump changes an MCP server version. · 4 tools
- **[travel-rule-packet-check](https://coreguard-global.github.io/CoreGuard/SKILLS.html#travel-rule-packet-check)** — use when a cross-border transfer needs a travel-rule packet reviewed for completeness before any human sends it. · 6 tools
- **[ubo-packet-verification](https://coreguard-global.github.io/CoreGuard/SKILLS.html#ubo-packet-verification)** — use when you receive a beneficial-ownership packet and need deterministic checks on ownership sums and disclosure thres… · 6 tools
- **[web3-approval-safety](https://coreguard-global.github.io/CoreGuard/SKILLS.html#web3-approval-safety)** — use when an agent holds token approvals and you need permit, revocation and signature evidence reviewed together. · 6 tools
- **[web3-signature-evidence](https://coreguard-global.github.io/CoreGuard/SKILLS.html#web3-signature-evidence)** — When you need a deterministic, evidence-first workflow for this scenario. · 4 tools
- **[x402-payment-gate](https://coreguard-global.github.io/CoreGuard/SKILLS.html#x402-payment-gate)** — Use when an agent answers an HTTP 402 payment challenge — parse the challenge, authorize against policy, verify settlem… · 6 tools

## 10. Owner-only clicks (this repository cannot perform them)

- [x] Publish `0.3.0` through the gated release workflow (run `45688325860`) and confirm npm + MCP Registry report `0.3.0` active/latest.
- [x] Confirm the published npm artifact reports `0.3.0` and `tools/list` returns 70 tools (`npx -y -p @coreguard/agent-commerce@0.3.0 coreguard-agent-commerce-mcp`, agent-session re-read; owner may repeat in a clean environment).
- [x] Publish `0.4.0` through gated release run `45717671413`; npm `latest` was `0.4.0`, MCP Registry `0.4.0` active/latest, and the published artifact re-read at **94 tools** (agent-session re-read).
- [x] Publish `0.5.0` through gated release run `45838608694`; npm `latest` = `0.5.0`, MCP Registry `0.5.0` active/latest, and the published artifact re-reads at **99 tools** (agent-session re-read).
- [x] In MCPRush Studio after 0.5.0 was live: the 0.5.0 release + tool-surface re-read steps are recorded in [mcprush/STUDIO-REFRESH-0.5.0.md](./mcprush/STUDIO-REFRESH-0.5.0.md).
- [x] Publish `0.5.1` through the gated release workflow (run `45875511065`); npm `latest` = `0.5.1`, MCP Registry `0.5.1` active/latest, and the published artifact re-reads at **119 tools** (agent-session re-read).
- [ ] **0.5.1 studio (119 tools / 92 skills):** cut release `0.5.1` in the studio, re-read Tool surface, then request the once-a-day rescan only if the grade is stale. Exact click path and verification: [mcprush/STUDIO-REFRESH-0.5.1.md](./mcprush/STUDIO-REFRESH-0.5.1.md).
- [ ] Tell the agent-skills pack (`skills/`) to the integration story: 92 skills, each a folder with `SKILL.md`.
- [ ] In the studio: save the listing copy from §2, confirm sign-in/keys from §3, cut the release so the tool surface re-reads.
- [ ] If the grade is stale relative to the new tarball, request the once-a-day rescan; the grade is deterministic and re-runnable, so a rescan is a measurement, not an appeal.
- [ ] Deprecate nothing, unpublish nothing. The listing is the distribution; the funnel is the repository.
