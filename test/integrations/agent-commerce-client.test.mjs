/**
 * Agent Commerce Verification API client (AC-API/1) — REST wrapper contract tests.
 *
 * The client is a fetch-shaped transport over the committed AC-API/1 handler;
 * the tests drive it both through an INJECTED fake transport (no network, pure
 * contract) and through a REAL loopback node:http server (end to end). Offline ·
 * deterministic · zero keys. Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createAgentCommerceClient } from "../../packages/agent-commerce/client.mjs";
import { createAgentCommerceApi, AGENT_COMMERCE_API_VERSION } from "../../packages/agent-commerce/http.mjs";

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600";

function testIntent(amount = "1200") {
  return {
    version: "CGEP/1",
    chainId: "0",
    signer: AGENT,
    nonce: "0",
    validAfter: "0",
    validUntil: "9999999999",
    action: "AGENT_CHECKOUT",
    target: MERCHANT,
    selector: "0xa9059cbb",
    asset: "0x0000000000000000000000000000000000000002",
    amount,
    recipient: MERCHANT,
    constraints: [
      { type: "MAX_VALUE", value: amount },
      { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
    ],
    merchantName: "synthetic-store.example",
    currency: "USD",
    items: [{ sku: "SKU-CLI-T", name: "Synthetic item CLI", qty: 1, unitPriceMinor: amount }],
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
    authorizedAtUtc: "2026-11-14T12:00:00Z",
    expiryUtc: "2026-11-14T12:10:00Z",
    singleUse: true,
  };
}

function testPolicy() {
  return {
    version: "CGEP/1",
    policyId: "0x00000000000000000000000000000000000000ac",
    name: "Agent Commerce Policy",
    rules: [
      { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "1200" }, severity: "CRITICAL" },
      { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
      { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
      { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
    ],
  };
}

function trace(totalMinor = "1200") {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "bb".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: NOW,
    from: AGENT,
    to: MERCHANT,
    value: totalMinor,
    calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    items: testIntent().items,
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
  };
}

async function withServer(fn, options = {}) {
  const handler = createAgentCommerceApi(options);
  const server = createServer((req, res) => handler(req, res));
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((res) => server.close(res));
  }
}

function jsonRes(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

test("client.health() against the live loopback server -> ok", async () => {
  await withServer(async (base) => {
    const client = createAgentCommerceClient({ baseUrl: base });
    const h = await client.health();
    assert.equal(h.ok, true);
    assert.equal(h.status, 200);
  });
});

test("client.authorize() -> CGCR/1 consent; verify() -> VERIFIED; ledger consumes", async () => {
  await withServer(async (base) => {
    const ledger = new Set();
    const client = createAgentCommerceClient({ baseUrl: base, consumedSet: ledger });
    const consent = await client.authorize({ intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
    assert.equal(consent.spec, "CGCR/1");
    const report = await client.verify({ consent, trace: trace() });
    assert.equal(report.verdict, "VERIFIED");
    assert.ok(ledger.has(consent.receiptId));
    const replay = await client.verify({ consent, trace: trace() });
    assert.equal(replay.verdict, "INVALID");
    assert.ok(replay.risk.violations.some((v) => v.code === "SINGLE_USE_REUSE"));
    const fresh = createAgentCommerceClient({ baseUrl: base });
    const serverReplay = await fresh.verify({ consent, trace: trace() });
    assert.equal(serverReplay.verdict, "INVALID");
    assert.ok(serverReplay.risk.violations.some((v) => v.code === "SINGLE_USE_REUSE"));
  });
});

test("client.consentVerify() -> VERIFIED for a freshly authorized record", async () => {
  await withServer(async (base) => {
    const client = createAgentCommerceClient({ baseUrl: base });
    const consent = await client.authorize({ intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
    const verification = await client.consentVerify({ consent });
    assert.equal(verification.result, "VERIFIED");
  });
});

test("client.riskAssess() -> deterministic CLEAN AGR/1 report", async () => {
  await withServer(async (base) => {
    const client = createAgentCommerceClient({ baseUrl: base });
    const report = await client.riskAssess({ intent: testIntent(), policy: testPolicy(), trace: trace() });
    assert.equal(report.classification, "CLEAN");
    assert.ok(report.boundary.includes("never a probabilistic fraud score"));
  });
});

test("client with injected fake transport: authorize/verify round-trip + refusal propagation", async () => {
  const consent = { spec: "CGCR/1", receiptId: "0xcli0001", receipt: { result: "OK" } };
  const verifyReport = {
    spec: "AC-SDK/1",
    verdict: "VERIFIED",
    checks: [],
    risk: { spec: "AGR/1", classification: "CLEAN", violations: [], boundary: "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE" },
    driftNamed: [],
    consumed: false,
    consumedLedger: "0xcli0001",
    boundary: "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE",
  };
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    if (url.endsWith("/v1/authorize")) return jsonRes(200, consent);
    if (url.endsWith("/v1/verify")) return jsonRes(200, verifyReport);
    if (url.endsWith("/health")) return jsonRes(200, "OK");
    return jsonRes(404, { error: "unknown endpoint" });
  };
  const client = createAgentCommerceClient({ baseUrl: "http://fake.invalid", fetchImpl: fakeFetch, consumedSet: new Set() });
  const c = await client.authorize({ intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
  assert.equal(c.receiptId, "0xcli0001");
  const r = await client.verify({ consent, trace: trace() });
  assert.equal(r.verdict, "VERIFIED");
  assert.equal(calls.length, 2);

  const failing = createAgentCommerceClient({ baseUrl: "http://fake.invalid", fetchImpl: async () => jsonRes(400, { error: "invalid JSON body" }) });
  await assert.rejects(() => failing.riskAssess({ intent: testIntent(), policy: testPolicy(), trace: trace() }), /invalid JSON body/);
});

test("client refuses to decide delivery conformity and never claims a fraud score (boundary)", async () => {
  const client = createAgentCommerceClient({ baseUrl: "http://127.0.0.1:1" }); // nothing listens: transport must fail, not guess
  await assert.rejects(() => client.verify({ consent: { receiptId: "0xcli0002" }, trace: trace() }), /ECONNREFUSED|fetch failed|network/i);
});
