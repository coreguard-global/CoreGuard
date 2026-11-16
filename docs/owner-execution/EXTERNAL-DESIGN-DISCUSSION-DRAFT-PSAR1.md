# Draft (Future): Neutral Technical Design Discussion — Verifiable Pre-sign Authorization for Stellar Transactions

> **Status:** DRAFT — **not for posting now**. Retain for review and possible future use only after the independent verification trial (Issue #63, pinned `9e0db20`) has produced a documented report, and only in **one** venue whose guidelines and scope permit this topic. Do **not** post to solicit adoption, endorsement, funding, or to revisit/pressure any closed discussion (e.g. Freighter).  
> **Authorship:** intended to be adapted, owned, and posted by a human author in their own words.  
> **Defaults (if not specified):** (1) prospective venue: a broader Stellar developer/community discussion space that welcomes open design questions (e.g. an appropriate GitHub Discussion/forum venue) — confirm scope and rules before posting; (2) core question: how to provide verifiable assurance that authorization is bound to the exact transaction bytes being signed.

---

## Suggested title
**Design discussion: Verifiable pre-sign authorization bound to exact Stellar transaction bytes**

## Draft body

### Context and question
In Stellar applications and wallets, users and integrators often rely on presented transaction details (decoded fields, summaries, simulations, or warnings) when deciding to approve a signature. I’m interested in a focused design question:

> **How can wallets and applications provide verifiable assurance that a user’s (or agent’s) authorization is cryptographically bound to the exact Stellar transaction bytes being signed — and what properties, constraints, and trade-offs should such a mechanism satisfy in practice?**

I’m looking to understand whether practitioners see a meaningful gap between *what is reviewed* and *what is ultimately authorized/signed*, and in which situations that gap matters (e.g. multi-step flows, delegated/automated actions, agent-mediated payments).

### How is this handled today?
- What mechanisms are commonly used (transaction decoding, simulation, domain separation, hardware-wallet displays, policy checks, etc.), and where do they fall short?
- Are there cases where byte-exact binding to the reviewed intent is unnecessary, impractical, or undesirable?

### Desired properties and constraints (for discussion)
From a design perspective, what would make a pre-sign authorization mechanism useful and safe? For example (non-exhaustive, offered as prompts):
- **Exact-bytes binding:** authorization evidence verifiably tied to the precise transaction envelope/bytes.
- **Fail-closed verification:** clear accept/reject outcomes for invalid, expired, or mismatched evidence.
- **Scoped trust and time/network bounds:** explicit issuer trust assumptions, validity windows, and network/chain context.
- **Operational practicality:** UX, key distribution/pinning, performance, composability with existing signing flows.
- **Semantic vs. byte-level guarantees:** where byte-level binding is sufficient, and where semantic understanding of effects remains necessary (and how to avoid false confidence).

What pitfalls, threat-model gaps, or integration constraints should be considered?

### Exploratory reference (concrete, limited)
As one exploratory experiment, I’ve been working on **PSAR/1** (a reproducible, offline verification approach that aims to bind an issued authorization artifact to exact transaction bytes and yield a fail-closed PASS/BLOCK result). Sharing it only as a concrete reference for discussion — **not** proposing adoption.

- **Pinned materials (for reproducibility):** CoreGuard repository, revision `9e0db20`  
  - `docs/PSAR1-INDEPENDENT-VERIFICATION-PACKAGE.md`  
  - `docs/owner-execution/INDEPENDENT-VERIFICATION-TRIAL-PROTOCOL.md`
- **Explicit limits (non-exhaustive):** offline/deterministic verification focus; byte-exact binding (not semantic decoding in v1); `executionProof: NOT_INCLUDED` (pre-sign authorization evidence, not proof of on-chain execution); trust anchored to pinned issuer key material per the documented model; no wallet integration, no independent security audit, and no production-readiness claim. An independent reproduction trial is being coordinated separately (Issue #63); treat claims only within what is reproducibly documented.

### What I’m hoping to learn
- Prior art or existing patterns I should be aware of
- Real-world requirements that would make such a mechanism viable or non-viable
- Alternative designs that address the same concern with different trade-offs

*If you have experience with Stellar signing flows, wallet UX, or transaction-integrity controls, I’d appreciate concrete perspectives — including reasons this may be the wrong abstraction.* 

---

## Pre-post checklist (for the human author, future)
- [ ] Independent verification trial outcomes are documented and accurately reflected (no overstated claims)
- [ ] Chosen venue permits this topic; CONTRIBUTING/community rules read and followed
- [ ] Single post, neutral tone, no request for review/merge/adoption/endorsement/funding
- [ ] PSAR/1 described as an exploratory, limited reference; boundaries stated plainly
- [ ] No reference used to pressure or circumvent closed issues/discussions
- [ ] Written and owned by the author in their own words
