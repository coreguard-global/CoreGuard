/**
 * examples/adversarial/run.mjs — ONE adversarial scenario, one command, offline.
 *
 * Seven stages, in the order an attacker would actually meet them:
 *
 *   1 CREATE        an authorization receipt is issued over the EXACT bytes of
 *                   an unsigned payment envelope (PSAR/1), under a pinned policy.
 *   2 POLICY        the policy is fingerprinted and evaluated: 10 XLM to the
 *                   pinned destination is admitted.
 *   3 SIMULATE      the receipt is replayed against its own envelope: PASS, and
 *                   executionProof stays NOT_INCLUDED — authorizing is not
 *                   simulating, and simulating is not executing.
 *   4 ATTACK        the attacker keeps the receipt and swaps the envelope:
 *                   same source, same destination, amount 10 -> 500.
 *   5 REFUSE        the replay of stage 4 is a BLOCK with a named code, and the
 *                   refusal carries exit 2: nothing is signed, nothing broadcast.
 *   6 RECEIPT       the refusal is sealed as an artifact with its own digest, so
 *                   the decision outlives this process.
 *   7 THIRD PARTY   a SEPARATE PROCESS, holding only the receipt and the
 *                   issuer's PUBLIC key, reproduces both verdicts: PASS on the
 *                   authorized bytes, BLOCK on the attacked ones.
 *
 * What this is NOT: no wallet, no signature over a transaction, no broadcast, no
 * network. The issuer is the deterministic DEMO issuer from
 * packages/stellar/presign.mjs; no Stellar key material exists in this file, and
 * executionProof is NOT_INCLUDED everywhere — the proof of execution is the
 * ledger read-back, and nothing here submits.
 *
 * Deterministic on purpose: the clock is injected and the envelope's maxTime is
 * pinned, so every digest below is identical on every run and the transcript can
 * be compared byte for byte. Nothing here reads Date.
 *
 * Run: npm run demo:adversarial [-- --out=<dir>] [--pin=<path>]
 * The pin is the committed expectation (examples/adversarial/verdicts.json);
 * test/ci/adversarial-scenario.test.js regenerates it and fails on any drift.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PSAR_VERSION,
  RECEIPT_SCOPE,
  canonicalJson,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  normalizePolicy,
  verifyAuthorizationReceipt,
} from "../../packages/stellar/presign.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTSIDER = join(HERE, "..", "execution-trust", "verify-third-party.mjs");

const SOURCE = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const DESTINATION = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const DEMO_ISSUER_SEED = "42".repeat(32); // demo/dev only — never a wallet key
const NOW = 1731300000; // injected clock; this file never reads Date
const TTL_SECONDS = 600;
const AUTHORIZED_AMOUNT = "10";
const ATTACK_AMOUNT = "500";
const POLICY = { asset: "XLM", maxAmount: AUTHORIZED_AMOUNT, destination: DESTINATION };

const line = "─".repeat(88);
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function argValue(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

let buildPaymentEnvelope = null;
async function loadBuilder() {
  if (buildPaymentEnvelope) return buildPaymentEnvelope;
  try {
    ({ buildPaymentEnvelope } = await import("../../packages/agent-gate/adapters/stellar-xdr.mjs"));
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && /Cannot find package/.test(err.message || "")) {
      throw new Error(
        "this scenario needs the repo dependencies: run `npm install` once after cloning (the envelope is built with the official @stellar/stellar-sdk; the scenario itself never touches the network)",
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
    // wall-clock window and every digest would move between runs.
    maxTime: NOW + 180,
  });
  if (!built.ok) throw new Error(`envelope build failed: ${built.error}`);
  return built;
}

/** The outsider runs as its own process and sees files, never our memory. */
function outsider(dir) {
  try {
    const stdout = execFileSync(process.execPath, [OUTSIDER, dir, `--at=${NOW + 1}`], {
      encoding: "utf8",
    });
    return { status: 0, out: stdout.trim() };
  } catch (err) {
    return { status: err.status ?? 1, out: String(err.stdout || "").trim() };
  }
}

