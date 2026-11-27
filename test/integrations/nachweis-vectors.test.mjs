import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { runVectors } from "../../scripts/nachweis-vector-run.mjs";

const VECTOR = JSON.parse(
  readFileSync(new URL("../fixtures/profiles/nachweis-v1.vectors.json", import.meta.url), "utf8"),
);

test("the nachweis/v1 vector carries a clean allow case and an edited-amount case", () => {
  assert.equal(VECTOR.profile, "nachweis/v1");
  assert.equal(VECTOR.source.license, "Apache-2.0");
  assert.deepEqual(VECTOR.cases.map((c) => c.name), ["allow-clean", "edited-amount"]);
  assert.deepEqual(VECTOR.cases.map((c) => c.expect.codes), [[], ["HASH_MISMATCH", "AMOUNT_DRIFT"]]);
});

test("both vector cases produce exactly the expected verdicts", () => {
  const results = runVectors(VECTOR);
  assert.deepEqual(results.map((r) => [r.name, r.pass]), [["allow-clean", true], ["edited-amount", true]]);
  assert.equal(results[0].decision, "allow");
  assert.deepEqual(results[1].actual.codes, ["HASH_MISMATCH", "AMOUNT_DRIFT"]);
});

test("the vector runner fails when the expectation is wrong", () => {
  const wrong = structuredClone(VECTOR);
  wrong.cases[0].expect.codes = ["AMOUNT_DRIFT"];
  const results = runVectors(wrong);
  assert.equal(results[0].pass, false);
});
