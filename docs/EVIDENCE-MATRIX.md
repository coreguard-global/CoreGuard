# CoreGuard Evidence Matrix — three axes, never one word

> **Why this file changed (2026-11-10).** It used to collapse executed Stellar
> work into one combined verdict label, while `packages/stellar/README.md` said `DRY_RUN / NOT_BUILT`
> and `status()` returned `integrationStatus: NOT_BUILT`. Both were true about
> different questions, and the single label let a reader average them into "the
> integration works". The three axes below cannot be averaged, and
> `test/ci/surface-status.test.js` fails the build if a combined label returns.
> Full record: [`STELLAR-STATUS-UNIFICATION.md`](STELLAR-STATUS-UNIFICATION.md).
> Machine-readable registry: [`surface-status.json`](surface-status.json).

## The three axes

| Axis | The question it answers | Allowed values |
|---|---|---|
| **Code** | Does the surface exist in the committed tree? | `BUILT` · `BUILT_UNVERIFIED` · `PLAN_ONLY` · `NOT_BUILT` |
| **Execution** | Has anything been run, with an artifact proving it? | `EXECUTED` · `REAL_BOOK_EXECUTED` · `POLICY_GATE_EXECUTED` · `TEST_EXECUTED` · `NONE` |
| **Integration** | Can an outside project adopt it today? | `ADOPTED` · `PILOT` · `NOT_BUILT` |

**Rules the machine enforces.** `ADOPTED` and `PILOT` require a named external
party plus committed evidence. `EXECUTED` never implies `ADOPTED`. `NONE` on the
execution axis is a fact, not a failure. Today every surface is
`integration=NOT_BUILT`: **no external project runs CoreGuard, and no customer
has adopted it.**

## Stellar

