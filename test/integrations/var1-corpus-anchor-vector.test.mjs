/**
 * The second corpus vector this thread produced: `anchor-unresolvable`.
 *
 * Rows 13 and 14 of the mapping collided on one word. `unresolvable` was doing
 * two jobs — a record that cannot be resolved, and an anchor that cannot be
 * resolved — so a reader could not tell which layer had refused. This vector
 * gives each layer its own column and its own name:
 *
 *   record layer   `record-unresolvable`        a urn:sha256 name whose bytes
 *                                               cannot be produced is a record
 *                                               failure, not an absence
 *   anchor layer   `anchor-unresolvable`        the receipt is present and the
 *                                               anchor's log cannot be resolved
 *                                               (`rejected: unresolvable record`)
 *
 * On this receipt the record layer has nothing to refuse: the execution is the
 * one that was approved, so VAR/1 reads VERIFIED and ALLOW. The anchor layer
 * refuses the resource. Both facts are pinned, and the vector exists so that
 * neither one prints as the other.
 *
 * The AER-1 columns are derived from that standard's published rule for record
 * and anchor outcomes, NOT from running `aer1-verify`. This tree implements no
 * AER-1 verifier, so the columns are citations with checks under them.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalBytes, digestOf, seededKey, sha256Hex } from "../../examples/var1-pilot-kit/lib.mjs";
import { buildReceipt, inspectReceipt } from "../../examples/var1-pilot-kit/receipt.mjs";
import { signAttestation } from "../../packages/agent-commerce/anchor.mjs";
import { decidePayment } from "../../packages/agent-commerce/decision.mjs";
import { createKeyring, pinKey } from "../../packages/agent-commerce/trust.mjs";

const FIXTURE = new URL("../fixtures/var1-corpus-v1/anchor-unresolvable.json", import.meta.url);
const VECTOR = Object.freeze(JSON.parse(readFileSync(fileURLToPath(FIXTURE), "utf8")));

/** RFC 2606 hosts never resolve, so resolvability is decided offline. */
const NEVER_RESOLVES = /\.(invalid|test)$/i;

const UNRESOLVABLE = "rejected: unresolvable record";
const NOT_CHECKED = "not checked";
const ABSENT = "absent";

/**
 * Build the receipt the fixture describes and sign it over a body that carries
 * the anchor. Signing the anchor inside the body is the point: strip it later
 * and the attestation no longer covers what is served.
 */
function materialise(vector, { anchor = vector.anchor } = {}) {
  const key = seededKey(vector.seed);
  const base = buildReceipt({
    merchant: { id: vector.approved.merchant_id, name: "Sandbox Books" },
    approved: vector.approved,
    approvalNonce: vector.approval_nonce,
    executed: vector.executed,
    at: vector.at,
    privateKeyPem: key.privateKeyPem,
  });
  const body = anchor ? { ...base.body, anchor } : base.body;
  const attestation = signAttestation({
    subject: { kind: "var1-receipt", digest: digestOf(body) },
    issuedAt: vector.at,
    privateKeyPem: key.privateKeyPem,
  });
  const bytes = canonicalBytes({ body, attestation });
  return {
    body,
    attestation,
    bytes,
    receiptId: "urn:sha256:" + sha256Hex(Buffer.from(bytes, "utf8")),
    keyring: pinKey(createKeyring(), { publicKeyPem: key.publicKeyPem }),
  };
}

/** AER-1's record rule, as the note states it: the name re-derives over the bytes. */
function recordResolution({ bytes, receiptId }) {
  const named = String(receiptId).replace(/^urn:/, "");
  return "sha256:" + sha256Hex(Buffer.from(bytes, "utf8")) === named
    ? "resolved"
    : "record-unresolvable";
}

/**
 * AER-1's anchor rule, as the note states it: absent, not checked, or an
 * evaluated outcome — never a collapse of the three. Resolution is by host
 * class; no request is made to any log.
 */
