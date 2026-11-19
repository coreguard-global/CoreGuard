/**
 * The corpus vector this thread produced: `present-consistent-nonconforming`.
 *
 * One receipt, two questions, two correct answers:
 *
 *   AER-1   `verified`             the saved result is exactly the bytes the
 *                                  issuer committed; nothing moved after the
 *                                  fact.
 *   VAR/1   `VERIFICATION_FAILED`  the execution is not the one that was
 *                                  approved — total_minor and its line moved
 *                                  after approval.
 *
 * Both columns are pinned in the fixture. The AER-1 column is derived from that
 * standard's published rule (the digest re-derives over the committed bytes),
 * NOT from running `aer1-verify`: this tree implements no AER-1 verifier, and a
 * pin derived from a model is only worth having if it says so out loud.
 *
 * The negative controls are the point. Give the verifier the executed order as
 * its intent and the same receipt passes; flip a byte and the AER-1 column
 * moves by itself. A pin that cannot be moved is not a pin, it is prose.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { digestOf, seededKey, sha256Hex } from "../../examples/var1-pilot-kit/lib.mjs";
import { buildReceipt, inspectReceipt } from "../../examples/var1-pilot-kit/receipt.mjs";
import { decidePayment } from "../../packages/agent-commerce/decision.mjs";
import { createKeyring, pinKey } from "../../packages/agent-commerce/trust.mjs";

const FIXTURE = new URL("../fixtures/var1-corpus-v1/present-consistent-nonconforming.json", import.meta.url);
const VECTOR = Object.freeze(JSON.parse(readFileSync(fileURLToPath(FIXTURE), "utf8")));

/** Build the receipt the fixture describes, from its seed and its clock. */
function materialise(vector, { approved = vector.approved } = {}) {
  const key = seededKey(vector.seed);
  const built = buildReceipt({
    merchant: { id: vector.approved.merchant_id, name: "Sandbox Books" },
    approved,
    approvalNonce: vector.approval_nonce,
    executed: vector.executed,
    at: vector.at,
    privateKeyPem: key.privateKeyPem,
  });
  const keyring = pinKey(createKeyring(), { publicKeyPem: key.publicKeyPem });
  return { built, keyring };
}

/**
 * AER-1's record rule, stated as the note states it: `verified` iff the digest
 * re-derives over the committed bytes. The id here is the digest of those bytes,
 * so re-hashing them is the whole test.
 */
function aer1RecordVerdict({ bytes, receiptId }) {
  const named = String(receiptId).replace(/^urn:/, "");
  const recomputed = "sha256:" + sha256Hex(Buffer.from(bytes, "utf8"));
  return recomputed === named ? "verified" : "verification failed";
}

/** Both columns for one pair of inputs, with every fact the fixture pins. */
function judge(vector, { approved = vector.approved, expectedIntent = approved, bytes = null } = {}) {
  const { built, keyring } = materialise(vector, { approved });
  const served = bytes ?? built.bytes;
  const inspection = inspectReceipt({ bytes: served, expectedIntent, keyring });
  const decision = decidePayment({ outcome: inspection.outcome, policy: vector.policy });
  return {
    columns: {
      aer1_record_verdict: aer1RecordVerdict({ bytes: served, receiptId: built.receiptId }),
      var1_outcome: inspection.outcome,
      var1_decision: decision.decision,
      var1_drift_fields: inspection.drift.map((d) => d.field),
      signature_ok: inspection.signatureOk,
      key_status: inspection.keyStatus,
      columns_disagree: aer1RecordVerdict({ bytes: served, receiptId: built.receiptId }) !== "verified" || inspection.outcome !== "VERIFIED",
    },
    built,
    inspection,
    decision,
  };
}

/** Named problems, so a softened pin fails with a sentence instead of a diff. */
function problemsFor(vector, options) {
  const { columns } = judge(vector, options);
  const problems = [];
  for (const [key, expected] of Object.entries(vector.pins)) {
    const actual = columns[key];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`${key}: fixture pins ${JSON.stringify(expected)}, run produced ${JSON.stringify(actual)}`);
    }
  }
  return problems;
}

