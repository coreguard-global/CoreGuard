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
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

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

test("tools/list exposes the 10 provider-independent tools with schemas", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const res = await request("tools/list", {});
    assert.deepEqual(
      res.result.tools.map((t) => t.name),
      [
        "coreguard_authorize",
        "coreguard_verify_consent",
        "coreguard_verify_execution",
        "coreguard_assess_risk",
        "coreguard_inspect_identity",
        "coreguard_build_attestation",
        "coreguard_verify_attestation",
        "coreguard_decide_outcome",
        "coreguard_profile_reference",
        "coreguard_consumption_status",
      ]
    );
    for (const t of res.result.tools) {
      assert.ok(t.description && t.description.length > 30, t.name);
      assert.ok(t.inputSchema && t.inputSchema.type === "object");
      assert.ok(t.outputSchema && t.outputSchema.type === "object", `${t.name} missing outputSchema`);
      assert.ok(t.inputSchema.properties?.callerContext, `${t.name} missing callerContext`);
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

test("serverInfo.version is the package version, not a hand-written string", async () => {
  const pkg = JSON.parse(readFileSync(join(here, "../../packages/agent-commerce/package.json"), "utf8"));
  await withServer(async ({ request }) => {
    const res = await request("initialize", {});
    assert.equal(res.result.serverInfo.version, pkg.version);
  });
  const mod = await import(pathToFileURL(join(here, "../../packages/agent-commerce/mcp.mjs")).href);
  assert.equal(mod.SERVER_INFO.version, pkg.version);
});

test("every tool publishes an output schema and returns structured content", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const list = await request("tools/list", {});
    for (const t of list.result.tools) {
      assert.equal(t.outputSchema?.type, "object", `${t.name} outputSchema`);
      assert.ok(t.outputSchema.description && t.outputSchema.description.length > 40, `${t.name} output description`);
      assert.ok(t.inputSchema.required.length > 0, `${t.name} required inputs`);
    }
    const authz = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW },
    });
    assert.equal(authz.result.isError, undefined);
    assert.deepEqual(authz.result.structuredContent, JSON.parse(authz.result.content[0].text));
  });
});

test("missing and malformed arguments fail with the stable error contract, and the server survives", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const missing = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace() },
    });
    assert.equal(missing.result.isError, true);
    assert.equal(missing.result.structuredContent.error.code, "MISSING_ARGUMENT");
    assert.ok(missing.result.content[0].text.startsWith("MISSING_ARGUMENT: nowSeconds"));

    const malformed = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: 1794657600 },
    });
    assert.equal(malformed.result.structuredContent.error.code, "INVALID_ARGUMENT");

    const notAnObject = await request("tools/call", { name: "coreguard_verify_execution", arguments: { consent: "nope", trace: trace() } });
    assert.equal(notAnObject.result.structuredContent.error.code, "INVALID_ARGUMENT");

    const stillAlive = await request("ping", {});
    assert.deepEqual(stillAlive.result, {});
  });
});

test("an unauthorized escalation is refused end-to-end through the real server", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const authz = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent("47000"), policy: testPolicy(), declaredTrace: trace("47000"), nowSeconds: NOW },
    });
    const consent = JSON.parse(authz.result.content[0].text);
    // the order was approved at 470.00 and arrives at 570.00
    const escalated = await request("tools/call", { name: "coreguard_verify_execution", arguments: { consent, trace: trace("57000") } });
    assert.equal(escalated.result.structuredContent.verdict, "INVALID");
    assert.ok(escalated.result.structuredContent.risk.violations.some((v) => v.code === "VALUE_ESCALATION"));
  });
});

test("coreguard_inspect_identity returns split identity, anchor facts, and optional comparison", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const res = await request("tools/call", {
      name: "coreguard_inspect_identity",
      arguments: {
        issuer: "did:example:agent", scope: "commerce", subject: "order-1",
        contentDigest: "11".repeat(32),
        anchor: { kind: "chain", locator: "eip155:1116:0xabc" },
        other: { issuer: "did:example:agent", scope: "commerce", subject: "order-2", contentDigest: "22".repeat(32) },
        callerContext: { traceId: "t-1" },
      },
    });
    assert.equal(res.result.isError, undefined);
    const out = res.result.structuredContent;
    assert.ok(out.identity?.recordId);
    assert.ok(out.anchorFacts);
    assert.ok(out.comparison);
    assert.equal(out.callerContext.traceId, "t-1");
  });
});

