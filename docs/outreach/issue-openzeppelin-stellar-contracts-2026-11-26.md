# Issue draft — OpenZeppelin/stellar-contracts

**Title:** Off-chain evidence from a smart-account snapshot: would this mapping be useful, or is it better as a docs snippet?

**Where:** https://github.com/OpenZeppelin/stellar-contracts/issues (open an issue first; do not open a PR without an invitation — CONTRIBUTING.md governs this).

---

## Body (paste as-is)

Hi — I maintain [CoreGuard](https://github.com/coreguard-global/CoreGuard), an offline verification toolkit. This is a question about whether a small, read-only mapping would be useful to smart-account users, not a request to change your contracts.

### What I built

An adapter that takes a **caller-supplied account snapshot** (the kind of state your signers-and-policies tests already assemble) and emits argument objects for three deterministic checks:

- signer set, kinds and thresholds (`ACCOUNT_ID`, `SIGNERS`, `UNIQUE_KEYS`, `THRESHOLDS`, `MASTER_DISABLED`)
- whether the present signer weights actually reach a named threshold at a named level (`THRESHOLD_MET`)
- a Soroban authorization entry against expected contract, function and args digest, with a pinned ledger (`EXPIRATION`)

It never contacts the network, never signs, never deploys, and never decides authorization. It reshapes evidence the caller already has and digests it so a tamper (weight, signer kind, expiration ledger) is visible.

```js
import { fromSmartAccountSnapshot } from "@coreguard/agent-commerce/smart-account-adapter.mjs";

const mapped = fromSmartAccountSnapshot({
  network: "testnet",
  accountId: "C...",
  masterWeight: 0,                       // master key disabled
  thresholds: { low: 1, medium: 2, high: 3 },
  signers: [
    { key: "G...", kind: "passkey", weight: 2 },
    { key: "G...", kind: "session_key", weight: 1 },
  ],
  soroban: {
    entry: { contractId: "C...", functionName: "transfer", argsDigest: "sha256:…",
             signatureExpirationLedger: 2000, rootInvocation: true },
    expected: { contractId: "C...", functionName: "transfer", argsDigest: "sha256:…" },
    currentLedger: 1000,
  },
});

// mapped.toolCalls -> 3 calls, each with the exact arguments
```

`mapped.snapshotDigest` changes if a weight, kind or expiration ledger changes, and the corresponding check fails by name rather than by a generic error. 9 tests, all offline, including a run with `fetch` replaced by a throwing stub.

### Why I am asking you

Your `packages/accounts` README describes authorization as a composition of context rules, signers and policies, and `examples/multisig-smart-account` shows a threshold plus a spending-limit policy. Users who want an *off-chain* record of "these signers, this threshold, this auth entry, at this ledger" currently re-implement that mapping in their own backend.

So, three concrete questions:

1. Is a read-only snapshot → evidence mapping useful to this project's users, or does your existing tooling already expose this shape?
2. If useful, where should it live: a docs snippet in `packages/accounts`, an example under `examples/multisig-smart-account`, or nowhere?
3. Is there a canonical snapshot format you would point at (signer kinds, thresholds, auth-entry fields) that an external tool should consume instead of inventing one?

### What I am not claiming

No compatibility claim, no partnership, no endorsement, no request for review time. I have not run anything against your contracts; the adapter consumes a caller's snapshot and does not read chain state. If the honest answer is "this belongs in our docs, not your package", that is a useful answer and I will follow it.

Thanks for the smart-account package — the signers/policies separation is what made a small mapping possible.

---

## Notes before sending (do not paste)

- Read `CONTRIBUTING.md` and `.github` templates first; use their issue form if one exists.
- Do not attach a PR. Do not post the same text in Discussions and Issues.
- If they answer "not useful", record it and stop; do not follow up with a pitch.
- Link only the adapter file and this text's claims; do not quote a tool count, adoption, or a customer.
