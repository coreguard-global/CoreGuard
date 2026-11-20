# Security reviews — status, scope, and what counts

This page exists so nobody has to guess whether CoreGuard has been reviewed. The
answer today is: **it has not been independently reviewed.**

## Current status (honest)

| Item | Status | Evidence |
|---|---|---|
| Automated assurance (deterministic suites, adversarial corpus, boundary/claims audits, Foundry invariants/fuzz) | **EXECUTED on every push** | CI · [STATUS.md](STATUS.md) · [state-snapshot.json](state-snapshot.json) |
| Threat model written | **DRAFTED** | [threat model / trust boundary docs](AER1-SECTION9-RESOLUTION-TRUST-BOUNDARY.md) |
| Independent security review | **NOT PERFORMED** | — |
| Threat-model review by an outside party | **NOT PERFORMED** | — |
| Adversarial testing by an outside party | **NOT PERFORMED** (our own corpus is in-repo and adversarial, but self-run) | — |
| Smart-contract audit (Soroban + EVM) | **NOT PERFORMED** | — |
| External reproduction of the *test kit* | **PERFORMED** by an independent standards team — a reproduction, not a review | [ACP #328](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/discussions/328) |
| Bug bounty | **NOT RUNNING** | — |

Do not describe the in-repo test corpus, the CI gates or the external
reproduction as an audit. They are the evidence an auditor would start from.

## What a real review has to cover

Scope drafted in [AUDIT-READINESS-PACK-2026-11-16.md](AUDIT-READINESS-PACK-2026-11-16.md).
The four surfaces that matter:

1. **Receipt and envelope integrity** — canonicalization, hashing, signature
   verification against pinned keys, XDR binding. If this breaks, every other
   claim is decoration.
2. **Fail-closed behaviour** — that no unknown, absent or unchecked state can
   travel downstream as a pass under any code path.
3. **Contracts** — Soroban commitment anchor (write-once, sequence properties)
   and the Core DAO evidence registry (invariants, fees, access control).
4. **Verifier independence** — that a third-party run of the offline verifier
   cannot be influenced by the issuer, and that cross-language parity holds.

## What "independent" means here

| Qualifies | Does not qualify |
|---|---|
| A firm or reviewer with no prior engagement on this code | The founder reviewing their own design |
| A reviewer paid from a source that does not depend on the findings | A friendly reviewer who is also a partner |
| A report published with findings and remediation, or a signed statement that findings were fixed | A "looks good" message in a chat |

We will publish the review report and its remediation, or the fact that it did
not happen. A review that goes badly is still evidence; a review that is
described as done when it is not is a lie with a PDF.

## Plan and sequencing

1. Freeze scope against a commit (the pack already names the files).
2. Engage the reviewer before M3 pilots, so pilot code is written against a
   reviewed baseline rather than patched into an unreviewed one.
3. Budget: $18,000 review + $12,000 fix-and-verify retainer inside the $150,000
   request. If the review finds a binding flaw, the retainer covers the fix
   window; if the fix needs more, that is disclosed, not absorbed silently.
4. Publish: scope, commit, findings count, what was fixed, what was accepted as
   risk.

## Reporting a vulnerability

Not here — use [SECURITY.md](../SECURITY.md): private advisory, 48-hour
acknowledgement target, 7-day triage, 90-day coordinated disclosure default. No
secrets or private keys in a report, ever.
