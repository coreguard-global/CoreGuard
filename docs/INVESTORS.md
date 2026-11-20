# Investors — the short version

The full document is [COREGUARD-INVESTMENT-READINESS.md](../COREGUARD-INVESTMENT-READINESS.md).
This page is the one-screen version, and it states the uncomfortable facts next
to the good ones.

## What we build

**CoreGuard — Independent Execution Trust Infrastructure.** A verification and
authorization layer that runs beside wallets, agent runtimes, DEXs and payment
rails and proves that what executed is what was authorized, in a form an
independent party can re-check offline.

Commercial product: **CoreGuard Agent Execution Security** — authorization
firewall, execution verification, verifiable consent receipts.

## Why this market, why now

Agents sign transactions faster than humans can review them. Every wallet shows
*what a transaction looks like*; almost none can show *that what executed is what
was approved*, and even fewer can hand a stranger a receipt that proves it. As
agents start moving money (subscriptions, purchases, payouts, treasury ops), the
buyer's problem stops being "is this contract safe" and becomes "did my agent do
the thing I authorized — and can I prove it after the fact".

CoreGuard is aimed at that second question, which every incumbent has to answer
about somebody else's system.

## Where we are (measured, not asserted)

| | |
|---|---|
| Engine | Four pillars built and test-executed; offline verifier in four languages |
| Suite | 1925/1925 tests on the committed tree, CI-measured on every push |
| Stellar | Mainnet anchor executed; first gated funded swap confirmed; PSAR/1 receipts built |
| Core DAO | Evidence registry live on mainnet; 43/43 Foundry proofs |
| Independent reproduction | One external standards team reproduced our open kit byte-for-byte (ACP #328) |
| Customers, pilots, revenue | **Zero. None signed. No revenue.** |
| Third-party security audit | **Not performed.** Scope drafted, budgeted, not bought. |

`VERIFIED` ≠ `SAFE`, and a technical reproduction by a friendly team is not a
customer, an audit, or an endorsement.

## The ask

**$150,000, milestone-gated** (SCF #46 Build Award — requested, not awarded):

| Tranche | Amount | Unlocks |
|---|---:|---|
| T1 | $40,000 | SDK v1 + measured 15-minute quickstart |
| T2 | $55,000 | Authorized lane deployed on Soroban testnet from CI-built wasm |
| T3 | $55,000 | Two external pilots + closed independent security review + enterprise pack |

Each tranche is released against artifacts, not weeks elapsed. Full budget and
acceptance criteria: [COREGUARD-INVESTMENT-READINESS.md](../COREGUARD-INVESTMENT-READINESS.md#7--funding-requirements).

## Business model in one table

| Product | Revenue |
|---|---|
| CoreGuard SDK | Subscription or enterprise licence |
| Managed Verification | Per-verification service fee |
| Enterprise Integration | Integration, support and maintenance contracts |

Core stays open source (MIT); the commercial value sits in operation,
integration, assurance and support. Licensing implications are reviewed before
any commercial component is added — see [BUSINESS-MODEL.md](BUSINESS-MODEL.md).

## What would make this a bad investment (our own list)

1. No design partner signs a two-week pilot inside the funded window.
2. An incumbent ships portable, offline-verifiable receipts as a commodity.
3. The independent review finds a binding flaw that takes more than the retained
   budget to fix.
4. A solo founder cannot hold architecture, delivery and partnerships at once —
   which is why two contractor roles are named in the budget.

Mitigations for each are in the readiness document, section 9.

## What we will not do

- Present a request as an award, or a reproduction as a pilot.
- Quote a test count, an anchor or a benchmark that CI cannot re-derive.
- Sell "prevents all exploits" or a safety score. Refusals carry names.

## Next step

Two-week scoped pilot on one real flow, with a written go / no-go at the end:
[PARTNERSHIPS.md](PARTNERSHIPS.md) · [PILOT-KIT.md](PILOT-KIT.md).
Contact: [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com).
