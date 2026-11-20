# Evidence — one page, Core and Stellar

Everything on this page is re-derivable from the committed tree or from a public
chain. Where something is not proven, the page says so in the same table.

`VERIFIED` ≠ `SAFE`. These are conformance facts: what was authorized, what was
executed, what a third party can check. They are not an audit, not an adoption
metric, and not a claim that any outcome was good.

## Stellar — executed on mainnet

| What | The record | Status |
|---|---|---|
| Soroban commitment anchor | Contract `CCKA2GYV…QMMXPSP`; first `commit()` transaction `69044807…5dbc9fec`; ledger **65,337,373** | EXECUTED |
| First signed funded swap gated by DEX-GATE/1 | Transaction `ac2a7990…640b9097`; ledger **65,338,112** | CONFIRMED |
| PSAR/1 pre-sign authorization receipts | Reject-code catalogue frozen; technical evaluation posted to Freighter #3087 | BUILT · wallet integration NOT BUILT |
| Authorized lane deployed on mainnet | — | NOT DEPLOYED |

## Core DAO — live on mainnet

| What | The record | Status |
|---|---|---|
| Evidence registry | `0x037dF08F…6AFf9EA6E` | LIVE |
| Contract proofs | 43/43 Foundry unit + invariant + fuzz tests, CI-measured | CI-MEASURED |

## Offline evidence — what anyone can re-run

| What | How a stranger checks it | Status |
|---|---|---|
| Four pillars + named refusals | `npm run trust:demo` — prints a receipt digest and an envelope hash; no keys, no network | BUILT · TEST_EXECUTED |
| Independent verifier (JS · Rust · WASM · C/Python) | `packages/independent-verifier/` — same verdict from four implementations | BUILT · TEST_EXECUTED |
| One-command pilot kit | `examples/var1-pilot-kit/run.mjs --seed …` — deterministic, seeded receipt | BUILT · TEST_EXECUTED |
| Suite total and boundary audit | `docs/STATUS.md` and `docs/state-snapshot.json`, regenerated on every push | CI-MEASURED |

The verbatim transcript of the demo is in the [README](../README.md#what-that-command-prints);
the numbers it prints are part of the assertion surface, not decoration.

## Independent reproduction — and exactly what it proves

On 19 Nov 2026 an independent standards team (Zambo / AER-1) cloned the
repository fresh, counted the CI checks themselves, and ran the VAR/1 pilot kit
with one command. The seeded receipt then re-derived byte-for-byte on three
machines across two Node runtimes. Public record:
[ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328).

| Signal | Result |
|---|---|
| Pilot-kit rows on a fresh clone, run twice | 15 / 15, exit 0 |
| CI check runs counted externally | 12 / 12 |
| Seeded receipt across three machines | byte-identical |
| AER-1 × VAR/1 outcome mapping agreed in public | 5 outcomes mapped |

**What it does not prove:** that a customer uses CoreGuard, that a pilot was
signed, that a review happened, or that the system is safe. It proves the kit is
reproducible by someone who does not work here — which is the smallest useful
external signal, and we will not inflate it.

## Pi Network

Prepared / DRY_RUN / PLAN_ONLY. No status promotion, no evidence claim. A plan is
not a deployment.

## The numbers that can fail CI

| Guard | What it stops |
|---|---|
| Doc-number scanner | Any document quoting a test total that differs from `state-snapshot.json` |
| Claims registry (CG-CL/1) | A claim asserting a status stronger than the evidence it cites; an external claim can never be VERIFIED by this repository alone |
| Boundary audit | Executable fences in prose docs, stale paths, structural drift |
| Validate-freeze | A pinned artifact edited without a re-pin and a named commit |

If a number in a deck, a page or an email cannot be produced by these guards, it
is not a number we are allowed to use.

## Reproduce in five minutes

Full path: [START-HERE.md](START-HERE.md).

1. Clone the repository, install dependencies.
2. Run the four-pillar demo and read the closing lines that state what it does
   **not** prove.
3. Compare `docs/state-snapshot.json` with what CI measured on the last push.
4. Open [EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md) for the per-surface matrix.
