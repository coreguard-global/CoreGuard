# Product — CoreGuard Agent Execution Security

**Independent Execution Trust Infrastructure**, shipped as one product: an
execution verification and authorization layer that runs beside the wallet, the
agent runtime, the DEX or the payment rail — and proves that what executed is
what was authorized.

Boundary, stated before anything else: `VERIFIED` ≠ `SAFE`. A verdict describes
the checks performed on the evidence presented. It is not a promise that the
outcome is safe, profitable, or endorsed by anyone.

## The three components

### 1 · Authorization Firewall

A signed authorization bound to the **exact transaction bytes**: who approved
what, under which policy, until when. Change one field and the thing being
signed is no longer the thing that was approved — which is the entire point.

- Code: `packages/stellar/presign.mjs` (PSAR/1), `packages/agent-gate/` (policy + conformance)
- Measured: built, test-executed offline; field-by-field tamper matrix in `test/integrations/agent-gate-field-tamper.test.mjs`

### 2 · Execution Verification

The layer compares the signed envelope with what will run or did run and returns
a **named outcome**, never a score:

- `PASS` only when the envelope conforms
- `BLOCK` with a reason that names the binding that failed — `XDR_BINDING_MISMATCH`, `RECEIPT_EXPIRED`, `BAD_DIGEST`
- `NOT_INCLUDED` / `ABSENT` / `NOT_CHECKED` never travel downstream as a silent pass

The design rule that matters commercially: **`UNKNOWN` is not success.** The
operation stops or holds until evidence closes it. Fail-closed is the product,
not a setting.

### 3 · Verifiable Consent Receipts

An artifact plus an offline verifier. No secret, no network call, no trust in
CoreGuard's servers. A counterparty, an auditor, or a court-facing process can
re-derive the verdict from public bytes.

- Code: `packages/independent-verifier/` (JS · Rust · WASM · C/Python parity)
- Demo: `npm run trust:demo` — four pillars, three named refusals, one receipt digest, offline

## What a buyer gets in the first two weeks

A pilot is deliberately small: one flow, real and adversarial cases, an evidence
bundle verified outside this repository, a report that includes the failures.

| Days | Step | Owner |
|:--:|---|---|
| 1–2 | Choose one flow; capture the exact unsigned envelope and policy fields | Joint |
| 3–5 | Wire `issueAuthorizationReceipt` / `verifyAuthorizationReceipt` behind a flag | Partner · CoreGuard reviews |
| 6–8 | Run real and adversarial cases: amount, destination, expiry, network, replay | Joint |
| 9–10 | Evidence bundle verified outside this repository; failures reported | CoreGuard |
| 11–14 | Read-out and go / no-go | Joint |

Full kit: [PILOT-KIT.md](PILOT-KIT.md) · commercial framing: [PARTNERSHIPS.md](PARTNERSHIPS.md)

## What is live, what is not

| Surface | Status |
|---|---|
| Four-pillar engine + offline verifier | BUILT · TEST_EXECUTED |
| Stellar mainnet anchor and first gated funded swap | EXECUTED / CONFIRMED — see [EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md) |
| Core DAO evidence registry | LIVE on mainnet · 43/43 Foundry proofs |
| Authorized lane deployed on Stellar mainnet | NOT DEPLOYED |
| Wallet (Freighter) integration | NOT BUILT — technical evaluation comment on record |
| External customers, signed pilots, revenue | ZERO |

The full measured state, regenerated on every push, is [STATUS.md](STATUS.md)
and [state-snapshot.json](state-snapshot.json). Numbers in any other document
that disagree with those two are wrong.
