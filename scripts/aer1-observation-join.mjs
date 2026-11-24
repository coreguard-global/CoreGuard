#!/usr/bin/env node
/**
 * AER-1 observation join — the observation family, built against the same
 * evaluated set, the same digest and the same column shape as the interop table.
 *
 *   node scripts/aer1-observation-join.mjs            # print the page
 *   node scripts/aer1-observation-join.mjs --write    # page + rows JSON
 *   node scripts/aer1-observation-join.mjs --check    # exit 1 if either is stale
 *   node scripts/aer1-observation-join.mjs --json     # machine-readable report
 *
 * What this page is, precisely: the per-vector rows the observation layer would
 * record if it read the pinned corpus today, joined on vector name against the
 * reference kit's own column. Two readers appear, and neither is invented:
 *
 *   cg-aer1:parser   CG-AER1/1 reading each vector's bytes, one row per vector
 *   cg-aer1:bytes    SHA-256 of each corpus file against the digest the index pins
 *
 * No timestamps appear on these rows, and that is deliberate. A clock value on a
 * corpus read would be a made-up fact; the clock and ordering rules are exercised
 * with real attempts on AER1-OBSERVATION-LEDGER.md instead. What is real here is
 * the vocabulary, the scope, and the join.
 *
 * A read outcome is not an expectation. `verification_failed` on a negative
 * vector is the check behaving as designed, not a defect and not a divergence;
 * the expectation lives in the interop column beside this one, and it agrees on
 * all 143 vectors. Collapsing the two is the exact mistake this page is shaped
 * to make impossible.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCorpus, SET_DIGEST, KIT } from "./aer1-interop.mjs";
import { OBSERVATION_VERSION, CHECK_OUTCOMES, NOT_CHECKED_REASONS } from "../packages/agent-commerce/observations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "docs/AER1-OBSERVATION-JOIN.md");
const ROWS = join(ROOT, "docs/aer1-observation-rows.json");
const CORPUS = join(ROOT, "test/fixtures/aer1-corpus-v1.5.7");
const INDEX_FILE = join(CORPUS, "corpus-index.json");

const sha256 = (buffer) => `sha256:${createHash("sha256").update(buffer).digest("hex")}`;

/**
 * The second reader: the bytes on disk against the digest the corpus index pins.
 * It knows nothing about outcomes, validity or the kit — only that the file it
 * read is the file the set says it read.
 */
function readBytes() {
  const index = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
  const rows = [];
  for (const file of index.files ?? []) {
    const path = join(CORPUS, file.path);
    const present = existsSync(path);
    const observed = present ? sha256(readFileSync(path)) : null;
    const expected = `sha256:${file.sha256}`;
    rows.push({
      file: file.path,
      family: familyKeyOf(file.path),
      observer: "cg-aer1:bytes",
      scope: "file:sha256",
      outcome: present && observed === expected ? "verified" : present ? "verification_failed" : "absent",
      expected,
      observed,
    });
  }
  return rows;
}