| Surface | Code | Execution | Integration | Evidence |
|---|---|---|---|---|
| `stellar-adapter` — read / build / submit gate | BUILT | NONE (no live call by design) | NOT_BUILT — no external consumer | `packages/stellar/index.mjs`; `status()` returns `DRY_RUN` / `NOT_BUILT` |
| `stellar-soroban-anchor` — commitment anchor contract | BUILT (soroban-sdk 23) | EXECUTED — deploy + first `commit(proofId, commitment)` INVOKED, owner-authorized; contract `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`; tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373 | NOT_BUILT — the caller is CoreGuard's own script | `docs/evidence/stellar-soroban-commit-executed.json`; `node scripts/stellar-soroban-commit-executed.mjs --verify` |
| `stellar-dex-gate` — DEX-GATE/1 preflight | BUILT | REAL_BOOK_EXECUTED — five verdicts against the live XLM/USDC book; returns `PLAN_ONLY`, never sends | NOT_BUILT — no wallet or DApp embeds it | `docs/evidence/stellar-dex-gate-executed.json`; `node scripts/stellar-dex-gate-real.mjs --verify` |
| `stellar-agent-gate` — STELLAR-AGENT/1 policy matrix | BUILT | POLICY_GATE_EXECUTED — VERIFIED / REJECTED / HELD executed offline; `submit: NOT_PERFORMED` | NOT_BUILT — no agent deployment uses it | `docs/evidence/stellar-agent-gate-executed.json`; `node scripts/stellar-agent-gate-executed.mjs --verify` |
| `stellar-presign-receipt` — pre-sign authorization receipts (PSAR/1) | BUILT | TEST_EXECUTED — offline arc + contract battery; decisions PASS or BLOCK only, every verdict carries `executionProof: NOT_INCLUDED` | NOT_BUILT — no wallet embeds it; the Freighter proposal is a proposal, not an integration | `packages/stellar/presign.mjs`; `test/integrations/stellar-presign.test.mjs`; `npm run stellar:presign` |
| `agent-gate` — AGENT-GATE/1 gate, receipts, independent verifier | BUILT | TEST_EXECUTED — 14-case walkthrough; receipt tamper and chain-break refusals | NOT_BUILT — prototype, no signer, no submission | `packages/agent-gate/index.mjs`; `test/integrations/agent-payment-gate.test.mjs` |
| `agent-gate-xdr` — builds unsigned, decodes signed envelopes | BUILT | EXECUTED — an envelope built here was signed and included on Stellar **testnet**, tx `7f863dd2512a82d1d10d6d221d311260698fc018c233113d5e5971fb9741b757` at ledger 5,665,413, then re-decoded offline; secret key, fee-bump and junk refused | NOT_BUILT — no external embedder | `docs/evidence/agent-gate-testnet-signature.json`; `node scripts/agent-gate-testnet-sign.mjs --verify` |
| `agent-gate-freighter` — wallet signing adapter | BUILT_UNVERIFIED — a real Freighter extension has still never signed here; it was probed in the available browser and is not installed (`window.freighter` undefined) | TEST_EXECUTED — signed / empty / unsigned / swapped-bytes cases against an injected wallet, plus a chain-accepted signature carried through this adapter by a local keypair behind its interface | NOT_BUILT | `packages/agent-gate/adapters/freighter.mjs`; `docs/evidence/agent-gate-testnet-signature.json`; promotion after a real extension signs: `node scripts/agent-gate-freighter-attest.mjs --verify` |
| `agent-gate-verify-cli` — third-party verifier | BUILT | TEST_EXECUTED — exit 0/2/3/4 proven, including a receipt paired with a foreign envelope | NOT_BUILT — zero external users | `packages/agent-gate/verify-cli.mjs` |
| `agent-gate-bench` — in-process timing | BUILT | TEST_EXECUTED — 2000 samples, p50/p95 recorded; offline ceiling stated | NOT_BUILT | `docs/evidence/agent-gate-bench.json` |
| `agent-gate-browser-demo` — runnable page: gate → wallet → conformance → receipt | BUILT | TEST_EXECUTED — prepare / sign / verify driven over HTTP in the contract, a one-stroop tamper refused by name, junk REFUSED | NOT_BUILT — nothing is submitted, and the page states that a missing extension means a local keypair signed | `test/integrations/agent-gate-browser-demo.test.mjs`; `node examples/agent-gate-browser/serve.mjs` |
| `stellar-freighter` — Freighter wallet wrapper | BUILT_UNVERIFIED — no end-to-end test | NONE — credential-gated, never exercised | NOT_BUILT | `packages/stellar/freighter.mjs` |
| `stellar-mainnet-executor` — payment / invoke / anchor plans | PLAN_ONLY — returns `PLAN_OK` plus sample code | NONE | NOT_BUILT | `packages/stellar/mainnet-executor.mjs` |
| Soroban anchor — authorized lane (`commit_authorized`) | BUILT (source only) | TEST_EXECUTED — the crate's suite includes a ledger-sequence lane: a replay never restamps the anchor, new content anchors at its own ledger, and a later sequence cannot rebind the owner's record | NOT_BUILT — the deployed contract still exposes only permissionless `commit`; the authorized lane needs a re-deploy that has not happened | `soroban/commitment-anchor/src/lib.rs` |
| Signed funded DEX swap (owner wallet, 2026-11-06) | BUILT (runner script) | EXECUTED — `pathPaymentStrictSend` CONFIRMED, tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112; 4.0598146 XLM to 0.6306239 USDC, wire read-back equals `fee_charged` to the stroop | NOT_BUILT — a one-off owner execution, not a product path | `docs/evidence/stellar-dex-swap-executed.json`; `node scripts/stellar-dex-swap-executed.mjs --verify` |
| Mainnet wallet and first payment | BUILT | EXECUTED — 0.1 XLM to SDF, ledger 65,308,317 | NOT_BUILT | `.stellar-tx-1.json` |

**One sentence for the Stellar block:** the *execution* record is real and
re-derivable; the *integration* record is empty. A judge can verify the former
today and cannot adopt the latter today.

## Core DAO (chainId 1116)

| Surface | Code | Execution | Integration | Evidence |
|---|---|---|---|---|
| Anchor contract V1 | BUILT | EXECUTED — `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E`, proof tx `0xe67c61fd...a9b8`, block 38712625 | NOT_BUILT — no external consumer | `scripts/verify-live.json` |
| EvidenceRegistryV2 | BUILT | EXECUTED — `0x66268a47e81b8f657798d7b5bbedc956df7b13fd`; commitIntent `0x0cd2a8c0...715c`; anchorProof `0x5b9e7d68...78d2` | NOT_BUILT | `scripts/verify-live.json` |
| EvidenceRegistryV3 (fee) | BUILT — `forge test` green | NONE — not deployed (owner-only decision) | NOT_BUILT | `contracts/EvidenceRegistryV3.sol` |
| Cross-RPC independent read-back | BUILT | EXECUTED — coredao + ankr, 66/66 legs | NOT_BUILT | `evidence/gate-4.1-independent-verify.json` |
| Gate 4.1 identity anchor | BUILT | EXECUTED — commitIntent `0x68d9fb...c567`, block 38827925, status `0x1`; governance signature still pending | NOT_BUILT | `evidence/gate-4.1-live-reconfirmation-2026-09-19.json` |

