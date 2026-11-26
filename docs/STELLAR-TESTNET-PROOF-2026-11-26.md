# CG-SG/1 synthetic Stellar Testnet proof — 2026-11-26

**Status:** `PROOF_RECORDED — SYNTHETIC / NOT PRODUCTION`
**Gate:** P5 technical proof only. This is not a customer pilot, owner-held-key run, signing authority, production compatibility, audit, funding, partnership or adoption claim.

## What actually happened

An agent-run script generated a **fresh ephemeral keypair**, funded it through the public Friendbot endpoint, built and signed a real Stellar Testnet payment with that ephemeral key, submitted it to the public Horizon testnet endpoint, and fed the observed result back through the offline CG-SG/1 gate.

- Network: `testnet` (`Test SDF Network ; September 2015`)
- Endpoint: `https://horizon-testnet.stellar.org`
- Funding: `https://friendbot.stellar.org`
- Public account: `GAVFNXCGJLHAIPCRFEARR5DBTMJWJORY6J2GYY4GVZ45TFJTTH36HMJR`
- Keys: **ephemeral and agent-generated**; secret used in memory only, never written or logged; **not owner-held keys**
- Transaction hash: `ab879a1a06e8fc2e4eb4f7bf96908dd688a6b06a0e9921f97038196ea87b5b09`
- Ledger: `5925850`
- Successful: `true`
- Created at (Horizon): `2026-11-26T00:28:13Z`
- Gate result: preflight `ALLOW`, binding `BOUND`, submission evidence `VERIFIED`, 0 named breaks

## Independent Horizon re-read

The raw submitted transaction was re-read with a separate HTTP GET against:

```text
https://horizon-testnet.stellar.org/transactions/ab879a1a06e8fc2e4eb4f7bf96908dd688a6b06a0e9921f97038196ea87b5b09
```

Horizon returned the same hash, ledger `5925850`, `successful: true`, `created_at: 2026-11-26T00:28:13Z` and the same `result_xdr` recorded in the JSON proof. This is a real network read, not a simulated fixture. It still proves only that this Testnet transaction existed with these fields.

## Digests

- Authorization bound digest: `sha256:6eacf250442d35e33744b4a4531ff807442165bfecde8b5a15e9060ab1ea90cc`
- Evidence digest: `sha256:9b6ffff1d1a04df3003c854883719e921482332fda5046de39257021e15e8329`

## Reproduce

The live script requires an explicit consent flag and is excluded from `npm test`:

```text
node scripts/stellar-testnet-proof.mjs --i-understand-this-submits-a-real-testnet-transaction
```

The saved envelope bytes, authorization, binding and evidence packet are in `docs/STELLAR-TESTNET-PROOF-2026-11-26.json`. Offline replay uses `packages/agent-commerce/stellar-gate.mjs` with those saved fields; no live call is needed to replay the verification.

## What this does and does not prove

| Proven | Not proven |
|---|---|
| A real Testnet transaction with the recorded hash and ledger exists | CoreGuard signed or submitted with owner-held keys |
| The exact envelope bytes were bound before submission | Settlement finality on Mainnet or any real value transfer |
| The offline gate returned `VERIFIED` over the supplied evidence | The recipient is safe, KYC/AML-cleared or sanctions-cleared |
| The script can be re-run by any holder of the repository | Any customer, pilot, sponsor, funding, endorsement or adoption |
| A named adversarial suite exists offline | Production readiness, an SLA, an audit or a compliance certification |

`VERIFIED ≠ SAFE`. `ops/production` remains `INTEGRATION_READY, NOT_PROVISIONED`.

## References

- Spec: `docs/COREGUARD-STELLAR-AGENT-SECURITY-SPEC-v0.2.md`
- Script: `scripts/stellar-testnet-proof.mjs`
- Machine proof: `docs/STELLAR-TESTNET-PROOF-2026-11-26.json`
