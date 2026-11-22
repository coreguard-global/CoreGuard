/**
 * CGCP Production Track — schema (PROPOSED/BUILT as code, NOT a deployed managed service).
 *
 * M1: transactional schema for agents, policies, policy_versions, approvals,
 * executions, verifications, revocations, audit_entries, tenants, identities, api_keys.
 *
 * SQLite dialect is used for deterministic local tests (node:sqlite). DDL is kept
 * Postgres-compatible where practical; a Postgres adapter is an integration target.
 */

export const PROD_SCHEMA_VERSION = "cgcp-prod/1";

export const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    kind TEXT NOT NULL, -- human|service|agent-runtime
    subject TEXT,
    email TEXT,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    roles TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    identity_id TEXT,
    key_hash TEXT NOT NULL,
    prefix TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    expires_at TEXT,
    rotated_from TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS agents (
    tenant_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_id TEXT,
    name TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revoked_at TEXT,
    revocation_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS policies (
    tenant_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS policy_versions (
    tenant_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    spec TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tenant_id, policy_id, version),
    FOREIGN KEY (tenant_id, policy_id) REFERENCES policies(tenant_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS approvals (
    tenant_id TEXT NOT NULL,
    id TEXT NOT NULL,
    agent_id TEXT,
    policy_id TEXT,
    status TEXT NOT NULL,
    merchant TEXT,
    address TEXT,
    amount_minor TEXT,
    currency TEXT,
    requested_by TEXT,
    decided_by TEXT,
    reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    hash TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS executions (
    tenant_id TEXT NOT NULL,
    id TEXT NOT NULL,
    agent_id TEXT,
    policy_id TEXT,
    approval_id TEXT,
    merchant TEXT,
    address TEXT,
    amount_minor TEXT NOT NULL,
    currency TEXT,
    receipt_id TEXT,
    verdict TEXT,
    order_ref TEXT,
    created_at TEXT NOT NULL,
    hash TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS verifications (
    tenant_id TEXT NOT NULL,
    id TEXT NOT NULL,
    execution_id TEXT,
    receipt_id TEXT,
    verdict TEXT,
    source TEXT,
    created_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS revocations (
    tenant_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, target_type, target_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_entries (
    tenant_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    at TEXT NOT NULL,
    detail TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    actor TEXT,
    request_id TEXT,
    source TEXT,
    PRIMARY KEY (tenant_id, seq),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS idempotency_keys (
    tenant_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, scope, key),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agents_tenant_status ON agents(tenant_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_executions_tenant_agent_at ON executions(tenant_id, agent_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_tenant_hash ON audit_entries(tenant_id, hash)`,
];

export const POSTGRES_DDL_NOTES = `
Postgres adaptation notes (NOT_BUILT as deployed service in this repo run):
- TEXT timestamps can be TIMESTAMPTZ; keep ISO-8601 for parity.
- JSON metadata/spec/detail columns can be JSONB.
- Add row-level security or strict tenant_id predicates in every query.
- Use SERIAL/BIGSERIAL or identity for audit seq generation under tx.
- Add foreign keys and unique constraints mirroring SQLite DDL.
- Use advisory locks or SELECT ... FOR UPDATE for commit-time spend checks.
`.trim();
