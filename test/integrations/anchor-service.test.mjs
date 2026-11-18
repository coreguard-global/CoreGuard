/**
 * The anchor service we run ourselves: signed, hash-chained, and honest about
 * what it cannot do.
 *
 * What is asserted here is not "we have an anchor". It is the four properties a
 * stranger can check without our cooperation:
 *
 *   a signature that verifies offline, carrying its own public key;
 *   a chain where editing entry 0 is visible at the tail;
 *   a resolution answer that distinguishes "no one claimed this" (absent) from
 *     "someone claimed it and the claim does not stand" (unresolvable);
 *   a chain adapter that prepares a 32-byte memo and refuses mainnet by name.
 *
 * Plus one CLI round trip, because a library nobody can run is a claim, not a
 * service.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANCHOR_VERSION,
  appendAnchor,
  createLog,
  generateIssuerKey,
  keyIdFor,
  merkleRoot,
  prepareChainAnchor,
  resolveAnchor,
  signAttestation,
  verifyAttestation,
  verifyLog,
} from "../../packages/agent-commerce/anchor.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const T0 = "2026-11-18T00:00:00.000Z";

const keys = generateIssuerKey();
const digest = sha256(Buffer.from("anchor-service-test"));

test("an attestation verifies offline, with no secret and no network", () => {
  const attestation = signAttestation({
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
  assert.equal(attestation.anchorVersion, ANCHOR_VERSION);
  assert.equal(attestation.issuer.keyId, keyIdFor(keys.publicKeyPem));
  assert.ok(!JSON.stringify(attestation).includes("PRIVATE KEY"));
  const verified = verifyAttestation(attestation);
  assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((c) => !c.ok)));
  assert.equal(verified.checks.length, 5);
});

test("the log is a chain: editing an old entry is visible at the tail", () => {
  const log1 = appendAnchor(createLog(), {
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
  const log2 = appendAnchor(log1, {
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
  assert.equal(verifyLog(log1).ok, true);
  assert.equal(verifyLog(log2).ok, true);
  assert.equal(log2.entries[1].previous, sha256Leaf(log2.entries[0]));

  const edited = Object.freeze({
    ...log2,
    entries: Object.freeze([{ ...log2.entries[0], issuedAt: "2020-01-01T00:00:00.000Z" }, log2.entries[1]]),
  });
  const report = verifyLog(edited);
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((c) => !c.ok && c.name === "entry 0 verifies"));
  assert.ok(report.checks.some((c) => !c.ok && c.name === "entry 1 links to the previous entry"));
});

test("resolution separates absent from unresolvable", () => {
  const good = appendAnchor(createLog(), {
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
  assert.equal(resolveAnchor(good, `sha256:${digest}`).outcome, "verified");
  const unknown = resolveAnchor(good, `sha256:${"a".repeat(64)}`);
  assert.equal(unknown.outcome, "absent");
  assert.equal(unknown.present, false);

  const brokenEntry = { ...good.entries[0], subject: { ...good.entries[0].subject, kind: "forged" } };
  const broken = Object.freeze({ ...good, entries: Object.freeze([brokenEntry]) });
  const brokenAnswer = resolveAnchor(broken, `sha256:${digest}`);
  assert.equal(brokenAnswer.outcome, "unresolvable");
  assert.equal(brokenAnswer.present, true);
  assert.equal(brokenAnswer.evaluated, true);
});

test("the chain adapter prepares a memo and refuses mainnet by name", () => {
  const log = appendAnchor(createLog(), {
    subject: { kind: "receipt", digest: `sha256:${digest}` },
    issuedAt: T0,
    privateKeyPem: keys.privateKeyPem,
  });
  const prepared = prepareChainAnchor(log, { network: "testnet" });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.broadcast, false);
  assert.equal(prepared.memoHashHex, verifyLog(log).root);
  assert.equal(prepared.memoHashHex, merkleRoot(log.entries.map(sha256Leaf)));

  const refused = prepareChainAnchor(log, { network: "mainnet" });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /mainnet is refused/);
});

test("CLI round trip: keygen → attest → verify → resolve, on disk", () => {
  const temp = mkdtempSync(join(tmpdir(), "cg-anchor-"));
  try {
    const keyPath = join(temp, "issuer.pem");
    const logPath = join(temp, "anchor-log.json");
    const cli = join(REPO, "scripts", "anchor.mjs");
    const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });

    const keygen = run("keygen", "--out", keyPath);
    assert.match(keygen, /ANCHOR-KEYGEN/);
    assert.equal(statSync(keyPath).mode & 0o777, 0o600);

    const attested = run("attest", "--log", logPath, "--key", keyPath, "--digest", `sha256:${digest}`, "--now", T0);
    assert.match(attested, /ANCHOR-ATTEST: CG-ANCHOR\/1 entry 0/);
    assert.match(attested, /root: +[0-9a-f]{64}/);

    const log = JSON.parse(readFileSync(logPath, "utf8"));
    assert.equal(log.entries.length, 1);
    assert.equal(verifyLog(log).ok, true);
    assert.ok(log.root);

    assert.match(run("verify", "--log", logPath), /ANCHOR-VERIFY: OK — 1 entries/);
    assert.match(run("resolve", "--log", logPath, "--digest", `sha256:${digest}`, "--mode", "layered"), /ANCHOR-RESOLVE: verified/);
    assert.match(run("prepare", "--log", logPath), /broadcast false/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

function sha256Leaf(attestation) {
  const { createHash: h } = { createHash };
  const canonical = (value) => {
    if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    const keysSorted = Object.keys(value).sort();
    return "{" + keysSorted.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  };
  return h("sha256").update(Buffer.from(canonical(attestation), "utf8")).digest("hex");
}
