#!/usr/bin/env node
/**
 * aer1-corpus.mjs — run the published AER-1 corpus, and say what was not run.
 *
 * Two different things are claimed by "we run their corpus", and this file keeps
 * them apart on purpose:
 *
 *   INTEGRITY  every vendored file is bit-identical to the published artifact
 *              (per-file sha256 from the corpus index), and the whole set
 *              reproduces the published `evaluated_set_digest`. 72 files, 143
 *              vectors, one digest — offline, no network.
 *
 *   SEMANTICS  one family is actually judged: `base/id-binding-vectors.json`,
 *              replayed through CG-AER1/1 and compared to each vector's pinned
 *              expectation. Every other family is enumerated, counted, and
 *              reported NOT_CHECKED with the reason. A verifier that
 *              half-implements a family and reports it green is the failure
 *              mode the corpus exists to catch.
 *
 * Usage:
 *   node scripts/aer1-corpus.mjs [--dir <corpus dir>] [--json] [--quiet]
 *
 * Exit: 0 = integrity ok and every evaluated vector matched, 1 = a mismatch
 * (integrity or semantics), 2 = corpus missing or unreadable.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAer1Record, AER1_PARSER_VERSION } from "../packages/agent-commerce/aer1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const DEFAULT_CORPUS = join(REPO, "test", "fixtures", "aer1-corpus-v1.5.7");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** The one family this build judges end-to-end. */
export const EVALUATED_FAMILIES = Object.freeze(["base/id-binding-vectors.json"]);

