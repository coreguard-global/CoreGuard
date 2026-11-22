import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, requirePermission, createAuthContext } from "../../packages/agent-commerce/prod/rbac.mjs";
import { createMetrics, createHealth } from "../../packages/agent-commerce/prod/observability.mjs";
import { createLocalKeyProvider, createAnchorProvider } from "../../packages/agent-commerce/prod/kms-anchor.mjs";
import { openSqliteStorage } from "../../packages/agent-commerce/prod/sqlite-storage.mjs";

test("M2 RBAC: roles map to permissions deterministically", () => {
  assert.equal(hasPermission(["admin"], "policy:write"), true);
  assert.equal(hasPermission(["auditor"], "policy:write"), false);
  assert.equal(hasPermission(["agent-runtime"], "execution:commit"), true);
  const auth = createAuthContext({ tenantId: "t1", subject: "u1", roles: ["operator"] });
  assert.equal(requirePermission(auth, "approval:write"), true);
  assert.throws(() => requirePermission(auth, "key:rotate"), /FORBIDDEN|FORBIDDEN/);
});

test("M3 observability: metrics and health hooks work", () => {
  const m = createMetrics();
  m.inc("requests", { route: "/v1/agents" }, 1);
  m.observe("latency_ms", 12, { route: "/v1/agents" });
  const snap = m.snapshot();
  assert.equal(snap.counters.length, 1);
  const db = openSqliteStorage(":memory:");
  db.ensureTenant({ id: "t1", name: "T1" });
  const h = createHealth({ storage: db, tenantId: "t1" });
  assert.equal(h.live().ok, true);
  assert.equal(h.ready().ok, true);
  db.close();
});

test("M4 KMS/anchor interfaces: local key provider and anchor receipt verify", async () => {
  const kms = createLocalKeyProvider({ keys: { default: "dev-secret" } });
  const sig = await kms.sign("default", "payload");
  assert.equal(sig.alg, "HMAC-SHA256");
  const rotated = await kms.rotateKey("default", "new-secret");
  assert.match(rotated.fingerprint, /^sha256:/);
  const anchor = createAnchorProvider({ mode: "local-file", hmacKey: "anchor-secret" });
  const head = { headHash: "sha256:abc", length: 3 };
  const receipt = await anchor.anchor(head);
  const v = await anchor.verify(receipt, head);
  assert.equal(v.ok, true);
  const bad = await anchor.verify(receipt, { headHash: "sha256:def", length: 3 });
  assert.equal(bad.ok, false);
});
