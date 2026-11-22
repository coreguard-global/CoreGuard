import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
function run(args, cwd=root) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("validate-env-template passes for reference env.example", () => {
  const r = run(["ops/production/drills/validate-env-template.mjs"]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const j = JSON.parse(r.stdout);
  assert.equal(j.ok, true);
});

test("validate-evidence reports NOT_READY for templates/missing evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-evidence-"));
  const r = run(["ops/production/drills/validate-evidence.mjs", dir]);
  assert.equal(r.status, 2);
  const j = JSON.parse(r.stdout);
  assert.equal(j.status, "NOT_READY_EVIDENCE_INCOMPLETE");
  assert.ok(j.missing.length >= 5);
  assert.match(JSON.stringify(j.disclaimer), /VERIFIED != SAFE/);
});

test("generate-readiness-report refuses production ready/SLA claims and returns NOT_READY on missing evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-evidence-"));
  const out = join(dir, "readiness-report.md");
  const r = run(["ops/production/drills/generate-readiness-report.mjs", dir, out]);
  assert.equal(r.status, 2);
  const j = JSON.parse(r.stdout);
  assert.equal(j.verdict, "NOT_READY");
  const md = readFileSync(out, "utf8");
  assert.match(md, /does \*\*NOT\*\* declare production ready, SLA compliance/);
  assert.match(md, /VERIFIED != SAFE/);
  assert.doesNotMatch(md, /Status:\*\* PRODUCTION_READY/);
});

test("generate-readiness-report accepts complete real-looking EXECUTED evidence but still includes non-claim", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-evidence-"));
  const drills = ["backup-restore-integrity","failover-rpo-rto","key-rotation","tenant-isolation-authz","anchor-verify-after-restore"];
  for (const d of drills) {
    writeFileSync(join(dir, `${d}.json`), JSON.stringify({
      status:"EXECUTED", drill:d, executedAt:"2026-11-22T00:00:00Z", environment:"target-staging", operator:"ops@example",
      inputs:{}, observations:["ok"], metrics:{}, artifacts:[{type:"log",ref:"s3://bucket/x",sha256:"abc"}], pass:true
    }));
  }
  const out = join(dir, "readiness-report.md");
  const r = run(["ops/production/drills/generate-readiness-report.mjs", dir, out]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const j = JSON.parse(r.stdout);
  assert.equal(j.verdict, "EVIDENCE_COMPLETE_FOR_INDEPENDENT_REVIEW");
  const md = readFileSync(out, "utf8");
  assert.match(md, /EVIDENCE_COMPLETE_FOR_INDEPENDENT_REVIEW/);
  assert.match(md, /does \*\*NOT\*\* declare production ready, SLA compliance/);
});

test("local-backup-restore-sim produces LOCAL_SIMULATION_NOT_PRODUCTION_EVIDENCE", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-sim-"));
  const out = join(dir, "evidence.json");
  const r = run(["ops/production/drills/local-backup-restore-sim.mjs", out]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const j = JSON.parse(r.stdout);
  assert.equal(j.status, "LOCAL_SIMULATION_NOT_PRODUCTION_EVIDENCE");
  const ev = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(ev.pass, true);
  assert.equal(ev.status, "LOCAL_SIMULATION_NOT_PRODUCTION_EVIDENCE");
});
