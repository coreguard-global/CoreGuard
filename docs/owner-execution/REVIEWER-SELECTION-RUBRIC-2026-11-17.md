# Reviewer Selection Rubric — Independent Verification Trial (Issue #63)

**Status:** OWNER-EXECUTION INSTRUMENT (dated 2026-11-17) — a deterministic decision aid for the owner when respondents appear on [Issue #63](https://github.com/coreguard-global/CoreGuard/issues/63). Nothing here is posted externally by the project; the owner performs the selection and the posting.
**Scope:** Selecting exactly ONE independent reviewer for the PSAR/1 independent verification trial, evaluating against the criteria already published in the issue. This document adds the mechanical rubric; it changes no criteria and promises nothing to anyone.
**Non-claims:** The trial is explicitly NOT a security audit, certification, or endorsement; its report will be split into reproduced / environment / package-doc gaps and may be negative. Selecting a reviewer implies no adoption, funding, partnership, or integration outcome.

---

## 1. Hard gates (all five must pass; any single miss = not selectable)

| # | Gate | How to verify (owner, manual) |
|---|---|---|
| G1 | Publicly evidenced Stellar/XDR/signing hands-on experience | A linked repo, PR, post, or project the owner can open and read (XDR construction, SEP-style flows, Ed25519 signing, testnet transactions). Marketing words without an artifact fail. |
| G2 | Zero prior CoreGuard development/testing involvement | Scan the repo history: commit authors, issue/PR participants, test fixtures naming them. Anyone with commits, reviewed PRs, or prior test involvement is out. |
| G3 | Conflict-of-interest disclosure completed (template below) | The respondent returns the COI template filled. An empty or evasive COI fails. |
| G4 | Public identity attributable to the work | The trial report will be published with attribution; anonymous participation is out of scope for v1 of the trial. |
| G5 | Stated willingness to report failures honestly, including environment breaks | Their application says so in their own words; boilerplate-only fails. |

## 2. Scored criteria (0 / 1 / 2 each; applied only to applicants passing all gates)

| # | Criterion | 0 | 1 | 2 |
|---|---|---|---|---|
| S1 | Depth of signing/XDR evidence | Name-dropping only | One relevant artifact | Multiple artifacts incl. one nontrivial (e.g. a signed-envelope flow, XDR tooling) |
| S2 | Independence (proximity to CoreGuard ecosystem) | Any prior interaction found | Mentions a mutual contact only | Fully disjoint history found by the owner's scan |
| S3 | Specificity of their plan | "I'll look at it" | Names the package and a rough plan | Names the pinned revision, the vectors they will run, and their report split |
| S4 | Availability commitment | None stated | Vague ("sometime") | Concrete delivery date for the report within the trial window |
| S5 | Communication quality | Unclear/incompatible | Adequate | Precise, technically literate, matches the issue's language |

## 3. Decision rule (deterministic)
1. Filter by the five hard gates.
2. Rank by total score (max 10). Threshold to select: **≥ 7**.
3. Tie-break: earlier complete application (timestamp of the qualifying comment on #63).
4. Exactly ONE reviewer is selected per trial round. Everyone else receives the polite-decline template (below). If nobody reaches the threshold, the issue stays open; no re-selection pressure, no criteria relaxation without a dated owner decision recorded in this file.

## 4. Conflict-of-interest disclosure template (sent to a shortlisted respondent)
```text
COI DISCLOSURE — CoreGuard Independent Verification Trial (pinned 9e0db20)
1. Have you ever contributed code, tests, docs, or reviews to CoreGuard? (yes/no + links)
2. Do you have any financial, employment, contractual, or advisory relationship
   with CoreGuard, its owner, or any entity named in its docs? (yes/no + details)
3. Do you expect any compensation, token, grant, or future engagement from this
   trial? (yes/no + details)
4. Any other interest a reasonable reader might consider a conflict? (yes/no + details)
5. Do you agree your report will be published verbatim, including failures? (yes/no)
```

## 5. Handoff package (what the selected reviewer receives — nothing more)
- The pinned revision: **`9e0db20`** of `coreguard-global/CoreGuard` (the trial target is frozen; later `main` advances — e.g. the 2026-11-17 CG-TAS/1 anchor-set wave — are a possible follow-up trial, never a mid-trial target change).
- `docs/PSAR1-INDEPENDENT-VERIFICATION-PACKAGE.md` and `docs/owner-execution/INDEPENDENT-VERIFICATION-TRIAL-PROTOCOL.md` from that revision.
- The three-way result framing: reproduced / environment / package-doc gaps.
- The honesty framing: the report is not an audit or certification; `VERIFIED ≠ SAFE`.
- Owner commitment: **no intervention during execution** — no hints, no fixes, no steering until the report lands.

## 6. Reply templates (owner sends; the project does not auto-post)
- **Accept:** confirm the pinned revision, the report date, the three-way split, the not-an-audit framing, and the no-intervention rule. Ask for the COI first if not yet returned.
- **Decline (below threshold / gate miss):** thank them, state that this round's rubric did not select them, invite them to follow the repo; no rubric internals, no criteria negotiation.
- **No-qualified-respondent note (optional, owner's call):** the issue remains open; selection simply has not happened yet.

## 7. Red flags (auto-decline regardless of score)
- Offers to "fix" issues found during the trial (breaks independence).
- Requests payment, tokens, or a future grant as a condition.
- Claims prior CoreGuard familiarity while G2 scan shows none (or vice versa).
- Insists on pre-approving the report before publication.
- Asks to run against an unpinned or self-built variant of the package.
