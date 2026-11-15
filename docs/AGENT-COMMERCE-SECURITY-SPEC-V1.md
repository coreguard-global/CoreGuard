# CoreGuard Agent Commerce Security — Specification v1.0

**Version:** 1.0 · **Date:** 2026-11-14 · **Audience:** reviewers, integrators, the owner.

This document SPECIFIES the CoreGuard Agent Commerce Security family. Every status below is the real one: **BUILT** means committed code that runs and is measured on this tree; **SPEC'D** means designed here and only here; **OWNER-GATED** means a decision only the owner can make. Nothing in this document claims contact, integration, or endorsement with OpenAI, American Express, Mastercard, Visa, or any provider. Every order in every example is synthetic. Funding is $0.

## الملخص التنفيذي (عربي)

تحدد هذه الوثيقة عائلة «CoreGuard Agent Commerce Security» الإصدار 1.0: طبقة تربط **تفويض المستخدم** بـ**التنفيذ الفعلي** بـ**إيصال قابل لإعادة الاشتقاق**، فتُجيب على سؤال واحد بدقة: «هل التنفيذ مطابق لما وافق عليه المستخدم؟». كل حالة منتج مكتوبة بحالتها الحقيقية: BUILT = كود ملتزم يعمل ومُقاس على هذه الشجرة، SPEC'D = مصمَّم هنا فقط ولم يُبنَ، OWNER-GATED = قرار للمالك وحده. لا اتصال ولا تكامل ولا تأييد يُدَّعى مع OpenAI أو American Express أو Mastercard أو Visa أو أي مزوّد. كل طلب اصطناعي. التمويل $0.

## 1. The question the family answers

An agent pays. The user approves a specific order — a merchant, items, a total, a payment-credential reference, a time window. Later someone asks: **did the executed order match the approved one — and who can prove it later, independently?** Tokenized credentials protect card data; they do not bind execution to authorization. This family is that binding layer, composed entirely from the repository's own committed verification machinery (CGEP/1) — no new hashing domains, no new trust assumptions, no keys, no network, no wall clock.

## 2. The five products and their real statuses

| # | Product | Surfaces (committed paths) | Status | Measured where |
|---|---|---|---|---|
| 1 | Agent Authorization Firewall | `packages/agent-commerce/index.mjs` (createConsent → verifyExecution, fail-closed) over `packages/policy` | BUILT · TEST_EXECUTED (offline) | the suite arc + integration tests |
| 2 | Verifiable Consent Receipts (CGCR/1) | `packages/agent-commerce/index.mjs` (createConsent, verifyConsent) over `packages/canonical` · `packages/evidence` · `packages/verifier` | BUILT · TEST_EXECUTED | the suite CONSENT leg + tests |
| 3 | Agent Risk Engine (AGR/1) | `packages/agent-commerce/risk.mjs` | BUILT · TEST_EXECUTED | the suite attack battery + tests |
| 4 | Agent Commerce SDK · MCP server · REST API | `packages/agent-commerce/index.mjs` · `mcp.mjs` · `http.mjs` | BUILT · TEST_EXECUTED — npm publication OWNER-GATED | the suite MCP + HTTP legs + tests |
| 5 | Cross-Chain Execution Attestation (CGXA/1) | `packages/agent-commerce/attest.mjs` (buildAttestation · verifyAttestation · the frozen adapter registry) | BUILT · TEST_EXECUTED (offline attestation surface) — on-chain broadcast legs OWNER-GATED / NOT_PERFORMED | the attestation contract tests (16) + the offline demo (§7 items 9–10) |

Product 5 note (honest context, committed facts only): per-chain attribution machinery already exists in this tree — Core DAO commitment anchors are LIVE/RECORDED on Core Mainnet chainId 1116 (`docs/DEPLOYMENT.md`, `docs/STATUS.md`), and Stellar PSAR/1 pre-sign receipts are BUILT · TEST_EXECUTED with integration NOT_BUILT (`packages/stellar/presign.mjs`). The unified attestation surface is NOW BUILT as the offline attestation record CGXA/1 (§8): it attests an authorization↔execution arc against each chain's COMMITTED binding record and performs NO broadcast — a new anchor commit or a Soroban call is a new on-chain transaction, owner-authorized only, and the code to attempt it does not exist in the module.

## 3. Reuse-vs-build map