function anchorReport(body, { evaluate = true } = {}) {
  const anchor = body?.anchor;
  if (!anchor) return { anchor_present: false, anchor_evaluated: false, anchor_outcome: ABSENT };
  if (!evaluate) return { anchor_present: true, anchor_evaluated: false, anchor_outcome: NOT_CHECKED };
  const present = ["schema_version", "log", "leaf_hash", "anchored_at", "proof"].every(
    (member) => anchor[member] !== undefined,
  );
  const base = { anchor_present: true, anchor_evaluated: true };
  if (!present) return { ...base, anchor_outcome: "verification failed" };
  let host = null;
  try {
    host = new URL(anchor.log).hostname;
  } catch {
    host = null;
  }
  if (!host || NEVER_RESOLVES.test(host)) return { ...base, anchor_outcome: UNRESOLVABLE };
  const matches = anchor.leaf_hash === digestOf(body?.execution);
  return { ...base, anchor_outcome: matches ? "verified" : "verification failed" };
}

/** Both layer columns for one served file, with every fact the fixture pins. */
function judge(vector, options = {}) {
  const { anchor = vector.anchor, servedBytes = null, receiptName = null } = options;
  const built = materialise(vector, { anchor });
  const served = servedBytes ?? built.bytes;
  const inspection = inspectReceipt({
    bytes: served,
    expectedIntent: vector.approved,
    keyring: built.keyring,
  });
  const decision = decidePayment({ outcome: inspection.outcome, policy: vector.policy });
  const record = recordResolution({ bytes: served, receiptId: receiptName ?? built.receiptId });
  let body = null;
  try {
    body = JSON.parse(served)?.body ?? null;
  } catch {
    body = null;
  }
  const anchorColumns = anchorReport(body, { evaluate: options.evaluateAnchor ?? true });
  const columns = {
    var1_outcome: inspection.outcome,
    var1_decision: decision.decision,
    var1_drift_fields: inspection.drift.map((d) => d.field),
    signature_ok: inspection.signatureOk,
    key_status: inspection.keyStatus,
    aer1_record_verdict: record === "resolved" ? "verified" : "verification failed",
    record_resolution: record,
    ...anchorColumns,
    columns_disagree:
      record !== "resolved" ||
      inspection.outcome !== "VERIFIED" ||
      anchorColumns.anchor_outcome === UNRESOLVABLE ||
      anchorColumns.anchor_outcome === "verification failed",
  };
  return { columns, built, inspection, decision };
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

test("one served file, two columns: the record layer allows what the anchor layer refuses", () => {
  const { columns } = judge(VECTOR);
  assert.equal(columns.var1_outcome, "VERIFIED");
  assert.equal(columns.var1_decision, "ALLOW");
  assert.equal(columns.signature_ok, true);
  assert.equal(columns.key_status, "trusted");
  assert.equal(columns.aer1_record_verdict, "verified", "the bytes are the bytes that were named");
  assert.equal(columns.anchor_outcome, UNRESOLVABLE);
  assert.equal(columns.columns_disagree, true);
  // The refusal is at the anchor layer and nowhere else: nothing about the
  // execution moved, so nothing at the record layer is entitled to refuse it.
  assert.deepEqual(columns.var1_drift_fields, []);
});

test("an unresolvable anchor is not an absent one", () => {
  const unresolvable = judge(VECTOR).columns;
  const absent = judge(VECTOR, { anchor: null }).columns;
  assert.equal(absent.anchor_present, false);
  assert.equal(absent.anchor_evaluated, false);
  assert.equal(absent.anchor_outcome, ABSENT);
  assert.equal(absent.record_resolution, "resolved");
  assert.equal(absent.var1_outcome, "VERIFIED");
  assert.notEqual(unresolvable.anchor_outcome, absent.anchor_outcome);
  // Absence is not a failure anywhere: it is a state the receipt is entitled
  // to be in, and it must not read as a refusal.
  assert.equal(absent.columns_disagree, false);
});

test("not attempted is a state of its own, not a quiet verdict", () => {
  const unchecked = judge(VECTOR, { evaluateAnchor: false }).columns;
  assert.equal(unchecked.anchor_present, true);
  assert.equal(unchecked.anchor_evaluated, false);
  assert.equal(unchecked.anchor_outcome, NOT_CHECKED);
  assert.notEqual(unchecked.anchor_outcome, ABSENT);
  assert.notEqual(unchecked.anchor_outcome, UNRESOLVABLE);
  assert.notEqual(unchecked.anchor_outcome, "verification failed");
});

test("resource failure and content failure are different outcomes", () => {
  const resolvable = {
    ...VECTOR.anchor,
    log: "https://ots.opentimestamps.org/calendar",
  };
  const verified = judge(VECTOR, { anchor: resolvable }).columns;
  assert.equal(verified.anchor_outcome, "verified");
  assert.equal(verified.record_resolution, "resolved");
  assert.equal(verified.var1_outcome, "VERIFIED");

  const badLeaf = { ...resolvable, leaf_hash: "sha256:" + "00".repeat(32) };
  const failed = judge(VECTOR, { anchor: badLeaf }).columns;
  assert.equal(failed.anchor_outcome, "verification failed");
  assert.notEqual(failed.anchor_outcome, UNRESOLVABLE);
});

test("a name nobody can produce is a record failure, not an absence", () => {
  // The bytes served are valid and self-consistent; the name they were served
  // under is not the name of those bytes. That is the record case, and it must
  // not borrow the anchor column's refusal or the absent state.
  const unproduceable = "urn:sha256:" + "00".repeat(32);
  const columns = judge(VECTOR, { receiptName: unproduceable }).columns;
  assert.equal(columns.record_resolution, "record-unresolvable");
  assert.equal(columns.aer1_record_verdict, "verification failed");
  assert.notEqual(columns.record_resolution, ABSENT);
  assert.equal(columns.var1_outcome, "VERIFIED", "the execution column is not the record column");
  assert.equal(columns.anchor_outcome, UNRESOLVABLE);
  assert.equal(VECTOR.layer_names.record, "record-unresolvable");
  assert.equal(VECTOR.layer_names.anchor, "anchor-unresolvable");
});

test("integrity: the anchor sits inside the signed body and cannot be stripped afterwards", () => {
  const built = materialise(VECTOR);
  const parsed = JSON.parse(built.bytes);
  const stripped = { body: { ...parsed.body }, attestation: parsed.attestation };
  delete stripped.body.anchor;
  const served = canonicalBytes(stripped);
  const row = judge(VECTOR, { servedBytes: served });
  assert.equal(row.columns.var1_outcome, "VERIFICATION_FAILED", "a stripped anchor fails the record layer, not just the anchor column");
  assert.equal(row.columns.anchor_present, false, "the anchor is gone from what was served");
  // The signature itself still verifies: it is over the attestation, and the
  // attestation was not touched. What catches the strip is the subject binding
  // between that attestation and the body it claims to be about. Naming the
  // check matters — a verifier that only checked the signature would pass this.
  assert.equal(row.columns.signature_ok, true);
  const subject = row.inspection.checks.find(
    (check) => check.name === "the attestation's subject is the receipt body",
  );
  assert.equal(subject?.ok, false);
});

test("must-fail: a pin that files the refusal under `absent` fails by name", () => {
  const softened = {
    ...VECTOR,
    pins: { ...VECTOR.pins, anchor_outcome: ABSENT, anchor_present: false },
  };
  const problems = problemsFor(softened);
  assert.equal(problems.length, 2, `expected two named problems, got ${JSON.stringify(problems)}`);
  assert.ok(problems.some((p) => p.startsWith("anchor_outcome:")));
  assert.ok(problems.some((p) => p.startsWith("anchor_present:")));

  const collapsed = {
    ...VECTOR,
    pins: { ...VECTOR.pins, anchor_outcome: "verified" },
  };
  assert.ok(problemsFor(collapsed).some((p) => p.startsWith("anchor_outcome:")));
});

test("the leaf hash pins the executed order, not the receipt around it", () => {
  assert.equal(digestOf(VECTOR.executed), VECTOR.anchor.leaf_hash);
  assert.equal(VECTOR.anchor_leaf_subject, "the executed order");
  for (const order of [VECTOR.approved, VECTOR.executed]) {
    const sum = order.items.reduce((n, item) => n + item.qty * item.unit_minor, 0);
    assert.equal(order.total_minor, sum);
  }
  // Every field the merchant approved matches the field that was executed, so
  // the empty drift column is a fact about the order and not about the vector:
  // this receipt was not tampered with, which is why the anchor layer is the
  // only layer entitled to refuse it.
  const executedAsApproved = Object.fromEntries(
    Object.keys(VECTOR.approved).map((key) => [key, VECTOR.executed[key]]),
  );
  assert.deepEqual(executedAsApproved, VECTOR.approved);
});
