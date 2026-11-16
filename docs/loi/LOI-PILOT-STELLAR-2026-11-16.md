# Letter of intent — 30-day verification pilot (draft)

**Status: DRAFT — NOT SENT — NOT SIGNED.** The counterparty is unnamed because
naming one before they answer would be a fabricated artifact. This text is the
instrument to be sent to a single wallet, DEX, anchor, or agent platform on
Stellar.

**From:** CoreGuard (CoreGuard Global) — a verification layer that sits *in front
of* signing, never inside the protocol.
**To:** ______________________ (one party, named at send time).
**Date of draft:** 2026-11-16.

---

## 1. The ask, in one sentence

Put CoreGuard's gate in front of **one** signing path for **30 days**, on
testnet, at **zero cost**, and at the end state in one line whether it stayed in
the path and whether it ever blocked something you wanted.

That is the entire commitment being requested. No procurement, no integration
project, no exclusivity, no token.

## 2. Why this is cheap for you to say yes to

- **It runs offline.** The gate's evaluation, the envelope construction, and the
  receipt verification all run on committed fixtures with no network call; the
  signing legs are yours, and they are the only part that touches keys.
- **Nothing is installed in your critical path.** The pilot wraps a testnet
  signing call you already make; production keys never enter the pilot.
- **There is working sample code for both ends.** A wallet-side adapter and a
  DEX-side offline verifier already run against committed vectors, so the pilot
  starts from a green path rather than a blank file:

```text
node --test test/integrations/stellar.test.mjs
node --test test/integrations/stellar-soroban.test.mjs
node --test test/integrations/stellar-package-import.test.mjs
node examples/stellar-dex-integration/verify-offline.mjs
```

  The last command ends with `OFFLINE VERIFICATION PASSED` and verifies the
  Soroban commitment-anchor plan step by step; the suites above are owned by CI,
  so the state you see locally is the state CI sees.

- **Exit costs you nothing.** Stop on any day; the pilot artifacts are yours to
  keep or discard.

## 3. What CoreGuard commits to

| # | Commitment | Where it lives |
|---|---|---|
| P1 | A one-page configuration for your signing path: which fields are pinned (destination, amount in stroops, asset, source, memo, network), and which are explicitly out of scope | Shipped with the pilot, derived from `docs/AGENT-PAYMENT-GATE.md` |
| P2 | A tamper demonstration on *your* transaction shape: flip one field at a time, show the hash changing and the verdict naming the field | `test/integrations/agent-gate-field-tamper.test.mjs` as the template |
| P3 | A verification report you can recompute yourself, with the exact command and exit codes | `scripts/verify-cli.mjs` (exit `0/2/3/4`) |
| P4 | Fixes for any defect the pilot exposes, disclosed publicly if they affect the semantics — the same way the identity-binding defect in issue #56 was handled | Issue + fix + must-fail test, in that order |
| P5 | No charge, no invoice, no data retention beyond testnet transaction hashes you send us | This letter |

## 4. What CoreGuard asks for, and nothing more

1. **One line, at the end:** whether the gate was in the signing path for the
   pilot period, and whether it blocked anything you wanted to happen. "It was
   in the path and blocked nothing" is a perfectly good outcome and will be
   reported as exactly that.
2. **Permission to say so.** The default is **anonymous** — "a Stellar DEX
   operator, unnamed" — and your name appears only with your written consent.
   A pilot nobody can see still counts as adoption evidence here only if it is
   described honestly, which is why the default is anonymity rather than
   silence.
3. **Testnet transaction hashes** for the transactions the gate saw. Nothing
   else travels.

## 5. What this pilot will not do

- It will not touch mainnet keys, and it will not sign anything on your behalf.
- It will not replace protocol-level authorization: Soroban auth and Stellar's
  own signature checks remain the authority for what a transaction may do. The
  gate is an independent layer *in front of* signing, and the pilot report will
  say so in those words.
- It will not create a commercial relationship, exclusivity, or a right of first
  refusal. If a paid engagement follows, it will be a separate document with its
  own numbers.

## 6. Term

Thirty days from the start date, extendable once by a one-line reply. Either
party ends it at will, with no notice period. Sections 4.2 (consent to be
named), 5 (scope limits) and this section survive the end of the pilot, because
a report must not outlive the consent that allowed it.

## 7. Signatures

| Party | Name | Title | Signature | Date |
|---|---|---|---|---|
| CoreGuard | | | | |
| Counterparty | | | | |

*Draft prepared 2026-11-16. Not sent, not signed, no counterparty named. Until a
signed copy exists and is linked from [`README.md`](README.md), the adoption axis
stays at zero and every document in this repo must keep saying so.*
