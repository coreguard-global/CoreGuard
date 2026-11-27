# OpenZeppelin smart accounts — the fields an off-chain verifier needs

This page is the mapping the adapter expects, written against the public
smart-account surface. It is a **field list**, not an integration claim: nothing
here reads a chain, and the adapter consumes a snapshot your client already
assembled. `VERIFIED ≠ SAFE`.

Checked against `stellar/smart-account-kit` `main` (package `0.10.0`) and
`OpenZeppelin/stellar-contracts` `packages/accounts` on 2026-11-26. Field names
are theirs and can change; re-read `get_context_rule` before relying on this.

## What a context rule actually contains

`get_context_rule(id)` returns a `ContextRule`:

| Field | Type | Why an off-chain verifier needs it |
|---|---|---|
| `id` | `u32` | ties the evidence to one rule; two rules can share a context type |
| `context_type` | `Default` / `CallContract(address)` / `CreateContract(wasmHash)` / `CreateContractExternalRef(owner, tag)` | what the rule authorizes at all |
| `name` | `string` | human label; never a security input |
| `signers` | `Signer[]` | who can authorize under this rule |
| `signer_ids` | `u32[]` | registry ids, positionally aligned with `signers` |
| `policies` | `string[]` | policy contracts that must also be satisfied |
| `policy_ids` | `u32[]` | registry ids, positionally aligned with `policies` |
| `valid_until` | `Option<u32>` | expiry ledger; absent means no expiry |

`Signer` is a two-arm union:

- `{ tag: "Delegated", values: [gAddress] }` — a Stellar account authorizes
  natively via `require_auth`.
- `{ tag: "External", values: [verifier, keyData] }` — a verifier contract
  validates the signature. Passkeys are `External` against the WebAuthn
  verifier; Ed25519 keys are `External` against the Ed25519 verifier; `keyData`
  is the credential id or the 32-byte public key.

## What the rule does **not** contain

The rule lists policy contracts, not their parameters. A threshold or
weighted-threshold weight lives in the policy contract's own state, keyed by
`(smart_account, context_rule_id)`. An off-chain verifier that reads only the
rule cannot know the required weight, and must not guess it. Read it through
the kit's typed policy clients (`kit.policyClients`) and carry the value into
the snapshot explicitly.

## Snapshot the adapter accepts

```json
{
  "network": "testnet",
  "accountId": "C...",
  "masterWeight": 0,
  "thresholds": { "low": 1, "medium": 2, "high": 3 },
  "signers": [
    { "key": "GA...", "kind": "delegated", "weight": 1 },
    { "key": "a1b2c3...", "kind": "passkey", "weight": 2 }
  ],
  "presentedSigners": [{ "key": "GA...", "weight": 1 }],
  "soroban": {
    "entry": {
      "contractId": "C...",
      "functionName": "transfer",
      "argsDigest": "sha256:...",
      "signatureExpirationLedger": 2000,
      "rootInvocation": true
    },
    "expected": { "contractId": "C...", "functionName": "transfer", "argsDigest": "sha256:..." },
    "currentLedger": 1000
  }
}
```

`masterWeight` and `{ low, medium, high }` describe a **classic Stellar
account**. A smart account has no such fields; when the subject is a smart
account, pass the rule's effective threshold into `thresholds.high` (and the
same value for `low`/`medium` if you only know one), and keep `masterWeight: 0`
so the checker does not invent a master key that the contract does not have.
State that choice in your own record; the adapter does not decide it for you.

## Producing the snapshot with the kit

```ts
import type { ContextRule } from "smart-account-kit";

const { result: rule } = await kit.rules.get(ruleId);

const signers = rule.signers.map((s) =>
  s.tag === "Delegated"
    ? { key: s.values[0], kind: "delegated", weight: weightFor(s.values[0]) }
    : {
        key: s.values[1].toString("hex"),
        // compare the verifier address with the one you configured
        kind: isWebAuthnVerifier(s.values[0]) ? "passkey" : "ed25519",
        weight: weightFor(s.values[1].toString("hex")),
      },
);

// weightFor() reads the threshold policy state; never default it to 1.
```

The rule gives you the signer set and the expiry; the policy client gives you
the weights. If either source is missing, the honest result is `NOT_CHECKED`,
not a pass.

## Where this belongs

- A short subsection in `packages/accounts/README.md` naming the fields above
  and pointing at `get_context_rule` and the policy state — that is the doc
  snippet.
- The producer (reading RPC, listing rules, reading policy state) belongs in
  `stellar/smart-account-kit`, which already owns those calls, not in the
  contract repository and not duplicated here.
