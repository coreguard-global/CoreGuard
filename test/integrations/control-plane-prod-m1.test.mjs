import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "../../packages/agent-commerce/control-plane.mjs";
import { migrateCgcp1ToSqlite } from "../../packages/agent-commerce/prod/migrate.mjs";

test("M1: CGCP/1 store migrates to prod sqlite with count+audit parity", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-m1-"));
  const srcPath = join(dir, "cgcp1.json");
  const tgtPath = join(dir, "prod.sqlite");
  try {
    const cp = createControlPlane({ storePath: srcPath, create: true });
    cp.upsertPolicy({ id: "p1", spec: { currency: "USD", perTransactionMinor: "5000", dailyMinor: "10000", merchantAllow: ["m1"] } });
    cp.upsertAgent({ id: "a1", policyId: "p1", status: "active" });
    const appr = cp.requestApproval({ id: "ap1", agentId: "a1", merchant: "m1", amountMinor: "2500", currency: "USD", requestedBy: "op" });
    cp.decideApproval("ap1", { decision: "approved", decidedBy: "op" });
    cp.commitExecution({ id: "e1", agentId: "a1", merchant: "m1", amountMinor: "2500", currency: "USD", approvalId: "ap1", receiptId: "r1", verdict: "PASS" });
    cp.recordVerification({ executionId: "e1", receiptId: "r1", verdict: "PASS", source: "test" });
    const { report, db } = migrateCgcp1ToSqlite({ sourcePath: srcPath, targetPath: tgtPath, tenantId: "tenant-a" });
    assert.equal(report.ok, true);
    assert.equal(report.parity, true);
    assert.equal(report.exportedCounts.agents, 1);
    assert.equal(report.exportedCounts.policies, 1);
    assert.equal(report.exportedCounts.approvals, 1);
    assert.equal(report.exportedCounts.executions, 1);
    assert.equal(report.exportedCounts.verifications, 1);
    assert.equal(report.exportedCounts.audit > 0, true);
    const exported = db.exportTenantState("tenant-a");
    assert.equal(exported.agents[0].id, "a1");
    assert.equal(exported.executions[0].amountMinor, "2500");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
