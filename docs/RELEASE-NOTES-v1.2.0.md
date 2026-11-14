# CoreGuard — Release Notes (v1.2.0)

**Published 2026-11-13** as GitHub Release `v1.2.0` — tag on main HEAD `33e5606` (the owner's Soroban trim commit landed 15:32:18Z, minutes before publish; the tag holds the true current tip), whose CI run [`43453599056`](https://github.com/coreguard-global/CoreGuard/actions/runs/43453599056) is fully green: Engine (node 22) ✓ · Engine (node 24) ✓ · Contracts (foundry) ✓ · Demos ✓ · Soroban contract (Rust tests) ✓. Prepared as a draft 2026-11-12; published on explicit owner instruction — and every number below carries its evidence, the same way every claim in this repo is made. The measured state below is the snapshot committed at the tag commit — the trim commit did not touch `docs/state-snapshot.json`, so testsTotal / filesScanned / docsNode are identical to the publish-time verification.

> **Evidence-first, honesty-bound:** every item below cites committed code/tests/docs/artifacts or recorded outreach. No revenue, no customers, no partnerships, no external adoption, no third-party audit, and no live wallet integration are claimed. Where status is `NOT_BUILT`, `TEST_EXECUTED`, `DRY_RUN`, `PREPARED`, or `PLAN_ONLY`, it is stated as such.

## Canonical measured state (at publish — tag `33e5606`; snapshot unchanged since `a707d3d`)
- **npm tests:** 1578 / 1578 pass (machine-pinned)
- **Boundary audit:** 1143 files · 0 violations
- **Docs-node contract:** 133 executed · 79 skip-listed · 30 covered
- **Foundry (contracts):** 43 / 43 pass
- **Claims audit:** PASS (0 violations)
- **Sources:** `docs/state-snapshot.json`, `docs/STATUS.md`, `docs/claims-registry.json`

## Highlights (by network)

### Stellar — pre-sign receipts, signed-envelope agent-gate path, Freighter evaluation, DEX integration
| Area | What landed (committed) | Status (honest) | Evidence |
|---|---|---|---|
| **PSAR/1 pre-sign authorization receipts** | Receipt bound to the exact transaction XDR bytes before any signature exists (sha256 + Ed25519 over canonical JSON, pinned issuer key, injected clock/window). Fail-closed `PASS`/`BLOCK`, **11 frozen reject codes**, `executionProof: NOT_INCLUDED` on every verdict. No XDR semantic/content decode in v1 (semantic check = PSAR/2); unsigned-envelope/network boundary explicit. Offline demo: `npm run stellar:presign`. Hardened (issuer identity/key equality, safe window integers, hostile-input fail-closed) + critical self-review. 90s presentation demo video (visual replay of captured clean-clone demo output, **not** a live screen recording). | **BUILT · TEST_EXECUTED · integration NOT_BUILT** | `packages/stellar/presign.mjs`, `test/integrations/stellar-presign.test.mjs`, `examples/stellar-presign/demo.mjs`, `docs/psar-security-review-2026-11-12.md`, `docs/freighter-presign-integration-proposal-2026-11-12.md`, `assets/coreguard_psar1_freighter_90s.mp4`, `docs/assets/video/coreguard_psar1_freighter_90s.mp4`, `docs/PRODUCTS.html`, `docs/STELLAR-INTEGRATION-GUIDE.md`, `docs/surface-status.json` (`stellar-presign-receipt`) |
| **Freighter #3087 technical evaluation (posted, recorded)** | Scoped feasibility/boundaries comment (technical evaluation only) posted after explicit owner approval; recorded in outreach ledger and STATUS. | **COMMENT POSTED** — **no endorsement, no merge, no adoption requested or received** | https://github.com/stellar/freighter/issues/3087#issuecomment-6834273239, `docs/STATUS.md`, `docs/campaign-ops-outreach-kit-2026-09-25.md` |
| **AGENT-GATE/1 signed-envelope lane** | Three-axis status unification; `AGENT-XDR/1` envelope build/decode; Freighter adapter contract; verifier CLI (exit 0/2/3/4) + in-process bench; authorized intent bound to signed envelope bytes field-by-field; real testnet signature carried through the lane (committed evidence); runnable browser demo; Freighter extension-signature attestation/promotion path (evidence written only after server-verified Ed25519 by declared key). No real Freighter extension signed in CI. | **BUILT / TEST_EXECUTED per surface · integration NOT_BUILT** | `docs/AGENT-PAYMENT-GATE.md`, `docs/STELLAR-STATUS-UNIFICATION.md`, `docs/surface-status.json`, `packages/agent-gate/` (+adapters/CLI/bench), `docs/evidence/agent-gate-testnet-signature.json`, `docs/evidence/agent-gate-bench.json`, `examples/agent-gate-browser/`, `scripts/agent-gate-freighter-attest.mjs`, `test/ci/surface-status.test.mjs` |
| **Stellar DEX integration example** | Soroban swap calls gated by DEX-GATE/1 and DDE/1 fail-closed escrow; runnable offline/testnet-verified example flow. | **TESTNET/OFFLINE VERIFIED (example)** | `examples/stellar-dex-integration/` (`dex-gate.mjs`, `run-dex-swap.mjs`, `verify-offline.mjs`, `test.mjs`), `docs/PRODUCTS.md` §11 |
| **Previously executed Stellar mainnet evidence (context, unchanged)** | Soroban commitment anchor deployed and first `commit` call INVOKED; first signed funded DEX swap CONFIRMED (owner-authorized, gated preflight); executed gate surfaces with digest-checked artifacts. | **EXECUTED / MAINNET VERIFIED (as recorded)** | `docs/evidence/stellar-soroban-commit-executed.json`, `docs/evidence/stellar-dex-swap-executed.json`, `docs/evidence/stellar-agent-gate-executed.json`, `docs/evidence/stellar-dex-gate-executed.json`, `docs/evidence/universal-dapp-shield-executed.json`, `docs/EVIDENCE-MATRIX.md`, `docs/STATUS.md` |

| **Soroban authorized lane + ledger-sequence properties** | `commit_authorized(owner, hash)` derives the id in-contract (`sha256("coreguard-anchor-auth/1" ++ strkey(owner) ++ hash)`) and requires `owner.require_auth()`. Four ledger-sequence tests hold the property a receipt depends on: a replay returns the ledger of the FIRST write (never the replay's), new content anchors at its own ledger, the permissionless lane keeps first-write-wins across sequences, and a later sequence cannot rebind the owner's record. They run inside the existing `soroban-rust` job (`cargo test --locked` over the whole crate); a name-filtered extra step was added and then removed in review, because a filter that matches nothing still exits 0. | **SOURCE ONLY — BUILT + TEST_EXECUTED in CI · NOT DEPLOYED** | `soroban/commitment-anchor/src/lib.rs`, `.github/workflows/ci.yml` (job `soroban-rust`), `docs/STATUS.md` (§On-chain truth), `docs/EVIDENCE-MATRIX.md` |

### Core DAO — evidence-registry proofs & anchor context
| Area | What landed (committed) | Status (honest) | Evidence |
|---|---|---|---|
| **Invariant + fuzz proofs (Evidence Registry, chain 1116 lane)** | Foundry invariant suite and fuzz properties over the Evidence Registry; deterministic seed/config; invariants run as the test contract's own actions (not a cheatcode target); Foundry count pinned to what `forge` reports; CI step executes invariant/fuzz tests. | **SHIPPED / CI-measured — Foundry 43/43 pass** | `.github/workflows/ci.yml`, `foundry.toml`, `test/contract/*invariant*`, `docs/STATUS.md`, `docs/state-snapshot.json` |
| **Core Mainnet anchors (context, unchanged claims)** | Live commitment anchors on **Core Mainnet (chainId 1116)** recorded (V1 `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E`, V2 `0x66268a47e81b8f657798d7b5bbedc956df7b13fd`, Gate 4.1 intent committed — governance pending where stated). No new broadcast claimed in this cycle. | **LIVE / recorded** | `docs/STATUS.md` (§On-chain truth), `docs/DEPLOYMENT.md`, frozen/live verification artifacts |

### Pi Network — honesty-preserved (no status promotion)
| Area | What landed (committed) | Status (honest) | Evidence |
|---|---|---|---|
| **Cross-network docs/truth-table consistency** | Pi Network surfaces (killer features, Trinity, roadmap/README/product catalog references) kept consistent with the measured snapshot and cross-network truth table. No new Pi mainnet transaction, no anchor deployment, no live integration, no signed pilot, no customer, no revenue. | **PREPARED / DRY_RUN / PLAN_ONLY (unchanged)** | `docs/PI-KILLER-FEATURES.md`, `docs/TRINITY-CORE-STELLAR-PI.md`, `README.md`, roadmap docs |

## Documentation, catalog & repo-surface updates
- README and roadmap docs (`docs/PRODUCTION-ROADMAP.md` addendum, `docs/ROADMAP-90-DAYS-2026-11.md`, `docs/ROADMAP-4MONTH.md`) updated with Nov 10–12 developments by network.
- Products/catalog and Stellar docs refreshed (PSAR/1, ESCROW/1 catalog presence, DDE reference i18n fixes, PSAR/1 × Freighter demo video placement).
- State/snapshot, STATUS, claims/passports/dashboard artifacts kept consistent with measured boundaries and CI-fix alignment.
- GitHub repository metadata updated (description/topics/homepage alignment) to reflect measured developments without overstating adoption.

## Upgrade / verification notes (reviewer-runnable)
```text
npm install
npm test
npm run claims:audit
npm run boundary:audit
npm run stellar:presign
```
- Deterministic/offline where applicable; no signing, no wallet, no network required for the PSAR/1 demo. `npm test` is machine-pinned/enforced against `docs/state-snapshot.json`.

## What this release must NOT be read as
- Not a claim of external adoption, wallet integration, partnership, customer, revenue, funding award, or third-party security audit.
- A posted proposal/evaluation comment is **not** endorsement, merge, or adoption.
- A presentation demo video is **not** a live screen recording and **not** proof of live wallet integration.
- `VERIFIED` (evidence/receipt/anchor conformance as specified) ≠ `SAFE`.
- Integration surfaces remain `NOT_BUILT` unless a named external integration is committed with evidence.

## Publication record
- Draft instrument: `docs/RELEASE-NOTES-v1.2.0-DRAFT-2026-11-12.md` (owner-reviewed 2026-11-12, kept untracked as the dated instrument).
- Publication decision: owner instruction, 2026-11-13 ("انشر دا").
- Publish verification: reject-code count re-measured from the module (`REJECT_CODES`, 11), all 28 cited paths existence-checked, snapshot numbers re-read from `docs/state-snapshot.json` (unchanged — no tree content moved with this release), tag identity read back from the tag ref after creation (it holds `33e5606`, the then-current main tip — an identity drift from the verification-time commit `a707d3d`, caught by reading the ref instead of assuming and corrected in this body), and CI re-confirmed green on the tag commit (run `43453599056`).
