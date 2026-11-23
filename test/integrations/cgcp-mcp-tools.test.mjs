import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIntent, issueReceipt, verifyReceipt, checkLimits, revokeConsent, auditTransaction } from "../../packages/agent-commerce/cgcp-mcp-tools.mjs";
import { createControlPlane } from "../../packages/agent-commerce/control-plane.mjs";

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-mcp-"));
  const path = join(dir, "cp.json");
  const cp = createControlPlane({ storePath: path, create: true });
  cp.upsertAgent({ id: "agent1", status: "active" });
  cp.upsertPolicy({ id: "pol1", name: "p", status: "active", maxAmountMinor: "10000", currency: "USD" });
  cp.bindPolicy("agent1", "pol1");
  return path;
}

test("createIntent -> issueReceipt -> verifyReceipt -> auditTransaction roundtrip", () => {
  const storePath = tempStore();
  const intent = createIntent({ storePath, intentId: "ap_1", agentId: "agent1", amountMinor: "100", currency: "USD" });
  assert.equal(intent.spec, "CGCP/1");
  assert.equal(intent.intent.id, "ap_1");
  const receipt = issueReceipt({ storePath, receiptId: "ex_1", agentId: "agent1", approvalId: "ap_1", amountMinor: "100", currency: "USD" });
  assert.equal(receipt.receipt.id, "ex_1");
  const vr = verifyReceipt({ storePath, receiptId: "ex_1" });
  assert.equal(vr.verdict, "VERIFIED");
  assert.equal(vr.receiptFound, true);
  const audit = auditTransaction({ storePath, approvalId: "ap_1" });
  assert.equal(audit.report.chain.ok, true);
  assert.ok(audit.report.recentAudit.length > 0);
});

test("checkLimits maps CGCP evaluate decision", () => {
  const storePath = tempStore();
  const r = checkLimits({ storePath, agentId: "agent1", amountMinor: "50", currency: "USD" });
  assert.equal(r.type, "cgcp_limit_check");
  assert.ok(r.decision);
});

test("revokeConsent rejects a pending approval and records audit", () => {
  const storePath = tempStore();
  createIntent({ storePath, intentId: "ap_rev", agentId: "agent1" });
  const r = revokeConsent({ storePath, targetType: "approval", targetId: "ap_rev", reason: "test revoke" });
  assert.equal(r.targetType, "approval");
  assert.equal(r.result.status, "rejected");
  const audit = auditTransaction({ storePath, approvalId: "ap_rev" });
  assert.ok(audit.report.recentAudit.some(e => e.type === "approval.rejected"));
});
