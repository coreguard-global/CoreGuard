/**
 * CoreGuard Control Plane v0 (local/file-backed) — BUILT_NOW (honest MVP).
 *
 * Provides: agent registry, policies, spend limits, allow/deny lists,
 * approvals, execution/decision log, receipt verification records, revocation,
 * and audit report export. File-backed JSON store for single-host durability.
 *
 * NOT_BUILT (explicit): multi-user auth/RBAC/SSO, distributed consensus/HA,
 * cross-device sync, secrets/KMS, tenancy isolation, production SLA, managed
 * hosting. VERIFIED ≠ SAFE.
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export const CONTROL_PLANE_VERSION = 'CGCP/0.1';
export const CONTROL_PLANE_BOUNDARY = 'local/file-backed single-host control plane; NOT_BUILT: multi-user RBAC/SSO, distributed HA, cross-device sync, KMS/secrets, managed hosting';

const nowIso = () => new Date().toISOString();
const hash = (obj) => 'sha256:' + createHash('sha256').update(JSON.stringify(obj)).digest('hex');

function load(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp-' + process.pid + '-' + Math.random().toString(16).slice(2);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}

function defaultState() {
  return {
    version: CONTROL_PLANE_VERSION,
    boundary: CONTROL_PLANE_BOUNDARY,
    agents: {},
    policies: {},
    approvals: {},
    executions: [],
    revocations: {},
    audit: [],
  };
}

export function createControlPlane({ storePath }) {
  if (!storePath || typeof storePath !== 'string') throw new Error('storePath is required');
  let state = load(storePath) || defaultState();
  const persist = () => { state.updatedAt = nowIso(); save(storePath, state); };
  const audit = (type, detail) => {
    const entry = { id: randomUUID(), type, at: nowIso(), detail };
    state.audit.push(entry);
    return entry;
  };

  function upsertAgent(agent) {
    if (!agent?.id) throw new Error('agent.id required');
    const prev = state.agents[agent.id] || {};
    state.agents[agent.id] = {
      ...prev,
      ...agent,
      id: agent.id,
      status: agent.status || prev.status || 'active',
      updatedAt: nowIso(),
      createdAt: prev.createdAt || nowIso(),
    };
    audit('agent.upsert', { agentId: agent.id, status: state.agents[agent.id].status });
    persist();
    return state.agents[agent.id];
  }

  function upsertPolicy(policy) {
    if (!policy?.id) throw new Error('policy.id required');
    const prev = state.policies[policy.id] || {};
    state.policies[policy.id] = {
      ...prev,
      ...policy,
      id: policy.id,
      status: policy.status || prev.status || 'active',
      spendLimitMinor: policy.spendLimitMinor ?? prev.spendLimitMinor ?? null,
      allowMerchants: policy.allowMerchants ?? prev.allowMerchants ?? [],
      denyMerchants: policy.denyMerchants ?? prev.denyMerchants ?? [],
      allowAddresses: policy.allowAddresses ?? prev.allowAddresses ?? [],
      denyAddresses: policy.denyAddresses ?? prev.denyAddresses ?? [],
      updatedAt: nowIso(),
      createdAt: prev.createdAt || nowIso(),
    };
    audit('policy.upsert', { policyId: policy.id, status: state.policies[policy.id].status });
    persist();
    return state.policies[policy.id];
  }

  function revokeAgent(agentId, reason = '') {
    if (!state.agents[agentId]) throw new Error('unknown agent');
    state.agents[agentId].status = 'revoked';
    state.agents[agentId].updatedAt = nowIso();
    state.revocations[agentId] = { agentId, reason, at: nowIso() };
    audit('agent.revoke', { agentId, reason });
    persist();
    return state.agents[agentId];
  }

  function recordApproval(approval) {
    if (!approval?.id) throw new Error('approval.id required');
    if (!approval?.agentId) throw new Error('approval.agentId required');
    const record = { ...approval, status: approval.status || 'approved', at: approval.at || nowIso(), hash: hash(approval) };
    state.approvals[approval.id] = record;
    audit('approval.record', { approvalId: approval.id, agentId: approval.agentId, status: record.status });
    persist();
    return record;
  }

  function recordExecution(execution) {
    if (!execution?.id) throw new Error('execution.id required');
    const record = { ...execution, at: execution.at || nowIso(), hash: hash(execution) };
    state.executions.push(record);
    audit('execution.record', { executionId: execution.id, agentId: execution.agentId, verdict: execution.verdict });
    persist();
    return record;
  }

  function evaluate({ agentId, policyId, merchant, address, amountMinor }) {
    const agent = state.agents[agentId];
    const policy = state.policies[policyId];
    const reasons = [];
    if (!agent) reasons.push('UNKNOWN_AGENT');
    if (agent && agent.status !== 'active') reasons.push('AGENT_REVOKED_OR_INACTIVE');
    if (!policy) reasons.push('UNKNOWN_POLICY');
    if (policy && policy.status !== 'active') reasons.push('POLICY_INACTIVE');
    if (policy?.denyMerchants?.includes(merchant)) reasons.push('MERCHANT_DENIED');
    if (policy?.allowMerchants?.length && !policy.allowMerchants.includes(merchant)) reasons.push('MERCHANT_NOT_ALLOWED');
    if (policy?.denyAddresses?.includes(address)) reasons.push('ADDRESS_DENIED');
    if (policy?.allowAddresses?.length && !policy.allowAddresses.includes(address)) reasons.push('ADDRESS_NOT_ALLOWED');
    if (policy?.spendLimitMinor != null && amountMinor != null && BigInt(amountMinor) > BigInt(policy.spendLimitMinor)) reasons.push('SPEND_LIMIT_EXCEEDED');
    const allowed = reasons.length === 0;
    const decision = { allowed, reasons, agentId, policyId, merchant, address, amountMinor: amountMinor ?? null, at: nowIso() };
    audit('policy.evaluate', decision);
    persist();
    return decision;
  }

  function auditReport({ limit = 200 } = {}) {
    return {
      version: CONTROL_PLANE_VERSION,
      boundary: CONTROL_PLANE_BOUNDARY,
      generatedAt: nowIso(),
      counts: {
        agents: Object.keys(state.agents).length,
        policies: Object.keys(state.policies).length,
        approvals: Object.keys(state.approvals).length,
        executions: state.executions.length,
        revocations: Object.keys(state.revocations).length,
        audit: state.audit.length,
      },
      agents: Object.values(state.agents),
      policies: Object.values(state.policies),
      revocations: Object.values(state.revocations),
      recentExecutions: state.executions.slice(-limit),
      recentAudit: state.audit.slice(-limit),
    };
  }

  return {
    version: CONTROL_PLANE_VERSION,
    boundary: CONTROL_PLANE_BOUNDARY,
    storePath,
    upsertAgent, upsertPolicy, revokeAgent, recordApproval, recordExecution, evaluate, auditReport,
    getState: () => JSON.parse(JSON.stringify(state)),
  };
}