/** Same family keys the interop table prints, so the two pages join by name. */
function familyKeyOf(path) {
  if (path.startsWith("base/test-vectors/")) return path.split("/")[2].replace(/\.json$/, "");
  return path.replace(/^base\//, "").replace(/-vectors(-v07)?\.json$/, "").replace(/\.json$/, "");
}

/**
 * The guard, not a comment about the guard. Every row must carry one of the five
 * outcomes, a frozen reason on `not_checked` and no reason anywhere else, and a
 * name no other row already took. build() runs it, and the tests mutate it.
 */
export function validateRows(rows) {
  const names = new Set();
  for (const row of rows) {
    if (!CHECK_OUTCOMES.includes(row.outcome)) throw new Error(`unknown observation outcome: ${row.outcome} (${row.name})`);
    if (row.outcome === "not_checked" && !NOT_CHECKED_REASONS.includes(row.reason)) {
      throw new Error(`not_checked without a frozen reason: ${row.name} (${row.reason})`);
    }
    if (row.outcome !== "not_checked" && row.reason !== null && row.reason !== undefined) {
      throw new Error(`a reason on a finding: ${row.name} (${row.reason})`);
    }
    if (names.has(row.name)) throw new Error(`duplicate observation row: ${row.name}`);
    names.add(row.name);
  }
  return rows.length;
}

function build() {
  const report = runCorpus();
  validateRows(report.observations);
  const bytes = readBytes();
  const families = new Map();
  const row = (key) =>
    families.get(key) ?? {
      key,
      vectors: 0,
      parser: { verified: 0, verification_failed: 0, not_checked: 0, absent: 0, unresolvable_record: 0, reasons: new Set(), events: 0 },
      bytes: { files: 0, verified: 0, verification_failed: 0, absent: 0 },
      kit: { checks: 0, compared: 0, divergences: [] },
    };

  for (const f of report.families) {
    const entry = row(familyKeyOf(f.path));
    entry.vectors += f.vectors;
    families.set(entry.key, entry);
  }
  for (const observation of report.observations) {
    const entry = row(observation.family);
    entry.parser.events += 1;
    entry.parser[observation.outcome] += 1;
    if (observation.reason) entry.parser.reasons.add(observation.reason);
    families.set(entry.key, entry);
  }
  for (const observation of bytes) {
    const entry = row(observation.family);
    entry.bytes.files += 1;
    entry.bytes[observation.outcome] += 1;
    families.set(entry.key, entry);
  }
  for (const [key, kitRow] of Object.entries(report.kitJoin.rows)) {
    const entry = row(key);
    entry.kit.checks += kitRow.checks;
    entry.kit.compared += kitRow.compared;
    entry.kit.divergences.push(...kitRow.divergences);
    families.set(key, entry);
  }

  const rows = [...families.values()].sort((a, b) => b.vectors - a.vectors || a.key.localeCompare(b.key));
  const parserTotals = report.observationTotals;
  const bytesTotals = bytes.reduce(
    (acc, b) => {
      acc.files += 1;
      acc[b.outcome] += 1;
      return acc;
    },
    { files: 0, verified: 0, verification_failed: 0, absent: 0 },
  );
  return {
    report,
    rows,
    bytes,
    parserTotals,
    bytesTotals,
    divergences: rows.flatMap((r) => r.kit.divergences),
    observations: report.observations.map((o) => ({
      name: o.name,
      family: o.family,
      file: o.file,
      observer: o.observer,
      scope: o.scope,
      outcome: o.outcome,
      reason: o.reason,
      detail: o.detail ?? null,
    })),
  };
}

const cell = (counts, order) =>
  order
    .filter(([key]) => counts[key])
    .map(([key, label]) => `${counts[key]} ${label}`)
    .join(" · ") || "—";

function render(report) {
  const { rows, parserTotals, bytesTotals, divergences, report: r } = report;
  const out = [];
  out.push("# AER-1 observation join — the same 143 vectors, read as events");
  out.push("");
  out.push(
    `Kit **${KIT}** · evaluated-set digest \`${SET_DIGEST}\` · ${r.vectorTotal} vectors · observation layer \`${OBSERVATION_VERSION}\` · parser \`${r.parserVersion}\`.`,
  );
  out.push("");
  out.push(
    "Generated by `node scripts/aer1-observation-join.mjs --write`. This is the observation family built on the corpus the interop table already judges: **the same set, the same digest, the same column shape**. The join key is the vector name and the family key, so a column produced on either side can be joined here without a second vocabulary.",
  );
  out.push("");
  out.push(
    "The per-vector rows this page is computed from are committed as [aer1-observation-rows.json](./aer1-observation-rows.json), stable and sorted, so the rows can be run and joined from the other side instead of being re-read out of a screenshot.",
  );
  out.push("");
  out.push("## The two readers, and what each one claims");
  out.push("");
  out.push("| Observer | Scope | One row per | It can say | It cannot say |");
  out.push("|---|---|---|---|---|");
  out.push(
    "| `cg-aer1:parser` | `record:bytes` | vector | what CG-AER1/1 found when it read this vector's bytes, in the five-word vocabulary | whether the fixture was supposed to fail — that is the expectation column, not this one |",
  );
  out.push(
    "| `cg-aer1:bytes` | `file:sha256` | corpus file | whether the bytes on disk are the bytes the set pinned | anything about content, validity or outcomes |",
  );
  out.push("");
  out.push(
    "Both readers are this side's. The reference kit's column is the third reader and it is pinned, not re-run here. None of the three is a claim that the work a record describes happened.",
  );
  out.push("");
  out.push("## Families, joined");
  out.push("");
  out.push("| Family | Vectors | `cg-aer1:parser` | `cg-aer1:bytes` | Reference kit | Divergence |");
  out.push("|---|---|---|---|---|---|");
  for (const row of rows) {
    const parser = cell(row.parser, [
      ["verified", "verified"],
      ["verification_failed", "verification failed"],
      ["unresolvable_record", "unresolvable"],
      ["absent", "absent"],
      ["not_checked", "not checked"],
    ]);
    const reasons = row.parser.not_checked && row.parser.reasons.size ? ` (${[...row.parser.reasons].join(", ")})` : "";
    const bytes = row.bytes.files === 0 ? "—" : `${row.bytes.files} ${row.bytes.files === 1 ? "file" : "files"} · ${cell(row.bytes, [["verified", "verified"], ["verification_failed", "failed"], ["absent", "absent"]])}`;
    const kit = row.kit.checks === 0 ? "—" : `${row.kit.checks} ${row.kit.checks === 1 ? "check" : "checks"}${row.kit.compared ? ` · ${row.kit.compared} compared` : ""}`;
    const divergence = row.kit.compared === 0 ? "— (no per-vector verdict on the kit line)" : row.kit.divergences.length === 0 ? `0 of ${row.kit.compared}` : row.kit.divergences.map((d) => `\`${d.name}\``).join(", ");
    out.push(`| \`${row.key}\` | ${row.vectors} | ${parser}${reasons} | ${bytes} | ${kit} | ${divergence} |`);
  }
  out.push("");
  out.push(
    `Totals: **${parserTotals.events} parser reads** over ${r.vectorTotal} vectors (${parserTotals.verified} \`verified\`, ${parserTotals.verification_failed} \`verification_failed\`, ${parserTotals.unresolvable_record} \`unresolvable_record\`, ${parserTotals.not_checked} \`not_checked\`, ${parserTotals.absent} \`absent\`) and **${bytesTotals.files} file reads** (${bytesTotals.verified} verified, ${bytesTotals.verification_failed} failed, ${bytesTotals.absent} absent).`,
  );
  out.push("");
  out.push("## Why 87 failed reads are not 87 defects");
  out.push("");
  out.push(
    `Every negative construction in the set is built to fail a check, so a reader that reads it correctly reports \`verification_failed\` — ${parserTotals.verification_failed} of the ${parserTotals.events} reads are exactly that, and only ${parserTotals.unresolvable_record + parserTotals.absent + parserTotals.not_checked} are the layer declining to judge at all. The expectation column beside it agrees on ${r.totals.agree} of ${r.vectorTotal} vectors with ${r.totals.falseAccept} false accepts. The observation column records what the reader found; the interop column records whether that finding was the one the corpus built for. Neither column can be read as the other.`,
  );
  out.push("");
  out.push("Every row that is not simply `verified` or `verification_failed` is named, not buried:");
  out.push("");
  const notChecked = report.observations.filter((o) => o.outcome !== "verified" && o.outcome !== "verification_failed");
  if (notChecked.length === 0) {
    out.push("None on this set.");
  } else {
    out.push("| Vector | Outcome | Reason |");
    out.push("|---|---|---|");
    for (const row of notChecked) out.push(`| \`${row.name}\` | \`${row.outcome}\`${row.reason ? ` / \`${row.reason}\`` : ""} | ${row.outcome === "absent" ? "the profile the record would carry is not present" : row.outcome === "unresolvable_record" ? "the record points at an anchor this offline resolver cannot resolve" : "the caller asked not to evaluate (`evaluate: false`)"} |`);
  }
  out.push("");
  out.push("## The five outcomes on this set");
  out.push("");
  out.push("| Outcome | Reads here | What it means when it appears |");
  out.push("|---|---|---|");
  const meaning = {
    verified: "the bytes this reader recomputed matched the claim the record makes — not that the record is valid, and not that the work happened",
    verification_failed: "the reader looked and a check failed; on a negative vector this is the check behaving as designed",
    not_checked: "the reader never claimed this layer, and the reason says which of the six it is",
    absent: "the record carries no anchor profile at all; a Nostr-shaped member is a different record, not a failed anchor",
    unresolvable_record: "the record names an anchor this offline resolver cannot resolve; the resource outcome takes precedence over a wrong leaf",
  };
  for (const outcome of CHECK_OUTCOMES) {
    const count = parserTotals[outcome] ?? 0;
    out.push(`| \`${outcome}\` | ${count} | ${meaning[outcome]} |`);
  }
  out.push("");
  out.push(`The six \`not_checked\` reasons are frozen, and one appears on this set: \`outside_scope\` (${parserTotals.reasons.outside_scope ?? 0} row). A reason is not decoration — \`access_refused\` is re-scope the caller, \`unsupported_family\` and \`schema_not_implemented\` are a build limitation named as such. The other five are exercised with real refusals on [AER1-OBSERVATION-LEDGER.md](./AER1-OBSERVATION-LEDGER.md).`);
  out.push("");

  out.push("## What the join shows, and what it refuses to show");
  out.push("");
  out.push(
    `- The joined verdict column has ${divergences.length === 0 ? "no divergence" : `${divergences.length} divergences`} against the reference kit on ${rows.reduce((n, row) => n + row.kit.compared, 0)} compared vectors. The observation column adds reads; it does not move that number.`,
  );
  out.push(
    "- These rows carry no timestamps. A clock value on a corpus read would be invented, and the layer refuses invented time where it matters: the ledger page exercises the append-order rule with a real backfilled read and a named refusal (`OUT_OF_ORDER`).",
  );
  out.push(
    "- Reading 143 vectors is not 143 runs. The observation layer never turns a read into an execution, and this page states `executions` nowhere because these are fixtures, not runs.",
  );
  out.push(
    "- A row here can say `verified` while the corpus calls the same vector invalid. That is the layer working: `verified` is a property of the bytes a reader recomputed, never of the record's validity.",
  );
  out.push("");
  out.push("## Pins");
  out.push("");
  out.push("| Side | Pin |");
  out.push("|---|---|");
  out.push(`| Corpus | kit ${KIT} · \`${SET_DIGEST}\` · ${r.vectorTotal} vectors · ${r.kitPins.checks} kit checks |`);
  out.push(`| Reference kit run | commit \`${r.kitPins.commit}\` · column \`${r.kitPins.columnSha256}\` |`);
  out.push(`| CG-AER1/1 | parser \`${r.kitPins.parserFile}\` · interop generator \`${r.kitPins.generatorFile}\` |`);
  out.push(`| This generator | \`${sha256(readFileSync(fileURLToPath(import.meta.url)))}\` · layer \`${OBSERVATION_VERSION}\` (${NOT_CHECKED_REASONS.length} frozen reasons, ${CHECK_OUTCOMES.length} outcomes) |`);
  out.push("");
  out.push("## Boundary");
  out.push("");
  out.push(
    "- No conformance claim, and no new vocabulary: every outcome on this page is one of the five the corpus already uses, and every reason is one of the six the ledger froze.",
  );
  out.push(
    "- The observation family is additive by construction. It cannot change a verdict, a false accept or a divergence; it records who read what, when that matters, and why a check did not happen.",
  );
  out.push(
    "- Nothing here observes the world. A matching digest settles what the saved record says, never whether the purchase, delivery or transfer it describes occurred.",
  );
  out.push("");
  return out.join("\n");
}

