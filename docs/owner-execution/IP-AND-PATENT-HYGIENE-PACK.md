# IP & Patent Hygiene Pack (preparation, non-legal)

**Status:** preparation artifact for discussion with qualified counsel. **Not legal advice.** No patentability search performed; no filing made; no rights granted or asserted. Innovative code does **not** imply a grantable patent.

## 1) Purpose
Organize technical facts and hygiene steps to support an informed conversation with a **registered patent attorney/agent** (jurisdiction-specific) about potential protection, risks, and strategy — without making claims of novelty, non-obviousness, freedom-to-operate, or registrability.

## 2) Candidate mechanisms to discuss (technical descriptions, not claims)
Describe precisely (with pointers to commits/specs/tests) any mechanisms that may warrant review, for example:
- Binding **user-approved intent** to **executed action** via deterministic, independently re-derivable receipts/evidence (CGCR/1, CGEP/1-aligned flows).
- **Fail-closed** verification semantics with named refusal/taxonomy classes (e.g. AGR/1) over approval↔execution drift.
- Composed **pre-authorization + post-execution** firewall decisions over committed policy/consent contexts (AC-FW/1).
- Offline **attestation** structures linking authorization/execution arcs to committed binding records (CGXA/1) and offline binding-preparation payload derivation (CGXA-SOROBAN/1) — as implemented.

> Counsel will determine whether any of these constitute protectable subject matter, how to frame claims (if any), and relevant prior art.

## 3) Disclosure & prior-art hygiene (important)
- **Public disclosures:** commits, PRs, issues, discussions, packages, demos, talks, and posts can constitute prior art and may affect rights (rules vary by jurisdiction and grace periods).
- **Action:** maintain a dated log of public disclosures (URLs, dates, content summaries) and preserve internal records of conception/reduction-to-practice as applicable under counsel guidance.
- **Before further disclosure:** if protection is a goal, consult counsel **before** publishing additional enabling details beyond what is necessary.

## 4) Trademarks & branding (separate track)
- “CoreGuard”/logos/names: consider clearance/search and filing strategy with counsel if branding protection is desired. No registered trademark is claimed here.

## 5) Open source & licensing alignment
- Repository license: **MIT** (see root `LICENSE`). Ensure any patent strategy is consistent with open-source licensing, contributor terms, and third-party dependencies.
- Third-party components: track licenses/notices; assess compatibility and obligations.

## 6) Evidence bundle to prepare for counsel
- [ ] One-page technical summary per candidate mechanism (problem, mechanism, differentiators, limitations).
- [ ] Pointers to canonical implementations/specs/tests and measured CI evidence (commit hashes, `docs/state-snapshot.json`).
- [ ] Public disclosure timeline and copies/links of key publications.
- [ ] List of contributors/authorship context (as relevant).
- [ ] Competitive/prior-art pointers you are aware of (for counsel’s analysis).

## 7) Questions to ask counsel
- Patentability/prior art in target jurisdictions; claim scope possibilities and risks.
- Impact of existing public disclosures; available grace periods (if any).
- Freedom-to-operate considerations and defensive strategies.
- Cost/benefit of provisional/non-provisional filings vs. trade secret vs. open publication.
- Alignment with open-source distribution and potential standards participation.

## 8) Boundaries
- This pack is organizational and technical context only; it **does not** provide legal opinions, filing instructions, or guarantees of protection.

*Prepared 2026-11-16 (non-legal).*
