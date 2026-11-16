# CoreGuard — Integration Pilot Plan (actionable, measurable, honest)

**Objective:** run a time-boxed, low-risk integration of CoreGuard’s approval↔execution verification on **one real flow** (or a realistic testnet/staging flow) and produce an **independently re-verifiable evidence bundle**. A pilot produces evidence and a go/no-go decision — not a safety guarantee.

## 0) Preconditions & honesty
- **No secrets shared:** issuer/private keys never leave the partner. Artifacts must contain **no** secrets.
- **Scope honesty:** verifies conformance/binding to the policy and exact bytes provided; `VERIFIED ≠ SAFE`. Not a replacement for fraud systems, custody, or audits.
- **Publication:** results (including misses) should be publishable as numbers/anonymized findings where possible; unpublished pilots do not count as external adoption evidence.

## 1) Scope (10 working days, single flow)
| Days | Activity | Owner | Output |
|---|---|---|---|
| 1–2 | Select **one** flow (e.g. agent-initiated payment/order above threshold). Capture exact unsigned payload/bytes, policy/allowlists, approval fields (merchant/recipient, amounts/fees/tax, window) | Joint (2h call + async) | Flow spec + fixtures (synthetic/sanitized) |
| 3–5 | Integrate behind a **feature flag**: `authorize`/consent bind + `verify` around that flow; wire MCP or REST/SDK as appropriate | Partner (eng), CoreGuard (review) | Small PR/branch (reviewable in one sitting) |
| 6–8 | Execute matrix: exact-match + adversarial cases (amount/fee drift, recipient/merchant swap, item/credential mutation as applicable, expiry, replay/single-use per scope) | Joint | Verdict transcript (pass/refuse by named code/class) |
| 9–10 | Produce evidence bundle and run third-party re-verification on a clean machine; draft report | CoreGuard lead, Partner validates | Bundle + `pilot-report.md` + go/no-go |

**Out of scope:** production rollout, custody/key management, contract audits, UX redesign, broad multi-flow coverage, claims of real-wallet interception unless explicitly demonstrated and evidenced.

## 2) RACI (lightweight)
- **Partner:** named engineer, provides flow/fixtures, runs integration & re-verification on their side, decision-maker for read-out.
- **CoreGuard:** integration guidance, review, harness/adversarial cases, bundle/report assembly, 30-day post-readout integration support (advisory).

## 3) Integration surface options (pick one)
- **SDK (library):** direct calls to authorize/verify APIs.
- **REST (AC-API/1):** `/health`, `/v1/authorize`, `/v1/verify`, (and related endpoints as needed) — loopback/self-hosted in pilot context.
- **MCP (stdio JSON-RPC 2.0):** tool-driven authorize/verify for agent runtimes.

## 4) Success criteria & metrics (measured at read-out)
| # | Criterion | Target | How measured |
|---|---|---|---|
| 1 | Time-to-first-verdict in partner repo | ≤ 15 min from clean setup to a PASS/BLOCK | wall-clock, recorded by partner |
| 2 | Re-verification outside CoreGuard repo | ≥ 95% of sampled pilot cases re-verify independently | partner runs verifier on their machine |
| 3 | Adversarial refusals by name | 100% of in-scope tamper cases refused with explicit named reason/code | transcript table (one row per case) |
| 4 | Determinism | identical inputs → identical receipt/binding digest across two runs | digest comparison |
| 5 | Engineering effort | ≤ 2 engineer-days total (partner) | timesheet |
| 6 | Change surface | integration behind flag; minimal diff (target ≤ 1 non-test file outside flag) | `git diff --stat` |
| 7 | Secret hygiene | 0 secrets in bundle | automated/manual check; verifier refuses key-shaped inputs where applicable |

*Interpretation:* hitting 1–4 with a documented gap elsewhere is a pass-with-findings; missing 2 means the pilot does not count as independently evidenced.

## 5) Evidence bundle (deliverable)
A directory (e.g. `pilot/<date>/`) containing only:
- `envelope.*` / exact input bytes (sanitized) used for authorization
- `receipt.json` (and any binding artifacts produced)
- `issuer-public.*` (public material only)
- `transcript.json` (every case: input id, verdict, named reason/code)
- `pilot-report.md` (criteria table filled, findings incl. failures, signed/acknowledged by both sides)

**Re-verification:** runnable on a machine with documented prerequisites using the provided verifier flow/commands; anything not re-checkable is a claim, not evidence.

## 6) Risks & mitigations
| Risk | Mitigation |
|---|---|
| Scope creep | single flow, flag-guarded, fixed 10-day plan |
| Secret leakage | public-only artifacts, explicit hygiene check, no key export |
| Misinterpretation of VERIFIED | report states `VERIFIED ≠ SAFE` and exact policy/context checked |
| Environment differences | re-verify on clean machine; pin inputs/digests |

## 7) Outcomes
- **Go:** documented results + scoped phase-2 proposal (e.g. second flow, additional attestation/read-back as applicable) with agreed terms — no pricing assumed here.
- **No-go:** written reasons with the same metrics/table; no retention of partner secrets; findings recorded honestly.

*This plan defines how to produce verifiable evidence; it does not claim adoption, endorsement, or production readiness.*
