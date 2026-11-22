# CGCP Production Control Plane — PRD / ADR (Proposed Track)

**Status:** PROPOSED / NOT_BUILT as production distributed system.  
**Baseline:** CGCP/1 (self-hosted, single-host, file-backed) is BUILT and hardened in-repo.  
**Purpose:** define the honest product/architecture track for evolving CGCP from a bounded single-host MVP into a production-grade control plane, without claiming the production target already exists.

> VERIFIED ≠ SAFE. This document is a design and execution track. It does not certify a deployed production system.

## 1. Context

CGCP/1 provides local agent/policy/approval/execution/revocation/audit primitives with hash-chained audit and deterministic evaluation. It is intentionally bounded: one host, one store, one bearer key model, best-effort local durability, no external identity provider, no HA consensus, no KMS/HSM, no managed SLA.

Production users/operators need stronger guarantees: identity, tenancy, durable storage, failover, key management, observability, compliance evidence, and safe operations.

## 2. Problem statement

How do we evolve CGCP into a production control plane that can be trusted for multi-operator, multi-agent, policy-governed agent commerce workflows, while preserving the deterministic/fail-closed decision semantics and honest evidence model?

## 3. Goals

- **G1 Identity & access:** RBAC with human/service identities, SSO/OIDC/SAML integration, SCIM provisioning, least privilege.
- **G2 Tenancy:** hard tenant isolation (data, keys, policy, audit, rate limits, quotas).
- **G3 Durable storage:** transactional, durable, replicated store; no silent data loss on acknowledged writes.
- **G4 HA/availability:** multi-node service, leader/failover or consensus-backed writes, defined RPO/RTO.
- **G5 Audit integrity:** tamper-evident audit with external witness anchoring; append-only semantics; exportable proof.
- **G6 Key/secrets management:** KMS/HSM-backed signing/encryption keys, rotation, revocation, audit.
- **G7 Operational safety:** metrics, traces, alerts, runbooks, backup/restore, migrations, rate limiting, abuse controls.
- **G8 Compatibility:** preserve CGCP decision semantics and reason codes where possible; provide migration path from CGCP/1.

## 4. Non-goals (initial)

- Payment custody, PSP settlement, or on-chain transaction broadcasting as part of control plane core.
- Claiming "safe" or "certified" by design alone.
- Replacing external verifiers/chains; control plane stores evidence/verdicts, not universal truth.

## 5. Personas

| Persona | Needs |
|---|---|
| Platform operator | deploy/upgrade/backup/rotate keys/monitor |
| Security admin | SSO/RBAC/policies/audit review/revocation |
| Agent developer | register agents, bind policies, request approvals, commit executions |
| Auditor/compliance | immutable evidence, export, anchor verification, attribution |
| Incident responder | revoke, freeze, trace decisions, verify integrity |

## 6. Functional requirements

### FR-1 Identity & RBAC
- OIDC login + service tokens; SCIM user/group sync.
- Roles: `owner`, `admin`, `operator`, `auditor`, `agent-runtime`, `read-only` (minimum set).
- Every mutation records authenticated actor, tenant, request id, source, and auth context.

### FR-2 Tenant isolation
- Tenant-scoped agents/policies/approvals/executions/audit.
- No cross-tenant reads/writes by default. Admin cross-tenant actions explicitly audited.

### FR-3 Policy & decision engine
- Preserve CGCP deterministic evaluation and reason vocabulary.
- Versioned immutable policy specs; signed policy versions (optional but preferred).
- Dry-run authorize and commit-time re-evaluation remain mandatory.

### FR-4 Approvals
- Approval bound to tenant/agent/policy/merchant/address/amount/currency/expiry.
- Multi-party approval option (N-of-M) as future phase; v1 production can start with single approver + strong attribution.

### FR-5 Audit & anchoring
- Append-only audit log in durable storage.
- Hash chain per tenant + periodic external anchor (object storage immutability/WORM, transparency log, or blockchain anchor) with verifiable receipts.
- Export API for audit ranges and anchor proofs.

### FR-6 Operations
- Health/readiness/liveness endpoints; metrics (Prometheus/OpenTelemetry).
- Backup/restore with integrity verification.
- Schema migrations with rollback plan.
- Rate limits, quotas, idempotency keys.

## 7. Non-functional requirements

| Area | Target (production) |
|---|---|
| Availability | >= 99.9% (phase target), multi-AZ |
| Durability | acknowledged writes fsynced/replicated; RPO near-zero for committed decisions |
| Latency | p95 evaluate/commit < 250ms intra-region (excluding external verifiers) |
| Security | encryption in transit/at rest, KMS-managed keys, least privilege |
| Auditability | 100% mutating actions attributable and exportable |
| Recovery | documented RTO/RPO; restore drills |

