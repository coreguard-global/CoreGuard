#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const REQUIRED = JSON.parse(readFileSync(new URL("../evidence/required-drills.json", import.meta.url)));
const dir = resolve(process.argv[2] || "ops/production/evidence");
const out = resolve(process.argv[3] || "ops/production/evidence/readiness-report.md");
let files = [];
try { files = readdirSync(dir).filter(f => f.endsWith(".json") && !f.includes("TEMPLATE")).map(f => join(dir, f)); } catch {}
const records = [];
for (const file of files) {
  try { const d = JSON.parse(readFileSync(file, "utf8")); records.push({ file, ...d }); } catch {}
}
function isReal(d) {
  return d && d.status === "EXECUTED" && d.executedAt && d.environment && d.environment !== "local-simulation" && !/REPLACE/i.test(String(d.environment)) && d.operator && !/REPLACE/i.test(String(d.operator)) && typeof d.pass === "boolean";
}
const byDrill = new Map();
for (const r of records) if (REQUIRED.includes(r.drill) && isReal(r)) byDrill.set(r.drill, r);
const missing = REQUIRED.filter(d => !byDrill.has(d));
const failed = REQUIRED.filter(d => byDrill.has(d) && byDrill.get(d).pass !== true);
const complete = missing.length === 0 && failed.length === 0;
const verdict = complete ? "EVIDENCE_COMPLETE_FOR_INDEPENDENT_REVIEW" : "NOT_READY";

const lines = [];
lines.push(`# CGCP Production Readiness Report`);
lines.push(``);
lines.push(`**Status:** ${verdict}`);
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Scope:** evidence-based report only; no external provisioning performed by this script.`);
lines.push(``);
lines.push(`> VERIFIED != SAFE. This report does **NOT** declare production ready, SLA compliance, security certification, or managed-service readiness.`);
lines.push(`> A "production ready" or "SLA" claim requires complete real-environment evidence, operational controls, and independent review.`);
lines.push(``);
lines.push(`## Required drills`);
for (const id of REQUIRED) {
  const r = byDrill.get(id);
  if (!r) lines.push(`- [ ] ${id}: MISSING/INVALID`);
  else lines.push(`- [${r.pass ? 'x' : ' '}] ${id}: ${r.pass ? 'PASS' : 'FAIL'} (${r.environment}, ${r.executedAt})`);
}
lines.push(``);
lines.push(`## Gaps`);
if (missing.length === 0 && failed.length === 0) lines.push(`- No evidence gaps detected by this validator. Independent review still required.`);
for (const m of missing) lines.push(`- Missing/invalid evidence: ${m}`);
for (const f of failed) lines.push(`- Failed drill: ${f}`);
lines.push(``);
lines.push(`## External integration evidence (must be supplied separately)`);
for (const item of ["Managed Postgres HA/replication/failover","OIDC/SAML/SCIM real IdP integration","KMS/HSM and managed secrets lifecycle","External witness/transparency log/on-chain anchoring","OTEL/alerts/SLO/on-call operational controls"]) {
  lines.push(`- [ ] ${item}`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n") + "\n");
process.stdout.write(JSON.stringify({ verdict, out, missing, failed }) + "\n");
if (!complete) process.exit(2);
