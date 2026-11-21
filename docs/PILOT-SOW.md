# Pilot SOW — two weeks, one flow, one artifact

This is the contract-shaped form of the pilot offer. It is written to be **sent,
signed and started without a call**: everything that is normally negotiated on a
call has a stated default here, and §9 lists the only things you must choose.

Read this next to [PILOT-KIT.md](PILOT-KIT.md), which is the technical annex: what
gets built, what the artifact contains, and what the pilot deliberately does not
establish. This document does not restate it.

| | |
|---|---|
| **Provider** | CoreGuard Global ("we") |
| **Partner** | [legal name] ("you") |
| **Term** | 14 working days from the start date you choose (10 working days of work, 4 for read-out and report) |
| **Start** | [date you pick] |
| **SOW version** | v1.0 · [date] — signed copy governs |

## 1 · Scope — one flow, behind a flag

One flow you name, for example a swap above a size threshold or an agent paying
an invoice. We integrate authorization receipts and the execution firewall around
**that flow only**, behind a feature flag that you can remove in one commit.

**In scope:** receipt issuance around the chosen flow; verification that runs on
your machine; an adversarial battery on that flow (amount, destination, window,
network, replay); the artifact bundle; a written report including failures.

**Out of scope by design:** contract audits, key management or custody, your
product's UX, production rollout, load or performance testing, model or agent
behaviour evaluation, and any statement that a `PASS` means a transaction is safe.
We never hold your keys and we have no settlement authority.

## 2 · Success criteria — frozen before day 1

**Annex A** is [PILOT-KIT.md §4](PILOT-KIT.md): seven criteria, each with a
threshold and a named measurement. It is incorporated by reference, signed with
this SOW, and **frozen at signature**. Neither side can redefine a criterion after
the numbers are in; a change requires a signed addendum dated before the affected
measurement.

The decision rule is part of Annex A: hitting criteria 1–4 while missing 6 is a
pass **with a finding**, which we publish; missing criterion 2 means the pilot
does not count as independently evidenced.

## 3 · What we deliver, and when

| By day | Deliverable |
|---|---|
| 2 | Review of your captured envelope and the policy you would actually set |
| 5 | Branch or PR with the integration behind a flag, small enough to review in one sitting |
| 8 | Adversarial transcript, one row per case, refusals named by code |
| 10 | Artifact bundle and the draft report |
| 14 | Read-out, the signed report, and a written go / no-go |
| +30 | Integration support after the read-out (questions, fixes, one follow-up run) |

We hand over no secret material: only public keys, digests and code. If a secret
ever appears in an artifact, the pilot stops and the finding is published.

## 4 · What you provide

| Item | Why | Size |
|---|---|---|
| One named engineer (with GitHub handle) | the flag and the envelope capture are theirs | ~4 hours/week |
| The unsigned envelope of the chosen flow, and the policy you would actually set | a receipt without the exact bytes proves nothing | one file |
| 20–200 historical or testnet transactions | the report needs a denominator, not one happy path | export or testnet run |
| A decision-maker at the read-out | the pilot ends in go / no-go, not a demo | 1 hour |
| Written permission to publish the report with numbers | an unpublished pilot is not evidence | one line |

Your total engineering effort is capped by criterion 5 at 2 engineer-days. If the
integration needs more than that, it is a finding about our integration, not about
your team.

## 5 · Fee

The fee and its schedule are fixed in a one-page **Order Form**, separate from this
SOW. **No price is published here** — commercial prices are locked by owner
decision and appear in no document. If the pilot is agreed as free, the Order Form
records "no fee", and that is the whole term.

The fee is **not contingent on a go outcome**. We are paid for the measurement, not
for the answer; a report that says "this did not work" is a delivered pilot.

No grant, funder or programme is a party to this SOW, and no pilot term depends on
an award being made.

## 6 · Data, confidentiality, publication

- We accept an NDA on **volumes and addresses**. We do not accept one on
  **verdicts and refusal codes**: a pilot that cannot be cited counts as adoption
  for neither of us.
- **Published:** the report with its numbers and findings, and the artifact bundle
  with addresses and volumes redacted as you instruct.
- **Never published:** secrets, your customers' identities, or raw envelopes beyond
  the single redacted example in the bundle.
- **Deleted:** our copies of your envelopes within 30 days of the read-out,
  confirmed to you in writing.
- **Your name:** published only with written permission. The default is "a Stellar
  DEX team" or "an agentic-commerce platform" — your call, in §9.

## 7 · Exit

- Either side may stop the pilot with **5 business days' written notice**, for any
  reason or none.
- A stopped pilot is reported as **STOPPED**, with what was measured up to that
  point. If you withdraw publication permission, we publish nothing and the pilot
  never counts as evidence — we say "no completed pilot", never "a successful one".
- Any fee already invoiced stands; nothing further is invoiced.
- You delete the branch. We delete our copies under §6, published artifacts aside.
- No exclusivity, no lock-in, no IP transfer: your code stays yours, and the
  integration arrives as a PR you may reject or remove entirely.

## 8 · What this pilot does not establish

Not that a transaction is safe (`VERIFIED` ≠ `SAFE`); not execution (a pre-sign
receipt declares `executionProof: NOT_INCLUDED`); not detection of malicious
contracts; not adoption. The full statement is [PILOT-KIT.md §6](PILOT-KIT.md) and
it is not softened in the report.

## 9 · How to say yes without a call

Reply with these five lines and we start. A 30-minute call is available but never
required.

1. **Flow:** one sentence — e.g. "swap above 500 USDC on our DEX router".
2. **Start date:** pick one of the two dates we offered.
3. **Engineer:** name and GitHub handle.
4. **Publication:** `yes` / `yes, with redactions` / `no` (a `no` means the pilot
   cannot be cited as evidence by either side).
5. **Signer:** name and title for the Order Form.

We send the Order Form and the calendar invite the same day; day 1 begins on the
date you picked.

## 10 · Signatures

| | Provider — CoreGuard Global | Partner |
|---|---|---|
| Name | | |
| Title | | |
| Signature | | |
| Date | | |

**Annexes.** A — [PILOT-KIT.md §4](PILOT-KIT.md), the seven criteria, frozen at
signature. B — [PILOT-REPORT-TEMPLATE.md](PILOT-REPORT-TEMPLATE.md), the report
form both sides sign. C — [PILOT-KIT.md §5](PILOT-KIT.md), the artifact format.
