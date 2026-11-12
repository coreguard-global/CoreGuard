# PSAR/1 - critical security self-review (2026-11-12)

Scope of this review: `packages/stellar/presign.mjs` (`coreguard.psar/1`) and
its contract battery `test/integrations/stellar-presign.test.mjs`. The review
answers the three questions that must be answered before the feature is shown
to an external wallet team, line-referenced, and it names what PSAR/1 does
NOT cover as deliberately as what it covers. Nothing here is a claim of
external review; this is the project's own critical self-review, written to be
checked against the code.

Reading rule for this document: every line reference points at the committed
module. The verification commands at the end reproduce every behavioral claim
from a fresh clone.

## Q1 - Can an untrusted party forge a PASS?

**Answer: no, not without the issuer's Ed25519 private key - and the XDR
binding alone is deliberately not the identity. The identity is the
signature.**

A receipt is exactly `{...ADR fields, digest, signature}`:

- The ADR is eight canonical fields: `v, scope, network, xdrFingerprint,
  policy, issuedAt, expiresAt, issuer` (module lines 167-176).
- `digest` = sha256 over the canonical (sorted-key, no-whitespace) JSON of
  those fields (line 177-178).
- `signature` = Ed25519 by the issuer over the SAME canonical bytes - the
  digest's preimage (line 181). The issuer is accepted only as
  `{ publicKeyHex, sign(bytes) }`; the factory never exposes the private key
  (lines 161-163, 140-148).

Verification re-derives everything rather than trusting the receipt's word:

1. **Digest self-consistency** - the verifier recomputes sha256 over the
   canonical ADR fields and rejects a receipt that disagrees with itself
   (`BAD_DIGEST`, verify step 1, lines 233-239). Any field the attacker edits
   dies here first.
2. **Signature against the PINNED key** - Ed25519 verify over the same
   canonical bytes with the caller-pinned 32-byte public key
   (`BAD_SIGNATURE`, verify step 2, lines 241-256). A receipt whose digest
   AND signature were both rebuilt still dies here, because rebuilding a
   valid signature requires the private key. A signature by a DIFFERENT
   issuer dies against the pin (test at test lines 193-199).

So: forging a PASS requires the issuer private key. An attacker can change
the transaction, the network, the policy, the window - every path lands in a
named BLOCK (`XDR_BINDING_MISMATCH`, `NETWORK_MISMATCH`, `POLICY_MISMATCH`,
`NOT_YET_VALID`, `RECEIPT_EXPIRED`).

**The open trust decision this design names explicitly: key distribution.**
The verifier REQUIRES the pinned issuer public key as caller input
(lines 230-231); the module does not tell the wallet which key to trust. In
production the issuer is the verification service the project owner runs
(module header lines 24-28), and the wallet must learn that service's public
key through a channel it already trusts (the wallet's own update/config
surface) - never from the DApp that wants to be approved. Consequences named
honestly:

- A rogue DApp cannot mint receipts.
- A compromised or mis-pinned issuer key CAN issue malicious receipts - the
  pin channel is the trust root, and pinning is a wallet-integration
  decision, not something PSAR/1 can do for the wallet.
- There is no `keyId` field in v1: rotation means the wallet re-pins; a
  receipt signed by a rotated-out key then verifies `BAD_SIGNATURE` against
  the new pin (fail-closed, safe direction).
- `createInMemoryIssuer` is a DEMO/DEV-only stand-in with a public seed
  (lines 120-126); it exists so the offline demo and known-answer vectors are
  deterministic. It must never be the production issuer, and no production
  key material lives in the repo, a client, or a wallet.

## Q2 - Does verification inspect transaction semantics, or only bytes?

**Answer: only bytes (plus receipt structure). Matching is not meaning, and
the module does not pretend otherwise.**

What verify actually does, in order (lines 204-291): shape-close the receipt
(unknown fields rejected, lines 206-211), then (1) digest self-consistency,
(2) Ed25519 signature, (3) sha256 over the EXACT utf8 XDR string
(`fingerprintXdr`, lines 95-97; compare at line 260), (4) network-string
equality between the receipt's network and the caller's signing context
(line 265), (5) canonical-JSON equality between the policy the verifier
passes and the receipt's policy (line 270), (6) the time window (lines
275-276).

What it does NOT do: it does not decode the XDR. It never inspects
operations, amounts, assets, sources, or the envelope's own network byte.
Step 4 compares two network CLAIMS (the receipt's and the caller's); it does
not decode the transaction to learn its network.

This is deliberate and its honesty boundary is this: **the semantic judgment
happened at issuance time** (the issuer evaluated the transaction before
signing the receipt), **and the wallet retains its own inspection at signing
time**. PSAR/1 adds one layer neither of those provides alone: the proof that
the decision the issuer made is still bound to the exact bytes now on the
signing prompt - that nothing swapped, appended, or drifted between approval
and signing. A receipt can faithfully bind a BAD decision if the issuer was
fooled: PSAR/1 guarantees approval-intactness, not approval-wisdom. It does
not replace Soroban authorization or wallet risk scanners; it binds bytes to
a decision, not judgment (module header lines 21-22, 37-39).

The Freighter-facing consequence, stated plainly: a wallet adopting PSAR/1
should KEEP its existing transaction inspection; the receipt answers the
different question "is what I am about to sign the thing that was authorized,
by the issuer I pinned, inside its window".

## Q3 - Replay, clock skew, policy change?

**Replay for a different transaction: structurally impossible.** The binding
is byte-exact (step 3). One appended byte, one changed stroop, one different
destination - a different envelope cannot ride an old receipt
(`XDR_BINDING_MISMATCH`; tests at test lines 133-144).

