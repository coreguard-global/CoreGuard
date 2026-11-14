/**
 * The four-pillar demo is a claim, so it gets an assertion.
 *
 * What is checked: the demo's own expectations (every step `ok`), the exact
 * refusal codes (a BLOCK with the wrong code is a different product), the
 * third-party verifier's verdict in a separate process, and determinism — the
 * receipt digest and envelope hash must be identical across two fresh runs,
 * which is only true because the clock and the time bound are pinned.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const DEMO = join(REPO, "examples", "execution-trust", "run.mjs");

function runArc(outDir) {
  return execFileSync(process.execPath, [DEMO], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, TRUST_OUT: outDir },
  });
}

const transcriptOf = (dir) => JSON.parse(readFileSync(join(dir, "transcript.json"), "utf8"));
const stepOf = (transcript, pillar, claim) => {
  const hit = transcript.steps.filter((s) => s.pillar === pillar && s.claim === claim);
  assert.equal(hit.length, 1, `${pillar} / ${claim} must appear exactly once`);
  return hit[0];
};

test("execution-trust demo: four pillars hold in one offline command", () => {
  const dir = mkdtempSync(join(tmpdir(), "trust-arc-"));
  const stdout = runArc(dir);
  const t = transcriptOf(dir);

  assert.match(stdout, /Execution Trust Layer/, "the demo prints its own claim");
  assert.match(stdout, /Not proven here: execution/, "the demo names its own boundary");

  assert.equal(t.steps.length, t.steps.filter((s) => s.ok).length, "every step must hold");
  assert.deepEqual(
    [...new Set(t.steps.map((s) => s.pillar))],
    t.pillarOrder,
    "pillars appear in order and no others",
  );

  assert.equal(stepOf(t, "AUTHORIZATION", "the conforming envelope is authorized").got, "PASS");
  assert.equal(stepOf(t, "AUTHORIZATION", "the receipt never claims execution").got, "NOT_INCLUDED");
  assert.equal(stepOf(t, "VERIFIABLE EXECUTION", "the same receipt still passes inside its window").got, "PASS");

  // Refusals are named, not generic.
  assert.equal(stepOf(t, "EXECUTION FIREWALL", "a tampered amount is refused").got, "BLOCK");
  assert.equal(stepOf(t, "EXECUTION FIREWALL", "the refusal names the binding").got, "XDR_BINDING_MISMATCH");
  assert.equal(stepOf(t, "EXECUTION FIREWALL", "an expired window is refused").got, "BLOCK");
  assert.equal(stepOf(t, "EXECUTION FIREWALL", "the refusal names the clock").got, "RECEIPT_EXPIRED");
  assert.equal(stepOf(t, "IMMUTABLE EVIDENCE", "a one-field edit is refused").got, 2);
  assert.equal(stepOf(t, "IMMUTABLE EVIDENCE", "the refusal names the digest").got, "BAD_DIGEST");
  assert.equal(t.refused.length, 3, "three refusals, each recorded with its own reason");
});

test("execution-trust demo: the receipt is byte-identical across fresh runs", () => {
  const a = mkdtempSync(join(tmpdir(), "trust-det-a-"));
  const b = mkdtempSync(join(tmpdir(), "trust-det-b-"));
  runArc(a);
  runArc(b);
  const ta = transcriptOf(a);
  const tb = transcriptOf(b);

  assert.equal(ta.receipt.digest, tb.receipt.digest, "the receipt digest must not drift between runs");
  assert.equal(ta.envelopeSha256, tb.envelopeSha256, "the pinned time bound must keep the envelope identical");
  assert.deepEqual(ta.steps, tb.steps, "the transcript itself is deterministic");
});
