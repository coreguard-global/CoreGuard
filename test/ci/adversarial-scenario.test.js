/**
 * ADVERSARIAL SCENARIO CONTRACT — one command, seven stages, pinned verdicts.
 *
 * `examples/adversarial/run.mjs` walks a single attack end to end: create an
 * authorization receipt, evaluate the policy, simulate, attack the envelope,
 * refuse, seal the refusal, and have a separate process re-check both verdicts.
 * A scenario can only be trusted if its verdicts are pinned, so this contract
 * regenerates the transcript and compares it to the committed expectation in
 * `examples/adversarial/verdicts.json`, naming the stage that moved.
 *
 * Three things it refuses to let slide:
 *
 *  1. The attack line stops being BLOCK. A demo whose attack passes is the
 *     defect this repository exists to prevent, so that row is asserted twice:
 *     as printed, and in the pin.
 *  2. The refusal loses its named code. `BLOCK` without a code is a shrug; the
 *     code is the part a stranger can act on.
 *  3. The pin is edited by hand instead of regenerated. The pin is produced by
 *     the same code path that ships (the scenario writes it), so a mismatch
 *     means somebody changed behaviour or rewrote the file — and the message
 *     says which stage, not just "differ".
 *
 * The negative control at the bottom proves the comparator bites: a pin whose
 * ATTACK row says PASS must be reported as a mismatch naming ATTACK. Without
 * it, a comparator that returned "no differences" for everything would pass
 * every check above.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = "examples/adversarial/run.mjs";
const REL_PIN = "examples/adversarial/verdicts.json";
const COMMITTED_PIN = JSON.parse(readFileSync(resolve(REPO, REL_PIN), "utf8"));
const STAGE_ORDER = ["CREATE", "POLICY", "SIMULATE", "ATTACK", "REFUSE", "RECEIPT", "THIRD PARTY"];

function runScenario(tag) {
  const out = join(REPO, "var", `adversarial-${tag}`);
  const pin = join(REPO, "var", `adversarial-${tag}-verdicts.json`);
  const r = spawnSync(process.execPath, [SCRIPT, `--out=${out}`, `--pin=${pin}`], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    r.status,
    0,
    `one command must complete all seven stages, exited ${r.status}\n${((r.stdout || "") + (r.stderr || "")).slice(-1500)}`,
  );
  return { stdout: r.stdout || "", verdicts: JSON.parse(readFileSync(pin, "utf8")), out };
}

/** Structural diff: returns one human sentence per moved row, naming the stage. */
function diffPins(want, got) {
  const problems = [];
  if (want.scenario !== got.scenario) problems.push(`scenario id ${want.scenario} -> ${got.scenario}`);
  for (const field of ["networkCall", "executionProof"]) {
    if (want[field] !== got[field]) problems.push(`${field} ${want[field]} -> ${got[field]}`);
  }
  const byName = new Map(got.stages.map((s) => [s.stage, s]));
  for (const expected of want.stages) {
    const actual = byName.get(expected.stage);
    if (!actual) {
      problems.push(`stage ${expected.stage} disappeared from the transcript`);
      continue;
    }
    if (actual.decision !== expected.decision) {
      problems.push(`stage ${expected.stage}: verdict ${expected.decision} -> ${actual.decision}`);
    }
    if (actual.code !== expected.code) {
      problems.push(`stage ${expected.stage}: code ${expected.code} -> ${actual.code}`);
    }
  }
  if (got.stages.length !== want.stages.length) {
    problems.push(`stage count ${want.stages.length} -> ${got.stages.length}`);
  }
  for (const [key, value] of Object.entries(want.digests)) {
    if (got.digests[key] !== value) problems.push(`digest ${key}: ${value} -> ${got.digests[key]}`);
  }
  for (const [key, value] of Object.entries(want.outsider || {})) {
    if (got.outsider?.[key] !== value) problems.push(`outsider ${key}: ${value} -> ${got.outsider?.[key]}`);
  }
  return problems;
}

const FIRST = runScenario("contract");

test("one command walks the seven stages in order and the attack line is BLOCK", () => {
  const rows = FIRST.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d\s+\S/.test(l));

  assert.deepEqual(
    rows.map((r) => r.replace(/^\d\s+/, "").split(/\s{2,}/)[0]),
    STAGE_ORDER,
    `the transcript must carry the seven stages in order:\n${rows.join("\n")}`,
  );

  const attack = rows.find((r) => /^4\s+ATTACK\b/.test(r));
  assert.ok(attack, `no ATTACK row in the transcript:\n${rows.join("\n")}`);
  assert.match(
    attack,
    /^4\s+ATTACK\s+BLOCK\s+XDR_BINDING_MISMATCH\b/,
    `the attack line must be BLOCK with a named code, got: ${attack}`,
  );

  const refuse = rows.find((r) => /^5\s+REFUSE\b/.test(r));
  assert.ok(refuse, "no REFUSE row in the transcript");
  assert.match(refuse, /exit 2/, `the refusal must carry its exit code, got: ${refuse}`);

  for (const label of [
    "envelope sha256",
    "policy sha256",
    "receipt digest",
    "attacked envelope sha256",
    "refusal artifact sha256",
  ]) {
    const re = new RegExp(`^${label}\\s+[0-9a-f]{64}$`, "m");
    assert.match(FIRST.stdout, re, `the transcript must print a 32-byte ${label}`);
  }

  assert.match(
    FIRST.stdout,
    /outsider · pristine\s+PASS\s+\(exit 0\)/,
    "the outsider must PASS the authorized bytes in its own process",
  );
  assert.match(
    FIRST.stdout,
    /outsider · attacked\s+BLOCK XDR_BINDING_MISMATCH\s+\(exit 2\)/,
    "the outsider must reproduce the refusal in its own process",
  );
});

test("the committed pin is what the scenario produces — a moved verdict names its stage", () => {
  assert.deepEqual(
    diffPins(COMMITTED_PIN, FIRST.verdicts),
    [],
    `${REL_PIN} no longer matches the scenario. If the change is intended, regenerate it with ` +
      `\`node ${SCRIPT} --pin=${REL_PIN}\` and justify the diff in the commit:\n`,
  );
});

test("the transcript is deterministic: a second run produces identical digests", () => {
  const second = runScenario("contract-rerun");
  assert.deepEqual(second.verdicts.digests, FIRST.verdicts.digests, "two runs must produce identical digests");
  assert.deepEqual(second.verdicts.stages, FIRST.verdicts.stages, "two runs must produce identical verdicts");
});

test("negative control: a pin whose ATTACK row says PASS is caught", () => {
  const forged = JSON.parse(JSON.stringify(FIRST.verdicts));
  const attack = forged.stages.find((s) => s.stage === "ATTACK");
  attack.decision = "PASS";
  attack.code = null;
  const problems = diffPins(forged, FIRST.verdicts);
  assert.ok(problems.length > 0, "the comparator returned no differences for a forged verdict");
  assert.ok(
    problems.some((p) => p.includes("ATTACK")),
    `the comparator must name the stage that moved, got: ${problems.join("; ")}`,
  );
});
