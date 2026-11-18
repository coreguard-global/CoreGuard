# SCF Interest Form — draft answer sheet (2026-11-16)

**Status: DRAFT, NOT SUBMITTED.** Every claim below is either measured in this
repository and re-derivable offline by the reviewer, or explicitly marked
`NOT_BUILT` / `OWNER-GATED`. Nothing here is a projection, and no number is
rounded up. Fields SCF asks for that this repository cannot supply yet are
listed in §7 instead of being filled with a plausible sentence.

The form itself is submitted at `communityfund.stellar.org` (interest form →
review panel → possible invitation to a Build Award round). SCF #46 closed on
2026-11-09; the interest form is the standing entry point and is reviewed on a
rolling basis, so this sheet is written to be ready for the next cycle rather
than to hit a date that has passed.

## 1 · Project

| Field | Answer |
|---|---|
| Name | CoreGuard |
| One line | The execution trust layer for Stellar: it proves whether what executed is what was authorized, and hands a stranger a receipt they can re-verify offline. |
| Repository | `github.com/coreguard-global/CoreGuard` (public, MIT-style terms as stated in `LICENSE`) |
| Primary contact | owner of the `coreguard-global` org (name, email and KYC details are owner-gated and must be filled at submission time) |
| Track this fits | **Integration** (an existing Stellar building block others can wire in) rather than Open: the primitive is already deployed and callable, and the ask is to make it consumable. |
| Networks | Stellar/Soroban (primary), Core DAO (live anchor), Pi Network (DRY_RUN only) |

## 2 · What already exists (all re-derivable from a clean clone)

| Artifact | Measured state | How a reviewer checks it |
|---|---|---|
| Soroban commitment anchor | **MAINNET DEPLOYED and INVOKED** on `CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP`; owner-authorized `commit(proofId, commitment)` tx `69044807410f65027c1227f4e525ad83f23a6cb1a2bb79790d82849c5dbc9fec`, ledger 65,337,373, on-chain read-back `{hash, seq}` exact | `docs/evidence/stellar-soroban-commit-executed.json`, digest-checked by `test/integrations/execution-evidence-contract.test.mjs` |
| First signed, funded DEX execution | `pathPaymentStrictSend` CONFIRMED, tx `ac2a7990b3387aab96b197c0c921d57756bd25d65ad0e75b93561ded640b9097`, ledger 65,338,112, `4.0598146 XLM → 0.6306239 USDC` | `docs/evidence/stellar-dex-swap-executed.json` |
| Pre-sign authorization receipts (PSAR/1) | 11 frozen reject codes, byte-exact XDR binding, Ed25519, PASS/BLOCK offline demo | `packages/stellar/presign.mjs`, `npm run trust:demo` |
| Verification ladder L0–L4 | L1 chain-confirmed receipts with a separately reported identity-binding axis; L2 deterministic replay; L3 SHA-256 merkle proofs; L4 frozen boundary, `RESEARCH`, no ZK claim | `scripts/ladder/verification-levels.mjs`, `npm run verify:levels` |
| Suite | 1857 tests, machine-pinned: `scripts/run-tests.mjs` fails the run if the total drifts from `docs/state-snapshot.json` | `npm test` |
| Package | `@coreguard/stellar` is **publishable, not published** (exports, types, `files` allowlist, offline pack-and-import test from outside the repo) | `test/integrations/stellar-package-import.test.mjs` |
| External conformance | AER-1 id-binding vectors (kit v1.5.7) vendored verbatim with both digests pinned and replayed in CI | `test/fixtures/aer1-corpus-v1.5.7/`, `test/integrations/aer1-id-binding-fixtures.test.mjs` |

Everything in this table is verifiable with `git clone` and Node 20+ — no
credential, no RPC key, no faucet.

## 3 · The problem, in the words SCF's panel will look for

