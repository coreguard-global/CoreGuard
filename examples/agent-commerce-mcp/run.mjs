#!/usr/bin/env node
/**
 * CoreGuard Agent Commerce MCP — end-to-end example (offline, zero keys).
 *
 * Spawns the REAL stdio server (packages/agent-commerce/mcp.mjs) as a child
 * process and drives it exactly as an MCP client would:
 *
 *   1. initialize            -> server info + boundary notes
 *   2. tools/list            -> the ten tools and their schemas
 *   3. coreguard_authorize   -> a CGCR/1 consent receipt for a 470.00 order
 *   4. coreguard_verify_execution (570.00) -> INVALID, VALUE_ESCALATION named
 *   5. coreguard_verify_execution (470.00) -> VERIFIED
 *   6. a malformed call      -> MISSING_ARGUMENT, server keeps serving
 *
 * Run: node examples/agent-commerce-mcp/run.mjs
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MCP = resolve(here, "../../packages/agent-commerce/mcp.mjs");

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600";

const intent = (amount) => ({
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
  items: [{ sku: "SKU-DEMO", name: "Synthetic item", qty: 1, unitPriceMinor: amount }],
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF (placeholder)",
  authorizedAtUtc: "2026-11-14T12:00:00Z",
  expiryUtc: "2026-11-14T12:10:00Z",
  singleUse: true,
});

const policy = () => ({
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Demo policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "47000" }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
});

function trace(minor) {
  const amountHex = BigInt(minor).toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "bb".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: NOW,
    from: AGENT,
    to: MERCHANT,
    value: minor,
    calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    items: intent(minor).items,
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF (placeholder)",
  };
}

const child = spawn(process.execPath, [MCP], { stdio: ["pipe", "pipe", "inherit"] });
const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
rl.on("line", (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

let nextId = 0;
const request = (method, params) =>
  new Promise((res, rej) => {
    const id = ++nextId;
    const timer = setTimeout(() => rej(new Error(`timeout on ${method}`)), 15000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      res(msg);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

const call = async (name, args) => {
  const res = await request("tools/call", { name, arguments: args });
  return res.result;
};

const results = [];
const check = (label, ok, detail = "") => {
  results.push([label, ok]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

try {
  const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "example", version: "0.0.1" } });
  check("initialize reports the package version", /^[0-9]+\.[0-9]+\.[0-9]+/.test(init.result.serverInfo.version), init.result.serverInfo.version);

  const list = await request("tools/list", {});
  check("twenty-six tools, each with input and output schemas", list.result.tools.length === 26 && list.result.tools.every((t) => t.inputSchema && t.outputSchema), list.result.tools.map((t) => t.name).join(", "));

  const authz = await call("coreguard_authorize", { intent: intent("47000"), policy: policy(), declaredTrace: trace("47000"), nowSeconds: NOW });
  const consent = authz.structuredContent;
  check("consent receipt issued (CGCR/1)", consent.spec === "CGCR/1");

  const escalated = await call("coreguard_verify_execution", { consent, trace: trace("57000") });
  const refused = escalated.structuredContent;
  check("a 570.00 execution against a 470.00 approval is INVALID", refused.verdict === "INVALID", `verdict=${refused.verdict}`);
  check("the drift is named", (refused.risk?.violations ?? []).some((v) => v.code === "VALUE_ESCALATION"), (refused.risk?.violations ?? []).map((v) => v.code).join(",") || "none");

  const exact = await call("coreguard_verify_execution", { consent, trace: trace("47000") });
  check("the exact approved execution is VERIFIED", exact.structuredContent.verdict === "VERIFIED", `verdict=${exact.structuredContent.verdict}`);

  const bad = await call("coreguard_authorize", { intent: intent("47000"), policy: policy(), declaredTrace: trace("47000") });
  check("a missing argument fails closed with a stable code", bad.isError === true && bad.structuredContent?.error?.code === "MISSING_ARGUMENT", bad.content?.[0]?.text?.split(":")[0]);

  const alive = await request("ping", {});
  check("the server keeps serving after bad input", alive.result && Object.keys(alive.result).length === 0);
} catch (err) {
  console.error(err);
  results.push(["example ran to completion", false]);
} finally {
  child.kill();
  rl.close();
}

const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${failed === 0 ? "PASS" : "FAIL"} (${results.length - failed}/${results.length})`);
process.exit(failed === 0 ? 0 : 1);
