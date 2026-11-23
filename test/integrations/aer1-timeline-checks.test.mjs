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
