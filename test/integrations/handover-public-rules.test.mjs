import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyHandover, verdictDigest, stepsDigestOf, metadataHashOf,
  STEPS_DIGEST_RULE, METADATA_HASH_RULE,
} from "../../packages/handover-observer/observer.mjs";
import { decide } from "../../packages/handover-observer/receiver.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURES = join(ROOT, "test/fixtures/handover");
const ZAM = readFileSync(join(FIXTURES, "zamback-e2ef637d.json"), "utf8");
const ADCTX = readFileSync(join(FIXTURES, "adctx-60b51198.json"), "utf8");
const TAMPERED = readFileSync(join(FIXTURES, "zamback-tampered-step.json"), "utf8");
const OBS = {
  observer: "coreguard-observer:cli",
  readAt: "2026-11-27T16:15:00.000Z",
  expectedId: "e2ef637d-663e-4020-bdc9-c69fbb1fa4de",
};
const sha = (s) => "sha256:" + createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

test("steps_digest reproduces both published vectors and rejects reordered or dropped ids", () => {
  const z = JSON.parse(ZAM);
  const a = JSON.parse(ADCTX);
  assert.match(STEPS_DIGEST_RULE, /newline/);
  assert.equal(stepsDigestOf(z), "258dc2ec13ba1ea6e9a55d28a21276ad63abe069754e3b456d0c144751343127");
  assert.equal(stepsDigestOf(a), "116a8d85e28e19118c664b1e2e6860179f67f833540e2b0d19d7377017a1420f");

  const swapped = structuredClone(z);
  [swapped.steps[0], swapped.steps[1]] = [swapped.steps[1], swapped.steps[0]];
  assert.equal(stepsDigestOf(swapped), "3b55d85a58d63db0c062dec1d7c9ee0551b794ee443f3e1fd7fbfb541cb9312f");
  const dropped = structuredClone(z);
  dropped.steps.pop();
  assert.equal(stepsDigestOf(dropped), "b7dbfc3b8833797045ebd53328c8d4298c2b6700d617407f4b6104c9c72dd336");
  dropped.steps_digest = stepsDigestOf(dropped);
  const droppedVerdict = verifyHandover(JSON.stringify(dropped), OBS);
  assert.equal(droppedVerdict.checks.find((c) => c.id.startsWith("steps_digest")).ok, true);
});

test("metadata_hash reproduces both published blocks and fails on a changed provenance class", () => {
  const z = JSON.parse(ZAM);
  const a = JSON.parse(ADCTX);
  assert.match(METADATA_HASH_RULE, /canonical metadata block/);
  assert.equal(metadataHashOf(z.workflow_receipt), z.workflow_receipt.metadata_hash);
  assert.equal(metadataHashOf(a.workflow_receipt), a.workflow_receipt.metadata_hash);
  assert.equal(metadataHashOf(z.workflow_receipt), "sha256:edd66244b6ffd7f5edd957b3890d2ad1f97bc3a2fce40c2b02de9c7bd7ca61be");
  assert.equal(metadataHashOf(a.workflow_receipt), "sha256:50f3d8054ea094fc70d050dcf9d237b2406696997d0d26c519c2a33483f60137");

  const bad = structuredClone(z);
  bad.workflow_receipt.provenance_class = "LOGGED BY AGENT";
  assert.equal(metadataHashOf(bad.workflow_receipt), "sha256:c60279230fbcc9f02a6cbe4f050ae5bacd696a85fbace6d5fb1e4152b2ec6037");
  const v = verifyHandover(JSON.stringify(bad), OBS);
  assert.equal(v.outcome, "verification_failed");
  assert.ok(v.checks.some((c) => !c.ok && c.id.includes("metadata_hash matches")));
});

test("the #165 negative bundle is byte-reproducible from the positive fixture", () => {
  const r = spawnSync("node", ["scripts/handover-negative-build.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  const record = JSON.parse(r.stdout);
  assert.equal(record.observer_step_label, "step[5]");
  assert.equal(record.receipt_id, "2477de3d-377d-4da3-92d4-b878566346d4");
  assert.equal(record.value_offset_in_canonical_bytes, 768);
  assert.equal(sha(TAMPERED), "sha256:3172d20c199130f1b9b786069ff729305a3091deb0d36881ea5ae8cfc290e3fc");
});

test("the public negative control rejects step[5] and leaves the other bindings intact", () => {
  const v = verifyHandover(TAMPERED, OBS);
  assert.equal(v.outcome, "verification_failed");
  assert.deepEqual(v.coverage, { steps: 41, receiptsVerified: 40, receiptsFailed: 1, operationsNotChecked: 1, declaredNotChecked: 1 });
  assert.equal(v.verdictDigest, "sha256:68670fb9a92927992cbcd6fcc36de39806c0623bccd695cd6974df7f90c9fccb");
  assert.equal(verdictDigest(v), v.verdictDigest);
  assert.deepEqual(v.checks.filter((c) => !c.ok).map((c) => c.id), [
    "step[5] output_hash matches the decoded bytes",
    "step[5] passes the AER-1 parser",
  ]);
  assert.equal(v.checks.find((c) => c.id.startsWith("step[5] output_hash")).detail.computed,
    "sha256:b62f7cd9e35508770e07c1f0c08ce71e66cbfd9ac4a6efb8860d06328ee88dae");
  assert.equal(v.checks.find((c) => c.id.startsWith("step[5] passes")).detail.code, "DIGEST_MISMATCH");
  assert.equal(v.merkle.ok, true);
  assert.equal(v.checks.find((c) => c.id.startsWith("steps_digest")).ok, true);
  assert.equal(v.workflowReceipt.metadataHash.matched, true);
  assert.equal(decide(v).decision, "reject");
});

test("the positive control still states what the record does not establish", () => {
  const v = verifyHandover(ZAM, OBS);
  assert.equal(v.outcome, "verified");
  assert.equal(v.verdictDigest, "sha256:b4e6255e0e0df38d9675ad54088aff2cf6ceaa4dbe12834a88f0213c97b27d3f");
  assert.equal(v.checks.filter((c) => !c.ok).length, 0);
  assert.equal(v.coverage.receiptsVerified, 41);
  assert.ok(!v.notChecked.some((n) => ["steps_digest", "workflow-close metadata_hash"].includes(n.scope)));
  assert.ok(v.notEstablished.includes("issuer identity: the bundle publishes no pinned signing key"));
  assert.ok(!v.checks.some((c) => c.id.toLowerCase().includes("issuer identity") && c.ok));
  assert.equal(decide(v).decision, "hold");
});

test("a receiver that holds on unchecked commitments moves from hold to proceed once both preimages are published", () => {
  const v = verifyHandover(ZAM, OBS);
  const receiver = (verdict) => {
    if (verdict.outcome !== "verified" || !verdict.merkle.ok) return "reject";
    const unchecked = (verdict.notChecked || []).filter((n) =>
      n.scope === "steps_digest" || n.scope === "workflow-close metadata_hash");
    return unchecked.length > 0 ? "hold" : "proceed";
  };
  const before = {
    ...v,
    notChecked: [...v.notChecked, { scope: "steps_digest", reason: "outside_scope", detail: "no published preimage rule" }],
  };
  assert.equal(receiver(before), "hold");
  assert.equal(receiver(v), "proceed");
});
