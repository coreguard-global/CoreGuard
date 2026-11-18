/**
 * CG-DECIDE/1 — the table between "we checked" and "we ship".
 *
 * Two failure modes are tested by name because they are the ones that cost real
 * money: a false decline (we refused because evidence was missing) and a false
 * trust (we allowed and told nobody that nothing was checked). The matrix is the
 * negative control: all fifteen cells are decided, and the invariants are checked
 * over every one of them rather than over a hand-picked row.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_VERSION,
  DECISIONS,
  POLICIES,
  assertDecisionInvariants,
  decidePayment,
  decisionMatrix,
  explainDecision,
  selfCheck,
} from "../../packages/agent-commerce/decision.mjs";

test("selfCheck passes", () => {
  const r = selfCheck();
  assert.equal(r.ok, true, r.checks.filter((c) => !c.pass).map((c) => c.name).join(", "));
});

test("the version and the vocabularies are pinned", () => {
  assert.equal(DECISION_VERSION, "CG-DECIDE/1");
  assert.deepEqual([...DECISIONS], ["ALLOW", "ALLOW_UNVERIFIED", "HOLD", "DECLINE"]);
  assert.deepEqual([...POLICIES], ["strict", "balanced", "availability"]);
});

test("only a failed check may decline — in every policy, in every cell", () => {
  const inv = assertDecisionInvariants();
  assert.deepEqual(inv.violations, []);
  assert.equal(inv.rows, 15);
  const declines = decisionMatrix().filter((r) => r.decision === "DECLINE");
  assert.equal(declines.length, 3);
  assert.ok(declines.every((r) => r.outcome === "VERIFICATION_FAILED"));
});

test("missing evidence never declines: absent and not-checked are allows that say so", () => {
  for (const policy of POLICIES) {
    for (const outcome of ["ABSENT", "NOT_CHECKED"]) {
      const d = decidePayment({ outcome, policy });
      assert.equal(d.decision, "ALLOW_UNVERIFIED");
      assert.equal(d.unverified, true);
      assert.equal(d.verified, false);
      assert.equal(d.blocks, false);
      assert.equal(d.captureAllowed, true);
    }
  }
});

test("an unresolvable anchor holds under strict and balanced, never silently allows", () => {
  for (const policy of ["strict", "balanced"]) {
    const d = decidePayment({ outcome: "UNRESOLVABLE_RECORD", policy });
    assert.equal(d.decision, "HOLD");
    assert.equal(d.retry, true);
    assert.equal(d.captureAllowed, false);
    assert.equal(d.unverified, false);
  }
  const loose = decidePayment({ outcome: "UNRESOLVABLE_RECORD", policy: "availability" });
  assert.equal(loose.decision, "ALLOW_UNVERIFIED");
  assert.equal(loose.unverified, true);
});

test("a verified record is the only route to a bare ALLOW", () => {
  for (const policy of POLICIES) {
    const d = decidePayment({ outcome: "VERIFIED", policy });
    assert.equal(d.decision, "ALLOW");
    assert.equal(d.verified, true);
    assert.equal(d.unverified, false);
  }
});

test("an unknown outcome throws instead of being mapped to an allow", () => {
  assert.throws(() => decidePayment({ outcome: "PROBABLY_FINE" }), TypeError);
  assert.throws(() => decidePayment({ outcome: "VERIFIED", policy: "yolo" }), TypeError);
});

test("every decision is explainable without a codebook", () => {
  for (const row of decisionMatrix()) {
    assert.equal(typeof row.explain, "string");
    assert.ok(row.explain.length > 30);
    assert.equal(row.explain, explainDecision({ decision: row.decision, outcome: row.outcome, policy: row.policy }));
  }
});

test("the same inputs produce the same object shape in every cell", () => {
  const keys = Object.keys(decidePayment({ outcome: "VERIFIED" })).sort();
  for (const row of decisionMatrix()) assert.deepEqual(Object.keys(row).sort(), keys);
});
