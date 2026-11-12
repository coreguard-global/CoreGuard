# Stellar/1 — CoreGuard Stellar Integration Adapter

Honest status: **DRY_RUN / NOT_BUILT**. No secret key, no live submission, no funds movement.

> **Why this line and `docs/EVIDENCE-MATRIX.md` no longer contradict each other.**
> Both were always true about different questions, and the repo now states them
> on three separate axes: `code` (this adapter is BUILT), `execution` (owner-run
> scripts have executed mainnet calls, with committed artifacts) and
> `integration` (**NOT_BUILT** — no external consumer, no customer).
> See [`docs/STELLAR-STATUS-UNIFICATION.md`](../../docs/STELLAR-STATUS-UNIFICATION.md)
> and the machine-readable registry `docs/surface-status.json`.

## What this is

A deterministic, fail-closed adapter for the Stellar network (Horizon REST API):

- **Read** account state from Horizon (public testnet by default).
- **Build** payment intents offline (no signing).
- **Submit** only when an explicit submitter function is injected.

## What this is NOT

- Not a wallet. No secret key is stored, generated, or logged.
- Not a live integration claim. `status()` reports `UNKNOWN / DRY_RUN / NOT_BUILT` until a real counterparty + credentials + receipt are observed.
- Not revenue. No transaction is ever submitted by this module.

## Usage

```js
import { readAccount, buildPaymentIntent, submitTransaction, status, selfCheck } from "./packages/stellar/index.mjs";

const acct = await readAccount({ network: "testnet", accountId: "G..." });
console.log(acct.state, acct.account?.balances);

const intent = buildPaymentIntent({ source: "G...", destination: "G...", amount: "10" });
console.log(intent.state, intent.intent);

// Submit only with an injected submitter (you own the key + signer):
const result = await submitTransaction({ xdr: "<signed xdr>", submitter: async (x) => ({ ok: true, hash: "..." }) });

console.log(status());
console.log(selfCheck());
```

## Standards

STELLAR/1 (CoreGuard adapter envelope). Compatible with the adapter contract in `packages/adapters/contract.mjs`.

## PSAR/1 — Pre-sign Authorization Receipts (`presign.mjs`)

A pre-sign receipt binds an authorization decision to the **exact transaction
XDR bytes**, before any signature exists. A wallet (or any verifier) can then
re-derive the decision from the receipt itself — locally, against a pinned
issuer key — instead of trusting a verdict string, an image, or a DApp's claim.

- **Scope**: `PRE_SIGN_AUTHORIZATION` — the receipt proves that THIS
  authorization (network + exact-XDR fingerprint + policy) passed verification
  inside its window, issued by the pinned key. It never proves execution:
  every verdict carries `executionProof: "NOT_INCLUDED"`, and execution
  evidence comes from the ledger after submission.
- **Fail-closed**: decisions are `PASS | BLOCK` only. Every failure BLOCKs by
  name (`MALFORMED_RECEIPT`, `MALFORMED_INPUT`, `BAD_DIGEST`, `BAD_SIGNATURE`,
  `XDR_BINDING_MISMATCH`, `NETWORK_MISMATCH`, `POLICY_MISMATCH`,
  `NOT_YET_VALID`, `RECEIPT_EXPIRED`, `VERIFIER_ERROR`) — a verifier error is
  itself a BLOCK, never a pass.
- **Byte-exact binding**: the receipt carries sha256 over the exact XDR string;
  one changed byte invalidates it.
- **No signing, no keys**: the module never signs a transaction and never holds
  wallet keys. `createInMemoryIssuer` is a DEMO/DEV-only deterministic stand-in
  for the offline demo and tests; in production the issuer is a verification
  service the owner runs.

Integration status for this surface: **NOT_BUILT** — no wallet embeds it yet.
Tests: `test/integrations/stellar-presign.test.mjs`; offline demo:
`examples/stellar-presign/demo.mjs` (npm script `stellar:presign`).

## Truthfulness

All claims measured. No fabricated traction, funding, partnerships, or live integrations. See `docs/CLAIMS-REGISTRY.md`.