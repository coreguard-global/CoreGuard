import { readFileSync } from "node:fs";
import { openSqliteStorage } from "./sqlite-storage.mjs";
import { canonicalJson, verifyAuditChain } from "../control-plane.mjs";

export function loadCgcp1Store(storePath) {
  const data = JSON.parse(readFileSync(storePath, "utf8"));
  if (data?.schema !== "coreguard.control-plane/1") throw new Error(`expected coreguard.control-plane/1, got ${data?.schema}`);
  return data;
}

export function migrateCgcp1ToSqlite({ sourcePath, targetPath, tenantId = "default", tenantName = "Migrated CGCP/1" } = {}) {
  const src = loadCgcp1Store(sourcePath);
  const chain = verifyAuditChain(src);
  if (!chain.ok) throw new Error(`source audit chain invalid: ${chain.reason} at ${chain.brokenAt}`);
  const db = openSqliteStorage(targetPath);
  const report = { tenantId, sourceSchema: src.schema, ok: false, counts: {} };
  db.tx(() => {
    db.ensureTenant({ id: tenantId, name: tenantName, status: "active", createdAt: src.createdAt ?? new Date().toISOString(), metadata: { migratedFrom: sourcePath, migratedAt: new Date().toISOString(), sourceBoundary: src.boundary ?? null } });
    for (const agent of Object.values(src.agents ?? {})) {
      db.upsertAgent(tenantId, { id: agent.id, status: agent.status, policyId: agent.policyId ?? null, name: agent.name ?? null, metadata: agent.metadata ?? {}, revokedAt: agent.revokedAt ?? null, revocationReason: agent.revocationReason ?? null });
    }
    for (const policy of Object.values(src.policies ?? {})) {
      db.upsertPolicy(tenantId, { id: policy.id, status: policy.status ?? "active", metadata: policy.metadata ?? {} });
      for (const v of (policy.versions ?? [])) {
        db.upsertPolicyVersion(tenantId, policy.id, v.version, v.spec ?? {}, v.createdAt ?? src.createdAt, v.createdBy ?? null);
      }
    }
    for (const approval of Object.values(src.approvals ?? {})) {
      db.putApproval(tenantId, {
        id: approval.id, agentId: approval.agentId, policyId: approval.policyId, status: approval.status,
        merchant: approval.merchant ?? null, address: approval.address ?? null, amountMinor: approval.amountMinor ?? null,
        currency: approval.currency ?? null, requestedBy: approval.requestedBy ?? null, decidedBy: approval.decidedBy ?? null,
        reason: approval.reason ?? null,
        createdAt: approval.createdAt ?? approval.requestedAt ?? src.createdAt ?? new Date().toISOString(),
        updatedAt: approval.updatedAt ?? approval.decidedAt ?? approval.requestedAt ?? approval.createdAt ?? src.createdAt ?? new Date().toISOString(),
        expiresAt: approval.expiresAt ?? null, hash: approval.hash ?? null, metadata: { ...(approval.metadata ?? {}), requestedAt: approval.requestedAt ?? null, decidedAt: approval.decidedAt ?? null },
      });
    }
    for (const ex of (src.executions ?? [])) {
      db.putExecution(tenantId, {
        id: ex.id, agentId: ex.agentId, policyId: ex.policyId, approvalId: ex.approvalId ?? null, merchant: ex.merchant ?? null,
        address: ex.address ?? null, amountMinor: ex.amountMinor, currency: ex.currency ?? null, receiptId: ex.receiptId ?? null,
        verdict: ex.verdict ?? null, orderRef: ex.orderRef ?? null, createdAt: ex.createdAt ?? ex.at ?? src.createdAt ?? new Date().toISOString(), hash: ex.hash ?? null, metadata: ex.metadata ?? {},
      });
    }
    for (const v of (src.verifications ?? [])) {
      db.putVerification(tenantId, { ...v, createdAt: v.createdAt ?? v.at ?? src.createdAt ?? new Date().toISOString() });
    }
    for (const r of Object.values(src.revocations ?? {})) {
      db.putRevocation(tenantId, { targetType: r.targetType, targetId: r.targetId, reason: r.reason ?? null, createdAt: r.createdAt ?? r.at ?? src.createdAt ?? new Date().toISOString(), metadata: r.metadata ?? {} });
    }
    for (const a of (src.audit ?? [])) {
      db.appendAudit(tenantId, { seq: a.seq, type: a.type, at: a.at, detail: a.detail ?? {}, prevHash: a.prevHash, hash: a.hash, actor: a.actor ?? null, requestId: a.requestId ?? null, source: a.source ?? null });
    }
    report.counts = {
      agents: Object.keys(src.agents ?? {}).length,
      policies: Object.keys(src.policies ?? {}).length,
      approvals: Object.keys(src.approvals ?? {}).length,
      executions: (src.executions ?? []).length,
      verifications: (src.verifications ?? []).length,
      revocations: Object.keys(src.revocations ?? {}).length,
      audit: (src.audit ?? []).length,
    };
    report.ok = true;
  });
  const exported = db.exportTenantState(tenantId);
  report.exportedCounts = {
    agents: exported.agents.length, policies: exported.policies.length, approvals: exported.approvals.length,
    executions: exported.executions.length, verifications: exported.verifications.length, revocations: exported.revocations.length, audit: exported.audit.length,
  };
  report.parity = JSON.stringify(report.counts) === JSON.stringify(report.exportedCounts);
  return { report, db, source: src };
}
