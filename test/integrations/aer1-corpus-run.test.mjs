/**
 * The published AER-1 corpus, run — and the part we do not run, named.
 *
 * Two claims, kept apart because merging them is how "we run their corpus"
 * becomes a sentence nobody can check:
 *
 *   INTEGRITY  72 vendored files reproduce the published per-file sha256 and the
 *              published `evaluated_set_digest` — offline, no network.
 *   SEMANTICS  the judged families are replayed through CG-AER1/1 and compared
 *              to each vector's pin; the remaining 84 vectors are enumerated
 *              and reported NOT_CHECKED with a reason, never green.
 *
 * A negative control is included: flipping one byte in one vendored file must
 * fail integrity and name the file. Without it, "integrity PASS" is a sentence
 * with no teeth.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CORPUS, EVALUATED_FAMILIES, runCorpus, verifyCorpus } from "../../scripts/aer1-corpus.mjs";
import { parseAer1Record, aer1Outcome } from "../../packages/agent-commerce/aer1.mjs";

test("the vendored corpus reproduces the published set digest, offline", () => {
  const integrity = verifyCorpus(DEFAULT_CORPUS);
  assert.deepEqual(integrity.problems, []);
  assert.equal(integrity.ok, true);
  assert.equal(integrity.files, 72);
  assert.equal(integrity.vectors, 143);
  assert.equal(integrity.checks, 146);
  assert.equal(integrity.digest, integrity.expected);
  assert.match(integrity.digest, /^sha256:[0-9a-f]{64}$/);
});

test("the id-binding family matches every published pin", () => {
  const report = runCorpus(DEFAULT_CORPUS);
  assert.equal(report.ok, true);
  assert.equal(report.evaluated.rows.length, 6);
  for (const row of report.evaluated.rows) {
    assert.equal(row.ok, true, `${row.name}: expected ${JSON.stringify(row.expected)} got ${JSON.stringify(row.actual)}`);
  }
  assert.deepEqual(
    report.evaluated.rows.map((r) => r.actual.idVerdict),
    ["unverified", "matched", "mismatched", "resolved", "mismatched", "absent"],
  );
});

test("the families this build does not judge are counted, not claimed", () => {
  const report = runCorpus(DEFAULT_CORPUS);
  assert.ok(report.notEvaluatedVectors > 0);
  assert.equal(report.notEvaluatedVectors, 84);
  assert.ok(report.notEvaluated.every((f) => !EVALUATED_FAMILIES.includes(f.path)));
  const families = new Set(report.notEvaluated.map((f) => f.family));
  for (const expected of ["invalid", "valid", "chain-vectors-v07", "commitment-vectors"]) {
    assert.ok(families.has(expected), `missing family ${expected}`);
  }
  for (const judged of ["merkle-vectors", "unicode-vectors", "anchor-vectors"]) {
    assert.ok(!families.has(judged), `the ${judged} family is judged now, not not-checked`);
  }
});

test("the newly judged families are replayed, not merely listed", () => {
  const report = runCorpus(DEFAULT_CORPUS);
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.alsoEvaluated.map((f) => [f.family, f.rows.length, f.rows.filter((r) => r.ok).length]),
    [
      ["merkle", 9, 9],
      ["unicode", 5, 5],
      ["anchor", 8, 8],
      ["anchored", 6, 6],
      ["schema-0.4", 21, 21],
    ],
  );
});

test("integrity has teeth: one flipped byte fails by path", () => {
  const temp = mkdtempSync(join(tmpdir(), "cg-aer1-"));
  try {
    cpSync(DEFAULT_CORPUS, temp, { recursive: true });
    const target = join(temp, "base", "id-binding-vectors.json");
    const bytes = readFileSync(target);
    const mutated = Buffer.from(bytes);
    mutated[mutated.length - 2] = mutated[mutated.length - 2] ^ 0x01;
    writeFileSync(target, mutated);

    const integrity = verifyCorpus(temp);
    assert.equal(integrity.ok, false);
    assert.ok(
      integrity.problems.some((p) => p.startsWith("base/id-binding-vectors.json: sha256")),
      `expected a named sha256 failure, got ${JSON.stringify(integrity.problems)}`,
    );
    assert.ok(integrity.problems.some((p) => p.startsWith("evaluated_set_digest")));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("an AER-1 schema this build does not implement is NOT_CHECKED, version named", () => {
  const bytes = Buffer.from(JSON.stringify({ receipt_schema_version: "9.9", output: { text: "x" } }), "utf8");
  const record = {
    id: "11111111-1111-4111-8111-111111111111",
    receipt_schema_version: "9.9",
    canonical_byte_length: bytes.length,
    canonical_bytes: bytes.toString("base64"),
    output_hash: `sha256:${"0".repeat(64)}`,
  };
  const parsed = parseAer1Record(record);
  assert.equal(parsed.supportedVersion, false);
  const outcome = aer1Outcome(parsed);
  assert.equal(outcome.outcome, "NOT_CHECKED");
  assert.equal(outcome.blocks, false);
  assert.match(outcome.reason, /9\.9/);
});
