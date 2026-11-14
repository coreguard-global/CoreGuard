# CoreGuard Stellar — 4-Month Roadmap

## Overview

Focused roadmap for SCF Build Award. 4 months, 3 core functions, verifiable deliverables.

---

## Month 1: Soroban Contract + Testnet Deployment

### Deliverables
1. Soroban commitment anchor contract deployed on testnet ✅ (done)
2. Intent-to-execution conformance tests (9 tests) ✅ (done)
3. Deterministic replay proof ✅ (done)
4. Independent verification demo ✅ (done)

### Acceptance Criteria
- [ ] Contract deployed on testnet (done)
- [ ] 9 conformance tests passing (done)
- [ ] Independent verifier can replay (done)
- [ ] Documentation updated (done)

### Verification
- `npm test` passes (1578 tests)
- `node scripts/current-state.mjs --check` passes
- Contract ID verifiable on Stellar Expert

---

## Month 2: Freighter + Soroban + Hostile Transaction Tests

### Deliverables
1. Freighter wallet integration tested end-to-end
2. Soroban contract invocation tested on testnet
3. Hostile transaction tests (tampered, replayed, etc.)
4. DEX gating tested with real Soroban DEX

### Acceptance Criteria
- [ ] Freighter sign + submit tested end-to-end in a real extension session
- [ ] Soroban invoke tested
- [ ] 10+ hostile transaction tests
- [ ] DEX gating prevents bad swaps (proven)

### Verification
- E2E test on testnet
- Hostile transaction test results
- DEX gating proof

### Progress (measured 2026-11-12, committed)
- **Freighter/agent-gate lane (partial, honest):** Freighter adapter contract + signed-envelope verification path built and test-executed; real testnet signature carried through the signed-envelope lane (`docs/evidence/agent-gate-testnet-signature.json`); runnable browser demo (`examples/agent-gate-browser/`); extension-signature attestation/promotion path exists (`scripts/agent-gate-freighter-attest.mjs`) but **no real Freighter extension has signed** (`agent-gate-freighter` remains BUILT_UNVERIFIED / TEST_EXECUTED / integration NOT_BUILT in `docs/surface-status.json`).
- **PSAR/1 (parallel Freighter proposal surface):** pre-sign authorization receipts (`packages/stellar/presign.mjs`, `npm run stellar:presign`), proposal + self-review + 90s demo video, and scoped technical-evaluation comment **posted** on `stellar/freighter#3087` (recorded; no endorsement/merge/adoption).
- **Soroban/DEX evidence present:** Soroban commitment-anchor mainnet call and first signed funded DEX swap executed with committed artifacts; DEX-GATE/1 real-book evidence + `examples/stellar-dex-integration/` (Soroban swap calls gated by DEX-GATE/1 and DDE/1 escrow, testnet/offline verified example) shipped.
- **Hostile/tamper coverage:** envelope/receipt tamper, drift, multi-op divergence, swapped-bytes, replay/field-tamper batteries and fail-closed paths are covered in committed tests/artifacts (see STATUS/surface-status/evidence).

---

## Month 3: DEX + AI Agent + External Developer Demo

### Deliverables
1. DEX gating integrated with real Soroban DEX
2. AI agent payment gate tested on testnet
3. External developer demo (one developer uses CoreGuard)
4. Documentation and examples

### Acceptance Criteria
- [ ] Real DEX swap gated
- [ ] Real AI agent payment verified
- [ ] External developer demo recorded
- [ ] Developer documentation complete

### Verification
- DEX gating proof
- AI agent payment proof
- Developer demo video
- Developer documentation

### Progress (measured 2026-11-12, committed)
- **DEX + agent-gate surfaces:** DEX-GATE/1 executed against the real mainnet XLM/USDC order book (committed evidence) and first signed funded swap confirmed (owner-authorized, gated preflight) — see `docs/EVIDENCE-MATRIX.md`; STELLAR-AGENT/1 policy-gate executed matrix committed; `examples/stellar-dex-integration/` provides a developer-runnable gated swap example.
- **Developer documentation:** `docs/STELLAR-INTEGRATION-GUIDE.md`, `docs/AGENT-PAYMENT-GATE.md`, PSAR/1 proposal/self-review/demo, and status-unification docs shipped.
- **Still open (honest):** a named external developer adopting/running the gate in their own flow (integration `NOT_BUILT`/no pilot record), a public extension-signed demo session, and third-party demo/recording beyond the committed presentation-demo assets.

---

## Month 4: Independent Verifier + Security Review + Mainnet Release

### Deliverables
1. Independent verifier (no CoreGuard dependency)
2. Security review (third-party)
3. Mainnet Soroban contract deployment
4. Production release

### Acceptance Criteria
- [ ] Independent verifier passes
- [ ] Security review complete
- [ ] Mainnet contract deployed
- [ ] Production release published

### Verification
- Independent verifier test results
- Security review report
- Mainnet contract ID
- Production release

---

## Budget ($50,000)

| Category | Amount | Justification |
|---|---|---|
| Engineering & security | $25,000 | Soroban contract, SDK integration, testing |
| Stellar integrations | $10,000 | Freighter, DEX, cross-border |
| Independent security review | $5,000 | Third-party audit |
| Infrastructure & testing | $5,000 | RPC nodes, hosting, monitoring |
| Developer adoption & docs | $5,000 | Documentation, examples, tutorials |
| **Total** | **$50,000** | Within Integration Track |

---

## Team

- **Founder**: EslaM-X (CoreGuard Global)
- **Post-funding**: 1 Soroban engineer (contract), 1 security reviewer (contract)
- **Current**: Solo founder

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Soroban mainnet fees high | Test on testnet first, optimize WASM |
| No external users | Focus on 1 DApp integration |
| Team size | Solo founder + contractors |
| Competition | Focus on unique value (conformance) |

---

## Links

- **Repo**: https://github.com/coreguard-global/CoreGuard
- **Evidence Matrix**: docs/EVIDENCE-MATRIX.md
- **Intent-to-Execution Proof**: docs/INTENT-TO-EXECUTION-PROOF.md
- **SCF Application**: docs/SCF-BUILD-APPLICATION.md