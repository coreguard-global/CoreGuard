# Funding

CoreGuard is **independent execution trust infrastructure**: a verification and
authorization layer that proves what executed is what was authorized, and hands
an outsider a receipt they can check offline. The company is **CoreGuard
Global**; the product and protocol is **CoreGuard**, sold first as **Agent
Execution Security** ([positioning](POSITIONING.md)).

We are a small, auditor-honest team asking for **milestone-based** funding to
ship the product to production and to its first external pilots. Core is one
integration, not the identity: CoreGuard also runs on Stellar (executed mainnet
anchor and first gated swap) with a planned Pi lane.

**Status of the ask:** $150,000 requested, **not awarded**. No revenue, no
customers, no signed pilot, no third-party security review. The tranche release
criteria are in [COREGUARD-INVESTMENT-READINESS.md](../COREGUARD-INVESTMENT-READINESS.md#8--funding-requirements).

## Ask (milestone-gated, Core-native)

1. **Bridge grant / seed** — take v0.1 (built, tested; on-chain anchor **live on
   Core Mainnet**; Testnet2 staged-hardening campaign `PREPARED / FUNDING-BLOCKED`
   pending tCORE2) to production: achieve a genuine pre-declared commitment
   flow for real users.
2. **Core Guard integration** — the core team's public infrastructure layer.
3. **Post-MS1: Execution Firewall (v0.2)** — simulation-gated smart accounts
   that *enforce* intent/policy at runtime, not just prove it after the fact.
4. **Post-MS2: Passport / reputation + risk findings (v0.3)** — discretionary,
   explicitly marked as risk *findings*, never a fuzzy safety score.
   **First-pass shipped 2026-09-25** (CG-RP/1 reputation + CG-RF/1 risk findings
   as enforced deterministic code reading committed sources only; reputation =
   recorded external milestones, every external counter still 0).

## Why Core

CoreGuard is Core-native by design:

- Anchors commitments on **Core Testnet2 (1114) → Core Mainnet (1116)**.
- Designed for BTCFI: vaults, strategies, swaps, staking, Bitcoin-staked
  services — where "the money moved" and code now acts for people.
- Complements Core's proof infrastructure (coreBTC locking/unlocking, dual
  staking): we prove *what was authorized to happen with those positions*.

## Why us

- **We already built it.** Not a pitch deck — a deterministic, tested,
  adversarially benchmarked engine. **2009 / 2009 tests,
  73/73 adversarial benchmarks, anchor integrity VERIFIED live on Core
  Mainnet** (authoritative numbers: [`docs/STATUS.md`](STATUS.md)), and a
  staged Testnet2 hardening campaign (controlled validation)
  ready to run — `PREPARED / FUNDING-BLOCKED`, waiting on tCORE2 funding.
- **Auditor-honest.** VERIFIED ≠ SAFE is in our README baseline. We will not
  sell you "prevents all exploits". That credibility is worth more than hype.
- **Scope-disciplined.** v0.1 = evidence + anchor. No dashboard theater, no
  fake metrics, no unfalsifiable security claims.

## What we will not claim

- That CoreGuard "secures" or extends Core consensus.
- "100% secure", "audited", fake adoption/TVL/partnership metrics.
- That we are "Core-backed" before Core says so.
- Over-claiming vs competitors ("nobody does this") — see the competitive
  kill matrix in `spec/` for the defensible framing.

## Commercial path

- **CoreGuard SDK** — subscription or enterprise licence.
- **Managed verification** — per-verification service fee.
- **Enterprise integration** — integration plus support and SLA.

Open core: the verifier and receipt format stay MIT and free to run offline.
Detail: [BUSINESS-MODEL.md](BUSINESS-MODEL.md).

## Contact

Open an issue or PR on this repository to start the conversation.