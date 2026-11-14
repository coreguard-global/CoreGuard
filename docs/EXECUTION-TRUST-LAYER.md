# CoreGuard — The Execution Trust Layer for Stellar

**VERIFY · PROTECT · PROVE**

One product, four guarantees. Everything else in this repository is either a
proof of one of these four, or a lesson learned while trying to make one of them
true.

| Pillar | The question it answers | What CoreGuard returns |
|---|---|---|
| **1 · Authorization** | What was this human or agent allowed to do? | A signed receipt bound to the exact transaction bytes, with a policy and a deadline |
| **2 · Execution Firewall** | Is what is about to be signed still that thing? | `PASS` or `BLOCK` with a named reason, never a score, never a maybe |
| **3 · Verifiable Execution** | Did what ran match what was authorized? | A comparison against the signed envelope and the execution result |
| **4 · Immutable Evidence** | Can a stranger check all of this without trusting us? | An artifact + an offline verifier that needs no secret and no network |

## Why this is one product and not twelve

The repository grew a large surface — DDE, CGEP, PSAR, AGENT-GATE, DEX-GATE,
AEA/1, ADAL/1, a People's Court adapter, three chains' worth of anchors. Read as
a catalogue it looks like breadth. Read as a product it was a positioning
problem, and that problem was real: a reviewer could not tell what to buy.

The single sentence that covers the whole repository:

> **CoreGuard makes the gap between "what was authorized" and "what actually
> executed" measurable, refusable, and independently checkable.**

Every module maps onto it:

| Surface | Pillar | Where it lives |
|---|---|---|
| PSAR/1 pre-sign receipts | 1 | `packages/stellar/presign.mjs` |
| AGENT-GATE/1 (policy, ALLOW/DENY/HOLD, signed-envelope conformance) | 1 + 2 | `packages/agent-gate/` |
| DEX-GATE/1 swap conditions | 2 | `examples/stellar-dex-integration/` |
| DDE/1 delivery + dispute evidence | 3 | `packages/delivery/`, `packages/evidence/` |
| Anchor contracts (Soroban, Core 1116) | 4 | `soroban/commitment-anchor/`, `contracts/` |
| Independent verifier (JS · Rust · WASM · C/Python) | 4 | `packages/independent-verifier/`, `test/verifier-c/` |

The four-pillar demo in `examples/execution-trust/` is the whole story in one
offline command: `npm run trust:demo`.

## The two markets, and why one comes first

**CoreGuard Personal** — a wallet or DeFi user (or the agent acting for them)
sees a plain-language verdict and a receipt before signing. The value is a
refusal that names the reason, and a record they can keep.

**CoreGuard Enterprise** — a team running agents or payment rails needs policy
enforcement, multi-approval, audit evidence, and an SLA. The value is proof,
not advice: their auditor can re-verify a transaction without access to
CoreGuard's systems.

The first commercial wedge is narrower than either: **Stellar payments executed
by AI agents.** It is the only segment where all four pillars already have code
behind them, and where the buyer's pain (an agent moved money it should not
have) is concrete enough to pay for. Wallets and DEXs are the second wave;
enterprise policy packs are the third.

## Maturity, stated plainly

| Pillar | Code | Execution proof | External adoption |
|---|---|---|---|
| Authorization (PSAR/1) | BUILT | TEST_EXECUTED — 37 tests, offline | NOT_BUILT |
| Execution Firewall (AGENT-GATE/1) | BUILT | TEST_EXECUTED — field-by-field tamper matrix, replay vectors | NOT_BUILT |
| Verifiable Execution (DDE/1, DEX-GATE/1) | BUILT | TESTNET/OFFLINE VERIFIED (examples) | NOT_BUILT |
| Immutable Evidence (anchors + verifier) | BUILT | Soroban mainnet `commit` INVOKED; Core 1116 V1/V2 live; V3 source-only | NOT_BUILT |

`NOT_BUILT` in the last column is not modesty, it is the measured state: zero
external projects use CoreGuard today, and no pilot has been signed. Any
document that says otherwise is wrong, including a future version of this one.

## What this layer is not

- **Not a scam detector.** It does not claim to know whether a contract is
  malicious. It claims to know whether what is being signed is what was
  authorized — a narrower, mechanical, checkable statement.
- **Not a replacement for Soroban authorization or Stellar's protocol rules.**
  It is an additional layer that makes authorization *provable after the fact*.
- **Not a custodian.** No funds, no keys, no wallet integration that signs
  without the owner.
- **Not safe by definition.** `VERIFIED` means "conformed to the stated rules";
  it does not mean the rules were wise, or the counterparty honest.

## How the story is told to a reviewer

1. `npm run trust:demo` — four pillars, three named refusals, one receipt
   digest, all offline.
2. `docs/DEVELOPER-QUICKSTART.md` — the same thing for an integrator, with the
   measured time-to-first-pass.
3. `docs/COMPETITIVE-LANDSCAPE.md` — what simulation, wallet-security and
   monitoring vendors do, and the one axis this product owns.
4. `docs/SCF-BUILD-APPLICATION-V3.md` — the funding ask, milestone by
   milestone, with acceptance criteria that point at committed artifacts.
5. `docs/EVIDENCE-MATRIX.md` — the honesty ledger: code, execution, adoption,
   separated.
