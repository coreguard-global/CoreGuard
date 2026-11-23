/**
 * CGCP/1 MCP Wave 2 mapping tools - deterministic, file-backed control plane operations.
 * BOUNDARIES: self-hosted single-host file-backed control plane; no distributed HA,
 * no external IdP/KMS/witness, no payment custody/broadcast. VERIFIED != SAFE.
 */
import { createControlPlane, verifyAuditChain, CONTROL_PLANE_BOUNDARY } from "./control-plane.mjs";

export const CGCP_MCP_BOUNDARY = CONTROL_PLANE_BOUNDARY +
  " MCP Wave 2 tools are CGCP/1 mappings; they do not create blockchain receipts, do not custody funds, and do not prove external settlement.";

function reqString(args, k) { const v = args?.[k]; if (typeof v !== "string" || !v) throw new Error(`${k} is required`); return v; }
function optString(args, k) { const v = args?.[k]; if (v === undefined || v === null) return undefined; if (typeof v !== "string") throw new Error(`${k} must be a string`); return v; }

function withCp(storePath) {
  return createControlPlane({ storePath, create: true });
}

export function createIntent(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const approval = cp.requestApproval({
    id: optString(args, "intentId"),
    agentId: reqString(args, "agentId"),
    policyId: optString(args, "policyId"),
    merchant: optString(args, "merchant"),
    address: optString(args, "address"),
    amountMinor: optString(args, "amountMinor"),
    currency: optString(args, "currency"),
    requestedBy: optString(args, "requestedBy"),
    expiresAt: optString(args, "expiresAt"),
  });
  return { type: "cgcp_intent", spec: "CGCP/1", intent: approval, mapping: "coreguard_create_intent -> CGCP requestApproval (intent/approval request)", boundary: CGCP_MCP_BOUNDARY };
}

export function issueReceipt(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const execution = cp.recordExecution({
    id: optString(args, "receiptId"),
    agentId: reqString(args, "agentId"),
    policyId: optString(args, "policyId"),
    approvalId: optString(args, "approvalId"),
    merchant: optString(args, "merchant"),
    address: optString(args, "address"),
    amountMinor: optString(args, "amountMinor"),
    currency: optString(args, "currency"),
    status: optString(args, "status") ?? "executed",
    txRef: optString(args, "txRef"),
    metadata: args.metadata && typeof args.metadata === "object" ? args.metadata : undefined,
  });
  return { type: "cgcp_receipt", spec: "CGCP/1", receipt: execution, mapping: "coreguard_issue_receipt -> CGCP recordExecution (execution receipt record)", boundary: CGCP_MCP_BOUNDARY };
}

export function verifyReceipt(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const report = cp.auditReport({ limit: 10000 });
  const chain = report.chain;
  const receiptId = optString(args, "receiptId");
  let receipt = null;
  let receiptFound = false;
  if (receiptId) {
    receipt = (report.recentExecutions || []).find((e) => e.id === receiptId) ||
              (report.recentVerifications || []).find((v) => v.id === receiptId || v.receiptId === receiptId) ||
              null;
    receiptFound = !!receipt;
  }
  const issues = [];
  if (!chain?.ok) issues.push("AUDIT_CHAIN_INVALID");
  if (receiptId && !receiptFound) issues.push("RECEIPT_NOT_FOUND");
  return {
    type: "cgcp_receipt_verification", spec: "CGCP/1",
    verdict: issues.length === 0 ? "VERIFIED" : "INVALID",
    issues,
    receiptId: receiptId ?? null,
    receiptFound,
    receipt,
    auditChain: chain,
    mapping: "coreguard_verify_receipt -> CGCP audit chain verification + receipt lookup in audit report",
    boundary: CGCP_MCP_BOUNDARY,
  };
}

export function checkLimits(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const decision = cp.evaluate({
    agentId: reqString(args, "agentId"),
    policyId: optString(args, "policyId"),
    merchant: optString(args, "merchant"),
    address: optString(args, "address"),
    amountMinor: optString(args, "amountMinor"),
    currency: optString(args, "currency"),
    approvalId: optString(args, "approvalId"),
  });
  return { type: "cgcp_limit_check", spec: "CGCP/1", decision, mapping: "coreguard_check_limits -> CGCP evaluate (policy/limit decision)", boundary: CGCP_MCP_BOUNDARY };
}

export function revokeConsent(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const targetType = reqString(args, "targetType"); // approval|agent|policy
  const reason = optString(args, "reason") ?? "revoked via MCP";
  let result;
  if (targetType === "approval") {
    result = cp.decideApproval(reqString(args, "targetId"), { decision: "rejected", decidedBy: optString(args, "decidedBy"), reason });
  } else if (targetType === "agent") {
    result = cp.revokeAgent(reqString(args, "targetId"), reason);
  } else if (targetType === "policy") {
    result = cp.revokePolicy(reqString(args, "targetId"), reason);
  } else {
    throw new Error("targetType must be approval, agent, or policy");
  }
  return { type: "cgcp_revocation", spec: "CGCP/1", targetType, targetId: args.targetId, result, mapping: "coreguard_revoke_consent -> CGCP revoke/decision mapping", boundary: CGCP_MCP_BOUNDARY };
}

export function auditTransaction(args = {}) {
  const storePath = reqString(args, "storePath");
  const cp = withCp(storePath);
  const limit = Number.isInteger(args.limit) ? args.limit : 200;
  const report = cp.auditReport({ limit });
  const txRef = optString(args, "txRef");
  const approvalId = optString(args, "approvalId");
  const agentId = optString(args, "agentId");
  const filterFn = (e) => {
    const d = e?.detail || {};
    if (txRef && d.txRef !== txRef && d.receiptId !== txRef && d.executionId !== txRef) return false;
    if (approvalId && d.approvalId !== approvalId) return false;
    if (agentId && d.agentId !== agentId) return false;
    return true;
  };
  if (txRef || approvalId || agentId) {
    report.recentAudit = (report.recentAudit || []).filter(filterFn);
    report.recentExecutions = (report.recentExecutions || []).filter((e) => {
      if (txRef && e.txRef !== txRef && e.id !== txRef) return false;
      if (approvalId && e.approvalId !== approvalId) return false;
      if (agentId && e.agentId !== agentId) return false;
      return true;
    });
  }
  return { type: "cgcp_audit_report", spec: "CGCP/1", report, mapping: "coreguard_audit_transaction -> CGCP auditReport/filter", boundary: CGCP_MCP_BOUNDARY };
}