test("the pinned columns are the columns the run produces", () => {
  assert.deepEqual(problemsFor(VECTOR), []);
});

test("the two columns disagree on the same bytes, and only one of them looks at the approval", () => {
  const row = judge(VECTOR);
  assert.equal(row.columns.aer1_record_verdict, "verified");
  assert.equal(row.columns.var1_outcome, "VERIFICATION_FAILED");
  assert.equal(row.columns.var1_decision, "DECLINE");
  assert.equal(row.columns.signature_ok, true, "a valid signature is not the question AER-1 negates");
  assert.equal(row.columns.key_status, "trusted");
  // The AER-1 column reads the bytes only: hand it a different held intent and
  // it must not move, because intent is not part of what AER-1 asserts.
  const withoutIntent = judge(VECTOR, { expectedIntent: VECTOR.executed });
  assert.equal(withoutIntent.columns.aer1_record_verdict, "verified");
});

test("the decline is caused by the approval binding, not by the harness", () => {
  // Same execution, same key, same clock — the only change is that this merchant
  // got the surcharge approved up front. If this passes, the DECLINE above is
  // drift and nothing else: the signature, the pin and the id were never the
  // question.
  const declined = judge(VECTOR);
  const approvedUpFront = judge(VECTOR, { approved: VECTOR.executed });
  assert.equal(declined.columns.var1_outcome, "VERIFICATION_FAILED");
  assert.equal(approvedUpFront.columns.var1_outcome, "VERIFIED");
  assert.equal(approvedUpFront.columns.var1_decision, "ALLOW");
  assert.deepEqual(approvedUpFront.columns.var1_drift_fields, []);
  assert.equal(approvedUpFront.columns.aer1_record_verdict, "verified");
  // The execution is identical in both receipts, byte for byte.
  assert.deepEqual(approvedUpFront.built.body.execution, declined.built.body.execution);
});

test("integrity has teeth: one changed digit moves the AER-1 column", () => {
  const { built } = materialise(VECTOR);
  const damaged = built.bytes.replace('"total_minor":13900', '"total_minor":13800');
  assert.notEqual(damaged, built.bytes, "the damage fixture did not change a byte");
  const row = judge(VECTOR, { bytes: damaged });
  assert.equal(row.columns.aer1_record_verdict, "verification failed");
  assert.equal(row.columns.var1_outcome, "VERIFICATION_FAILED");
});

test("must-fail: a pin that claims the comfortable answer fails by name", () => {
  const softened = {
    ...VECTOR,
    pins: { ...VECTOR.pins, var1_outcome: "VERIFIED", var1_decision: "ALLOW" },
  };
  const problems = problemsFor(softened);
  assert.equal(problems.length, 2, `expected two named problems, got ${JSON.stringify(problems)}`);
  assert.ok(problems.some((p) => p.startsWith("var1_outcome:")));
  assert.ok(problems.some((p) => p.startsWith("var1_decision:")));

  const flipped = {
    ...VECTOR,
    pins: { ...VECTOR.pins, aer1_record_verdict: "verification failed" },
  };
  assert.ok(problemsFor(flipped).some((p) => p.startsWith("aer1_record_verdict:")));
});

test("the vector's approval and execution are arithmetically consistent on both sides", () => {
  // A self-consistent execution is what makes this vector hard: the receipt's
  // own arithmetic holds, so nothing but the approval binding can explain the
  // refusal.
  for (const order of [VECTOR.approved, VECTOR.executed]) {
    const sum = order.items.reduce((n, item) => n + item.qty * item.unit_minor, 0);
    assert.equal(order.total_minor, sum, `${order === VECTOR.approved ? "approved" : "executed"} total must equal its lines`);
  }
  assert.equal(digestOf(VECTOR.approved) === digestOf(VECTOR.executed), false);
});
