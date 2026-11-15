# CoreGuard × Stellar — Integration Pilot (LIVE, mainnet-anchored)

A working, **runnable** demonstration of how an external Stellar project (a Soroban DApp, a wallet, a DEX, an agent) adopts CoreGuard as its **execution-truth + fail-closed gate** — end to end, against the **real Stellar mainnet anchor**.

> **This is not a plan. It is executed.** The same flow a partner would ship, run against the live CoreGuard Stellar anchor (`CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`) with the same fail-closed posture.

## What it demonstrates

1. **Declare** an intent + policy (the action the Stellar DApp wants to perform).
2. **Authorize** (PRE) — `guard.authorize(intent, {declaration, policy, ...})` → ALLOW / DENY / HOLD. Fail-closed: missing context → DENY, never silent ALLOW.
3. **Execute** the Stellar action (here: a Soroban `pathPaymentStrictSend`-shaped swap on the real mainnet order book — or your own action).
4. **Capture** the execution (tx hash, block, trace).
5. **Verify** (POST) — `guard.verify({chain, intent, policy, trace})` → VERIFIED / INVALID / UNKNOWN. A swapped trace → INVALID. No chain authority → UNKNOWN (never MATCH).
6. **Anchor** — `guard.anchor(receipt)` → CGEP/1 commitment plan against the Stellar Soroban anchor (identity-enforced, owner-gated in the authorized lane).
7. **HOLD until evidence closes** — `UNKNOWN` stays HELD; only a VERIFIED receipt + party acceptance (DDE/1) releases a payout.

## Run it

```bash
# offline (no network, no keys, no money) — the honest default
node examples/stellar-integration-pilot/demo.mjs

# with a real Stellar mainnet tx (read-only, needs no funds)
node examples/stellar-integration-pilot/demo.mjs --tx <stellar-tx-hash>
```

## What a partner gets in 3 calls

```js
import { createGuard } from "@coreguard/sdk";
import { mainnetConfig } from "../../packages/stellar/mainnet.mjs";

const guard = createGuard();
const pre   = await guard.authorize(intent, { declaration, policy, activePolicyIds, simulation, authorityAtState, evm });
const v     = await guard.verify({ chain, intent, policy, trace });   // VERIFIED | INVALID | …
const plan  = await guard.anchor(v.receipt);                          // CGEP/1 commitment + proofId
```

`authorize` is PRE-only and fail-closed. `verify` recomputes every receiptId from the payload. `anchor` is a pure offline commitment plan (no broadcast, no signing).

## Adoptability (what makes it shippable by an external Stellar project)

- **Zero runtime deps** in the engine — Node ≥ 18 + optional Foundry. Drop into any Soroban DApp, wallet, or DEX.
- **Credential-gated, never auto-pay** — signing is a funded owner decision; the gate returns VERIFIED/REJECTED/HELD and never submits.
- **Read-only verification** — `--rpc` performs chainId/transaction/receipt/block binding only; never sends or broadcasts.
- **Offline-first** — every claim re-derivable without RPC; the verifier needs zero trust in the issuer.
- **Honest labels** — wrappers stay `credential-gated` until a real counterparty + credentials + receipt exist. No fabricated traction.

## Stellar mainnet truth (pinned, digest-checked)

| Surface | Status | Evidence |
|---|---|---|
| Mainnet wallet — live | `GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U` | `docs/EVIDENCE-MATRIX.md` |
| Soroban anchor — MAINNET DEPLOYED | `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP` (stellar.expert-listed) | `docs/evidence/stellar-soroban-wasm-manifest-42519059778.json` |
| Anchor CALL — INVOKED | tx `69044807…`, ledger 65,337,373, read-back `{hash, seq}` exact | `docs/evidence/stellar-soroban-commit-executed.json` |
| First SIGNED FUNDED swap — CONFIRMED | tx `ac2a7990…`, ledger 65,338,112, `4.0598146 XLM → 0.6306239 USDC` | `docs/evidence/stellar-dex-swap-executed.json` |
| Phase 5 live verify | **LIVE-VERIFIED** — create ledger 65408001, readback `SIMULATED_NONE`, balance exact | `docs/evidence/stellar-soroban-deploy-live-verify-2026-11-10.json` |
| Soroban authorized lane | owner-gated `commit_authorized` (identity enforced in-contract) | `soroban/commitment-anchor` |

## Honest scope (what this pilot does NOT claim)

- No live external integration until a named counterparty + per-step owner approval exist (Decision A/B, 2026-09-25).
- No revenue, customers, partners, or third-party badges until a named event with evidence.
- No "we make Stellar secure" — we make execution **provable** (smaller, defensible, verifiable claim).
- Pi stays `DRY_RUN`/`PLAN_ONLY` by design.

## Integration checklist (for a real Stellar partner)

1. Fork / copy `examples/stellar-integration-pilot/` into your project.
2. Replace the action with your own Soroban call (swap, payment, lend, borrow, bridge, vote).
3. Declare intent + policy → `guard.authorize` (PRE).
4. Execute your action on Stellar (your wallet/submitter).
5. Capture tx hash + block + trace → `guard.verify` (POST).
6. On VERIFIED: `guard.anchor` → commitment plan against the CoreGuard Stellar anchor.
7. Wire DDE/1 (`releaseWhen`) so payouts release only on party acceptance — never on engine verification or payment settlement.
8. Run `npm run claims:audit` + `npm run release:gate` in your CI — the gate refuses to ship an over-claim.

## See also

- `examples/agent-platform-integration/` — SDK arc + wire-level payout gate (4 holds → 1 release)
- `examples/stellar-gate/` — Soroban commitment anchor end-to-end (testnet)
- `examples/stellar-verify/` — verification engine on Stellar testnet
- `packages/stellar/` — intent→policy→gate engine (Soroban DEX, mainnet runner, Freighter wrapper)
- `docs/STELLAR-INTEGRATION-GUIDE.md` · `docs/STELLAR-ECOSYSTEM-INTEGRATION.md` · `docs/INTENT-TO-EXECUTION-PROOF.md`
- `docs/EVIDENCE-MATRIX.md` (row-by-row Stellar truth) · `docs/PRODUCTS.md §11` (full deliverable catalog)

**Founder:** EslaM-X · **GitHub:** coreguard-global · **Website:** https://coreguard-global.github.io/CoreGuard/
