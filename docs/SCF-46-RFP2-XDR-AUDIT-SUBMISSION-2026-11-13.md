# SCF #46 RFP Track — RFP-2 Submission Instrument (2026-11-13)

**RFP addressed:** XDR/CAP-Coverage Audit Tool and Indexer-Hardening Guide (SCF #46, RFP Track).
**Deadline:** 2026-11-20, 9 AM PT. **Prepared:** 2026-11-13 as a dated instrument.
**Possession rule (binding, `docs/ceo-decisions-2026-11-11.md` Decision 3):** the interest form and every external submission are sent by the OWNER per step — this file is a paste source, never an automatic sender. Owner fill-slots are marked `[OWNER: …]`; nothing is fabricated where an owner-held fact is required (entity/KYC data, referral code).

**Positioning decided by the owner (2026-11-13):** CoreGuard's long-term shape is an independent global company in Web3 Security and AI-agent financial infrastructure built on Stellar as core infrastructure; the NOW play — and the lane this RFP funds — is CoreGuard as a security-and-trust layer inside the Stellar ecosystem itself. This proposal is written from the second posture: shared ecosystem tooling first, built in the open, liberally licensed, maintained past delivery.

---

## Part A — Interest-form answers (paste-ready)

**1. Project name**
CoreGuard — verification-first security rails for agentic transactions, and (for this RFP) the team behind a shared XDR/CAP coverage audit kit for everything that reads the Stellar ledger.

*AR: CoreGuard — قضبان تحقق أمنية للمعاملات الوكيلية، وفريق أدوات تدقيق تغطية XDR/CAP لكل ما يقرأ سجل ستيلار.*

**2. Which open RFP are you addressing**
RFP 2 — XDR/CAP-Coverage Audit Tool and Indexer-Hardening Guide. Directly, as scoped; limits we take are named in Part B (we propose to deliver every listed deliverable, with the ingestion-pipeline findings work scoped to one SDF pipeline first, as the RFP invites).

**3. Project summary**
CoreGuard already ships byte-level XDR verification discipline in production-shaped code: pre-sign authorization receipts bound to the exact transaction XDR bytes before any signature exists (sha256 over the literal XDR string, Ed25519 against a pinned issuer key, fail-closed with 11 frozen reject codes, `executionProof: NOT_INCLUDED` on every verdict), a signed-envelope lane whose authorized intent is bound to envelope bytes field by field, and cross-language known-answer vectors executed in CI. For this RFP we build the missing shared kit: a per-CAP corpus of rare-but-valid ledger shapes with expected decoded values, a replay harness, an SDK conformance runner (JS/Go/Rust), a source linter for the three ingestion mistakes, and the indexer-hardening guide — so one team's fix becomes every SDK's regression test.

*AR: نبني الحزمة المشتركة المفقودة: corpus لكل CAP مع القيم المتوقعة، ومحاكي إعادة تشغيل، وعدّاء مطابقة للـ SDKs، وأداة lint للثلاث أخطاء، ودليل تحصين الفهرسات — بحيث يصبح إصلاح فريق واحد اختبار انحدار لكل الـ SDKs.*

**4. Links**
- GitHub: https://github.com/coreguard-global/CoreGuard
- Pages: https://coreguard-global.github.io/CoreGuard/
- Release v1.2.0 (published 2026-11-13, CI-green): https://github.com/coreguard-global/CoreGuard/releases/tag/v1.2.0
- X/Twitter: https://x.com/CoreGuardGlobal · LinkedIn: https://www.linkedin.com/company/coreguard-global

**5. Referral code**
`[OWNER: unique referral code, if any]`

**6. Contact / entity data (required by the form, held by the owner only)**
`[OWNER: legal name, contact email, award wallet, beneficial-owner facts — never fabricated by the repo]`

**7. Anything else**
Standing claims discipline (binding): every number in our forms is machine-measured, reproducible from a fresh clone, and CI-enforced; funding is stated as $0 until an award actually lands, and "submitted" is the only fact we publish today. Nothing beyond verification is ever promised.

*AR: القاعدة الملزمة: كل عدد مقاس ويعاد إنتاجه من استنساخ نظيف؛ التمويل 0$ حتى يُمنح فعلاً؛ "مُقدَّم" هي الحقيقة الوحيدة القابلة للنشر اليوم.*

---

## Part B — Technical proposal annex (for the Build-round form)

### B.1 Why we are a good fit (with evidence, not adjectives)

- **Byte-level XDR discipline is already shipped and CI-measured.** PSAR/1 binds an authorization decision to the EXACT transaction XDR bytes before any signature exists; AGENT-XDR/1 binds authorized intent to signed-envelope bytes field by field; a real testnet signature has been carried through the lane with committed evidence. Suite: 1576/1576 tests, machine-pinned against `docs/state-snapshot.json` and enforced on every push by `scripts/run-tests.mjs`.
- **Cross-language truth is our standing working method.** The Soroban commitment-anchor crate carries a JS mirror plus a cross-language known-answer vector; the Rust leg runs in CI (17/17 in the anchor crate). "Two independent implementations must agree on bytes" is not a slogan here — it is an enforced contract.
- **Fail-closed is our default posture, with negative controls to prove it.** A verifier error is itself a BLOCK, never a pass; the repo maintains mutation batteries where every guard must be observed to bite. `VERIFIED ≠ SAFE` is a standing label, and our own docs say so.
- **We reproduced one of the RFP's own sighting classes before submitting** (the reviewability gate): the #1766 ordering-divergence class — two valid Ed25519 issuers whose strkey-string order is the OPPOSITE of their XDR-byte order — reproduced offline and committed as evidence with four byte-round-trip-verified sample corpus entries, including a CAP-0040 signed-payload signer and a CAP-0027 muxed account with its SEP-0023 M-strkey. See B.5 for the artifact.
- **Honest familiarity statement.** XDR: deep, byte-level (above). CAPs: as consumers — CAP-0027 (muxed), CAP-0040 (signed payload), CAP-0073 (SAC-created trustlines) classes are named and carried in our sample corpus. Ingestion pipelines: Horizon as a raw wire consumer (arithmetic-identity verification of `fee_charged` to the stroop on executed mainnet swaps), not yet as an indexer author; LedgerCloseMeta: understood via the RFP's own citations (`--check-lcm` golden mode), with hands-on capture as milestone M0's first deliverable. We state exactly what we know and how we close the gap — the same discipline we apply everywhere else.

### B.2 What we build (each RFP deliverable, with its acceptance check quoted)

- **Corpus + generator** — one entry per rare pattern, tagged with the introducing CAP and protocol version; captured from testnet/mainnet history or a local stellar-core, with hand-crafted entries marked `synthetic` in the manifest; reproducible generation for both network passphrases; every entry carries its expected decoded values, so an SDK must both decode it and re-encode it byte-exactly. *RFP check adopted as our acceptance test: entries round-trip through rs-stellar-xdr and agree with `--check-lcm` goldens.*
- **Replay harness** — a documented adapter interface; per-entry pass / mishandled / dropped report; delivered through the **Galexie data lake layout first** (offline, file-based, diffable — matching the RFP's offline/CI-first non-functionals), with the mock RPC `getLedgers` adapter second. *RFP check: a reference adapter reproduces wallet-backend#729, #731 and #716 on pre-fix commits and passes on the fixed ones.*
- **Conformance runner** — replays the same corpus through the **JavaScript, Go and Rust** SDKs in CI on every pull request; reports every entry where an SDK diverges from the network or from the other SDKs; files a sibling issue in each affected SDK when a defect is found in one. *RFP check: reproduces js-stellar-sdk#1766, #1785 and #1789 on pre-fix tags.*
- **Linter** — scoped to **Go** first (the language of wallet-backend, the pipeline with the most sightings), flagging exactly the three ingestion mistakes: trusting unvalidated fields, missing depth/size caps on recursive structures (authorization trees, nested ScVals), and deriving participants from the envelope instead of the meta. *RFP check: flags seeded violations; runs clean on current wallet-backend.*
- **Indexer-hardening guide** — fixed outline: the field-by-field validated/unvalidated table, recommended depth and size caps, the participants-from-meta rule, correct muxed and signed-payload handling including the SEP-0023 strkey forms, and the checklist that mirrors the linter's rules for other languages. *RFP check: the field-by-field table agrees with the corpus manifest; publication gated on review by a core or platform engineer.*
- **Findings** — the corpus run against **wallet-backend** first (Go, most-sighted), each failure triaged (severity, affected CAP, minimal reproducing entry) and filed upstream. *RFP check: every failure maps to a filed issue. The findings are the deliverable, not the run.*

### B.3 Architecture (plain English + diagram)

The corpus is DATA (XDR files + a language-neutral manifest any pipeline can read). The generator captures or synthesizes entries and pins expected decoded values. The replay harness feeds any indexer through an adapter and classifies what breaks. The conformance runner drives the same corpus through SDK decoders/encoders. Reports are CI artifacts; findings become filed issues; the guide is the human-readable synthesis, gated on a core/platform review before publication.

Stack: TypeScript/Node for harness and runner orchestration; Rust (rs-stellar-xdr) for generation goldens and round-trip authority; Go for the wallet-backend adapter and the AST-based linter; GitHub Actions CI; no servers, no keys, no funds; everything offline.

    flowchart LR
      subgraph GEN[Generator]
        H[testnet/mainnet history] --> M[manifest v1]
        SC[local stellar-core --check-lcm goldens] --> M
        SYN[synthetic hand-crafted, marked] --> M
      end
      M -->|XDR + expected values| HARNESS[Replay harness]
      M -->|same corpus| CONF[Conformance runner]
      HARNESS -->|Galexie layout adapter| WB[wallet-backend]
      HARNESS -->|adapter #2| ETL[stellar-etl]
      HARNESS -->|per-entry verdicts| R1[pass / mishandled / dropped]
      CONF --> JS[js-stellar-sdk]
      CONF --> GO[go-stellar-sdk]
      CONF --> RS[rs-stellar-sdk]
      CONF --> R2[divergence matrix + sibling issues]
      R1 --> F[findings reports, filed upstream]
      R2 --> F
      F --> G[hardening guide, review-gated]
      LINT[Go linter: 3 rules] --> G

### B.4 Testable milestones (each with the RFP's own check as its acceptance)

- **M0 — Corpus bootstrap (weeks 1–2).** Capture pipeline (Galexie layout + `--check-lcm` goldens), manifest schema v1 finalized, ≥40 entries across the muxed/signed-payload/SAC-trustline/ordering/max-length/nested-authorization classes. *Accept: entries round-trip through rs-stellar-xdr; agreement with `--check-lcm` goldens.*
- **M1 — Harness + first findings (weeks 3–6).** Reference adapter (Galexie layout), per-entry verdict report, corpus run against wallet-backend with triage and upstream filings. *Accept: wallet-backend#729, #731, #716 reproduced on pre-fix commits, pass on fixed ones; every failure maps to a filed issue.*
- **M2 — Conformance runner (weeks 5–8, parallel).** JS/Go/Rust in CI, divergence matrix, sibling issues per affected SDK. *Accept: js-stellar-sdk#1766, #1785, #1789 reproduced on pre-fix tags.*
- **M3 — Linter (weeks 7–10).** Go linter, three rules, seeded-violation battery (the repo's mutation-control discipline applied to the linter itself). *Accept: flags seeded violations; runs clean on current wallet-backend.*
- **M4 — Guide (weeks 9–12).** Field-by-field table, caps, participants-from-meta, muxed + signed-payload handling, checklist. *Accept: table agrees with the manifest; review by a core or platform engineer; publication on developers.stellar.org.*
- **M5 — Handover-ready maintenance (weeks 11–14 + ongoing).** Corpus growth process for new CAPs, runbook for a second maintainer, the first-protocol-upgrade plan. *Accept: a second engineer can extend the corpus and run every deliverable from the repo alone.*

Tranche rhythm follows the SCF rules (each subsequent tranche within 90 days of the previous payment); the milestone spacing above is designed to satisfy it with margin.

### B.5 Reviewability artifacts (committed in our repo today, 2026-11-13)

The RFP marks proposals without these as incomplete. All three exist as committed evidence at the tag below:

1. **Evidence of reproducing one sighting** — the #1766 ordering-divergence class, reproduced offline and deterministically: two valid Ed25519 issuers (`GBFNZEGERY…44W35`, `GB6C5J73…Z2PY6`) whose strkey-string order and XDR-byte order genuinely disagree (first differing character `F` vs `6` at index 2; base32 ASCII sorts `'2'-'7'` before `'A'-'Z'`, the encoded 5-bit groups sort the opposite way). Committed: `scripts/scf-rfp2-sighting-repro.mjs` (run: `node scripts/scf-rfp2-sighting-repro.mjs`) and its artifact `docs/evidence/scf-rfp2-sighting-repro.json` (CRC negative control included: a corrupted strkey throws `invalid checksum`). The #1789 class is recorded against the installed SDK as what it actually does — fail closed with `scvMap has more than one key that converts to "k"` — and the pre-fix reproduction is M2's first acceptance item.
2. **Draft manifest schema** (v0 — to be finalized in M0 with reviewer feedback):

    {
      "entryId": "E2-muxed-source-id1234",
      "cap": "CAP-0027",              // null allowed for convention entries (e.g. issuer ordering); the null is an explicit, documented case
      "protocolVersion": 28,
      "network": "testnet | mainnet",
      "source": "captured-history | local-core | synthetic",
      "generator": "tool + commit that produced the bytes",
      "xdrFile": "corpus/E2.xdr",     // raw bytes; hex mirror for review
      "xdrHex": "…",
      "expectedDecoded": { "arm": "keyTypeMuxedEd25519", "ed25519": "G…", "muxedId": 1234, "mAddress": "M…" },
      "roundTripRequired": true,      // re-encode(decode(bytes)) must equal bytes
      "sightings": ["wallet-backend#716", "js-stellar-sdk#1785"]
    }

3. **Three sample corpus entries** (synthetic, byte-round-trip-verified at commit-time):
   - `E1-poolshare-divergent-issuers` — ChangeTrustAsset pool share over the divergence pair; `expectedDecoded.canonicalIssuerOrder` = by XDR bytes; the trap is any consumer ordering issuers by strkey string.
   - `E2-muxed-source-id1234` — CAP-0027 muxed account, id 1234; produces the real SEP-0023 M-strkey `MBFNZEGERY3IPTQ6Z4RHZHALJ5SXCNBCFXY44EPWVXPDHXZVJMH44AAAAAAAAAAE2LWKE`; the trap is truncation/re-keying (wallet-backend#716 class) or accepting a muxed value that re-encodes to a different id (js-stellar-sdk#1785 class).
   - `E3-signer-signed-payload` — CAP-0040 signed-payload signer with a readable payload (`coreguard-demo-payload-2026-11-13`); the trap is treating it as a plain G-address (wallet-backend#729 class).
   Full bytes, expected-decoded values and build provenance: `docs/evidence/scf-rfp2-sighting-repro.json`.

### B.6 Open-source, maintenance, decentralization, infrastructure

- **License:** permissive from commit one — MIT for tooling code, CC0 for the corpus data — developed in the open in a public repo, with regular public status updates (GitHub issues + a short update per milestone in the SCF community channels).
- **Maintenance:** the delivering team maintains all deliverables for at least 12 months post-launch, including the first protocol upgrade after delivery (M5 runbook names the upgrade-watch process); the corpus's language-neutrality means any SDK team can adopt the conformance runner into its own CI without us.
- **Decentralization:** the deliverables are deliberately data + CI, not a service: no server, no operator, no trust anchor. Stewardship can hand over by repo transfer; the guide is designed for publication under the Stellar developers docs so ownership naturally moves to the ecosystem.
- **Infrastructure:** GitHub-hosted CI only. User tracking: none beyond standard GitHub repository traffic; no cookies, no telemetry, no third-party analytics in any deliverable.
- **Latest stable stack:** built against the current stable Stellar stack (Protocol 28-era tooling; @stellar/stellar-sdk 17.4.0 already exercised in our committed evidence), with the upgrade plan in M5.

### B.7 The honest boundaries (standing, non-negotiable)

- Funding is $0 until an award lands; this document claims "submitted", nothing beyond it.
- No customers, no revenue, no partnerships, no external adoption, no third-party audit is claimed anywhere.
- Our verification surfaces' `VERIFIED` label means evidence/receipt conformance as specified — it does not mean `SAFE`.
- Wallet integration and external integrations remain `NOT_BUILT` unless a named integration lands with committed evidence.
- The reviewability artifacts were produced by one solo builder with the repo's machinery; the honest track-record statement is in B.1, including what is NOT yet proven (no indexer authored yet; LedgerCloseMeta hands-on is M0's first deliverable).

---

## Part C — Measured repo state (machine-pinned, at this instrument's landing)

- npm tests: **1576/1576 tests** (machine-pinned; enforced by `scripts/run-tests.mjs` against `docs/state-snapshot.json`).
- Boundary audit: **1148 tracked files · 0 violations** (the three files this instrument lands — this doc, the reproduction script, its evidence artifact — are counted; measured from `git ls-files`, the count a fresh clone reproduces).
- Docs-node contract: **133 executed · 79 skip-listed · 30 covered** (unchanged; this instrument is fence-free by construction, like its 2026-11-06 predecessor).
- Foundry: **43/43 pass** (CI-measured). Claims audit: **PASS (0 violations)**.
- Latest release: **v1.2.0** (2026-11-13, tag on the CI-green tip, evidence-tabled): https://github.com/coreguard-global/CoreGuard/releases/tag/v1.2.0

## Owner checklist (per-step, possession rule)

1. Read Part A; fill the two `[OWNER: …]` slots (referral code, entity data).
2. Submit the SCF interest form choosing the **RFP Track** and name RFP 2 — paste Part A verbatim (or the AR lines per field). Target: within 48 hours of today (the announcement asks for ASAP so the process fits before 2026-11-20).
3. On invitation, submit the Build form choosing the RFP Track; paste Part B and link the committed evidence (B.5) — it is reviewer-checkable from a fresh clone.
4. Nothing external leaves the repo without your explicit per-step sign-off; no submission is automatic.

*Prepared 2026-11-13 on owner instruction ("اعمل الصح والأكثر احترافية…"). Hand-written via the write tool only; fence-free by construction (the docs-node contract executes nothing from this file). The reproduction evidence is a real, offline, deterministic run — re-runnable by any reviewer from a fresh clone.*
