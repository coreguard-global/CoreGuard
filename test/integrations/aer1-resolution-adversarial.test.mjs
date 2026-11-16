/**
 * AER-1 Section 9 resolution — adversarial & boundary tests.
 *
 * Proves that bindReceiptIdentity's resolution path is fail-closed:
 * agreement requires matching id AND matching committed digest from complete,
 * comparable evidence; anything ambiguous, contradictory, incomplete, or
 * malformed MUST NOT yield BOUND. These tests complement the vendored corpus
 * (happy/expected paths) with adversarial and edge cases.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { bindReceiptIdentity, L1_VERDICT_CODES } from "../../scripts/ladder/verification-levels.mjs";

/**
 * Independent reference evaluator for Section 9 resolution (separate from the
 * implementation under test). Given a claimed receipt id, the artifact's
 * committed digest, and a resolved record, it derives the expected outcome from
 * the documented rule alone: agreement binds, disagreement mismatches, and
 * incomplete evidence is unestablished (never a pass).
 */
function referenceResolutionVerdict(claimedId, artifactDigest, resolvedRecord) {
  const has = (v) => typeof v === "string" && v.length > 0;
  if (!has(claimedId) || !resolvedRecord || !has(resolvedRecord.id) || !has(resolvedRecord.digest) || !has(artifactDigest)) {
    return { verdict: "UNKNOWN", verdictCode: L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED };
  }
  if (resolvedRecord.id === claimedId && resolvedRecord.digest === artifactDigest) {
    return { verdict: "BOUND", verdictCode: L1_VERDICT_CODES.RECEIPT_ID_BOUND };
  }
  return { verdict: "MISMATCH", verdictCode: L1_VERDICT_CODES.RECEIPT_ID_MISMATCH };
}

function callResolution({ claimedId, artifactDigest, resolvedRecord }) {
  const receipt = { commitmentId: claimedId };
  if (artifactDigest !== undefined) receipt.outputHash = artifactDigest;
  return bindReceiptIdentity(receipt, {}, { resolvedRecord });
}

test("control: agreement on id and committed digest is BOUND", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-1", output_hash: "sha256:aaa" },
  });
  assert.equal(v.verdict, "BOUND");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_BOUND);
});

test("must-fail: correct id with different digest is MISMATCH (never BOUND)", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-1", output_hash: "sha256:bbb" },
  });
  assert.equal(v.verdict, "MISMATCH");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_MISMATCH);
});

test("must-fail: different id with matching digest is MISMATCH (never BOUND)", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-2", output_hash: "sha256:aaa" },
  });
  assert.equal(v.verdict, "MISMATCH");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_MISMATCH);
});

test("must-fail: both id and digest differ is MISMATCH", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-2", output_hash: "sha256:bbb" },
  });
  assert.equal(v.verdict, "MISMATCH");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_MISMATCH);
});

test("incomplete evidence is UNSUPPORTED/UNKNOWN, never BOUND: missing resolved digest", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-1" },
  });
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED);
});

test("incomplete evidence is UNSUPPORTED/UNKNOWN, never BOUND: empty resolved digest", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { id: "id-1", output_hash: "" },
  });
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED);
});

test("incomplete evidence is UNSUPPORTED/UNKNOWN, never BOUND: missing resolved id", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: "sha256:aaa",
    resolvedRecord: { output_hash: "sha256:aaa" },
  });
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED);
});

test("incomplete evidence is UNSUPPORTED/UNKNOWN, never BOUND: missing artifact digest", () => {
  const v = callResolution({
    claimedId: "id-1",
    artifactDigest: undefined,
    resolvedRecord: { id: "id-1", output_hash: "sha256:aaa" },
  });
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED);
});

test("incomplete evidence is UNSUPPORTED/UNKNOWN, never BOUND: missing claimed receipt id", () => {
  const v = bindReceiptIdentity({ outputHash: "sha256:aaa" }, {}, { resolvedRecord: { id: "id-1", output_hash: "sha256:aaa" } });
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_RESOLUTION_UNSUPPORTED);
});

