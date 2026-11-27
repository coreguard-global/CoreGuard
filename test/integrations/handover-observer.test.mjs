import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyHandover, verdictDigest, canonicalJson } from "../../packages/handover-observer/observer.mjs";
import { decide } from "../../packages/handover-observer/receiver.mjs";
import { buildDecisionTrace } from "../../packages/handover-observer/trace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "handover");
const ZAMBACk = readFileSync(join(FIXTURES, "zamback-e2ef637d.json"), "utf8");
const ADCTX = readFileSync(join(FIXTURES, "adctx-60b51198.json"), "utf8");
const OBSERVER = { observer: "test-observer", readAt: "2026-11-27T12:00:00.000Z" };

test("the 41-step handover recomputes from its own bytes", () => {
  const v = verifyHandover(ZAMBACk, {
    ...OBSERVER,
    expectedId: "e2ef637d-663e-4020-bdc9-c69fbb1fa4de",
  });
  assert.equal(v.outcome, "verified");
  assert.equal(v.coverage.steps, 41);
  assert.equal(v.coverage.receiptsVerified, 41);
  assert.equal(v.coverage.receiptsFailed, 0);
  assert.equal(v.coverage.operationsNotChecked, 1);
  assert.equal(v.merkle.declared, "seq-output-v1");
  assert.equal(v.merkle.ok, true);
  assert.equal(v.workflowReceipt.outcome, "verified");
  assert.equal(v.workflowReceipt.metadataHash.present, true);
  assert.equal(v.workflowReceipt.metadataHash.preimageChecked, true);
  assert.equal(v.workflowReceipt.metadataHash.matched, true);
  assert.ok(!v.notChecked.some((n) => n.scope === "steps_digest" || n.scope === "workflow-close metadata_hash"));
  assert.equal(v.checks.filter((c) => !c.ok).length, 0);
});

test("a refused step keeps its verified receipt bytes and its not_checked operation", () => {
  const v = verifyHandover(ZAMBACk, OBSERVER);
  const step = v.steps.find((s) => s.index === 18);
  assert.equal(step.status, "refused");
  assert.equal(step.outcome, "not_checked");
  assert.equal(step.digest.ok, true);
  assert.equal(v.outcome, "verified");
  assert.ok(v.notChecked.some((n) => n.scope.includes("step[18]")));
});

test("the 4-step handover proceeds under the default receiver policy", () => {
  const v = verifyHandover(ADCTX, {
    ...OBSERVER,
    expectedId: "60b51198-98fa-40c1-be0c-5566eded0feb",
  });
  assert.equal(v.outcome, "verified");
  assert.equal(v.coverage.receiptsVerified, 4);
  assert.equal(v.coverage.operationsNotChecked, 0);
  assert.equal(v.merkle.ok, true);
  assert.equal(decide(v).decision, "proceed");
});

test("the refused handover holds, not rejects: integrity is not the operation", () => {
  const v = verifyHandover(ZAMBACk, OBSERVER);
  const d = decide(v);
  assert.equal(d.decision, "hold");
  assert.ok(d.reasons.some((r) => r.includes("did not complete")));
});

test("one changed byte in a receipt is a failed verification", () => {
  const bundle = JSON.parse(ZAMBACk);
  const decoded = Buffer.from(bundle.steps[0].canonical_bytes_base64, "base64");
  decoded[0] ^= 0x01;
  bundle.steps[0].canonical_bytes_base64 = decoded.toString("base64");
  const v = verifyHandover(JSON.stringify(bundle), OBSERVER);
  assert.equal(v.outcome, "verification_failed");
  assert.equal(v.steps[0].outcome, "verification_failed");
  assert.equal(decide(v).decision, "reject");
});

test("a duplicate member name is refused before any value is trusted", () => {
  const tampered = ZAMBACk.replace('"id":"', '"id":"00000000-0000-0000-0000-000000000000","id":"');
  const v = verifyHandover(tampered, OBSERVER);
  assert.equal(v.outcome, "verification_failed");
  assert.ok(v.checks.some((c) => c.id.includes("duplicate") && !c.ok));
});

test("an unexpected handover id fails the binding", () => {
  const v = verifyHandover(ADCTX, { ...OBSERVER, expectedId: "00000000-0000-4000-8000-000000000000" });
  assert.equal(v.outcome, "verification_failed");
});

test("a missing schema-0.4 metadata_hash fails rather than passing quietly", () => {
  const bundle = JSON.parse(ADCTX);
  delete bundle.workflow_receipt.metadata_hash;
  const v = verifyHandover(JSON.stringify(bundle), OBSERVER);
  assert.equal(v.workflowReceipt.metadataHash.present, false);
  assert.equal(v.outcome, "verification_failed");
});

test("the verdict digest is deterministic and covers the whole verdict", () => {
  const a = verifyHandover(ADCTX, OBSERVER);
  const b = verifyHandover(ADCTX, OBSERVER);
  assert.equal(a.verdictDigest, b.verdictDigest);
  assert.equal(verdictDigest(a), a.verdictDigest);
  const c = verifyHandover(ADCTX, { ...OBSERVER, readAt: "2026-11-27T12:00:01.000Z" });
  assert.notEqual(a.verdictDigest, c.verdictDigest);
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("an unreadable observer outcome asks for evidence, never proceeds", () => {
  const v = verifyHandover("", OBSERVER);
  assert.equal(v.outcome, "unavailable");
  assert.equal(decide(v).decision, "request_more_evidence");
});

test("a bundle with no graph.aer is judged and the missing draft is recorded", () => {
  const v = verifyHandover(ADCTX, OBSERVER);
  assert.equal(v.handover.draft, null);
  assert.ok(v.notChecked.some((n) => n.scope === "handover draft"));
  assert.equal(v.outcome, "verified");
});

test("the decision trace records both decisions, the verdict digest and the mover", () => {
  const z = verifyHandover(ZAMBACk, OBSERVER);
  const zTrace = buildDecisionTrace(z, decide(z));
  assert.equal(zTrace.trace_version, "CG-HANDOVER-TRACE/1");
  assert.equal(zTrace.verdict_digest, z.verdictDigest);
  assert.equal(zTrace.decision_before.decision, "proceed");
  assert.equal(zTrace.decision_after.decision, "hold");
  assert.equal(zTrace.changed, true);
  assert.match(zTrace.reason, /step 18/);
  assert.equal(zTrace.simulated, true);

  const a = verifyHandover(ADCTX, OBSERVER);
  const aTrace = buildDecisionTrace(a, decide(a));
  assert.equal(aTrace.decision_before.decision, "proceed");
  assert.equal(aTrace.decision_after.decision, "proceed");
  assert.equal(aTrace.changed, false);
  assert.equal(aTrace.reason, null);
});
