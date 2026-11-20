# Business model

## Principle

Keep the trust surface open and verifiable; charge for operating, integrating
and assuring it. A verification layer that customers cannot inspect is worth
less than one they can — so the engine, the receipt format and the verifier stay
MIT-licensed and offline-runnable. The paid work is the part a customer does not
want to run themselves.

## Three revenue lines

| Product | What the customer buys | Revenue shape | Who pays |
|---|---|---|---|
| **CoreGuard SDK** | The authorization/verification library embedded in their stack, with support and versioning guarantees | Subscription or enterprise licence | Wallet, DEX and agent-platform engineering teams |
| **Managed Verification** | CoreGuard runs the verification service: receipt issuance, anchor submission, verification endpoint, availability | Per-verification service fee (volume tiers) | Teams that want evidence without operating infrastructure |
| **Enterprise Integration** | Integration project, policy packs, multi-approval, audit export, SLA and maintenance | Integration fee + annual support | FinTech, payment gateways, escrow operators, exchanges |

Pricing detail and tiers: [pricing.md](pricing.md). Nothing on that page is a
signed contract, and no revenue has been collected to date.

## Why a buyer pays, in their words

1. **"My agent moved money it should not have."** After the incident, the
   question is what was authorized and who approved it. A receipt answers it; a
   log does not.
2. **"My auditor wants evidence I cannot produce."** An offline-verifiable
   artifact turns an argument into a check the auditor performs alone.
3. **"I cannot ship an agent feature without a control."** Fail-closed
   authorization is a precondition for letting an agent spend, not a nice-to-have.

## Open-core boundary

| Open (MIT) | Commercial |
|---|---|
| Verification engine, receipt format, offline verifier, reference implementations, test corpus | Hosted verification service, policy packs, multi-approval workflow, audit export, SLA, integration engineering, support |

Rules we hold ourselves to:

- No license change to the existing MIT core without a public, dated decision.
- Any commercial component added later is reviewed for licence compatibility
  **before** it ships; MIT does not grant trademark rights, and the CoreGuard
  name and marks are not part of the code licence.
- The verifier stays runnable offline and free. Charging for the ability to check
  a receipt would defeat the product's premise.

## Unit economics, stated as targets (not facts)

| Metric | Target | Status |
|---|---|---|
| Free tier | Sized so an integration test costs nothing | Planned |
| Paid entry | Usage-based per verified receipt | Planned, no signed pricing |
| Enterprise | Annual contract with SLA | Planned |
| Gross margin | Software-like, service-heavy in year one | Unmeasured |

No revenue figure in this document is a projection of income; they are pricing
shapes to be tested with the first pilots.

## What we would refuse

- Selling a "safety score" or a probabilistic fraud verdict as if it were proof.
- Selling verification to a counterparty who intends to hide the result from the
  party being verified.
- Taking enterprise money for a compliance claim our own evidence cannot support.
