# Developer quickstart — authorization, firewall, proof

The promise of this page is small and testable: **a developer integrates
CoreGuard without learning the protocol catalogue.** Three calls, one artifact,
no keys, no network.

Everything below runs offline against committed code. `npm run trust:demo` is
the executable version of this page; if it stops passing, this page is wrong and
CI says so.

## 0 · Setup

Clone, then one install and one command — `npm install` followed by `npm run trust:demo`. Nothing else: no API key, no RPC URL, no faucet.

You should see four pillars, three refusals with named codes, and one receipt
digest. That output is the product.

## 1 · The surface, in three calls

Three imports from `@coreguard/stellar-presign` are the whole surface:
`createInMemoryIssuer` (the demo issuer — in production, your own signer),
`issueAuthorizationReceipt` (pillar 1: bind authorization to bytes), and
`verifyAuthorizationReceipt` (pillars 2 + 3: enforce, with a named reason).

| Call | Input | Output |
|---|---|---|
| `issueAuthorizationReceipt({ network, xdr, policy, issuer, nowSeconds, ttlSeconds })` | the exact unsigned envelope string, a string-only policy, an injected clock | a receipt `{ v, scope, network, xdrFingerprint, policy, issuedAt, expiresAt, issuer, digest, signature }` |
| `verifyAuthorizationReceipt({ receipt, xdr, network, policy, nowSeconds, issuerPublicKey })` | the receipt, the bytes about to be signed, the pinned issuer public key | `{ decision: "PASS" \| "BLOCK", code, reasons, executionProof: "NOT_INCLUDED" }` |
| `npm run trust:verify -- <dir>` | receipt + envelope + public key | exit `0` PASS · `2` BLOCK |

Two design rules the API forces, on purpose:

- **Time is an argument.** No function reads `Date`. You pass `nowSeconds`, so a
  test is deterministic and an auditor can replay the exact decision.
- **Amounts are strings.** A float that loses precision before it is signed is
  a bug we refuse to have.

## 2 · What the codes mean when it refuses

`BLOCK` always carries a code from a frozen list (11 entries today). The ones an
integrator meets first:

| Code | Means | What to do |
|---|---|---|
| `XDR_BINDING_MISMATCH` | the bytes are not the ones the receipt was issued for | refuse; do not re-issue silently |
| `RECEIPT_EXPIRED` | the authorization window closed | ask the user again; do not extend the window yourself |
| `BAD_SIGNATURE` / `ISSUER_MISMATCH` | the receipt was not signed by the pinned issuer | treat as hostile input |
| `MALFORMED_RECEIPT` / `MALFORMED_INPUT` | shape violation, including unknown fields | fail closed, log the raw input |
| `POLICY_*` | the transaction violates the authorized policy | surface the specific field that failed |

The full list is exported as `REJECT_CODES` so your UI can never invent a
thirteenth reason.

## 3 · Make it a proof, not a log line

A receipt is only evidence if someone else can check it. Hand a reviewer three
files — `receipt.json`, `envelope.txt`, and the issuer's public key — and the
verifier in this repo returns the same verdict with no network access and no
secret.

That is the difference between "our server said no" and "you can see it
yourself". It is also what you should send a prospective partner on day one:
a receipt they can break.

## 4 · Cost and effort

| Question | Today's answer |
|---|---|
| Time to first verdict | the demo runs in seconds; an integration against your own envelope is the three calls above |
| Runtime dependencies | Node 20+; `@stellar/stellar-sdk` only for building envelopes |
| Network calls | none for authorization, enforcement, or verification |
| Secrets you must hold | the issuer's private key — and only where receipts are issued |
| Price | usage-based per verified receipt, free tier sized for integration tests; model in `docs/pricing.md`, enterprise pack in `docs/SCF-BUILD-APPLICATION-V3.md` §M4 |

## 5 · What this does not do yet

- **No real Freighter extension path in CI.** The adapter exists; the extension
  signature is not exercised, and no document may claim otherwise.
- **No SDK package published under a stable name yet.** The imports above are
  the in-repo modules; M1 of the funding plan publishes them.
- **No execution proof in the receipt.** By design: `executionProof` is always
  `NOT_INCLUDED`; the ledger read-back proves execution, separately.

If your integration needs any of those three today, it is not ready for you —
and saying so here is cheaper than discovering it in your audit.
