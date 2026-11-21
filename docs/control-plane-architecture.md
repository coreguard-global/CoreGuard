# CoreGuard Policy & Evidence Control Plane — Architecture (v0)

**Status:** v0 local/file-backed MVP implemented (`packages/agent-commerce/control-plane.mjs`).  
**Boundary:** this is NOT a production multi-tenant distributed enterprise service.

## Goal

Evolve CoreGuard from a local verification library into a policy/evidence control layer that organizations can use to manage agent commerce authorization with auditable evidence.

## BUILT_NOW (v0 MVP, local/file-backed)

Implemented in `packages/agent-commerce/control-plane.mjs` with tests:

- **Agent registry:** upsert agent, status (`active/revoked`), metadata.
- **Policies:** spend limit, merchant allow/deny, address allow/deny, active/inactive.
- **Evaluation:** deterministic allow/deny decision with named reasons.
- **Approvals log:** record approval records with hash.
- **Execution log:** record execution/verdict records with hash.
- **Revocation:** revoke agent, revocation record, evaluation blocks revoked agent.
- **Audit report:** counts, agents, policies, revocations, recent executions, recent audit trail.
- **Persistence:** file-backed JSON store (single host, atomic write via temp+rename).
- **Boundary:** `VERIFIED ≠ SAFE`; local control plane only.

## NOT_BUILT (requires separate hardened product work)

- Multi-user authentication, SSO/SAML/OIDC, RBAC/ABAC, tenant isolation.
- Distributed persistent storage, HA/replication, cross-device sync, consensus.
- Secrets/KMS/HSM integration, key rotation workflows, secure credential vault.
- Managed API service, rate limiting, WAF, production SLO/SLA/observability.
- Payment processing/custody/PSP integrations.
- On-chain consumption anchoring/distributed replay ledger.

## Target architecture (next phases)

1. **Control Plane API** (service): authenticated REST/gRPC for agents, policies, approvals, decisions, revocations, reports.
2. **Policy Engine**: versioned policies, simulation/dry-run, change audit, approval workflows.
3. **Evidence Store**: append-only audit log, receipt/evidence indexing, export, tamper-evident storage.
4. **Identity/Access**: org/project/agent identities, RBAC, API keys/OIDC, scoped tokens.
5. **Integrations**: MCP server calls control plane; webhooks; SIEM/export; merchant/payment adapters as explicit opt-in modules.
6. **Deployment**: Postgres/SQLite/Postgres-compatible store, queue, observability, backup/restore, tenancy model.

## Commercial split (honest)

- **OSS (MIT):** local SDK/MCP verification primitives, local control-plane MVP.
- **Pro/Enterprise (future, only when built):** hosted control plane, RBAC/SSO, audit exports, SLA, managed integrations, support.