async function main() {
  await loadBuilder();

  const OUT = resolve(argValue("out", join(HERE, "out")));
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const stages = [];
  const stage = (n, name, decision, code, claim) => {
    stages.push({ n, stage: name, decision, code: code ?? null, claim });
  };

  const issuer = createInMemoryIssuer({ seedHex: DEMO_ISSUER_SEED });
  const normalizedPolicy = normalizePolicy(POLICY);
  if (!normalizedPolicy.ok) throw new Error(`POLICY: ${normalizedPolicy.error}`);
  const policy = normalizedPolicy.policy;
  const policySha256 = sha256(canonicalJson(policy));

  // 1 · CREATE ---------------------------------------------------------------
  const envelope = build(AUTHORIZED_AMOUNT);
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
  const envelopeSha256 = sha256(envelope.xdr);
  stage(1, "CREATE", "PASS", null, "an authorization receipt is issued over the exact envelope bytes");

  // 2 · POLICY ---------------------------------------------------------------
  const admitted = Number(AUTHORIZED_AMOUNT) <= Number(policy.maxAmount);
  if (!admitted || policy.destination !== DESTINATION || policy.asset !== "XLM") {
    throw new Error("POLICY: the pinned policy does not admit the authorized envelope");
  }
  stage(2, "POLICY", "PASS", null, `the policy admits ${AUTHORIZED_AMOUNT} ${policy.asset} to the pinned destination`);

  const verify = (xdr, atSeconds, policyArg = POLICY) =>
    verifyAuthorizationReceipt({
      receipt,
      xdr,
      network: "TESTNET",
      policy: policyArg,
      nowSeconds: atSeconds,
      issuerPublicKey: issuer.publicKeyHex,
    });

  // 3 · SIMULATE -------------------------------------------------------------
  const simulated = verify(envelope.xdr, NOW);
  if (simulated.decision !== "PASS" || simulated.executionProof !== "NOT_INCLUDED") {
    throw new Error(`SIMULATE: expected PASS/NOT_INCLUDED, got ${simulated.decision}/${simulated.executionProof}`);
  }
  stage(3, "SIMULATE", "PASS", null, "the receipt authorizes this envelope · executionProof NOT_INCLUDED");

  // 4 · ATTACK ---------------------------------------------------------------
  const attacked = build(ATTACK_AMOUNT);
  const attackerSha256 = sha256(attacked.xdr);
  const replay = verify(attacked.xdr, NOW);
  if (replay.decision !== "BLOCK") {
    throw new Error(`ATTACK: the replay was ${replay.decision}, the scenario is only meaningful if it BLOCKs`);
  }
  stage(
    4,
    "ATTACK",
    replay.decision,
    replay.code,
    `the same receipt meets a ${ATTACK_AMOUNT} XLM envelope`,
  );

  // 5 · REFUSE ---------------------------------------------------------------
  // One byte-level change is enough: the receipt is bound to the authorized
  // bytes, so the refusal must name the binding and stop the signing path.
  if (replay.code !== "XDR_BINDING_MISMATCH") {
    throw new Error(`REFUSE: expected XDR_BINDING_MISMATCH, got ${replay.code}`);
  }
  const REFUSAL_EXIT = 2;
  stage(5, "REFUSE", "BLOCK", replay.code, `exit ${REFUSAL_EXIT} · nothing signed, nothing broadcast`);

  // 6 · RECEIPT --------------------------------------------------------------
  const refusal = {
    artifact: "coreguard.adversarial.refusal/1",
    receipt: { v: PSAR_VERSION, scope: RECEIPT_SCOPE, digest: receipt.digest, issuer: receipt.issuer },
    authorizedEnvelopeSha256: envelopeSha256,
    presentedEnvelopeSha256: attackerSha256,
    policySha256,
    decision: replay.decision,
    code: replay.code,
    reasons: replay.reasons,
    executionProof: replay.executionProof,
    checkedAtSeconds: NOW,
    exitCode: REFUSAL_EXIT,
  };
  const refusalBody = `${JSON.stringify(refusal, null, 2)}\n`;
  writeFileSync(join(OUT, "refusal.json"), refusalBody, "utf8");
  const refusalSha256 = sha256(canonicalJson(refusal));
  stage(6, "RECEIPT", "PASS", null, "the refusal is sealed with its own digest, re-checkable by a stranger");

  // The artifact a reviewer keeps: the receipt, both envelopes, the refusal.
  writeFileSync(join(OUT, "envelope.txt"), envelope.xdr, "utf8");
  writeFileSync(join(OUT, "attacked-envelope.txt"), attacked.xdr, "utf8");
  writeFileSync(join(OUT, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeFileSync(join(OUT, "issuer.json"), `${JSON.stringify({ publicKeyHex: issuer.publicKeyHex }, null, 2)}\n`, "utf8");

  // Two directories the outsider can be pointed at, differing in ONE file.
  for (const [dir, xdr] of [["pristine", envelope.xdr], ["attacked", attacked.xdr]]) {
    mkdirSync(join(OUT, dir), { recursive: true });
    writeFileSync(join(OUT, dir, "envelope.txt"), xdr, "utf8");
    writeFileSync(join(OUT, dir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    writeFileSync(
      join(OUT, dir, "issuer.json"),
      `${JSON.stringify({ publicKeyHex: issuer.publicKeyHex }, null, 2)}\n`,
      "utf8",
    );
  }

  // 7 · THIRD PARTY ----------------------------------------------------------
  const pass = outsider(join(OUT, "pristine"));
  const blocked = outsider(join(OUT, "attacked"));
  const passVerdict = pass.out.split(/\s+/)[0];
  const blockedVerdict = blocked.out.split(/\s+/)[0];
  const blockedCode = blocked.out.split(/\s+/)[1];
  if (pass.status !== 0 || passVerdict !== "PASS") {
    throw new Error(`THIRD PARTY: the outsider did not PASS the authorized bytes (exit ${pass.status}: ${pass.out})`);
  }
  if (blocked.status !== REFUSAL_EXIT || blockedVerdict !== "BLOCK" || blockedCode !== "XDR_BINDING_MISMATCH") {
    throw new Error(
      `THIRD PARTY: the outsider did not reproduce the refusal (exit ${blocked.status}: ${blocked.out})`,
    );
  }
  stage(7, "THIRD PARTY", "PASS", null, "an outsider process reproduces both verdicts with the public key alone");

  const expected = [1, 2, 3, 4, 5, 6, 7];
  if (stages.length !== expected.length || stages.some((s, i) => s.n !== expected[i])) {
    throw new Error(`stage order drifted: ${stages.map((s) => s.n).join(",")}`);
  }

  const verdicts = {
    scenario: "coreguard.adversarial/1",
    measuredBy: "node examples/adversarial/run.mjs",
    networkCall: "NOT_PERFORMED",
    executionProof: "NOT_INCLUDED",
    stages: stages.map(({ n, stage: s, decision, code }) => ({ n, stage: s, decision, code })),
    digests: {
      envelopeSha256,
      policySha256,
      receiptDigest: receipt.digest,
      attackedEnvelopeSha256: attackerSha256,
      refusalSha256,
      issuerPublicKeyHex: issuer.publicKeyHex,
    },
    outsider: { pristine: `${passVerdict} exit 0`, attacked: `${blockedVerdict} ${blockedCode} exit ${REFUSAL_EXIT}` },
  };
  writeFileSync(join(OUT, "verdicts.json"), `${JSON.stringify(verdicts, null, 2)}\n`, "utf8");
  writeFileSync(join(OUT, "transcript.json"), `${JSON.stringify({ verdicts, stages }, null, 2)}\n`, "utf8");

  const pin = argValue("pin", null);
  if (pin) {
    mkdirSync(dirname(resolve(pin)), { recursive: true });
    writeFileSync(resolve(pin), `${JSON.stringify(verdicts, null, 2)}\n`, "utf8");
  }

  // ---- transcript ---------------------------------------------------------
  console.log(line);
  console.log("CoreGuard — adversarial scenario · seven stages, one command, offline");
  console.log(line);
  for (const s of stages) {
    const verdict = `${s.decision}${s.code ? ` ${s.code}` : ""}`;
    console.log(`${s.n} ${s.stage.padEnd(12)} ${verdict.padEnd(34)} ${s.claim}`);
  }
  console.log(line);
  console.log(`envelope sha256          ${envelopeSha256}`);
  console.log(`policy sha256            ${policySha256}`);
  console.log(`receipt digest           ${receipt.digest}`);
  console.log(`attacked envelope sha256 ${attackerSha256}`);
  console.log(`refusal artifact sha256  ${refusalSha256}`);
  console.log(line);
  console.log(`outsider · pristine      ${pass.out}   (exit ${pass.status})`);
  console.log(`outsider · attacked      ${blocked.out}   (exit ${blocked.status})`);
  console.log(line);
  console.log("Not proven here: execution. This layer authorizes and refuses; it never submits.");
  console.log("Execution proof is the ledger read-back after submission, and nothing in this scenario submits.");
}

main().catch((err) => {
  console.error(`ADVERSARIAL: FAILED — ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
});
