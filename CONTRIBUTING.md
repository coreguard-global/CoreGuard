# Contributing to CoreGuard

Thanks for your interest. CoreGuard is an **execution-truth / execution-integrity** project (fail-closed, evidence-first) spanning **Stellar**, **Core DAO**, and **Pi Network** surfaces (each with explicit, evidence-backed status). Contributions should improve correctness, reproducibility, and clarity — without overstating adoption, security, or network status.

## Ground rules

1. **Determinism above all.** Verification must be reproducible by anyone, anywhere. No heuristics, no network calls inside the verifier, no hidden mutable global state.
2. **Honesty in claims.** Never claim "100% secure", "audited", "prevents all exploits", or attribute safety/adoption CoreGuard cannot prove. **VERIFIED ≠ SAFE.** Execution proof ≠ security audit. Do not present proposals, comments, demos, or dry-runs as integration, endorsement, partnership, or adoption.
3. **Evidence over narrative.** Status labels and metrics must match committed sources (e.g. `docs/STATUS.md`, `docs/state-snapshot.json`, `docs/claims-registry.json`, `docs/surface-status.json`). If a change affects them, update/derive artifacts in the same change as required.
4. **Scope discipline.** Guard against feature creep. If a feature belongs in the roadmap, propose it explicitly instead of silently expanding scope.

## Network-aware contributions (examples)

- **Stellar:** PSAR/1 pre-sign receipts, agent-gate / signed-envelope flows, Freighter-related evaluation surfaces (technical, boundaries-only), Soroban anchor/gating, DEX integration examples — keep XDR/receipt binding, fail-closed semantics, and `integration NOT_BUILT` labels honest where applicable.
- **Core DAO (chain 1116):** commitment anchors/evidence registry contracts, Foundry unit/invariant/fuzz proofs, replay/verification tooling — preserve recorded anchor truth and do not claim new broadcasts unless evidenced.
- **Pi Network:** prepared/DRY_RUN/PLAN_ONLY surfaces — keep cross-network docs consistent without promoting status (no live Pi mainnet tx/anchor/integration/customer claims).

## Development

```bash
npm install
git config core.hooksPath .githooks   # recommended: Pages-settle pre-push guard
npm test                              # full suite (machine-pinned/enforced against docs/state-snapshot.json)
npm run corpus                        # deterministic adversarial corpus
npm run benchmark                     # adversarial benchmark (73/73)
npm run boundary:audit                # boundary/claim hygiene (0 violations expected)
npm run claims:audit                  # claim registry audit
forge test --match-path "test/contract/*"  # Foundry contracts/proofs (requires Foundry)
```

Useful targeted checks (when relevant):
```text
npm run stellar:presign               # PSAR/1 offline demo (no signing/wallet/network)
node --test test/ci/doc-numbers.test.js
```

**Before requesting review:** ensure tests relevant to your change pass, and do not introduce stale counts/claims. The canonical measured totals live in `docs/state-snapshot.json` and are enforced by the test harness; regenerate/update derived artifacts only when your change legitimately affects them and follow the repo’s existing regeneration flow.

## Conventional commits

- `feat:` new capability · `fix:` bug · `docs:` spec/docs · `test:` suites
- `spec:` changes to CGEP/1 and friends · `contract:` Solidity changes

## Code of conduct

Be respectful. Technical disagreement is welcome; personal attacks are not.

## Review

- **Engine/verifier changes** must keep verification deterministic and RPC-free where required; fail closed on ambiguity.
- **Spec/protocol changes** must update the relevant `spec/` or protocol docs in the same change and keep examples/tests consistent.
- **Contract changes** (EVM/Soroban) must include rationale, preserve commitment/evidence semantics as intended, and include/update tests/proofs (Foundry or project test suites) as applicable.
- **Docs/claims changes** must not overstate status; run `npm run claims:audit` / `npm run boundary:audit` when applicable.
- **Security-sensitive changes** (receipts, signatures, XDR/byte binding, anchoring, policy/authorization gates) should include negative/fail-closed cases and, when relevant, note threat-model impact.

Questions? Open an issue before a large PR. For vulnerabilities, follow [`SECURITY.md`](SECURITY.md) (do not open a public issue).
---

