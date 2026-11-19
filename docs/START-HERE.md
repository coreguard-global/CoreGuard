# Start here — CoreGuard in 5 minutes

CoreGuard is built to make **agent and transaction execution verifiable**: bind
what was authorized, enforce it with named outcomes, and produce evidence a third
party can inspect without trusting the issuer.

This page is a practical entry point: run something real locally, understand the
outputs, then pick the path that fits (integrate, pilot, evaluate, or partner).

> **Boundary (read first):** verification outcomes describe the presented checks
> on the presented evidence. `VERIFIED` / `ALLOW` does **not** mean "safe",
> delivered, fraud-free, or endorsed. `ALLOW_UNVERIFIED` must remain visible to
> downstream systems (never a silent pass). The demos below are offline and
> synthetic unless stated otherwise.

## 1) Run the core trust demo (offline, ~1 minute)

```bash
npm install
npm run trust:demo
```

You should see the four pillars, refusals with **named codes** (e.g.
`XDR_BINDING_MISMATCH`, `RECEIPT_EXPIRED`, `BAD_DIGEST`), and a receipt digest.
This is the fastest way to see "named outcomes, not scores."

- Walkthrough: [docs/DEVELOPER-QUICKSTART.md](DEVELOPER-QUICKSTART.md)

## 2) Run the VAR/1 pilot kit (15 rows, one report)

```bash
node examples/var1-pilot-kit/run.mjs
```

Runs a local sandbox merchant, issues and verifies a signed VAR/1 receipt, and
exercises approve/resolve/verify/consume/replay/conflict/race/tamper/drift and
decision mapping. Writes `report.json`, `REPORT.md`, and receipt bytes under
`examples/var1-pilot-kit/artifacts/<run>/`. Exit code is the verdict.

- Guide: [docs/VAR1-PILOT-KIT.md](VAR1-PILOT-KIT.md)
- Reproduce bytes (deterministic): `--seed <64hex> --at <iso8601> --out <fresh-dir>`
  - Note: receipt bytes are deterministic for a given seed+clock; consumption
    rows are stateful (spend logs live in `--out`), so rerun the full flow into a
    **fresh** `--out`.

## 3) Try the authorization-evidence seam (receipt_id + profile)

A synthetic example of how an accept/payment gate can consume
`{ receipt_id, profile }` as verifiable authorization evidence:

```bash
node examples/agentbadge-receipt-seam/run.mjs --out ./artifacts/agentbadge-seam
```

It resolves by name, verifies signature/trust/intent/execution, and maps outcomes
to **ALLOW / ALLOW_UNVERIFIED / HOLD / DECLINE** — including tampered bytes and
unresolvable records. Useful as an interop starting point for agent-payment or
accept-gate integrations.

- Example: [examples/agentbadge-receipt-seam/README.md](../examples/agentbadge-receipt-seam/README.md)

## 4) Produce a reproducible AER-1 corpus run report

To run a published AER-1 corpus set and share per-vector outcomes with integrity
and "not-evaluated" families named explicitly:

```bash
node scripts/aer1-corpus-report.mjs --dir <corpus-dir> --out <out-dir> --label "vendored-corpus"
```

Replace `<corpus-dir>` with your local corpus directory (the vendored fixture
lives at `test/fixtures/aer1-corpus-v1.5.7`; for a live set, unpack it locally
first). This writes `report.json` and `REPORT.md` to `<out-dir>`.

- Template & checklist: [docs/templates/AER1-CORPUS-RUN-REPORT-TEMPLATE.md](templates/AER1-CORPUS-RUN-REPORT-TEMPLATE.md)
- Mapping note: [docs/aer1-var1-outcome-mapping.md](aer1-var1-outcome-mapping.md)

## Choose a path

| Goal | Where to go |
|---|---|
| Integrate the 3-call surface (authorize / enforce / verify) | [docs/DEVELOPER-QUICKSTART.md](DEVELOPER-QUICKSTART.md) · [docs/DDE-SDK-REFERENCE.md](DDE-SDK-REFERENCE.md) |
| Run an evaluation/pilot and produce a verifiable artifact | [docs/VAR1-PILOT-KIT.md](VAR1-PILOT-KIT.md) · [docs/PILOT-KIT.md](PILOT-KIT.md) |
| Understand outcomes, decisions, and boundaries | [docs/aer1-var1-outcome-mapping.md](aer1-var1-outcome-mapping.md) · [docs/EXECUTION-TRUST-LAYER.md](EXECUTION-TRUST-LAYER.md) |
| Explore agent-commerce surfaces (firewall, consent receipts, risk, attestation) | [docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md](AGENT-COMMERCE-SECURITY-SPEC-V1.md) · [examples/](../examples/) |
| Review evidence and positioning | [docs/EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md) · [docs/COMPETITIVE-LANDSCAPE.md](COMPETITIVE-LANDSCAPE.md) · [README.md](../README.md) |

## Working with CoreGuard

- Open, reproducible artifacts first: runs, receipts, reports, and named limits.
- For integration or design-partner exploration, bring a concrete flow and we can
  map it to receipts/evidence seams (synthetic first, honest scope).
- Contact: [coreguardglobal@gmail.com](mailto:coreguardglobal@gmail.com)

No customers, signed pilots, audits, endorsements, or funding are claimed here.
Built/tested status and gaps are tracked in-repo (see [docs/EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md)).
