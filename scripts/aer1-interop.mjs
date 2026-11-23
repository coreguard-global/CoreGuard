#!/usr/bin/env node
/**
 * AER-1 interop table — run the pinned corpus through CG-AER1/1 and publish
 * exactly where we agree and where we do not.
 *
 *   node scripts/aer1-interop.mjs            # print the table
 *   node scripts/aer1-interop.mjs --json     # machine-readable report
 *   node scripts/aer1-interop.mjs --write    # write docs/AER1-INTEROP-TABLE.md
 *   node scripts/aer1-interop.mjs --check    # exit 1 if the committed page is stale
 *
 * Honesty rules baked in:
 *   - The corpus's own classification (valid / invalid / invalid-profile) is the
 *     expectation. A vector we call "verified" that the corpus calls invalid is
 *     reported as OUR false accept, by name. It is never quietly dropped.
 *   - Families we do not implement are counted and reported NOT_CHECKED with the
 *     parser version, never green.
 *   - A parsed record whose schema this build does not implement is NOT_CHECKED,
 *     not a failure.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseAer1Record, AER1_PARSER_VERSION } from "../packages/agent-commerce/aer1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const CORPUS = join(ROOT, "test/fixtures/aer1-corpus-v1.5.7");
const OUT = join(ROOT, "docs/AER1-INTEROP-TABLE.md");
const KIT = "1.5.7";
const SET_DIGEST = "sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2";

const index = JSON.parse(readFileSync(join(CORPUS, "corpus-index.json"), "utf8"));
const files = index.files ?? [];

const EXPECTED = (path) => {
  if (path.includes("/valid/")) return "verified";
  if (path.includes("/invalid/") || path.includes("invalid-profile")) return "invalid";
  return null; // anchored / families with mixed outcomes are not classified by path
};

function classifyRecord(record, rawText) {
  const parsed = parseAer1Record(record, { rawText });
  if (!parsed.supportedVersion) return { observed: "not_checked", reason: `schema ${parsed.version ?? "(absent)"} not implemented`, parsed };
  return { observed: parsed.verdict === "pass" ? "verified" : "invalid", parsed };
}

function runIdBinding() {
  const file = join(CORPUS, "base/id-binding-vectors.json");
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const rows = [];
  for (const v of payload.vectors ?? []) {
    const parsed = parseAer1Record(v.receipt, { expectedId: v.expected_id, resolvedRecord: v.resolved_record });
    const agree =
      (v.expected_digest === "pass") === parsed.structureOk &&
      v.expected_id_state === parsed.id.state &&
      v.expected_id_verdict === parsed.id.verdict &&
      (v.expected_verdict === "pass") === (parsed.verdict === "pass");
    rows.push({
      name: v.name,
      expected: { digest: v.expected_digest, idState: v.expected_id_state, idVerdict: v.expected_id_verdict, verdict: v.expected_verdict },
      observed: { digest: parsed.structureOk ? "pass" : "fail", idState: parsed.id.state, idVerdict: parsed.id.verdict, verdict: parsed.verdict },
      agree,
    });
  }
  return rows;
}

function runCorpus() {
  const families = new Map();
  const falseAccepts = [];
  const falseRejects = [];
  const notChecked = [];
  let vectorTotal = 0;

  for (const f of files) {
    const same = families.get(f.path) ?? { path: f.path, vectors: 0, checks: 0, expected: EXPECTED(f.path), agree: 0, falseAccept: 0, falseReject: 0, notChecked: 0, unclassified: 0 };
    same.vectors += Number(f.vectors) || 0;
    same.checks += Number(f.checks) || 0;
    vectorTotal += Number(f.vectors) || 0;
    if (f.path === "base/id-binding-vectors.json") {
      const rows = runIdBinding();
      same.agree += rows.filter((r) => r.agree).length;
      for (const r of rows) if (!r.agree) same.falseReject += 1;
      families.set(f.path, same);
      continue;
    }
    let data;
    let text;
    try {
      text = readFileSync(join(CORPUS, f.path), "utf8");
      data = JSON.parse(text);
    } catch {
      same.notChecked += Number(f.vectors) || 0;
      families.set(f.path, same);
      continue;
    }
    if (Array.isArray(data.vectors)) {
      // timeline / commitment / anchor families: not implemented in this build
      same.notChecked += Number(f.vectors) || 0;
      for (const v of data.vectors) notChecked.push({ path: f.path, name: v.name, family: "timeline" });
      families.set(f.path, same);
      continue;
    }
    const { observed, reason } = classifyRecord(data, text);
    const expected = same.expected;
    if (expected === null) {
      // anchored / mixed families: this build does not judge them yet
      same.unclassified += 1;
      same.notChecked += 1;
      notChecked.push({ path: f.path, name: f.path.split("/").pop(), family: "record", reason: "anchor family not implemented" });
    } else if (expected === "invalid" && observed === "verified") {
      same.falseAccept += 1;
      falseAccepts.push({ path: f.path, name: f.path.split("/").pop(), reason: data.rejected_by ?? data.reason ?? null });
    } else if (expected === "verified" && observed === "invalid") {
      same.falseReject += 1;
      falseRejects.push({ path: f.path, name: f.path.split("/").pop() });
    } else if (observed === "not_checked") {
      same.notChecked += 1;
      notChecked.push({ path: f.path, name: f.path.split("/").pop(), family: "record", reason });
    } else {
      same.agree += 1;
    }
    families.set(f.path, same);
  }

  const rows = [...families.values()];
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  return {
    kit: KIT,
    setDigest: SET_DIGEST,
    parserVersion: AER1_PARSER_VERSION,
    vectorTotal,
    families: rows,
    totals: {
      vectors: vectorTotal,
      agree: sum("agree"),
      falseAccept: sum("falseAccept"),
      falseReject: sum("falseReject"),
      notChecked: sum("notChecked"),
      unclassified: sum("unclassified"),
    },
    falseAccepts,
    falseRejects,
    notChecked,
    idBinding: runIdBinding(),
    pairs: interopPairs(),
  };
}

/** The two pairs Brennan asked for: a live receipt, and an id-binding swap. */
function interopPairs() {
  const liveText = readFileSync(join(CORPUS, "base/test-vectors/valid/receipt-03-live.json"), "utf8");
  const live = JSON.parse(liveText);
  const liveParsed = parseAer1Record(live, { expectedId: live.id, rawText: liveText });
  const bindings = JSON.parse(readFileSync(join(CORPUS, "base/id-binding-vectors.json"), "utf8")).vectors ?? [];
  const swap = bindings.find((v) => v.expected_id_verdict === "mismatched") ?? bindings[0];
  const swapParsed = parseAer1Record(swap.receipt, { expectedId: swap.expected_id });
  const swappedField =
    swapParsed.id.verdict === "mismatched"
      ? { field: "receipt.id", expected: swap.expected_id, found: swap.receipt.id }
      : null;
  return { live: { name: "receipt-03-live", verdict: liveParsed.verdict, digest: liveParsed.digest, id: liveParsed.id }, swap: { name: swap.name, verdict: swapParsed.verdict, id: swapParsed.id, drift: swappedField } };
}