**Replay of the same receipt for the same envelope inside the window:
allowed by design.** Verification is stateless - there is no nonce and no
one-time-use ledger in v1. This is a named boundary, not an accident:

- the real-world mitigation is Stellar's own sequence number - re-submitting
  the identical envelope fails at the ledger as `txBadSeq`, so the same
  receipt cannot drive a second ledger effect;
- the design cost is that approval is not revocable mid-window: an issuer who
  changes their mind before `expiresAt` has no v1 mechanism to un-PASS a
  receipt. Short TTLs (default 600s at issue, line 156) bound the exposure;
- a revocation lookup or a nonce/one-time-use ledger is a PSAR/2 candidate
  and is NOT_BUILT today.

**Clock skew: the module never reads a wall clock.** `nowSeconds` is caller
injected and mandatory (line 225; `MALFORMED_INPUT` otherwise). Issuer-clock
vs verifier-clock skew therefore misbehaves only in the safe direction: a
verifier clock behind `issuedAt` BLOCKs (`NOT_YET_VALID`), a verifier clock
past `expiresAt` BLOCKs (`RECEIPT_EXPIRED`) - skew can cost availability,
never correctness; it cannot produce a false PASS. For integrations, the
issuer should stamp `issuedAt` with a small negative tolerance (for example
60s) when cross-party skew is expected; that is an integration-document
concern, named in the proposal.

**The window is the issuer's own stamps** (lines 173-174, 275-276): a
malicious or compromised issuer can stamp a long window. That is the Q1
trust problem (pin a trustworthy issuer), not a clock problem, and it is
named here so nobody reads the window check as a defense against a bad
issuer.

**Policy change: the wallet is the enforcement point, by design.** Verify
compares the policy the VERIFIER passes against the receipt's policy,
canonically (step 5, line 270; tests at test lines 152-163). The wallet
passes the policy it is enforcing NOW. A receipt issued under a
since-changed policy BLOCKs with `POLICY_MISMATCH` when verified against the
current policy - the wallet never has to accept an old policy by trusting the
receipt. A stale receipt PASSes only if the verifier itself passes the stale
policy, so policy pinning stays the caller's responsibility and the module
says so (`MALFORMED_INPUT` if the verifier passes no usable policy, lines
228-229).

## The test battery, mapped to threats

The battery is `test/integrations/stellar-presign.test.mjs`, 27 tests. The
map from threat to named tests:

| Threat | Where it dies | Tests |
| --- | --- | --- |
| Receipt edited (any ADR field) | `BAD_DIGEST` (step 1) | "an edited digest BLOCKs" (185-191); digest re-derived independently (234-241); known-answer field set (110-121) |
| Forged signature / wrong issuer | `BAD_SIGNATURE` (step 2) | "a flipped signature byte BLOCKs" (177-183); "a signature made by a DIFFERENT issuer" (193-199) |
| Transaction swapped/tampered | `XDR_BINDING_MISMATCH` (step 3) | "one appended byte" (133-138); "edited transaction, same length" (139-144) |
| Wrong network | `NETWORK_MISMATCH` (step 4) | "a different network BLOCKs even for byte-identical XDR" (146-150) |
| Policy drift | `POLICY_MISMATCH` (step 5) | "an altered policy BLOCKs" (152-156); canonical key equality (158-163) |
| Time attacks | `NOT_YET_VALID` / `RECEIPT_EXPIRED` (step 6) | expiry with exclusive boundary (165-169); pre-issuance check (171-175) |
| Shape games | `MALFORMED_RECEIPT` | unknown fields (201-206); missing field + wrong version (208-215) |
| Caller misuse | `MALFORMED_INPUT` | malformed input BLOCKs by name (217-224) |
| Broken verifier | `VERIFIER_ERROR` (fail-closed catch) | "a broken pinned key BLOCKs, verify() never throws" (226-232) |
| Non-determinism | byte-deterministic re-issue | same digest + same signature on identical inputs (244-249) |
| Policy typing games | amounts ride strings | `normalizePolicy` refuses non-strings (251-256) |
| Demo drift | the docs-cited demo must run | import-shape check (258-263) + the docs-node contract executes `npm run stellar:presign` on every push |

Every BLOCK above is fail-closed: an exception inside the verifier is itself
a named BLOCK (`VERIFIER_ERROR`, lines 281-286) - a broken verifier can never
surface a pass.

## What PSAR/1 does not cover (named, not hidden)

1. It does not judge whether an authorization is wise or whether the user
   was deceived into granting it - it binds bytes to a decision, not judgment.
2. It does not prove execution. Every verdict carries
   `executionProof: "NOT_INCLUDED"`; execution evidence comes from ledger
   read-back after submission.
3. It does not distribute, rotate, or revoke the issuer key. Pinning is the
   wallet's integration decision; revocation is NOT_BUILT in v1.
4. It does not inspect transaction semantics - the issuer (and the wallet's
   existing inspection) own that; PSAR/1 owns decision-to-bytes binding.
5. It does not protect against a compromised or mis-pinned issuer key; the
   authenticated pin channel is the trust root.
6. It does not read the network, submit transactions, or sequence anything -
   it is offline by design.

## Reproduce every behavioral claim

```text
npm install
npm run stellar:presign
node --test test/integrations/stellar-presign.test.mjs
```

The demo prints the arc (PASS, then the tampered amount BLOCK, then the
lapsed-window BLOCK) and exits 0 only if every guarantee held; the test file
re-runs the battery in seconds. The module's own `selfCheck()` re-runs the
issue/verify/tamper/expire cycle in-memory.

Status labels this review operates under (and that the registries enforce):
code BUILT, execution TEST_EXECUTED, wallet integration NOT_BUILT, external
adoption zero until a wallet ships it.
