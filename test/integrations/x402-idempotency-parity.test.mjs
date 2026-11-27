import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MATRIX = join(ROOT, "test/fixtures/x402/idempotency-matrix.json");
const NODE_RUNNER = join(ROOT, "scripts/x402-matrix-run.mjs");
const PYTHON_HARNESS = join(ROOT, "implementations/python/x402_idempotency.py");

const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;
const node = (args) => spawnSync("node", [NODE_RUNNER, ...args], { cwd: ROOT, encoding: "utf8" });
const python = (args) => spawnSync("python3", [PYTHON_HARNESS, ...args], { cwd: ROOT, encoding: "utf8" });

test("CG-X402-IDEM/1: the two harnesses produce byte-identical output on the same 14-case matrix", { skip: !hasPython && "python3 not installed" }, () => {
  const a = node([MATRIX, "--check"]);
  const b = python(["--matrix", MATRIX, "--check"]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.ok(a.stdout.length > 5000, "matrix output must be a real matrix, not a stub");
  assert.ok(a.stdout === b.stdout, "Node and Python outputs must match byte for byte");

  const out = JSON.parse(a.stdout);
  assert.equal(out.spec, "CG-X402-IDEM/1");
  assert.match(out.boundary, /VERIFIED ≠ SAFE/);
  assert.equal(out.cases.length, 14);
  const codes = out.cases.flatMap((c) => c.results.map((r) => r.code));
  const unscoped = out.cases.find((c) => c.name === "purchase-id-only-lapsed-window");
  assert.ok(unscoped, "the purchase-id-only lookup shape must be in the matrix");
  const unscopedCodes = unscoped.results.map((r) => r.code);
  assert.deepEqual(unscopedCodes, ["CONSTRUCTED", "RESERVED", "RESERVATION_LAPSED", "RESERVATION_EXPIRED", "OWNER_CONFLICT"]);
  assert.ok(codes.includes("RESERVATION_LAPSED"), "the reviewer's edge must be in the matrix");
  assert.ok(codes.includes("PAYER_CONFLICT"), "the facilitator boundary must be in the matrix");
  assert.ok(codes.includes("RECEIPT_REPLAY"), "the return-the-original path must be in the matrix");
});

test("the Python harness passes its own unit tests without network or third-party packages", { skip: !hasPython && "python3 not installed" }, () => {
  const r = spawnSync("python3", [
    "-m", "unittest", "discover", "-s", "implementations/python",
    "-p", "test_x402_idempotency.py",
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stderr, /Ran 5 tests/);
  assert.match(r.stderr, /\bOK\b/);
});

test("the pinned matrix is not decorative: a tampered expectation fails both runners", { skip: !hasPython && "python3 not installed" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "x402-parity-"));
  try {
    const doc = JSON.parse(readFileSync(MATRIX, "utf8"));
    const target = doc.cases.find((c) => c.name === "lapsed-read-matches-closed-write");
    assert.ok(target, "negative control needs the lapsed-window case");
    target.expect[2].code = "PENDING"; // the exact bug the reviewer found
    const path = join(dir, "tampered-matrix.json");
    writeFileSync(path, JSON.stringify(doc));

    const a = node([path, "--check"]);
    const b = python(["--matrix", path, "--check"]);
    assert.equal(a.status, 1);
    assert.equal(b.status, 1);
    assert.match(a.stderr, /MATRIX DRIFT: lapsed-read-matches-closed-write/);
    assert.match(b.stderr, /MATRIX DRIFT: lapsed-read-matches-closed-write/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
