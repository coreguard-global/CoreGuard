/**
 * The pilot kit is only worth its exit code if the code is asserted.
 *
 * Two layers here:
 *   1. the CLI is spawned as a child and must exit 0 with every row PASS, and
 *      with the four decisions the report claims;
 *   2. the pieces that make refusal meaningful — drift naming, an unpinned key
 *      reading NOT_CHECKED — are tested directly, so a refactor cannot soften
 *      the row while the happy path stays green.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { fieldDrift, digestOf } from "../../examples/var1-pilot-kit/lib.mjs";
import { buildReceipt, inspectReceipt } from "../../examples/var1-pilot-kit/receipt.mjs";
import { generateIssuerKey } from "../../packages/agent-commerce/anchor.mjs";
import { createKeyring, pinKey } from "../../packages/agent-commerce/trust.mjs";

const KIT = fileURLToPath(new URL("../../examples/var1-pilot-kit/run.mjs", import.meta.url));
const SEED = "22".repeat(32);
const AT = "2026-06-01T00:00:00Z";

function runKit(outDir) {
  const res = spawnSync(process.execPath, [KIT, "--seed", SEED, "--at", AT, "--out", outDir, "--quiet"], {
    encoding: "utf8",
    timeout: 60000,
  });
  assert.equal(res.status, 0, `pilot exited ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
  return JSON.parse(readFileSync(join(outDir, "report.json"), "utf8"));
}

test("the pilot exits 0, with every row PASS, and leaves a report behind", () => {
  const out = mkdtempSync(join(tmpdir(), "var1-pilot-"));
  const report = runKit(out);

  assert.equal(report.verdict, "PASS");
  assert.equal(report.steps.length, 15);
  for (const step of report.steps) assert.equal(step.result, "PASS", `step ${step.id}: ${step.title}`);

  assert.match(report.receipt.receipt_id, /^urn:sha256:[0-9a-f]{64}$/);
  assert.equal(report.receipt.bytes_sha256, report.receipt.receipt_id.replace("urn:", ""));
  assert.equal(report.verification.outcome, "VERIFIED");
  assert.equal(report.verification.drift.length, 0);
  assert.equal(report.verification.key_status, "trusted");

  for (const f of ["report.json", "REPORT.md", "receipt.json", "spend-agent-a.log", "spend-agent-b.log", "spend-race.log"]) {
    assert.ok(existsSync(join(out, f)), `${f} should exist`);
  }
});

test("the run carries all four decisions and only a failed check declines", () => {
  const out = mkdtempSync(join(tmpdir(), "var1-pilot-"));
  const report = runKit(out);
  const bySource = new Map(report.decisions.map((d) => [d.source, d]));

  assert.equal(bySource.get("the exact execution").decision.decision, "ALLOW");
  assert.equal(bySource.get("the exact execution").decision.outcome, "VERIFIED");
  assert.equal(bySource.get("wrong bytes on the right path").decision.decision, "DECLINE");
  assert.equal(bySource.get("valid signature, drifted execution").decision.decision, "DECLINE");
  assert.equal(bySource.get("a content-addressed name with no answer").decision.decision, "HOLD");
  assert.equal(bySource.get("a locator with nothing behind it").decision.decision, "ALLOW_UNVERIFIED");
  assert.equal(bySource.get("a locator with nothing behind it").decision.unverified, true);

  for (const row of report.decisions) {
    if (row.decision.decision === "DECLINE") assert.equal(row.decision.outcome, "VERIFICATION_FAILED");
    if (row.decision.decision === "ALLOW") assert.equal(row.decision.outcome, "VERIFIED");
  }
});

test("the cross-process race has exactly one winner", () => {
  const out = mkdtempSync(join(tmpdir(), "var1-pilot-"));
  const report = runKit(out);
  const race = report.steps.find((s) => s.id === 9);
  const winners = race.detail.contenders.filter((c) => c.ok).length;
  const spent = race.detail.contenders.filter((c) => !c.ok && c.state === "spent").length;
  assert.equal(winners, 1);
  assert.equal(spent, 3);
});

test("the same seed and clock reproduce the receipt bytes", () => {
  const a = runKit(mkdtempSync(join(tmpdir(), "var1-pilot-a-")));
  const b = runKit(mkdtempSync(join(tmpdir(), "var1-pilot-b-")));
  assert.equal(a.receipt.receipt_id, b.receipt.receipt_id);
  assert.equal(a.receipt.body_digest, b.receipt.body_digest);
});

test("a valid receipt from an unpinned key is NOT_CHECKED, never VERIFIED", () => {
  const merchant = generateIssuerKey();
  const attacker = generateIssuerKey();
  const intent = {
    merchant_id: "merchant-sandbox-books",
    payee: "acct_sandbox_books",
    currency: "USD",
    total_minor: 500,
    items: [{ sku: "ONE", name: "One", qty: 1, unit_minor: 500 }],
  };
  const built = buildReceipt({
    merchant: { id: intent.merchant_id, name: "Sandbox Books" },
    approved: intent,
    approvalNonce: "nonce-test",
    executed: { ...intent, order_ref: "order-1", executed_at: AT },
    at: AT,
    privateKeyPem: attacker.privateKeyPem,
  });

  const ring = pinKey(createKeyring(), { publicKeyPem: merchant.publicKeyPem });
  const inspection = inspectReceipt({ bytes: built.bytes, expectedIntent: intent, keyring: ring });
  assert.equal(inspection.signatureOk, true);
  assert.equal(inspection.keyStatus, "unknown");
  assert.equal(inspection.outcome, "NOT_CHECKED");
  assert.equal(inspection.ok, false);
});

test("drift names the field, and line order is not drift", () => {
  const intent = {
    merchant_id: "m",
    payee: "acct",
    currency: "USD",
    total_minor: 300,
    items: [
      { sku: "A", name: "A", qty: 1, unit_minor: 100 },
      { sku: "B", name: "B", qty: 1, unit_minor: 200 },
    ],
  };
  const surcharge = { ...intent, total_minor: 400 };
  assert.deepEqual(fieldDrift(intent, surcharge).map((d) => d.field), ["total_minor"]);

  const reordered = { ...intent, items: [...intent.items].reverse() };
  assert.deepEqual(fieldDrift(intent, reordered), []);
  assert.equal(digestOf(intent) === digestOf({ ...intent, items: [...intent.items].reverse() }), false);
});
