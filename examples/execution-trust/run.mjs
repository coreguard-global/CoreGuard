/**
 * examples/execution-trust/run.mjs — the four pillars, in one command, offline.
 *
 *   AUTHORIZATION        an authorization receipt is issued over the EXACT bytes
 *                        of an unsigned Stellar payment envelope (PSAR/1).
 *   EXECUTION FIREWALL   the same receipt refuses a tampered envelope and an
 *                        expired window, each with its own named code.
 *   VERIFIABLE EXECUTION the conforming envelope verifies PASS, and the receipt
 *                        is written to disk as the artifact a third party needs.
 *   IMMUTABLE EVIDENCE   a SEPARATE PROCESS, holding only the receipt + the
 *                        issuer's PUBLIC key, re-verifies it and refuses a
 *                        one-field edit — the issuer's secret is never consulted.
 *
 * What this is NOT: no wallet, no signature over a transaction, no broadcast,
 * no network. The issuer is the deterministic DEMO issuer from
 * packages/stellar/presign.mjs; no Stellar key material exists in this file.
 * The receipt proves what was AUTHORIZED, never what was executed
 * (executionProof is always NOT_INCLUDED; that proof is the ledger read-back).
 *
 * Deterministic on purpose: the injected clock and the pinned maxTime mean the
 * receipt digest is identical on every run, so the transcript can be compared
 * byte for byte. Nothing here reads Date.
 *
 * Run: npm run trust:demo
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PSAR_VERSION,
  RECEIPT_SCOPE,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
} from "../../packages/stellar/presign.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.TRUST_OUT ? resolve(process.env.TRUST_OUT) : join(HERE, "out");
const VERIFIER = join(HERE, "verify-third-party.mjs");

const SOURCE = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const DESTINATION = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const DEMO_ISSUER_SEED = "42".repeat(32); // demo/dev only — never a wallet key
const NOW = 1731300000; // injected clock origin; the module never reads Date
const TTL_SECONDS = 600;
const POLICY = { asset: "XLM", maxAmount: "10", destination: DESTINATION };

let buildPaymentEnvelope = null;
async function loadBuilder() {
  if (buildPaymentEnvelope) return buildPaymentEnvelope;
  try {
    ({ buildPaymentEnvelope } = await import("../../packages/agent-gate/adapters/stellar-xdr.mjs"));
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && /Cannot find package/.test(err.message || "")) {
      throw new Error(
        "this demo needs the repo dependencies: run `npm install` once after cloning, then `npm run trust:demo` (the envelope is built with the official @stellar/stellar-sdk; the demo itself never touches the network)",
      );
    }
    throw err;
  }
  return buildPaymentEnvelope;
}

function build(amount) {
  const built = buildPaymentEnvelope({
    source: SOURCE,
    sequence: "1",
    destination: DESTINATION,
    amount,
    asset: "XLM",
    network: "testnet",
    fee: "100",
    // Pinned time bound: with timeoutSeconds alone the envelope carries a
    // wall-clock window and the digest would move between runs.
    maxTime: NOW + 180,
  });
  if (!built.ok) throw new Error(`envelope build failed: ${built.error}`);
  return built;
}

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function thirdParty(args) {
  try {
    const stdout = execFileSync(process.execPath, [VERIFIER, OUT, ...args], { encoding: "utf8" });
    return { status: 0, out: stdout.trim() };
  } catch (err) {
    return { status: err.status ?? 1, out: String(err.stdout || "").trim() };
  }
}

async function main() {
  await loadBuilder();
  mkdirSync(OUT, { recursive: true });

  const steps = [];
  const record = (pillar, claim, got, want) => {
    const ok = got === want;
    steps.push({ pillar, claim, expected: want, got, ok });
    if (!ok) throw new Error(`${pillar}: expected ${want}, got ${got}`);
  };

  const issuer = createInMemoryIssuer({ seedHex: DEMO_ISSUER_SEED });
  const envelope = build("10");

  // 1 · AUTHORIZATION ------------------------------------------------------
  const issued = issueAuthorizationReceipt({
    network: "TESTNET",
    xdr: envelope.xdr,
    policy: POLICY,
    issuer,
    nowSeconds: NOW,
    ttlSeconds: TTL_SECONDS,
  });
  if (!issued.ok) throw new Error(`receipt issue failed: ${issued.error}`);
  const receipt = issued.receipt;

  const verify = (xdr, nowSeconds, policy = POLICY) =>
    verifyAuthorizationReceipt({
      receipt,
      xdr,
      network: "TESTNET",
      policy,
      nowSeconds,
      issuerPublicKey: issuer.publicKeyHex,
    });

  const authorized = verify(envelope.xdr, NOW);
  record("AUTHORIZATION", "the conforming envelope is authorized", authorized.decision, "PASS");
  record(
    "AUTHORIZATION",
    "the receipt never claims execution",
    authorized.executionProof,
    "NOT_INCLUDED",
  );

  // 2 · EXECUTION FIREWALL -------------------------------------------------
  const tampered = verify(build("500").xdr, NOW);
  record("EXECUTION FIREWALL", "a tampered amount is refused", tampered.decision, "BLOCK");
  record("EXECUTION FIREWALL", "the refusal names the binding", tampered.code, "XDR_BINDING_MISMATCH");

  const expired = verify(envelope.xdr, receipt.expiresAt + 1);
  record("EXECUTION FIREWALL", "an expired window is refused", expired.decision, "BLOCK");
  record("EXECUTION FIREWALL", "the refusal names the clock", expired.code, "RECEIPT_EXPIRED");

  // 3 · VERIFIABLE EXECUTION ----------------------------------------------
  const conforming = verify(envelope.xdr, NOW + 1);
  record("VERIFIABLE EXECUTION", "the same receipt still passes inside its window", conforming.decision, "PASS");

  writeFileSync(join(OUT, "envelope.txt"), envelope.xdr, "utf8");
  writeFileSync(join(OUT, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeFileSync(join(OUT, "issuer.json"), `${JSON.stringify({ publicKeyHex: issuer.publicKeyHex }, null, 2)}\n`, "utf8");

  // 4 · IMMUTABLE EVIDENCE (separate process, public key only) -------------
  const outsider = thirdParty([`--at=${receipt.issuedAt + 1}`]);
  record("IMMUTABLE EVIDENCE", "a third party verifies with the public key alone", outsider.status, 0);
  record("IMMUTABLE EVIDENCE", "the outsider's verdict", outsider.out.split(/\s+/)[0], "PASS");

  const receiptPath = join(OUT, "receipt.json");
  const pristine = readFileSync(receiptPath, "utf8");
  const edited = JSON.parse(pristine);
  edited.policy = { ...edited.policy, maxAmount: "1000" }; // one field, one edit
  writeFileSync(receiptPath, `${JSON.stringify(edited, null, 2)}\n`, "utf8");
  const bitten = thirdParty([`--at=${receipt.issuedAt + 1}`]);
  writeFileSync(receiptPath, pristine, "utf8");
  record("IMMUTABLE EVIDENCE", "a one-field edit is refused", bitten.status, 2);
  record("IMMUTABLE EVIDENCE", "the refusal names the digest", bitten.out.split(/\s+/)[1], "BAD_DIGEST");

  // The artifact a reviewer keeps: what was claimed, what was refused, and the
  // digest of the receipt all of it hangs on.
  const transcript = {
    pillarOrder: ["AUTHORIZATION", "EXECUTION FIREWALL", "VERIFIABLE EXECUTION", "IMMUTABLE EVIDENCE"],
    receipt: { v: PSAR_VERSION, scope: RECEIPT_SCOPE, digest: receipt.digest, issuer: receipt.issuer },
    envelopeSha256: sha256(envelope.xdr),
    steps,
    refused: steps.filter((s) => s.got === "BLOCK" || s.got === "BAD_DIGEST").map((s) => `${s.pillar}: ${s.claim}`),
  };
  writeFileSync(join(OUT, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");

  const line = "─".repeat(72);
  console.log(line);
  console.log("CoreGuard — Execution Trust Layer · four pillars, offline");
  console.log(line);
  for (const s of steps) {
    const verdict = String(s.got).padEnd(22);
    console.log(`${s.ok ? "✓" : "✗"} ${s.pillar.padEnd(20)} ${verdict} ${s.claim}`);
  }
  console.log(line);
  console.log(`receipt digest   ${receipt.digest}`);
  console.log(`envelope sha256  ${transcript.envelopeSha256}`);
  console.log(`transcript       ${join(OUT, "transcript.json")}`);
  console.log(line);
  console.log("Not proven here: execution. A pre-sign receipt says what was AUTHORIZED.");
  console.log("Execution proof is the ledger read-back after submission, and nothing in this demo submits.");
}

main().catch((err) => {
  console.error(`TRUST-DEMO: FAILED — ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
});
