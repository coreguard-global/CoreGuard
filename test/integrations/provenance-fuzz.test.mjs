/**
 * Deterministic provenance fuzz campaign (CG-RRP/1 + CG-TAS/1) wired into the
 * suite. The runner itself is offline, fixed-seed and reproducible; this file
 * pins the gate: zero escapes, zero benign drift, zero contract violations,
 * every attack family actually exercised, and run-to-run determinism.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { runProvenanceFuzz } from "../../scripts/ladder/provenance-fuzz.mjs";

const comparable = (r) => JSON.stringify({
  iterations: r.iterations,
  refused: r.refused,
  refusedByFamily: r.refusedByFamily,
  escaped: r.escaped,
  benignChecked: r.benignChecked,
  benignFailures: r.benignFailures,
  determinismChecks: r.determinismChecks,
  violations: r.violations,
  escapes: r.escapes,
  baseline: r.baseline,
});

test("provenance fuzz gate: zero escapes, zero benign drift, zero violations, deterministic sampling active", () => {
  const r = runProvenanceFuzz(300);
  assert.equal(r.baseline.set, "PROVENANCE_VERIFIED", "baseline must verify through the set path");
  assert.equal(r.baseline.direct, "PROVENANCE_VERIFIED", "baseline must verify through the direct path");
  assert.equal(r.escaped, 0, `escaped mutants: ${JSON.stringify(r.escapes)}`);
  assert.equal(r.benignFailures, 0, `benign drift: ${JSON.stringify(r.violations)}`);
  assert.equal(r.violations.length, 0, `contract violations: ${JSON.stringify(r.violations.slice(0, 3))}`);
  assert.ok(r.determinismChecks >= 3, "determinism sampling must actually run");
  assert.ok(r.benignChecked >= 100, "benign canonicalization slice must actually run");
});

test("every attack family is exercised and refused at least once (the campaign cannot go blind)", () => {
  const r = runProvenanceFuzz(300);
  const families = Object.keys(r.refusedByFamily).map(Number).sort((a, b) => a - b);
  assert.deepEqual(families, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "all 10 attack families must appear (8-9 = direct CG-RRP/1 path)");
  for (const f of families) {
    assert.ok(r.refusedByFamily[f] >= 15, `family ${f} must carry a real refused count, got ${r.refusedByFamily[f]}`);
  }
});

test("determinism: two runs with the same seed produce byte-identical campaign results", () => {
  const a = runProvenanceFuzz(150);
  const b = runProvenanceFuzz(150);
  assert.equal(comparable(a), comparable(b), "same seed must reproduce the campaign exactly (excluding timing)");
});