### 3a. REUSED — committed machinery, zero new trust assumptions

| Machinery | Package | What the family uses it for |
|---|---|---|
| Canonical hashing | `packages/canonical` (`hashIntent`, `hashPolicy`, `hashTrace`, `computeReceiptId`, `hashStateDelta`) | every byte-exact binding and re-derivation |
| Evidence + receipts | `packages/evidence` (`createEvidenceBundle`, `createReceipt`) | the CGCR/1 receipt inside every consent record |
| Verifier (10-check engine) | `packages/verifier` (`verifyReceipt`) | the execution verdict — TRACE_HASH compared unconditionally whenever a trace is supplied |
| Policy evaluation | `packages/policy` (`evaluatePolicy`) | value limits + target/recipient/selector allowlists, evaluated against the EXECUTED order |

### 3b. BUILT NEW — this family's contribution

| Surface | File | What it adds |
|---|---|---|
| AC-SDK/1 façade | `packages/agent-commerce/index.mjs` | one provider-independent API: `createConsent` · `verifyConsent` · `verifyExecution` · `nameDrift` |
| CGCR/1 consent record | `index.mjs` | the user's approval bound to the EXACT approved order bytes as a CGEP/1 receipt with a PINNED timestamp |
| AGR/1 drift taxonomy | `risk.mjs` | 8 named violation classes with severities (§5) — deterministic, never a probabilistic score |
| MCP server | `mcp.mjs` | real stdio JSON-RPC 2.0 server (protocol 2025-06-18), 4 tools, newline-delimited transport |
| REST API (AC-API/1) | `http.mjs` | `GET /health` + `POST /v1/authorize`, `/v1/verify`, `/v1/consent-verify`, `/v1/risk-assess`; exact-address allowlist guard-0; token-bucket limiter with `/health` limiter-exempt but allowlist-NOT-exempt; 1 MiB body cap |
| Security suite | `examples/agent-commerce-security-suite/run.mjs` | synthetic store + agent; the full arc: CONSENT VERIFIED → exact execution VERIFIED → named-class attack battery → a REAL MCP child driven live → a REAL loopback HTTP instance driven live; exit 0 ONLY on the exact arc; deterministic `artifacts.json` |
| Named attack battery | `test/integrations/agent-commerce-attack-battery.test.mjs` | the adversarial depth the arc's 8 rows summarize: a deterministic six-vector prompt-injection fuzz set, post-approval recipient swap / tax-shipping-fee escalation / credential substitution / item mutation, replay, expiry, receipt tamper — and the DOCUMENTED cross-session consumption gap, asserted honestly (a fresh ledger cannot see prior consumption; named on the report, never hidden) |
| TypeScript declaration surface | `packages/agent-commerce/index.d.ts` | type-only façade over `index.mjs` + `risk.mjs` for editors and adopters; structurally contracted (declared value-exports ↔ runtime exports, constant equality, boundary strings, no implementation) — no tsc lane in CI, stated on the surface |
| Operator dashboard | `docs/agent-commerce-dashboard.html` | bilingual (Arabic-first RTL + English mirror) offline operator view: the decision timeline (APPROVE → EXECUTE exact → real MCP INVALID → real REST VERIFIED), the 8 named attacks refused, the consent receipt id + pinned epoch, and the honest-gaps panel; embeds the committed artifacts verbatim; contract-tested offline |
| CGXA/1 attestation module | `packages/agent-commerce/attest.mjs` | product 5: the authorization↔execution arc attested against a chain's COMMITTED binding record — offline, deterministic, fail-closed with 9 frozen reject codes; NO broadcast surface in the module (§8) |

### 3c. NOT_BUILT — named, with no pretense

**Revision 2026-11-15:** three §3c rows moved to BUILT on this tree — the named attack battery (prompt-injection fuzz + the cross-session gap, honestly framed), the TypeScript declaration surface (structural contract; no tsc lane in CI — stated on the surface itself), and the bilingual authorization/receipts dashboard — and the cross-chain attestation row moved to BUILT the same day (CGXA/1, the offline attestation surface; its broadcast legs stay OWNER-GATED, §8). The rows below are what remains. §4–§7 are unchanged; §8–§10 record the attestation build, the npm lane and the IP study.

