import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDecisionDoc,
  parsePlan,
  verifySignatureProof,
  verifyArtifactOffline,
  artifactDigest,
  stroops,
  SETTLEMENT_BOUNDARY,
} from "../../scripts/stellar-owner-settlement.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DECISION = join(REPO, "docs/OWNER-DECISION-2026-11-26-TESTNET-SETTLEMENT-SIGNING.md");
const ARTIFACT = join(REPO, "docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json");
const RUNNER = join(REPO, "scripts/stellar-owner-settlement.mjs");
const decisionText = readFileSync(DECISION, "utf8");
const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const idList = (result) => result.checks.filter((c) => !c.ok).map((c) => c.id);

test("owner decision is complete and refuses owner-held-key or mainnet rewrites", () => {
  const parsed = parseDecisionDoc(decisionText);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.violations));
  assert.equal(parsed.values.authorized_signing, "YES");
  assert.equal(parsed.values.authorized_settlement, "YES");
  assert.equal(parsed.values.network, "testnet");
  assert.equal(parsed.values["owner-held-key"], "NOT_USED");
  assert.equal(parsed.values.mainnet, "NOT_AUTHORIZED");
  assert.match(decisionText, /اعمل التسوية والتوقيع دا دا تفويض وصلاحية مني انا المالك/);

  assert.equal(parseDecisionDoc(decisionText.replace("authorized_signing: YES", "authorized_signing: NO")).ok, false);
  assert.equal(parseDecisionDoc(decisionText.replace("network: testnet", "network: pubnet")).ok, false);
  assert.equal(parseDecisionDoc(decisionText.replace("owner-held-key: NOT_USED", "owner-held-key: USED")).ok, false);
  assert.equal(parseDecisionDoc(decisionText.replace("mainnet: NOT_AUTHORIZED", "mainnet: AUTHORIZED")).ok, false);
  assert.equal(parseDecisionDoc(decisionText.replace("DECISION-OWNER-AUTHORIZED-TESTNET-SETTLEMENT-2026-11-26", "REMOVED-MARKER")).ok, false);
});

test("plan parsing refuses missing consent, mixed modes and unknown flags", () => {
  assert.deepEqual(parsePlan([]).violations, ["missing --owner-delegated-testnet-settlement: live Testnet signing requires explicit owner-delegated consent"]);
  assert.equal(parsePlan(["--owner-delegated-testnet-settlement", "--write", "docs/x.json"]).violations.length, 0);
  assert.ok(parsePlan(["--verify", "docs/x.json", "--owner-delegated-testnet-settlement"]).violations.some((v) => v.includes("--verify is offline")));
  assert.ok(parsePlan(["--verify", "docs/x.json", "--write", "docs/y.json"]).violations.some((v) => v.includes("mutually exclusive")));
  assert.ok(parsePlan(["--verify", "docs/x.txt"]).violations.some((v) => v.includes(".json")));
  assert.ok(parsePlan(["--owner-delegated-testnet-settlement", "--mainnet"]).violations.some((v) => v.includes("unknown flags")));
});

test("committed artifact passes every offline replay check", () => {
  const result = verifyArtifactOffline(artifact, decisionText);
  assert.deepEqual(idList(result), [], JSON.stringify(result.checks.filter((c) => !c.ok)));
  assert.equal(result.ok, true);
  assert.equal(artifact.status, "SETTLEMENT_RECORDED");
  assert.equal(artifact.network, "testnet");
  assert.equal(artifact.signing.algorithm, "ed25519");
  assert.equal(artifact.signing.signatureBytes, 64);
  assert.equal(artifact.gate.authorizationVerdict, "ALLOW");
  assert.equal(artifact.gate.bindingStatus, "BOUND");
  assert.equal(artifact.gate.verificationVerdict, "VERIFIED");
  assert.deepEqual(artifact.gate.breaks, []);
  assert.equal(artifact.integrity.digest, artifactDigest(artifact));
  assert.equal(artifact.authority.ownerHeldKey, false);
  assert.equal(artifact.authority.mainnet, false);
});