## 8. Proposed architecture (ADR)

### ADR-001: Storage
- **Decision:** move from file-backed JSON to transactional DB (Postgres) for control-plane state + append-only audit table; object storage/WORM for audit exports/anchors.
- **Why:** ACID transactions, row-level constraints, replication, backups, observability.
- **Consequence:** need migration tooling from CGCP/1 JSON store.

### ADR-002: API & service
- **Decision:** stateless API service behind load balancer; all state in DB; idempotency keys for commit/approval operations.
- **Why:** horizontal scalability, easier failover.
- **Consequence:** strict transaction boundaries and lock/consistency semantics required.

### ADR-003: Identity
- **Decision:** OIDC for humans, signed service tokens/mTLS for runtimes; RBAC policy layer in app; optional OPA/Cedar for advanced policy.
- **Why:** enterprise identity integration and auditable attribution.
- **Consequence:** complexity; need careful bootstrap and break-glass flow.

### ADR-004: Audit anchoring
- **Decision:** local hash chain + periodic Merkle/root anchor to external immutable witness (e.g., signed transparency log, WORM object storage manifest, or chain anchor adapter).
- **Why:** local chain alone cannot prove non-truncation/rewrite by privileged host.
- **Consequence:** anchoring is async; verification must include anchor receipts.

### ADR-005: Key management
- **Decision:** KMS/HSM for signing keys and envelope encryption; no plaintext long-lived keys in config.
- **Why:** reduce key exfiltration blast radius.
- **Consequence:** deployment dependency; local-dev fallback must be explicitly insecure/bounded.

## 9. Threat model (summary)

| Threat | Mitigation | Residual |
|---|---|---|
| Unauthorized mutation | OIDC/RBAC, short-lived tokens, mTLS, audit | compromised admin identity |
| Cross-tenant data leak | tenant id on every row, tested isolation, scoped queries | app logic bug |
| Audit rewrite/truncation | append-only storage, hash chain, external anchor, WORM export | anchor delay window |
| Replay/duplicate execution | idempotency key + unique execution id + tx constraints | caller misuse outside contract |
| Key compromise | KMS/HSM, rotation, least privilege, audit | KMS misconfig |
| Store corruption/loss | replicated DB, backups, restore drills | operator failure |
| Policy bypass | commit-time re-evaluation, immutable versioning, fail-closed | incorrect policy authored |

## 10. Migration plan from CGCP/1

1. **Export** CGCP/1 store and verify chain.
2. **Map** agents/policies/versions/approvals/executions/verifications/revocations/audit into tenant-scoped DB schema.
3. **Preserve** hashes/versions/reason codes where possible; record migration anchor.
4. **Run dual-read/verify** in staging: old decisions replayed produce same allow/deny reasons.
5. **Cutover** with freeze window; post-cutover anchor.

## 11. Verification & test plan

- **Unit/property:** decision engine determinism, reason vocabulary, idempotency.
- **Integration:** DB transactions, RBAC enforcement, tenant isolation, migration.
- **Adversarial:** replay, duplicate commit, stale approval, revoked agent, policy version race, cross-tenant access attempts.
- **Fault injection:** node crash between commit and anchor, DB failover, lock/contention, backup restore.
- **Security:** authz tests, key rotation, audit tamper detection, secret scanning, dependency audits.
- **Ops drills:** restore drill, key rotation drill, anchor verification drill.

## 12. Milestones (honest track)

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M0 | PRD/ADR approved | scope, NFRs, threats, non-goals agreed |
| M1 | Postgres schema + migration from CGCP/1 | replay parity tests pass |
| M2 | OIDC/RBAC + tenant isolation | authz matrix tests pass; no cross-tenant leak in tests |
| M3 | HA deployment + observability | failover drill meets RPO/RTO target |
| M4 | KMS + audit external anchoring | rotation/anchor verification drills pass |
| M5 | Production readiness review | security review, runbooks, SLOs, backup/restore evidence |

## 13. Current status

- CGCP/1 MVP: **BUILT** (bounded).
- CP-04..CP-11 hardening: **FIXED/HARDENED** in bounded MVP.
- CP-12..CP-14: **Boundary improved**, not fully closed.
- This PRD/ADR track: **PROPOSED / NOT_BUILT** as production system.

## 14. Open questions

- Which anchor target is acceptable first (WORM+signed manifest vs transparency log vs chain)?
- What is the minimum viable RBAC model for v1 production?
- Do we need N-of-M approvals in M1 or M2?
- What tenancy model is required by first real operator (org/project/env)?
