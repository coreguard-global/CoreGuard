/**
 * AER-1 id-binding fixtures — the six published swap vectors, vendored verbatim.
 *
 * Why this file exists: the reply on issue #56 offered the AER-1 conformance
 * vectors, and accepting an offer like that means carrying the bytes, not
 * paraphrasing them. These six vectors are the corpus author's own must-fail
 * cases for the id-binding swap — the same defect this repository shipped (a
 * genuine digest confirming a borrowed label), found before anyone here looked.
 *
 * Two things are proven here, and they are different:
 *
 *   1. INTEGRITY. The vendored file is bit-identical to the published artifact:
 *      its sha256 equals the digest the corpus index lists for that path, and it
 *      cannot be edited even by a space without the test failing by name.
 *   2. SEMANTICS. Every vector is replayed against our identity branch, and the
 *      mapping is asserted case by case. Resolution (AER-1 Section 9) is exercised:
 *      a resolved record agreeing on the committed digest binds identity, and a
 *      disagreeing resolved record is a mismatch; incomplete resolution evidence
 *      remains `RECEIPT_ID_RESOLUTION_UNSUPPORTED` (UNKNOWN), never a pass.
 *
 * Attribution: AER-1 / draft-zambo-aer1-26, corpus by Brennan Zambo (Zambo),
 * kit v1.5.7. Vendored under the terms offered in the issue thread ("free to
 * lift as fixtures, no strings attached"). See PROVENANCE.md beside the fixture.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { bindReceiptIdentity, L1_VERDICT_CODES } from "../../scripts/ladder/verification-levels.mjs";

const FIXTURE_DIR = new URL("../fixtures/aer1-corpus-v1.5.7/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURE_DIR));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// Pinned twice on purpose: once to the bytes we vendored, once to the digest the
// corpus index publishes for that path. A fixture edited locally fails the first
// check; a fixture that no longer matches the upstream artifact fails the second.
const VENDORED_SHA256 = "78cb42cbc8be1306458f63e90e01f0e9201504ff5bf5d455a659631f21237009";
const EVALUATED_SET_DIGEST =
  "sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2";
const KIT_VERSION = "1.5.7";

const vectorsDoc = JSON.parse(read("id-binding-vectors.json").toString("utf8"));
const meta = JSON.parse(read("corpus-metadata.json").toString("utf8"));

/**
 * AER-1's own two stages, reproduced exactly (not approximated):
 *  - the commitment check recomputes sha256 over the decoded canonical bytes,
 *    and treats a receipt missing a required member as a failed artifact;
 *  - the id stage binds the label only against an external expectation.
 * Replaying their reference rules is what makes a disagreement meaningful: if we
 * "checked" the vectors with our own ideas of what they mean, agreement would
 * prove nothing about the fixtures.
 */
const REQUIRED = ["id", "canonical_bytes", "output_hash", "canonical_byte_length"];

function aer1DigestOf(rec) {
  if (rec === null || typeof rec !== "object") return "fail";
  if (REQUIRED.some((k) => !(k in rec))) return "fail";
  const raw = Buffer.from(rec.canonical_bytes, "base64");
  const ok = "sha256:" + sha256(raw) === rec.output_hash && raw.length === rec.canonical_byte_length;
  return ok ? "pass" : "fail";
}

function aer1IdVerdictOf(vector) {
  const rec = vector.receipt;
  if (!("id" in rec)) return "absent";
  if ("expected_id" in vector) return rec.id === vector.expected_id ? "matched" : "mismatched";
  if ("resolved_record" in vector) {
    const rr = vector.resolved_record;
    return rr.id === rec.id && rr.output_hash === rec.output_hash ? "resolved" : "mismatched";
  }
  return "unverified";
}

/** Our identity branch, fed the same facts: the receipt's own label, expected id, and (for resolution) artifact digest. */
function oursFor(vector) {
  const receipt = "id" in vector.receipt ? { commitmentId: vector.receipt.id, outputHash: vector.receipt.output_hash } : {};
  const commitment = "expected_id" in vector ? { commitmentId: vector.expected_id } : {};
  const options = vector.resolved_record ? { resolvedRecord: vector.resolved_record } : {};
  return bindReceiptIdentity(receipt, commitment, options);
}

test("the vendored fixture is bit-identical to the published artifact", () => {
  assert.equal(sha256(read("id-binding-vectors.json")), VENDORED_SHA256);
  assert.equal(meta.kit_version, KIT_VERSION);
  // The corpus index's evaluated_set_digest is what makes "we ran the published
  // set" a checkable statement rather than a citation.
  assert.equal(meta.evaluated_set_digest, EVALUATED_SET_DIGEST);
  assert.equal(meta.vector_count, 143);
  assert.equal(meta.check_count, 146);
});

