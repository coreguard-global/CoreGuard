# Three outreach drafts — wallet, anchor, x402

Prepared from the venue rules in [`OUTREACH-TARGETS-2026-11-26.md`](../OUTREACH-TARGETS-2026-11-26.md). **None of these has been sent.**

Rules applied to all three:

- The first line discloses that the sender maintains CoreGuard.
- Each names one concrete, redacted payload and asks for exactly one action.
- No tool count, no adoption claim, no "partnership", no ask for a review.
- If the answer is "not relevant", the thread ends; no follow-up.

Replace every `<…>` placeholder. Do not send until the redaction step in the checklist at the bottom is done.

---

## 1. Wallet (signing gate)

**Subject / first line:** Maintainer of CoreGuard here — one question about your pre-sign screen

**Body:**

I maintain CoreGuard, an offline verification toolkit, so treat this as a vendor question rather than a user report.

The gap I keep seeing in wallet flows is not signature validation; it is that the envelope a user signs can drift from what the approval screen showed — destination, memo prefix, asset issuer, or the time window — and nothing names the drift afterwards.

**The payload I would like to run:** one redacted pre-sign payload from your flow, in either shape:

- the envelope XDR (testnet is fine), plus
- the approval record the user actually saw: destination, amount, asset code and issuer, memo, and the expiry the UI displayed.

Redact keys, seed phrases, balances and any identifying address; a testnet or synthetic envelope is enough. I do not need your signing key and I am not asking for access to your systems.

**What you get back:** a written gap list naming the exact checks that failed, for example `MEMO_PREFIX_MISMATCH`, `NOT_EXPIRED` on an expired window, `NO_CONFUSABLE` on a lookalike asset code, or `DESTINATION_DRIFT` in an operation-set comparison — produced by tools that never sign, never broadcast and never contact the network. If everything matches, I will say that too, and the list will be empty.

**One step:** reply with that one redacted payload (or "not relevant" and I will close the thread).

**Boundary:** `VERIFIED ≠ SAFE`. A pass means the bytes matched the approval, not that the payment is safe, settled, or that the counterparty is honest. I am not claiming any integration with your wallet, and I will not describe this as a partnership.

---

## 2. Anchor (SEP-10 / SEP-24 evidence)

**Subject / first line:** Maintainer of CoreGuard — one redacted SEP-24 record for an offline check

**Body:**

I maintain CoreGuard, an offline verification toolkit; this is a vendor question, not a support request.

Anchors usually have the SEP-10 challenge and the SEP-24 transaction record, but the fields are checked by hand or not at all: memo binding, `amountIn` versus `amountOut`, asset code versus the quoted asset, status versus the presence of a Stellar transaction id, and whether the quote has already expired at the moment of review.

**The payload I would like to run:** one redacted SEP-24 deposit or withdrawal record — `transactionId`, `kind`, `status`, `amountIn`, `amountOut`, `assetCode`, `fee`, `quoteId`, `memo`, `stellarTransactionId`, and the UTC time you reviewed it — plus, if you have it, the SEP-10 challenge your server issued. Redact account addresses, customer data and any credential; a completed testnet transaction is ideal.

**What you get back:** a per-field result with named checks (`STATUS`, `FINAL`, `ASSET`, `AMOUNTS`, `MIN_OUT`, `FEE`, `QUOTE`, `EXPIRY` for the anchor record; `HOME_DOMAIN`, `WEB_AUTH_DOMAIN`, `SERVER_KEY`, `NETWORK`, `NONCE`, `TIME_BOUNDS`, `CLIENT_DOMAIN`, `OPERATIONS` for the challenge), and a short list of fields that are ambiguous or missing in your record. It is deterministic and offline; nothing is fetched from your domain.

**One step:** reply with that one redacted record (or "not relevant" and I will close the thread).

**Boundary:** a pass is field-consistency, not anchor trust, solvency, licensing or regulatory approval. I am not claiming an integration, a customer relationship or an endorsement, and I will not publish your payload or your name without written permission.

---

## 3. x402 / facilitator (settlement evidence)

**Subject / first line:** Maintainer of CoreGuard — does your facilitator response survive a chain-evidence check?

**Body:**

I maintain CoreGuard, an offline verification toolkit; this is a technical question about settlement evidence, not a pitch.

In x402 flows the facilitator's response is usually treated as the source of truth: `success: true` plus a transaction reference. That is a claim, not evidence. If the response omits the network, the asset, the amount actually transferred or the payer, a caller cannot distinguish "settled" from "the facilitator said so".

**The payload I would like to run:** one facilitator settlement JSON (redacted addresses are fine), with the fields you return — status flag, transaction reference or hash, network, asset, amount, payer/payee, timestamp — and, if your API exposes it, the corresponding on-chain transaction fields. A testnet settlement is enough; no API key.

**What you get back:** a mapping of your response into a settlement-evidence object and a verdict per field. The useful outcome is the one I expect: if chain evidence is absent, the result is `NOT_CHECKED`, not `VERIFIED`. If your response already carries enough to verify independently, the result is `VERIFIED` and I will say which fields made the difference.

**One step:** reply with that one redacted settlement JSON (or "not relevant" and I will close the thread).

**Boundary:** I do not run a facilitator, hold keys, or broadcast. `VERIFIED ≠ SAFE`; this checks consistency between your response and supplied evidence, not finality or counterparty honesty. No integration or partnership is claimed, and I will not describe your service as "supported".

---

## Pre-send checklist (do this for every draft)

- [ ] Replace the disclosure line so it is literally true and first in the message.
- [ ] Redact: keys, seeds, customer identifiers, account addresses that identify a person, API keys, balances.
- [ ] Confirm the payload is one item, not a request for repository access or a call.
- [ ] Confirm the ask is exactly one step and that "not relevant" has an exit.
- [ ] Do not attach a tool count, a badge, a screenshot, or a link to a listing.
- [ ] Send from the maintainer account, once, in one venue. No cross-posting.
