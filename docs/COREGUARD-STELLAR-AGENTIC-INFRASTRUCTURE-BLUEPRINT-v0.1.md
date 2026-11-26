# CoreGuard × Stellar Agentic Infrastructure Blueprint v0.1

**Status:** `RESEARCH / BLUEPRINT / NOT_BUILT` — historical v0.1 plan. Implementation status is now tracked in `docs/COREGUARD-STELLAR-AGENT-SECURITY-SPEC-v0.2.md` (P1–P4 offline implementation; P5 owner-gated; P6 not built).
**Date:** 2026-11-25
**Owner gate:** no production deployment, signing authority, live Stellar RPC, live x402 settlement, customer pilot or security claim is authorized by this document.

## 1. What the Stellar announcement actually is

Stellar announced a new home and documentation portal for **developers, teams, and AI agents** building on Stellar:

- https://developers.stellar.org
- https://developers.stellar.org/docs

The portal presents Stellar as a full developer stack: network primitives, Soroban smart contracts, JavaScript/Go/Rust SDKs, Stellar CLI, Stellar RPC, **MCP and skills**, and **x402 agent payments**. The AI page names two distinct official MCP surfaces: **Stellar Raven** (remote MCP for docs plus live ecosystem data, OAuth sign-in in the agent's client) and the **Stellar Docs MCP server** (read-only official documentation, no sign-in). It also points to official Stellar Skills, including Agent Payments (x402/MPP). The pages were read on 2026-11-25; they describe Stellar's own tooling and ecosystem direction.

This is a **strategic signal**, not:

- an endorsement of CoreGuard,
- a CoreGuard–Stellar integration,
- evidence that any CoreGuard tool calls Stellar,
- permission to claim production compatibility.

## 2. Why it matters to CoreGuard

The direction matches the gap CoreGuard already works on: when an agent proposes a financial action, somebody must be able to answer:

- Was the action authorized, and by whom?
- Is the executed action byte-for-byte the action that was approved?
- Are amount, asset, recipient, network, policy and replay window still intact?
- Can a reviewer replay the verification independently?
- Can a refusal be produced before signing or broadcast, with a named reason?

Stellar supplies the rails and primitives. CoreGuard's differentiation is the **pre-execution authorization gate plus replayable evidence**, not another documentation helper.

## 3. What CoreGuard already has — and what it does not have

### Committed and published

- `@coreguard/agent-commerce@0.4.0` is published (gated release run `45717671413`), with **94 MCP tools / 72 skills**.
- The published surface includes offline Stellar-family and x402-family tools such as `coreguard_verify_stellar_settlement_evidence`, `coreguard_verify_stellar_path_payment`, `coreguard_parse_x402_challenge`, `coreguard_authorize_x402_payment`, and `coreguard_verify_x402_settlement`.
- Wave 4 and Wave 5 are deterministic, offline and caller-supplied-evidence-only.

### Explicitly not claimed

- No live Stellar RPC, Horizon, Futurenet or Mainnet call.
- No live Soroban contract invocation or signed transaction submission by these tools.
- No live x402 provider, paywall, wallet, Freighter session, bank or anchor call.
- No Stellar Raven or Stellar Docs MCP dependency inside CoreGuard.
- No signed-in third-party MCP client `RUN-BY-HAND`.
- No customer, pilot, sponsor, audit, partnership or adoption.
- `ops/production` stays `INTEGRATION_READY, NOT_PROVISIONED`.

Existing adapters and the x402 harness remain `DRY_RUN`: `execute()` returns `NOT_PERFORMED`, `verify()` returns `UNKNOWN`, and `settle()` books zero money. See `docs/STATUS.md`, `docs/PRODUCTS.md`, `docs/live-integration-and-adoption-ladder-2026-09-25.md`, and `docs/commercial-packaging-2026-09-26.md`.

`VERIFIED != SAFE`: verification means saved bytes were unchanged. It is not settlement finality, sanctions clearance, KYC/AML approval, model correctness or compliance certification.

## 4. Proposed positioning

**CoreGuard Agent Security Infrastructure for Stellar** should be a verification layer that an agent calls *before* it signs or submits a Stellar action. It should not compete with Stellar Raven (docs/ecosystem retrieval) or Stellar Docs MCP (documentation access).

The useful boundary is:

```text
Agent intent / policy
        ↓
CoreGuard authorization gate  ← names refusal, binds exact bytes
        ↓
Stellar adapter (owner-gated) ← signs/submits ONLY when explicitly authorized
        ↓
Stellar network evidence      ← returned as caller-supplied proof, replayed by CoreGuard
        ↓
Verifiable evidence pack      ← reviewable, redactable, replayable
```

CoreGuard should not hold settlement authority by default. Signing or submitting is a separate owner decision with its own credentials, key custody and failure modes.

## 5. Proposed module map — all `NOT_BUILT` until each phase exits

| Module | Purpose | Current status |
|---|---|---|
| `stellar-agent-gate` | Evaluate an agent's proposed Stellar action against policy, intent digest, allowance, recipient, asset, network and replay window | `PLAN_ONLY` |
| `stellar-payment-adapter` | Accept a proposed payment/path payment, refuse first, then return a named pre-execution decision | `PLAN_ONLY`; existing adapter surface `DRY_RUN` |
| `stellar-evidence-binder` | Bind the approved intent bytes to the actually signed/submitted envelope or to caller-supplied network evidence | Offline primitives exist; live binding `NOT_BUILT` |
| `stellar-x402-gate` | Verify an x402 challenge/quote/settlement evidence packet before the agent pays | Offline x402 tools exist; live provider `NOT_BUILT` |
| `stellar-mcp-gate` | Expose the gate to an agent over MCP with input/output schemas and named refusals | Proposed extension, `NOT_BUILT` |
| `stellar-evidence-pack` | Export a redacted, replayable decision + evidence bundle | Offline export exists; Stellar-specific pack `PLAN_ONLY` |

## 6. Phased development and definition of done

| Phase | Deliverable | Exit criterion | Status |
|---|---|---|---|
| P0 | Study Stellar MCP, Raven, Agent Skills, x402 and RPC docs; record boundaries and differentiators | This blueprint reviewed by owner | `RESEARCH` |
| P1 | Design `stellar-agent-gate` API, refusal taxonomy and evidence schema | Spec + adversarial test vectors committed, no live claim | `NOT_BUILT` |
| P2 | Build a deterministic Stellar payment adapter over caller-supplied evidence | Offline tests cover amount/asset/recipient/network/replay drift | `NOT_BUILT` |
| P3 | Bind authorization to exact XDR/envelope bytes or to a named evidence digest | Tamper, omission, substitution and replay cases fail closed by name | `NOT_BUILT` |
| P4 | Expose the gate through MCP with full input/output schemas | 94-tool surface grows only after tests and generated docs are regenerated | `NOT_BUILT` |
| P5 | Documented Testnet run with owner-held keys and a real RPC endpoint | Receipt, transaction hash, replay command and named boundaries recorded; still not production | `NOT_BUILT` |
| P6 | Production pilot | Signed owner decision, named integrator, credentials, trust roots, SLA discussion and evidence; never assumed here | `OWNER-GATED` |

## 7. Open owner decisions

1. **Authority model** — does CoreGuard only gate and verify, or is any signing/broadcast surface ever in scope? Recommended default: gate and verify only.
2. **Stellar data source** — Stellar RPC vs Horizon (documented as nearing end-of-life) vs caller-supplied evidence only.
3. **Agent integration route** — direct MCP server, CoreGuard skill, or both. no signed-in client claim until a real run is recorded.
4. **Flow scope** — classic payment, path payment, Soroban invocation, x402 paywall, or smart-account/session-key policy.
5. **Trust roots** — who owns keys, credentials, RPC endpoint, rate limits and incident response.
6. **Commercial shape** — small paid pilot/design-partner path only after readiness; no IP assignment, default exclusivity, SLA or production guarantee before an explicit decision.

## 8. Claim discipline

| Allowed now | Not allowed now |
|---|---|
| "Stellar's new portal points developer tooling toward agents, MCP, skills and x402." | "CoreGuard is integrated with Stellar's MCP/Raven stack." |
| "CoreGuard has offline, deterministic Stellar evidence tools." | "CoreGuard called Stellar RPC / Mainnet / Testnet." |
| "A blueprint and adversarial design exist." | "Production ready", "audited", "compliant", "settlement final", "verified safe". |
| "Testnet validation is a planned, owner-gated step." | Any customer, pilot, sponsor, funding, endorsement or adoption claim. |

## 9. References

- Stellar Developers: https://developers.stellar.org
- Stellar Developer Docs: https://developers.stellar.org/docs
- Build with AI on Stellar: https://developers.stellar.org/docs/build/building-with-ai
- CoreGuard release notes: `docs/releases/0.4.0.md`
- CoreGuard status truth table: `docs/STATUS.md`
- Existing Stellar integration guide: `docs/STELLAR-INTEGRATION-GUIDE.md`
- Production roadmap: `docs/PRODUCTION-ROADMAP.md`
- Adoption/ladder honesty boundary: `docs/live-integration-and-adoption-ladder-2026-09-25.md`

No part of this blueprint changes the published `0.4.0` artifact or claims that any proposed module exists.

## 10. Addendum — 2026-11-26

The owner subsequently authorized implementation of the P1–P4 technical roadmap. `docs/COREGUARD-STELLAR-AGENT-SECURITY-SPEC-v0.2.md` is the current contract: five deterministic, offline CG-SG/1 MCP tools (99-tool surface in an unpublished `0.5.0` preparation), 39 named adversarial tests, and a manual P5 proof script were prepared. P5 now has a recorded `SYNTHETIC` Testnet proof with ephemeral agent-generated keys (`docs/STELLAR-TESTNET-PROOF-2026-11-26.md`), not an owner-held-key or production run; P6 remains `NOT_BUILT / OWNER-GATED`. The published npm/MCP Registry artifact remains `0.4.0` until a separate gated release succeeds. No claim of adoption, live integration, signing authority, funding, partnership or signed-in client `RUN-BY-HAND` is made by this addendum.
