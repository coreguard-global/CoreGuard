#!/usr/bin/env node
/** Rebuild the #165 negative-control bundle from the committed positive fixture and assert one documented mutation. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = ROOT + "test/fixtures/handover/zamback-e2ef637d.json";
const DST = ROOT + "test/fixtures/handover/zamback-tampered-step.json";
const STEP_INDEX = 4; // observer step[5]
const OLD_TOOL = "proof_loop_check";
const NEW_TOOL = "proof_loop_fix";
const sha = (s) => "sha256:" + createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

export function buildTampered(sourceText) {
  const source = JSON.parse(sourceText);
  const step = source.steps[STEP_INDEX];
  const oldB64 = step.canonical_bytes_base64;
  const receiptText = Buffer.from(oldB64, "base64").toString("utf8");
  if (step.canonical_bytes !== receiptText) throw new Error("source text/base64 disagree");
  const needle = `"name":"${OLD_TOOL}"`;
  if (receiptText.split(needle).length - 1 !== 1) throw new Error("tool needle not unique");
  const offset = receiptText.indexOf(needle) + '"name":"'.length;
  const mutatedText = receiptText.replace(needle, `"name":"${NEW_TOOL}"`);
  const newB64 = Buffer.from(mutatedText, "utf8").toString("base64");
  if (sourceText.split(oldB64).length - 1 !== 1) throw new Error("base64 not unique in bundle text");
  let out = sourceText.replace(oldB64, newB64);
  const escOld = `\\"name\\":\\"${OLD_TOOL}\\"`;
  const escNew = `\\"name\\":\\"${NEW_TOOL}\\"`;
  const winStart = out.indexOf(step.id);
  if (winStart < 0) throw new Error("receipt id not found");
  const window = out.slice(winStart, winStart + 300000);
  const first = window.indexOf(escOld);
  if (first < 0) throw new Error("escaped needle not found");
  out = out.slice(0, winStart + first) + escNew + out.slice(winStart + first + escOld.length);
  const mutated = JSON.parse(out);
  if (mutated.steps[STEP_INDEX].canonical_bytes !== mutatedText) throw new Error("canonical_bytes not updated");
  if (Buffer.from(mutated.steps[STEP_INDEX].canonical_bytes_base64, "base64").toString("utf8") !== mutatedText) {
    throw new Error("base64 form not updated");
  }
  for (let i = 0; i < source.steps.length; i += 1) {
    if (i !== STEP_INDEX && JSON.stringify(source.steps[i]) !== JSON.stringify(mutated.steps[i])) {
      throw new Error("step " + i + " changed");
    }
  }
  const { steps: _a, ...sourceRest } = source;
  const { steps: _b, ...mutatedRest } = mutated;
  if (JSON.stringify(sourceRest) !== JSON.stringify(mutatedRest)) throw new Error("non-step member changed");
  return { text: out, record: {
    step_index_zero_based: STEP_INDEX,
    observer_step_label: `step[${STEP_INDEX + 1}]`,
    receipt_id: step.id,
    field: "tool.name inside canonical receipt bytes",
    original_value: OLD_TOOL,
    mutated_value: NEW_TOOL,
    value_offset_in_canonical_bytes: offset,
    claimed_output_hash_unchanged: step.output_hash,
    original_bundle_sha256: sha(sourceText),
    mutated_bundle_sha256: sha(out),
    original_bundle_bytes: Buffer.byteLength(sourceText),
    mutated_bundle_bytes: Buffer.byteLength(out),
  } };
}
function main() {
  const check = process.argv.includes("--check");
  const { text, record } = buildTampered(readFileSync(SRC, "utf8"));
  if (check && readFileSync(DST, "utf8") !== text) {
    console.error("#165 NEGATIVE-CONTROL DRIFT: committed bundle differs from rebuilt bundle");
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(record, null, 2));
}
main();
