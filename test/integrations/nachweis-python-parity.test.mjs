import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { recordHash, resolveNachweisExport } from "../../packages/agent-commerce/profiles/nachweis-v1.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = fileURLToPath(new URL("../../implementations/python/nachweis_v1.py", import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(new URL("../fixtures/nachweis/demo-allow-reduced.json", import.meta.url), "utf8"),
);

const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;
const python = (args) =>
  spawnSync("python3", [SCRIPT, "--json", ...args], { cwd: ROOT, encoding: "utf8" });

function view(result) {
  return { ok: result.ok, codes: result.codes, checks: result.checks, decision: result.decision ?? null };
}

test("the Python port and the Node resolver agree on the committed fixture", { skip: hasPython ? false : "python3 not installed" }, () => {
  const run = python([]);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.deepEqual(out.ids, FIXTURE.records.map((r) => recordHash(r)));
  assert.deepEqual(out.ids, FIXTURE.records.map((r) => r.hash));

  const clean = resolveNachweisExport(FIXTURE, out.ids[2]);
  assert.deepEqual(view(out.resolve), view(clean));
});

test("both implementations return the same codes for an edited amount", { skip: hasPython ? false : "python3 not installed" }, () => {
  const run = python(["--set", "amount=12.01"]);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);

  const edited = structuredClone(FIXTURE);
  edited.records.find((r) => r.kind === "execution").amount = "12.01";
  const expected = resolveNachweisExport(edited, out.ids[2]);
  assert.deepEqual(view(out.resolve), view(expected));
  assert.deepEqual(out.resolve.codes, ["HASH_MISMATCH", "AMOUNT_DRIFT"]);
});
