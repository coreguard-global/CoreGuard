# Competitive landscape — what the neighbours do, and the one axis we own

Written 2026-11-14. Sources are public product pages, read the same day; prices
are unpublished for almost every vendor below, which is itself a fact a buyer
should know. This document does **not** claim CoreGuard is first, only, or
better at detection. It claims one thing the table makes visible.

## The set (and what each is actually for)

| Vendor / product | Category | Mechanism, in their words | Evidence artifact a third party can re-verify? | Pricing model |
|---|---|---|---|---|
| **Blockaid** — Transaction Security | pre-sign transaction security | simulation + validation of state changes before signing, <300 ms P99; address/token/dApp scanning; claims 99.998% accuracy with unpublished methodology [1] | No — a verdict, not a portable proof | unpublished; demo/sales |
| **Hypernative** — Transaction Guard | pre-sign simulation + policy + monitoring | "pre-signing simulation, threat prevention, and customizable policy enforcement"; Transaction Guard validates "independently of the wallet UI"; 300+ risk types [2][3] | No — a decision inside their platform | unpublished; demo |
| **Hexagate** (Chainalysis) | pre-sign + monitoring | detection language, contract pauses, transaction blocking, wallet-compromise detection [4][5] | No | unpublished; demo/free start |
| **Tenderly** | simulation & debugging | simulate any transaction against live state; traces, decodes, monitors [6] | No — traces belong to the simulation, not to the authorization | seat/usage SaaS |
| **Forta** (Risk + Firewall) | monitoring + sequencer-level screening | detection bots; "Firewall screens transactions at the sequencer" [5] | No | network/subscription |
| **Skyfire**, **Coinbase CDP Agentic Wallet** | AI-agent spend governance | per-token caps, per-request caps, expiry; "agents respect these limits but can't change them" [7] | No — the cap is enforced, the proof is not exportable | platform fees |

Sources: [1] blockaid.io/transaction-security · [2] hypernative.io/product/transaction-guard ·
[3] hypernative.io/product · [4] chainalysis.com/product/hexagate · [5] guardian.security/blog/best-smart-contract-monitoring-tools ·
[6] docs.tenderly.co · [7] pinkwallet.com/agentic/learn/ai-agent-spend-governance-tools-compared

## What this table says

Every serious neighbour answers **"is this transaction dangerous?"** — with
models, threat intel, simulations, and a verdict you are asked to trust. That is
a valuable product, and CoreGuard does not compete with the detection quality of
companies with years of labelled attack data.

CoreGuard answers a different question:

> **"Is this transaction still exactly the one that was authorized — and can
> someone who does not trust you prove it later?"**

That difference shows up in four properties no row above lists:

1. **Binding to bytes.** The authorization is issued over the exact signed
   envelope, so a single-stroop change invalidates it (`XDR_BINDING_MISMATCH`).
   A risk score cannot express that; it can only lower a number.
2. **A portable artifact.** The receipt verifies offline with a public key and
   no service — `npm run trust:verify` in this repo. Vendors above return a
   verdict inside their platform.
3. **Fail-closed with a named reason.** `BLOCK` carries a code from a frozen
   list, so a refusal is auditable instead of a red banner.
4. **Authorization-versus-execution separation.** The receipt says explicitly
   `executionProof: NOT_INCLUDED`; execution proof is a separate ledger
   read-back. Most tools blur "looks fine" into "ran fine".

## Where CoreGuard is behind, without euphemism

| Axis | Neighbours | CoreGuard today |
|---|---|---|
| Chain coverage | 55–75+ chains | Stellar + Core (1116); nothing else proven |
| Attack data / ML | years of labelled incidents, 300+ risk types | none; rules and cryptographic binding only |
| Brand and distribution | named in major wallets | zero external users |
| Latency at scale | <300 ms P99 measured, production-hardened | in-process bench only |
| Soroban coverage | effectively none of them | the only place we are ahead — and it is real |

## The honest positioning sentence

> Simulation tells you what a transaction *would do*. CoreGuard proves that what
> you signed is what you authorized, and hands a stranger the receipt.

If that sentence is false for a buyer's use case, they should buy simulation.
The product's job is to be the layer that answers the second question on
Stellar, where nobody currently does — not to pretend it answers the first
better than the companies whose entire dataset is that question.

## What would change this document

- A vendor shipping portable, offline-verifiable authorization artifacts → the
  differentiation collapses to Soroban coverage.
- CoreGuard shipping detector models → it becomes a worse Blockaid, not a
  better one. The strategic answer is integration (consume their verdicts as an
  input to our policy), not competition.
