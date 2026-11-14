# 90-day roadmap — from "verifiable execution" to "adopted by one external project"

**Start:** 2026-11-10 · **End:** 2027-02-08 · **Owner:** founder, single-threaded
**Success measure:** `integration: ADOPTED` for `agent-gate` on at least one
named external Stellar project, or a published finding explaining why not.

This plan answers the reviewer's priority table directly. P0 items are closed in
the repository already (status unification, focus, envelope conformance); what
remains is the work that cannot be done alone in a repo: a signer path, an
audit, a pilot, and measured numbers.

---

## Priority mapping

| Reviewer priority | Where it lands here |
|---|---|
| P0 unify Stellar status between code and docs | **done** — `docs/STELLAR-STATUS-UNIFICATION.md`, `test/ci/surface-status.test.mjs` |
| P0 build an integrated, safe execution path | Phase 1 (signer path) — envelope conformance is already built |
| P1 clear, easy-to-integrate SDK | Phase 1, week 4 |
| P1 pilot with an external Stellar project | Phase 2, starts week 3 (search), signed by week 8 |
| P1 independent security audit | Phase 2, weeks 6–9 |
| P2 commercial docs and enterprise support plan | Phase 3, weeks 10–12 |
| P2 partnerships and real adoption | Phase 3 and beyond — cannot be scheduled, only pursued |

---

## Phase 1 — days 1–30: the gate becomes signable

**Goal:** the wallet signs, the gate never sees a key, and the demo runs in a
browser a reviewer can open.

| Week | Work | Done when |
|---|---|---|
| 1 | Freighter adapter: request signature for a built envelope, return signed XDR, never touch a secret | adapter signs a testnet payment in a browser session |
| 2 | Envelope conformance on the SIGNED envelope: decode operations from the XDR, compare to the authorized intent, refuse drift and extra ops | a decoded testnet envelope with a second payment is refused as `MULTI_OP_DIVERGENCE` |
| 3 | Public demo page: proposal, mandate, ALLOW, wallet sign, receipt | demo URL exists; ALLOW and MISMATCH both reproducible by a stranger |
| 4 | SDK surface: `@coreguard/agent-gate` with `evaluate`, `conform`, `issueReceipt`, `verifyReceipt`; integration guide | an outside developer integrates from the doc alone |

**Deliverables a reviewer runs:** the demo URL (local runnable demo), the SDK example, the drill
outputs (rejected signature, wrong network, expired mandate, tampered receipt).

**Progress (measured 2026-11-10 → 2026-11-12, committed):**
- **Built/tested:** envelope builder/decoder (`AGENT-XDR/1`), Freighter adapter contract (swapped-bytes refusal), verifier CLI (0/2/3/4), signed-envelope conformance and field-level binding of the authorized intent to signed bytes, in-process bench artifact (`docs/evidence/agent-gate-bench.json`).
- **Executed/testnet evidence:** a real testnet signature carried through the signed-envelope lane (`docs/evidence/agent-gate-testnet-signature.json`, see `docs/AGENT-PAYMENT-GATE.md` for the honest signer/ceiling).
- **Runnable demo:** browser demo for a judge (`examples/agent-gate-browser/`, `test/integrations/agent-gate-browser-demo.test.mjs`); ALLOW/MISMATCH reproducible locally.
- **Freighter extension path:** attestation/promotion path exists (`scripts/agent-gate-freighter-attest.mjs`) and writes extension evidence only after a server-verified Ed25519 signature by the declared wallet key; `docs/surface-status.json` still records `agent-gate-freighter` as `code: BUILT_UNVERIFIED` / `execution: TEST_EXECUTED` / `integration: NOT_BUILT` (no real extension signed in CI).
- **Parallel Stellar/Freighter surface (PSAR/1, 2026-11-12):** pre-sign authorization receipts (`packages/stellar/presign.mjs`, `npm run stellar:presign`, `test/integrations/stellar-presign.test.mjs`), proposal + security self-review + 90s demo video, and a scoped technical-evaluation comment **posted** on `stellar/freighter#3087` and recorded (no endorsement/merge/adoption). `surface-status`: `stellar-presign-receipt` BUILT · TEST_EXECUTED · NOT_BUILT.

