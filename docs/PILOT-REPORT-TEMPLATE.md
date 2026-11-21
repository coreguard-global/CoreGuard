# Pilot report — [partner] · [flow] · [date]

This is the form both sides sign at the read-out. Fill every field, delete
nothing, and write it as you found it. **A report that hides a failure is worse
than no report**: the pilot's only asset is that its numbers can be checked by
someone who was not in the room.

Published as written, with your redactions — see §11.

| | |
|---|---|
| Pilot | [id] |
| Partner (as published) | [legal name, or the anonymised form you chose] |
| Flow | [one sentence] |
| Dates | [day 1] – [read-out] |
| Artifact bundle | `pilot/[date]/` · [commit or archive link] |
| Annex A version | PILOT-KIT §4 as signed on [date] |
| Report version | v1.0 · [date] |
| Prepared by | [name, side] |
| Signed by | both sides, §12 |

## 1 · Verdict

**GO / NO-GO / STOPPED** — [one paragraph, no adjectives, naming which criteria
were met and which were not.]

## 2 · Criteria (Annex A, unedited)

Thresholds are copied from the Annex A version named above. If they differ from
the current PILOT-KIT, **the signed Annex A wins** and this table is evidence of
that difference, not a correction of it.

| # | Criterion | Threshold | Measured | Met? | Evidence |
|:--:|---|---|---|---|---|
| 1 | Time to first verdict in the partner repo | ≤ 15 min, clone → `PASS`/`BLOCK` | | | |
| 2 | Receipts that verify outside our repo | ≥ 95% of sampled transactions | | | |
| 3 | Tampered cases refused by name | 100% (amount, destination, window, network, replay) | | | |
| 4 | Determinism | identical receipt digest across two runs | | | |
| 5 | Partner engineering time | ≤ 2 engineer-days | | | |
| 6 | Diff surface | ≤ 1 non-test file outside the flag | | | |
| 7 | Secret hygiene | 0 secrets in the bundle | | | |

## 3 · Findings — mandatory

Every deviation, defect, confusion and undocumented behaviour goes here, including
the ones that were fixed during the pilot. Use one row per finding; link the row to
the artifact that shows it.

| ID | Severity | What happened | Expected | Evidence (file : row) | Status | Owner |
|:--:|---|---|---|---|---|---|
| F-1 | BLOCKER / MAJOR / MINOR / OBSERVATION | | | | OPEN / FIXED / ACCEPTED | |
| F-2 | | | | | | |

**A report with zero findings is only complete if §4 lists every case that was
run and the artifact row that proves each one.** "Nothing went wrong" without that
list is an incomplete report; do not sign it.

## 4 · Adversarial results — one row per case

| Case | Expected code | Observed code | Match? | Evidence |
|---|---|:--:|:--:|---|
| Amount changed after authorization | `XDR_BINDING_MISMATCH` | | | |
| Destination swapped | | | | |
| Window expired | `RECEIPT_EXPIRED` | | | |
| Wrong network | | | | |
| Replayed receipt | | | | |
| [case added during the pilot] | | | | |

Every refusal must be **named**. A generic failure is recorded as a finding, not as
a pass.

## 5 · What did not work

Three short paragraphs. "Nothing" is an acceptable answer only with a sentence
explaining what was actually stressed to reach it.

- **What broke, and how we know:**
- **What we could not measure, and why:**
- **What we would not claim on the strength of this pilot:**

## 6 · Deviations from the SOW

| Date | What changed | Approved by | Effect on criteria |
|---|---|---|---|
| | | | |

## 7 · Effort

| | Planned | Actual |
|---|---|---|
| Partner engineer-days (cap: 2) | ≤ 2 | |
| CoreGuard engineer-days | | |
| Invoiced | per Order Form | |
| Not invoiced | — | |

## 8 · Counts, with denominators

| Measure | Count | Denominator |
|---|--:|---|
| Transactions attempted | | |
| Verified outside our repo | | % of attempted |
| Refused by name | | % of adversarial cases |
| `UNKNOWN` outcomes | | % of attempted |
| Not attempted | | |

Every percentage carries its denominator. `UNKNOWN` is neither a pass nor a
failure; it is evidence that was absent, and it is reported as such.

## 9 · Decision

- **If GO:** what phase 2 covers, what it explicitly does not cover, and which
  evidence it would add that this pilot could not.
- **If NO-GO:** why, in the same table above, and what would change the answer.
- **If STOPPED:** at which day, what was measured up to that point, and what
  remains unmeasured.

## 10 · Time to first verdict, as observed

| Step | Wall clock |
|---|---|
| Clone or install, to a running integration | |
| Running integration, to the first `PASS`/`BLOCK` | |
| Receipt received, to independent re-verification offline | |

## 11 · Publication

| | |
|---|---|
| Permission held | `yes` / `yes, with redactions` / `no` |
| Redactions applied | [addresses, volumes, names — list them] |
| Published at | [URL] on [date] |
| Withheld | [anything the partner asked not to publish, and the partner's reason] |

## 12 · Signatures

| | Partner | CoreGuard Global |
|---|---|---|
| Name | | |
| Title | | |
| Signature | | |
| Date | | |

## 13 · What this report does not establish — do not delete

This report is one pilot on one flow. `VERIFIED` ≠ `SAFE`: verification describes
the checks performed on the evidence presented, never a promise that an outcome is
safe, profitable or endorsed. A pre-sign receipt declares
`executionProof: NOT_INCLUDED`, so this report establishes authorization
conformance, not execution proof. CoreGuard does not model malicious contracts, so
nothing here is a detection claim. One pilot is one data point, not adoption — it
becomes evidence when the report is public and the flag is still on a quarter
later.
