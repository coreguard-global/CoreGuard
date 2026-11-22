# CGCP Production Track — M5 Readiness Checklist (Template / Bounded)

**Status:** readiness artifact for the PROPOSED production track. **NOT_BUILT** as a certified managed production service in this environment.

## Readiness gates

| Gate | Owner | Evidence required | Status |
|---|---|---|---|
| Schema/migration parity (M1) | Eng | migration test, replay parity report, rollback plan | Code/tests present; prod DB deployment NOT_BUILT |
| RBAC/SSO/SCIM/Tenancy (M2) | Eng/Sec | authz matrix, tenant isolation tests, IdP integration test | RBAC code/tests present; real SSO/SCIM NOT_BUILT |
| HA/Observability (M3) | SRE | failover drill, RPO/RTO report, dashboards/alerts | hooks/interfaces present; multi-AZ deployment NOT_BUILT |
| KMS/External anchor (M4) | Sec/Eng | key rotation drill, anchor verification receipts | local interfaces present; KMS/HSM/external witness NOT_BUILT |
| Ops/Security review (M5) | Sec/SRE/Product | pen test scope, runbooks, backup/restore drill, incident drill | checklist only; external audit NOT_BUILT |

## Required drills before production claim
- Backup restore + integrity verify
- Key rotation + old-key revocation
- Failover/failback with RPO/RTO measurement
- Audit anchor verification after restore
- Tenant isolation/adversarial authz test

## Explicit non-claims
- No managed SLA/SLO attainment claimed.
- No KMS/HSM/on-chain/external witness deployed by this repo alone.
- No payment custody/PSP settlement.
- VERIFIED ≠ SAFE.
