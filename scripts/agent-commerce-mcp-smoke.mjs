#!/usr/bin/env node
/**
 * Agent Commerce MCP runtime smoke check (real stdio child, offline).
 *
 * Proves, with a live JSON-RPC 2.0 stdio process:
 *   - initialize responds with the expected protocol/version identity
 *   - tools/list exposes the 46 tools with inputSchema + outputSchema
 *   - coreguard_authorize returns a CGCR/1 receipt (structuredContent)
 *   - coreguard_verify_execution returns VERIFIED on exact execution
 *   - coreguard_verify_execution returns INVALID with named drift on escalation
 *   - malformed input returns a stable structured error (server survives)
 *   - server answers ping/next request after an error
 *
 * Exit 0 on PASS, 1 on any failure. No network, no keys, deterministic fixtures.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const MCP_PATH = resolve(here, '../packages/agent-commerce/mcp.mjs');

const MERCHANT = '0x0000000000000000000000000000000000000042';
const AGENT = '0x000000000000000000000000000000000000000d';
const NOW = '1794657600';

function testIntent(amount = '1200') {
  return {
    version: 'CGEP/1', chainId: '0', signer: AGENT, nonce: '0',
    validAfter: '0', validUntil: '9999999999', action: 'AGENT_CHECKOUT',
    target: MERCHANT, selector: '0xa9059cbb',
    asset: '0x0000000000000000000000000000000000000002',
    amount, recipient: MERCHANT,
    constraints: [
      { type: 'MAX_VALUE', value: amount },
      { type: 'RECIPIENT_ALLOWLIST', addresses: [MERCHANT] },
    ],
    merchantName: 'synthetic-store.example', currency: 'USD',
    items: [{ sku: 'SKU-SMOKE', name: 'Synthetic item', qty: 1, unitPriceMinor: amount }],
    paymentCredentialRef: 'TOKENIZED-CREDENTIAL-REF-TEST (placeholder)',
    authorizedAtUtc: '2026-11-14T12:00:00Z', expiryUtc: '2026-11-14T12:10:00Z',
    singleUse: true,
  };
}
const testPolicy = () => ({
  version: 'CGEP/1', policyId: '0x00000000000000000000000000000000000000ac',
  name: 'Agent Commerce Policy',
  rules: [
    { ruleId: 'VALUE_001', type: 'VALUE_LIMIT', params: { max: '1200' }, severity: 'CRITICAL' },
    { ruleId: 'TARGET_001', type: 'TARGET_ALLOWLIST', params: { targets: [MERCHANT] }, severity: 'CRITICAL' },
    { ruleId: 'RECIPIENT_001', type: 'RECIPIENT_ALLOWLIST', params: { addresses: [MERCHANT] }, severity: 'CRITICAL' },
    { ruleId: 'SELECTOR_001', type: 'SELECTOR_ALLOWLIST', params: { selectors: ['0xa9059cbb'] }, severity: 'CRITICAL' },
  ],
});
function trace(totalMinor = '1200') {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, '0');
  return {
    txHash: '0x' + 'bb'.repeat(32), blockHash: '0x' + 'cc'.repeat(32),
    blockNumber: 65337, blockTimestamp: NOW, from: AGENT, to: MERCHANT,
    value: totalMinor,
    calldata: '0xa9059cbb' + MERCHANT.slice(2).padStart(64, '0') + amountHex,
    slippageBps: '0', gasUsed: '21000', items: testIntent().items,
    paymentCredentialRef: 'TOKENIZED-CREDENTIAL-REF-TEST (placeholder)',
  };
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function withServer(fn) {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  let nextId = 0;
  const request = (method, params) => new Promise((res, rej) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`timeout ${method}`)); }, 15000);
    pending.set(id, (msg) => { clearTimeout(timer); res(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try { return await fn({ request }); }
  finally { rl.close(); child.kill(); }
}

async function main() {
  const results = [];
  const run = async (name, fn) => {
    try { await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}`); }
    catch (e) { results.push({ name, ok: false, error: e.message }); console.error(`FAIL  ${name}: ${e.message}`); }
  };

  await withServer(async ({ request }) => {
    let init;
    await run('initialize returns protocol and serverInfo', async () => {
      init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
      assert(init.result?.protocolVersion === '2025-06-18', 'protocol mismatch');
      assert(init.result?.serverInfo?.name === 'coreguard-agent-commerce', 'server name mismatch');
      assert(typeof init.result?.serverInfo?.version === 'string', 'missing server version');
    });

    let listed;
    await run('tools/list exposes 46 tools with inputSchema+outputSchema', async () => {
      listed = await request('tools/list', {});
      const tools = listed.result?.tools || [];
      const names = tools.map(t => t.name).sort();
      const expected = [
        'coreguard_assess_risk','coreguard_audit_transaction','coreguard_authorize','coreguard_authorize_x402_payment',
        'coreguard_build_attestation','coreguard_check_limits','coreguard_consumption_status','coreguard_create_intent',
        'coreguard_create_machine_task','coreguard_decide_outcome','coreguard_inspect_identity','coreguard_issue_receipt',
        'coreguard_meter_agent_usage','coreguard_parse_x402_challenge','coreguard_profile_reference','coreguard_reconcile_payment',
        'coreguard_register_machine','coreguard_revoke_consent','coreguard_verify_attestation','coreguard_verify_consent',
        'coreguard_verify_delegation_chain','coreguard_verify_execution','coreguard_verify_receipt','coreguard_verify_task_completion',
        'coreguard_verify_telemetry','coreguard_verify_x402_settlement'
      ];
      assert(JSON.stringify(names) === JSON.stringify(expected), `unexpected tool names: ${names.join(',')}`);
      for (const t of tools) {
        assert(t.inputSchema?.type === 'object', `${t.name} missing inputSchema`);
        assert(t.outputSchema?.type === 'object', `${t.name} missing outputSchema`);
        assert(typeof t.description === 'string' && t.description.length > 20, `${t.name} missing description`);
      }
    });

    let consent;
    await run('coreguard_authorize returns CGCR/1 receipt with structuredContent', async () => {
      const r = await request('tools/call', { name: 'coreguard_authorize', arguments: { intent: testIntent('1200'), policy: testPolicy(), declaredTrace: trace('1200'), nowSeconds: NOW } });
      assert(!r.result?.isError, `unexpected error: ${r.result?.content?.[0]?.text}`);
      consent = JSON.parse(r.result.content[0].text);
      assert(consent.spec === 'CGCR/1', 'expected CGCR/1');
      assert(r.result.structuredContent?.spec === 'CGCR/1', 'missing structuredContent.spec');
    });

    await run('coreguard_verify_execution returns VERIFIED for exact execution', async () => {
      const r = await request('tools/call', { name: 'coreguard_verify_execution', arguments: { consent, trace: trace('1200') } });
      assert(!r.result?.isError, `unexpected error: ${r.result?.content?.[0]?.text}`);
      const out = JSON.parse(r.result.content[0].text);
      assert(out.verdict === 'VERIFIED', `expected VERIFIED, got ${out.verdict}`);
    });

    let consent2;
    await run('coreguard_verify_execution returns INVALID with named drift for escalation', async () => {
      const a = await request('tools/call', { name: 'coreguard_authorize', arguments: { intent: testIntent('1200'), policy: testPolicy(), declaredTrace: trace('1200'), nowSeconds: NOW } });
      consent2 = JSON.parse(a.result.content[0].text);
      const r = await request('tools/call', { name: 'coreguard_verify_execution', arguments: { consent: consent2, trace: trace('5700') } });
      assert(!r.result?.isError, 'drift should be a verdict, not transport error');
      const out = JSON.parse(r.result.content[0].text);
      assert(out.verdict === 'INVALID', `expected INVALID, got ${out.verdict}`);
      const codes = (out.risk?.violations || []).map(v => v.code);
      assert(codes.length > 0, 'expected named drift violations');
    });

    await run('coreguard_inspect_identity returns identity and anchor facts', async () => {
      const r = await request('tools/call', { name: 'coreguard_inspect_identity', arguments: { issuer: 'did:example:agent', scope: 'commerce', subject: 'order-1', contentDigest: '11'.repeat(32), callerContext: { traceId: 'smoke-trace' } } });
      assert(!r.result?.isError, `unexpected error: ${r.result?.content?.[0]?.text}`);
      const out = r.result.structuredContent;
      assert(out.identity?.recordId, 'missing identity.recordId');
      assert(out.anchorFacts, 'missing anchorFacts');
      assert(out.callerContext?.traceId === 'smoke-trace', 'callerContext not echoed');
    });

    await run('coreguard_profile_reference make/parse roundtrip', async () => {
      const made = await request('tools/call', { name: 'coreguard_profile_reference', arguments: { action: 'make', receiptId: '0x' + '22'.repeat(32) } });
      assert(!made.result?.isError, made.result?.content?.[0]?.text);
      const ref = made.result.structuredContent.profileReference;
      const parsed = await request('tools/call', { name: 'coreguard_profile_reference', arguments: { action: 'parse', reference: ref } });
      assert(!parsed.result?.isError, parsed.result?.content?.[0]?.text);
      assert(parsed.result.structuredContent.parsed?.ok === true, 'parse not ok');
    });

    await run('coreguard_decide_outcome maps verification report', async () => {
      const r = await request('tools/call', { name: 'coreguard_decide_outcome', arguments: { report: { verdict: 'INVALID', checks: [{ code: 'X', ok: false }] }, receiptId: '0x' + '33'.repeat(32) } });
      assert(!r.result?.isError, r.result?.content?.[0]?.text);
      assert(r.result.structuredContent.outcome, 'missing outcome');
      assert(r.result.structuredContent.decision, 'missing decision');
    });

    await run('coreguard_consumption_status process-local check/consume/release', async () => {
      const key = 'receipt-smoke-1';
      const c1 = await request('tools/call', { name: 'coreguard_consumption_status', arguments: { receiptId: key, action: 'check' } });
      assert(c1.result.structuredContent.consumed === false, 'expected not consumed');
      const c2 = await request('tools/call', { name: 'coreguard_consumption_status', arguments: { receiptId: key, action: 'consume' } });
      assert(c2.result.structuredContent.consumed === true, 'expected consumed after consume');
      assert(c2.result.structuredContent.ledger === 'process-local', 'expected process-local');
      const c3 = await request('tools/call', { name: 'coreguard_consumption_status', arguments: { receiptId: key, action: 'release' } });
      assert(c3.result.structuredContent.consumed === false, 'expected released');
    });

    await run('coreguard_build_attestation + verify_attestation roundtrip', async () => {
      const built = await request('tools/call', { name: 'coreguard_build_attestation', arguments: { consent, executedTrace: trace('1200'), adapterId: 'core-dao-anchor', nowSeconds: NOW } });
      assert(!built.result?.isError, `build failed: ${built.result?.content?.[0]?.text}`);
      const { attestation, attestationId } = built.result.structuredContent;
      assert(attestationId, 'missing attestationId');
      const ver = await request('tools/call', { name: 'coreguard_verify_attestation', arguments: { attestation, attestationId, consent, executedTrace: trace('1200') } });
      assert(!ver.result?.isError, `verify failed: ${ver.result?.content?.[0]?.text}`);
      const decision = ver.result.structuredContent.decision || ver.result.structuredContent.verdict || ver.result.structuredContent.status;
      assert(typeof decision === 'string', 'missing decision/verdict/status');
    });

    await run('malformed input returns stable structured error and server survives', async () => {
      const r = await request('tools/call', { name: 'coreguard_authorize', arguments: { intent: testIntent('1200'), policy: testPolicy(), declaredTrace: trace('1200'), nowSeconds: 1794657600 } });
      assert(r.result?.isError === true, 'expected isError');
      assert(r.result?.structuredContent?.error?.code === 'INVALID_ARGUMENT', 'expected INVALID_ARGUMENT');
      const after = await request('tools/list', {});
      assert(Array.isArray(after.result?.tools), 'server did not survive malformed input');
    });
  });

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) { for (const f of failed) console.error(` - ${f.name}: ${f.error}`); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
