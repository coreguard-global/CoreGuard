/**
 * CG-OUT/1 — the outcome layer above the reject codes.
 *
 * Every fixture here is written as a must-fail case: it pins the answer a
 * consumer is NOT allowed to receive. The one that matters most is the first —
 * a party that never parted with a receipt must never be scored as having
 * failed a verification it never took part in, because that single collapse is
 * what turns an opt-in layer into a liability.
 *
 * BOUNDARY (standing): this layer decides nothing about quality, safety or
 * delivery. VERIFIED here means the record's own checks passed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OUTCOMES,
  OUTCOME_CODES,
  NON_BLOCKING_OUTCOMES,
  OUTCOME_VERSION,
  decideOutcome,
  assertNotRenderedAsBlock,
  selfCheck,
} from "../../packages/agent-commerce/outcomes.mjs";

const VERIFIED_RECORD = { evaluated: true, ok: true };

test("the five outcomes are the whole vocabulary, and every one is reachable", () => {
  assert.deepEqual(OUTCOMES, [
    "VERIFIED",
    "VERIFICATION_FAILED",
    "ABSENT",
    "NOT_CHECKED",
    "UNRESOLVABLE_RECORD",
  ]);
  const reached = new Set([
    decideOutcome({ presented: true, record: VERIFIED_RECORD }).outcome,
    decideOutcome({ presented: true, record: { evaluated: true, ok: false, code: "BAD_DIGEST" } }).outcome,
    decideOutcome({ presented: false }).outcome,
    decideOutcome({ presented: true, record: { evaluated: false } }).outcome,
    decideOutcome({
      presented: true,
      record: VERIFIED_RECORD,
      anchor: { present: true, evaluated: true, outcome: "unresolvable" },
    }).outcome,
  ]);
  assert.deepEqual([...reached].sort(), [...OUTCOMES].sort(), "every declared outcome must be produced by real facts");
});

test("must-fail: absence is silence, never a failed verification", () => {
  // Hostile input on purpose: a caller passes a record-shaped object alongside
  // presented:false. The record must not be judged at all.
  const r = decideOutcome({ presented: false, record: { evaluated: true, ok: false, code: "BAD_DIGEST" } });
  assert.equal(r.outcome, "ABSENT");
  assert.equal(r.code, OUTCOME_CODES.ABSENT);
  assert.equal(r.blocks, false, "an absence must never travel as a block");
  assert.match(r.reason, /silence is not a failed verification/);
});

test("the guard refuses to render a non-blocking outcome as a block", () => {
  for (const outcome of NON_BLOCKING_OUTCOMES) {
    assert.throws(() => assertNotRenderedAsBlock(outcome), /must never travel as BLOCK/, `${outcome} must throw`);
  }
  assert.equal(assertNotRenderedAsBlock("VERIFICATION_FAILED"), "VERIFICATION_FAILED");
  assert.throws(() => assertNotRenderedAsBlock("NOT_AN_OUTCOME"), /unknown outcome/);
});

test("must-fail: an unsupported version answers NOT_CHECKED with the version named", () => {
  const r = decideOutcome({
    presented: true,
    record: { evaluated: false, version: "0.4" },
  });
  assert.equal(r.outcome, "NOT_CHECKED");
  assert.notEqual(r.outcome, "VERIFIED");
  assert.notEqual(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.blocks, false);
  assert.equal(r.detail.version, "0.4");
  assert.match(r.reason, /0\.4/);
});

test("a failed record keeps its own named code and does block", () => {
  const r = decideOutcome({
    presented: true,
    record: { evaluated: true, ok: false, code: "XDR_BINDING_MISMATCH", reason: "the envelope is not the authorized one" },
  });
  assert.equal(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.code, "XDR_BINDING_MISMATCH");
  assert.equal(r.blocks, true);
});

test("must-fail: a failed record with no code fails closed to VERIFIER_ERROR, never to a pass", () => {
  const r = decideOutcome({ presented: true, record: { evaluated: true, ok: false } });
  assert.equal(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.code, "VERIFIER_ERROR");
});

test("must-fail: a present anchor that was deliberately skipped claims nothing", () => {
  const r = decideOutcome({
    presented: true,
    record: VERIFIED_RECORD,
    anchor: { present: true, evaluated: false },
  });
  assert.equal(r.outcome, "NOT_CHECKED");
  assert.equal(r.blocks, false);
  assert.equal(r.layers.record.ok, true, "the record layer still reports its own answer");
});

test("must-fail: an unresolvable anchor is its own outcome, not a borrowed digest failure", () => {
  const r = decideOutcome({
    presented: true,
    record: VERIFIED_RECORD,
    anchor: { present: true, evaluated: true, outcome: "unresolvable" },
  });
  assert.equal(r.outcome, "UNRESOLVABLE_RECORD");
  assert.equal(r.code, OUTCOME_CODES.UNRESOLVABLE_RECORD);
  assert.notEqual(r.code, "BAD_DIGEST");
  assert.notEqual(r.outcome, "VERIFICATION_FAILED");
});

test("layers keep their own answers: verified record, absent anchor", () => {
  const r = decideOutcome({
    presented: true,
    record: VERIFIED_RECORD,
    anchor: { present: false, evaluated: false, outcome: "absent" },
  });
  assert.equal(r.outcome, "VERIFIED", "a record with no anchor is not a failed record");
  assert.equal(r.layers.anchor.present, false);
});

test("must-fail: three layers disagreeing must not collapse into one PASS/BLOCK", () => {
  // The production shape reported by the AER-1 side: identity matched, the
  // server asserts verified, and the local verifier still fails the record on
  // an input commitment it cannot recompute. One boolean at the top would have
  // hidden the only interesting fact in the run.
  const r = decideOutcome({
    presented: true,
    record: { evaluated: true, ok: false, code: "INPUT_COMMITMENT_UNVERIFIABLE" },
    anchor: { present: true, evaluated: true, outcome: "verified" },
  });
  assert.equal(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.layers.record.code, "INPUT_COMMITMENT_UNVERIFIABLE");
  assert.equal(r.layers.anchor.outcome, "verified", "the anchor layer's agreement is preserved, not erased");
  assert.equal(r.layers.record.evaluated, true);
});

test("must-fail: unknown or malformed facts fail closed, never VERIFIED", () => {
  const cases = [
    {},
    { presented: true },
    { presented: true, record: null },
    { presented: true, record: [] },
    { presented: true, record: { evaluated: "yes", ok: true } },
    { presented: "true", record: VERIFIED_RECORD },
  ];
  for (const input of cases) {
    const r = decideOutcome(input);
    assert.notEqual(r.outcome, "VERIFIED", `these facts must not verify: ${JSON.stringify(input)}`);
    assert.ok(OUTCOMES.includes(r.outcome));
  }
});

test("negative control: the mapping is not a constant", () => {
  const alwaysVerified = () => "VERIFIED";
  const table = [
    decideOutcome({ presented: false }),
    decideOutcome({ presented: true, record: { evaluated: false } }),
    decideOutcome({ presented: true, record: { evaluated: true, ok: false, code: "BAD_DIGEST" } }),
    decideOutcome({
      presented: true,
      record: VERIFIED_RECORD,
      anchor: { present: true, evaluated: false },
    }),
  ];
  const disagreements = table.filter((r) => alwaysVerified() !== r.outcome);
  assert.ok(disagreements.length >= 4, "a constant mapper must disagree with at least four fixtures");
});

test("determinism and self-check: identical facts produce identical verdicts", () => {
  const input = {
    presented: true,
    record: { evaluated: true, ok: false, code: "POLICY_MISMATCH" },
    anchor: { present: true, evaluated: true, outcome: "verified" },
  };
  assert.deepEqual(decideOutcome(input), decideOutcome(input));
  const check = selfCheck();
  assert.equal(check.ok, true, `self-check failed: ${JSON.stringify(check.checks.filter((c) => !c.pass))}`);
  assert.equal(check.outcomeVersion, OUTCOME_VERSION);
});
