/**
 * AER-1 observation join — the observation family built on the same pinned set
 * the interop table judges, and the guard that keeps its rows honest.
 *
 * These tests pin three things: the join covers the same 143 vectors and the
 * same digest, every row speaks the layer's five-word vocabulary with a frozen
 * reason where a reason is allowed, and the published page is byte-current. The
 * three negative controls are the point of the guard: a row with an invented
 * outcome, a not_checked row with an invented reason, and a duplicate row name
 * must each fail, or the guard is decoration.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build, render, validateRows, OUT, ROWS } from "../../scripts/aer1-observation-join.mjs";
import { CHECK_OUTCOMES, NOT_CHECKED_REASONS, OBSERVATION_VERSION } from "../../packages/agent-commerce/observations.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");

const report = build();

test("observation join: the same set, the same digest, the same family keys", () => {
  assert.equal(OBSERVATION_VERSION, "CG-OBS/1");
  assert.equal(report.report.vectorTotal, 143);
  assert.equal(report.report.setDigest, "sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2");
  const covered = report.rows.reduce((n, r) => n + r.vectors, 0);
  assert.equal(covered, 143, "every vector in the pinned set must land in exactly one family row");
  const familyPaths = new Set(report.report.families.map((f) => f.path));
  assert.ok(familyPaths.size > 0);
  for (const row of report.rows) {
    assert.ok(row.vectors >= 0);
    assert.ok(typeof row.key === "string" && row.key.length > 0);
  }
});

test("observation join: one immutable read per vector, in the five-word vocabulary", () => {
  const observations = report.observations;
  assert.equal(observations.length, 143);
  assert.equal(new Set(observations.map((o) => o.name)).size, 143, "a vector name may not be recorded twice");
  for (const row of observations) {
    assert.ok(CHECK_OUTCOMES.includes(row.outcome), `unexpected outcome ${row.outcome}`);
    assert.equal(row.observer, "cg-aer1:parser");
    if (row.outcome === "not_checked") {
      assert.ok(NOT_CHECKED_REASONS.includes(row.reason), `not_checked must name a frozen reason, got ${row.reason}`);
    } else {
      assert.equal(row.reason, null, "a reason is only valid on not_checked");
    }
  }
  assert.deepEqual(
    { verified: report.parserTotals.verified, failed: report.parserTotals.verification_failed, unresolvable: report.parserTotals.unresolvable_record, notChecked: report.parserTotals.not_checked, absent: report.parserTotals.absent },
    { verified: 50, failed: 87, unresolvable: 3, notChecked: 1, absent: 2 },
  );
});

test("observation join: the bytes reader verifies every pinned file, and claims nothing else", () => {
  assert.equal(report.bytesTotals.files, 72);
  assert.equal(report.bytesTotals.verified, 72);
  assert.equal(report.bytesTotals.verification_failed, 0);
  assert.deepEqual([...new Set(report.bytes.map((b) => b.scope))], ["file:sha256"]);
  for (const row of report.bytes) assert.match(row.expected, /^sha256:[0-9a-f]{64}$/);
});

test("observation join: adding reads does not move the joined verdict", () => {
  assert.deepEqual(report.divergences, [], "the observation family must not change a divergence");
  assert.equal(report.report.totals.falseAccept, 0);
  assert.equal(report.report.totals.agree, 143);
  const compared = report.rows.reduce((n, r) => n + r.kit.compared, 0);
  assert.ok(compared > 0, "the kit join must actually compare vectors, not print an empty column");
});

test("observation join: the published page and rows are byte-current", () => {
  assert.equal(readFileSync(OUT, "utf8"), render(report), "docs/AER1-OBSERVATION-JOIN.md is stale — run: node scripts/aer1-observation-join.mjs --write");
  const rows = JSON.parse(readFileSync(ROWS, "utf8"));
  assert.equal(rows.format, "aer1-observation-rows/1");
  assert.equal(rows.joinKey, "name");
  assert.equal(rows.rows.length, 143);
  assert.equal(rows.setDigest, report.report.setDigest);
  assert.equal(rows.rows[0].observer, "cg-aer1:parser");
});

test("observation join: the guard refuses an invented outcome, an invented reason, and a duplicate name", () => {
  const ok = () => ({ name: "v1", family: "valid", observer: "cg-aer1:parser", scope: "record:bytes", outcome: "verified", reason: null, detail: null });
  assert.equal(validateRows([ok()]), 1);
  assert.throws(() => validateRows([{ ...ok(), outcome: "probably_fine" }]), /unknown observation outcome/);
  assert.throws(() => validateRows([{ ...ok(), outcome: "not_checked", reason: "felt_like_it" }]), /without a frozen reason/);
  assert.throws(() => validateRows([{ ...ok(), reason: "access_refused" }]), /a reason on a finding/);
  assert.throws(() => validateRows([ok(), ok()]), /duplicate observation row/);
});
