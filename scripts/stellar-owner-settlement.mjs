#!/usr/bin/env node
/**
 * scripts/stellar-owner-settlement.mjs — OWNER-DELEGATED TESTNET signing + settlement.
 *
 * This script performs a REAL native-XLM payment on Stellar TESTNET with two
 * fresh, agent-generated ephemeral keypairs. The owner's recorded decision is
 * docs/OWNER-DECISION-2026-11-26-TESTNET-SETTLEMENT-SIGNING.md; the decision
 * marker, explicit operator flag and fail-closed gates are mandatory.
 *
 * What this proves, and only this:
 *   1. a real Ed25519 signature over the exact envelope bytes was produced by
 *      the delegated ephemeral key and verifies from public bytes;
 *   2. Stellar Testnet accepted the signed payment and reported success;
 *   3. the transaction is included in a CLOSED Testnet ledger with a public
 *      hash, a re-readable result XDR, and exact source/destination deltas;
 *   4. CG-SG/1 bound the same bytes and verified the observed submission.
 *
 * What this does NOT prove: owner-held-key use, Mainnet settlement, legal or
 * business finality, custody, KYC/AML clearance, asset truth, safety, audit,
 * compliance, a customer/pilot, or production readiness. No secret is ever
 * written, printed, logged or exported; only public keys and public chain
 * evidence travel into the artifact.
 *
 * Usage:
 *   node scripts/stellar-owner-settlement.mjs \
 *     --owner-delegated-testnet-settlement --write docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json
 *   node scripts/stellar-owner-settlement.mjs --verify docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder, Horizon } from "@stellar/stellar-sdk";
import {
  preflightStellarAgentPayment,
  bindStellarAuthorization,
  verifyStellarSubmissionEvidence,
  exportStellarEvidencePack,
  STELLAR_GATE_BOUNDARY,
} from "../packages/agent-commerce/stellar-gate.mjs";
import { digestOf } from "../packages/agent-commerce/wave5.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DECISION_REL = "docs/OWNER-DECISION-2026-11-26-TESTNET-SETTLEMENT-SIGNING.md";
const DECISION_MARKER = "DECISION-OWNER-AUTHORIZED-TESTNET-SETTLEMENT-2026-11-26";
const CONSENT = "--owner-delegated-testnet-settlement";
const ENDPOINT = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const MEMO = "cg-owner-settlement";
const AMOUNT = "1";
const FEE = "100";
const POLL_LIMIT = 24;
const POLL_MS = 2500;

export const SETTLEMENT_BOUNDARY =
  "Owner-delegated Testnet settlement: proves a recorded Ed25519 signature, Testnet ledger-closed inclusion and exact balance deltas. It does not prove owner-held-key use, Mainnet settlement, legal/financial finality, custody, KYC/AML clearance, asset truth, safety, audit, compliance, a customer/pilot or production readiness. VERIFIED ≠ SAFE.";

const fail = (code, detail, extra = {}) => ({
  status: "REFUSED",
  code,
  detail,
  network: "testnet",
  boundary: SETTLEMENT_BOUNDARY,
  ...extra,
});

/** Parse the recorded owner decision. Every literal is a fail-closed gate. */
export function parseDecisionDoc(raw) {
  const text = typeof raw === "string" ? raw : "";
  const violations = [];
  const markerLine = new RegExp(`^[ \\t]+${DECISION_MARKER}[ \\t]*$`, "m");
  const endLine = new RegExp(`^[ \\t]+END ${DECISION_MARKER}[ \\t]*$`, "m");
  if (!markerLine.test(text)) violations.push("decision marker start line missing");
  if (!endLine.test(text)) violations.push("decision marker end line missing");
  const pick = (key) => {
    const m = text.match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.+?)[ \\t]*$`, "m"));
    return m ? m[1] : null;
  };
  const expected = {
    authorized_signing: "YES",
    authorized_settlement: "YES",
    network: "testnet",
    "key-origin": "owner-delegated agent-generated in-memory ephemeral keypair",
    "owner-held-key": "NOT_USED",
    mainnet: "NOT_AUTHORIZED",
  };
  const values = {};
  for (const [key, want] of Object.entries(expected)) {
    const got = pick(key);
    values[key] = got;
    if (got !== want) violations.push(`${key} must be ${JSON.stringify(want)} (got ${JSON.stringify(got)})`);
  }
  const scope = pick("scope") || "";
  if (!/one native XLM payment/.test(scope) || !/amount <= 5 XLM/.test(scope) || !/memo cg-owner-settlement/.test(scope)) {
    violations.push("scope must pin one native XLM payment with a 5 XLM ceiling and the settlement memo");
  }
  if (!/preflight ALLOW/.test(pick("gate") || "") || !/evidence VERIFIED/.test(pick("gate") || "")) {
    violations.push("gate must require ALLOW + exact XDR binding + VERIFIED evidence");
  }
  if (!/closed ledger/.test(pick("finality") || "") || !/balance deltas/.test(pick("finality") || "")) {
    violations.push("finality must require a closed ledger, re-read and exact balance deltas");
  }
  if (!/never written, logged, printed or exported/.test(pick("secret-discipline") || "")) {
    violations.push("secret-discipline must forbid writing, logging, printing and exporting generated keys");
  }
  if (!text.includes("اعمل التسوية والتوقيع دا دا تفويض وصلاحية مني انا المالك")) {
    violations.push("recorded owner quote missing");
  }
  return { ok: violations.length === 0, violations, values, marker: DECISION_MARKER, path: DECISION_REL };
}

export function parsePlan(argv = []) {
  const plan = { consent: false, verifyPath: null, writePath: null, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === CONSENT) plan.consent = true;
    else if (a === "--verify") { plan.verifyPath = next ?? null; i++; }
    else if (a === "--write") { plan.writePath = next ?? null; i++; }
    else plan.unknown.push(a);
  }
  const violations = [];
  if (plan.unknown.length) violations.push(`unknown flags: ${plan.unknown.join(" ")}`);
  if (plan.verifyPath && plan.consent) violations.push("--verify is offline; do not combine it with the live consent flag");
  if (plan.verifyPath && plan.writePath) violations.push("--verify and --write are mutually exclusive");
  if (plan.verifyPath && !plan.verifyPath.endsWith(".json")) violations.push("--verify needs a .json artifact path");
  if (plan.writePath && (!plan.writePath.endsWith(".json") || plan.writePath.startsWith("--"))) violations.push("--write needs a .json artifact path");
  if (!plan.verifyPath && !plan.consent) violations.push(`missing ${CONSENT}: live Testnet signing requires explicit owner-delegated consent`);
  return { plan, violations };
}

export function readDecision() {
  return parseDecisionDoc(readFileSync(join(ROOT, DECISION_REL), "utf8"));
}

const stroops = (value) => {
  const s = String(value ?? "");
  if (!/^\d+(\.\d{1,7})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 10000000n + BigInt(frac.padEnd(7, "0") || "0");
};
export { stroops };

function nativeBalance(account) {
  const row = (account?.balances || []).find((b) => b.asset_type === "native");
  return row && typeof row.balance === "string" ? row.balance : null;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try { body = text.length ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fund(url) {
  const r = await getJson(url);
  if (!r.ok) throw new Error(`funding failed with HTTP ${r.status}`);
}

/** Verify the signature from public bytes only — no key material is needed. */
export function verifySignatureProof({ envelopeXdr, publicKey, signatureHex, txHash }) {
  const checks = [];
  try {
    const tx = TransactionBuilder.fromXDR(envelopeXdr, PASSPHRASE);
    const hash = Buffer.from(tx.hash()).toString("hex");
    checks.push({ id: "hash:derived", ok: hash === String(txHash).toLowerCase(), detail: "derived transaction hash must match evidence hash" });
    checks.push({ id: "signature:count", ok: tx.signatures.length === 1, detail: "exactly one signature is required" });
    if (tx.signatures.length === 1) {
      const sig = tx.signatures[0].signature.value;
      checks.push({ id: "signature:hex", ok: Buffer.from(sig).toString("hex") === String(signatureHex).toLowerCase(), detail: "saved signature must match the signed envelope" });
      let valid = false;
      try { valid = Keypair.fromPublicKey(publicKey).verify(Buffer.from(hash, "hex"), sig); } catch { valid = false; }
      checks.push({ id: "signature:ed25519", ok: valid, detail: "Ed25519 signature must verify from the public key" });
    }
  } catch (e) {
    checks.push({ id: "envelope:parse", ok: false, detail: `signed envelope could not be parsed: ${String(e && e.message ? e.message : e)}` });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

function stableEvidenceFields(a) {
  return {
    status: a.status,
    network: a.network,
    authority: a.authority,
    parties: a.parties,
    signing: a.signing,
    gate: a.gate,
    transaction: a.transaction,
    finality: a.finality,
    balances: a.balances,
    evidencePackDigest: a.evidencePackDigest,
  };
}

export function artifactDigest(artifact) {
  return digestOf(stableEvidenceFields(artifact));
}

/**
 * Offline replay of the committed artifact. Re-derives the gate from public
 * bytes and checks the chain/balance evidence without any network call.
 */
export function verifyArtifactOffline(artifact, decisionText) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
  const decision = parseDecisionDoc(decisionText);
  add("decision:recorded", decision.ok, decision.violations.join("; ") || "owner decision is complete");
  add("artifact:status", artifact?.status === "SETTLEMENT_RECORDED", "status must be SETTLEMENT_RECORDED");
  add("artifact:network", artifact?.network === "testnet", "network must be testnet");
  add("artifact:decisionMarker", artifact?.authority?.marker === DECISION_MARKER, "artifact must name the recorded decision marker");
  add("authority:ownerHeldKey", artifact?.authority?.ownerHeldKey === false, "owner-held-key use must be denied");
  add("authority:mainnet", artifact?.authority?.mainnet === false, "mainnet must be denied");
  add("authority:delegated", artifact?.authority?.delegatedSigning === true, "signing must be owner-delegated");

  const sig = verifySignatureProof({
    envelopeXdr: artifact?.transaction?.envelopeXdr,
    publicKey: artifact?.parties?.sourcePublicKey,
    signatureHex: artifact?.signing?.signatureHex,
    txHash: artifact?.transaction?.hash,
  });
  add("signature:public-proof", sig.ok, sig.checks.filter((c) => !c.ok).map((c) => c.id).join(",") || "signature verifies from public bytes");
  add("signature:evidenceHash", artifact?.gate?.evidence?.txHash === artifact?.transaction?.hash, "gate evidence hash must match the recorded transaction");
  add("signature:evidenceBytes", artifact?.gate?.evidence?.envelopeXdr === artifact?.transaction?.envelopeXdr, "gate evidence bytes must match the signed envelope");
  add("gate:proposalBytes", artifact?.gate?.proposal?.envelopeXdr === artifact?.transaction?.envelopeXdr, "authorization proposal must name the exact signed envelope bytes");

  const proposal = artifact?.gate?.proposal;
  const policy = artifact?.gate?.policy;
  let authorization = null;
  let binding = null;
  let verification = null;
  try {
    authorization = preflightStellarAgentPayment({ proposal, policy, nowSeconds: String(artifact.gate.pinnedNowSeconds) });
    binding = bindStellarAuthorization({ authorization, envelopeXdr: proposal.envelopeXdr, observed: proposal.envelopeProjection });
    verification = verifyStellarSubmissionEvidence({ binding, evidence: artifact.gate.evidence });
  } catch (e) {
    add("gate:replay", false, `gate replay threw: ${String(e && e.message ? e.message : e)}`);
  }
  if (authorization) add("gate:authorization", authorization.status === "OK" && authorization.verdict === "ALLOW", "offline replay must return ALLOW");
  if (binding) add("gate:binding", binding.status === "OK" && binding.statusValue === "BOUND", "offline replay must bind the exact bytes");
  if (verification) add("gate:evidence", verification.status === "OK" && verification.verdict === "VERIFIED", "offline replay must verify the submitted evidence");
  add("gate:recordedDigest", artifact?.gate?.authorizationDigest === authorization?.boundDigest, "recorded authorization digest must match replay");
  add("gate:recordedEvidenceDigest", artifact?.gate?.evidenceDigest === verification?.evidenceDigest, "recorded evidence digest must match replay");

  const tx = artifact?.transaction || {};
  const fin = artifact?.finality || {};
  add("chain:successful", tx.successful === true, "Horizon must report success");
  add("chain:ledger", Number.isInteger(tx.ledger) && tx.ledger > 0, "Horizon must report a positive ledger");
  add("finality:closed", fin.ledgerClosed === true && !!fin.ledgerClosedAt, "ledger must be closed with a timestamp");
  add("finality:ledgerMatch", Number(fin.ledgerSequence) === Number(tx.ledger), "closed ledger sequence must match the transaction ledger");
  add("finality:latest", Number(fin.latestLedger) >= Number(tx.ledger), "latest ledger must be at least the transaction ledger");
  add("finality:confirmations", Number(fin.confirmations) >= 1, "at least one subsequent ledger must be observed");
  add("finality:independentReRead", fin.independentReRead === true && fin.reReadHash === tx.hash && fin.reReadLedger === tx.ledger && fin.reReadSuccessful === true, "independent re-read must agree with the submitted transaction");
  add("finality:reReadBytes", fin.reReadEnvelopeXdr === tx.envelopeXdr && fin.reReadResultXdr === tx.resultXdr, "re-read envelope and result bytes must match");
  add("finality:ledgerHash", /^[0-9a-f]{64}$/.test(String(fin.ledgerHash || "")), "closed ledger hash must be 64 lowercase hex characters");

  const b = artifact?.balances || {};
  const amount = stroops(b.amount);
  // `feeStroops` is an integer stroops count (Horizon's legacy fee unit), not
  // a decimal XLM string; parsing it with stroops() would multiply it by 10^7.
  const fee = /^\d+$/.test(String(b.feeStroops)) ? BigInt(String(b.feeStroops)) : null;
  const srcBefore = stroops(b.sourceBefore);
  const dstBefore = stroops(b.destinationBefore);
  const srcAfter = stroops(b.sourceAfter);
  const dstAfter = stroops(b.destinationAfter);
  add("balances:parsed", [amount, fee, srcBefore, dstBefore, srcAfter, dstAfter].every((v) => v !== null), "all balances and amounts must be exact decimals");
  if ([amount, fee, srcBefore, dstBefore, srcAfter, dstAfter].every((v) => v !== null)) {
    add("balances:source", srcAfter === srcBefore - amount - fee, "source delta must equal amount + fee exactly");
    add("balances:destination", dstAfter === dstBefore + amount, "destination delta must equal amount exactly");
  }
  add("artifact:digest", artifact?.integrity?.digest === artifactDigest(artifact), "artifact integrity digest must match the saved bytes");
  const forbidden = ["secretKey", "privateKey", "mnemonic", "seed", "rawSecret"];
  const leaked = (() => {
    const hits = [];
    const walk = (v, path = "$") => {
      if (v === null || typeof v !== "object") return;
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
      for (const [k, value] of Object.entries(v)) {
        if (forbidden.includes(k)) hits.push(`${path}.${k}`);
        walk(value, `${path}.${k}`);
      }
    };
    walk(artifact);
    return hits;
  })();
  add("secret:no-material", leaked.length === 0, leaked.join(",") || "no secret fields in artifact");
  return { ok: checks.every((c) => c.ok), checks };
}

async function main() {
  const { plan, violations } = parsePlan(process.argv.slice(2));
  if (violations.length) return fail("PLAN_REFUSED", violations.join("; "));

  if (plan.verifyPath) {
    const artifact = JSON.parse(readFileSync(join(ROOT, plan.verifyPath), "utf8"));
    const decisionText = readFileSync(join(ROOT, DECISION_REL), "utf8");
    const result = verifyArtifactOffline(artifact, decisionText);
    return {
      status: result.ok ? "VERIFY_OK" : "VERIFY_FAILED",
      code: result.ok ? null : "OFFLINE_REPLAY_FAILED",
      artifact: plan.verifyPath,
      decision: DECISION_REL,
      checks: result.checks,
      boundary: SETTLEMENT_BOUNDARY,
    };
  }

  const decision = readDecision();
  if (!decision.ok) return fail("DECISION_REFUSED", decision.violations.join("; "));

  const source = Keypair.random();
  const destination = Keypair.random();
  const sourcePublicKey = source.publicKey();
  const destinationPublicKey = destination.publicKey();

  try {
    await fund(`${FRIENDBOT}?addr=${encodeURIComponent(sourcePublicKey)}`);
    await fund(`${FRIENDBOT}?addr=${encodeURIComponent(destinationPublicKey)}`);
  } catch (e) {
    return fail("FUNDING_FAILED", String(e && e.message ? e.message : e), { sourcePublicKey, destinationPublicKey });
  }

  const server = new Horizon.Server(ENDPOINT);
  let sourceAccount;
  let destinationAccount;
  try {
    sourceAccount = await server.loadAccount(sourcePublicKey);
    destinationAccount = await server.loadAccount(destinationPublicKey);
  } catch (e) {
    return fail("ACCOUNT_READ_FAILED", String(e && e.message ? e.message : e), { sourcePublicKey, destinationPublicKey });
  }

  const now = Math.floor(Date.now() / 1000);
  const timeBounds = { minTime: String(now - 30), maxTime: String(now + 180) };
  const tx = new TransactionBuilder(sourceAccount, {
    fee: FEE,
    networkPassphrase: PASSPHRASE,
    timebounds: timeBounds,
  })
    .addOperation(Operation.payment({ destination: destinationPublicKey, asset: Asset.native(), amount: AMOUNT }))
    .addMemo(Memo.text(MEMO))
    .build();
  tx.sign(source);
  const envelopeXdr = tx.toXDR();
  const derivedHash = Buffer.from(tx.hash()).toString("hex");
  const signatureHex = Buffer.from(tx.signatures[0].signature.value).toString("hex");
  const signatureProof = verifySignatureProof({ envelopeXdr, publicKey: sourcePublicKey, signatureHex, txHash: derivedHash });
  if (!signatureProof.ok) return fail("SIGNATURE_REFUSED", "local signature proof failed before submission", { signatureProof, sourcePublicKey, destinationPublicKey });

  const projection = {
    network: "testnet",
    sourceAccount: sourcePublicKey,
    destination: destinationPublicKey,
    asset: "native",
    amount: AMOUNT,
    memo: MEMO,
    sequence: String(sourceAccount.sequence),
  };
  const proposal = {
    ...projection,
    envelopeXdr,
    envelopeProjection: projection,
    nonce: `owner-settlement-${derivedHash.slice(0, 16)}`,
    scopes: ["pay"],
    agentScopes: ["pay", "read"],
    timeBounds,
    purpose: "owner-delegated Testnet signing and settlement proof",
  };
  const policy = {
    allowedNetworks: ["testnet"],
    allowedAssets: ["native"],
    allowedDestinations: [destinationPublicKey],
    maxAmount: "5",
    requireMemo: true,
    requireNonce: true,
    requireTimeBounds: true,
    requiredScopes: ["pay"],
    usedNonces: [],
  };
  const authorization = preflightStellarAgentPayment({ proposal, policy, nowSeconds: String(now) });
  if (authorization.status !== "OK" || authorization.verdict !== "ALLOW") {
    return fail("PREFLIGHT_REFUSED", "CG-SG/1 refused before any submission", { authorization, sourcePublicKey, destinationPublicKey });
  }
  const binding = bindStellarAuthorization({ authorization, envelopeXdr, observed: projection });
  if (binding.status !== "OK" || binding.statusValue !== "BOUND") {
    return fail("BINDING_REFUSED", "exact-byte binding refused before submission", { binding, sourcePublicKey, destinationPublicKey });
  }

  let submitted;
  try {
    submitted = await server.submitTransaction(tx);
  } catch (e) {
    return fail("SUBMIT_FAILED", String(e && e.message ? e.message : e), { sourcePublicKey, destinationPublicKey, derivedHash });
  }
  if (submitted.successful !== true || !Number(submitted.ledger)) {
    return fail("SUBMIT_UNSUCCESSFUL", "Horizon did not report a successful transaction in a ledger", { submittedHash: submitted.hash, sourcePublicKey, destinationPublicKey });
  }

  let finality = null;
  for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
    const [txRead, ledgerRead, root] = await Promise.all([
      getJson(`${ENDPOINT}/transactions/${encodeURIComponent(derivedHash)}`),
      getJson(`${ENDPOINT}/ledgers/${Number(submitted.ledger)}`),
      getJson(`${ENDPOINT}/`),
    ]);
    const ledgerRecord = ledgerRead.ok && ledgerRead.body ? ledgerRead.body : null;
    const txRecord = txRead.ok && txRead.body ? txRead.body : null;
    const latestLedger = Number(root.body?.history_latest_ledger ?? root.body?.core_latest_ledger ?? 0);
    if (
      txRecord &&
      txRecord.successful === true &&
      String(txRecord.hash).toLowerCase() === derivedHash &&
      String(txRecord.envelope_xdr) === envelopeXdr &&
      String(txRecord.result_xdr) === String(submitted.result_xdr) &&
      ledgerRecord &&
      ledgerRecord.closed_at &&
      Number(ledgerRecord.sequence) === Number(submitted.ledger) &&
      latestLedger >= Number(submitted.ledger) + 1
    ) {
      finality = {
        ledgerClosed: true,
        ledgerSequence: Number(ledgerRecord.sequence),
        ledgerClosedAt: ledgerRecord.closed_at,
        ledgerHash: String(ledgerRecord.hash || "").toLowerCase(),
        successfulTransactionCount: Number(ledgerRecord.successful_transaction_count ?? 0),
        failedTransactionCount: Number(ledgerRecord.failed_transaction_count ?? 0),
        latestLedger,
        confirmations: latestLedger - Number(submitted.ledger),
        independentReRead: true,
        reReadAtUtc: new Date().toISOString(),
        reReadHash: String(txRecord.hash).toLowerCase(),
        reReadLedger: Number(txRecord.ledger),
        reReadSuccessful: txRecord.successful === true,
        reReadEnvelopeXdr: String(txRecord.envelope_xdr),
        reReadResultXdr: String(txRecord.result_xdr),
        reReadCreatedAt: txRecord.created_at ?? null,
      };
      break;
    }
    if (attempt < POLL_LIMIT - 1) await sleep(POLL_MS);
  }
  if (!finality) return fail("FINALITY_TIMEOUT", "closed-ledger confirmation was not observed within the polling budget", { derivedHash, submittedHash: submitted.hash, sourcePublicKey, destinationPublicKey });

  let sourceAfter;
  let destinationAfter;
  try {
    sourceAfter = await server.loadAccount(sourcePublicKey);
    destinationAfter = await server.loadAccount(destinationPublicKey);
  } catch (e) {
    return fail("BALANCE_READ_FAILED", String(e && e.message ? e.message : e), { sourcePublicKey, destinationPublicKey });
  }
  const sourceBefore = nativeBalance(sourceAccount);
  const destBefore = nativeBalance(destinationAccount);
  const srcAfterBalance = nativeBalance(sourceAfter);
  const dstAfterBalance = nativeBalance(destinationAfter);
  const amountStroops = stroops(AMOUNT);
  const feeStroops = stroops(String(submitted.fee_charged ?? FEE));
  const feeUnitDivisor = 10000000n;
  const networkFeeStroops = feeStroops > 1000000n ? feeStroops / feeUnitDivisor : feeStroops;
  const sourceBeforeStroops = stroops(sourceBefore);
  const destBeforeStroops = stroops(destBefore);
  const sourceAfterStroops = stroops(srcAfterBalance);
  const destAfterStroops = stroops(dstAfterBalance);
  if ([sourceBeforeStroops, destBeforeStroops, sourceAfterStroops, destAfterStroops].some((v) => v === null)) {
    return fail("BALANCE_PARSE_FAILED", "Horizon returned a native balance that is not an exact 7-decimal XLM value", { sourceBefore, sourceAfter: srcAfterBalance, destinationBefore: destBefore, destinationAfter: dstAfterBalance });
  }
  // Horizon 30 reports `fee_charged` in XLM with 7 decimals (e.g. "100.0000000"
  // for a 100-stroop fee), while older Horizon versions report integer stroops.
  // Normalize both forms before comparing public balances.
  const expectedSourceAfter = sourceBeforeStroops - amountStroops - networkFeeStroops;
  const expectedDestinationAfter = destBeforeStroops + amountStroops;
  const fmt = (value) => {
    const s = String(value).padStart(8, "0");
    return `${s.slice(0, -7)}.${s.slice(-7)}`;
  };
  const balances = {
    asset: "native",
    amount: AMOUNT,
    amountStroops: String(amountStroops),
    feeStroops: String(networkFeeStroops),
    feeReportedByHorizon: String(submitted.fee_charged ?? FEE),
    sourceBefore,
    sourceAfter: srcAfterBalance,
    expectedSourceAfter: fmt(expectedSourceAfter),
    destinationBefore: destBefore,
    destinationAfter: dstAfterBalance,
    expectedDestinationAfter: fmt(expectedDestinationAfter),
    exact: sourceAfterStroops === expectedSourceAfter && destAfterStroops === expectedDestinationAfter,
    feeNormalization: "Horizon fee_charged is accepted as integer stroops or 7-decimal XLM; this run normalized the reported value to stroops before computing the source delta",
  };
  if (!balances.exact) return fail("BALANCE_DELTA_MISMATCH", "public balances did not change by amount + fee and amount exactly", { balances, sourcePublicKey, destinationPublicKey });

  const evidence = {
    network: "testnet",
    envelopeXdr,
    txHash: derivedHash,
    successful: true,
    ledger: Number(submitted.ledger),
    resultXdr: String(submitted.result_xdr),
    operation: projection,
  };
  const verification = verifyStellarSubmissionEvidence({ binding, evidence });
  if (verification.status !== "OK" || verification.verdict !== "VERIFIED") {
    return fail("EVIDENCE_REFUSED", "CG-SG/1 refused the observed submission evidence", { verification, sourcePublicKey, destinationPublicKey });
  }
  const pack = exportStellarEvidencePack({
    items: [
      { kind: "decision", marker: DECISION_MARKER, path: DECISION_REL },
      { kind: "authorization", verdict: authorization.verdict, digest: authorization.boundDigest },
      { kind: "binding", status: binding.statusValue, digest: binding.envelopeDigest },
      { kind: "signature", publicKey: sourcePublicKey, hash: derivedHash, verified: signatureProof.ok },
      { kind: "submission", hash: derivedHash, ledger: Number(submitted.ledger), resultXdr: evidence.resultXdr },
      { kind: "finality", closedAt: finality.ledgerClosedAt, ledgerHash: finality.ledgerHash, confirmations: finality.confirmations },
      { kind: "balances", sourceBefore, sourceAfter: srcAfterBalance, destinationBefore: destBefore, destinationAfter: dstAfterBalance },
    ],
    redactFields: ["secretKey", "privateKey", "mnemonic", "seed", "callerContext"],
  });
  if (pack.status !== "OK") return fail("EVIDENCE_PACK_REFUSED", "redacted evidence pack could not be built", { pack, sourcePublicKey, destinationPublicKey });

  const artifact = {
    status: "SETTLEMENT_RECORDED",
    spec: "CG-SETTLE/1",
    network: "testnet",
    endpoint: ENDPOINT,
    friendbot: FRIENDBOT,
    networkPassphrase: PASSPHRASE,
    authority: {
      decision: DECISION_REL,
      marker: DECISION_MARKER,
      ownerQuote: "اعمل التسوية والتوقيع دا دا تفويض وصلاحية مني انا المالك",
      delegatedSigning: true,
      ownerHeldKey: false,
      mainnet: false,
      sourceOfAuthority: "recorded owner session message 2026-11-26",
    },
    parties: {
      sourcePublicKey,
      destinationPublicKey,
      keyOrigin: "agent-generated ephemeral keypairs under recorded owner delegation",
      keyDiscipline: "secret material used in-process only; never written, logged, printed or exported",
    },
    signing: {
      algorithm: "ed25519",
      publicKey: sourcePublicKey,
      signatureHex,
      signatureBytes: 64,
      hash: derivedHash,
      verified: signatureProof.ok,
      checks: signatureProof.checks,
    },
    gate: {
      version: "CG-SG/1",
      boundary: STELLAR_GATE_BOUNDARY,
      proposal,
      policy,
      pinnedNowSeconds: String(now),
      authorizationVerdict: authorization.verdict,
      authorizationDigest: authorization.boundDigest,
      bindingStatus: binding.statusValue,
      envelopeDigest: binding.envelopeDigest,
      evidence,
      evidenceDigest: verification.evidenceDigest,
      verificationVerdict: verification.verdict,
      breaks: verification.summary?.breaks ?? [],
    },
    transaction: {
      hash: derivedHash,
      submittedHash: String(submitted.hash).toLowerCase(),
      ledger: Number(submitted.ledger),
      successful: submitted.successful === true,
      createdAt: submitted.created_at ?? null,
      resultXdr: String(submitted.result_xdr),
      envelopeXdr,
      feeCharged: String(submitted.fee_charged ?? FEE),
    },
    finality,
    balances,
    evidencePackDigest: pack.packDigest,
    integrity: { digest: null, rule: "sha256 canonical JSON over status, network, authority, parties, signing, gate, transaction, finality, balances and evidencePackDigest; excludes recordedAtUtc and replay" },
    replay: `node scripts/stellar-owner-settlement.mjs --verify ${plan.writePath ?? "docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json"}`,
    boundary: SETTLEMENT_BOUNDARY,
    claim: "An owner-delegated ephemeral key signed a real Testnet payment; Horizon accepted it and a closed Testnet ledger contains the exact signed bytes with exact balance deltas. This is Testnet ledger-closed evidence only, not owner-held-key use, Mainnet settlement, production readiness, safety, compliance or legal finality.",
    recordedAtUtc: new Date().toISOString(),
  };
  artifact.integrity.digest = artifactDigest(artifact);
  return artifact;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    const result = await main();
    const text = JSON.stringify(result, null, 2) + "\n";
    const { plan } = parsePlan(process.argv.slice(2));
    if (plan.writePath && !plan.verifyPath && result.status === "SETTLEMENT_RECORDED") {
      writeFileSync(join(ROOT, plan.writePath), text);
      console.error(`wrote ${plan.writePath}`);
    }
    console.log(text);
    process.exitCode = ["SETTLEMENT_RECORDED", "VERIFY_OK"].includes(result.status) ? 0 : 1;
  } catch (e) {
    console.error(`UNEXPECTED_FAILURE: ${String(e && e.stack ? e.stack : e)}`);
    process.exitCode = 2;
  }
}