/** Human family name for a corpus path. */
export function familyOf(relPath) {
  if (relPath === "base/id-binding-vectors.json") return "id-binding";
  if (relPath.startsWith("base/test-vectors/")) return relPath.split("/")[2] ?? "test-vectors";
  return relPath.replace(/^base\//, "").replace(/\.json$/, "");
}

/**
 * Verify the vendored corpus against its own index.
 * Returns { ok, files, vectors, checks, digest, expected, problems }.
 */
export function verifyCorpus(dir = DEFAULT_CORPUS) {
  const indexPath = join(dir, "corpus-index.json");
  if (!existsSync(indexPath)) return { ok: false, problems: ["corpus-index.json is missing"] };
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  const files = Array.isArray(index.files) ? index.files : [];
  const problems = [];
  let vectors = 0;
  let checks = 0;
  const onDisk = [];
  for (const file of files) {
    const abs = join(dir, file.path);
    if (!existsSync(abs)) {
      problems.push(`${file.path}: missing`);
      continue;
    }
    const bytes = readFileSync(abs);
    const actual = sha256(bytes);
    if (actual !== file.sha256) problems.push(`${file.path}: sha256 ${actual.slice(0, 12)} != published ${String(file.sha256).slice(0, 12)}`);
    onDisk.push({ path: file.path, actual });
    vectors += Number(file.vectors) || 0;
    checks += Number(file.checks) || 0;
  }
  // The published algorithm hashes the exact file bytes, so the set digest is
  // recomputed from what is on disk — not from the digests the index claims.
  // Computing it from the index made a tampered file fail one check instead of
  // two, and made the negative control a sentence with no teeth.
  const sorted = onDisk.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const concat = sorted.map((f) => `${f.path}\u0000${f.actual}\n`).join("");
  const digest = `sha256:${sha256(Buffer.from(concat, "utf8"))}`;
  if (index.evaluated_set_digest && digest !== index.evaluated_set_digest) {
    problems.push(`evaluated_set_digest ${digest} != published ${index.evaluated_set_digest}`);
  }
  return {
    ok: problems.length === 0,
    kitVersion: index.kit_version ?? null,
    draft: index.draft ?? null,
    files: files.length,
    vectors,
    checks,
    digest,
    expected: index.evaluated_set_digest ?? null,
    problems,
  };
}

/** Replay the id-binding family and compare to its pins. */
export function runIdBindingFamily(dir = DEFAULT_CORPUS) {
  const file = join(dir, "base", "id-binding-vectors.json");
  if (!existsSync(file)) return { ok: false, rows: [], problems: ["base/id-binding-vectors.json is missing"] };
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const vectors = Array.isArray(payload.vectors) ? payload.vectors : [];
  const rows = [];
  const problems = [];
  for (const vector of vectors) {
    const parsed = parseAer1Record(vector.receipt, {
      expectedId: vector.expected_id,
      resolvedRecord: vector.resolved_record,
    });
    // expected_digest is the artifact's structural verdict, not merely byte
    // equality: the id-absent vector keeps its bytes intact and still fails,
    // because an AER-1 artifact without an id is malformed. Reading it as
    // digest equality would pass a record the corpus marks fail.
    const digestOk = (vector.expected_digest === "pass") === parsed.structureOk;
    const stateOk = vector.expected_id_state === parsed.id.state;
    const idVerdictOk = vector.expected_id_verdict === parsed.id.verdict;
    const verdictOk = (vector.expected_verdict === "pass") === (parsed.verdict === "pass");
    const ok = digestOk && stateOk && idVerdictOk && verdictOk;
    rows.push(
      Object.freeze({
        name: vector.name,
        ok,
        expected: {
          digest: vector.expected_digest,
          idState: vector.expected_id_state,
          idVerdict: vector.expected_id_verdict,
          verdict: vector.expected_verdict,
        },
        actual: {
          digest: parsed.structureOk ? "pass" : "fail",
          idState: parsed.id.state,
          idVerdict: parsed.id.verdict,
          verdict: parsed.verdict,
        },
      }),
    );
    if (!ok) problems.push(`${vector.name}: expected ${JSON.stringify(rows.at(-1).expected)} got ${JSON.stringify(rows.at(-1).actual)}`);
  }
  return { ok: problems.length === 0, rows, problems };
}

/** The full picture: integrity, the evaluated family, and the families not run. */
export function runCorpus(dir = DEFAULT_CORPUS) {
  const integrity = verifyCorpus(dir);
  const idBinding = runIdBindingFamily(dir);
  const skipped = (integrity.ok ? readFamilies(dir) : []).filter((f) => !EVALUATED_FAMILIES.includes(f.path));
  return {
    parserVersion: AER1_PARSER_VERSION,
    integrity,
    evaluated: { family: "id-binding", ...idBinding },
    notEvaluated: skipped,
    notEvaluatedVectors: skipped.reduce((n, f) => n + f.vectors, 0),
    ok: integrity.ok && idBinding.ok,
  };
}

function readFamilies(dir) {
  const index = JSON.parse(readFileSync(join(dir, "corpus-index.json"), "utf8"));
  return (index.files ?? []).map((f) => ({ path: f.path, family: familyOf(f.path), vectors: Number(f.vectors) || 0 }));
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const quiet = args.includes("--quiet");
  const dirArg = args.indexOf("--dir");
  const dir = dirArg >= 0 ? resolve(args[dirArg + 1]) : DEFAULT_CORPUS;

  let report;
  try {
    report = runCorpus(dir);
  } catch (error) {
    console.error(`AER1-CORPUS: ERROR ${error.message}`);
    process.exit(2);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  }

  if (!quiet) {
    console.log(
      `AER1-CORPUS (${report.parserVersion}) · kit ${report.integrity.kitVersion} · ${report.integrity.files} files · ${report.integrity.vectors} vectors · ${report.integrity.checks} checks`,
    );
    console.log(
      `integrity   ${report.integrity.ok ? "PASS" : "FAIL"} · evaluated_set_digest ${report.integrity.digest}`,
    );
    for (const p of report.integrity.problems) console.log(`  ! ${p}`);
    console.log("");
    console.log("family                         vectors  status");
    const matched = report.evaluated.rows.filter((r) => r.ok).length;
    console.log(
      `${"id-binding".padEnd(30)} ${String(report.evaluated.rows.length).padStart(7)}  EVALUATED ${matched}/${report.evaluated.rows.length} match`,
    );
    const byFamily = new Map();
    for (const f of report.notEvaluated) {
      const row = byFamily.get(f.family) ?? { vectors: 0 };
      row.vectors += f.vectors;
      byFamily.set(f.family, row);
    }
    for (const [family, row] of [...byFamily.entries()].sort((a, b) => b[1].vectors - a[1].vectors)) {
      console.log(`${family.padEnd(30)} ${String(row.vectors).padStart(7)}  NOT_CHECKED (family not implemented by ${report.parserVersion})`);
    }
    console.log("");
    for (const r of report.evaluated.rows) {
      const mark = r.ok ? "ok  " : "FAIL";
      console.log(`  ${mark} ${r.name.padEnd(28)} ${r.actual.digest}/${r.actual.idVerdict}/${r.actual.verdict}`);
    }
    for (const p of report.evaluated.problems) console.log(`  ! ${p}`);
  }

  console.log(
    `AER1-CORPUS: ${report.ok ? "OK" : "FAIL"} — integrity ${report.integrity.ok ? "pass" : "fail"}, id-binding ${report.evaluated.rows.filter((r) => r.ok).length}/${report.evaluated.rows.length}, ${report.notEvaluatedVectors} vectors named not-checked`,
  );
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
