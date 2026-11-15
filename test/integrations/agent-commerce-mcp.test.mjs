/**
 * Agent Commerce MCP server contract tests — a REAL stdio JSON-RPC 2.0 child
 * is spawned and driven through initialize / tools/list / tools/call.
 * Offline · deterministic · zero keys. Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MCP_PATH = resolve(here, "../../packages/agent-commerce/mcp.mjs");

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
    items: [{ sku: "SKU-MCP-T", name: "Synthetic item M", qty: 1, unitPriceMinor: amount }],
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

/** Spawn one MCP child per test; every request gets a bounded promise. */
async function withServer(fn) {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ["pipe", "pipe", "pipe"] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* ignore */ }
  });
  let nextId = 0;
  const request = (method, params) =>
    new Promise((res, rej) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rej(new Error(`MCP timeout on ${method}`));
      }, 15000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        res(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  const raw = (text) =>
    new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error("MCP timeout on raw line")), 15000);
      child.stdin.write(text + "\n");
      // raw lines get an id:null error response; capture via a one-shot listener
      const onLine = (line) => {
        try {
          const msg = JSON.parse(line);
          if (msg.id === null) {
            rl.removeListener("line", onLine);
            clearTimeout(timer);
            res(msg);
          }
        } catch { /* keep listening */ }
      };
      rl.on("line", onLine);
    });
  try {
    return await fn({ request, raw });
  } finally {
    child.kill();
    rl.close();
  }
}

test("MCP initialize answers the pinned protocol version and server info", async () => {
  await withServer(async ({ request }) => {
    const res = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "contract-test", version: "1.0.0" } });
    assert.equal(res.result.protocolVersion, "2025-06-18");
    assert.equal(res.result.serverInfo.name, "coreguard-agent-commerce");
    assert.ok(res.result.instructions.includes("VERIFIED ≠ SAFE"));
    assert.ok(res.result.instructions.includes("NOT_BUILT"));
  });
});

test("tools/list exposes exactly the four provider-independent tools", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const res = await request("tools/list", {});
    assert.deepEqual(
      res.result.tools.map((t) => t.name),
      ["coreguard_authorize", "coreguard_verify_consent", "coreguard_verify_execution", "coreguard_assess_risk"]
    );
    for (const t of res.result.tools) {
      assert.ok(t.description && t.description.length > 30, t.name);
      assert.ok(t.inputSchema && t.inputSchema.type === "object");
    }
  });
});

test("tools/call authorize then verify a drifted order -> INVALID with the class named", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const authz = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW },
    });
    assert.equal(authz.result.isError, undefined);
    const consent = JSON.parse(authz.result.content[0].text);
    assert.equal(consent.spec, "CGCR/1");
    assert.equal(consent.receipt.timestamp, NOW);
    const drifted = { ...trace(), value: "1450" };
    const verdict = await request("tools/call", { name: "coreguard_verify_execution", arguments: { consent, trace: drifted } });
    const report = JSON.parse(verdict.result.content[0].text);
    assert.equal(report.verdict, "INVALID");
    assert.ok(report.risk.violations.some((v) => v.code === "VALUE_ESCALATION"));
  });
});

test("tools/call verify an exact order -> VERIFIED", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const authz = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW },
    });
    const consent = JSON.parse(authz.result.content[0].text);
    const verdict = await request("tools/call", { name: "coreguard_verify_execution", arguments: { consent, trace: trace() } });
    const report = JSON.parse(verdict.result.content[0].text);
    assert.equal(report.verdict, "VERIFIED");
  });
});

test("unknown tool and unknown method fail without crashing the server", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const bad = await request("tools/call", { name: "coreguard_nope", arguments: {} });
    assert.equal(bad.result.isError, true);
    assert.ok(bad.result.content[0].text.includes("unknown tool"));
    const missing = await request("brain/surgery", {});
    assert.equal(missing.error.code, -32601);
    // the server still serves after the failures
    const ping = await request("ping", {});
    assert.deepEqual(ping.result, {});
  });
});

test("a non-JSON line answers -32700 with id null", async () => {
  await withServer(async ({ raw }) => {
    const err = await raw("{not json");
    assert.equal(err.error.code, -32700);
  });
});

test("selfCheck names its own gates", async () => {
  const { selfCheck } = await import(pathToFileURL(join(here, "../../packages/agent-commerce/mcp.mjs")).href);
  const results = selfCheck();
  assert.ok(results.every(([, ok]) => ok === true), JSON.stringify(results));
});
