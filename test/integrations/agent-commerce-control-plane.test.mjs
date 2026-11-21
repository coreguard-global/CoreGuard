import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createControlPlane, CONTROL_PLANE_VERSION } from '../../packages/agent-commerce/control-plane.mjs';

test('control plane MVP: agent/policy/evaluate/revoke/audit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cgcp-'));
  const storePath = join(dir, 'cp.json');
  try {
    const cp = createControlPlane({ storePath });
    assert.equal(cp.version, CONTROL_PLANE_VERSION);

    cp.upsertAgent({ id: 'agent-1', name: 'Agent One' });
    cp.upsertPolicy({
      id: 'policy-1', name: 'Default', spendLimitMinor: '1000',
      allowMerchants: ['m1'], denyAddresses: ['0xbad'],
    });

    const ok = cp.evaluate({ agentId: 'agent-1', policyId: 'policy-1', merchant: 'm1', address: '0xgood', amountMinor: '500' });
    assert.equal(ok.allowed, true);
    assert.deepEqual(ok.reasons, []);

    const bad = cp.evaluate({ agentId: 'agent-1', policyId: 'policy-1', merchant: 'm2', address: '0xbad', amountMinor: '5000' });
    assert.equal(bad.allowed, false);
    assert.ok(bad.reasons.includes('MERCHANT_NOT_ALLOWED'));
    assert.ok(bad.reasons.includes('ADDRESS_DENIED'));
    assert.ok(bad.reasons.includes('SPEND_LIMIT_EXCEEDED'));

    cp.recordApproval({ id: 'ap-1', agentId: 'agent-1', policyId: 'policy-1', status: 'approved' });
    cp.recordExecution({ id: 'ex-1', agentId: 'agent-1', verdict: 'VERIFIED' });
    cp.revokeAgent('agent-1', 'test revoke');
    const revoked = cp.evaluate({ agentId: 'agent-1', policyId: 'policy-1', merchant: 'm1', address: '0xgood', amountMinor: '1' });
    assert.equal(revoked.allowed, false);
    assert.ok(revoked.reasons.includes('AGENT_REVOKED_OR_INACTIVE'));

    const report = cp.auditReport();
    assert.equal(report.counts.agents, 1);
    assert.equal(report.counts.policies, 1);
    assert.equal(report.counts.approvals, 1);
    assert.equal(report.counts.executions, 1);
    assert.equal(report.counts.revocations, 1);
    assert.ok(report.recentAudit.length >= 5);
    assert.ok(report.boundary.includes('NOT_BUILT'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