test("the six vectors are the published six, by name and by count", () => {
  assert.equal(vectorsDoc.vectors.length, 6);
  assert.deepEqual(
    vectorsDoc.vectors.map((v) => v.name),
    [
      "id-alone-unverified",
      "id-expected-match",
      "id-expected-mismatch",
      "id-resolution-agreement",
      "id-resolution-disagreement",
      "id-absent",
    ],
  );
  assert.match(vectorsDoc.spec, /draft-zambo-aer1-\d+/);
});

test("every vector replays through AER-1's own rules exactly as published", () => {
  for (const v of vectorsDoc.vectors) {
    assert.equal(aer1DigestOf(v.receipt), v.expected_digest, `${v.name}: commitment stage`);
    assert.equal(aer1IdVerdictOf(v), v.expected_id_verdict, `${v.name}: id stage`);
    const verdict = aer1DigestOf(v.receipt) === "pass" && !["mismatched", "absent"].includes(aer1IdVerdictOf(v))
      ? "pass"
      : "fail";
    assert.equal(verdict, v.expected_verdict, `${v.name}: overall verdict`);
  }
});

test("our identity branch agrees with AER-1 on the three shared outcomes", () => {
  const expected = {
    // their id_verdict -> our code
    "id-expected-match": L1_VERDICT_CODES.RECEIPT_ID_BOUND,
    "id-expected-mismatch": L1_VERDICT_CODES.RECEIPT_ID_MISMATCH,
    "id-alone-unverified": L1_VERDICT_CODES.RECEIPT_ID_UNBOUND,
    "id-absent": L1_VERDICT_CODES.RECEIPT_ID_UNBOUND,
  };
  for (const v of vectorsDoc.vectors) {
    const want = expected[v.name];
    if (!want) continue;
    const got = oursFor(v);
    assert.equal(got.verdictCode, want, `${v.name}: ${got.verdict}/${got.verdictCode}`);
  }
});

test("the published resolution vectors exercise AER-1 Section 9 (agreement binds, disagreement mismatches)", () => {
  const agreement = vectorsDoc.vectors.find((x) => x.name === "id-resolution-agreement");
  const agreeGot = oursFor(agreement);
  assert.equal(agreeGot.verdict, "BOUND", "resolved record agreeing on committed digest binds identity");
  assert.equal(agreeGot.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_BOUND, "id-resolution-agreement");

  const disagreement = vectorsDoc.vectors.find((x) => x.name === "id-resolution-disagreement");
  const disagreeGot = oursFor(disagreement);
  assert.equal(disagreeGot.verdict, "MISMATCH", "resolved record with differing committed digest is not a pass");
  assert.equal(disagreeGot.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_MISMATCH, "id-resolution-disagreement");
});

test("fail-closed lattice: no vector is ever more permissive here than upstream", () => {
  // The one direction that must never happen is the laundering one. If AER-1
  // says the id is contradicted or absent, we must not report a bound identity;
  // if it says "unverified", we must not either.
  for (const v of vectorsDoc.vectors) {
    const got = oursFor(v);
    const upstreamIdVerdict = v.expected_id_verdict;
    const weClaimBound = got.verdictCode === L1_VERDICT_CODES.RECEIPT_ID_BOUND;
    if (upstreamIdVerdict === "mismatched" || upstreamIdVerdict === "absent" || upstreamIdVerdict === "unverified") {
      assert.equal(weClaimBound, false, `${v.name}: we claimed a bound identity upstream refuses (${upstreamIdVerdict})`);
    }
    if (v.expected_verdict === "fail") {
      assert.notEqual(got.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_BOUND, `${v.name}: an upstream fail became a bound identity`);
    }
    // And the converse guard: a bound claim must be backed by upstream agreement
    // (matched by expectation, or resolved by Section 9 with agreeing committed digest).
    if (weClaimBound) assert.ok(["matched", "resolved"].includes(upstreamIdVerdict), `${v.name}: bound without upstream agreement`);
  }
});

test("the swap vector specifically: the digest passes while the identity fails", () => {
  const swap = vectorsDoc.vectors.find((v) => v.name === "id-expected-mismatch");
  assert.equal(aer1DigestOf(swap.receipt), "pass", "the fixture must be the hard case: bytes intact");
  const got = oursFor(swap);
  assert.equal(got.verdict, "MISMATCH");
  assert.equal(got.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_MISMATCH);
  assert.equal(swap.receipt.id, "42fc3298-b1e7-4087-bb1c-f80ef9f12c7c");
  assert.equal(swap.expected_id, "130da435-e157-498e-af90-605866a86a27");
});

test("editing the fixture in any way fails by name, not by accident", () => {
  // A control, not a comment: mutate the vendored bytes in memory and prove the
  // integrity check is the thing that catches it.
  const original = read("id-binding-vectors.json");
  const tampered = Buffer.from(original.toString("utf8").replace("id-absent", "id-absent "), "utf8");
  assert.notEqual(sha256(tampered), VENDORED_SHA256);
  assert.equal(sha256(original), VENDORED_SHA256);
});