## Bounty & Contributor Program

CoreGuard runs a transparent bounty/contributor program so developers, auditors,
and technical writers can ship high-impact work with clear expectations.

### Bounty tracks

| Track | Examples | Label |
|---|---|---|
| **Integrations** | Stellar wallet, DEX, Soroban dApp adapters | `integrations` |
| **Verification & DX** | Reviewer kit, `--verify` runners, docs, tutorials, sample apps | `verification` |
| **Security & Correctness** | Fuzz/property tests, negative-case corpus, threat models | `security` |
| **Ecosystem Content** | Deep-dives, demo videos, integration guides (EN/AR) | `content` |
| **CI/Tooling** | Reproducibility, supply-chain hardening, ergonomics | `ci-tooling` |

### How to claim a bounty

1. **Find an open bounty.** Browse [issues labeled `bounty`](https://github.com/coreguard-global/CoreGuard/labels/bounty)
   or [`good first issue`](https://github.com/coreguard-global/CoreGuard/labels/good%20first%20issue).
   Also check [`docs/bounties.json`](docs/bounties.json) for the full manifest with acceptance criteria.
2. **Open a Bounty Claim issue** using the "Bounty Claim" template, referencing the
   bounty issue number. State your plan and acceptance criteria.
3. **Wait for the maintainer's acknowledgment** (a `claim-in-progress` label on your
   claim issue, or a comment). Do not start work until your claim is acknowledged —
   this avoids duplicated effort.
4. **Fork the repo, create a branch, ship the work.** Follow the ground rules above.
5. **Open a PR with `Closes #<bounty-issue-number>`** in the description, link your
   claim issue, and fill the PR checklist.
6. **Run local verification** before requesting review:

```bash
node scripts/verify-claims.mjs --manifest-check           # validate the manifest
node scripts/verify-claims.mjs --claim CG-BTY-001 --pr-url https://github.com/coreguard-global/CoreGuard/pull/51
```

An `OPEN` claim intentionally fails verification (fail-closed): the command passes only once the claim's status is `CLAIMED` or `MERGED` and its `pr` matches the submitted PR URL.

### Acceptance criteria & review SLA

Every bounty lists explicit acceptance criteria (in the issue body and mirrored in
`docs/bounties.json`). Work is accepted when:

- [ ] All acceptance criteria are demonstrably met (with tests, artifacts, or
      executed commands — not prose claims).
- [ ] `npm test` stays green; `npm run boundary:audit` reports 0 violations.
- [ ] `docs/state-snapshot.json` is consistent (the suite count is machine-enforced).
- [ ] No over-claims: "execution proof ≠ security audit" per `docs/CLAIMS-TAXONOMY.md`.

**Review SLA (targets):** initial response ≤ 48h · first review pass ≤ 5 business
days · merge after approval ≤ 1 business day.

### Rewards — honest scope

- Bounties are paid **only** when scope, funding, and approval are all explicit in
  the bounty issue. `reward.status` in `docs/bounties.json` reflects the current
  funding state — `UNFUNDED` and `PENDING_FUNDING` bounties are **not** payable yet.
- Recognition: merged contributors are credited in `docs/bounties.json` and release
  notes. Evidence-backed badges (CG-BDG/1) may be issued at the owner's discretion.
- Execution proof ≠ security audit. Contributions must not introduce over-claims.

### Labels & board

- [`bounty`](https://github.com/coreguard-global/CoreGuard/labels/bounty) — funded or
  fundable bounty issues.
- [`good first issue`](https://github.com/coreguard-global/CoreGuard/labels/good%20first%20issue) —
  newcomer-friendly, small scope.
- [`open-call`](https://github.com/coreguard-global/CoreGuard/labels/open-call) —
  discussion/proposal issues, not yet scoped.
- [`claim-in-progress`](https://github.com/coreguard-global/CoreGuard/labels/claim-in-progress) —
  acknowledged claim; work underway.

Board query for all four labels (paste into the GitHub issues search box):

```
is:issue is:open label:bounty OR label:"good first issue" OR label:"open-call" OR label:"claim-in-progress"
```
