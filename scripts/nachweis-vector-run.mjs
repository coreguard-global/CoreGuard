#!/usr/bin/env node
/**
 * Runs a profile vector: apply each case's edit, resolve the export, compare
 * the result with the expected codes. No network, no files written.
 *
 *   node scripts/nachweis-vector-run.mjs [path-to-vectors.json]
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { resolveNachweisExport } from "../packages/agent-commerce/profiles/nachweis-v1.mjs";

const DEFAULT_PATH = new URL("../test/fixtures/profiles/nachweis-v1.vectors.json", import.meta.url);

export function applyEdit(exportDoc, edit) {
  const copy = structuredClone(exportDoc);
  if (!edit) return copy;
  const records = copy.records;
  if (!Array.isArray(records)) throw new Error("export has no records array");
  const record = records.find((r) => r.kind === edit.record);
  if (!record) throw new Error(`no record with kind ${edit.record}`);
  Object.assign(record, edit.set ?? {});
  return copy;
}

export function runVectors(doc) {
  if (!doc || doc.profile !== "nachweis/v1") throw new Error("vector is not for nachweis/v1");
  if (!Array.isArray(doc.cases) || doc.cases.length === 0) throw new Error("vector has no cases");
  return doc.cases.map((c) => {
    const resolved = resolveNachweisExport(applyEdit(doc.export, c.edit), c.receipt_id);
    const expected = c.expect ?? {};
    const actual = { ok: resolved.ok, codes: resolved.codes };
    const pass =
      actual.ok === expected.ok &&
      Array.isArray(expected.codes) &&
      actual.codes.length === expected.codes.length &&
      actual.codes.every((code, i) => code === expected.codes[i]);
    return { name: c.name, pass, expected, actual, decision: resolved.decision?.decision ?? null };
  });
}

function main(argv) {
  const file = argv[2] ? argv[2] : null;
  const doc = JSON.parse(fs.readFileSync(file ?? DEFAULT_PATH, "utf8"));
  const results = runVectors(doc);
  for (const r of results) {
    const line = `${r.pass ? "PASS" : "FAIL"} ${r.name} — ok=${r.actual.ok} codes=[${r.actual.codes.join(", ")}]`;
    console.log(line);
    if (!r.pass) console.log(`     expected ok=${r.expected.ok} codes=[${(r.expected.codes ?? []).join(", ")}]`);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv);
}
