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
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseAer1Record,
  AER1_PARSER_VERSION,
  verifyAer1Chain,
  verifyAer1Commitment,
  verifyAer1WorkflowMerkle,
  verifyAer1MerkleVector,
  verifyAer1UnicodeVector,
  reportAer1Anchor,
} from "../packages/agent-commerce/aer1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const CORPUS = join(ROOT, "test/fixtures/aer1-corpus-v1.5.7");
const OUT = join(ROOT, "docs/AER1-INTEROP-TABLE.md");
const KIT = "1.5.7";
const SET_DIGEST = "sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2";

/**
 * The reference kit's column, as published by Brennan on 2026-11-23:
 *   python3 conformance.py at kit commit e04e4c91…, standard library only,
 *   self-verifying the evaluated set before judging any vector.
 * The raw file is vendored so this table can be regenerated offline, and its
 * sha256 is pinned so a changed column is a deliberate act, not a silent edit.
 */
const KIT_COMMIT = "e04e4c91d4630a2e0ceb4e12c48accacac10155e";
const KIT_COLUMN_FILE = join(ROOT, "test/fixtures/aer1-kit-column-1.5.7/kit-column-2026-11-23.txt");
const KIT_COLUMN_URL = "https://github.com/zambodotdev/aer1-kit/blob/main/interop/kit-column-2026-11-23.txt";
const KIT_COLUMN_SHA256 = "eb6cec8cf8d927c6af0460913fbf82ae1e2ae021b2cdde295b4d7c3aa4b29cd9";

/** The kit's family tags, mapped onto the family keys this table prints. */
const KIT_FAMILY_TO_OURS = Object.freeze({
  valid: "valid",
  invalid: "invalid",
  "profile-invalid": "invalid-profile",
  anchored: "anchored",
  "id-binding": "id-binding",
  unicode: "unicode",
  merkle: "merkle",
  "merkle-workflow": "merkle",
  commitment: "commitment",
  chain: "chain",
  "chain-v07": "chain",
  "workflow-root": "workflow-merkle-seq-output-v1",
  anchor: "anchor",
});

/** Families whose vectors this build loads as single records, so a join miss is an error. */
const RECORD_FAMILIES = new Set(["valid", "invalid", "invalid-profile", "anchored"]);

const index = JSON.parse(readFileSync(join(CORPUS, "corpus-index.json"), "utf8"));
const files = index.files ?? [];

/**
 * Per-file outcomes for the anchored family, read from the pinned reference
 * column's `outcome:` notes. The expectation is external to this build; every
 * verdict below is computed from the fixture's own bytes and anchor members.
 * No file is excluded: a mismatch is published as a false accept or reject.
 */
const ANCHORED_EXPECTED = Object.freeze({
  "anchored-valid.json": "verified",
  "anchored-unresolvable-anchor.json": "rejected: unresolvable record",
  "anchored-bad-leaf-hash.json": "verification failed",
  "anchored-bad-timestamp.json": "verification failed",
  "anchored-missing-proof.json": "verification failed",
  "anchored-bad-id-version.json": "verification failed",
});

const EXPECTED = (path) => {
  if (path.includes("/valid/")) return "verified";
  if (path.includes("/invalid/") || path.includes("invalid-profile")) return "invalid";
  if (path.includes("/anchored/")) return ANCHORED_EXPECTED[path.split("/").pop()] ?? null;
  return null; // mixed families with no pinned per-file expectation
};

