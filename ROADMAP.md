<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/coreguard-banner-dark.png">
  <img src="brand/coreguard-banner-dark.png" alt="CoreGuard" width="92%">
</picture>

# CoreGuard Roadmap

### From verified execution to the trust layer every Stellar agent runs on.

<sub><b>VERIFY</b> &nbsp;•&nbsp; <b>PROTECT</b> &nbsp;•&nbsp; <b>EMPOWER</b></sub>

[**Website**](https://coreguard-trust-and-defense.lovable.app/) · [**Stellar**](https://coreguard-trust-and-defense.lovable.app/stellar) · [**Investors**](https://coreguard-trust-and-defense.lovable.app/investors) · [**README**](README.md) · [**Live status**](docs/STATUS.md)

</div>

---

| ✅ Shipped & evidenced | 🟠 Built · offline / DRY_RUN | ⏳ Planned | 🔒 Owner-gated |
|:--:|:--:|:--:|:--:|

> Requested funding is **not** awarded funding. No signed commercial pilot yet — one **independent external technical reproduction** is public ([ACP #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328)). `VERIFIED ≠ SAFE`.

---

## 🟢 Independent external trial — reproduced by a stranger's machine

> **19 Nov 2026 · public record:** [ACP discussion #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328)

The **Zambo / AER-1 team** — authors of an independent agent-execution-receipt standard — cloned CoreGuard fresh at commit `5a1f3bd`, counted the CI checks themselves, and ran the VAR/1 pilot kit with one command. The seeded receipt then re-derived **byte-for-byte on three machines** across two Node runtimes.

| Signal | Result | Source |
|---|:--:|---|
| Pilot-kit rows on a fresh clone, run twice | **15 / 15 · exit 0** | [external report](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328#discussioncomment-19722647) |
| CI check runs counted externally on the commit | **12 / 12** | same report |
| Seeded receipt identical on 3 machines (node v24 · v26) | **byte-identical** | [seeded run](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328#discussioncomment-19750155) · [third machine](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328#discussioncomment-19752157) |
| `present-consistent-nonconforming` fixture tests re-run externally | **6 / 6** | third-machine check |
| AER-1 × VAR/1 outcome mapping agreed in public | **5 outcomes mapped** | [mapping note](https://github.com/coreguard-global/CoreGuard/blob/main/docs/aer1-var1-outcome-mapping.md) |

```text
$ node examples/var1-pilot-kit/run.mjs --seed e8cfcd1a93ce50d6d6ace046db9c878ba8e63d3873acc821c9c6d0742cd848cb --at 2026-11-19T14:00:00Z
receipt  urn:sha256:8c6c12bad40471d2c83d8f6ee2a0c07c8649045aa2e96726a4ee31bec13a72c7
body     sha256:386d218c154ae444c878b1b4ee32daf3f5b32f8bd9de363aa854c89f099334b1
```

**What came out of it — shipped Nov 15–19:** `VAR/1` one-command pilot kit · `CG-OUT/1` outcome layer (five outcomes; `ABSENT` / `NOT_CHECKED` never travel as a block) · `CG-ID/1` record identity split · AER-1 parser + full 72-file corpus run · `CG-ANCHOR/1` own anchor service + `CG-COMPOSE/1` composition policy · Agent Commerce discovery, key trust, spend ledger and payment policy · two-column corpus vectors (`present-consistent-nonconforming`, `anchor-unresolvable`).

> **Scope, stated plainly:** this is an independent *technical reproduction* of our open kit by another standards team. It is **not** a commercial pilot, customer, partnership, audit or endorsement. `VERIFIED ≠ SAFE`.

**Founder:** [EslaM HeshAM (MR-X)](https://coreguard-trust-and-defense.lovable.app/founder) · Website: [coreguard-trust-and-defense.lovable.app](https://coreguard-trust-and-defense.lovable.app)

---

## 1 · Where we stand — 17 Nov 2026

| Area | Milestone | Status |
|---|---|:--:|
| **Core DAO** | EvidenceRegistry anchor on Mainnet + verified agent execution · 43/43 Foundry proofs | ✅ |
| **Stellar** | SOROBAN/1 commitment anchor on Mainnet + first `commit()` call (ledger 65,337,373) | ✅ |
| **Stellar** | First signed funded swap gated by DEX-GATE/1 — **ledger 65,338,112** | ✅ |
| **Stellar** | PSAR/1 pre-sign authorization receipts · Freighter technical comment posted | 🟠 wallet integration not built |
| **Agent Commerce** | Phase 2: AC-FW/1 · CGCR/1 · AGR/1 · AC-CS/1 — 1841/1841 tests on `main` | 🟠 synthetic fixtures |
| **Stellar** | CGXA-SOROBAN/1 consent binding · ESCROW/1 bounty escrow · TRINITY/1 cross-network model | 🟠 no broadcast |
| **Pi Network** | Execution-truth plan | 🟠 DRY_RUN / PLAN_ONLY |

---

## 2 · The funded path — SCF #46, $150,000 requested

```text
 Month 1            Month 2              Month 3                 Month 4
 ───────────        ─────────────        ──────────────          ──────────────
 M1  SDK v1    ──▶  M2  Authorized  ──▶  M3  Two external   ──▶  M4  Institutional
     15-min         lane deployed        pilots + report         readiness
     quickstart     from CI wasm         (failures included)     SLA · pricing
 ───────────        ──────────────────────────────────────       ──────────────
   T1 · $40K                    T2 · $55K                          T3 · $55K
```

| Milestone | Deliverable | Accepted when | Tranche |
|---|---|---|:--:|
| **M1** · Month 1 | SDK v1, measured quickstart, API reference, error-code catalogue | A new developer reaches PASS/BLOCK in ≤ 15 min; transcript committed | **T1 · $40K** |
| **M2** · Month 2 | Soroban `commit_authorized` on testnet from CI wasm; TTL/archival policy | Artifacts show deploy, authorized commit, read-back, named foreign-key refusal | **T2 · $55K** |
| **M3** · Month 3 | One DEX/wallet pilot + one AI-agent payments pilot | Two external teams run their own flows; ≥ 1 paid engagement or signed LOI | **T2** |
| **M4** · Month 4 | Close independent review; enterprise policies, SLA, pricing | Outside operator verifies a receipt from public artifacts only | **T3 · $55K** |

**Use of funds:** engineering $84K · security review $18K · audit retainer $12K · pilot support $12K · infrastructure $6K · legal $6K · docs & DX $6K · contingency $6K — [official budget](docs/SCF-BUILD-APPLICATION-V3.md).

---

## 3 · Next 90 days

| # | Action | Gate | Status |
|:--:|---|---|:--:|
| 1 | Run the [Agent Commerce pilot plan](docs/AGENT-COMMERCE-PILOT-PLAN-2026-11-16.md) with a design partner | Partner needed | ⏳ |
| 2 | Deploy the authorized-lane Soroban instance (Issue #24) | Owner decision | 🔒 |
| 3 | Publish `@coreguard/stellar` to npm | Release credentials + approval | 🔒 |
| 4 | Freighter PSAR/1 proposal review · fail-closed receipt SEP draft (#56) | Stellar maintainers | ⏳ |
| 5 | Engage an external auditor using the drafted scope | Funding | ⏳ |

---

## 4 · Two-week pilot — what a partner gets

| Days | Step | Owner |
|:--:|---|---|
| 1–2 | Choose one flow; capture the exact unsigned envelope and policy fields | Joint |
| 3–5 | Wire `issueAuthorizationReceipt` / `verifyAuthorizationReceipt` behind a flag | Partner · CoreGuard reviews |
| 6–8 | Run real and adversarial cases: amount, destination, expiry, network, replay | Joint |
| 9–10 | Evidence bundle verified outside this repository; report includes failures | CoreGuard |
| 11–14 | Read-out and go / no-go decision | Joint |

Full kit: [docs/PILOT-KIT.md](docs/PILOT-KIT.md)

---

## 5 · Detailed plans

[90-day roadmap](docs/ROADMAP-90-DAYS-2026-11.md) · [4-month plan](docs/ROADMAP-4MONTH.md) · [Production roadmap](docs/PRODUCTION-ROADMAP.md) · [Funding roadmap](docs/funding-roadmap-2026.md) · [Live status](docs/STATUS.md)

---

<div align="center">

| [Fund CoreGuard →](https://coreguard-trust-and-defense.lovable.app/funding) | [Propose a partnership →](https://coreguard-trust-and-defense.lovable.app/partnerships) | [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com) |
|:--:|:--:|:--:|

<img src="brand/coreguard-shield.png" width="72" alt="CoreGuard shield"><br>
<sub><b>More than security. It's trust.</b></sub>

</div>