**Still open:** a real Freighter **extension** signing in a browser session (and a promoted, committed extension-signature artifact), SDK packaging/publication path, an external pilot, and an independent audit. All integration remains `NOT_BUILT` until a named external project runs it with committed evidence.

**Explicit non-goals:** no mainnet funds, no new chain, no new standard, no new
product line.

## Phase 2 — days 31–60: independence and a pilot in motion

**Goal:** someone outside the project runs the gate, and someone outside the
project attacks it.

| Week | Work | Done when |
|---|---|---|
| 5 | Pilot outreach: 12 named targets (Stellar wallets, Soroban DeFi, payment platforms) with a one-page integration offer | every contact and reply recorded in a truth ledger |
| 6 | Independent verifier packaged for third parties (`npx coreguard-verify`) | verification works from a clean machine with no repo checkout |
| 7 | Adversarial harness published: tamper, replay, forged decision, chain break, batched divergence | harness reproducible, expected outputs committed |
| 8 | First pilot integration started (or the first refusal recorded) | a named project's engineer has the gate in their flow |
| 8–9 | Independent security review engaged; scope: gate, receipts, Soroban contract | reviewer engaged in writing, findings timeline agreed |

**Exit criteria:** a named external engineer has run the gate; a reviewer's
findings exist or are contractually in progress; `integration` becomes `PILOT`
only when the pilot record is committed — never when outreach is sent.

## Phase 3 — days 61–90: measure, publish, decide

| Week | Work | Done when |
|---|---|---|
| 10 | Performance: p50/p95 gate latency, cost per verification, throughput under load | numbers published with the machine spec and harness |
| 10 | Audit findings published in full, each fixed or explicitly open | finding-by-finding resolution table |
| 11 | Commercial documents: pricing hypothesis (still gated), enterprise controls (approvals, spend limits, audit export) | documents exist; nothing is billed |
| 12 | Pilot case study, honest about what failed | published with the pilot partner's confirmation |
| 12 | Decision point | either `integration: ADOPTED` with evidence, or a published finding |

**Decision rule at day 90 (pre-committed):** if no pilot is running, do not
extend the timeline quietly. Publish what was tried, who declined and why, and
choose one of: (a) change the integration target, (b) change the product
surface, (c) stop. The repo's own claim rules require the finding to be visible.

---

## What can be measured every week (no vanity metrics)

| Metric | Source | Today (2026-11-12) |
|---|---|---|
| External projects running the gate | pilot records | 0 |
| Signed envelopes refused for drift (live extension path) | gate receipts | 0 (no real Freighter extension signer in CI; local/testnet evidence exists, not adoption) |
| Gate latency p50/p95 | performance harness | **in-process measured** (committed `docs/evidence/agent-gate-bench.json`, machine/conditions recorded) — **not** deployed latency, not chain confirmation, not throughput |
| Cost per verification | harness + RPC fees | not measured as deployed/RPC cost |
| Audit findings open/closed | review record | not started (self-review committed for PSAR/1; third-party audit not performed) |
| Claims without evidence | `npm run claims:audit` | 0 violations (per committed registry) |
| Suite total vs snapshot | `npm run test` drift guard | in sync (1578/1578, snapshot-enforced) |

Stars, followers, impressions and "interest expressed" are deliberately absent:
none of them is adoption.

## Risks and the response

| Risk | Response |
|---|---|
| Freighter integration takes longer than a week | keep the gate wallet-agnostic; ship a signing-adapter interface with a mock signer for the demo, and say so |
| No pilot partner says yes | widen to wallets that already expose agent permissions; publish the refusals |
| Audit finds a design flaw in the receipt format | that is the highest-value outcome of Phase 2; version the receipt (`AGENT-RECEIPT/2`) rather than weaken the finding |
| Reviewer asks for enterprise features first | refuse: the pilot is the gate to everything else |
| Funding round unavailable (SCF #46 closed) | the roadmap is not funding-dependent until Tranche 2; the audit is the only line that needs money |

## What does not happen in these 90 days

No new chains, no new standards beyond the gate pair, no Pi/Core DAO expansion,
no token, no pricing published, no partnership announcements, no claim of
production readiness or independent audit before the reviewer signs.
