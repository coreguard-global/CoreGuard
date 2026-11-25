import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVE4_TOOLS, WAVE4_HANDLERS, WAVE4_BOUNDARY } from '../../packages/agent-commerce/wave4.mjs';
import { selfCheck } from '../../packages/agent-commerce/mcp.mjs';

test('wave4 exports 24 tools with handlers', () => {
  assert.equal(WAVE4_TOOLS.length, 24);
  for (const t of WAVE4_TOOLS) {
    assert.equal(typeof WAVE4_HANDLERS[t.name], 'function');
    assert.equal(t.inputSchema.type, 'object');
  }
  assert.match(WAVE4_BOUNDARY, /VERIFIED ≠ SAFE/);
});

test('mcp selfCheck includes wave4', () => {
  const checks = selfCheck();
  assert.equal(checks.find(c => c[0] === 'wave 4 declares schemas for every tool')?.[1], true);
  assert.equal(checks.find(c => c[0] === 'tools exposed')?.[1], true);
});

test('wave4 sample tools return deterministic verdicts', async () => {
  const inv = WAVE4_HANDLERS.coreguard_verify_invoice_match({ invoice:{invoiceId:'i1',amountMinor:'100',currency:'USD',payeeId:'p1'}, payment:{amountMinor:'100',currency:'USD',payeeId:'p1'} });
  assert.equal(inv.status, 'OK');
  assert.equal(inv.verdict, 'PASS');
  const bad = WAVE4_HANDLERS.coreguard_verify_invoice_match({ invoice:{invoiceId:'i1',amountMinor:'100',currency:'USD'}, payment:{amountMinor:'101',currency:'USD'} });
  assert.equal(bad.verdict, 'FAIL');
});
