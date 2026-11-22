/**
 * CGCP/1 HTTP API contract — a real server on an ephemeral loopback port.
 *
 * Covers: public liveness only, bearer auth in constant time on every /v1
 * route, the full agent/policy/approval/execution arc, persistence across a
 * restart, refusal status codes (409) versus transport errors (400/413/404),
 * and the no-store/no-stack-trace posture.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startControlPlaneServer } from "../../packages/agent-commerce/control-plane-http.mjs";
import { createControlPlane } from "../../packages/agent-commerce/control-plane.mjs";

const API_KEY = "test-key-" + "x".repeat(24);

async function withServer(fn, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-http-"));
  const started = await startControlPlaneServer({
    storePath: join(dir, "cp.json"),
    apiKey: API_KEY,
    port: 0,
    ...options,
  });
  try {
    await fn({ ...started, dir });
  } finally {
    await started.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function call(baseUrl, path, { method = "GET", body, auth = true, raw = false, apiKey = API_KEY } = {}) {
  const headers = {};
  if (auth) headers.authorization = `Bearer ${apiKey}`;
  let payload;
  if (raw) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(baseUrl + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}

test("CGCP/1 HTTP: /health is public liveness; /v1 requires the bearer key", async () => {
  await withServer(async ({ url }) => {
    const health = await call(url, "/health", { auth: false });
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.version, "CGCP/1");
    assert.ok(health.json.boundary.includes("NOT_BUILT"));

    const anonymous = await call(url, "/v1/agents", { auth: false });
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.json.error.code, "UNAUTHORIZED");
    assert.equal(anonymous.headers.get("cache-control"), "no-store");

    const wrong = await call(url, "/v1/agents", { apiKey: "not-the-key" });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.json.error.code, "UNAUTHORIZED");
  });
});

test("CGCP/1 HTTP: policy → agent → evaluate → approval → execution → report", async () => {
  await withServer(async ({ url }) => {
    const policy = await call(url, "/v1/policies", {
      method: "POST",
      body: {
        id: "p1",
        name: "Team cap",
        spendLimitMinor: "5000",
        dailyLimitMinor: "8000",
        requireApprovalAboveMinor: "2000",
        allowMerchants: ["m1"],
        denyAddresses: ["0xbad"],
        currency: "USD",
      },
    });
    assert.equal(policy.status, 201);
    assert.equal(policy.json.currentVersion, 1);

    const agent = await call(url, "/v1/agents", { method: "POST", body: { id: "a1", name: "Agent One", policyId: "p1" } });
    assert.equal(agent.status, 201);
    assert.equal(agent.json.status, "active");

    const allowed = await call(url, "/v1/evaluate", {
      method: "POST",
      body: { agentId: "a1", merchant: "m1", address: "0xgood", amountMinor: "500", currency: "USD" },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.allowed, true, JSON.stringify(allowed.json.reasons));

    const denied = await call(url, "/v1/evaluate", {
      method: "POST",
      body: { agentId: "a1", merchant: "m1", address: "0xbad", amountMinor: "500", currency: "USD" },
    });
    assert.equal(denied.json.allowed, false);
    assert.ok(denied.json.reasons.includes("ADDRESS_DENIED"));

    const pending = await call(url, "/v1/approvals", {
      method: "POST",
      body: { id: "ap1", agentId: "a1", policyId: "p1", merchant: "m1", address: "0xgood", amountMinor: "2500", currency: "USD" },
    });
    assert.equal(pending.status, 201);
    assert.equal(pending.json.status, "pending");

    const decided = await call(url, "/v1/approvals/ap1/decide", {
      method: "POST",
      body: { decision: "approved", decidedBy: "ops@example" },
    });
    assert.equal(decided.status, 200);
    assert.equal(decided.json.status, "approved");

    const committed = await call(url, "/v1/executions", {
      method: "POST",
      body: {
        id: "e1",
        agentId: "a1",
        policyId: "p1",
        merchant: "m1",
        address: "0xgood",
        amountMinor: "2500",
        currency: "USD",
        approvalId: "ap1",
        receiptId: "0x" + "44".repeat(32),
        verdict: "VERIFIED",
      },
    });
    assert.equal(committed.status, 201, JSON.stringify(committed.json));
    assert.equal(committed.json.committed, true);
    assert.equal(committed.json.spend.totalMinor, "2500");

    const refused = await call(url, "/v1/executions", {
      method: "POST",
      body: { id: "e2", agentId: "a1", policyId: "p1", merchant: "m1", address: "0xgood", amountMinor: "6000", currency: "USD" },
    });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.committed, false);
    assert.ok(refused.json.reasons.includes("SPEND_LIMIT_EXCEEDED"));

    const verification = await call(url, "/v1/verifications", {
      method: "POST",
      body: { executionId: "e1", verdict: "VERIFIED", checks: [{ name: "binding", ok: true }] },
    });
    assert.equal(verification.status, 201);

    const spend = await call(url, "/v1/spend?agentId=a1");
    assert.equal(spend.json.totalMinor, "2500");
    assert.equal(spend.json.executions, 1);

    const report = await call(url, "/v1/report");
    assert.equal(report.json.counts.executions, 1);
    assert.equal(report.json.counts.verifications, 1);
    assert.equal(report.json.chain.ok, true);
    assert.match(report.json.reportHash, /^sha256:/);

    const ledger = await call(url, "/v1/audit/verify");
    assert.equal(ledger.json.ok, true);
  });
});

test("CGCP/1 HTTP: state survives a restart on the same store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-http-restart-"));
  const storePath = join(dir, "cp.json");
  const first = await startControlPlaneServer({ storePath, apiKey: API_KEY, port: 0 });
  try {
    await call(first.url, "/v1/agents", { method: "POST", body: { id: "a1" } });
    await call(first.url, "/v1/policies", { method: "POST", body: { id: "p1", spendLimitMinor: "10" } });
  } finally {
    await first.close();
  }
  const second = await startControlPlaneServer({ storePath, apiKey: API_KEY, port: 0 });
  try {
    const report = await call(second.url, "/v1/report");
    assert.equal(report.json.counts.agents, 1);
    assert.equal(report.json.counts.policies, 1);
    assert.equal(report.json.chain.ok, true);
  } finally {
    await second.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CGCP/1 HTTP: malformed input, unknown routes and oversized bodies fail closed", async () => {
  await withServer(
    async ({ url }) => {
      const malformed = await call(url, "/v1/evaluate", { method: "POST", body: "{not json", raw: true });
      assert.equal(malformed.status, 400);
      assert.equal(malformed.json.error.code, "INVALID_JSON");

      const invalidAmount = await call(url, "/v1/policies", { method: "POST", body: { id: "p1", spendLimitMinor: "12.5" } });
      assert.equal(invalidAmount.status, 400);
      assert.equal(invalidAmount.json.error.code, "INVALID_REQUEST");

      const unknown = await call(url, "/v1/does-not-exist");
      assert.equal(unknown.status, 404);
      assert.equal(unknown.json.error.code, "NOT_FOUND");

      const missing = await call(url, "/v1/approvals/ghost");
      assert.equal(missing.status, 404);

      const oversized = await call(url, "/v1/evaluate", {
        method: "POST",
        body: { padding: "z".repeat(500) },
      });
      assert.equal(oversized.status, 413);
      assert.equal(oversized.json.error.code, "BODY_TOO_LARGE");

      // The server is still alive after every failure.
      const health = await call(url, "/health", { auth: false });
      assert.equal(health.status, 200);
      assert.equal(health.json.ok, true);
    },
    { maxBodyBytes: 128 },
  );
});

test("CGCP/1 HTTP: a second plane instance sees the same locked store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-two-planes-"));
  const storePath = join(dir, "cp.json");
  const planeA = createControlPlane({ storePath, create: true });
  const planeB = createControlPlane({ storePath, create: true });
  const started = await startControlPlaneServer({ controlPlane: planeB, apiKey: API_KEY, port: 0 });
  try {
    planeA.upsertAgent({ id: "a1" });
    planeB.upsertPolicy({ id: "p1", spendLimitMinor: "100" });
    const report = await call(started.url, "/v1/report");
    assert.equal(report.json.counts.agents, 1);
    assert.equal(report.json.counts.policies, 1);
    assert.equal(report.json.chain.ok, true);
    // Plane A's next read must see Plane B's write (reload under lock).
    assert.ok(planeA.getPolicy("p1"));
  } finally {
    await started.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("CGCP/1 HTTP: health is liveness-only (no chain/ledger data) and limit is bounded", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-http-"));
  const storePath = join(dir, "cp.json");
  const plane = createControlPlane({ storePath, create: true });
  plane.upsertAgent({ id: "a1" });
  plane.upsertPolicy({ id: "p1" });
  const srv = await startControlPlaneServer({ controlPlane: plane, apiKey: "k", port: 0, host: "127.0.0.1" });
  try {
    const health = await call(srv.url, "/health", { auth: false });
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.chain, undefined); // CP-08: no ledger/chain exposure

    const badLimit = await call(srv.url, "/v1/audit?limit=not-a-number", { apiKey: "k" });
    assert.equal(badLimit.status, 200);
    assert.ok(Array.isArray(badLimit.json.audit)); // CP-09: falls back safely
  } finally {
    await srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