test("the exact signed bytes bind the public key, hash and 64-byte signature", () => {
  const proof = verifySignatureProof({
    envelopeXdr: artifact.transaction.envelopeXdr,
    publicKey: artifact.parties.sourcePublicKey,
    signatureHex: artifact.signing.signatureHex,
    txHash: artifact.transaction.hash,
  });
  assert.equal(proof.ok, true, JSON.stringify(proof.checks));
  assert.deepEqual(proof.checks.map((c) => c.id), ["hash:derived", "signature:count", "signature:hex", "signature:ed25519"]);
  assert.equal(
    verifySignatureProof({
      envelopeXdr: artifact.transaction.envelopeXdr,
      publicKey: artifact.parties.destinationPublicKey,
      signatureHex: artifact.signing.signatureHex,
      txHash: artifact.transaction.hash,
    }).ok,
    false,
  );
});

test("one XDR byte of drift breaks signature, gate binding, evidence and integrity", () => {
  const tampered = clone(artifact);
  tampered.transaction.envelopeXdr = tampered.transaction.envelopeXdr.slice(0, -3) + "AAA";
  tampered.gate.evidence.envelopeXdr = tampered.transaction.envelopeXdr;
  const result = verifyArtifactOffline(tampered, decisionText);
  for (const id of ["signature:public-proof", "gate:proposalBytes", "gate:evidence", "finality:reReadBytes", "artifact:digest"]) {
    assert.ok(idList(result).includes(id), `${id} must fail on byte drift; got ${JSON.stringify(idList(result))}`);
  }
});

test("hash, ledger and independent re-read drift are named failures", () => {
  const hashTampered = clone(artifact);
  hashTampered.transaction.hash = "0".repeat(64);
  assert.ok(idList(verifyArtifactOffline(hashTampered, decisionText)).includes("signature:evidenceHash"));

  const ledgerTampered = clone(artifact);
  ledgerTampered.finality.ledgerClosed = false;
  ledgerTampered.finality.confirmations = 0;
  ledgerTampered.finality.reReadHash = "1".repeat(64);
  const failed = idList(verifyArtifactOffline(ledgerTampered, decisionText));
  for (const id of ["finality:closed", "finality:confirmations", "finality:independentReRead"]) {
    assert.ok(failed.includes(id), `${id} must fail; got ${JSON.stringify(failed)}`);
  }
});

test("source and destination deltas must be exact to the stroop", () => {
  assert.equal(stroops("1.0000000"), 10000000n);
  assert.equal(stroops("100.0000000"), 1000000000n);
  assert.equal(stroops("0.00000001"), null);

  const tampered = clone(artifact);
  tampered.balances.sourceAfter = "9999.0000000";
  assert.ok(idList(verifyArtifactOffline(tampered, decisionText)).includes("balances:source"));

  const destTampered = clone(artifact);
  destTampered.balances.destinationAfter = "10000.0000000";
  assert.ok(idList(verifyArtifactOffline(destTampered, decisionText)).includes("balances:destination"));
});

test("secret fields and integrity-digest tampering are refused", () => {
  const leaked = clone(artifact);
  leaked.parties.secretKey = "MUST-NEVER-EXIST";
  assert.ok(idList(verifyArtifactOffline(leaked, decisionText)).includes("secret:no-material"));

  const drifted = clone(artifact);
  drifted.integrity.digest = "sha256:" + "0".repeat(64);
  assert.ok(idList(verifyArtifactOffline(drifted, decisionText)).includes("artifact:digest"));
});

test("the boundary states the finality and safety limits explicitly", () => {
  for (const phrase of [
    "Ed25519 signature",
    "Testnet ledger-closed inclusion",
    "does not prove owner-held-key use",
    "Mainnet settlement",
    "KYC/AML clearance",
    "asset truth",
    "production readiness",
    "VERIFIED ≠ SAFE",
  ]) {
    assert.ok(SETTLEMENT_BOUNDARY.includes(phrase), `boundary must include ${phrase}`);
  }
  assert.match(artifact.claim, /not owner-held-key use/);
  assert.match(artifact.claim, /not .* legal finality/);
});

test("offline CLI verifies the committed artifact without network or consent", () => {
  const r = spawnSync(process.execPath, [RUNNER, "--verify", "docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /"status": "VERIFY_OK"/);
  assert.match(r.stdout, /"id": "signature:public-proof"/);
});

test("offline CLI refuses live invocation without the recorded consent flag", () => {
  const r = spawnSync(process.execPath, [RUNNER], { cwd: REPO, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /"status": "REFUSED"/);
  assert.match(r.stdout, /"code": "PLAN_REFUSED"/);
  assert.match(r.stdout, /missing --owner-delegated-testnet-settlement/);
});
