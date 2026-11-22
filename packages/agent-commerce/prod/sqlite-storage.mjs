import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { SQLITE_DDL, PROD_SCHEMA_VERSION } from "./schema.mjs";

export function openSqliteStorage(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  for (const ddl of SQLITE_DDL) db.exec(ddl);
  const getMeta = db.prepare("SELECT value FROM meta WHERE key=?");
  const setMeta = db.prepare("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const ver = getMeta.get("schema_version");
  const runB = (stmt, ...args) => stmt.run(...args.map(b));
  if (!ver) runB(setMeta, "schema_version", PROD_SCHEMA_VERSION);
  else if (ver.value !== PROD_SCHEMA_VERSION) throw new Error(`schema version mismatch: ${ver.value} != ${PROD_SCHEMA_VERSION}`);
  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try { const out = fn(); db.exec("COMMIT"); return out; }
    catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
  };

  function j(v, fallback) { return v == null ? fallback : JSON.parse(v); }
  function nowIso() { return new Date().toISOString(); }
  function b(v) {
    if (v === undefined) return null;
    if (v === null) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
    if (v instanceof Buffer || v instanceof Uint8Array) return v;
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v);
  }

  return {
    kind: "sqlite",
    path,
    db,
    tx,
    close() { db.close(); },
    ensureTenant(tenant = {}) {
      const id = String(tenant.id || "default");
      const now = nowIso();
      runB(db.prepare(`INSERT INTO tenants(id,name,status,created_at,updated_at,metadata) VALUES(?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name,tenants.name), status=excluded.status, updated_at=excluded.updated_at, metadata=excluded.metadata`),
        id, tenant.name ?? null, tenant.status ?? "active", tenant.createdAt ?? now, now, JSON.stringify(tenant.metadata ?? {}));
      return db.prepare("SELECT * FROM tenants WHERE id=?").get(id);
    },
    getTenant(id) { const r = db.prepare("SELECT * FROM tenants WHERE id=?").get(String(id)); return r ? { ...r, metadata: j(r.metadata, {}) } : null; },
    upsertAgent(tenantId, agent) {
      const now = nowIso();
      const prev = db.prepare("SELECT * FROM agents WHERE tenant_id=? AND id=?").get(tenantId, agent.id);
      if (prev) {
        runB(db.prepare(`UPDATE agents SET status=?, policy_id=?, name=?, metadata=?, updated_at=?, revoked_at=?, revocation_reason=?, version=version+1 WHERE tenant_id=? AND id=?`),
          agent.status ?? prev.status, agent.policyId ?? prev.policy_id, agent.name ?? prev.name, JSON.stringify(agent.metadata ?? j(prev.metadata, {})), now, agent.revokedAt ?? prev.revoked_at, agent.revocationReason ?? prev.revocation_reason, tenantId, agent.id);
      } else {
        runB(db.prepare(`INSERT INTO agents(tenant_id,id,status,policy_id,name,metadata,created_at,updated_at,revoked_at,revocation_reason,version) VALUES(?,?,?,?,?,?,?,?,?,?,1)`),
          tenantId, agent.id, agent.status ?? "active", agent.policyId ?? null, agent.name ?? null, JSON.stringify(agent.metadata ?? {}), now, now, agent.revokedAt ?? null, agent.revocationReason ?? null);
      }
      return this.getAgent(tenantId, agent.id);
    },
    getAgent(tenantId, id) { const r = db.prepare("SELECT * FROM agents WHERE tenant_id=? AND id=?").get(tenantId, String(id)); return r ? mapAgent(r) : null; },
    listAgents(tenantId) { return db.prepare("SELECT * FROM agents WHERE tenant_id=? ORDER BY id").all(tenantId).map(mapAgent); },
    upsertPolicy(tenantId, policy) {
      const now = nowIso();
      const prev = db.prepare("SELECT * FROM policies WHERE tenant_id=? AND id=?").get(tenantId, policy.id);
      if (!prev) runB(db.prepare(`INSERT INTO policies(tenant_id,id,status,created_at,updated_at,metadata) VALUES(?,?,?,?,?,?)`), tenantId, policy.id, policy.status ?? "active", now, now, JSON.stringify(policy.metadata ?? {}));
      else runB(db.prepare(`UPDATE policies SET status=?, updated_at=?, metadata=? WHERE tenant_id=? AND id=?`), policy.status ?? prev.status, now, JSON.stringify(policy.metadata ?? j(prev.metadata, {})), tenantId, policy.id);
      return this.getPolicy(tenantId, policy.id);
    },
    upsertPolicyVersion(tenantId, policyId, version, spec, createdAt, createdBy) {
      runB(db.prepare(`INSERT OR REPLACE INTO policy_versions(tenant_id,policy_id,version,spec,created_at,created_by,active) VALUES(?,?,?,?,?,?,1)`), tenantId, policyId, version, JSON.stringify(spec ?? {}), createdAt, createdBy ?? null);
      runB(db.prepare(`UPDATE policy_versions SET active=CASE WHEN version=? THEN 1 ELSE 0 END WHERE tenant_id=? AND policy_id=?`), version, tenantId, policyId);
    },
    getPolicy(tenantId, id) {
      const p = db.prepare("SELECT * FROM policies WHERE tenant_id=? AND id=?").get(tenantId, String(id));
      if (!p) return null;
      const versions = db.prepare("SELECT * FROM policy_versions WHERE tenant_id=? AND policy_id=? ORDER BY version").all(tenantId, String(id)).map(mapPolicyVersion);
      return { ...p, metadata: j(p.metadata, {}), versions, activeVersion: versions.filter(v=>v.active).at(-1) ?? versions.at(-1) ?? null };
    },
    listPolicies(tenantId) { return db.prepare("SELECT * FROM policies WHERE tenant_id=? ORDER BY id").all(tenantId).map(p => this.getPolicy(tenantId, p.id)); },
    putApproval(tenantId, a) {
      runB(db.prepare(`INSERT OR REPLACE INTO approvals(tenant_id,id,agent_id,policy_id,status,merchant,address,amount_minor,currency,requested_by,decided_by,reason,created_at,updated_at,expires_at,hash,metadata)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`), tenantId, a.id, a.agentId ?? null, a.policyId ?? null, a.status, a.merchant ?? null, a.address ?? null, a.amountMinor ?? null, a.currency ?? null, a.requestedBy ?? null, a.decidedBy ?? null, a.reason ?? null, a.createdAt, a.updatedAt ?? a.createdAt, a.expiresAt ?? null, a.hash ?? null, JSON.stringify(a.metadata ?? {}));
      return this.getApproval(tenantId, a.id);
    },
    getApproval(tenantId, id) { const r = db.prepare("SELECT * FROM approvals WHERE tenant_id=? AND id=?").get(tenantId, String(id)); return r ? mapApproval(r) : null; },
    putExecution(tenantId, e) {
      runB(db.prepare(`INSERT INTO executions(tenant_id,id,agent_id,policy_id,approval_id,merchant,address,amount_minor,currency,receipt_id,verdict,order_ref,created_at,hash,metadata)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`), tenantId, e.id, e.agentId ?? null, e.policyId ?? null, e.approvalId ?? null, e.merchant ?? null, e.address ?? null, String(e.amountMinor), e.currency ?? null, e.receiptId ?? null, e.verdict ?? null, e.orderRef ?? null, e.createdAt, e.hash ?? null, JSON.stringify(e.metadata ?? {}));
      return this.getExecution(tenantId, e.id);
    },
    getExecution(tenantId, id) { const r = db.prepare("SELECT * FROM executions WHERE tenant_id=? AND id=?").get(tenantId, String(id)); return r ? mapExecution(r) : null; },
    listExecutions(tenantId, limit=200) { return db.prepare("SELECT * FROM executions WHERE tenant_id=? ORDER BY created_at, id DESC LIMIT ?").all(tenantId, limit).map(mapExecution).reverse(); },
    putVerification(tenantId, v) {
      const id = v.id || randomUUID();
      runB(db.prepare(`INSERT INTO verifications(tenant_id,id,execution_id,receipt_id,verdict,source,created_at,metadata) VALUES(?,?,?,?,?,?,?,?)`),
        tenantId, id, v.executionId ?? null, v.receiptId ?? null, v.verdict ?? null, v.source ?? null, v.createdAt ?? nowIso(), JSON.stringify(v.metadata ?? {}));
      return db.prepare("SELECT * FROM verifications WHERE tenant_id=? AND id=?").get(tenantId, id);
    },
    listVerifications(tenantId, limit=200) { return db.prepare("SELECT * FROM verifications WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?").all(tenantId, limit).map(r=>({ ...r, metadata: j(r.metadata,{}) })); },
    putRevocation(tenantId, r) {
      runB(db.prepare(`INSERT OR REPLACE INTO revocations(tenant_id,target_type,target_id,reason,created_at,metadata) VALUES(?,?,?,?,?,?)`),
        tenantId, r.targetType, r.targetId, r.reason ?? null, r.createdAt ?? nowIso(), JSON.stringify(r.metadata ?? {}));
      return r;
    },
    appendAudit(tenantId, entry) {
      runB(db.prepare(`INSERT INTO audit_entries(tenant_id,seq,type,at,detail,prev_hash,hash,actor,request_id,source) VALUES(?,?,?,?,?,?,?,?,?,?)`),
        tenantId, entry.seq, entry.type, entry.at, JSON.stringify(entry.detail ?? {}), entry.prevHash, entry.hash, entry.actor ?? null, entry.requestId ?? null, entry.source ?? null);
      return entry;
    },
    listAudit(tenantId, limit=500) { return db.prepare("SELECT * FROM audit_entries WHERE tenant_id=? ORDER BY seq DESC LIMIT ?").all(tenantId, limit).map(mapAudit).reverse(); },
    auditHead(tenantId) { return db.prepare("SELECT * FROM audit_entries WHERE tenant_id=? ORDER BY seq DESC LIMIT 1").get(tenantId) ?? null; },
    count(tenantId, table) { return db.prepare(`SELECT COUNT(*) as n FROM ${table} WHERE tenant_id=?`).get(tenantId).n; },
    exportTenantState(tenantId) {
      const tenant = this.getTenant(tenantId);
      return {
        schema: PROD_SCHEMA_VERSION,
        tenant,
        agents: this.listAgents(tenantId),
        policies: this.listPolicies(tenantId),
        approvals: db.prepare("SELECT * FROM approvals WHERE tenant_id=? ORDER BY created_at,id").all(tenantId).map(mapApproval),
        executions: db.prepare("SELECT * FROM executions WHERE tenant_id=? ORDER BY created_at,id").all(tenantId).map(mapExecution),
        verifications: this.listVerifications(tenantId, 100000),
        revocations: db.prepare("SELECT * FROM revocations WHERE tenant_id=?").all(tenantId).map(r=>({ ...r, metadata:j(r.metadata,{}) })),
        audit: this.listAudit(tenantId, 1000000),
      };
    },
  };
}

