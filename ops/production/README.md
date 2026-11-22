# CGCP Production Integration Pack

**Status:** `INTEGRATION_READY, NOT_PROVISIONED`  
**Purpose:** deployable/reference artifacts for taking CGCP production-track foundation into a real target environment.

## Hard boundaries (read first)
- This pack does **NOT** prove production deployment, HA, SLO/SLA, KMS/HSM, SSO/SCIM, external witness, or on-call readiness.
- No real credentials, endpoints, tenant data, or production evidence are included.
- Any "drill" script here is a **template/simulation aid** unless executed on a real target environment and accompanied by collected evidence.
- **VERIFIED ≠ SAFE.**

## Contents
- `docker-compose.reference.yml` - local/reference stack shape (Postgres, app, OTEL collector placeholder). Not managed HA.
- `env.example` - configuration template.
- `k8s/` - reference manifests (NOT_PROVISIONED).
- `terraform/` - reference skeleton (NOT_PROVISIONED).
- `drills/` - drill scripts/templates and evidence capture checklist.
- `runbooks/` - operator runbooks.
- `evidence/templates/` - evidence templates for real drills.

## Required external actions (owner/operator)
1. Provision managed Postgres HA/replication/failover in target cloud.
2. Configure OIDC/SAML/SCIM with real IdP.
3. Configure KMS/HSM and secrets lifecycle.
4. Configure external audit witness/anchoring service.
5. Configure OTEL/alerts/SLO dashboards/on-call.
6. Execute drills on target environment and store signed evidence.
