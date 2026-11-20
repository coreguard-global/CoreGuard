# Team

## Who is accountable

| Role | Who | Scope |
|---|---|---|
| **Founder · Protocol & Security** | EslaM HeshAM (MR-X) | Architecture, verification engine, evidence discipline, CI gates, external technical communication |
| Everything else | Open | See below |

Solo-founder capacity is a stated risk, not a hidden one. The funded plan buys
specific capacity rather than headcount: two contractors with named deliverables,
and advisors on contract for the parts that must be independent.

## Roles the funded plan hires

| Role | Type | First deliverable | Why it cannot wait |
|---|---|---|---|
| **Protocol / Security Engineer** | Contractor, part-time → full-time | Soroban authorized lane + TTL/archival policy, deployed from CI-built wasm | M2 is the milestone the whole evidence story depends on |
| **Smart Contract & Integration Engineer** | Contractor | Two partner integrations wired behind flags, with adversarial cases | A pilot that needs the founder in the room does not scale past one partner |
| **Business Development / Partnerships** | Contractor or advisor, commission-shaped | Two scoped two-week pilots signed | Engineering is not the bottleneck; distribution is |

## Independence, bought not borrowed

| Function | Who may perform it | Who may not |
|---|---|---|
| **Independent security review** | An external firm with no prior work on this codebase | The founder, a contractor paid from the same tranche, or a friendly reviewer |
| **Threat-model review** | External reviewer, using our published threat model as input | Us, reviewing ourselves and calling it independent |
| **Pilot success criteria** | Written jointly with the partner before the work starts | Us, after seeing the results |

## Advisors and reviewers (status)

| Type | Status |
|---|---|
| Security reviewer / auditor | **Not engaged.** Scope drafted in [AUDIT-READINESS-PACK-2026-11-16.md](AUDIT-READINESS-PACK-2026-11-16.md); budget line exists in the funding plan |
| Legal / licensing advisor | **Not engaged.** Needed before an enterprise pilot signs paper |
| Standards liaison (AER-1 / ACP) | Informal public technical exchange only — see [PARTNERSHIPS.md](PARTNERSHIPS.md) |

Nobody on this page is described as an advisor, partner or reviewer until there
is a signed document or a public artifact they authored. A name on a slide is
not a commitment.

## How we work

- **Evidence over narrative.** Every material claim is registered with a status,
  a verification level and a machine path that re-derives it; CI fails on drift.
- **Fail closed on unknowns.** `UNKNOWN` is held, never rounded up to success —
  in the product and in our own reporting.
- **Publish the failures.** Pilot reports include what did not work; the external
  reproduction note explicitly limits what it proves.

## Contact

Founder: [coreguard-trust-and-defense.lovable.app/founder](https://coreguard-trust-and-defense.lovable.app/founder) ·
Email: [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com)
