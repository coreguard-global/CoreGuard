# Independent Verification Trial — Protocol (PSAR/1)

**Decision (next phase):** do **not** expand features now and do **not** initiate new contact with Freighter. Focus on **one** independent verification trial of the existing PSAR/1 verification package, executed under clear conditions and recorded honestly.

## 1) Objective
Determine whether a developer **not involved** in building PSAR/1 can, using only the provided materials, set up the environment, run the checks, reproduce the documented PASS/BLOCK outcomes, and understand the stated guarantees and limits — without direct guidance from the author.

## 2) Preconditions
- **Package under test:** `docs/PSAR1-INDEPENDENT-VERIFICATION-PACKAGE.md` (pinned to a specific commit/tag).
- **Scope frozen for the trial:** no feature additions; only clarifications/fixes to docs or reproducibility issues discovered by the trial (logged as changes) before a re-trial.
- **Reviewer independence:** no participation in PSAR/1 design/implementation; no live assistance from the author during execution (questions/ambiguities recorded, not answered in real time).
- **Before trial start:** pin the specific commit/tag to be tested and record the execution environment, commands, and outputs as they appear (do not edit or sanitize failures).

## 3) Trial procedure

### Step A — Handoff
Provide the reviewer with:
- Repository URL and pinned commit/tag
- Link/path to the Independent Verification Package
- Explicit note: report what happens, including failures/confusion; do not assume author intent

### Step B — Unassisted execution
Reviewer performs, in order (as documented):
1. Clean-clone/setup per instructions
2. Run the demo and tests as specified
3. Observe and record results for PASS and BLOCK cases
4. Read spec/boundaries/threat model sections

### Step C — Structured reporting (reviewer)
Reviewer records:
- **Environment:** OS, Node version, hardware/VM notes, network conditions relevant to setup
- **Setup outcome:** success/failure, time taken, blockers, deviations required
- **Reproduction:** for each documented case, observed result vs. expected (PASS/BLOCK, reason/code where applicable), with command outputs/logs
- **Result categories (do not merge):** classify outcomes separately as (1) successfully reproduced, (2) not reproduced due to environment issues, (3) not reproduced due to deficiencies/ambiguity in the package — do not conflate environment failures with package failures.
- **Understanding:** could they explain (a) what is guaranteed, (b) what is not guaranteed, (c) trust assumptions (issuer key pinning, etc.)?
- **Friction & gaps:** unclear steps, missing info, ambiguities, errors, or misleading wording
- **Verdict (factual):** “reproduced as documented” / “partially reproduced” / “not reproduced”, with evidence

### Step D — Author response (after trial)
- Triage findings: documentation clarity, reproducibility issues, or (only if evidenced) implementation defects.
- Apply minimal necessary fixes; document changes against the pinned baseline.
- If material issues were found, **re-run the trial** (same or different independent reviewer) under the same protocol.

## 4) Evidence to retain
- Pinned commit/tag tested
- Reviewer report (filled template below)
- Raw command outputs/artifacts produced during the trial (as shareable, no secrets)
- Change log of any doc/repro fixes between trials

## 5) How to state results (accuracy rules)
- Permitted (if true): “The PSAR/1 verification package was executed and the documented checks were reproduced by an independent reviewer (commit X, date Y).”
- Not permitted without separate evidence: claims of security correctness, production readiness, wallet readiness, or third-party adoption/endorsement.
- **Scope of conclusion:** this trial is an independent verification of runnability and reproduction of specified results — **not** a security audit and **not** an independent certification/endorsement of the product.
- Always report limitations and any unreproduced/ambiguous outcomes.

## 6) Reviewer report template (copy/fill)

```text
Trial date:
Reviewer (independent? Y/N, relationship to project):
Pinned commit/tag:

Environment:
- OS:
- Node:
- Notes:

Setup:
- Steps followed:
- Success/failure:
- Blockers/deviations:

Reproduction:
- Demo (command, result, PASS/BLOCK observations):
- Tests (command, result, counts/failures):
- Expected vs observed (per case):

Understanding (reviewer’s own words):
- Guaranteed:
- Not guaranteed / limits:
- Trust assumptions:

Friction/gaps (quotes or specifics):

Overall outcome: reproduced / partially reproduced / not reproduced
Attachments/logs:
```

## 7) Exit criteria for this phase
- At least one completed, documented independent trial (and re-trial if required), with findings addressed proportionately.
- A clear, evidence-based statement of what an independent reviewer could and could not verify.

*This protocol prioritizes credible, third-party-verifiable evidence over volume of artifacts or outreach activity.*
