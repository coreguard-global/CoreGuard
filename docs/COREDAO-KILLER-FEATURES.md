# Core DAO Killer Features (COREDao-KILLER/1)

> **Verify before you submit on Core DAO. Replay after. Held if unknown.**
> AI-agent native. Fail-closed. Deterministic L2 replay. Built for EVERY Core DApp, wallet, agent.

## Killer Feature / Killer Use / Killer On-Chain / Killer Utility / Killer Adoption / Killer Reference / Killer Customer
| Item | Description |
|---|---|
| **Killer Feature** | Intent-to-Evidence Binding for Core DAO (tamper-evident, replayable) |
| **Killer Use** | AI Agent Payment Gate for Core - verify agent proposals before submission |
| **Killer On-Chain** | Core Commitment Anchors — live on **Core Mainnet (chainId 1116)** as recorded in [STATUS.md](STATUS.md): V1 `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E` (VERIFIED ANCHOR INTEGRITY), V2 `0x66268a47e81b8f657798d7b5bbedc956df7b13fd` (commitIntent/anchorProof verified), Gate 4.1 intent committed (governance-pending where stated). `EvidenceRegistryV3` implemented (not deployed; owner-only). |
| **Killer Utility** | Universal DApp Shield - wrap ANY Core DApp action |
| **Killer Adoption** | One-line integration for entire Core ecosystem |
| **Killer Reference** | Deterministic replay-before-submit with audit trail + replayHash + diff + report |
| **Killer Customer** | Core DeFi, Core DApps, Core Wallets, AI Agents, Validators Tooling, Escrow/A2A |

## Quick Start
```js
import { coreGate } from "@coreguard/coredao-killer";
const g = coreGate({ agentId:"a1", payment:{destination:"0x...",amount:"10"}, policy:{maxAmount:100}, rules:[{id:"VALUE_LIMIT"}] });
if(g.allowed){ /* VERIFIED only - never auto-pay */ }
```

## Core Ecosystem
Core DAO • Core Chain • Core DeFi • Core DApps • Core Wallets • AI Agents

## Why it wins
- **Problem-first**: AI agents need proof of conformance before spending
- **Unique**: Fail-closed (UNKNOWN -> HELD) + deterministic replay
- **Ecosystem-wide**: Protects every app
- **Working proof**: Built on tested engine, CI green
- **Measurable**: All claims from committed tree

## Recent developments (Nov 10–12 2026, measured)
- **Evidence-registry proofs (chain 1116 lane):** Foundry invariant + fuzz proofs over the Evidence Registry with deterministic seed/config (`foundry.toml`); invariants run as the test contract's own actions (not a cheatcode target); CI executes `forge test --match-path "test/contract/*invariant*"`. **43/43 Foundry tests pass** (CI-measured, pinned to `forge` output) — `.github/workflows/ci.yml`, `test/contract/*invariant*`, [STATUS.md](STATUS.md).
- **Measured repo state:** 1576/1576 npm tests, 1145 files / 0 violations, docs-node 133/79/30 — [state-snapshot.json](state-snapshot.json).

**Status:** Core anchors **LIVE/recorded** on chain 1116 (see STATUS); this COREDao-KILLER packaging surface remains an integration/product wrapper with ecosystem integrations **NOT BUILT** unless separately evidenced. | **Version:** COREDao-KILLER/1
