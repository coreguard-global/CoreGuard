#!/usr/bin/env node
/**
 * CGCP/1 control-plane demo — offline, deterministic, no keys.
 *
 * Starts the real HTTP API on an ephemeral loopback port, then walks the arc an
 * operator actually runs:
 *
 *   1. an anonymous call is refused (401)                     — auth is on
 *   2. a versioned policy with a spend cap and approval floor — policy
 *   3. an agent bound to that policy                          — registry
 *   4. an in-policy purchase is authorised                     — ALLOW
 *   5. a denied address is refused with a named reason         — DENY
 *   6. an above-threshold purchase requires an approval        — HOLD
 *   7. the approved purchase commits and records spend         — COMMIT
 *   8. a second purchase over the cap is refused (409)         — LIMIT
 *   9. the hash-chained audit verifies and a restart keeps it  — EVIDENCE
 *
 * Exit 0 only when all nine pass. The store lives in a temp dir and is removed.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startControlPlaneServer } from "../../packages/agent-commerce/control-plane-http.mjs";
import { createControlPlane } from "../../packages/agent-commerce/control-plane.mjs";

const API_KEY = "demo-" + "k".repeat(32);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
};

async function call(base, path, { method = "GET", body, auth = true } = {}) {
  const headers = auth ? { authorization: `Bearer ${API_KEY}` } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const dir = mkdtempSync(join(tmpdir(), "cgcp-demo-"));
const storePath = join(dir, "control-plane.json");
let started = await startControlPlaneServer({ storePath, apiKey: API_KEY, port: 0 });

try {
  const anonymous = await call(started.url, "/v1/agents", { auth: false });
  check("anonymous request is refused with 401", anonymous.status === 401, `got ${anonymous.status}`);

  const policy = await call(started.url, "/v1/policies", {
    method: "POST",
    body: {
      id: "demo-policy",
      name: "Demo purchase policy",
      spendLimitMinor: "5000",
      dailyLimitMinor: "8000",
      requireApprovalAboveMinor: "2000",
      allowMerchants: ["merchant-demo"],
      denyAddresses: ["0x00000000000000000000000000000000000000ba"],
      currency: "USD",
    },
  });
  check("policy v1 is created", policy.status === 201 && policy.json.currentVersion === 1, JSON.stringify(policy.json));

  await call(started.url, "/v1/agents", { method: "POST", body: { id: "agent-demo", name: "Demo agent", policyId: "demo-policy" } });

  const allow = await call(started.url, "/v1/evaluate", {
    method: "POST",
    body: { agentId: "agent-demo", merchant: "merchant-demo", address: "0x00000000000000000000000000000000000000aa", amountMinor: "500", currency: "USD" },
  });
  check("in-policy purchase is ALLOWED", allow.json?.allowed === true, JSON.stringify(allow.json?.reasons));

  const deny = await call(started.url, "/v1/evaluate", {
    method: "POST",
    body: { agentId: "agent-demo", merchant: "merchant-demo", address: "0x00000000000000000000000000000000000000ba", amountMinor: "500", currency: "USD" },
  });
  check(
    "denied address is refused with ADDRESS_DENIED",
    deny.json?.allowed === false && deny.json.reasons.includes("ADDRESS_DENIED"),
    JSON.stringify(deny.json?.reasons),
  );

  const hold = await call(started.url, "/v1/evaluate", {
    method: "POST",
    body: { agentId: "agent-demo", merchant: "merchant-demo", address: "0x00000000000000000000000000000000000000aa", amountMinor: "2500", currency: "USD" },
  });
  check(
    "above-threshold purchase requires an approval",
    hold.json?.allowed === false && hold.json.reasons.includes("APPROVAL_REQUIRED"),
    JSON.stringify(hold.json?.reasons),
  );

  await call(started.url, "/v1/approvals", {
    method: "POST",
    body: { id: "demo-approval", agentId: "agent-demo", policyId: "demo-policy", merchant: "merchant-demo", address: "0x00000000000000000000000000000000000000aa", amountMinor: "2500", currency: "USD" },
  });
  await call(started.url, "/v1/approvals/demo-approval/decide", { method: "POST", body: { decision: "approved", decidedBy: "ops@example" } });
  const commit = await call(started.url, "/v1/executions", {
    method: "POST",
    body: {
      id: "demo-execution",
      agentId: "agent-demo",
      policyId: "demo-policy",
      merchant: "merchant-demo",
      address: "0x00000000000000000000000000000000000000aa",
      amountMinor: "2500",
      currency: "USD",
      approvalId: "demo-approval",
      receiptId: "0x" + "44".repeat(32),
      verdict: "VERIFIED",
    },
  });
  check(
    "approved purchase commits and records spend",
    commit.status === 201 && commit.json?.spend?.totalMinor === "2500",
    JSON.stringify(commit.json),
  );

  const overCap = await call(started.url, "/v1/executions", {
    method: "POST",
    body: { id: "demo-execution-2", agentId: "agent-demo", policyId: "demo-policy", merchant: "merchant-demo", address: "0x00000000000000000000000000000000000000aa", amountMinor: "4000", currency: "USD" },
  });
  check(
    "a second purchase over the cap is refused (409 + reason)",
    overCap.status === 409 && overCap.json?.reasons?.length > 0,
    JSON.stringify(overCap.json?.reasons),
  );

  const report = await call(started.url, "/v1/report");
  const chainOk = report.json?.chain?.ok === true && report.json?.counts?.executions === 1;

  // Restart on the same store: the evidence is durable and the chain still verifies.
  await started.close();
  started = null;
  const reopened = createControlPlane({ storePath, create: true });
  const persisted = reopened.auditReport();
  check(
    "hash-chained audit verifies before and after a restart",
    chainOk && persisted.chain.ok === true && persisted.counts.executions === 1,
    JSON.stringify({ before: chainOk, after: persisted.chain.ok, executions: persisted.counts.executions }),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS  ·  CGCP/1  ·  VERIFIED ≠ SAFE`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (started) await started.close();
  rmSync(dir, { recursive: true, force: true });
}