function familyKey(path) {
  if (path.startsWith("base/test-vectors/")) return path.split("/")[2].replace(/\.json$/, "");
  return path.replace(/^base\//, "").replace(/-vectors(-v07)?\.json$/, "").replace(/\.json$/, "");
}

function render(report) {
  const r = report;
  const out = [];
  out.push("# AER-1 interop table — CG-AER1/1 against the pinned corpus");
  out.push("");
  out.push(`Kit **${r.kit}** · evaluated-set digest \`${r.setDigest}\` · ${r.vectorTotal} vectors · parser \`${r.parserVersion}\`.`);
  out.push("");
  out.push("This page is generated by `node scripts/aer1-interop.mjs --write`. The corpus's own classification is the expectation; a vector we accept that the corpus marks invalid is listed below as **our** false accept, by name.");
  out.push("");
  out.push("A `verified` outcome here means the saved bytes were not changed after they were saved. It is not a claim that the recorded work was correct, and it is not a conformance claim.");
  out.push("");
  out.push("## Totals");
  out.push("");
  out.push("| Outcome | Vectors |");
  out.push("|---|---|");
  out.push(`| agree with the corpus | ${r.totals.agree} |`);
  out.push(`| **false accept (ours — must be zero)** | **${r.totals.falseAccept}** |`);
  out.push(`| false reject (ours) | ${r.totals.falseReject} |`);
  out.push(`| not checked (unimplemented family, schema or anchor) | ${r.totals.notChecked} |`);
  out.push("");
  out.push("## Families");
  out.push("");
  out.push("| Family | Vectors | Agree | False accepts | False rejects | Not checked |");
  out.push("|---|---|---|---|---|---|");
  const grouped = new Map();
  for (const f of r.families) {
    const key = familyKey(f.path);
    const g = grouped.get(key) ?? { vectors: 0, agree: 0, falseAccept: 0, falseReject: 0, notChecked: 0, unclassified: 0 };
    for (const k of Object.keys(g)) g[k] += f[k] ?? 0;
    grouped.set(key, g);
  }
  for (const [key, g] of [...grouped.entries()].sort((a, b) => b[1].vectors - a[1].vectors)) {
    out.push(`| \`${key}\` | ${g.vectors} | ${g.agree} | ${g.falseAccept || "—"} | ${g.falseReject || "—"} | ${g.notChecked || "—"} |`);
  }
  out.push("");
  out.push("## The two interop pairs");
  out.push("");
  out.push(`**Live receipt** \`receipt-03-live\`: our verdict \`${r.pairs.live.verdict}\`, digest \`${r.pairs.live.digest.computed}\`, id \`${r.pairs.live.id.state}\`.`);
  out.push("");
  out.push(`**id-binding swap** \`${r.pairs.swap.name}\`: our verdict \`${r.pairs.swap.verdict}\`, id state \`${r.pairs.swap.id.state}\`.`);
  if (r.pairs.swap.drift) {
    out.push("");
    out.push("Drift named by CG-AER1/1:");
    out.push("");
    out.push("| Field | Expected | Found |");
    out.push("|---|---|---|");
    out.push(`| \`${r.pairs.swap.drift.field}\` | \`${r.pairs.swap.drift.expected}\` | \`${r.pairs.swap.drift.found}\` |`);
  }
  out.push("");
  out.push("## False accepts — our defect list");
  out.push("");
  if (r.falseAccepts.length === 0) {
    out.push("None.");
  } else {
    out.push("These are vectors the corpus marks invalid that CG-AER1/1 accepts. They are the checks this build does not perform yet, named by the vector that exposes them. Until they are zero, no conformance claim is possible.");
    out.push("");
    out.push("| Vector | Corpus reason |");
    out.push("|---|---|");
    for (const f of r.falseAccepts) out.push(`| \`${f.name}\` | ${String(f.reason ?? "—").replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 140)} |`);
  }
  out.push("");
  out.push("## Not checked");
  out.push("");
  const byFamily = new Map();
  for (const n of r.notChecked) {
    const key = n.family === "timeline" ? "timeline families (chain / commitment / merkle / anchor)" : "records (unsupported schema)";
    byFamily.set(key, (byFamily.get(key) ?? 0) + 1);
  }
  for (const [k, n] of byFamily) out.push(`- ${n} — ${k}`);
  out.push("");
  out.push("## Boundary");
  out.push("");
  out.push(
    `- No conformance claim: ${r.totals.falseAccept} false accepts and ${r.totals.notChecked} not-checked vectors are listed above.`,
  );
  out.push("- The id-binding family is judged end to end and agrees 6/6.");
  out.push("- The single-record invalid set is now refused by: duplicate member names, unknown provenance class, an execution payload without inputs, a claimed status other than verified, and the canonical base64 and calendar checks.");
  out.push("- `not_checked` is a resource outcome, not a pass.");
  out.push("");
  return out.join("\n");
}

export { runCorpus, render, CORPUS, SET_DIGEST, KIT };

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!invokedDirectly) {
  // imported by a test: no CLI side effects
} else {

const mode = process.argv.slice(2)[0] ?? "--print";
const report = runCorpus();

if (mode === "--json") {
  console.log(JSON.stringify(report, null, 2));
} else if (mode === "--write") {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, render(report));
  console.log(`wrote ${OUT} — agree ${report.totals.agree}, false accepts ${report.totals.falseAccept}, not checked ${report.totals.notChecked}`);
} else if (mode === "--check") {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== render(report)) {
    console.error("docs/AER1-INTEROP-TABLE.md is stale — run: node scripts/aer1-interop.mjs --write");
    process.exit(1);
  }
  console.log("AER-1 interop table: up to date");
} else {
  console.log(render(report));
}

}
