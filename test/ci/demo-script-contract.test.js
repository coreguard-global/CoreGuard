/**
 * DEMO SCRIPT CONTRACT — `docs/reviewer-demo-script-2026-09.md` is executable.
 *
 * A demo script nobody executes rots in one direction: the commands drift, the
 * promised output stops matching, and the file keeps reading as if it worked.
 * This contract makes the script a checked artifact: it extracts every
 * `demo` fence, runs the steps IN ORDER from the repository root, and compares
 * the printed bytes to the fragments the script promises, failing with
 * `docs/reviewer-demo-script-2026-09.md:LINE` so the offender is the line a
 * reader would have run.
 *
 * Two things this contract deliberately does not do:
 *
 *  1. It does not run `npm test`. That command hosts this file, so executing
 *     it from inside itself recurses; the script says so in prose instead of
 *     pretending otherwise, and CI runs the suite as its own job.
 *  2. It does not ignore a non-zero exit. An expected failure (the tamper
 *     step) declares `! exit 1`; a step that fails without declaring it is a
 *     red build, because a fail-closed demo whose tamper step exits 0 is the
 *     defect this repository exists to prevent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REL = "docs/reviewer-demo-script-2026-09.md";
const DOC = resolve(REPO, REL);
const RAW = readFileSync(DOC, "utf8").replaceAll("\r\n", "\n");

/**
 * Grammar, one step per `$` line inside a ```demo fence:
 *   $ <command>      starts a step (its line number is what failures name)
 *   > <fragment>     output the command must print (stdout+stderr)
 *   ! exit <n>       the exit code the command must produce
 * Anything else inside the fence is a parse error, not a comment: a fence that
 * silently swallows a typo is how a broken step reads as a passing one.
 */
function parseSteps(text) {
  const lines = text.split("\n");
  const steps = [];
  let inFence = false;
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = `${REL}:${i + 1}`;
    if (!inFence) {
      if (/^```demo\s*$/.test(line)) inFence = true;
      continue;
    }
    if (/^```\s*$/.test(line)) {
      inFence = false;
      if (cur) { steps.push(cur); cur = null; }
      continue;
    }
    if (line.startsWith("$ ")) {
      if (cur) steps.push(cur);
      cur = { line: i + 1, cmd: line.slice(2).trim(), expects: [], exit: null };
      continue;
    }
    if (line.startsWith("> ")) {
      assert.ok(cur, `${at}: expectation belongs to no step`);
      cur.expects.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith("! exit ")) {
      assert.ok(cur, `${at}: exit code belongs to no step`);
      cur.exit = Number(line.slice("! exit ".length).trim());
      assert.ok(Number.isInteger(cur.exit), `${at}: exit code is not an integer`);
      continue;
    }
    if (line.trim() === "") continue;
    assert.fail(`${at}: undeclared line inside a demo fence — \`${line}\``);
  }
  assert.ok(!inFence, `${REL}: unterminated \`demo\` fence`);
  return steps;
}

const STEPS = parseSteps(RAW);

test("the script parses into runnable steps, and the tamper step is the one that must fail", () => {
  assert.ok(STEPS.length >= 6, `expected at least six runnable steps, parsed ${STEPS.length}`);
  for (const s of STEPS) {
    assert.match(
      s.cmd,
      /^(node|npm run)\s/,
      `${REL}:${s.line}: only \`node\` and \`npm run\` steps are executed by this contract, got \`${s.cmd}\``
    );
    assert.ok(s.expects.length >= 1, `${REL}:${s.line}: every step must promise at least one output fragment`);
    assert.ok(s.exit !== null, `${REL}:${s.line}: every step must declare its exit code (\`! exit 0\` or \`! exit 1\`)`);
  }
  const failing = STEPS.filter((s) => s.exit !== 0);
  assert.equal(
    failing.length,
    1,
    `exactly one step is expected to fail closed (the tamper step); found ${failing.length}`
  );
  assert.match(failing[0].cmd, /peoples-court:harness/, "the failing step must be the harness run over tampered bytes");
});

test("no step carries a placeholder — a promised command must be runnable as written", () => {
  const offenders = [];
  for (const s of STEPS) {
    if (/<[a-z][a-z0-9-]*>/i.test(s.cmd)) offenders.push(`${REL}:${s.line}: ${s.cmd}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `a placeholder in an executable step cannot be verified by anyone:\n${offenders.join("\n")}`
  );
});

test("the script's promised steps actually behave — run in order, compared by output", () => {
  // A fresh sandbox: the steps write under var/ (gitignored), and a leftover
  // run must not be able to make a later step look deterministic.
  rmSync(resolve(REPO, "var/demo"), { recursive: true, force: true });

  for (const step of STEPS) {
    const at = `${REL}:${step.line}`;
    const r = spawnSync(step.cmd, {
      cwd: REPO,
      shell: true,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    assert.equal(
      r.status,
      step.exit,
      `${at}: exit ${r.status}, script promises ${step.exit}\n  $ ${step.cmd}\n${out.slice(-1500)}`
    );
    for (const want of step.expects) {
      assert.ok(
        out.includes(want),
        `${at}: output never printed \`${want}\`\n  $ ${step.cmd}\n--- output tail ---\n${out.slice(-1500)}`
      );
    }
  }

  assert.ok(
    existsSync(resolve(REPO, "var/demo/tribunal")),
    `${REL}: the tribunal step declared success but wrote nothing to var/demo/tribunal`
  );
});

/**
 * NEGATIVE CONTROL — a comparator that cannot fail is not a comparator.
 *
 * The previous test compares real output to promised fragments. This one proves
 * the comparison is load-bearing: a fragment that differs by a single
 * character from what the harness printed must NOT be found. Without it, a
 * matcher that accidentally returned true for everything would pass every step
 * above and this file would be decoration.
 */
test("negative control: the fragment comparison is not vacuous", () => {
  const r = spawnSync(
    "npm run -s peoples-court:harness -- --case examples/delivery-fixture/pairs/dispute-package/reference-A --out var/demo/control",
    { cwd: REPO, shell: true, encoding: "utf8", timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }
  );
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  assert.equal(r.status, 0, `negative-control harness run failed:\n${out.slice(-1200)}`);
  assert.ok(out.includes("PEOPLES_COURT_HARNESS_READY"), "positive control: the promised fragment IS printed");
  assert.ok(
    !out.includes("PEOPLES_COURT_HARNESS_READY "),
    "negative control: a fragment with a trailing space must not match — the comparator compares text, not substrings of itself"
  );
  assert.ok(
    !out.includes("PEOPLES_COURT_HARNESS_READY_NOT"),
    "negative control: a superset fragment must not match"
  );
});
