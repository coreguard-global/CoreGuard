# Security Policy

CoreGuard is an **execution-truth / execution-integrity** project. Its job is to produce independently verifiable, fail-closed evidence of whether execution conformed to what was authorized — **not** to declare a transaction or system “safe”.

**Important boundaries:** VERIFIED ≠ SAFE. A verified receipt/proof/anchor shows conformance to declared intent/policy/evidence as specified; it is **not** a security audit, not a guarantee against all exploits, and not a claim of external review or adoption.

## Supported / in-scope surfaces

We welcome good-faith reports that affect the integrity of verification, evidence, receipts, anchoring, or fail-closed behavior in committed code and artifacts, including:

- **Core protocol & verification engine:** `packages/` (canonicalization, hashing/crypto, intent/policy, trace/evidence/replay, verifier/consensus, firewall/guard, SDK/CLI surfaces, delivery/DDE, provenance, pricing/x402 harnesses, adapters/contracts as shipped).
- **Stellar surfaces:** `packages/stellar/`, `packages/stellar-agent/`, `packages/stellar-soroban/`, `packages/agent-gate/`, PSAR/1 pre-sign receipts (`packages/stellar/presign.mjs`), examples/demos (`examples/stellar-*`, `examples/agent-gate-*`) — e.g. XDR/receipt binding, signature verification against pinned keys, envelope conformance, fail-closed reject paths.
- **Core DAO / EVM contracts:** `contracts/` (e.g. `EvidenceRegistry*.sol`) and Foundry tests/proofs (`test/contract/`, `foundry.toml`, CI invariant+fuzz jobs) — commitment/anchoring integrity as specified.
- **Soroban contract (Stellar):** `soroban/commitment-anchor/` and its tests/artifacts.
- **Tooling & reproducibility:** `scripts/`, `test/`, CI/workflow definitions that affect reproducibility or claim/evidence integrity, and committed evidence/verification harnesses.

> Network note (honest): **Core DAO** anchors/evidence-registry surfaces and **Stellar** executed/test-executed surfaces are covered by committed evidence/tests as recorded; **Pi Network** surfaces are prepared/DRY_RUN/PLAN_ONLY unless separately evidenced. A report should state the affected network/surface and evidence.

## Out of scope (non-exhaustive)

- Anything explicitly marked **design/research** (e.g. L4/ZK research) unless you demonstrate a concrete impact on a shipped, claimed surface.
- Scenarios documented as known limits in the threat model/corpus/specs (e.g. deep per-call sequence diffs at L2, oracle trust assumptions) — still welcome as context, but not treated as a new vulnerability by itself.
- “Execution conformed but the outcome was harmful/unprofitable/undesired” — this is a **policy/intent/usage** issue, not an evidence-integrity vulnerability (**VERIFIED ≠ SAFE**).
- Social engineering, physical attacks, issues in third-party services/wallets/networks we do not control, or claims requiring secrets/credentials we do not possess.
- Findings that depend on assumptions explicitly rejected by the project’s honesty/claim boundaries (e.g. treating a proposal/comment/demo as adoption or an audit).

## Reporting a vulnerability

**Please do not open a public issue or pull request for security problems.**

Preferred: use **GitHub Private Vulnerability Reporting** for this repository if enabled: <https://github.com/coreguard-global/CoreGuard/security/advisories/new>

If private reporting is unavailable, contact the maintainers through a private channel listed on the repository/org profile (do not post exploit details publicly). **Do not send secrets or private keys.**

Include, where possible:
- A minimal, **deterministic** reproduction (commands, inputs, environment) and affected commit/tag.
- Impact: what can be forged/bypassed (receipt, signature/binding, anchor/commitment, verdict, fail-closed guarantee) and under which trust model/assumptions.
- Network/surface (Core DAO / Stellar / Pi, if applicable) and relevant spec/module/test references.
- Suggested fix or mitigation, if any.

**Response targets (best effort):** acknowledge within **48 hours**, initial triage within **7 days**, and coordinate responsible disclosure (default target **90 days**, adjusted case-by-case for active risk and fix readiness).

## Security reviews & assurance (honest status)

- **Automated/measured assurance:** deterministic test suites, adversarial corpus, boundary/claims audits, docs/CI contracts, and (for Core DAO contracts) Foundry unit/invariant/fuzz tests as recorded in `docs/STATUS.md` and `docs/state-snapshot.json`.
- **Internal/project self-reviews:** e.g. PSAR/1 critical self-review (`docs/psar-security-review-2026-11-12.md`) — **project-authored**, not a third-party audit.
- **Third-party security audit:** **not performed / not claimed** unless explicitly recorded with evidence.

## What we consider in scope to fix

We prioritize issues that allow an attacker to **forge, bypass, or silently degrade** verification/evidence guarantees under the documented threat model and assumptions — for example: producing a `VERIFIED`/`PASS` result for an execution or artifact that did not conform to the committed intent/policy/bound bytes; breaking receipt/signature/digest binding; violating fail-closed semantics in a way that yields an unsafe pass.

See: `spec/threat-model.md`, `docs/CLAIMS-TAXONOMY.md`, and `docs/STATUS.md`.

## Safe harbor (good faith)

We support good-faith security research: act lawfully, avoid privacy violations and data destruction, do not degrade services, and give us a reasonable opportunity to remediate before public disclosure. If you are unsure whether a test is appropriate, ask privately first.