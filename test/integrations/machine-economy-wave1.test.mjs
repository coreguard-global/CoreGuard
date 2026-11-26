import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import {
  parseX402Challenge, authorizeX402Payment, verifyX402Settlement, reconcilePayment,
  meterAgentUsage, registerMachine, createMachineTask, verifyTelemetry, verifyTaskCompletion, verifyDelegationChain,
  MACHINE_ECONOMY_VERSION,
} from "../../packages/agent-commerce/machine-economy.mjs";

test("parseX402Challenge parses valid challenge", () => {
  const r = parseX402Challenge({ challenge: { accepts: [{ scheme: "exact", network: "base", asset: "USDC", amount: "100", payTo: "0xabc" }] } });
  assert.equal(r.verdict, "PARSED");
  assert.equal(r.accepts.length, 1);
  assert.equal(r.spec, MACHINE_ECONOMY_VERSION);
});

test("parseX402Challenge rejects missing fields", () => {
  const r = parseX402Challenge({ challenge: { accepts: [{ network: "base" }] } });
  assert.equal(r.verdict, "INVALID");
  assert.ok(r.issues.some(i => i.includes("MISSING")));
});

test("authorizeX402Payment denies over policy", () => {
  const r = authorizeX402Payment({ challenge: { accepts: [{ network: "base", asset: "USDC", amount: "200", payTo: "0xabc" }] }, policy: { maxAmount: "100", allowedNetworks: ["base"], allowedAssets: ["USDC"], allowedPayTo: ["0xabc"] } });
  assert.equal(r.verdict, "DENIED");
  assert.ok(r.issues.includes("AMOUNT_EXCEEDS_POLICY"));
});

test("authorizeX402Payment authorizes in policy", () => {
  const r = authorizeX402Payment({ challenge: { accepts: [{ network: "base", asset: "USDC", amount: "100", payTo: "0xabc" }] }, policy: { maxAmount: "100", allowedNetworks: ["base"], allowedAssets: ["USDC"], allowedPayTo: ["0xabc"] } });
  assert.equal(r.verdict, "AUTHORIZED");
  assert.ok(r.authorizationId);
});

test("verifyX402Settlement fail-closed without confirmed status/proof", () => {
  const challenge = { accepts: [{ network: "base", asset: "USDC", amount: "100", payTo: "0xabc" }] };
  const r = verifyX402Settlement({ challenge, settlement: { network: "base", asset: "USDC", amount: "100", payTo: "0xabc", status: "pending" } });
  assert.equal(r.verdict, "UNVERIFIED");
  assert.ok(r.issues.includes("MISSING_SETTLEMENT_PROOF_REF"));
});

test("verifyX402Settlement verifies matching confirmed evidence", () => {
  const challenge = { accepts: [{ network: "base", asset: "USDC", amount: "100", payTo: "0xabc" }] };
  const r = verifyX402Settlement({ challenge, settlement: { network: "base", asset: "USDC", amount: "100", payTo: "0xabc", txRef: "0x1", status: "confirmed" } });
  assert.equal(r.verdict, "VERIFIED");
});

test("reconcilePayment detects missing pieces", () => {
  const auth = authorizeX402Payment({ challenge: { accepts: [{ network: "base", asset: "USDC", amount: "100", payTo: "0xabc" }] }, policy: { maxAmount: "100" } });
  const r = reconcilePayment({ authorization: auth });
  assert.equal(r.verdict, "NOT_RECONCILED");
  assert.ok(r.issues.includes("MISSING_SETTLEMENT"));
});

test("meterAgentUsage sums deterministically", () => {
  const r = meterAgentUsage({ agentId: "a1", currency: "USD", events: [{ amount: "10" }, { amount: "25", resource: "tool" }] });
  assert.equal(r.totalAmount, "35");
  assert.equal(r.eventCount, 2);
});

test("registerMachine creates local registration record", () => {
  const r = registerMachine({ machineId: "m1", owner: "org1", manifest: { capabilities: ["deliver", "scan"], model: "R2" } });
  assert.equal(r.verdict, "REGISTERED_LOCAL");
  assert.ok(r.registrationId);
});

test("createMachineTask creates task digest", () => {
  const r = createMachineTask({ taskId: "t1", machineId: "m1", terms: { price: "500", currency: "USD", sla: "30m" } });
  assert.equal(r.verdict, "CREATED");
  assert.equal(r.price, "500");
});

test("verifyTelemetry is fail-closed without signature/trust", () => {
  const r = verifyTelemetry({ taskId: "t1", telemetry: { machineId: "m1", timestamp: 1, readings: [{ k: "temp", v: 1 }] } });
  assert.equal(r.verdict, "INVALID");
  assert.ok(r.issues.includes("MISSING_SIGNATURE_EVIDENCE"));
});

test("verifyTaskCompletion accepts evidence structure", () => {
  const task = createMachineTask({ taskId: "t1", machineId: "m1", terms: { price: "500", currency: "USD" } });
  const r = verifyTaskCompletion({ task, completion: { taskId: "t1", machineId: "m1", status: "completed", evidence: [{ type: "photo", ref: "hash://1" }] } });
  assert.equal(r.verdict, "EVIDENCE_ACCEPTED");
});

test("verifyDelegationChain detects breaks and missing signatures", () => {
  const r = verifyDelegationChain({ chain: [{ delegator: "A", delegate: "B", scope: ["pay"] }, { delegator: "C", delegate: "D", scope: ["pay"], signature: "sig" }] });
  assert.equal(r.verdict, "INVALID");
  assert.ok(r.issues.includes("CHAIN_BREAK_AT_1"));
  assert.ok(r.issues.includes("DELEGATION_0_MISSING_SIGNATURE"));
});

test("MCP exposes 119 tools and Wave 1 tool call works", async (t) => {
  const child = spawn(process.execPath, ["packages/agent-commerce/bin/mcp.mjs"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  // A failed assertion must not leave the stdio child holding the event loop:
  // the suite would hang instead of reporting the failure.
  t.after(() => child.kill());
  const rl = createInterface({ input: child.stdout });
  const pending = [];
  rl.on("line", (line) => { if (!line.trim()) return; const msg = JSON.parse(line); const i = pending.findIndex(p => p.id === msg.id); if (i >= 0) { pending.splice(i,1)[0].resolve(msg); } });
  const req = (id, method, params) => new Promise((resolve, reject) => { pending.push({ id, resolve }); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); setTimeout(() => reject(new Error("timeout "+method)), 10000); });
  const init = await req(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } });
  assert.equal(init.result.serverInfo.name, "coreguard-agent-commerce");
  const list = await req(2, "tools/list", {});
  assert.equal(list.result.tools.length, 119);
  const call = await req(3, "tools/call", { name: "coreguard_parse_x402_challenge", arguments: { challenge: { accepts: [{ network: "base", asset: "USDC", amount: "1", payTo: "0xabc" }] } } });
  assert.equal(call.result.structuredContent.verdict, "PARSED");
  child.stdin.end();
  await Promise.race([once(child, "exit"), new Promise(r => setTimeout(r, 2000))]);
});
