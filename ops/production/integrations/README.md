# CGCP Real Integration Adapters (CG-INT/1)

**Status:** `INTEGRATION_READY, NOT_PROVISIONED`

Real, dependency-free protocol adapters for the five external integration areas. They perform actual network I/O, real cryptographic verification, and real fail-closed policy checks. They do **not** provision cloud accounts, obtain credentials, create IdP tenants, insert HSM keys, operate a transparency log, or staff an on-call rotation. Those require owner action in a real target environment.

> VERIFIED means "the checks implemented here passed against the supplied live endpoint and trust root". It does **not** mean SAFE, production-ready, audited, or SLA-compliant.

## Modules

| Module | What is real | What it refuses to do |
|---|---|---|
| `common.mjs` | canonical digests, bounded HTTP with timeout/backoff, placeholder rejection, constant-time-ish comparison | accept placeholder config or swallow upstream errors as success |
| `x402-verifier.mjs` | POSTs an x402 challenge digest + payment evidence to a live verifier, re-checks network/asset/amount/payTo/txHash/confirmations locally, optional Ed25519 verifier-response signature | sign, broadcast, custody funds, accept replay or mismatched responses |
| `idp.mjs` | OIDC discovery + JWKS + RS256/RS384/ES256/ES384 JWT signature and claim checks; SAML temporal/audience/issuer/attribute policy with mandatory injected XML-DSig verifier; SCIM 2.0 lifecycle with forced tenant scoping | accept an unsigned SAML assertion, an unscoped SCIM query, or a cross-tenant response |
| `kms.mjs` | AWS KMS SigV4 `TrentService.Sign`, GCP KMS, Azure Key Vault, Vault Transit, injected PKCS#11/HSM signer, CG-KEYS/1 rotation/revocation lifecycle | export private keys, accept `local-dev-only` in production, sign without injected HSM callback |
| `witness.mjs` | RFC 6962 inclusion-proof verification, signed STH verification, read-only Stellar Horizon transaction + hash-memo binding | submit transactions, sign, or treat a leaf as proof of physical truth |
| `observability.mjs` | OTLP/HTTP JSON traces + metrics export, multi-window burn-rate SLO evaluation, webhook alerts with dedup, deterministic on-call rotation | report failed export as delivered, emit a page on NO_DATA, claim someone was paged |
| `config.mjs` | env -> adapter config decoding with per-group `PROVISIONED`/`NOT_PROVISIONED` | treat `example.com`, `REPLACE_*`, missing secret files, or `local-dev-only` as provisioned |
| `probe.mjs` | live reachability/functional probes that write timestamped evidence with response digests | fabricate a passing probe, claim production readiness or SLA |

## Configuration

Copy `ops/production/env.example` to a real target `.env`, fill real endpoints and secret **file paths** (never inline secrets), then decode:

```sh
node -e "import('./ops/production/integrations/config.mjs').then(m=>console.log(JSON.stringify(m.decodeIntegrationConfig(process.env),null,2)))"
```

Required variables are listed in `env.example`. `PROVISIONED` only means config is present and non-placeholder.

## Live probes (real environment only)

```sh
node ops/production/integrations/probe.mjs \
  --env-file /run/cgcp/integration.env \
  --environment prod-eu-1 \
  --operator <your-name> \
  --out ops/production/evidence/integration-probes.json
```

- `--send-alert` is opt-in because it can page a human. Without it, the alert probe is `PROBE_SKIPPED`.
- The probe writes only observed outcomes. Unconfigured integrations are recorded as `NOT_PROVISIONED`, never as success.
- Exit code `2` means at least one integration is not provisioned or a probe failed.

## Readiness reporting

`ops/production/drills/generate-readiness-report.mjs` includes `integration-probes.json` when present. It can only emit `NOT_READY` or `EVIDENCE_COMPLETE_FOR_INDEPENDENT_REVIEW`; it never emits `production ready` or an SLA claim.

## Verification

```sh
# offline adapter self-checks (no network)
node ops/production/integrations/self-check.mjs

# protocol-level tests against local real-protocol servers
node --test test/integrations/production-integrations.test.mjs
```

The suite uses local HTTP servers that speak the real protocols (OIDC discovery/JWKS, x402 verifier, RFC 6962 log, OTLP collector, SCIM, Horizon, alert webhook) and includes genuine/tampered/replay/cross-tenant/no-data cases. Local servers are test fixtures, not production evidence.

## Hard boundary

- `VERIFIED != SAFE`.
- A signature proves the signed bytes matched a supplied key; it does not prove device identity, secure custody, TPM/attestation, or physical-world truth.
- Sensor/telemetry alone does not prove physical work.
- External settlement confirmation must come from the real verifier; CoreGuard never signs or custodies.
