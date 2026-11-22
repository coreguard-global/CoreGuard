#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REQUIRED = JSON.parse(readFileSync(new URL("../evidence/required-drills.json", import.meta.url)));
const dir = resolve(process.argv[2] || "ops/production/evidence");
let files = [];
try { files = readdirSync(dir).filter(f => f.endsWith(".json")).map(f => join(dir, f)); } catch { files = []; }
const results = [];
const byDrill = new Map();
for (const file of files) {
  let d; try { d = JSON.parse(readFileSync(file, "utf8")); } catch (e) { results.push({ file, ok: false, errors: [`invalid_json:${e.message}`] }); continue; }
  const errors = [];
  if (!REQUIRED.includes(d.drill)) errors.push("unknown_or_missing_drill");
  if (d.status !== "EXECUTED") errors.push("status_not_executed");
  if (!d.executedAt) errors.push("missing_executedAt");
  if (!d.environment || d.environment === "local-simulation" || /REPLACE/i.test(String(d.environment))) errors.push("invalid_environment");
  if (!d.operator || /REPLACE/i.test(String(d.operator))) errors.push("missing_operator");
  if (typeof d.pass !== "boolean") errors.push("missing_pass_boolean");
  if (!Array.isArray(d.artifacts)) errors.push("missing_artifacts_array");
  if (!Array.isArray(d.observations)) errors.push("missing_observations_array");
  if (typeof d.metrics !== "object" || d.metrics === null) errors.push("missing_metrics_object");
  const ok = errors.length === 0;
  results.push({ file, drill: d.drill, ok, errors, status: d.status });
  if (ok) byDrill.set(d.drill, file);
}
const missing = REQUIRED.filter(d => !byDrill.has(d));
const ready = missing.length === 0 && results.every(r => r.ok || !REQUIRED.includes(r.drill));
const report = {
  status: ready ? "EVIDENCE_COMPLETE_FOR_READINESS_REVIEW" : "NOT_READY_EVIDENCE_INCOMPLETE",
  disclaimer: "VERIFIED != SAFE. Evidence completeness does not equal production readiness, security, or SLA.",
  required: REQUIRED,
  missing,
  files: results,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (!ready) process.exit(2);
