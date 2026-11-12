# CoreGuard x Freighter — Pre-sign Authorization Receipts (PSAR/1)

**Technical Integration Proposal · 2026-11-12**

> **Status of this document.** This is a PROPOSAL for a scoped technical
> evaluation — not an integration, not an endorsement, not an announcement.
> The repo's own machine registry (`docs/surface-status.json`) records this
> surface as code `BUILT` · execution `TEST_EXECUTED` · integration
> `NOT_BUILT`, and no Freighter code, UI, or release incorporates any of it.
> It is written for the discussion in
> [`stellar/freighter` issue #3087](https://github.com/stellar/freighter/issues/3087),
> where a maintainer asked what concrete value a Freighter user would get.

---

## 1. The user experience being proposed (30 seconds, illustrative)

A dApp or an AI agent asks the user to approve a payment. Before the signing
prompt, the authorization passes verification and a receipt is issued. At the
prompt, Freighter verifies the receipt itself and shows the result beside its
own transaction details:

| Field | Verified receipt |
|---|---|
| Verdict | `PASS` — authorization receipt verifies |
| Bound transaction | Exact XDR fingerprint match |
| Network | Match (receipt was issued for this network) |
| Policy | Match (the amount/destination the user agreed to) |
| Issuer | Signature verifies against the pinned public key |
| Execution | `NOT_INCLUDED` — nothing executed yet |

If the transaction bytes change after the approval (amount 100 -> 500, a
swapped destination, an edited fee):

| Field | Tampered transaction |
|---|---|
| Verdict | `BLOCK` — `XDR_BINDING_MISMATCH` |
| Meaning | The transaction about to be signed is NOT the transaction the receipt was issued for |

**The user still reviews the transaction and still decides whether to sign.**
This layer does not replace Freighter's judgment or its UI; it adds one
verifiable fact Freighter currently cannot get from a dApp: that the bytes in
front of the user are the exact bytes a specific authorization was verified
against, re-derived locally from cryptographic material rather than from a
verdict string, an image, or the dApp's claim.

## 2. What Freighter already has — and where the gap is

Freighter already renders full transaction details and ships risk scanning
(Blockaid-style warnings and transaction simulation). This proposal replaces
none of it. The honest gap is different:

- Those capabilities answer **"does this transaction look risky?"** at signing
  time. They are not a **binding** between a specific authorization decision
  and the exact bytes about to be signed.
- If the XDR is swapped or edited between the approval and the signing prompt,
  a simulation of the *new* bytes can still look clean. The user approved one
  transaction; a different one is on the screen.
- PSAR/1 closes exactly that: a receipt binds `authorization decision <->
  exact XDR bytes <-> policy <-> network <-> validity window`, and the wallet
  re-derives the whole decision itself — sha256 over canonical JSON plus an
  Ed25519 signature checked against a pinned issuer public key. No CoreGuard
  server is in the verification path.

## 3. The separation that matters: pre-sign receipt ≠ execution proof

Every verdict this module emits carries `executionProof: "NOT_INCLUDED"`. A
pre-sign receipt proves that an authorization was verified before signing —
it never proves that anything executed. Execution evidence comes from the
ledger after submission (read-back), which is a separate, later artifact. No
pre-sign receipt in this repo ever reads as "the payment happened".

## 4. The contract, as shipped (fail-closed by construction)

- **Two decisions only**: `PASS` and `BLOCK`. There is no soft pass.
- **Frozen reject codes**: `MALFORMED_RECEIPT`, `MALFORMED_INPUT`,
  `BAD_DIGEST`, `BAD_SIGNATURE`, `XDR_BINDING_MISMATCH`, `NETWORK_MISMATCH`,
  `POLICY_MISMATCH`, `NOT_YET_VALID`, `RECEIPT_EXPIRED`, `VERIFIER_ERROR`.
- **Byte-exact binding**: the receipt carries sha256 over the exact XDR
  string. One appended byte, one changed stroop, one swapped destination
  invalidates it.
- **Closed shape**: the receipt field set is fixed; unknown fields are a
  rejection, not decoration.
- **Issuer-bound**: Ed25519 signature over canonical (sorted-key, no
  whitespace) JSON, verified against a pinned 32-byte public key. A receipt
  signed by any other key BLOCKs.
- **Windowed**: `issuedAt` / `expiresAt` with an injected clock —
  `NOT_YET_VALID` before the window, `RECEIPT_EXPIRED` at and after it.
- **Verifier error is a BLOCK**: an internal failure returns
  `VERIFIER_ERROR` and can never surface as a pass.
- **Known-answer vectors are committed**: issuer public key, XDR fingerprint
  and receipt digest for a fixed input world are pinned in the test file, so
  any engineer can re-derive every byte offline.

## 5. What exists today (committed, offline, test-executed)

- `packages/stellar/presign.mjs` — the PSAR/1 module
  (`coreguard.psar/1`).
- `test/integrations/stellar-presign.test.mjs` — the contract battery:
  known-answer vectors, the fail-closed set, canonical binding, malformed
  shapes, deterministic re-issue.
- `examples/stellar-presign/demo.mjs` — the offline arc (next section).
- What does **not** exist: any wallet embedding, any pilot, any external
  adopter. The repo's registries state external adoption as zero
  mechanically (`docs/surface-status.json`, `docs/claims-registry.json`) —
  this proposal is the first step being offered to change that, and until a
  wallet ships something, the label stays `NOT_BUILT`.

## 6. Try it offline in one command

```bash
npm run stellar:presign
```

No signing, no wallet, no network. The arc, as printed:

1. Builds a **real unsigned Stellar payment envelope** (AGENT-XDR/1, offline,
   via the Stellar SDK) — 10 XLM, testnet passphrase.
2. Issues a PSAR/1 receipt bound to that envelope's exact bytes.
3. Verifies the envelope it was issued for -> `PASS`.
4. Builds the tampered envelope (amount changed to 500) and verifies ->
   `BLOCK` / `XDR_BINDING_MISMATCH`.
5. Advances the injected clock past the receipt window -> `BLOCK` /
   `RECEIPT_EXPIRED`.

The decisions are deterministic. The digests vary run to run because a
Stellar envelope carries timeBounds derived from the wall clock — the binding
property is what does not vary: change one byte and the receipt stops
verifying for it.

## 7. The scoped integration being asked for

A technical evaluation of five points — a reading, not a merge request:

1. **Read** a PSAR/1 receipt at the signing prompt (delivered by the dApp
   with its XDR, or held locally after an approval step).
2. **Verify it locally**: canonical bytes -> digest -> Ed25519 signature
   against the pinned issuer key -> exact-XDR binding -> network -> policy ->
   window. All of it runs in the wallet, offline, in milliseconds.
3. **Display** the result beside Freighter's existing transaction details —
   as one more verified fact, not a replacement for anything.
4. **Block signing** when the verdict is `BLOCK` or verification fails — with
   fail-closed semantics: a broken or missing verification is a BLOCK, never
   a pass.
5. **Keep the boundaries**: no key handling changes (the receipt never
   touches wallet keys), no trust in the dApp's presentation of the verdict.

Open questions only the Freighter team can answer: where the receipt should
come from at signing time (dApp-supplied field vs. wallet-held approval
state); how the pinned issuer key(s) are provisioned and what issuer policy
means for trust; UX placement next to existing detail rendering and risk
scanning; and whether this starts dApp-opt-in or wallet-level.

## 8. What this closes, and what it does not

**Closes**: a swapped or edited XDR between approval and signing prompt; a
receipt presented for the wrong network; policy drift (the enforced amount
not being the approved amount); silent receipt tampering; verifier errors
surfacing as passes.

**Does not close**: a user deceived into approving a bad transaction in the
first place (the receipt binds bytes to a decision, not judgment); proof that
anything executed (ledger read-back does that); compromise of the issuer key
(whoever holds it can issue receipts — which is why the issuer is a service
whose key the verifier pins, and why the wallet shows the issuer it verified
against).

## 9. References (facts only)

- [`stellar/freighter` issue #3087](https://github.com/stellar/freighter/issues/3087)
  — the discussion that prompted this proposal, including the maintainer's
  question about concrete user value.
- `docs/surface-status.json` — the three-axis registry (code / execution /
  integration) this repo is bound to; external adopters: none, stated
  mechanically.
- `docs/STATUS.md` — the repo's measured single source of truth.
- No partnership, adoption, pilot, or endorsement is claimed or implied
  anywhere in this document. The only integration status asserted is the
  registry's own: `integration: NOT_BUILT`.
