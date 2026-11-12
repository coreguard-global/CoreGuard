<div align="center">

<a href="https://github.com/coreguard-global/CoreGuard">
  <img src="https://raw.githubusercontent.com/coreguard-global/CoreGuard/main/assets/coreguard-logo-transparent.png" width="170" alt="CoreGuard">
</a>

# CoreGuard

**VERIFY&nbsp;•&nbsp;PROTECT&nbsp;•&nbsp;EMPOWER**

**The verifiable execution truth layer + fail-closed agent economy — for Bitcoin DeFi.**

*<sub>طبقة الحقيقة التنفيذية القابلة للتحقق لتمويل البيتكوين — ‏الحكم لا يستقر إلا حيث تثبتُه الأدلة</sub>*

CoreGuard tells you whether execution **conformed to what was authorized** — not merely why it looked plausible. Evidence is deterministic, independently replayable by anyone, and audited on every push; **`UNKNOWN` stays HELD** until evidence closes it.

<br>

| | |
|---|---|
| 🔗 | [![Website](https://img.shields.io/badge/website-coreguard--global.github.io%2FCoreGuard-FF8A00?style=flat-square&labelColor=0B0F14)](https://coreguard-global.github.io/CoreGuard/) [![Core Mainnet](https://img.shields.io/badge/Core%20Mainnet-anchor%20·%20chainId%201116-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/DEPLOYMENT.md) [![Stellar mainnet](https://img.shields.io/badge/Stellar%20mainnet-anchors%20·%20gates%20·%20PSAR%2F1-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md#stellar) [![Trust gate](https://img.shields.io/badge/trust%20gate-live%20anchor%20·%20independent--verify%20ladder-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/TRUST.md) |
| 📊 | [![Tests](https://img.shields.io/badge/tests-1576%2F1576%20·%20machine--pinned-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Boundary](https://img.shields.io/badge/boundary-1143%20files%20·%200%20violations-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Foundry](https://img.shields.io/badge/foundry-43%2F43%20·%20CI--measured-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) [![Claims audit](https://img.shields.io/badge/claims%20audit-PASS-FF8A00?style=flat-square&labelColor=0B0F14)](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) |

<br>

**[▶ Live playground](https://coreguard-global.github.io/CoreGuard/PLAYGROUND.html) · [🛍 Product catalog](https://coreguard-global.github.io/CoreGuard/PRODUCTS.html) · [🛡 Bilingual brand kit](https://coreguard-global.github.io/CoreGuard/BRAND.html) · [📄 One source of truth](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md)**

</div>

---

## Canonical measured state (committed, re-derivable)

| Metric | Value | Source |
|---|---:|---|
| npm tests | **1576 / 1576 pass** (machine-pinned) | [`docs/state-snapshot.json`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/state-snapshot.json) · [`docs/STATUS.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) |
| Boundary audit | **1143 files · 0 violations** | [`docs/state-snapshot.json`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/state-snapshot.json) |
| Docs-node contract | **133 executed · 79 skip-listed · 30 covered** | [`docs/state-snapshot.json`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/state-snapshot.json) |
| Foundry (contracts, Core DAO lane) | **43 / 43 pass** (CI-measured) | [CI](https://github.com/coreguard-global/CoreGuard/actions/workflows/ci.yml) · [`docs/STATUS.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) |
| Claims audit | **PASS** | [`docs/claims-registry.json`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/claims-registry.json) |

> Every number above is CI-measured on every push and pinned as a re-derivable artifact. A claim without a replayable artifact is a red flag, not a feature.

## The Trinity — one ladder, seven rungs, pinned per ecosystem

| Network | Entry / executed evidence (honest) | Status |
|---|---|---|
| **Core DAO** | Commitment anchors on **Core Mainnet (chainId 1116)**: V1 `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E`, V2 `0x66268a47e81b8f657798d7b5bbedc956df7b13fd`, Gate 4.1 intent committed (governance pending where stated). **Evidence Registry proofs hardened:** Foundry **invariant + fuzz** suite (deterministic seed/config, invariants run as the test contract’s own actions), **43/43 pass** CI-measured. No new broadcast claimed. | **LIVE / RECORDED** |
| **Stellar** | Soroban anchor **MAINNET DEPLOYED** (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`) · first commitment-anchor CALL **INVOKED** (tx `69044807…9fec`, ledger **65,337,373**, read-back exact) · first **SIGNED funded DEX swap CONFIRMED** (owner-authorized `pathPaymentStrictSend`, tx `ac2a7990…9097`, ledger **65,338,112**; `4.0598146 XLM → 0.6306239 USDC`) · **STELLAR-AGENT/1**, **DEX-GATE/1** (real mainnet order book) and **universal DApp-shield** arms **EXECUTED** with committed artifacts · Phase 5 owner-authorized Soroban deploy lane **LIVE-VERIFIED** (create ledger **65408001**, balance exact, readback `SIMULATED_NONE`) · Soroban **authorized lane** (`commit_authorized`, owner-gated, additive to deployed/1 ABI) · **AGENT-GATE/1 signed-envelope lane** + **PSAR/1 pre-sign authorization receipts** built/test-executed (integration **NOT_BUILT**) · **Freighter `#3087`** technical evaluation comment **POSTED** (no endorsement/merge/adoption) | **MAINNET LIVE / EXECUTED · integration NOT_BUILT (new surfaces)** |
| **Pi Network** | Browser DApps · Pi Wallet · Pi Commerce surfaces kept consistent with the cross-network truth table and committed records. No Pi mainnet transaction, no anchor deployment, no live integration, no signed pilot, no customer, no revenue. | **PREPARED / DRY_RUN / PLAN_ONLY** |

## Recent developments (Nov 10–12 2026) — by network, evidenced

> Mapped from committed work on `main` (Nov 10–12 2026). Items are labeled by honest status; **VERIFIED ≠ SAFE**; a proposal/comment/demo is **not** adoption, partnership, endorsement, or a security audit.

### Stellar — receipts, signed-envelope agent gate, Freighter evaluation, DEX integration

| Development | What landed (committed) | Honest status | Evidence |
|---|---|---|---|
| **PSAR/1 pre-sign authorization receipts** | Receipt bound to the **exact transaction XDR bytes before any signature exists** (sha256 + Ed25519 over canonical JSON, pinned issuer key, injected clock/window). Fail-closed **`PASS` / `BLOCK`**, **11 frozen reject codes**, `executionProof: NOT_INCLUDED` on every verdict. No XDR semantic/content decode in v1 (semantic check = PSAR/2); unsigned-envelope/network boundary explicit. Offline demo: `npm run stellar:presign`. Hardened (issuer identity/proven key equality, safe window integers, hostile-input fail-closed) + project critical self-review. **90s presentation demo video** (visual replay of captured clean-clone demo output, **not** a live screen recording). | **BUILT · TEST_EXECUTED · integration NOT_BUILT** | `packages/stellar/presign.mjs`, `test/integrations/stellar-presign.test.mjs`, `examples/stellar-presign/demo.mjs`, [`docs/psar-security-review-2026-11-12.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/psar-security-review-2026-11-12.md), [`docs/freighter-presign-integration-proposal-2026-11-12.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/freighter-presign-integration-proposal-2026-11-12.md), `docs/surface-status.json` (`stellar-presign-receipt`) |
| **Freighter `#3087` technical evaluation (posted, recorded)** | Scoped feasibility/boundaries comment (technical evaluation only) posted after explicit owner approval and recorded in STATUS/outreach ledger. | **COMMENT POSTED** — **no endorsement, no merge, no adoption** | [stellar/freighter#3087 comment](https://github.com/stellar/freighter/issues/3087#issuecomment-6834273239) |
| **AGENT-GATE/1 signed-envelope lane** | Three-axis status unification; `AGENT-XDR/1` envelope build/decode; Freighter adapter contract (incl. swapped-bytes refusal); verifier CLI (exit 0/2/3/4) + in-process bench artifact; **authorized intent bound to signed envelope bytes field-by-field**; real **testnet signature** carried through the lane (committed evidence); runnable **browser demo** for a judge; Freighter **extension-signature attestation/promotion** path (writes evidence only after server-verified Ed25519 by the declared key). No real Freighter extension signed in CI. | **BUILT / TEST_EXECUTED (per surface) · integration NOT_BUILT** | [`docs/AGENT-PAYMENT-GATE.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/AGENT-PAYMENT-GATE.md), [`docs/STELLAR-STATUS-UNIFICATION.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STELLAR-STATUS-UNIFICATION.md), `packages/agent-gate/`, `docs/evidence/agent-gate-testnet-signature.json`, `docs/evidence/agent-gate-bench.json`, `examples/agent-gate-browser/`, `scripts/agent-gate-freighter-attest.mjs`, `docs/surface-status.json` |
| **Stellar DEX integration example (Soroban swap + gates)** | End-to-end example: Soroban swap calls gated by **DEX-GATE/1** and **DDE/1** fail-closed escrow; runnable offline/testnet-verified flow. | **TESTNET/OFFLINE VERIFIED (example)** | `examples/stellar-dex-integration/` (`dex-gate.mjs`, `run-dex-swap.mjs`, `verify-offline.mjs`, `test.mjs`) |
| **Executed Stellar mainnet evidence (context, unchanged)** | Soroban commitment anchor deployed; first `commit` CALL **INVOKED**; first signed funded DEX swap **CONFIRMED** (owner-authorized, gated preflight); agent/DEX/shield gate surfaces executed with digest-checked artifacts. Later signed money-moving sweeps remain credential-gated by design. | **EXECUTED / MAINNET VERIFIED (as recorded)** | [`docs/EVIDENCE-MATRIX.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/EVIDENCE-MATRIX.md), `docs/evidence/stellar-soroban-commit-executed.json`, `docs/evidence/stellar-dex-swap-executed.json`, `docs/evidence/stellar-agent-gate-executed.json`, `docs/evidence/stellar-dex-gate-executed.json`, `docs/evidence/universal-dapp-shield-executed.json` |

### Core DAO — evidence-registry proofs & anchor truth

| Development | What landed (committed) | Honest status | Evidence |
|---|---|---|---|
| **Invariant + fuzz proofs over the Evidence Registry (chain 1116 lane)** | Foundry invariant suite and fuzz properties over `EvidenceRegistry` contracts; deterministic seed/config in `foundry.toml`; invariants run as the test contract’s own actions (not a cheatcode target); Foundry count pinned to what `forge` actually reports; CI step executes invariant/fuzz tests. | **SHIPPED / CI-measured — Foundry 43/43 pass** | `.github/workflows/ci.yml`, `foundry.toml`, `test/contract/`, [`docs/STATUS.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md) |
| **Core Mainnet anchors (recorded truth, unchanged claims)** | Live commitment anchors on **Core Mainnet (chainId 1116)** remain the recorded on-chain truth (V1/V2 and Gate 4.1 intent committed — governance pending where stated). No new broadcast claimed in this cycle. | **LIVE / recorded** | [`docs/STATUS.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/STATUS.md), [`docs/DEPLOYMENT.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/DEPLOYMENT.md) |

### Pi Network — consistency preserved (no status promotion)

| Development | What landed (committed) | Honest status | Evidence |
|---|---|---|---|
| **Cross-network docs/truth-table sync** | Pi Network killer-features, Trinity, and roadmap/product references kept consistent with the measured snapshot and cross-network truth table. No new Pi mainnet transaction, anchor deployment, live integration, signed pilot, customer, or revenue. | **PREPARED / DRY_RUN / PLAN_ONLY (unchanged)** | [`docs/PI-KILLER-FEATURES.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/PI-KILLER-FEATURES.md), [`docs/TRINITY-CORE-STELLAR-PI.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/TRINITY-CORE-STELLAR-PI.md) |

## Products & services (shipped surfaces, honesty-labeled)

- **CGEP/1 execution-truth receipts:** intent → policy → commitment → receipt → independent verifier → anchor.
- **Execution Firewall:** wrap actions (swap · lend · borrow · bridge · vote · agent proposal) with **ALLOW / DENY / HOLD** + verifiable commitment.
- **Stellar (executed / shipped):** `packages/stellar` engine & gating, Soroban commitment anchor (deployed/invoked), **STELLAR-AGENT/1** and **DEX-GATE/1** executed surfaces, universal DApp shield arms, `examples/stellar-dex-integration/` (gated Soroban swap example).
- **Stellar (built, integration NOT_BUILT):** **PSAR/1 pre-sign receipts** (`packages/stellar/presign.mjs`, `npm run stellar:presign`) and **AGENT-GATE/1 signed-envelope** lane (`packages/agent-gate/`, CLI/bench/demo/testnet-signature evidence) — no external wallet/extension adoption claimed.
- **Core DAO:** on-chain commitment anchors (1116) and **Evidence Registry** with Foundry unit/invariant/fuzz coverage (43/43 CI-measured).
- **DDE/1 / ESCROW/1:** dispute-boundary & delivery surfaces, including **ESCROW/1** bounty-escrow mirror and fail-closed escrow examples (as cataloged in [`docs/PRODUCTS.md`](https://github.com/coreguard-global/CoreGuard/blob/main/docs/PRODUCTS.md)).
- **x402 reserve-before-sign, AgentProof, badges/claims/passports, contributor tooling:** shipped as committed modules/docs with explicit status labels (see catalog/STATUS).

## What we never claim

**`UNKNOWN` stays HELD.** **VERIFIED ≠ SAFE.** Execution proof ≠ security audit. We do **not** claim revenue, customers, partnerships, funding awards, external adoption, third-party audit, or live wallet/extension integration unless a named, committed, replayable artifact states it. For Stellar: the Soroban anchor contract, first anchor CALL, and first signed funded gated swap are executed as recorded; Phase 5 live-verify and the authorized lane are evidenced as stated — later signed money-moving sweeps remain credential-gated by design; PSAR/1 and AGENT-GATE/1 integration surfaces remain **NOT_BUILT** (a posted comment/proposal/demo is not adoption). **Pi** remains **PREPARED / DRY_RUN / PLAN_ONLY**.

## Engage

1. **Integration pilots** — put the Execution Firewall in front of a real action flow.
2. **Grant-funded builds** — Core DAO · Stellar · Pi Network program participation.
3. **Strategic partnerships** — wallets · DEXs · exchanges · agents · auditors · insurers.

<div align="center">

**Founder** [EslaM-X](https://github.com/EslaM-X) · **GitHub** [coreguard-global](https://github.com/coreguard-global) · **CoreGuard repo** [coreguard-global/CoreGuard](https://github.com/coreguard-global/CoreGuard) · **LinkedIn** [coreguard-global](https://www.linkedin.com/company/coreguard-global) · **X** [CoreGuardGlobal](https://twitter.com/CoreGuardGlobal)

<br>

<sub>🛡 CoreGuard — VERIFY • PROTECT • EMPOWER · Core Orange `#FF8A00` · Deep Core `#0B0F14` · © 2026 coreguard-global · EslaM-X</sub>

</div>
