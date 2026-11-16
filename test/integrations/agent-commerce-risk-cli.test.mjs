/**
 * Agent Risk Engine standalone CLI + assessment persistence contract tests.
 * Deterministic, offline, no wall clock. Classes frozen (AGR/1).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runRiskCli } from "../../packages/agent-commerce/risk-cli.mjs";
import { RISK_CLASSES } from "../../packages/agent-commerce/risk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const cliPath = resolve(repoRoot, "packages/agent-commerce/risk-cli.mjs");

const MERCHANT = "0x0000000000000000000000000000000000000042";

function sampleInput(drift = false) {
  const intent = {
    version: "CGEP/1",
    chainId: "0",
    signer: "0x000000000000000000000000000000000000000d",
    nonce: "0",
    validAfter: "0",
    validUntil: "9999999999",
    action: "AGENT_CHECKOUT",
    target: MERCHANT,
    selector: "0xa9059cbb",
    asset: "0x0000000000000000000000000000000000000002",
    amount: "3300",
    recipient: MERCHANT,
    items: [{ sku: "SKU-RC-1", name: "Synthetic item", qty: 1, unitPriceMinor: "3300" }],
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-RC (placeholder)",
  };
  const trace = {
    txHash: "0x" + "aa".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: "1794657600",
    from: "0x000000000000000000000000000000000000000d",
    to: drift ? "0x0000000000000000000000000000000000000099" : MERCHANT,
    value: "3300",
    calldata: "0xa9059cbb" + (drift ? "99".padStart(40, "0") : MERCHANT.slice(2)).padStart(64, "0") + BigInt("3300").toString(16).padStart(64, "0"),
    items: intent.items,
    paymentCredentialRef: intent.paymentCredentialRef,
  };
  return { intent, trace };
}

test("AGR/1 classes are frozen (8 named classes)", () => {
  const codes = Object.keys(RISK_CLASSES).sort();
  assert.deepEqual(codes, [
    "CREDENTIAL_SUBSTITUTION",
    "EXPIRED_AUTHORIZATION",
    "ITEM_MUTATION",
    "MALFORMED_EXECUTION",
    "POLICY_VIOLATION",
    "RECIPIENT_SUBSTITUTION",
    "SINGLE_USE_REUSE",
    "VALUE_ESCALATION",
  ]);
});

test("runRiskCli assesses and persists report (--out) and ledger (--ledger)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-rcli-"));
  try {
    const inputPath = join(dir, "input.json");
    const outPath = join(dir, "assessment.json");
    const ledgerPath = join(dir, "assessments.jsonl");
    writeFileSync(inputPath, JSON.stringify(sampleInput(false)), "utf8");

    const logs = [];
    const errs = [];
    const res = runRiskCli(["assess", "--input", inputPath, "--out", outPath, "--ledger", ledgerPath], {
      log: (s) => logs.push(String(s)),
      err: (s) => errs.push(String(s)),
    });
    assert.equal(res.code, 0);
    assert.equal(res.report.classification, "CLEAN");
    const saved = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(saved.classification, "CLEAN");
    assert.equal(saved.spec, "AGR/1");
    const lines = readFileSync(ledgerPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.classification, "CLEAN");
    assert.deepEqual(rec.violations, []);
    assert.ok(Array.isArray(logs) && logs.join("\n").includes("CLEAN"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runRiskCli persists VIOLATIONS and appends multiple ledger records", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-rcli-"));
  try {
    const cleanIn = join(dir, "clean.json");
    const driftIn = join(dir, "drift.json");
    const ledgerPath = join(dir, "ledger.jsonl");
    writeFileSync(cleanIn, JSON.stringify(sampleInput(false)), "utf8");
    writeFileSync(driftIn, JSON.stringify(sampleInput(true)), "utf8");

    const r1 = runRiskCli(["--input", cleanIn, "--ledger", ledgerPath], { log: () => {}, err: () => {} });
    const r2 = runRiskCli(["--input", driftIn, "--ledger", ledgerPath], { log: () => {}, err: () => {} });
    assert.equal(r1.code, 0);
    assert.equal(r2.code, 0);
    assert.equal(r2.report.classification, "VIOLATIONS");
    assert.ok(r2.report.violations.some((v) => v.code === "RECIPIENT_SUBSTITUTION"));
    const lines = readFileSync(ledgerPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[1]).classification, "VIOLATIONS");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("standalone CLI runs as a node script and exits 0 on valid assessment", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-rcli-"));
  try {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, JSON.stringify(sampleInput(false)), "utf8");
    const out = execFileSync(process.execPath, [cliPath, "assess", "--input", inputPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const report = JSON.parse(out);
    assert.equal(report.classification, "CLEAN");
    assert.equal(report.spec, "AGR/1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runRiskCli returns code 1 on missing/invalid input", () => {
  const r1 = runRiskCli(["assess"], { log: () => {}, err: () => {} });
  assert.equal(r1.code, 1);
  const r2 = runRiskCli(["--input", "no-such-file.json"], { log: () => {}, err: () => {} });
  assert.equal(r2.code, 1);
});
