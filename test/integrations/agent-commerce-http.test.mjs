/**
 * Agent Commerce REST API contract tests — a real node:http server instance
 * on loopback, driven through the honest-default postures and the four
 * endpoints. Offline · deterministic · zero keys. Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
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
    items: [{ sku: "SKU-HTTP-T", name: "Synthetic item H", qty: 1, unitPriceMinor: amount }],
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
    authorizedAtUtc: "2026-11-14T12:00:00Z",
    expiryUtc: "2026-11-14T12:10:00Z",
    singleUse: true,
  };
}

const testPolicy = () => ({
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Agent Commerce Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "1200" }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
});

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

const post = (base, path, payload) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

test("default posture is OPEN: /health answers 200 with no allowlist configured", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "OK");
  });
});

test("authorize then verify an exact order -> VERIFIED over the wire", async () => {
  await withServer(async (base) => {
    const res1 = await post(base, "/v1/authorize", { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
    assert.equal(res1.status, 200);
    const consent = await res1.json();
    assert.equal(consent.spec, "CGCR/1");
    const res2 = await post(base, "/v1/verify", { consent, trace: trace() });
    const report = await res2.json();
    assert.equal(res2.status, 200);
    assert.equal(report.verdict, "VERIFIED");
  });
});

test("verify a drifted order over the wire -> INVALID with the class named", async () => {
  await withServer(async (base) => {
    const res1 = await post(base, "/v1/authorize", { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
    const consent = await res1.json();
    const res2 = await post(base, "/v1/verify", { consent, trace: { ...trace(), value: "1450" } });
    const report = await res2.json();
    assert.equal(report.verdict, "INVALID");
    assert.ok(report.risk.violations.some((v) => v.code === "VALUE_ESCALATION"));
  });
});

test("risk-assess returns the deterministic AGR/1 report", async () => {
  await withServer(async (base) => {
    const res = await post(base, "/v1/risk-assess", { intent: testIntent(), policy: testPolicy(), trace: trace() });
    const report = await res.json();
    assert.equal(res.status, 200);
    assert.equal(report.classification, "CLEAN");
    assert.ok(report.boundary.includes("never a probabilistic fraud score"));
  });
});

test("consent-verify re-derives the record's own binding", async () => {
  await withServer(async (base) => {
    const res1 = await post(base, "/v1/authorize", { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW });
    const consent = await res1.json();
    const res2 = await post(base, "/v1/consent-verify", { consent });
    const verification = await res2.json();
    assert.equal(verification.result, "VERIFIED");
  });
});

test("unknown endpoint -> 404, wrong method -> 405, bad JSON -> 400 — all refused", async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/v1/unknown`)).status, 404);
    assert.equal((await fetch(`${base}/health`)).status, 200); // GET stays fine on /health
    assert.equal((await fetch(`${base}/v1/verify`)).status, 404); // GET on a POST-only route: not enumerated
    assert.equal(
      (await fetch(`${base}/v1/verify`, { method: "DELETE" })).status,
      405
    ); // known route, wrong method
    const r400 = await fetch(`${base}/v1/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
    assert.equal(r400.status, 400);
  });
});

test("foreign allowlist: the loopback peer is refused 403 BEFORE anything else — including /health", async () => {
  await withServer(
    async (base) => {
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 403); // allowlist does NOT exempt /health (C23)
      const api = await post(base, "/v1/verify", {});
      assert.equal(api.status, 403);
    },
    { allowAddresses: ["198.51.100.9"] } // a foreign, unreachable address
  );
});

test("the API version constant travels in refusals", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/v1/nope`);
    const body = await res.json();
    assert.equal(body.api, AGENT_COMMERCE_API_VERSION);
  });
});
