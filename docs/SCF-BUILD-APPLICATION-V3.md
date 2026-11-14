# SCF Build Award — Application v3 (Execution Trust Layer)

Supersedes `SCF-BUILD-APPLICATION.md` and `-V2.md`. The change is not cosmetic:
v1/v2 pitched a catalogue of protocols; v3 pitches **one layer, four
guarantees, one buyer**, and prices the work that makes each guarantee
checkable by a stranger.

## 1 · The choice behind the narrative

The founder's question was whether CoreGuard should be (a) an independent
global Web3-security company that uses Stellar, or (b) the execution-trust layer
inside Stellar. **This application argues (b) is the primary story and (a) is
the outcome, not the pitch** — because a fund evaluates what it can make true in
Stellar's favour, and a focused layer is a thing Stellar can adopt, audit and
point at. A generic global security company is a thing Stellar can only fund and
hope. If the layer wins inside Stellar, the company follows; the reverse does
not happen.

## 2 · What exists today (measured, not asserted)

| Claim | Evidence in the repository | Status |
|---|---|---|
| Pre-sign authorization bound to exact transaction bytes | `packages/stellar/presign.mjs` + 37 tests | BUILT · TEST_EXECUTED |
| Field-by-field tamper refusal on the signed envelope | `test/integrations/agent-gate-field-tamper.test.mjs` | BUILT · TEST_EXECUTED |
| Deterministic replay across runtimes (pinned clock + vectors) | `test/integrations/agent-gate-replay-determinism.test.mjs`, `test/fixtures/agent-gate/canonical-vectors.json` | BUILT · TEST_EXECUTED (Node 22 + 24 in CI) |
| Contract-level invariants (evidence registry, fees, write-once) | `test/contract/EvidenceRegistryV3.invariant.t.sol` — 5 invariants, 8 fuzz properties, 43 Foundry tests | BUILT · CI-MEASURED |
| Anchor immutability across ledger sequences | `soroban/commitment-anchor/src/lib.rs` — 17 Rust tests incl. 4 sequence properties | SOURCE ONLY — not deployed |
| Offline third-party verification | `packages/independent-verifier/` (JS · Rust · WASM · C/Python three-way parity) | BUILT · TEST_EXECUTED |
| Four-pillar demo in one command | `examples/execution-trust/` (`npm run trust:demo`) | BUILT · TEST_EXECUTED |

**Baseline that will not be hidden in the budget section:** zero external
adopters, zero signed pilots, zero revenue, no third-party security audit, and
no real Freighter extension signature recorded. The funding exists to move
those four sentences, not to add features.

## 3 · Milestones, with acceptance criteria that point at artifacts

**M1 — Integration in 15 minutes (month 1)**
SDK v1 published; quickstart with a measured time-to-first-pass; API reference;
error-code catalogue generated from the frozen list.
*Accepted when:* a developer with no prior context can go from `npm install` to
a `PASS`/`BLOCK` verdict inside 15 minutes, and the quickstart's own transcript
is committed as evidence.

**M2 — The authorized lane, deployed and proven (month 2)**
Soroban `commit_authorized` deployed to testnet from CI-produced wasm; anchor
TTL/archival policy implemented and tested; read-back artifact recorded; a
foreign-key negative control at a later ledger refused by name.
*Accepted when:* an artifact in `docs/evidence/` shows the deploy tx, the
owner-authorized commit, the read-back, and the refusal — reproducible by a
reviewer from committed bytes.

**M3 — Two pilots, scoped at two weeks each (month 3)**
One DEX/wallet integration and one AI-agent payments team; written scope,
success criteria, and a published pilot report each (numbers included, failures
included).
*Accepted when:* two external teams have run CoreGuard against their own flow,
with at least one paid engagement or signed letter of intent.

**M4 — Institutional readiness (month 4)**
Independent security review closed with findings and fixes; enterprise policy
pack (multi-approval, spend limits, audit export); SLA, pricing page, and
support boundary published; one verifier run by a third party against a
CoreGuard artifact.
*Accepted when:* the review report and its remediation are committed, and a
non-CoreGuard operator has verified a receipt using only public artifacts.

## 4 · Budget — 150,000 USD over 4 months (XLM-equivalent, milestone-gated)

| Line | Amount | What it buys |
|---|---|---|
| Engineering (2 contractors: Soroban + SDK/DX) | 84,000 | M1–M2 delivery and the pilot integrations in M3 |
| Independent security review (signed envelope + contracts) | 18,000 | The one gap tests cannot close |
| Contract audit retainer (Soroban + EVM increment) | 12,000 | Fixes after review, second-pass verification |
| Pilot integration support and incentives | 12,000 | Two two-week scopes; removes the "no budget to try" objection |
| Infrastructure (RPC, CI minutes, artifact hosting) | 6,000 | Testnet/mainnet operations and reproducible builds |
| Legal, licensing, data-handling terms | 6,000 | Enterprise pilots need paper before code |
| Documentation and DX (reference site, examples, video) | 6,000 | Time-to-first-pass is a deliverable, not a hope |
| Contingency (≤5%) | 6,000 | Held, released only against a named risk |

Every line maps to a milestone; nothing is requested for features that do not
serve M1–M4. Asking for the maximum is not the plan — asking for what the
artifacts above cost is.

## 5 · Go-to-market for the first partners

1. **Warm technical entry, not cold sales:** the Freighter #3087 evaluation
   comment is on record; the next step is a scoped 2-week trial, not a pitch
   deck.
2. **Two named segments:** DEX/AMM teams (swap-condition enforcement with
   evidence) and AI-agent payment teams (authorization + refusal + audit).
3. **The artifact is the sales asset:** send a receipt they can verify with
   `npm run trust:verify`, not a brochure. If their engineer cannot verify it,
   the deal is not real.
4. **Pricing that a pilot can sign:** usage-based per verified receipt with a
   free tier sized for an integration test — see `docs/pricing.md` for the
   model and this document's M4 for the enterprise pack.

## 6 · KPIs the committee can check later

| KPI | Target by M4 | How it is measured |
|---|---|---|
| Time-to-first-pass | ≤ 15 min | the quickstart's own committed transcript |
| External integrations | ≥ 2 | pilot reports with team names and scopes |
| Verified receipts in pilot | ≥ 1,000 | counts from pilot deployments |
| Independent verifications by outsiders | ≥ 3 | verifier CLI runs recorded by the pilots |
| Unverifiable public claims | 0 | `docs/claims-registry.json` audit in CI |

## 7 · Risks, and what we do about each

| Risk | Mitigation |
|---|---|
| No partner signs | pilots are scoped at two weeks and partly funded; the ask is a trial, not a commitment |
| Incumbent adds portable artifacts | ship Soroban depth first; integrate their verdicts as policy inputs rather than competing on detection |
| Security review finds a flaw | budgeted retainer and a fix window inside M4; findings published either way |
| Solo-founder capacity | two contractors named in the budget, with the founder on architecture and review |
| Over-claiming under pressure | the claims registry and evidence matrix fail CI on an unsupported claim — the discipline is enforced by code, not intent |

## 8 · What this application will not claim

No revenue, no customers, no partnerships, no audit, no wallet integration, no
mainnet deployment of the authorized lane. The repository states this in
`docs/EVIDENCE-MATRIX.md` and CI fails if a document contradicts the measured
snapshot.
