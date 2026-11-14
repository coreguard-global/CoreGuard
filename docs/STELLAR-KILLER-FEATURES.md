# CoreGuard for Stellar/Soroban - Killer Features

> "Verify before you submit. Replay after. Held if unknown."
> AI-agent first. Fail-closed. Deterministic. Measurable. Undeniable.

## Killer Feature
Intent-to-Evidence Binding (ITEB/1) - Bind every Stellar/Soroban intent to tamper-evident, replayable evidence. Any mutation breaks binding.

## Killer Use
AI Agent Payment Gate (AIPG/1) - Agents propose payments; CoreGuard verifies against policy and deterministic replay before Stellar submission. VERIFIED only. **Executed evidence:** `docs/evidence/stellar-agent-gate-executed.json` (VERIFIED / REJECTED / HELD matrix, digest-checked; submission stays credential-gated) — `node scripts/stellar-agent-gate-executed.mjs --verify`.

## Killer On-Chain
Soroban Commitment Anchor (SCA/1) - **MAINNET DEPLOYED (2026-11-04) AND the first anchor CALL EXECUTED (2026-11-06, MAINNET VERIFIED):** contract `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`, creator = the CoreGuard wallet, third-party-listed (stellar.expert). Owner-authorized `commit(proofId, commitment)` **INVOKED** (tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger `65,337,373`, exact chainId-1116 pair), pass-confirmed on-chain by the contract's own read-back (`read(proofId)` = `{hash, seq}` exact on the wire). **Executed evidence:** `docs/evidence/stellar-soroban-commit-executed.json` — `node scripts/stellar-soroban-commit-executed.mjs --verify`.

## Killer Utility
Universal DApp Shield (UDS/1) - Wrap ANY Stellar/Soroban action (swap, lend, borrow, bridge, vote). ALLOW/DENY/HOLD with commitment and replayHash. **Executed evidence:** `docs/evidence/universal-dapp-shield-executed.json` (2 ALLOW · 2 REQUIRE_REVIEW · 1 DENY · 1 REFUSED Q-FW10 seam) — `node scripts/universal-shield-executed.mjs --verify`.

## Killer Pre-Sign (PSAR/1) — wallet-facing receipt surface
Pre-sign Authorization Receipts (PSAR/1) — a receipt bound to the exact transaction XDR bytes (sha256 + Ed25519 over canonical JSON, pinned issuer key, injected clock/window), fail-closed `PASS`/`BLOCK`, 11 frozen reject codes, `executionProof: NOT_INCLUDED` on every verdict (no XDR semantic/content decode in v1). **Status:** `code: BUILT` · `execution: TEST_EXECUTED` · `integration: NOT_BUILT` (`docs/surface-status.json`). **Evidence:** `packages/stellar/presign.mjs`, `test/integrations/stellar-presign.test.mjs`, `examples/stellar-presign/demo.mjs` (`npm run stellar:presign`, offline), `docs/psar-security-review-2026-11-12.md`, `docs/freighter-presign-integration-proposal-2026-11-12.md`. **Freighter:** scoped technical-evaluation comment posted on `stellar/freighter#3087` and recorded (feasibility/boundaries only; no endorsement/merge/adoption). **Demo video (90s):** `assets/coreguard_psar1_freighter_90s.mp4` (visual replay of captured clean-clone demo output, not a live screen recording).

## Killer Adoption
One-Line Integration (OLI/1) - aiAgentPaymentGate in 3 lines. Works with Freighter, wallets, DEXs, Soroban contracts, AI agents. **Publish truth:** the npm closure is publish-ready and CI-parity-checked (`npm run publish:check`); the registry steps remain double-gated pending the `NPM_TOKEN` Actions secret.

**AGENT-GATE/1 signed-envelope lane (Nov 10–12 2026, honest):** `AGENT-XDR/1` envelope build/decode, Freighter adapter contract, verifier CLI (0/2/3/4), in-process bench, authorized-intent ↔ signed-envelope field binding, real testnet signature evidence, runnable browser demo, and Freighter extension-signature attestation/promotion path — **BUILT / TEST_EXECUTED per surface · integration NOT_BUILT** (no real extension signed in CI; no external adopter). See `docs/AGENT-PAYMENT-GATE.md`, `docs/STELLAR-STATUS-UNIFICATION.md`, `docs/surface-status.json`, `docs/evidence/agent-gate-*.json`, `examples/agent-gate-browser/`.

**Developer integration example:** `examples/stellar-dex-integration/` — Soroban swap calls gated by DEX-GATE/1 and DDE/1 fail-closed escrow (**TESTNET/OFFLINE VERIFIED, example**).

## Killer Exchange
First SIGNED funded mainnet swap (DEX-GATE/1) — **MAINNET VERIFIED (2026-11-06, owner-authorized):** the first SIGNED, FUNDED XLM→USDC swap on the REAL Stellar mainnet order book, gated by DEX-GATE/1 preflight (both gates VERIFIED before any submission), sized wallet-bounded within a real-depth-derived ceiling, `pathPaymentStrictSend` signed with the owner keypair and CONFIRMED — swap tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger `65,338,112` (trustline tx `09243337fd04d7ead8e369a8a5d5ef48648179db84608b262d5379f34fa72d76`, ledger `65,338,111`); `4.0598146 XLM → 0.6306239 USDC` (0.1578331 USDC/XLM; destMin 0.6011661 cleared; wire read-back equals `fee_charged` to the stroop) · `docs/evidence/stellar-dex-swap-executed.json` — `node scripts/stellar-dex-swap-executed.mjs --verify`.

## Killer Reference
- Fail-closed: UNKNOWN -> HELD, never auto-pay/auto-refund
- L2 production-grade: audit trail + replayHash + diff + report
- Reserve-before-sign enforced
- No secrets by default
- All claims measured from committed tree

## Killer Customer
AI Agent Marketplaces, Stellar DEXs/AMMs, Soroban DeFi, Payment Rails/Wallets, Escrow/A2A, Bridges - all need this NOW.

## Stellar Ecosystem Integration
Targets: Freighter, Albedo, xBull, Lobstr, Rabet, Soroswap, Phoenix, Aquarius, Blend, Echo, Horizon, Soroban RPC, MoneyGram Access, anchors, AI agents (LangChain/OpenAI/ElizaOS).

## Working Proof
- Live testnet demo: npm run stellar:demo (real tx verified + replayed)
- Packages: packages/stellar/, packages/stellar-agent/, packages/stellar-killer/, packages/agent-gate/
- Tests: all passing, CI green
- Measured: 1578 tests, 1159 files / 0 violations, 0 red checks (state-snapshot)
