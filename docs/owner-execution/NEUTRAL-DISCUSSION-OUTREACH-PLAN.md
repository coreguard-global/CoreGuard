# Neutral Technical Discussion & Outreach Plan (PSAR/1 context, non-promotional)

**Purpose:** test whether the problem PSAR/1 explores is real for developers, and gather technical feedback/alternatives — not to promote CoreGuard, request adoption, or circumvent any closed discussion (including Freighter).  
**Posture:** ask questions first; mention PSAR/1 only as an exploratory implementation/spec with explicit limits and a reproducible verification package.

## 1) Principles (non-negotiable)
- **Neutral & problem-focused:** discuss the gap and design constraints, not “adopt our product”.
- **No mass posting:** start with **one** discussion in **one** appropriate venue. Do not repost the same content across multiple repos.
- **Respect scope & guidelines:** before posting, read the target’s CONTRIBUTING/community/discussion rules; do not post if out of scope or disallowed.
- **No circumvention:** do not use discussions to revisit or pressure a closed issue (e.g. Freighter #3087). No follow-up there.
- **Human-authored, concise, accountable:** write in your own words, understand and own every claim, respond to feedback yourself. Use tools only for internal prep; do not let generated text speak for you.
- **Honest boundaries:** state what is proven (reproducible artifacts) vs. not (no semantic decode in v1, `executionProof: NOT_INCLUDED`, no wallet integration/adoption, no security audit/production claim).

## 2) Phased approach

### Phase 1 — Single general discussion (listen first)
- **Goal:** learn if/how developers experience a gap between “what the user reviews” and “what exact bytes/authorization are being signed/approved”, current mitigations, and design constraints.
- **Venue choice (in order of fit):** broader Stellar developer/community discussion space appropriate for open design questions (where guidelines permit). Only choose an SDK/wallet/app repo if the question is concretely in-scope for that repo’s maintainers/contributors.
- **Ask, don’t pitch:** no requests for review, merge, or adoption.

### Phase 2 — Listen & analyze
- Capture: stated pain points, existing approaches, alternatives, objections, requirements, and cases where such guarantees are unwanted/impractical.
- Update understanding and docs (limits/threat model) based on evidence/feedback — do not argue to “win”.

### Phase 3 — Targeted technical follow-up (only if warranted)
- If genuine technical interest emerges, pick **one** well-scoped venue and ask a specific integration/design question aligned with that project’s context and guidelines.

## 3) Neutral draft (adapt in your own words before posting)

**Suggested title:** `Design discussion: verifiable pre-sign authorization for Stellar transactions`

**Body (outline):**
- **Context/question:** Is there a practical gap between the transaction details shown to a user and assurance that the authorization is bound to the exact transaction bytes about to be signed? In what situations does this matter (dApps, agents, multi-step flows)?
- **Current practice:** How do wallets/apps currently address this? What signals (simulation, decoding, warnings) are used, and where do they fall short?
- **Desired guarantees:** What properties would a pre-sign authorization mechanism need to be useful (e.g. exact-bytes binding, fail-closed verification, clear time/network scope)? What would make it unsafe or not worth integrating?
- **Constraints/concerns:** Issuer trust/key distribution, UX complexity, performance, policy expressiveness, semantic vs. byte-level checks, false confidence.
- **Exploratory reference (optional, minimal):** “I’ve been exploring one possible approach (PSAR/1) as a reproducible experiment: offline, byte-exact binding + fail-closed PASS/BLOCK, with explicit limits (no execution proof, no semantic decoding in v1, no wallet integration). Independent verification package/spec: <link to repo doc/commit>. Sharing only as a concrete reference for discussion, not proposing adoption.”
- **Ask:** What alternatives, prior art, or pitfalls should be considered?

**Pre-post checklist:**
- [ ] Venue allows this topic; guidelines read and followed
- [ ] Single post, neutral tone, no adoption/endorsement request
- [ ] Claims match reproducible evidence; limits stated plainly
- [ ] Written and owned by you (human-reviewed)

## 4) What to avoid
- Announcements framed as “introducing/adopt CoreGuard/PSAR/1”
- Tagging maintainers to solicit review/adoption
- Multiple simultaneous posts or link-dropping for visibility
- Arguments defending past interactions or referencing closed issues to gain traction

## 5) Success criteria (process, not outcomes)
- Collected concrete feedback/alternatives/objections from practitioners.
- Improved understanding of real needs and constraints.
- Maintained credibility through restraint, accuracy, and guideline compliance (regardless of whether anyone adopts anything).

*This plan prepares outreach; actual posting is an owner action performed in compliance with each venue’s rules.*
