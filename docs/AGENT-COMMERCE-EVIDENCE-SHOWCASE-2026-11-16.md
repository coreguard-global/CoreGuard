# CoreGuard Agent Commerce Security — Evidence Showcase (evidence-first)

**Measured state (CI-pinned, `main`):** 1752/1752 tests · 1244 files / 0 boundary violations · docs-node 133 executed · 81 skip-listed · 30 docs covered · CI green.  
**Scope:** offline, deterministic, fail-closed verification surfaces (synthetic fixtures; no live wallet/card interception; no on-chain broadcast). `VERIFIED ≠ SAFE`.

## The arc to demonstrate (from a clean clone)

> Goal: show, with reproducible artifacts, **approval bound to exact bytes → exact execution verifies → named drift is refused → receipt/binding is independently re-derivable**.

### Prerequisites
- Node.js (repo-supported version), git
- Clean clone of `coreguard-global/CoreGuard` at a green `main` commit

### 1) Reproduce the measured baseline (stranger-verifiable)
```text
git clone https://github.com/coreguard-global/CoreGuard.git
cd CoreGuard
npm ci
npm test
npm run boundary:audit
```
**What this proves:** the suite and boundary gates pass on the measured tree (counts pinned in `docs/state-snapshot.json`; CI enforces drift).

### 2) Run the end-to-end security-suite demo (the full arc)
```text
node examples/agent-commerce-security-suite/run.mjs
```
**Expected (exit 0 on exact arc):**
- **CONSENT:** user approval bound to the exact approved order bytes (CGCR/1).
- **EXECUTE (exact):** exact execution → **VERIFIED** (all checks pass).
- **ATTACK BATTERY (fail-closed, named classes):** post-approval drift refused with explicit classes/codes (e.g. total/merchant/item/credential changes, expiry, single-use replay/consumption handling per scope, record tamper, malformed payload refused—not guessed). Deterministic artifacts produced.
- **MCP (stdio JSON-RPC 2.0):** live server driven authorize → verify (drift) → refused/invalid outcome.
- **HTTP (loopback REST, AC-API/1):** live instance driven authorize → verify exact → **VERIFIED**.

**What this proves:** the approval↔execution binding, deterministic verification, and named fail-closed refusals are runnable and inspectable on synthetic data.

### 3) Run focused demos (independently)
```text
node examples/agent-commerce-firewall/run.mjs
node examples/agent-commerce-attestation/run.mjs
```
**What this proves:** (a) AC-FW/1 composed firewall pre/post behavior on declared vs executed flows (ALLOW/DENY by named reasons), (b) CGXA/1 offline attestation and Soroban consent-binding **preparation** (CGXA-SOROBAN/1) are reproducible — **no broadcast**, owner-gated on-chain actions not performed.

### 4) Verify declarations (type surface)
```text
npx --yes --package typescript@5.9 tsc --noEmit --project packages/agent-commerce
```
**What this proves:** the published declaration surface for `packages/agent-commerce` type-checks (as enforced in CI).

## What the evidence supports (and what it does not)

| Supported by evidence | Not claimed |
|---|---|
| Deterministic, offline, fail-closed binding & verification on synthetic fixtures; named refusal classes; replayable demos/artifacts; CI-pinned measurements | Interception of real ChatGPT Wallet/card transactions; production fraud prevention guarantees; live merchant/provider integration; endorsement by OpenAI/AmEx/Mastercard/Visa; on-chain broadcast/commit performed; npm/MCP-registry publication completed; customers/revenue/funding/partnerships/adoption |

## Boundaries (state clearly in any demo)
- `VERIFIED ≠ SAFE`; results are policy/byte-binding conformance on provided inputs.
- AC-CS/1: durable **same-host** (file-backed) anchoring via `consumedSet` — **not** distributed, **not** an on-chain marker.
- Soroban `commit_authorized` payload preparation is offline (CGXA-SOROBAN/1); broadcast/calls are **OWNER-GATED / NOT_PERFORMED**.
- All examples/orders are synthetic; no secrets/credentials in artifacts.
