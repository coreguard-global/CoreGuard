# Audit readiness pack — authorization→signing boundary (2026-11-16)

An external review is the third of the three things that move CoreGuard from
"honest engineering" to "crédible infrastructure": a named pilot, a real audit,
and letters of intent. This pack is what an auditor is handed on day one, so
that scoping takes an hour instead of a week.

**What this document is not:** a quote, an audit, or evidence that any auditor
has been engaged. `independentAudit: NOT_PERFORMED` remains true after this file
is committed. Budget ranges below are marked as unverified shape, not offers.

## 1. Scope, in one paragraph

Review the path a payment takes from a mandate to a signed Stellar envelope:

    mandate → gate decision → intent digest → envelope construction → signature
                    ↑                                              ↓
              receipt (CGEP/1)  ←——  conformance re-derivation  ←——┘

The question the audit answers: **can any of these transitions produce a
signature, or a `VERIFIED` receipt, for something the mandate did not authorize
— and does the failure mode ever read as success?**

## 2. In-scope artifacts

| Area | Files | Why it is in scope |
|---|---|---|
| Gate decision | `packages/agent-gate/` (evaluation, mandate parsing, verdict) | The decision is the product; a wrong `ALLOW` is the failure that matters |
| Envelope construction | `packages/agent-gate/adapters/stellar-xdr.mjs`, `adapters/freighter.mjs` | The boundary where intent bytes become signable bytes |
| Receipt semantics | `scripts/ladder/verification-levels.mjs` (`verifyReceipt`, `bindReceiptIdentity`), `docs/sep-receipt-semantics-draft-2026-11-11.md` | The verdict vocabulary, the fail-closed rule, and the identity axis added after issue #56 |
| Anchor contract | `soroban/commitment-anchor/src/lib.rs` | On-chain commitment; the only code of ours that runs on-chain |
| Verification CLI | `scripts/verify-cli.mjs` | The thing a third party runs to check us |
| Witnesses | `test/integrations/agent-gate-field-tamper.test.mjs`, `test/integrations/l1-identity-binding.test.mjs`, `test/fixtures/agent-gate/canonical-vectors.json`, `test/fixtures/aer1-corpus-v1.5.7/` | The evidence the auditor is asked to falsify, not to trust |

## 3. Invariants an audit should try to break

| # | Invariant | Encoded as | Failure it prevents |
|---|---|---|---|
| I1 | `UNKNOWN` never becomes `ALLOW`; an unreadable mandate yields `HOLD` | Gate evaluation branches | Optimistic parsing of a malformed mandate |
| I2 | A decision cannot carry an execution the mandate did not authorize | Intent digest binding + conformance | Post-approval swap (destination, amount, asset, memo) |
| I3 | A digest pass never vouches for the receipt identity | `bindReceiptIdentity` → `RECEIPT_ID_BOUND` / `_MISMATCH` / `_UNBOUND` / `_RESOLUTION_UNSUPPORTED` | The defect disclosed in issue #56: a valid receipt relabeled with another's id verified as `RECEIPT_INTEGRITY` |
| I4 | Verification is recomputable by a party holding only committed bytes | `verify-cli.mjs` exit `0/2/3/4` | Verdicts that require trusting our runtime |
| I5 | A refusal cannot be flipped into a submitted execution | Refusal path + boundary audit | Consent laundering |
| I6 | Fixtures cannot change meaning silently | Digest pins on vendored vectors + corpus digest | Vectors edited to keep a broken rule green |

Each invariant above has a test that fails when the invariant is removed — the
identity axis carries an explicit mutation control that deletes the branch at
runtime and shows the pre-fix module returning `VERIFIED` for the id-swap
vector. An auditor should treat those mutation controls as the primary
evidence, and the passing suite as secondary.

## 4. Out of scope, stated so the report cannot overclaim

- **Stellar protocol security.** Soroban auth, the ledger, and Stellar's own
  signature verification are the authority; this layer sits in front of signing.
- **Core DAO (chainId 1116) surfaces.** The Core family is a separate product
  line; auditing it here would dilute the boundary review.
- **Pi Network surfaces, settlement, escrow, and dispute economics.** The repo
  deliberately keeps money-moving steps outside the gate.
- **Key custody.** The pilot and the audit both assume the integrator's keys
  stay with the integrator; no key-handling claim is made.
- **The TypeScript declaration surface.** `packages/agent-commerce/index.d.ts`
  is a structural contract with no `tsc` lane in CI, and the audit should say so
  rather than infer type safety from it.

## 5. What the auditor is asked to deliver

1. A findings list with severity, each mapped to an invariant above (or to
   "invariant not encoded", which is itself a finding).
2. An explicit statement on **I2** and **I3** — the two invariants that failed
   once already, one of them in this repository's own history.
3. A statement of what the review did **not** cover, so the repo can quote it
   without editing it.

## 6. Ready-to-run reproduction, before the auditor asks

    node --test test/integrations/agent-gate-field-tamper.test.mjs
    node --test test/integrations/l1-identity-binding.test.mjs
    node --test test/integrations/aer1-id-binding-fixtures.test.mjs
    node scripts/verify-cli.mjs --bundle examples/delivery-fixture/pairs/dispute-package/reference-A

These are the four commands that reproduce the tamper matrix, the identity
battery, the vendored corpus replay, and a third-party verification. They run
offline; no key, no RPC, no account.

## 7. Budget shape — unverified

An independent review of this scope, from a firm that has read the Soroban
contract, has been quoted publicly in the Stellar ecosystem in the **low tens of
thousands of USD** for comparable surfaces. This repository has **no quote**: no
auditor has been contacted, and the number above is a planning shape taken from
public market discussion, not a commitment from anyone. It appears here only so
that a funding application cannot silently omit the line item.

## 8. What an audit would not change

It would not make the gate mandatory anywhere, would not produce an integrator,
and would not create revenue. It converts "no independent review" into "reviewed,
with these findings" — which is what makes the pilot letter in
[`loi/README.md`](loi/README.md) credible to a party who does not know us.