export { build, render, readBytes, familyKeyOf, OUT, ROWS };

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const mode = process.argv.slice(2)[0] ?? "--print";
  const report = build();
  const rowsFile = `${JSON.stringify(
    {
      format: "aer1-observation-rows/1",
      kit: KIT,
      setDigest: SET_DIGEST,
      vectorTotal: report.report.vectorTotal,
      observationLayer: OBSERVATION_VERSION,
      parser: report.report.parserVersion,
      joinKey: "name",
      rows: report.observations,
      fileReads: report.bytes,
    },
    null,
    2,
  )}\n`;
  if (mode === "--json") {
    process.stdout.write(`${JSON.stringify({ ...report.report, fileReads: report.bytes }, null, 2)}\n`);
  } else if (mode === "--write") {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, render(report));
    writeFileSync(ROWS, rowsFile);
    process.stdout.write(
      `wrote ${OUT} and ${ROWS} — ${report.parserTotals.events} parser reads, ${report.bytesTotals.files} file reads, ${report.divergences.length} divergences\n`,
    );
  } else if (mode === "--check") {
    const pageStale = !existsSync(OUT) || readFileSync(OUT, "utf8") !== render(report);
    const rowsStale = !existsSync(ROWS) || readFileSync(ROWS, "utf8") !== rowsFile;
    if (pageStale || rowsStale) {
      process.stderr.write("docs/AER1-OBSERVATION-JOIN.md or docs/aer1-observation-rows.json is stale — run: node scripts/aer1-observation-join.mjs --write\n");
      process.exit(1);
    }
    process.stdout.write("AER-1 observation join: up to date\n");
  } else {
    process.stdout.write(`${render(report)}\n`);
  }
}