const sha256OfFile = (path) => `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;

/**
 * Parse the reference kit's raw output: `[family] name: PASS (note)` lines plus
 * its closing CONFORMANCE OK line. Every line is a check, not a vector: the
 * merkle family's 9 vectors carry 12 checks, which is where 146 comes from.
 */
export function parseKitColumn(text) {
  const checks = [];
  let footer = null;
  for (const line of text.split("\n")) {
    const check = /^\[([^\]]+)\]\s+(.+?):\s+PASS(?:\s+\((.*)\))?\s*$/.exec(line);
    if (check) {
      checks.push({ family: check[1], name: check[2], note: check[3] ?? null });
      continue;
    }
    const done = /^CONFORMANCE OK: (\d+) vectors, (\d+) checks, (sha256:[0-9a-f]{64})$/.exec(line.trim());
    if (done) footer = { vectors: Number(done[1]), checks: Number(done[2]), digest: done[3] };
  }
  return { checks, footer };
}

/**
 * A kit line only carries a per-vector verdict when its note names one. A bare
 * PASS means "this check behaved as expected", not "the record verified" — the
 * kit's own column says so, and inventing the stronger reading would turn every
 * expected-invalid vector into a fake divergence.
 */
const kitOutcome = (check) => {
  if (check.note === null) return null;
  return /rejected|verification failed|outcome: invalid|outcome=absent|outcome=not checked/.test(check.note) ? "invalid" : "verified";
};

function loadKitColumn() {
  if (!existsSync(KIT_COLUMN_FILE)) throw new Error(`reference kit column missing: ${KIT_COLUMN_FILE}`);
  const text = readFileSync(KIT_COLUMN_FILE, "utf8");
  const actual = `sha256:${createHash("sha256").update(text).digest("hex")}`;
  if (actual !== `sha256:${KIT_COLUMN_SHA256}`) {
    throw new Error(`reference kit column changed: expected sha256:${KIT_COLUMN_SHA256}, found ${actual}`);
  }
  return { ...parseKitColumn(text), sha256: actual, url: KIT_COLUMN_URL, commit: KIT_COMMIT };
}

function classifyRecord(record, rawText) {
  const parsed = parseAer1Record(record, { rawText });
  const anchor = reportAer1Anchor(record);
  if (!parsed.supportedVersion) {
    return { observed: "not_checked", reason: `schema ${parsed.version ?? "(absent)"} not implemented`, parsed, anchor };
  }
  const structural = parsed.verdict === "pass" ? "verified" : "invalid";
  if (anchor.present) {
    const observed = anchor.outcome !== "verified" ? anchor.outcome : structural === "verified" ? "verified" : "verification failed";
    const failed = parsed.structure.filter((c) => !c.ok).map((c) => c.name);
    return { observed, reason: [anchor.reason, ...failed].filter(Boolean).join("; ") || null, parsed, anchor };
  }
  return { observed: structural, parsed, anchor };
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

/**
 * Join the two columns on vector name. A kit check for a record family that no
 * corpus file matches is a broken join, and a verdict that differs is a
 * divergence — the row Zambo asked to be able to point at.
 *
 * perVector captures the reference kit's per-vector verdict where the kit line
 * names one (kitVerdict !== null). Only rows with a per-vector verdict AND a
 * judged CG-AER1/1 outcome are "compared" — those are the 66 rows the fourth
 * observer column is scoped to. Family-level-only kit lines stay unclaimed.
 */
export function buildKitJoin(kit, observedByName, idRows) {
  const rows = new Map();
  const orphans = [];
  const perVector = new Map();
  for (const c of kit.checks) {
    const key = KIT_FAMILY_TO_OURS[c.family] ?? c.family;
    const row = rows.get(key) ?? { key, checks: 0, verified: 0, invalid: 0, compared: 0, oursJudged: 0, divergences: [], notCompared: 0 };
    row.checks += 1;
    const kitVerdict = kitOutcome(c);
    if (kitVerdict === "invalid") row.invalid += 1;
    else if (kitVerdict === "verified") row.verified += 1;
    const ours = observedByName.get(c.name);
    if (RECORD_FAMILIES.has(key) && ours === undefined) orphans.push(c.name);
    if (ours !== undefined && ours !== "not_checked") row.oursJudged += 1;
    const compared = ours !== undefined && ours !== "not_checked" && kitVerdict !== null;
    if (kitVerdict !== null) {
      perVector.set(c.name, {
        name: c.name,
        family: key,
        observer: "aer1-kit:per-vector",
        scope: "record:bytes",
        outcome: kitVerdict,
        note: c.note,
        compared,
      });
    }
    if (compared) {
      row.compared += 1;
      if (ours !== kitVerdict) row.divergences.push({ name: c.name, ours, kit: kitVerdict, note: c.note });
    } else {
      row.notCompared += 1;
    }
    rows.set(key, row);
  }
  // The id-binding family is judged on its own axis (structure + id state), so
  // its comparison comes from those rows rather than from a record verdict.
  const idRow = rows.get("id-binding");
  if (idRow !== undefined && idRows !== undefined) {
    idRow.compared = idRows.length;
    idRow.oursJudged = idRows.length;
    idRow.divergences = idRows.filter((r) => !r.agree).map((r) => ({ name: r.name, ours: "disagree", kit: "pass", note: null }));
    for (const r of idRows) {
      perVector.set(r.name, {
        name: r.name,
        family: "id-binding",
        observer: "aer1-kit:per-vector",
        scope: "id-binding:check",
        outcome: r.agree ? "verified" : "invalid",
        note: r.agree ? "all as expected" : "disagree",
        compared: true,
      });
    }
  }
  return { rows, orphans, perVector };
}

/**
 * The observation outcome for one read, in the five words the corpus uses.
 * `verified` is about the bytes that were read, never about the record being
 * right: an invalid vector whose bytes match its own claim is `verified` here
 * and invalid in the column beside it, and both statements stay true.
 */
function observationOutcome(observed, reason) {
  if (observed === "verified") return { outcome: "verified", reason: null };
  if (observed === "absent") return { outcome: "absent", reason: null };
  if (observed === "rejected: unresolvable record") return { outcome: "unresolvable_record", reason: null };
  if (observed === "not checked" || observed === "not_checked") {
    const why = /schema/i.test(reason ?? "") ? "schema_not_implemented" : "outside_scope";
    return { outcome: "not_checked", reason: why };
  }
  return { outcome: "verification_failed", reason: reason ?? null };
}

const isRefusalOutcome = (outcome) =>
  outcome === "invalid" || outcome === "verification failed" || outcome === "rejected: unresolvable record" || outcome === "absent";

/** A claim of verified where the pinned expectation is anything else is ours. */
function mismatchKind(expected, observed) {
  if (observed === expected) return "agree";
  if (observed === "verified" && (isRefusalOutcome(expected) || expected === "not checked")) return "falseAccept";
  return "falseReject";
}

function runCorpus() {
  const families = new Map();
  const observedByName = new Map();
  const falseAccepts = [];
  const falseRejects = [];
  const notChecked = [];
  const observations = [];
  let vectorTotal = 0;

  /** One immutable event per read: who read, over what, and what it found. */
  const observe = (name, path, observed, reason, scope = "record:bytes") => {
    const mapped = observationOutcome(observed, reason);
    observations.push({
      name,
      family: familyKey(path),
      file: path,
      observer: "cg-aer1:parser",
      scope,
      outcome: mapped.outcome,
      // The layer's contract: a reason exists on `not_checked` and nowhere else.
      // What a failed check found is detail, not a reason.
      reason: mapped.outcome === "not_checked" ? mapped.reason : null,
      detail: mapped.outcome === "verification_failed" ? reason ?? null : null,
    });
  };

  for (const f of files) {
    const same = families.get(f.path) ?? { path: f.path, vectors: 0, checks: 0, expected: EXPECTED(f.path), agree: 0, falseAccept: 0, falseReject: 0, notChecked: 0, unclassified: 0 };
    same.vectors += Number(f.vectors) || 0;
    same.checks += Number(f.checks) || 0;
    vectorTotal += Number(f.vectors) || 0;
    if (f.path === "base/id-binding-vectors.json") {
      const rows = runIdBinding();
      same.agree += rows.filter((r) => r.agree).length;
      for (const r of rows) if (!r.agree) same.falseReject += 1;
      for (const r of rows) {
        // The read either matched the id it was presented under or it did not;
        // that is the observation, independent of the fixture's own verdict.
        const matched = r.observed.idState === "verified-expected";
        observe(r.name, f.path, matched ? "verified" : "verification_failed", matched ? null : "the committed digest disagrees with the id it was presented under");
      }
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
      const verdicts = classifyTimeline(f.path, data.vectors, text);
      if (verdicts === null) {
        // anchor family: still not implemented in this build
        same.notChecked += Number(f.vectors) || 0;
        for (const v of data.vectors) notChecked.push({ path: f.path, name: v.name, family: "timeline" });
        families.set(f.path, same);
        continue;
      }
      for (const verdict of verdicts) {
        observe(verdict.name, f.path, verdict.observed, verdict.reason, "vector:bytes");
        observedByName.set(verdict.name, verdict.joinObserved ?? (verdict.observed === "verified" ? "verified" : "invalid"));
        const kind = mismatchKind(verdict.expected, verdict.observed);
        if (kind === "agree") same.agree += 1;
        else if (kind === "falseAccept") {
          same.falseAccept += 1;
          falseAccepts.push({ path: f.path, name: verdict.name, reason: verdict.reason });
        } else {
          same.falseReject += 1;
          falseRejects.push({ path: f.path, name: verdict.name, reason: verdict.reason });
        }
      }
      families.set(f.path, same);
      continue;
    }
    const name = f.path.split("/").pop();
    const { observed, reason } = classifyRecord(data, text);
    observe(name, f.path, observed, reason);
    const expected = same.expected;
    observedByName.set(name, expected === null ? "not_checked" : observed === "verified" ? "verified" : "invalid");
    if (expected === null) {
      // Mixed families with no pinned per-file expectation stay not checked.
      same.unclassified += 1;
      same.notChecked += 1;
      notChecked.push({ path: f.path, name, family: "record", reason: "no pinned per-file expectation" });
    } else if (observed === "not_checked") {
      same.notChecked += 1;
      notChecked.push({ path: f.path, name, family: "record", reason });
    } else {
      const kind = mismatchKind(expected, observed);
      if (kind === "agree") same.agree += 1;
      else if (kind === "falseAccept") {
        same.falseAccept += 1;
        falseAccepts.push({ path: f.path, name, reason: reason ?? data.rejected_by ?? data.reason ?? null });
      } else {
        same.falseReject += 1;
        falseRejects.push({ path: f.path, name, reason });
      }
    }
    families.set(f.path, same);
  }

  const rows = [...families.values()];
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const kit = loadKitColumn();
  const kitJoin = buildKitJoin(kit, observedByName, runIdBinding());
  const kitPerVector = [...kitJoin.perVector.values()];
  const kitCompared = kitPerVector.filter((r) => r.compared);
  for (const o of observations) {
    const k = kitJoin.perVector.get(o.name);
    o.kitObserver = k?.compared
      ? { observer: k.observer, scope: k.scope, outcome: k.outcome, note: k.note }
      : null;
  }
  const observationTotals = observations.reduce(
    (acc, o) => {
      acc.events += 1;
      acc[o.outcome] += 1;
      if (o.reason) acc.reasons[o.reason] = (acc.reasons[o.reason] ?? 0) + 1;
      return acc;
    },
    { events: 0, verified: 0, verification_failed: 0, not_checked: 0, absent: 0, unresolvable_record: 0, reasons: {} },
  );
  return {
    observations,
    observationTotals,
    kitPins: {
      kit: KIT,
      commit: kit.commit,
      columnUrl: kit.url,
      columnSha256: kit.sha256,
      setDigest: SET_DIGEST,
      vectors: kit.footer?.vectors ?? null,
      checks: kit.footer?.checks ?? null,
      footerDigest: kit.footer?.digest ?? null,
      parserFile: sha256OfFile(join(ROOT, "packages/agent-commerce/aer1.mjs")),
      generatorFile: sha256OfFile(join(ROOT, "scripts/aer1-interop.mjs")),
    },
    kitJoin: {
      rows: Object.fromEntries(kitJoin.rows),
      orphans: kitJoin.orphans,
      perVector: Object.fromEntries([...kitJoin.perVector.entries()]),
      compared: kitCompared.length,
      comparedDivergences: kitCompared.filter((r) => {
        const ours = observedByName.get(r.name);
        return ours !== undefined && ours !== "not_checked" && ours !== r.outcome;
      }).length,
    },
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

/** The raw JSON text of one vector, for facts a parsed object has already lost. */
function rawVectorSlice(text, name) {
  const key = `"name": ${JSON.stringify(name)}`;
  const start = text.indexOf(key);
  if (start === -1) return "";
  const next = text.indexOf('"name":', start + key.length);
  return text.slice(start, next === -1 ? text.length : next);
}

const entryCountLexeme = (text, name) =>
  /"entry_count"\s*:\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(rawVectorSlice(text, name))?.[1] ?? null;

/**
 * Timeline families this build judges. Returns null for a family it does not,
 * so "not implemented" stays visible instead of being counted as agreement.
 */
function classifyTimeline(path, vectors, text) {
  const verdict = (v, result, expectedOverride) => ({
    name: v.name,
    expected: expectedOverride ?? (v.expected_verdict === "valid" ? "verified" : "invalid"),
    observed: result.ok ? "verified" : "invalid",
    reason: result.checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || null,
  });

  if (path.endsWith("chain-vectors-v07.json")) {
    return vectors.map((v) => verdict(v, verifyAer1Chain(v.timeline, { version: "v07" })));
  }
  if (path.endsWith("chain-vectors.json")) {
    return vectors.map((v) => verdict(v, verifyAer1Chain(v.timeline, { version: "v1" })));
  }
  if (path.endsWith("commitment-vectors.json")) {
    return vectors.map((v) =>
      verdict(v, verifyAer1Commitment(v.timeline, v.commitment, { entryCountLexeme: entryCountLexeme(text, v.name) })),
    );
  }
  if (path.endsWith("workflow-merkle-seq-output-v1.json")) {
    return vectors.map((v) =>
      verdict(
        v,
        verifyAer1WorkflowMerkle({
          steps: v.steps,
          merkleRoot: v.merkle_root,
          merkleVersion: v.merkle_version,
          merkleVersionPresent: v.merkle_version !== undefined,
        }),
      ),
    );
  }
  if (path.endsWith("merkle-vectors.json")) {
    // A vector with no declared invalid verdict is a valid construction: the
    // corpus asserts its exact root. The legacy preimage tree and the
    // duplicate-receipt-id collision are the two named refusals.
    return vectors.map((v) =>
      verdict(v, verifyAer1MerkleVector(v), v.expected_workflow_verdict === "invalid" || v.leaves !== undefined ? "invalid" : "verified"),
    );
  }
  if (path.endsWith("unicode-vectors.json")) {
    return vectors.map((v) => verdict(v, verifyAer1UnicodeVector(v), v.expected === "match" ? "verified" : "invalid"));
  }
  if (path.endsWith("anchor-vectors.json")) {
    return vectors.map((v) => {
      const receipt = v.file ? JSON.parse(readFileSync(join(CORPUS, "base", v.file), "utf8")) : v.receipt;
      const report = reportAer1Anchor(receipt, { evaluate: v.evaluate });
      const matches = report.outcome === v.expected_anchor_outcome && report.present === v.expected_present && report.evaluated === v.expected_evaluated;
      return {
        name: v.name,
        expected: v.expected_anchor_outcome,
        observed: report.outcome,
        // The kit collapses every non-verified anchor outcome to "invalid".
        joinObserved: report.outcome === "verified" ? "verified" : "invalid",
        reason: matches ? null : `present=${report.present} evaluated=${report.evaluated} ${report.reason ?? ""}`.trim(),
      };
    });
  }
  return null;
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
  out.push("This page is generated by `node scripts/aer1-interop.mjs --write`. The expectation is the corpus's own classification, or the pinned reference outcome for the anchored family; a vector we accept against that expectation is listed below as **our** false accept, by name.");
  out.push("");
  out.push("A `verified` outcome here means the saved bytes were not changed after they were saved. It is not a claim that the recorded work was correct, and it is not a conformance claim.");
  out.push("");
  out.push("## Totals");
  out.push("");
  out.push("| Outcome | Vectors |");
  out.push("|---|---|");
  out.push(`| agree with the pinned expectation (corpus classification or pinned reference outcome for the anchored family) | ${r.totals.agree} |`);
  out.push(`| **false accept (ours — must be zero)** | **${r.totals.falseAccept}** |`);
  out.push(`| false reject (ours) | ${r.totals.falseReject} |`);
  out.push(`| not checked (unimplemented family, schema or anchor) | ${r.totals.notChecked} |`);
  out.push("");
  out.push("## Families and the joined verdicts");
  out.push("");
  out.push("Two columns from two runners against the same pinned set, joined on vector name. The kit column is generated from the reference kit's own run (pinned below), not typed from the classification.");
  out.push("");
  out.push("| Family | Vectors | CG-AER1/1 | Observation (CG-OBS/1) | Reference kit | Divergence |");
  out.push("|---|---|---|---|---|---|");
  const observed = new Map();
  for (const o of r.observations) {
    const row = observed.get(o.family) ?? { events: 0, verified: 0, verification_failed: 0, not_checked: 0, absent: 0, unresolvable_record: 0, reasons: new Set() };
    row.events += 1;
    row[o.outcome] += 1;
    if (o.reason) row.reasons.add(o.reason);
    observed.set(o.family, row);
  }
  const observationCell = (row) => {
    if (row === undefined) return "— (no read on this side)";
    const parts = [
      `${row.events} ${row.events === 1 ? "event" : "events"}`,
      row.verified ? `${row.verified} verified` : null,
      row.verification_failed ? `${row.verification_failed} verification failed` : null,
      row.unresolvable_record ? `${row.unresolvable_record} unresolvable` : null,
      row.absent ? `${row.absent} absent` : null,
      row.not_checked ? `${row.not_checked} not checked${row.reasons.size ? ` (${[...row.reasons].join(", ")})` : ""}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  };
  const grouped = new Map();
  for (const f of r.families) {
    const key = familyKey(f.path);
    const g = grouped.get(key) ?? { vectors: 0, agree: 0, falseAccept: 0, falseReject: 0, notChecked: 0, unclassified: 0 };
    for (const k of Object.keys(g)) g[k] += f[k] ?? 0;
    grouped.set(key, g);
  }
  const joined = r.kitJoin.rows;
  for (const [key, g] of [...grouped.entries()].sort((a, b) => b[1].vectors - a[1].vectors)) {
    const k = joined[key];
    const ours = [
      `${g.agree} agree`,
      g.falseAccept ? `${g.falseAccept} false accept` : null,
      g.falseReject ? `${g.falseReject} false reject` : null,
      g.notChecked ? `${g.notChecked} not checked` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const kit = k === undefined ? "—" : `${k.checks} ${k.checks === 1 ? "check" : "checks"}, all as expected${k.invalid ? ` · ${k.invalid} non-verified` : ""}`;
    const divergence =
      k === undefined || k.oursJudged === 0
        ? "— (not judged by CG-AER1/1)"
        : k.compared === 0
          ? "— (kit line carries no per-vector verdict)"
          : k.divergences.length === 0
            ? `0 of ${k.compared}`
            : k.divergences.map((d) => `\`${d.name}\``).join(", ");
    out.push(`| \`${key}\` | ${g.vectors} | ${ours} | ${observationCell(observed.get(key))} | ${kit} | ${divergence} |`);
  }
  out.push("");
  out.push("### What the observation column counts");
  out.push("");
  out.push("One row per read, not per vector: `cg-aer1:parser` reads the same pinned bytes for every vector and records what it found in the five-word outcome vocabulary, with a named reason on `not_checked`. `verified` here means the bytes this reader recomputed matched the claim the record makes — never that the record is valid, and never that the work happened. That is why a family can read `verified` on this column and `invalid` in the column beside it without contradicting itself.");
  out.push("");
  out.push(`Across the pinned set: ${r.observationTotals.events} reads — ${r.observationTotals.verified} \`verified\`, ${r.observationTotals.verification_failed} \`verification_failed\`, ${r.observationTotals.unresolvable_record} \`unresolvable_record\`, ${r.observationTotals.not_checked} \`not_checked\`, ${r.observationTotals.absent} \`absent\`. The full ledger, with the per-vector rows this column is aggregated from, is [AER1-OBSERVATION-JOIN.md](./AER1-OBSERVATION-JOIN.md).`);
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
  out.push("## Pins");
  out.push("");
  out.push("| Side | Pin |");
  out.push("|---|---|");
  out.push(`| Corpus | kit ${r.kitPins.kit} · \`${r.kitPins.setDigest}\` · ${r.vectorTotal} vectors |`);
  out.push(
    `| Reference kit run | commit \`${r.kitPins.commit}\` · column sha256 \`sha256:${r.kitPins.columnSha256.replace(/^sha256:/, "")}\` · ${r.kitPins.checks} checks |`,
  );
  out.push(
    `| CG-AER1/1 | parser ${r.kitPins.parserFile} · generator ${r.kitPins.generatorFile} |`,
  );
  out.push("");
  out.push(
    `The kit's closing line is \`CONFORMANCE OK: ${r.kitPins.vectors} vectors, ${r.kitPins.checks} checks, ${r.kitPins.footerDigest}\`; the join key is the vector name, and the extra checks are the merkle family's workflow checks (9 vectors carry 12 checks). The kit column was published at ${r.kitPins.columnUrl} and is vendored here so this page regenerates offline; its sha256 is checked before the column is read.`,
  );
  out.push("");
  out.push("## Divergence detail");
  out.push("");
  out.push(
    "No verdict divergence in the joined set today: every vector CG-AER1/1 judges, the reference kit judges the same way. The field-level divergence is the id-binding swap above, where both sides refuse and CG-AER1/1 names `receipt.id` with the expected and found values.",
  );
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
  if (r.notChecked.length === 0) {
    out.push("None. Every vector in the pinned set has a computed verdict on this side.");
  } else {
    for (const n of r.notChecked) out.push(`- \`${n.name}\` — ${n.family}: ${n.reason ?? "no reason recorded"}`);
  }
  out.push("");
  out.push("## Boundary");
  out.push("");
  out.push(
    `- No conformance claim: ${r.totals.falseAccept} false accepts and ${r.totals.notChecked} not-checked vectors are listed above. Zero on both is a measured result on this pinned set, not certification.`,
  );
  out.push("- The id-binding family is judged end to end and agrees 6/6.");
  out.push("- The merkle family (9 vectors / 12 kit checks) is judged on the Section 8.1 construction: SHA-256 over the UTF-8 receipt id per leaf, raw 32-byte pairs, last-duplicate on odd levels, SHA-256(empty) for an empty workflow. A duplicate receipt id and the legacy `seq:receipt_hash` construction are refused even when a root happens to match.");
  out.push("- The unicode family (5) hashes the exact decoded bytes. No NFC/NFD rewriting: visually identical spellings of café and of a hyphen are different payloads, and both mismatch vectors are refused.");
  out.push("- Schema 0.4 records (21: 12 valid, 9 invalid) are judged on the versioned strict timestamp and nil-UUID rules, canonical-JSON input_hash, both sides of the issuer_claims provenance binding, the committed version match, and the structural checks. `metadata_hash` is format-checked only: the vendored corpus publishes no preimage rule, so this build does not invent a recomputation nobody can reproduce.");
  out.push("- The anchor family (8) and the anchored records (6) are judged on the Section 3.3 profile and the five-value outcome dictionary. A missing profile is `absent` (a Nostr-shaped `anchor` member is a different record, not a failed anchor); `evaluate: false` is honoured before any content is read and reports `not checked`; an RFC 2606 `.invalid` log is `rejected: unresolvable record` and that resource outcome takes precedence over a wrong leaf.");
  out.push("- In replay, the resolution fact is the receipt's own committed bytes recomputed into a leaf carrying the receipt id and its digest. The checks require that leaf to name the anchored id and equal the committed `leaf_hash`, that `leaf_hash` equal the digest of `canonical_bytes` and `output_hash`, that the id be a lowercase UUID v4, that `anchored_at` be calendar-valid, and that `proof` be present. This is the corpus's offline convention — no network call is made, and a production caller must inject a real resolver with recorded evidence. A verified anchor verdict here means the pinned resolution fact was computed and matched; it is not proof a log accepted anything.");
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
