# CGCP Production Integration Pack

**Status:** `INTEGRATION_READY, NOT_PROVISIONED`

This pack provides reference artifacts to execute the CGCP production track in a real target environment. It does **not** claim the environment is provisioned or production-ready.

## Included
- `ops/production/README.md`
- `ops/production/env.example`
- `ops/production/docker-compose.reference.yml`
- `ops/production/otel-collector.reference.yaml`
- `ops/production/k8s/*`
- `ops/production/terraform/*`
- `ops/production/drills/*`
- `ops/production/runbooks/*`

## External prerequisites (must be real)
- Managed Postgres HA/replication/failover
- OIDC/SAML/SCIM IdP
- KMS/HSM + secrets lifecycle
- External witness/transparency log/on-chain anchor
- OTEL/alerts/SLO/on-call

## Evidence
Use templates in `ops/production/drills/` and `ops/production/evidence/templates/`. Only evidence collected from real target-environment execution counts as drill evidence.