test("type confusion does not grant BOUND: non-string digests treated as missing", () => {
  const cases = [
    { id: "id-1", output_hash: 123 },
    { id: "id-1", output_hash: null },
    { id: "id-1", output_hash: { h: "sha256:aaa" } },
    { id: 1, output_hash: "sha256:aaa" },
  ];
  for (const resolvedRecord of cases) {
    const v = callResolution({ claimedId: "id-1", artifactDigest: "sha256:aaa", resolvedRecord });
    assert.notEqual(v.verdict, "BOUND", `must not bind for ${JSON.stringify(resolvedRecord)}`);
    assert.notEqual(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_BOUND);
  }
});

test("determinism: identical inputs produce identical verdicts across repeated calls", () => {
  const inputs = [
    { claimedId: "id-1", artifactDigest: "sha256:aaa", resolvedRecord: { id: "id-1", output_hash: "sha256:aaa" } },
    { claimedId: "id-1", artifactDigest: "sha256:aaa", resolvedRecord: { id: "id-1", output_hash: "sha256:bbb" } },
    { claimedId: "id-1", artifactDigest: "sha256:aaa", resolvedRecord: { id: "id-1" } },
  ];
  for (const input of inputs) {
    const a = callResolution(input);
    const b = callResolution(input);
    assert.deepEqual(a, b);
  }
});

test("property-style sweep: changing the committed digest must never yield BOUND for the original claim", () => {
  const claimedId = "id-1";
  const artifactDigest = "sha256:original";
  const digests = [
    "sha256:other",
    "sha256:ORIGINAL",
    "sha256:original ",
    " sha256:original",
    "sha256:origina1",
    "md5:original",
    "",
  ];
  for (const d of digests) {
    const v = callResolution({ claimedId, artifactDigest, resolvedRecord: { id: claimedId, output_hash: d } });
    assert.notEqual(v.verdict, "BOUND", `must not bind when digest differs/missing: ${JSON.stringify(d)}`);
  }
});

test("independent reference evaluator agrees with implementation on representative cases", () => {
  const cases = [
    { claimedId: "id-1", artifactDigest: "sha256:aaa", rr: { id: "id-1", digest: "sha256:aaa" } },
    { claimedId: "id-1", artifactDigest: "sha256:aaa", rr: { id: "id-1", digest: "sha256:bbb" } },
    { claimedId: "id-1", artifactDigest: "sha256:aaa", rr: { id: "id-2", digest: "sha256:aaa" } },
    { claimedId: "id-1", artifactDigest: "sha256:aaa", rr: { id: "id-1", digest: "" } },
    { claimedId: "id-1", artifactDigest: "", rr: { id: "id-1", digest: "sha256:aaa" } },
    { claimedId: "", artifactDigest: "sha256:aaa", rr: { id: "id-1", digest: "sha256:aaa" } },
  ];
  for (const c of cases) {
    const impl = callResolution({ claimedId: c.claimedId, artifactDigest: c.artifactDigest, resolvedRecord: c.rr.digest === "" && c.rr.id ? { id: c.rr.id, output_hash: c.rr.digest } : (c.rr.id || c.rr.digest ? { id: c.rr.id, output_hash: c.rr.digest } : undefined) });
    const ref = referenceResolutionVerdict(c.claimedId, c.artifactDigest, c.rr);
    assert.equal(impl.verdict, ref.verdict, JSON.stringify(c));
    assert.equal(impl.verdictCode, ref.verdictCode, JSON.stringify(c));
  }
});

test("trust boundary reminder: caller-supplied resolved records are checked for consistency only (no provenance verification)", () => {
  // A self-consistent but caller-supplied record binds by value comparison alone.
  // This test documents the current boundary: authenticity/provenance of the
  // resolved record is outside bindReceiptIdentity's proof.
  const v = callResolution({
    claimedId: "forged-id",
    artifactDigest: "sha256:forged",
    resolvedRecord: { id: "forged-id", output_hash: "sha256:forged" },
  });
  assert.equal(v.verdict, "BOUND");
  assert.equal(v.verdictCode, L1_VERDICT_CODES.RECEIPT_ID_BOUND);
});