## Engine and verification surfaces

| Surface | Code | Execution | Integration | Evidence |
|---|---|---|---|---|
| `independent-verifier` — offline receipt verifier | BUILT | TEST_EXECUTED | NOT_BUILT — zero third-party runs | `packages/independent-verifier`; `test/independent-verifier/` |
| C verifier (frozen reference) | BUILT | TEST_EXECUTED | NOT_BUILT | `test/verifier-c/` |
| Universal DApp Shield (ARM model) | BUILT | POLICY_GATE_EXECUTED — 2 ALLOW, 2 REQUIRE_REVIEW, 1 DENY, 1 REFUSED | NOT_BUILT | `docs/evidence/universal-dapp-shield-executed.json` |
| Claim registry CG-CL/1 | BUILT | TEST_EXECUTED — 31 claims, 19 VERIFIED, 0 violations | NOT_BUILT | `docs/claims-registry.json`; `npm run claims:audit` |
| Release gate CG-RG/1 | BUILT | TEST_EXECUTED — 18/18 legs, self-audit in CI | NOT_BUILT | `docs/release-gate.json`; `npm run release:gate` |
| Conformance report CG-CR/1 | BUILT | TEST_EXECUTED — `badgeIssuerCount 0`, revenue 0 | NOT_BUILT | `docs/conformance-report.json` |

## Pi Network

| Surface | Code | Execution | Integration | Evidence |
|---|---|---|---|---|
| Pi payment flow (approve then complete) | BUILT | TEST_EXECUTED — fail-closed `503 payments_not_configured` without the server-side key | NOT_BUILT — no live payment, no developer-portal approval | `WEB-coreguard/src/routes/api/pi-approve.ts` |
| Pi Sign-In (implicit flow) | BUILT | TEST_EXECUTED — `/api/pi-me` rejects an invalid bearer with 401 | NOT_BUILT — domain verification pending | `WEB-coreguard/src/routes/api/pi-me.ts` |
| Pi packages | BUILT_UNVERIFIED | NONE | NOT_BUILT | `packages/pi-network`, `packages/pi-killer` |

## Agent commerce (offline, synthetic, committed surfaces)

> **Honesty boundary.** Products 1–4 are committed runnable surfaces on this tree (offline, deterministic, synthetic orders only — placeholder credentials, never a PAN). Product 5 is SPEC'D and NOT_BUILT as a unified cross-chain surface. No contact, integration, or endorsement is claimed with OpenAI, American Express, Mastercard, Visa, or any provider. npm publication and any live external use are OWNER-GATED. `VERIFIED ≠ SAFE`; not a probabilistic fraud score.