test("coreguard_build_attestation + coreguard_verify_attestation roundtrip over real consent", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const authz = await request("tools/call", {
      name: "coreguard_authorize",
      arguments: { intent: testIntent(), policy: testPolicy(), declaredTrace: trace(), nowSeconds: NOW },
    });
    const consent = JSON.parse(authz.result.content[0].text);
    const built = await request("tools/call", {
      name: "coreguard_build_attestation",
      arguments: { consent, executedTrace: trace(), adapterId: "core-dao-anchor", nowSeconds: NOW },
    });
    assert.equal(built.result.isError, undefined, built.result?.content?.[0]?.text || JSON.stringify(built.result));
    const { attestation, attestationId } = built.result.structuredContent;
    assert.ok(attestationId);
    assert.ok(attestation);
    const ver = await request("tools/call", {
      name: "coreguard_verify_attestation",
      arguments: { attestation, attestationId, consent, executedTrace: trace() },
    });
    assert.equal(ver.result.isError, undefined, ver.result?.content?.[0]?.text || JSON.stringify(ver.result));
    assert.equal(typeof (ver.result.structuredContent.decision || ver.result.structuredContent.verdict), "string");
  });
});

test("coreguard_decide_outcome maps report to CG-OUT/1 decision and optional profile reference", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const res = await request("tools/call", {
      name: "coreguard_decide_outcome",
      arguments: { report: { verdict: "INVALID", checks: [{ code: "VALUE_ESCALATION", ok: false }] }, receiptId: "0x" + "33".repeat(32) },
    });
    assert.equal(res.result.isError, undefined);
    const out = res.result.structuredContent;
    assert.ok(out.outcome);
    assert.ok(out.decision);
    assert.ok(out.profileReference);
  });
});

test("coreguard_profile_reference make and parse roundtrip", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const receiptId = "0x" + "44".repeat(32);
    const made = await request("tools/call", { name: "coreguard_profile_reference", arguments: { action: "make", receiptId } });
    assert.equal(made.result.isError, undefined);
    const ref = made.result.structuredContent.profileReference;
    const parsed = await request("tools/call", { name: "coreguard_profile_reference", arguments: { action: "parse", reference: ref } });
    assert.equal(parsed.result.isError, undefined);
    assert.equal(parsed.result.structuredContent.parsed.ok, true);
  });
});

test("coreguard_consumption_status is process-local by default and honest about boundary", async () => {
  await withServer(async ({ request }) => {
    await request("initialize", {});
    const key = "receipt-process-local";
    let r = await request("tools/call", { name: "coreguard_consumption_status", arguments: { receiptId: key, action: "check" } });
    assert.equal(r.result.structuredContent.consumed, false);
    assert.equal(r.result.structuredContent.ledger, "process-local");
    r = await request("tools/call", { name: "coreguard_consumption_status", arguments: { receiptId: key, action: "consume" } });
    assert.equal(r.result.structuredContent.consumed, true);
    r = await request("tools/call", { name: "coreguard_consumption_status", arguments: { receiptId: key, action: "release" } });
    assert.equal(r.result.structuredContent.consumed, false);
  });
});

test("coreguard_consumption_status supports AC-CS/1 file-backed host store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-cs-"));
  const storePath = join(dir, "consumption.json");
  try {
    await withServer(async ({ request }) => {
      await request("initialize", {});
      const key = "receipt-file-backed";
      let r = await request("tools/call", { name: "coreguard_consumption_status", arguments: { receiptId: key, action: "consume", storePath } });
      assert.equal(r.result.isError, undefined);
      assert.equal(r.result.structuredContent.consumed, true);
      assert.match(r.result.structuredContent.ledger, /^file-backed \(AC-CS\/1/);
      assert.ok(r.result.structuredContent.boundary.includes("NOT a distributed ledger") || r.result.structuredContent.boundary.includes("NOT"));
      r = await request("tools/call", { name: "coreguard_consumption_status", arguments: { receiptId: key, action: "check", storePath } });
      assert.equal(r.result.structuredContent.consumed, true);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
