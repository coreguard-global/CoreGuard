# CoreGuard Global — Pricing

> **PROPOSED — NOT PUBLISHED.** Every number on this page is a proposal under
> discussion, not an offer, a list price, a quotation, or a commitment. No
> billing system exists in this repository, nothing meters usage, nothing
> charges a card, and no customer has ever been invoiced. The Decision Gate is
> still closed; `packages/pricing/pricing.js` stamps `gated: true` and
> `hypothesis: true` on every machine view and is forbidden by test from
> containing a billing path. If these numbers ever become real, that module is
> the one place they change — and this page will carry a dated "published"
> banner instead of this one.

Why write numbers at all, while gated: an unpriced product cannot be evaluated
by a buyer, and "contact us" is not a pricing page. These figures exist so a
reviewer can disagree with a concrete shape instead of an adjective.

## 1 · What is being sold

One metered unit: **a verified receipt** — one receipt presented to the
verifier and answered with a verdict (`VERIFIED` / `MISMATCH` / `UNKNOWN` with a
named reason). Verification is offline and deterministic, so a verdict is a
pure function; the metered unit is the call, not a network round-trip.

Two things it deliberately is **not**:

- Not priced per seat, per badge, or per "AI analysis" — the unit is the
  verdict, because the verdict is the thing the integrator's own audit trail
  depends on.
- Not priced on the on-chain anchor. The anchor fee is a separate, explicit,
  atomic `feeWei` paid to the chain at commit time (`EvidenceRegistryV3`), and
  it is not CoreGuard revenue. It is quoted in CORE by the contract, not here.

## 2 · Tiers — PROPOSED, NOT PUBLISHED

| Tier | Monthly, USD | Included verified receipts / month | Overage per receipt | Notes |
|---|---|---|---|---|
| **Integration (free)** | $0 | 10,000 | — (hard stop, returns `BLOCK`-style overage code, never bills) | sized for CI: a full test suite plus a two-week integration spike fits inside one month |
| **Starter** | $49 | 50,000 | $0.0012 | one production environment, email support |
| **Pro** | $349 | 500,000 | $0.0007 | multiple environments, evidence export, priority queue for support |
| **Scale** | $2,400 | 5,000,000 | $0.00045 | committed volume, quarterly true-up |
| **Enterprise** | from $12,000 | negotiated (typical floor 20,000,000) | negotiated, floor $0.0002 | on-prem / VPC verifier, named contact, contractual SLA — **only** where a signed agreement exists |

Annual prepay: −15% on any paid tier. Overage is billed at the tier rate of the
month it occurs; there is no "surprise tier downgrade" and no per-incident
charge for a `MISMATCH` — refusals are the product working, not an upsell.

## 3 · Why the free tier is 10,000 receipts

The free tier is sized from a real workload, not from generosity:

| Workload | Receipts / month |
|---|---|
| Unit + integration suite in CI (≈40 runs/day × ~150 receipts) | ≈ 6,000 |
| A two-week integration spike by one developer | ≈ 2,000–3,000 |
| Headroom for a flaky week | remainder |

Below 10,000 the product is unmeasurable — a developer cannot find out whether
the integration is correct. Above it, the caller is running production traffic
and is getting operational value. The tier boundary sits at that line on
purpose, and it is a **hard stop with a named code**, never a silent bill.

## 4 · Worked examples (proposed arithmetic)

| Scenario | Receipts / month | Tier | Monthly, USD |
|---|---|---|---|
| Solo developer, pre-production | 8,000 | Integration | $0 |
| Small DEX, one chain, production | 40,000 | Starter | $49 |
| Wallet with agent traffic | 300,000 | Starter + overage (250,000 × $0.0012) | $49 + $300 = $349 |
| Wallet, identical volume on Pro instead | 300,000 | Pro (included) | $349 |
| Exchange / indexer | 3,000,000 | Scale (included) | $2,400 |
| Custodian, on-prem verifier | 25,000,000 | Enterprise | from $12,000 |

The crossover is intentional: at 300,000 receipts Starter-with-overage and Pro
cost the same, so the upgrade is never a trick — it is a preference for fewer
line items. Note the honest weak point: **marginal cost per verification is
effectively zero** (local hashing and signature checks, no network), so this is
value-based pricing, not cost-plus. That is defensible only while the verdict is
something the buyer cannot cheaply reproduce themselves; when that stops being
true, the price has to fall, and saying so here is cheaper than pretending
otherwise.

## 5 · What a buyer does NOT get (stated now, not in a footnote)

- **No SLA at any tier below Enterprise.** There is no 24/7 rotation; support is
  best-effort email.
- **No compliance certification.** No SOC 2, no ISO 27001, no audit report.
- **No insurance against a wrong verdict.** A `MISMATCH` is evidence, not a
  guarantee of loss recovery.
- **No retention guarantee.** Receipt storage is the integrator's artifact; the
  verifier does not custody it.
- **No "verified = safe" claim at any price.** `VERIFIED` means an authority
  confirmed the claimed execution and the commitment matched. It is not a safety
  or investment judgement, and paying more does not buy a stronger one.

## 6 · Relationship to the code (the only place numbers live)

`packages/pricing/pricing.js` currently carries hypothesis placeholders —
`STARTER` free at 10 anchors/week in CORE, `PRO` at 1 CORE/month, `ENTERPRISE`
custom — and a test forbids it from containing any billing token. Those
placeholders and the USD table above **do not match**, and this page does not
pretend they do: the module is the gated switch, this page is the proposal that
would replace its contents if the Decision Gate opens. Until then the module
stays the machine's answer (`gated: true`), and this page stays a proposal.

Free tier note for the reader comparing the two: the module's 10/week is a
placeholder from the earlier single-purpose beta shape; the 10,000/month here is
the receipt-shaped proposal. Reconciling them is a gate-open task, not a docs
edit — and it would change a test, which is the point of putting the numbers in
code in the first place.

## 7 · Payment methods (proposed, none implemented)

Card and USDC/USDT settlement are proposed; x402 micropayment settlement is a
proposal for machine-to-machine callers (an agent paying per verdict without an
account). **None of these are implemented** — there is no checkout, no invoice
path, and no payment code in this repository.

---

**Status: PROPOSED — NOT PUBLISHED.** Contact for discussion only:
inquire@coredao.org · [LinkedIn](https://www.linkedin.com/company/coreguard-global)
