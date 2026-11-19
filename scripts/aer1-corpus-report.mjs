#!/usr/bin/env node
/**
 * aer1-corpus-report.mjs — produce a shareable, reproducible AER-1 corpus run report.
 *
 * Runs the AER-1 corpus (integrity + evaluated families via CG-AER1/1) and emits
 * a machine-readable report.json and a human-readable REPORT.md with per-vector
 * outcomes, suitable for publishing in a thread.
 *
 * Usage:
 *   node scripts/aer1-corpus-report.mjs [--dir <corpus-dir>] [--out <dir>]
 *                                       [--label <text>] [--json]
 *
 *   --dir    corpus directory containing corpus-index.json (default: vendored v1.5.7 fixture)
 *   --out    directory to write report.json and REPORT.md (default: prints summary only)
 *   --label  short label for this run (included in report)
 *   --json   print report JSON to stdout
 *
 * Notes:
 * - To report against the live set, download/unpack it to a directory first, e.g.:
 *     mkdir -p /tmp/aer1-live && curl -fsSL https://zambo.dev/aer1/corpus.json -o /tmp/aer1-live/corpus-index.json
 *   (and fetch the files listed in the index into that directory), then run with --dir /tmp/aer1-live.
 * - Families not implemented by this parser are reported NOT_CHECKED by name/count; this is
 *   intentional fail-closed behavior, not a partial pass.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { runCorpus, DEFAULT_CORPUS } from "./aer1-corpus.mjs";
import { AER1_PARSER_VERSION } from "../packages/agent-commerce/aer1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");

function git(cmd) {
  try { return execFileSync("git", cmd, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

function parseArgs(argv) {
  const opts = { dir: DEFAULT_CORPUS, out: null, label: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") opts.dir = resolve(argv[++i]);
    else if (a === "--out") opts.out = resolve(argv[++i]);
    else if (a === "--label") opts.label = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

function summarizeNotEvaluated(notEvaluated) {
  const byFamily = new Map();
  for (const f of notEvaluated) {
    const row = byFamily.get(f.family) ?? { family: f.family, vectors: 0, files: 0 };
    row.vectors += f.vectors;
    row.files += 1;
    byFamily.set(f.family, row);
  }
  return [...byFamily.values()].sort((a, b) => b.vectors - a.vectors);
}

function buildMarkdown(report) {
  const r = report;
  const ev = r.evaluated;
  const matched = ev.rows.filter(x => x.ok).length;
  const lines = [];
  lines.push(`# AER-1 corpus run report`);
  lines.push(``);
  lines.push(`- **overall:** ${r.ok ? "PASS" : "FAIL"}`);
  lines.push(`- **parser:** ${r.parserVersion}`);
  lines.push(`- **kit:** ${r.integrity.kitVersion ?? "unknown"} (${r.integrity.draft ?? "draft unknown"})`);
  lines.push(`- **corpus dir:** \`${r.corpusDir}\``);
  if (r.label) lines.push(`- **label:** ${r.label}`);
  lines.push(`- **commit:** \`${r.repro.commit ?? "unknown"}\``);
  lines.push(`- **node:** ${r.repro.node}`);
  lines.push(`- **ran at:** ${r.repro.ranAt}`);
  lines.push(`- **integrity:** ${r.integrity.ok ? "PASS" : "FAIL"} (${r.integrity.files} files, ${r.integrity.vectors} vectors, ${r.integrity.checks} checks)`);
  lines.push(`- **evaluated_set_digest:** \`${r.integrity.digest}\``);
  if (r.integrity.expected) lines.push(`- **published digest:** \`${r.integrity.expected}\``);
  lines.push(``);
  lines.push(`## Integrity`);
  lines.push(``);
  if (r.integrity.problems.length === 0) {
    lines.push(`All vendored files match their indexed sha256 and the set digest matches the published value.`);
  } else {
    for (const p of r.integrity.problems) lines.push(`- ! ${p}`);
  }
  lines.push(``);
  lines.push(`## Evaluated family: ${ev.family}`);
  lines.push(``);
  lines.push(`Result: **${matched}/${ev.rows.length} match**${ev.ok ? "" : " (FAIL)"}`);
  lines.push(``);
  lines.push(`| vector | expected (digest/idVerdict/verdict) | actual (digest/idVerdict/verdict) | result |`);
  lines.push(`|---|---|---|---|`);
  for (const row of ev.rows) {
    const exp = `${row.expected.digest}/${row.expected.idVerdict}/${row.expected.verdict}`;
    const act = `${row.actual.digest}/${row.actual.idVerdict}/${row.actual.verdict}`;
    lines.push(`| ${row.name} | ${exp} | ${act} | ${row.ok ? "ok" : "FAIL"} |`);
  }
  if (ev.problems.length) {
    lines.push(``);
    for (const p of ev.problems) lines.push(`- ! ${p}`);
  }
  lines.push(``);
  lines.push(`## Not evaluated (reported, not claimed)`);
  lines.push(``);
  lines.push(`Families not implemented by \`${r.parserVersion}\` are **NOT_CHECKED** by name and count. This is intentional: a family that is not judged must not be reported as passing.`);
  lines.push(``);
  lines.push(`| family | files | vectors | status |`);
  lines.push(`|---|---:|---:|---|`);
  for (const f of r.notEvaluatedSummary) {
    lines.push(`| ${f.family} | ${f.files} | ${f.vectors} | NOT_CHECKED (family not implemented by ${r.parserVersion}) |`);
  }
  lines.push(``);
  lines.push(`Total not evaluated: **${r.notEvaluatedVectors} vectors** across ${r.notEvaluated.length} corpus files.`);
  lines.push(``);
  lines.push(`## Reproduce`);
  lines.push(``);
  lines.push("```bash");
  lines.push(r.repro.command);
  lines.push("```");
  lines.push(``);
  lines.push(`## Boundary`);
  lines.push(``);
  lines.push(`- Integrity proves the evaluated bytes are the published artifacts (or match the supplied corpus dir); it does not prove anything about the recorded work.`);
  lines.push(`- A \`pass\` verdict on an evaluated AER-1 vector means the structural/commitment checks matched the pinned expectation for that vector under ${r.parserVersion}; it is not a blanket pass for unevaluated families.`);
  lines.push(`- NOT_CHECKED families are named explicitly so absence of evaluation cannot be mistaken for success.`);
  lines.push(``);
  return lines.join("\n");
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(`Usage: node scripts/aer1-corpus-report.mjs [--dir <corpus-dir>] [--out <dir>] [--label <text>] [--json]\n`);
    return;
  }
  const raw = runCorpus(opts.dir);
  const notEvaluatedSummary = summarizeNotEvaluated(raw.notEvaluated);
  const relDir = opts.dir.startsWith(REPO) ? opts.dir.slice(REPO.length + 1) || "." : opts.dir;
  const cmdParts = ["node scripts/aer1-corpus-report.mjs"];
  if (opts.dir !== DEFAULT_CORPUS) cmdParts.push(`--dir ${relDir}`);
  if (opts.out) cmdParts.push(`--out <out-dir>`);
  if (opts.label) cmdParts.push(`--label ${JSON.stringify(opts.label)}`);
  const report = {
    schema: "coreguard.aer1-corpus-run-report/1",
    ok: raw.ok,
    parserVersion: raw.parserVersion,
    corpusDir: relDir,
    label: opts.label,
    integrity: raw.integrity,
    evaluated: raw.evaluated,
    notEvaluated: raw.notEvaluated,
    notEvaluatedVectors: raw.notEvaluatedVectors,
    notEvaluatedSummary,
    repro: {
      commit: git(["rev-parse", "HEAD"]),
      commitShort: git(["rev-parse", "--short", "HEAD"]),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      ranAt: new Date().toISOString(),
      command: cmdParts.join(" "),
    },
    boundary: [
      "Integrity verifies bytes/digest against the corpus index; it does not validate the recorded work.",
      "Only the evaluated family is judged; all other families are reported NOT_CHECKED by name/count.",
      "A pass for evaluated vectors is scoped to those vectors and this parser version.",
    ],
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const matched = report.evaluated.rows.filter(x => x.ok).length;
    console.log(`AER-1 corpus report: ${report.ok ? "PASS" : "FAIL"}`);
    console.log(`  integrity: ${report.integrity.ok ? "PASS" : "FAIL"} (${report.integrity.files} files, ${report.integrity.vectors} vectors, digest ${report.integrity.digest})`);
    console.log(`  evaluated (${report.evaluated.family}): ${matched}/${report.evaluated.rows.length} match`);
    console.log(`  not evaluated: ${report.notEvaluatedVectors} vectors (${notEvaluatedSummary.length} families) — NOT_CHECKED`);
    console.log(`  commit ${report.repro.commitShort ?? "?"} · node ${report.repro.node}`);
  }

  if (opts.out) {
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(resolve(opts.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(resolve(opts.out, "REPORT.md"), buildMarkdown(report) + "\n");
    if (!opts.json) console.log(`  wrote ${resolve(opts.out, "report.json")} and REPORT.md`);
  }

  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv); } catch (e) { console.error(e); process.exit(2); }
}
