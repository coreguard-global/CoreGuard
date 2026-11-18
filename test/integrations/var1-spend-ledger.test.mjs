/**
 * CG-SPEND/1 — single use that survives a restart, a second worker and a second
 * system, and that fails loudly when two systems disagree.
 *
 * The race test spawns real child processes against one log file. An in-process
 * Set would pass a single-threaded test and lose money in production, so the
 * assertion is not "spent is true" but "exactly one of N concurrent claims won".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  SPEND_VERSION,
  checkSpent,
  claimSpend,
  makeSpendEntry,
  mergeLogs,
  readSpendLog,
  selfCheck,
  verifySpendEntry,
} from "../../packages/agent-commerce/spend.mjs";
import { generateIssuerKey } from "../../packages/agent-commerce/anchor.mjs";

const at = "2026-06-01T00:00:00Z";
const receiptDigest = "sha256:" + "9".repeat(64);
const spendModule = pathToFileURL(new URL("../../packages/agent-commerce/spend.mjs", import.meta.url).pathname).href;

test("selfCheck passes", () => {
  const r = selfCheck();
  assert.equal(r.ok, true, r.checks.filter((c) => !c.pass).map((c) => c.name).join(", "));
});

test("the version is pinned", () => assert.equal(SPEND_VERSION, "CG-SPEND/1"));

test("an entry is signed, and any edit to it is visible", () => {
  const key = generateIssuerKey();
  const e = makeSpendEntry({ receiptDigest, approvalNonce: "nonce-a", at, privateKeyPem: key.privateKeyPem });
  assert.equal(verifySpendEntry(e).ok, true);
  for (const mutated of [{ ...e, at: "2026-06-02T00:00:00Z" }, { ...e, orderRef: "different" }, { ...e, approvalNonce: "nonce-b" }]) {
    assert.equal(verifySpendEntry(mutated).ok, false);
  }
});

test("the same approval under two nonces is a conflict, not a duplicate", () => {
  const key = generateIssuerKey();
  const a = makeSpendEntry({ receiptDigest, approvalNonce: "nonce-a", at, privateKeyPem: key.privateKeyPem });
  const b = makeSpendEntry({ receiptDigest, approvalNonce: "nonce-b", at, privateKeyPem: key.privateKeyPem });

  assert.equal(checkSpent([a, b], { receiptDigest, approvalNonce: "nonce-a" }).state, "conflict");
  assert.equal(checkSpent([a], { receiptDigest, approvalNonce: "nonce-b" }).state, "conflict");
  assert.equal(checkSpent([a], { receiptDigest, approvalNonce: "nonce-a" }).state, "spent");
  assert.equal(checkSpent([a], { receiptDigest: "sha256:" + "8".repeat(64), approvalNonce: "nonce-a" }).state, "unspent");
});

test("a log with one tampered entry is unreadable, not 'unspent'", () => {
  const key = generateIssuerKey();
  const e = makeSpendEntry({ receiptDigest, approvalNonce: "nonce-a", at, privateKeyPem: key.privateKeyPem });
  const tampered = { ...e, spendKey: "sha256:" + "0".repeat(64) };
  assert.equal(checkSpent([tampered], { receiptDigest, approvalNonce: "nonce-a" }).state, "unreadable");
});

test("merging two honest logs surfaces the double-spend by receipt", () => {
  const key = generateIssuerKey();
  const a = makeSpendEntry({ receiptDigest, approvalNonce: "site-1", at, privateKeyPem: key.privateKeyPem });
  const b = makeSpendEntry({ receiptDigest, approvalNonce: "site-2", at, privateKeyPem: key.privateKeyPem });
  const merged = mergeLogs([[a], { entries: [b] }]);
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.uniqueSpends, 2);
});

test("N concurrent OS processes claiming the same approval: exactly one wins", async () => {
  const key = generateIssuerKey();
  const dir = mkdtempSync(join(tmpdir(), "cg-spend-race-"));
  const path = join(dir, "spend.json");

  const script = `
import { claimSpend } from ${JSON.stringify(spendModule)};
const r = claimSpend({
  path: process.env.CG_LOG,
  receiptDigest: process.env.CG_DIGEST,
  approvalNonce: process.env.CG_NONCE,
  at: process.env.CG_AT,
  orderRef: "order-" + process.pid,
  privateKeyPem: process.env.CG_KEY,
  timeoutMs: 4000,
});
process.stdout.write(JSON.stringify({ pid: process.pid, ok: r.ok, state: r.state }));
`;
  const run = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, CG_LOG: path, CG_DIGEST: receiptDigest, CG_NONCE: "race-nonce", CG_AT: at, CG_KEY: key.privateKeyPem },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(`child ${code}: ${err}`));
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new Error(`unparseable child output: ${out}`));
        }
      });
    });

  const results = await Promise.all([run(), run(), run(), run()]);
  const winners = results.filter((r) => r.ok === true);
  assert.equal(winners.length, 1, `expected exactly one winner, got ${JSON.stringify(results)}`);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.state === "spent" || r.state === "busy"));

  const log = readSpendLog(path);
  assert.equal(log.entries.length, 1);
  assert.equal(verifySpendEntry(log.entries[0]).ok, true);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).entries.length, 1);
});

test("a second claim in the same process sees the first one's entry and refuses", () => {
  const key = generateIssuerKey();
  const dir = mkdtempSync(join(tmpdir(), "cg-spend-seq-"));
  const path = join(dir, "spend.json");
  const first = claimSpend({ path, receiptDigest, approvalNonce: "seq", at, privateKeyPem: key.privateKeyPem });
  assert.equal(first.ok, true);
  const second = claimSpend({ path, receiptDigest, approvalNonce: "seq", at, privateKeyPem: key.privateKeyPem });
  assert.equal(second.ok, false);
  assert.equal(second.state, "spent");

  const other = claimSpend({ path, receiptDigest, approvalNonce: "seq-2", at, privateKeyPem: key.privateKeyPem });
  assert.equal(other.ok, false);
  assert.equal(other.state, "conflict");
});