A Stellar transaction can succeed and still not be what the user authorized: an
agent pays the wrong recipient, a DEX route changes, a policy cap is exceeded
after the fact. The ecosystem answers "did this happen as authorized?" ad hoc,
and most implementations share one defect — a verification that cannot run is
silently rendered as a pass. CoreGuard's contribution is a small, testable
vocabulary (`VERIFIED` / `MISMATCH` / `UNKNOWN` with a named reason) plus the
fail-closed rule that makes the silent green check the hardest thing to build.

## 4 · Traction — stated exactly

| Metric | Value |
|---|---|
| External integrators | **0** |
| Signed pilots | **0** |
| Paying customers | **0** |
| Revenue | **$0** |
| Third-party security audit | **none** |
| npm publication | **not published** (owner-gated) |
| Stars/forks used as adoption evidence | **not claimed** |

The repository deliberately carries these zeros in `docs/STATUS.md` and
`docs/surface-status.json`, and a test fails if a surface claims otherwise. The
honest position: this is a working primitive with no users yet, and the funding
question is whether that primitive is worth making consumable.

## 5 · What the award would pay for (proposed, owner decides the number)

Four milestones, each with an artifact a panel can check:

1. **Publish and pin the package** — `@coreguard/stellar` on npm with a signed
   provenance record; a public quickstart that installs from the registry rather
   than the repo. (Days, not weeks — the package is already written.)
2. **Two real integrations** — one wallet or DEX flow and one agent-payment
   flow, each shipping the receipt artifact into their own audit trail. Success =
   their engineer runs the verifier, not ours.
3. **Independent review** — a paid external review of the receipt semantics and
   the Soroban anchor (SCF's audit support is the natural channel), with the
   findings published.
4. **Resolution step** — implement AER-1 Section 9 semantics so a receipt id can
   be bound by resolution, closing the one mapping gap currently reported as
   `RECEIPT_ID_RESOLUTION_UNSUPPORTED`.

Budget, tranche split and the ask amount are **not** set here: they depend on
the audit quote and on the two integration partners' commitment, and inventing a
number before those exist is exactly the kind of claim this repository refuses.

## 6 · Why now

The anchor is live, the receipt semantics are CI-enforced, and the package can
be installed today. The missing piece is not engineering — it is the two
integrations and the review that turn "a primitive exists" into "a primitive is
used".

## 7 · What is missing before this can be submitted

Blocking, in the order they should be closed:

1. **Legal entity + KYC/KYB** — SCF requires an identifiable recipient; an
   individual or a registered company both work, but the choice and the documents
   are the owner's.
2. **Budget and ask** — needs the audit quote (milestone 3) and a rate for the
   two integration efforts; without them the budget line would be invented.
3. **Two letters of intent** — even "we would trial this in Q1" from a wallet and
   an agent platform converts §5.2 from a plan into a commitment. Nothing in the
   repo can substitute for these.
4. **A 2–3 minute demo recording** — the offline demo is scriptable
   (`npm run trust:demo`), but the form expects video; recording it is owner work.
5. **Owner identity on the form** — the GitHub org is the public surface; the
   form wants a human name, email and country.
6. **One honest paragraph on what this is not** — not an audit, not a safety
   guarantee, not a custody product. It is written in `docs/pricing.md` §5 and
   should be carried into the submission verbatim.
7. **Payment details** — an XLM address for the award, controlled by the owner.

Non-blocking but worth having: a short write-up of the AER-1 mapping (the
external conformance work is unusual and reads well to a technical panel), and
the issue #56 thread as evidence of public technical engagement.

## 8 · Re-verification commands a reviewer can run

Clone, `npm install`, then: `npm run trust:demo` (four pillars, three refusals by
name, one receipt digest), `npm test` (the full pinned suite), `npm run
verify:levels` (L0–L4 self-check), `node scripts/current-state.mjs --check` (the
numbers on this page against the committed snapshot). Each of these runs offline.
