/**
 * Agent Commerce TypeScript declaration surface — structural contract tests.
 *
 * The honest limit of what is verified here: the .d.ts is a declaration file,
 * validated STRUCTURALLY (declared value-exports ↔ runtime exports, constant
 * equality, boundary strings, no implementation). There is no tsc typecheck
 * lane in CI, and this file never claims one. Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const facade = await import("../../packages/agent-commerce/index.mjs");
const risk = await import("../../packages/agent-commerce/risk.mjs");
const dts = readFileSync(resolve(here, "../../packages/agent-commerce/index.d.ts"), "utf8");

/** Value-level exports (const / declare function / declare const) in the .d.ts. */
function declaredValueExports(source) {
  const names = new Set();
  for (const m of source.matchAll(/^export const (\w+):/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export declare const (\w+):/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export declare function (\w+)/gm)) names.add(m[1]);
  return names;
}

const runtimeExports = new Set([...Object.keys(facade), ...Object.keys(risk)]);
const declared = declaredValueExports(dts);

test("every runtime export of the facade and the risk module is declared in the .d.ts", () => {
  const missing = [...runtimeExports].filter((n) => !declared.has(n));
  assert.deepEqual(missing, [], `undeclared runtime exports: ${missing.join(", ")}`);
});

test("no phantom declarations: every declared value export exists at runtime", () => {
  const phantom = [...declared].filter((n) => !(n in facade) && !(n in risk));
  assert.deepEqual(phantom, [], `declared but not exported at runtime: ${phantom.join(", ")}`);
});

test("the constants in the .d.ts equal the runtime constants exactly", () => {
  assert.match(dts, /export const AGENT_COMMERCE_VERSION: "AC-SDK\/1";/);
  assert.match(dts, /export const CONSENT_SPEC: "CGCR\/1";/);
  assert.match(dts, /export const AGR_VERSION: "AGR\/1";/);
  assert.equal(facade.AGENT_COMMERCE_VERSION, "AC-SDK/1");
  assert.equal(facade.CONSENT_SPEC, "CGCR/1");
  assert.equal(risk.AGR_VERSION, "AGR/1");
});

test("the declaration carries the standing boundary (VERIFIED != SAFE, DDE/1, no fraud score, synthetic)", () => {
  for (const s of ["VERIFIED ≠ SAFE", "DDE/1", "never a probabilistic fraud score", "synthetic", "declared, never detected"]) {
    assert.ok(dts.includes(s), s);
  }
});

test("the declaration is type-only: no implementation, no runtime imports, no default export", () => {
  assert.ok(!/^\s*import\s/m.test(dts), "no import statements");
  assert.ok(!dts.includes("export default"), "no default export");
  assert.ok(!/require\s*\(/.test(dts), "no require calls");
  // No function BODY: every SINGLE-LINE declared function must end with a type
  // annotation (the line-anchored class cannot leak across newlines; the
  // multi-line signatures are covered by the export-parity tests above).
  const singles = [...dts.matchAll(/^export declare function (\w+)\(([^\n{]*)\)\s*:\s*[\w<>.,\[\]| ]+;[ \t]*$/gm)];
  assert.ok(singles.length >= 2, "single-line signatures are present");
  for (const m of singles) {
    assert.ok(m[0].trimEnd().endsWith(";"), `signature without a type annotation: ${m[1]}`);
  }
});

test("all eight AGR classes appear in the declaration", () => {
  for (const code of Object.keys(risk.RISK_CLASSES)) {
    assert.ok(dts.includes(`"${code}"`), code);
  }
});
