/**
 * The one real divergence, as a switch instead of an argument.
 *
 * Zambo's answer to our anchor composition was precise: under our rule a second
 * anchor that resolves later flips the composed verdict; under AER-1's layered
 * rule the record verdict never moves. Both are defensible, and a review round
 * spent arguing which is "right" buys nothing. So CG-COMPOSE/1 makes it a mode,
 * and this file asserts the property that actually distinguishes them — using
 * the real anchor service, not a hand-written fact set.
 *
 * The scenario:
 *   1. a record verifies at the record layer;
 *   2. the only anchor we hold for it is unresolvable (its attestation does not
 *      stand up);
 *   3. a second anchor, valid and for the same digest, arrives later.
 *
 *   composed  step 2 blocks (UNRESOLVABLE_RECORD), step 3 clears it (VERIFIED)
 *   layered   the record reads VERIFIED at both steps; only the anchor block
 *             moves, and it carries `rejected: "unresolvable record"`
 *
 * Neither mode may turn silence into a refusal, and a failed record may never be
 * rescued by a good anchor. Both invariants are asserted here too.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  appendAnchor,
  createLog,
  generateIssuerKey,
  resolveAnchor,
} from "../../packages/agent-commerce/anchor.mjs";
import { composeOutcome, compareModes, COMPOSITION_MODES, selfCheck } from "../../packages/agent-commerce/composition.mjs";
import { aer1Outcome, parseAer1Record } from "../../packages/agent-commerce/aer1.mjs";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const keys = generateIssuerKey();
const T0 = "2026-11-18T00:00:00.000Z";
const digest = sha256(Buffer.from("composition-divergence"));

const verifiedRecord = { evaluated: true, ok: true };

function anchorLog() {
  return appendAnchor(createLog(), {
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
}

/** A log that holds an entry for the digest, whose attestation does not stand. */
function brokenLog() {
  const log = anchorLog();
  return Object.freeze({
    ...log,
    entries: Object.freeze([{ ...log.entries[0], subject: { ...log.entries[0].subject, kind: "forged" } }]),
  });
}

test("a second anchor resolving later flips the composed headline and not the record", () => {
  const before = resolveAnchor(brokenLog(), `sha256:${digest}`);
  const after = resolveAnchor(anchorLog(), `sha256:${digest}`);
  assert.equal(before.outcome, "unresolvable");
  assert.equal(after.outcome, "verified");

  const composedBefore = composeOutcome({ presented: true, record: verifiedRecord, anchor: before, mode: "composed" });
  const composedAfter = composeOutcome({ presented: true, record: verifiedRecord, anchor: after, mode: "composed" });
  const layeredBefore = composeOutcome({ presented: true, record: verifiedRecord, anchor: before, mode: "layered" });
  const layeredAfter = composeOutcome({ presented: true, record: verifiedRecord, anchor: after, mode: "layered" });

  // The divergence, both directions.
  assert.equal(composedBefore.headline, "UNRESOLVABLE_RECORD");
  assert.equal(composedBefore.blocks, true);
  assert.equal(composedAfter.headline, "VERIFIED");
  assert.equal(composedAfter.blocks, false);

  assert.equal(layeredBefore.headline, "VERIFIED");
  assert.equal(layeredBefore.blocks, false);
  assert.equal(layeredBefore.anchor.rejected, "unresolvable record");
  assert.equal(layeredAfter.headline, "VERIFIED");
  assert.equal(layeredAfter.anchor.rejected, null);

  // The property that makes the layered answer archival: the record never moved.
  assert.equal(layeredBefore.record.outcome, layeredAfter.record.outcome);
  assert.equal(layeredBefore.record.outcome, "VERIFIED");
  assert.equal(layeredBefore.resolutionSensitive, false);
  assert.equal(composedBefore.resolutionSensitive, true);
});

test("compareModes names the divergence instead of hiding it", () => {
  const picture = compareModes({
    presented: true,
    record: verifiedRecord,
    anchor: resolveAnchor(brokenLog(), `sha256:${digest}`),
  });
  assert.equal(picture.diverges, true);
  assert.equal(picture.recordStable, true);
  assert.equal(picture.composed.headline, "UNRESOLVABLE_RECORD");
  assert.equal(picture.layered.headline, "VERIFIED");

  const agree = compareModes({
    presented: true,
    record: verifiedRecord,
    anchor: resolveAnchor(anchorLog(), `sha256:${digest}`),
  });
  assert.equal(agree.diverges, false);
  assert.equal(agree.composed.headline, "VERIFIED");
  assert.equal(agree.layered.headline, "VERIFIED");
});

test("neither mode turns silence into a refusal", () => {
  for (const mode of COMPOSITION_MODES) {
    const result = composeOutcome({
      presented: false,
      anchor: { present: true, evaluated: true, outcome: "unresolvable" },
      mode,
    });
    assert.equal(result.headline, "ABSENT");
    assert.equal(result.blocks, false);
  }
});

test("a good anchor never rescues a failed record", () => {
  const anchor = resolveAnchor(anchorLog(), `sha256:${digest}`);
  for (const mode of COMPOSITION_MODES) {
    const result = composeOutcome({
      presented: true,
      record: { evaluated: true, ok: false, code: "RECEIPT_ID_MISMATCH" },
      anchor,
      mode,
    });
    assert.equal(result.headline, "VERIFICATION_FAILED");
    assert.equal(result.blocks, true);
  }
});

test("aer1Outcome composes the same way through the parser's own facts", () => {
  const bytes = Buffer.from(JSON.stringify({ receipt_schema_version: "0.3", output: { text: "ok" } }), "utf8");
  const parsed = parseAer1Record({
    id: "11111111-1111-4111-8111-111111111111",
    receipt_schema_version: "0.3",
    canonical_byte_length: bytes.length,
    canonical_bytes: bytes.toString("base64"),
    output_hash: `sha256:${sha256(bytes)}`,
  });
  assert.equal(parsed.verdict, "pass");
  const composed = aer1Outcome(parsed, { anchor: resolveAnchor(brokenLog(), `sha256:${digest}`) });
  assert.equal(composed.outcome, "UNRESOLVABLE_RECORD");
  const layered = composeOutcome({
    presented: true,
    record: { evaluated: true, ok: parsed.verdict === "pass", code: parsed.code },
    anchor: resolveAnchor(brokenLog(), `sha256:${digest}`),
    mode: "layered",
  });
  assert.equal(layered.headline, "VERIFIED");
});

test("the policy's own self-check passes in a runtime with no test runner", () => {
  const report = selfCheck();
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((c) => !c.pass)));
});
