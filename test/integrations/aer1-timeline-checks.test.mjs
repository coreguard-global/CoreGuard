/**
 * AER-1 timelines — chain v1, chain -07, the external commitment, and the
 * workflow Merkle root. Each family test runs the whole pinned family and
 * asserts the corpus outcome, so a rule that is too weak shows up as a
 * false accept and a rule that is too strong shows up as a false reject.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  verifyAer1Chain,
  verifyAer1Commitment,
  verifyAer1WorkflowMerkle,
  verifyAer1MerkleVector,
  verifyAer1UnicodeVector,
  reportAer1Anchor,
} from "../../packages/agent-commerce/aer1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, "../fixtures/aer1-corpus-v1.5.7");

function family(relative) {
  const text = readFileSync(join(CORPUS, relative), "utf8");
  return { text, vectors: JSON.parse(text).vectors };
}

function judged(vectors, verify) {
  return vectors.map((v) => ({
    name: v.name,
    expected: v.expected_verdict === "valid" ? "verified" : "invalid",
    observed: verify(v).ok ? "verified" : "invalid",
  }));
}

function assertFamily(rows) {
  const wrong = rows.filter((r) => r.observed !== r.expected);
  assert.deepEqual(wrong, [], `expected-outcome mismatches: ${JSON.stringify(wrong, null, 2)}`);
}

test("chain v1: links over the decoded bytes, and only the last entry closes", () => {
  const { vectors } = family("base/chain-vectors.json");
  assertFamily(judged(vectors, (v) => verifyAer1Chain(v.timeline, { version: "v1" })));

  const tampered = vectors.find((v) => v.name === "chain-tampered-middle");
  const refused = verifyAer1Chain(tampered.timeline, { version: "v1" });
  assert.equal(refused.ok, false);
  assert.ok(refused.checks.some((c) => !c.ok && c.name.includes("link")));
});

test("chain -07: metadata is bound into the entry digest", () => {
  const { vectors } = family("base/chain-vectors-v07.json");
  assertFamily(judged(vectors, (v) => verifyAer1Chain(v.timeline, { version: "v07" })));

  // Relabelling a field that the digest binds must break the link, and the
  // encoding vectors only pass when the canonical serialization matches.
  for (const name of ["v07-relabel-provenance", "v07-relabel-tool-id", "ax-esc-hex-upper", "x-encoding-draft-literal"]) {
    const v = vectors.find((x) => x.name === name);
    assert.equal(verifyAer1Chain(v.timeline, { version: "v07" }).ok, false, name);
  }
  const reference = vectors.find((x) => x.name === "x-encoding-reference");
  assert.equal(verifyAer1Chain(reference.timeline, { version: "v07" }).ok, true, "canonical escaping is the reference form");
});

test("commitment: job, length, final digest and a non-fractional count", () => {
  const { text, vectors } = family("base/commitment-vectors.json");
  const lexeme = (name) => {
    const start = text.indexOf(`"name": "${name}"`);
    const slice = text.slice(start, text.indexOf('"name":', start + 8) === -1 ? text.length : text.indexOf('"name":', start + 8));
    return /"entry_count"\s*:\s*(-?\d+(?:\.\d+)?)/.exec(slice)?.[1] ?? null;
  };

  assertFamily(
    judged(vectors, (v) => verifyAer1Commitment(v.timeline, v.commitment, { entryCountLexeme: lexeme(v.name) })),
  );

  const floatVector = vectors.find((v) => v.name === "x-entry-count-float");
  assert.equal(lexeme("x-entry-count-float"), "5.0");
  assert.equal(verifyAer1Commitment(floatVector.timeline, floatVector.commitment).ok, true, "5.0 and 5 are the same number once parsed");
  assert.equal(
    verifyAer1Commitment(floatVector.timeline, floatVector.commitment, { entryCountLexeme: "5.0" }).ok,
    false,
    "a fractional spelling is a different claim and must be refused",
  );
});

test("workflow Merkle: both constructions, one tree rule", () => {
  const { vectors } = family("workflow-merkle-seq-output-v1.json");
  assertFamily(
    judged(vectors, (v) =>
      verifyAer1WorkflowMerkle({
        steps: v.steps,
        merkleRoot: v.merkle_root,
        merkleVersion: v.merkle_version,
        merkleVersionPresent: v.merkle_version !== undefined,
      }),
    ),
  );

  const single = vectors.find((v) => v.name === "seq-output-v1-single-step");
  const result = verifyAer1WorkflowMerkle({ steps: single.steps, merkleRoot: single.merkle_root, merkleVersion: "seq-output-v1" });
  assert.equal(result.ok, true);
  assert.equal(result.computed, single.merkle_root, "a single leaf is the root");

  // The two constructions give different roots for the same steps; a verifier
  // that substituted one for the other would confirm nothing.
  const legacy = verifyAer1WorkflowMerkle({ steps: single.steps, merkleRoot: single.merkle_root, merkleVersion: "receipt-id-v0" });
  assert.equal(legacy.ok, false);
  assert.equal(verifyAer1WorkflowMerkle({ steps: single.steps, merkleRoot: single.merkle_root, merkleVersion: "future-v9" }).ok, false);
});

test("merkle family: the Section 8.1 construction over receipt ids, 9/9", () => {
  const { vectors } = family("base/merkle-vectors.json");
  assert.equal(vectors.length, 9);
  for (const v of vectors) {
    const expected = v.expected_workflow_verdict === "invalid" || v.leaves !== undefined ? "invalid" : "verified";
    const result = verifyAer1MerkleVector(v);
    assert.equal(result.ok, expected === "verified", `${v.name}: ${JSON.stringify(result.checks.filter((c) => !c.ok))}`);
  }

  const five = vectors.find((v) => v.name === "canonical-5-step");
  const good = verifyAer1MerkleVector(five);
  assert.equal(good.computed, five.expected_root);
  assert.equal(good.ok, true);

  // A leaf is the receipt id, not a label: changing one id must move the root.
  const tampered = { ...five, receipt_ids: [...five.receipt_ids] };
  tampered.receipt_ids[2] = "00000000-0000-0000-0000-000000000000";
  const tamperedResult = verifyAer1MerkleVector(tampered);
  assert.equal(tamperedResult.ok, false);
  assert.notEqual(tamperedResult.computed, five.expected_root);

  // The duplicate vector recomputes the canonical root exactly; only the
  // Section 8.2 duplicate rule can refuse it. A root-only check would pass.
  const duplicate = vectors.find((v) => v.name === "duplicate-receipt-id-collision");
  const duplicateResult = verifyAer1MerkleVector(duplicate);
  assert.equal(duplicateResult.computed, duplicate.expected_root);
  assert.equal(duplicateResult.ok, false);
  assert.ok(duplicateResult.checks.some((c) => c.name === "no receipt_id appears twice" && !c.ok));

  // The legacy seq:receipt_hash tree has its own root; rejecting that
  // construction is a rule, not an accidental digest mismatch.
  const legacy = vectors.find((v) => v.name === "legacy-construction-rejected");
  assert.ok(verifyAer1MerkleVector(legacy).checks.some((c) => c.name.includes("legacy preimage form") && !c.ok));

  // must_not_equal is a real check: make it name the computed root and the
  // same vector must fail by name.
  assert.equal(verifyAer1MerkleVector({ ...five, must_not_equal: five.expected_root }).ok, false);

  // Odd duplication and the empty tree are constructions, not prose.
  assert.equal(verifyAer1MerkleVector(vectors.find((v) => v.name === "odd-duplication-3")).ok, true);
  assert.equal(verifyAer1MerkleVector(vectors.find((v) => v.name === "empty")).computed, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("unicode family: raw bytes only, no NFC/NFD rewriting, 5/5", () => {
  const { vectors } = family("base/unicode-vectors.json");
  assert.equal(vectors.length, 5);
  for (const v of vectors) {
    const result = verifyAer1UnicodeVector(v);
    assert.equal(result.ok, v.expected === "match", `${v.name}: ${JSON.stringify(result.checks.filter((c) => !c.ok))}`);
  }

  const nfc = vectors.find((v) => v.name === "unicode-nfc-form");
  const nfd = vectors.find((v) => v.name === "unicode-nfd-form");
  assert.notEqual(nfc.sha256, nfd.sha256, "the two spellings must hash differently");

  // The mismatch vectors are the applied-and-bites control: a verifier that
  // normalized either side would report a match.
  for (const name of ["unicode-nfd-against-nfc-commitment", "unicode-nonbreaking-hyphen-against-ascii"]) {
    const v = vectors.find((x) => x.name === name);
    const result = verifyAer1UnicodeVector(v);
    assert.equal(result.ok, false, name);
    assert.ok(result.checks.some((c) => c.name.includes("without normalization") && !c.ok), name);
  }

  // A decoy hex field cannot launder a bad payload: the bytes are the claim.
  assert.equal(verifyAer1UnicodeVector({ ...nfc, payload_utf8_hex: nfd.payload_utf8_hex }).ok, false);
  assert.equal(verifyAer1UnicodeVector({ ...nfc, payload_base64: nfc.payload_base64.replace(/=$/, "") }).ok, false);
});

test("anchor family: eight vectors and six anchored records, five outcomes distinct", () => {
  const vectors = family("base/anchor-vectors.json").vectors;
  assert.equal(vectors.length, 8);
  for (const v of vectors) {
    const receipt = v.file ? JSON.parse(readFileSync(join(CORPUS, "base", v.file), "utf8")) : v.receipt;
    const got = reportAer1Anchor(receipt, { evaluate: v.evaluate });
    assert.equal(got.outcome, v.expected_anchor_outcome, `${v.name}: ${JSON.stringify(got)}`);
    assert.equal(got.present, v.expected_present, v.name);
    assert.equal(got.evaluated, v.expected_evaluated, v.name);
  }
  const outcomes = new Set(vectors.map((v) => v.expected_anchor_outcome));
  assert.deepEqual([...outcomes].sort(), ["absent", "not checked", "rejected: unresolvable record", "verification failed", "verified"]);

  const anchored = {
    "anchored-valid.json": "verified",
    "anchored-unresolvable-anchor.json": "rejected: unresolvable record",
    "anchored-bad-leaf-hash.json": "verification failed",
    "anchored-bad-timestamp.json": "verification failed",
    "anchored-missing-proof.json": "verification failed",
    "anchored-bad-id-version.json": "verification failed",
  };
  for (const [name, expected] of Object.entries(anchored)) {
    const receipt = JSON.parse(readFileSync(join(CORPUS, "base/test-vectors/anchored", name), "utf8"));
    const got = reportAer1Anchor(receipt);
    assert.equal(got.outcome, expected, `${name}: ${JSON.stringify(got)}`);
    assert.equal(got.evaluated, true, name);
  }
});

test("anchor checks bite: tamper, injected resolver, and outcome precedence", () => {
  const valid = JSON.parse(readFileSync(join(CORPUS, "base/test-vectors/anchored/anchored-valid.json"), "utf8"));
  assert.equal(reportAer1Anchor(valid).outcome, "verified");

  // Each tamper is a negative control aimed at one check, not a general
  // "something failed" assertion. A verifier that skipped the named check
  // would still pass here only if the fixture were wrong.
  const badLeaf = { ...valid, anchor: { ...valid.anchor, leaf_hash: `sha256:${"9".repeat(64)}` } };
  assert.equal(reportAer1Anchor(badLeaf).outcome, "verification failed");
  assert.ok(reportAer1Anchor(badLeaf).checks.some((c) => c.name.includes("digest of canonical_bytes") && !c.ok));

  const badTime = { ...valid, anchor: { ...valid.anchor, anchored_at: "2026-02-30T12:00:00Z" } };
  assert.ok(reportAer1Anchor(badTime).checks.some((c) => c.name.includes("calendar-valid") && !c.ok));

  const noProof = { ...valid, anchor: { ...valid.anchor, proof: {} } };
  assert.ok(reportAer1Anchor(noProof).checks.some((c) => c.name.includes("proof is present") && !c.ok));

  // A real caller injects its own resolver. A resolver that returns a leaf
  // for a different id or a different digest must be convicted by name.
  const renamed = { ...valid, id: "11111111-1111-4111-8111-111111111111" };
  const wrongId = reportAer1Anchor(renamed, {
    resolveLog: () => ({ resolvable: true, source: "injected-test-resolver", leaf: { id: valid.id, digest: valid.output_hash } }),
  });
  assert.equal(wrongId.outcome, "verification failed");
  assert.ok(wrongId.checks.some((c) => c.name.includes("names the anchored receipt id") && !c.ok));

  const wrongDigest = reportAer1Anchor(valid, {
    resolveLog: () => ({ resolvable: true, source: "injected-test-resolver", leaf: { id: valid.id, digest: `sha256:${"a".repeat(64)}` } }),
  });
  assert.equal(wrongDigest.outcome, "verification failed");
  assert.ok(wrongDigest.checks.some((c) => c.name.includes("equals the committed leaf_hash") && !c.ok));

  // Precedence: a .invalid host is a resource outcome even when the leaf is
  // also wrong; evaluate=false is honoured before any content is read.
  const unresolvable = JSON.parse(readFileSync(join(CORPUS, "base/anchor-vectors.json"), "utf8")).vectors.find((v) => v.name === "anchor-unresolvable-bad-leaf").receipt;
  assert.equal(reportAer1Anchor(unresolvable).outcome, "rejected: unresolvable record");
  assert.equal(reportAer1Anchor(badLeaf, { evaluate: false }).outcome, "not checked");
  assert.equal(reportAer1Anchor({ tool: "x" }).outcome, "absent");
});
