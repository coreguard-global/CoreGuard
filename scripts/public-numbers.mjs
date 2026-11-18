#!/usr/bin/env node
/**
 * public-numbers.mjs — one machine-generated source for every public number.
 *
 * Reads the canonical measurement (`docs/state-snapshot.json`) and emits:
 *   - docs/numbers.json   machine-readable, one metric per row
 *   - docs/NUMBERS.html   static, self-contained page (no fetch, no analytics)
 *
 * The point is that a public page can never disagree with the committed
 * snapshot again: `--check` fails CI when the generated files drift, and every
 * row carries the snapshot field it came from plus the commit it was measured
 * on.
 *
 * Usage:
 *   node scripts/public-numbers.mjs            # print numbers.json to stdout
 *   node scripts/public-numbers.mjs --write    # write docs/numbers.json + docs/NUMBERS.html
 *   node scripts/public-numbers.mjs --check    # exit 1 if either file is stale
 *
 * Exit: 0 = clean/match, 1 = drift, 2 = usage/measurement error.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const SNAPSHOT = join(REPO, "docs", "state-snapshot.json");
const OUT_JSON = join(REPO, "docs", "numbers.json");
const OUT_HTML = join(REPO, "docs", "NUMBERS.html");
const SNAPSHOT_REL = "docs/state-snapshot.json";

const mode = process.argv.slice(2)[0] ?? "--print";
if (!["--print", "--write", "--check"].includes(mode)) {
  console.error("usage: public-numbers.mjs [--print|--write|--check]");
  process.exit(2);
}

function readSnapshot() {
  if (!existsSync(SNAPSHOT)) {
    console.error(`PUBLIC-NUMBERS: missing ${SNAPSHOT_REL}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  } catch (e) {
    console.error(`PUBLIC-NUMBERS: ${SNAPSHOT_REL} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

function metric(snapshot, id, label, value, unit, field, note) {
  return { id, label, value, unit, source: `${SNAPSHOT_REL}#${field}`, note };
}

function build(snapshot) {
  const docsNode = snapshot.docsNode ?? {};
  const audit = snapshot.boundaryAudit ?? {};
  return {
    schema: "CG-NUMBERS/1",
    generatedBy: "scripts/public-numbers.mjs",
    generatedFrom: SNAPSHOT_REL,
    measuredAtUtc: snapshot.measuredAtUtc ?? null,
    measuredOnCommit: snapshot.gitCommit ?? null,
    metrics: [
      metric(snapshot, "tests", "Tests (full suite, machine-pinned)", snapshot.testsTotal ?? null, "tests", "testsTotal",
        "Pass count of the last green `npm test`; the suite asserts this number."),
      metric(snapshot, "boundary-files", "Boundary audit — files scanned", audit.filesScanned ?? null, "files", "boundaryAudit.filesScanned",
        "Tracked files from `git ls-files` (ignored trees such as var/ are not counted)."),
      metric(snapshot, "boundary-violations", "Boundary audit — violations", audit.violations ?? null, "violations", "boundaryAudit.violations",
        "Zero is enforced by `npm run boundary:audit`."),
      metric(snapshot, "docs-executed", "Docs contract — commands executed", docsNode.executed ?? null, "commands", "docsNode.executed",
        "Documented node/npm commands that actually run in the docs harness."),
      metric(snapshot, "docs-skip-listed", "Docs contract — skip-listed", docsNode.skipListed ?? null, "commands", "docsNode.skipListed",
        "Each skip has a named, still-true reason; unclassified commands fail the contract."),
      metric(snapshot, "docs-covered", "Docs contract — docs covered", docsNode.docsCovered ?? null, "docs", "docsNode.docsCovered",
        "Documents that contributed at least one executed command."),
      metric(snapshot, "commits-ahead", "Commits ahead of v0.6.0", snapshot.commitsAheadOfV060 ?? null, "commits", "commitsAheadOfV060",
        "History depth, not a quality signal."),
    ],
    statuses: [
      { id: "peoples-court", label: "Peoples Court harness", value: snapshot.peoplesCourtHarness ?? null, source: `${SNAPSHOT_REL}#peoplesCourtHarness` },
    ],
    nonClaims: [
      "These are measurements of this repository at the commit above — not customers, revenue, adoption, or unique users.",
      "A green test count proves the tests pass; it is not a security audit, certification, or production-readiness claim.",
      "Boundary counts cover tracked files only; generated and ignored trees are excluded by design.",
      "No third-party registry or download figures are included here, because this script performs no network calls.",
    ],
  };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderJson(doc) {
  return JSON.stringify(doc, null, 2) + "\n";
}

function renderHtml(doc) {
  const rows = doc.metrics
    .map(
      (m) => `      <tr>
        <td class="k">${esc(m.label)}</td>
        <td class="v">${esc(m.value)}${m.unit ? ` <span class="u">${esc(m.unit)}</span>` : ""}</td>
        <td class="s"><code>${esc(m.source)}</code><div class="n">${esc(m.note)}</div></td>
      </tr>`,
    )
    .join("\n");
  const statuses = doc.statuses
    .map((s) => `      <tr><td class="k">${esc(s.label)}</td><td class="v">${esc(s.value)}</td><td class="s"><code>${esc(s.source)}</code></td></tr>`)
    .join("\n");
  const nonClaims = doc.nonClaims.map((n) => `      <li>${esc(n)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>CoreGuard · numbers</title>
<style>
  :root { color-scheme: dark; --bg:#0B0F14; --panel:#111821; --line:#1F2A37; --ink:#E6EDF3; --dim:#9AA7B4; --accent:#FF8A00; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  main { max-width: 900px; margin: 0 auto; padding: 40px 20px 72px; }
  h1 { font-size: 20px; letter-spacing: .02em; margin: 0 0 4px; }
  .sub { color: var(--dim); margin: 0 0 24px; }
  .pin { display:flex; flex-wrap:wrap; gap:8px 22px; padding:12px 16px; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--dim); font-size:13px; margin-bottom:26px; }
  .pin b { color: var(--ink); font-weight:600; }
  table { width:100%; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
  td.k { color: var(--dim); width: 34%; }
  td.v { font-weight: 700; color: var(--accent); width: 18%; white-space: nowrap; }
  td.v .u { color: var(--dim); font-weight: 400; }
  td.s { color: var(--dim); font-size: 12px; }
  code { color: var(--ink); }
  .n { margin-top: 3px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); margin: 32px 0 8px; }
  ul { color: var(--dim); font-size: 13px; padding-left: 20px; }
  .note { margin-top: 26px; padding: 14px 16px; border-left: 3px solid var(--accent); background: var(--panel); color: var(--dim); font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>CoreGuard — numbers</h1>
  <p class="sub">Machine-generated from the committed snapshot. Every row names the field it came from.</p>

  <div class="pin">
    <span>measured at <b>${esc(doc.measuredAtUtc ?? "unknown")}</b></span>
    <span>commit <b>${esc((doc.measuredOnCommit ?? "unknown").slice(0, 12))}</b></span>
    <span>source <b>${esc(doc.generatedFrom)}</b></span>
    <span>schema <b>${esc(doc.schema)}</b></span>
  </div>

  <table>
    <tbody>
${rows}
    </tbody>
  </table>

  <h2>Statuses</h2>
  <table>
    <tbody>
${statuses}
    </tbody>
  </table>

  <h2>What these numbers are not</h2>
  <ul>
${nonClaims}
  </ul>

  <p class="note">
    Regenerate with <code>node scripts/public-numbers.mjs --write</code>.
    CI guard: <code>node scripts/public-numbers.mjs --check</code> fails when this page
    and <code>docs/numbers.json</code> no longer match the snapshot.
  </p>
</main>
</body>
</html>
`;
}

const doc = build(readSnapshot());
const json = renderJson(doc);
const html = renderHtml(doc);

if (mode === "--print") {
  process.stdout.write(json);
  process.exit(0);
}

if (mode === "--write") {
  writeFileSync(OUT_JSON, json, "utf8");
  writeFileSync(OUT_HTML, html, "utf8");
  console.log(`PUBLIC-NUMBERS: wrote docs/numbers.json (${doc.metrics.length} metrics) and docs/NUMBERS.html`);
  process.exit(0);
}

// --check
let drift = false;
for (const [file, expected] of [
  [OUT_JSON, json],
  [OUT_HTML, html],
]) {
  const rel = file.slice(REPO.length + 1);
  if (!existsSync(file)) {
    console.error(`PUBLIC-NUMBERS: ${rel} is missing — run --write`);
    drift = true;
    continue;
  }
  const actual = readFileSync(file, "utf8");
  if (actual !== expected) {
    const a = actual.split("\n");
    const b = expected.split("\n");
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.error(`PUBLIC-NUMBERS: ${rel} is stale at line ${i + 1}`);
    console.error(`  on disk:  ${(a[i] ?? "<eof>").slice(0, 120)}`);
    console.error(`  expected: ${(b[i] ?? "<eof>").slice(0, 120)}`);
    drift = true;
  }
}
if (drift) process.exit(1);
console.log(`PUBLIC-NUMBERS: OK — ${doc.metrics.length} metrics match ${SNAPSHOT_REL}`);