| Surface | Code | Execution | Integration | Evidence |
|---|---|---|---|---|
| `agent-authorization-firewall` — the composed authorization firewall (AC-FW/1): request-time gate + after-the-fact review (product 1) | BUILT | TEST_EXECUTED — offline fail-closed arc (PRE gate ALLOWs the exact request / DENIES with named codes; POST review VERIFIED exact / INVALID drifted; byte-deterministic decisions) | NOT_BUILT — no external adopter | `packages/agent-commerce/firewall.mjs`; `test/integrations/agent-commerce-firewall.test.mjs`; `examples/agent-commerce-firewall/artifacts.json` |
| `consent-receipts` — Verifiable Consent Receipts (CGCR/1) (product 2) | BUILT | TEST_EXECUTED — consent bound to exact approved order bytes; verify fail-closed with named drift on divergence | NOT_BUILT — no external adopter | `packages/agent-commerce/index.mjs`; `test/integrations/agent-commerce-sdk.test.mjs` |
| `agent-commerce-consumption-store` — durable single-use consumption store adapter (AC-CS/1) | BUILT | TEST_EXECUTED — file-backed Set-compatible ledger (cross-process replay resistance on the same host via `consumedSet` injection); NOT distributed, NOT an on-chain marker | NOT_BUILT — on-chain single-use marker OWNER-GATED / NOT_BUILT; no external adopter | `packages/agent-commerce/consumption-store.mjs`; `test/integrations/agent-commerce-consumption-store.test.mjs` |
| `agent-risk-engine` — deterministic authorization-drift taxonomy (AGR/1) + standalone CLI (product 3) | BUILT | TEST_EXECUTED — named classes + severities (classes frozen), standalone CLI with assessment persistence (JSON + JSONL ledger) | NOT_BUILT — no external adopter | `packages/agent-commerce/risk.mjs`; `packages/agent-commerce/risk-cli.mjs`; `test/integrations/agent-commerce-risk-cli.test.mjs` |
| `agent-commerce-sdk-mcp-rest` — SDK + MCP server + REST API (product 4) | BUILT | TEST_EXECUTED — SDK, stdio MCP (JSON-RPC) and REST `/v1/authorize` · `/v1/verify` · `/v1/risk-assess` exercised offline | NOT_BUILT — npm publication OWNER-GATED; no external adopter | `packages/agent-commerce/`; `test/integrations/agent-commerce-sdk.test.mjs` · `test/integrations/agent-commerce-mcp.test.mjs` · `test/integrations/agent-commerce-http.test.mjs` |
| `agent-commerce-attack-battery` — the named adversarial battery (deterministic six-vector prompt-injection fuzz, post-approval recipient swap, tax/shipping/fee escalation, credential substitution, replay, the documented cross-session consumption gap, expiry, receipt tamper) | BUILT | TEST_EXECUTED — every attack leg INVALID fail-closed; the cross-session gap is asserted honestly (a fresh ledger cannot see prior consumption — named on the report, never hidden) | NOT_BUILT — no external adopter | `test/integrations/agent-commerce-attack-battery.test.mjs` |
| `agent-commerce-typescript-types` — TypeScript declaration surface over AC-SDK/1 + AGR/1 + tsc lane | BUILT | TEST_EXECUTED — declared value-exports ↔ runtime exports, constant equality, boundary strings, no implementation; type-checked in CI (`tsc --noEmit --project packages/agent-commerce`) | NOT_BUILT — no external adopter | `packages/agent-commerce/index.d.ts`; `packages/agent-commerce/tsconfig.json`; `packages/agent-commerce/typecheck-smoke.ts`; `test/integrations/agent-commerce-types.test.mjs` |
| `agent-commerce-dashboard` — bilingual operator dashboard (authorization decisions + receipts + honest gaps) | BUILT | TEST_EXECUTED — data island equals the committed artifacts byte-for-byte; boundaries in BOTH languages; fully offline (no external scripts, fetches, absolute URLs, imports) | NOT_BUILT — no external adopter | `docs/agent-commerce-dashboard.html`; `test/integrations/agent-commerce-dashboard-page.test.mjs` |
| `agent-commerce-attestation` — Cross-Chain Execution Attestation (CGXA/1) + Soroban consent-binding preparation (product 5): consent receiptId + executed-order commitment + the chain's committed binding record | BUILT | TEST_EXECUTED — the exact arc VERIFIES offline; Soroban authorized-lane consent-binding preparation (CGXA-SOROBAN/1, commit_authorized invocation payload, no broadcast) verified; the attestation view consumes nothing | NOT_BUILT — on-chain broadcast/commit_authorized call OWNER-GATED / NOT_PERFORMED (no broadcast surface exists in the module); no external adopter | `packages/agent-commerce/attest.mjs`; `test/integrations/agent-commerce-attestation.test.mjs`; `test/integrations/agent-commerce-soroban-binding.test.mjs`; `examples/agent-commerce-attestation/run.mjs` |
| `cross-chain-execution-attestation` — unified cross-chain attestation (product 5) | NOT_BUILT (SPEC'D) | NONE | NOT_BUILT | `docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md` §8; per-chain machinery committed separately (Core DAO anchors LIVE/RECORDED on chainId 1116; Stellar PSAR/1 BUILT · TEST_EXECUTED, integration NOT_BUILT) |

## Totals

Suite total: **2298 / 2298 pass**, machine-pinned in
`docs/state-snapshot.json` (the only authoritative count in the repo).
Boundary audit: **0 violations**; file count lives in the same snapshot.

| Integration status | Count |
|---|---|
| ADOPTED | **0** |
| PILOT | **0** |
| NOT_BUILT | **all surfaces** |

| Execution status | Count |
|---|---|
| EXECUTED (on-chain artifacts) | 6 |
| REAL_BOOK_EXECUTED / POLICY_GATE_EXECUTED | 3 |
| TEST_EXECUTED | 17 |
| NONE / not exercised | 6 |

**The sentence this matrix exists to make impossible:** "CoreGuard is a verified
Stellar integration." The supported sentences are: "CoreGuard has verifiable
execution evidence on Stellar mainnet" (true, checkable) and "CoreGuard has no
external Stellar adopter yet" (true, and it is the gap the roadmap closes). The
agent-commerce surfaces add offline, synthetic, fail-closed authorization and
consent evidence on this tree (BUILT · TEST_EXECUTED); they are not external
integrations and do not imply adoption, endorsement, or safety beyond the named
checks.