| Missing surface | Why it matters | Status |
|---|---|---|
| Durable single-use consumption anchoring (on-chain marker or equivalent) | today consumption is process-local BY DESIGN — a fresh process cannot see a previous consumption; the suite isolates one ledger per battery case on purpose | NOT_BUILT — the next spec step |
| TypeScript compiler typecheck lane (tsc in CI over the declaration surface) | the declaration surface is BUILT and structurally contracted; a compiler lane would additionally pin the types | NOT_BUILT |
| Live shopping-agent demo against a real merchant integration | real-world proof | NOT_BUILT (the synthetic suite is the current ceiling) |
| npm publication | distribution | OWNER-GATED — the owner's go is recorded (§9); the remaining steps are owner-only |

## 4. CGCR/1 — the consent record (schema)

The record shape is described field-by-field below (this document is fence-free by policy; every command elsewhere appears inline only).

**Field table (the object returned by `createConsent`):**

| Field | Type | Semantics |
|---|---|---|
| `spec` | constant `"CGCR/1"` | the consent-record schema version |
| `sdkVersion` | constant `"AC-SDK/1"` | the SDK surface that produced it |
| `receipt` | CGEP/1 receipt object | the approval bound as an independently re-derivable receipt; `timestamp` is PINNED to the approval epoch and `receiptId` is RECOMPUTED over the pinned payload |
| `receiptId` | hex string | commitment id of the pinned receipt |
| `intent` | CGEP/1 intent | the approved order: merchant, items, total, credential ref, window, `singleUse` |
| `policy` | CGEP/1 policy | the committed rules the approval ran under |
| `declaredTrace` | object | the exact submit-order payload the approval covers (the platform's declared execution shape) |

**Creation semantics.** `createConsent({ intent, policy, declaredTrace, nowSeconds })` — `nowSeconds` is REQUIRED; the wall clock is never read (every input to a byte-equality claim is pinned, including time). Re-running with the same inputs regenerates the record byte-identically. The offline state-delta is a FIXED documented constant (never a claim about chain state).

**Verification semantics.** `verifyConsent(consent)` re-derives every commitment against the record's OWN approved bytes — any tampered byte fails the commitment. `verifyExecution(consent, trace, { consumedSet })` verifies the executed order against the binding, fail-closed end to end (§6). A `singleUse` consent is consumed by its FIRST verified execution; the default ledger is process-local (durable anchoring NOT_BUILT, documented on the report itself); callers may inject an external `consumedSet`.

## 5. AGR/1 — the risk taxonomy (schema)

**Report shape:** `spec` (constant `AGR/1`) · `classification` (`CLEAN` or `VIOLATIONS`) · `violations[]` (`code`, `severity`, `field`, optional `expected`/`observed`/`detail`) · `boundary` (travels inside every report). Deterministic by construction: expiry is measured against the trace's own `blockTimestamp`, never the wall clock; two assessments of the same inputs are byte-identical.

**The eight named classes (frozen codes; adding a class is additive, renaming is forbidden — reports cite the code):**

| Code | Severity | Answers |
|---|---|---|
| `RECIPIENT_SUBSTITUTION` | CRITICAL | did the payee change after approval? |
| `VALUE_ESCALATION` | CRITICAL | did the executed total exceed the approved amount (incl. post-approval surcharges, fees, taxes, shipping)? |
| `ITEM_MUTATION` | HIGH | did the cart change after approval (injected item, quantity or unit-price change)? |
| `CREDENTIAL_SUBSTITUTION` | CRITICAL | was the payment-credential reference swapped after approval? |
| `EXPIRED_AUTHORIZATION` | CRITICAL | did execution happen after the authorization window closed? |
| `POLICY_VIOLATION` | CRITICAL | did the executed order violate a committed policy rule? |
| `SINGLE_USE_REUSE` | HIGH | was a single-use authorization replayed after consumption? |
| `MALFORMED_EXECUTION` | CRITICAL | is the payload unreadable for the fields the taxonomy reads — refused, never guessed? |

**Boundary (standing, load-bearing):** this is a deterministic RULE taxonomy — never a probabilistic fraud score, never a risk "rating", never a substitute for a payment network's fraud systems. It answers exactly one question: did the executed order drift from what was authorized, and where. **VERIFIED ≠ SAFE.**

## 6. Verdict semantics (fail-closed end to end)

`verifyExecution` returns VERIFIED only when ALL of the following hold: the CGEP/1 engine verdict is VERIFIED (every check PASS — a trace-less or partial L2 claim can never be VERIFIED); no check is FAIL; and the AGR/1 classification is CLEAN. Any drift → INVALID with the drifted field named (engine check + taxonomy class + human-readable `driftNamed`). Any tampered byte of the consent record → commitment mismatch → INVALID. Any unreadable field the taxonomy must decide on → `MALFORMED_EXECUTION` → INVALID. Nothing is ever "guessed" into a pass.

**Boundary (standing):** execution verification never decides delivery conformity (DDE/1 — the delivery-disbursement gate opens only on third-party acceptance records). The actor is declared, never detected.

## 7. Acceptance checks (independent re-derivation)

A reviewer can verify every claim on this tree, offline, with zero keys:

1. **The suite arc:** run `node examples/agent-commerce-security-suite/run.mjs` — it exits 0 ONLY on the exact arc (consent VERIFIED → exact execution VERIFIED → every named-class attack INVALID → the real MCP server rejects a drifted order → the real REST API verifies the exact order); any other outcome exits 1.
2. **Determinism:** re-running the suite regenerates `examples/agent-commerce-security-suite/artifacts.json` byte-identically — the committed copy is the reference artifact.
3. **The contract tests:** run `node --test test/integrations/agent-commerce-sdk.test.mjs test/integrations/agent-commerce-mcp.test.mjs test/integrations/agent-commerce-http.test.mjs test/integrations/agent-commerce-console-page.test.mjs` — the console-page contract additionally proves the static console's embedded data island equals the committed artifacts byte-for-byte and that the page stays fully offline.
4. **Consent re-derivation:** anyone holding a consent record recomputes its binding with `verifyConsent` — no keys, no network, no trust in the issuer.
5. **The MCP server live:** run `node packages/agent-commerce/mcp.mjs` and speak newline-delimited JSON-RPC 2.0 on stdio (`initialize` → `tools/list` → `tools/call`).
6. **The named attack battery:** run `node --test test/integrations/agent-commerce-attack-battery.test.mjs` — every attack leg INVALID fail-closed; the control leg VERIFIED; the battery byte-deterministic.
7. **The declaration surface:** run `node --test test/integrations/agent-commerce-types.test.mjs` — declared value-exports ↔ runtime exports both directions, constants equal, no implementation.
8. **The dashboard contract:** run `node --test test/integrations/agent-commerce-dashboard-page.test.mjs` — data island equals the committed artifacts byte-for-byte; boundaries in BOTH languages; the page fully offline.
9. **The attestation surface (CGXA/1):** run `node --test test/integrations/agent-commerce-attestation.test.mjs` — the exact arc VERIFIES offline against both committed adapters; every attack leg REFUSES fail-closed with a named code from the frozen 9-code vocabulary; the record id re-derives byte-deterministically; the attestation view consumes nothing; every adapter fact literal is pinned to its cited committed document; no exported name suggests a broadcast.
10. **The attestation demo:** run `node examples/agent-commerce-attestation/run.mjs` — exit 0 ONLY on the exact arc (CONSENT VERIFIED → ATTEST+VERIFY VERIFIED → the 3 named attack legs REFUSED with their codes → determinism); re-running regenerates `examples/agent-commerce-attestation/artifacts.json` byte-identically — the committed copy is the reference artifact.

## 8. Cross-Chain Execution Attestation — BUILT as the offline attestation surface (CGXA/1)

**Goal (unchanged):** one verifiable statement — "this executed order on chain A / platform X corresponds to the authorization bound in consent record C" — provable across execution environments, with each network's own limits stated honestly.

**Built (this tree, `packages/agent-commerce/attest.mjs`):**

- **Attestation record (CGXA/1):** consent `receiptId` + executed-order commitment (the CGEP/1 trace-domain hash — the same domain the family's own verifier re-derives, so an attestation is only mintable for an arc that verifies exact) + the target chain's binding record + adapter id + verification level `COMMITTED_EVIDENCE`. Deterministic: the same consent, executed trace, adapter and pinned clock regenerate the record byte-identically; `nowSeconds` is REQUIRED — the wall clock is never read (the C40 rule).
- **Adapter registry (frozen; committed facts only):** `core-dao-anchor` (chainId `1116`, anchor `0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E`, per `docs/DEPLOYMENT.md`) and `stellar-anchor` (anchor contract `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`, per `docs/EVIDENCE-MATRIX.md`). A contract test pins every fact literal to the committed document that holds it — the registry cannot drift from the repo's own evidence.
- **Fail-closed verification (9 frozen reject codes):** `MALFORMED_ATTESTATION` · `ADAPTER_UNKNOWN` · `CHAIN_BINDING_MISMATCH` · `LEVEL_MISMATCH` · `CONSENT_MISMATCH` · `EXECUTION_MISMATCH` · `TIME_INVALID` · `ID_MISMATCH` · `VERIFIER_ERROR` — every refusal carries a named code, and the verifier's own failure is a code too, never an exception leaking a pass. The attestation view consumes NOTHING: a single-use consent is still consumed only by its first verified execution, and verifying an attestation mutates nothing.
- **Explicitly NOT built / NOT claimed (the honest gates):** there is NO broadcast surface in the module — no signing, no submitting, no network, no keys, no wall clock; a NEW anchor commit for a consent receipt or a Soroban call is a new on-chain transaction and stays OWNER-GATED / NOT_PERFORMED by repo rule (the code to attempt it does not exist here); carrying a consent binding into the Soroban lane is integration NOT_BUILT; an attestation of one environment is never bridge trust, never a relay, never delivery conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected; every demo order is synthetic (the credential is a placeholder, never a PAN).

## 9. npm publish lane — the owner's go is recorded; the remaining steps are owner-only; NOTHING published

**Owner's decision (2026-11-15, recorded here in substance): the owner opened the publication gate — publish the npm lane.** What already exists on this tree, needing nothing further from the agent: `release.yml` (workflow_dispatch with a mandatory `confirm: RELEASE` input, the `npm-release` environment, `id-token: write` for npm provenance, and its own fail-closed guards — it refuses to run without the confirm input or without `NPM_TOKEN`), `scripts/release-please.mjs` (publish-check + plan + publish over the 13 `@coreguard/*` packages), and `scripts/publish-check.mjs` certifying install parity from packed tarballs.

**What physically remains — owner-only steps (the agent cannot perform them):**

1. Register/confirm the `@coreguard` scope on npmjs.org (requires an npmjs account and email verification).
2. Create an npm automation token and set it as the repository secret: `gh secret set NPM_TOKEN` (the secrets list is empty as of this writing — measured).
3. Dispatch once: `gh workflow run release.yml -f confirm=RELEASE`, and watch the run to green.

**Status: NOTHING has been published — zero packages, $0.** The agent deliberately does NOT dispatch the workflow without the token (that would create a deliberate red run), and does NOT add `packages/agent-commerce/package.json` this cycle (it would force a `package-lock.json` regen — an owner-protected file). The agent-commerce package keeps shipping without one (bare `@coreguard/*` specifiers resolve from the repo root); adding it belongs to the owner-gated publication step itself.

## 10. IP feasibility study — the authorization ↔ proof-of-execution binding (with the disclosure warning)

**Scope honesty first:** this is an engineering feasibility note written by the author of the code, hosted in the same document as the spec. It is NOT a patentability opinion, NOT legal advice, and NOT a registered or filed right. No patentability search has been performed — no prior-art search, no counsel review. "CoreGuard" is not a registered trademark.

**The candidate mechanism family — what could be worth protecting.** The family's one idea, expressed once: bind a user's authorization to a PROOF OF EXECUTION as re-derivable bytes, so any third party can later verify the binding offline without trusting the issuer. Four concrete mechanisms compose it:

- **(a) The byte-exact binding with a pinned clock (CGCR/1):** the user's approval is bound as a CGEP/1 receipt to the EXACT canonical bytes of the approved order (intent + policy + the declared submit payload), with the approval timestamp PINNED — the wall clock is never read, so re-derivation is byte-deterministic. Technical effect: an approval stops being a click event and becomes a verifiable artifact whose identity survives copying, storage and transmission.
- **(b) The deterministic named-class drift taxonomy feeding a fail-closed verdict (AGR/1):** eight frozen violation classes (recipient substitution, value escalation, item mutation, credential substitution, expired authorization, policy violation, single-use reuse, malformed execution) map any execution divergence to a NAMED class — never a probabilistic score — and the verdict is fail-closed on any drift, with the drifted field named. Technical effect: auditability (every refusal is explainable by code, not by a model) and fail-closed behavior (an unreadable field refuses; nothing is guessed into a pass).
- **(c) The self-contained offline consent receipt:** every commitment in the record is re-derivable from the record's own bytes (canonical hashing over committed machinery) — a verifier needs no issuer contact, no key infrastructure and no network. Technical effect: third-party verifiability without a trust-on-issuer assumption.
- **(d) The cross-environment attestation binding (CGXA/1):** the same arc, attested against a chain's COMMITTED binding record (the adapter registry pinned by tests to the repo's own committed documents), with an explicit verification level that never claims a broadcast the module did not perform. Technical effect: one verifiable statement that travels across execution environments while stating its own evidence ceiling.

**Honest prior-art adjacency (what this note can and cannot say):** adjacent fields exist and are active — verifiable-credential and signed-payload schemes (W3C VC, JOSE/COSE families), EIP-712 typed structured signing for approvals, payment-network credential tokenization and its binding layers, and generic append-only audit-log hashing (RFC 6962-style transparency structures). This note does NOT assert novelty over any of them — a structured search would have to compare mechanism by mechanism, claim by claim, and none has been run. The candidate differentiator is the specific COMPOSITION (pinned-clock approval receipt + exact-bytes execution verdict + deterministic named taxonomy + committed-record attestation, composed as one fail-closed family) — and whether that composition is novel and non-obvious is precisely what only a professional search can decide.

**Disclosure warning (read before sharing anything further):** public commits and repositories can constitute prior disclosure that affects patent rights in some jurisdictions (absolute-novelty regimes can destroy filing options from the disclosure date onward). This repository is public, and the mechanisms above are already publicly disclosed by being committed here; this document's own publication date is visible in git history. Practical consequences, stated plainly: (1) if the owner ever wants to file, a patent specialist should be consulted BEFORE any further public description of these mechanisms (posts, demos, papers, outreach documents); (2) grace periods differ sharply by jurisdiction and are unreliable as a plan; (3) no IP claim may appear in any outreach or funding material beyond this study's own honest framing.

**Decision owner-gated:** any filing decision, any attorney engagement, and any further-disclosure decision belong to the owner alone. This study changes none of that.

## 11. The 30-day plan — mapped to what exists

| Window (owner's plan) | Planned | Real status on this tree |
|---|---|---|
| Days 1–5 — product-ize the demo | Firewall as the lead product; SDK API; consent data contracts; MCP example | **DONE** — all five products built and measured (§2) |
| Days 6–12 — technical superiority proof | prompt injection, recipient swap, price/tax/shipping changes, replay + cross-session, expiry, receipt tamper | **DONE for the named battery** — each class is a named taxonomy violation; the deeper fuzz harness is NOT_BUILT |
| Days 13–18 — usable product | MCP server; TypeScript SDK; REST API; dashboard; real store demo | **MCP + REST DONE**; TS SDK, dashboard, real-store demo NOT_BUILT |
| Days 19–24 — distribution | integration docs; npm publish; MCP server publish; short video; partner trials | integration docs **DONE** (this document + the suite README); npm/MCP publication **OWNER-GATED — the owner's go is recorded (§9); the remaining steps are owner-only (npmjs scope + NPM_TOKEN + one dispatch); nothing published**; video **OWNER-GATED** |
| Days 25–30 — funding & partnerships | OpenAI ecosystem file; Stellar funding; Core ecosystem; incubators; 15–20 partner messages | funding/partnerships file **COMMITTED** (`docs/agent-commerce-funding-and-partnerships-2026-11-14.md`); all outreach/contact **OWNER-GATED** — no contact made |

## 12. Standing boundaries

Execution verification never decides delivery conformity (DDE/1) · VERIFIED ≠ SAFE · the actor is declared, never detected · every demo order is synthetic (the credential is a placeholder, never a PAN) · no contact, integration or endorsement is claimed with OpenAI, American Express, Mastercard, Visa or any provider · durable single-use anchoring is NOT_BUILT · cross-chain attestation is never bridge trust or a relay, and its on-chain broadcast legs are OWNER-GATED / NOT_PERFORMED · funding is $0 · the dated market-context instrument (`docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md`) records the public launch event and the honest adjacency — it is evidence of context, never of integration.
