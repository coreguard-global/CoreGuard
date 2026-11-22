# CGCP Production Track — Execution Status (M1-M5)

**Status:** foundation implemented in-repo (code/tests/docs). **NOT a deployed/certified production managed service.**  
**Honest boundary:** real Postgres HA, SSO/SAML/OIDC/SCIM provider integration, KMS/HSM, external witness/on-chain anchoring service, managed SLO/SLA/on-call, and payment custody are **NOT_BUILT / INTEGRATION_REQUIRED**.

## Milestone status

| Milestone | Target | Status | Evidence in repo | External/integration required |
|---|---|---:|---|---|
| M1 | Postgres schema + migration from CGCP/1 + replay parity | **FOUNDATION_BUILT** | `packages/agent-commerce/prod/schema.mjs`, `prod/sqlite-storage.mjs`, `prod/migrate.mjs`, `test/integrations/control-plane-prod-m1.test.mjs` | Postgres adapter/deployment, tx/lock tuning, full replay parity harness on production DB |
| M2 | OIDC/RBAC + tenant isolation | **FOUNDATION_BUILT** | `packages/agent-commerce/prod/rbac.mjs`, tenant_id schema, RBAC tests in `test/integrations/control-plane-prod-m2m5.test.mjs` | Real OIDC/SAML/SCIM IdP, SCIM sync, per-tenant RLS/policies, authz matrix integration tests |
| M3 | HA deployment + observability | **INTERFACES_BUILT** | `packages/agent-commerce/prod/observability.mjs`, health hooks, M5 readiness doc | Multi-AZ deployment, replicated DB, OTEL collector, dashboards/alerts, RPO/RTO drills |
| M4 | KMS + audit external anchoring | **INTERFACES_BUILT** | `packages/agent-commerce/prod/kms-anchor.mjs`, local key/anchor adapters/tests | Real KMS/HSM, external witness/transparency log/on-chain anchor, rotation/audit receipts |
| M5 | Production readiness review | **ARTIFACTS_BUILT** | `docs/control-plane-production-readiness-m5.md`, this status doc, PRD/ADR | Independent security review, ops drills evidence, SLO/SLA agreement, managed runbooks |

## What is verifiably built now
- CGCP/1 -> prod SQLite migration with count/audit parity test.
- Tenant-aware schema and storage primitives.
- Deterministic RBAC role/permission model and auth context checks.
- Observability/health hook interfaces.
- Local KMS/anchor interface adapters (dev/test only).
- Readiness checklist and explicit non-claims.

## What must NOT be claimed
- No production HA/managed SLA.
- No real SSO/SCIM/KMS/HSM/external anchor deployment.
- No custody/settlement.
- VERIFIED ≠ SAFE.
