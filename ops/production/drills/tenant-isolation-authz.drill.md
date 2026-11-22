# Drill: Tenant Isolation / AuthZ Adversarial (TEMPLATE)

**Status:** NOT_EXECUTED.

## Cases
- Cross-tenant read/write attempts must be denied.
- Role matrix enforcement (owner/admin/operator/auditor/agent-runtime/read-only).
- Token expiry/revocation/invalid audience/issuer rejected.
- SCIM deprovisioned user loses access.

## Evidence
- test matrix results
- request/response logs with redacted secrets
- pass/fail per case
