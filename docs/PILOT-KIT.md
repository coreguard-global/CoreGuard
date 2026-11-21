# Pilot kit — two weeks, one artifact a stranger can verify

This is the document you send to a Stellar team (a DEX/AMM, or a team running
AI agents that move money). It fixes the scope, the split of work, the success
criteria, and the exact artifact the pilot produces. It does not promise
safety, detection, or endorsement — those are not what is being tested.

**One sentence:** for two weeks, your transactions run through CoreGuard's
authorization and firewall; you keep a bundle of receipts that anyone — your
auditor, your investor, a stranger with the CLI — can re-verify offline.

**To send it:** [PILOT-SOW.md](PILOT-SOW.md) is the contract-shaped version —
scope, frozen success criteria, obligations, exit and publication terms, with the
five lines a partner replies with instead of a call. [PILOT-REPORT-TEMPLATE.md](PILOT-REPORT-TEMPLATE.md)
is the report both sides sign at the read-out, failures included.

## 1 · Scope (10 working days, one flow)

| Days | What happens | Who |
|---|---|---|
| 1–2 | Pick **one** flow (e.g. a swap above a size threshold, or an agent paying an invoice). Capture the exact unsigned envelope and the fields your policy would allow. | joint, 2h call + async |
| 3–5 | Wire `issueAuthorizationReceipt` + `verifyAuthorizationReceipt` around that one flow behind a flag. Nothing else in your app changes. | you, we review |
| 6–8 | Run the firewall against real and adversarial cases: amount change, destination swap, expired window, wrong network, replayed receipt. | joint |
| 9–10 | Produce the bundle (below), run the third-party verifier on a machine without our repo, write the report. | us |
| 11–14 | Read-out, go/no-go, and a written decision on what a second phase would cover. | joint |

Out of scope by design: contract audits, key management, custody, changing your
product's UX, and any claim that a `PASS` means a transaction is safe.

## 2 · What we give

- A branch/PR against your repo, small enough to review in one sitting, with
  the integration behind a feature flag (removable in one commit).
- The offline demo retargeted to *your* flow, so your team can run the whole
  arc without our servers or yours.
- **The artifact bundle** (`pilot/<date>/`): `receipt.json`, `envelope.txt`,
  `issuer.json` (public key only), `transcript.json`, and `pilot-report.md`.
- The third-party verifier: `node examples/execution-trust/verify-third-party.mjs <dir>`
  — exit `0` PASS, `2` BLOCK, verdict on one line. It imports the verification
  function and *nothing else*: no issuer factory, no network, no secret.
- A written report with the numbers, **including the cases that did not work**.
- 30 days of integration support after the read-out.

## 3 · What we need from you

| Item | Why | Size |
|---|---|---|
| One engineer, named | the flag and the envelope capture are theirs | ~4h/week |
| The unsigned envelope of the chosen flow, plus the policy you would actually set | a receipt without exact bytes proves nothing | 1 file |
| 20–200 historical or testnet transactions | the report needs a denominator, not one happy path | export or testnet run |
| A decision-maker in the read-out | the pilot ends in go/no-go, not a demo | 1h |
| Permission to publish the report with numbers | an unpublished pilot is not evidence | written yes |

We accept an NDA on volumes and addresses. We do not accept one on the
verdicts: a pilot that cannot be cited does not count as adoption for either of
us. No secrets of yours ever reach us — the issuer key stays on your side, and
a secret key in an artifact is a stop-the-line defect.

## 4 · Success criteria (measurable, checked at read-out)

| # | Criterion | Threshold | How it is measured |
|---|---|---|---|
| 1 | Time to first verdict in *your* repo | ≤ 15 minutes from clone to a `PASS`/`BLOCK` | wall clock, recorded by you |
| 2 | Receipts that verify outside our repo | ≥ 95% of sampled transactions | `verify-third-party.mjs` run by you, on your machine |
| 3 | Tampered cases refused by name | 100% (amount, destination, window, network, replay) | transcript table, one row per case |
| 4 | Determinism | the same inputs produce the same receipt digest across two runs | two runs, digest compared |
| 5 | Your engineering time | ≤ 2 engineer-days total | your timesheet |
| 6 | Diff surface | integration touches ≤ 1 file outside the flag + tests | `git diff --stat` |
| 7 | Secret hygiene | 0 secrets in the bundle | the verifier refuses a key-shaped input; we also grep the bundle |

A pilot that hits 1–4 and misses 6 is a pass with a finding — we publish the
finding. A pilot that misses 2 does not count as a pilot.

## 5 · The artifact (what actually exists at the end)

`pilot/<date>/` contains five files and nothing else:

- `envelope.txt` — the exact unsigned envelope string that was authorized.
- `receipt.json` — PSAR/1: `xdrFingerprint`, policy, `issuedAt`/`expiresAt`,
  issuer public key, `digest`, `signature`, and `executionProof: NOT_INCLUDED`.
- `issuer.json` — the issuer's **public** key; the private one never leaves you.
- `transcript.json` — every verdict with its code (`PASS`,
  `XDR_BINDING_MISMATCH`, `RECEIPT_EXPIRED`, `BAD_DIGEST`, …), the envelope
  hash, and the list of refusals.
- `pilot-report.md` — the criteria table above, filled in, signed by both sides.

Re-verification, on a machine that only has Node and the three files:
`node examples/execution-trust/verify-third-party.mjs pilot/<date> --at=<unixSeconds>`.
That command is the deliverable. Anything that cannot be checked by it is a
claim, not evidence.

The same artifact has a browser face for the people who will never install
Node: [verify.html](verify.html) opens a `#v1.<base64url>` bundle and re-derives
the verdict in the tab — WebCrypto SHA-256 + Ed25519, no network, no build step,
and the fragment is never sent anywhere. `scripts/make-verify-link.mjs` writes
that fragment from a pilot directory, and the page's verdict is pinned to the
Node verifier's by a test, so the two cannot drift apart silently.

## 6 · What this pilot does not establish

- Not that a transaction is **safe**: `VERIFIED ≠ SAFE`. It proves conformance
  to the policy you wrote, and nothing about the counterparty's intent.
- Not **execution**: a pre-sign receipt says `executionProof: NOT_INCLUDED`.
  Execution proof is the ledger read-back, and the pilot states separately
  whether it was performed.
- Not **detection**: CoreGuard does not model malicious contracts. If you need
  that, pair it with a simulator or a threat-intel vendor and feed their verdict
  into the policy.
- Not **adoption**. One pilot is one data point. It becomes credible when the
  report is public and the flag is still on a quarter later.

## 7 · After the pilot

Two outcomes, both written:

- **Go:** second phase scoped (a second flow, or execution read-back on chain),
  and commercial terms agreed per engagement — this kit fixes scope and success
  criteria, not price.
- **No-go:** the report says why, in the same table, and the branch is deleted
  by you. We do not keep a copy of your envelopes.

Either way the numbers enter `docs/EVIDENCE-MATRIX.md`: external adoption stays
`NOT_BUILT` until a team other than the founder has run this and said so in
public.
