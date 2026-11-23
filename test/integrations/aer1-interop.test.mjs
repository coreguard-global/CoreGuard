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
  assert.deepEqual(report.falseAccepts.map((f) => f.name), []);

  assert.equal(report.pairs.live.name, "receipt-03-live");
  assert.equal(report.pairs.live.verdict, "pass");
  assert.equal(report.pairs.live.id.state, "verified-expected");

  assert.equal(report.pairs.swap.id.verdict, "mismatched");
  assert.equal(report.pairs.swap.drift?.field, "receipt.id");

  const page = readFileSync(PAGE, "utf8");
  assert.equal(page, render(report), "docs/AER1-INTEROP-TABLE.md is stale — run: node scripts/aer1-interop.mjs --write");
});