function mapAgent(r) { return { ...r, policyId: r.policy_id, createdAt: r.created_at, updatedAt: r.updated_at, revokedAt: r.revoked_at, revocationReason: r.revocation_reason, metadata: JSON.parse(r.metadata||"{}") }; }
function mapPolicyVersion(r) { return { ...r, policyId: r.policy_id, createdAt: r.created_at, createdBy: r.created_by, active: !!r.active, spec: JSON.parse(r.spec||"{}") }; }
function mapApproval(r) { return { ...r, agentId:r.agent_id, policyId:r.policy_id, amountMinor:r.amount_minor, requestedBy:r.requested_by, decidedBy:r.decided_by, createdAt:r.created_at, updatedAt:r.updated_at, expiresAt:r.expires_at, metadata: JSON.parse(r.metadata||"{}") }; }
function mapExecution(r) { return { ...r, agentId:r.agent_id, policyId:r.policy_id, approvalId:r.approval_id, amountMinor:r.amount_minor, receiptId:r.receipt_id, orderRef:r.order_ref, createdAt:r.created_at, metadata: JSON.parse(r.metadata||"{}") }; }
function mapAudit(r) { return { ...r, prevHash:r.prev_hash, requestId:r.request_id, detail: JSON.parse(r.detail||"{}") }; }
