/**
 * AER-1 interop — CG-AER1/1 against the vendored, digest-pinned corpus.
 *
 * These tests do not claim conformance. They pin what the published table says,
 * so that the table cannot drift from the code, and so that a change which
 * accepts one more invalid vector fails here by name instead of shipping.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runCorpus, render, SET_DIGEST, KIT } from "../../scripts/aer1-interop.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
const PAGE = join(ROOT, "docs/AER1-INTEROP-TABLE.md");

const report = runCorpus();

test("AER-1 interop: pins, id-binding agreement, and no false reject", () => {
  assert.equal(report.kit, KIT);
  assert.equal(report.kit, "1.5.7");
  assert.equal(report.setDigest, SET_DIGEST);
  assert.equal(report.vectorTotal, 143);

  const idRows = report.idBinding;
  assert.equal(idRows.length, 6);
  assert.equal(idRows.filter((r) => r.agree).length, 6, JSON.stringify(idRows.filter((r) => !r.agree)));

  assert.equal(report.totals.falseReject, 0, "a valid record must never be refused");
});

test("AER-1 interop: the published table matches the code and the known defect count", () => {
  // This is the number to keep at zero. The corpus classifies 37 records as
  // invalid and CG-AER1/1 now refuses every one of them; a regression adds a
  // name here instead of passing quietly.
  assert.equal(report.totals.falseAccept, 0, "false accepts must stay at zero");
  assert.equal(report.totals.falseReject, 0, "a timeline family must not be refused as a whole");
  assert.equal(report.totals.notChecked, 49, "only the unimplemented families may remain not checked");

  // The three timeline families are judged now; the corpus expectation is met
  // for every vector, which is what moved these rows out of not-checked.
  const byPath = Object.fromEntries(report.families.map((f) => [f.path, f]));
  assert.deepEqual(
    {
      chainV1: [byPath["base/chain-vectors.json"].agree, byPath["base/chain-vectors.json"].vectors],
      chainV07: [byPath["base/chain-vectors-v07.json"].agree, byPath["base/chain-vectors-v07.json"].vectors],
      commitment: [byPath["base/commitment-vectors.json"].agree, byPath["base/commitment-vectors.json"].vectors],
      workflow: [byPath["workflow-merkle-seq-output-v1.json"].agree, byPath["workflow-merkle-seq-output-v1.json"].vectors],
    },
    { chainV1: [7, 7], chainV07: [28, 28], commitment: [8, 8], workflow: [8, 8] },
  );
  assert.deepEqual(report.falseAccepts.map((f) => f.name), []);

  assert.equal(report.pairs.live.name, "receipt-03-live");
  assert.equal(report.pairs.live.verdict, "pass");
  assert.equal(report.pairs.live.id.state, "verified-expected");

  assert.equal(report.pairs.swap.id.verdict, "mismatched");
  assert.equal(report.pairs.swap.drift?.field, "receipt.id");

  // The joined column comes from the reference kit's own run, vendored and
  // pinned: 143 vectors, 146 checks, the same evaluated-set digest, and no
  // vector name from a judged family that the corpus does not carry.
  assert.equal(report.kitPins.vectors, 143);
  assert.equal(report.kitPins.checks, 146);
  assert.equal(report.kitPins.footerDigest, SET_DIGEST);
  assert.equal(report.kitPins.commit, "e04e4c91d4630a2e0ceb4e12c48accacac10155e");
  assert.deepEqual(report.kitJoin.orphans, []);
  const divergences = Object.values(report.kitJoin.rows).flatMap((row) => row.divergences);
  assert.deepEqual(divergences.map((d) => d.name), [], "a verdict divergence must be named on the page, not swallowed");

  const page = readFileSync(PAGE, "utf8");
  assert.match(page, /commit `e04e4c91d4630a2e0ceb4e12c48accacac10155e`/);
  assert.match(page, /sha256:eb6cec8cf8d927c6af0460913fbf82ae1e2ae021b2cdde295b4d7c3aa4b29cd9/);
  assert.equal(page, render(report), "docs/AER1-INTEROP-TABLE.md is stale — run: node scripts/aer1-interop.mjs --write");
});
