#!/usr/bin/env node
/**
 * CoreGuard x Stellar - Integration Pilot demo.
 *
 * A runnable, offline-first demonstration of how an external Stellar project
 * (Soroban DApp, wallet, DEX, agent) adopts CoreGuard as its execution-truth
 * + fail-closed gate: authorize (PRE) -> execute -> verify (POST) -> anchor ->
 * DDE/1 payout gate (HOLD until party acceptance).
 *
 * Default: offline, no keys, no network, no money. With --tx <hash> it performs
 * a read-only Stellar mainnet verification (no submit, no signing).
 *
 * Usage:
 *   node examples/stellar-integration-pilot/demo.mjs
 *   node examples/stellar-integration-pilot/demo.mjs --tx <stellar-tx-hash>
 */

import { createIntent } from "../../packages/intent/index.js";
import { createPolicy } from "../../packages/policy/index.js";
import * as EVM from "../../packages/evm/index.js";
import { createGuard } from "../../packages/sdk/index.js";

const guard = createGuard();

const STELLAR_ANCHOR = "CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP";
const STELLAR_WALLET = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";

const CHAIN = "1116";
const PRIV = EVM.keccakHex("coreguard stellar integration pilot owner key");
const PUB = EVM.publicKeyFromPrivateKey(PRIV);
const MINE = EVM.addressFromPublicKey(PUB);
const SOROBAN_CONTRACT = "0x1111111111111111111111111111111111111111";
const SELECTOR = "0xa9059cbb";
const AMOUNT = "1000000";
const SLIPPAGE_BPS = 50;

function hr(title) { console.log("\n" + "=".repeat(72)); console.log("  " + title); console.log("=".repeat(72)); }

function buildIntent(overrides = {}) {
  return createIntent({
    chainId: CHAIN,
    signer: MINE,
    nonce: "1",
    validAfter: "0",
    validUntil: String(Math.floor(Date.now() / 1000) + 3600),
    action: "SWAP",
    target: SOROBAN_CONTRACT,
    selector: SELECTOR,
    asset: "0x2222222222222222222222222222222222222222",
    amount: AMOUNT,
    recipient: MINE,
    constraints: [],
    ...overrides,
  });
}

function buildPolicy() {
  return createPolicy({
    policyId: "pol-stellar-swap",
    name: "Stellar Soroban swap policy (pilot)",
    rules: [
      { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: AMOUNT }, severity: "CRITICAL" },
      { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [SOROBAN_CONTRACT] }, severity: "CRITICAL" },
      { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MINE] }, severity: "CRITICAL" },
      { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: [SELECTOR] }, severity: "CRITICAL" },
      { ruleId: "SLIPPAGE_001", type: "SLIPPAGE_BPS", params: { bps: String(SLIPPAGE_BPS) }, severity: "HIGH" },
    ],
  });
}

function buildSimulation(intent) {
  return {
    target: SOROBAN_CONTRACT,
    selector: SELECTOR,
    recipient: MINE,
    amount: AMOUNT,
    received: AMOUNT,
    gasUsed: "70230",
    blockTimestamp: "100",
    slippageBps: "10",
  };
}

function encodeCalldata(to, amount) {
  return SELECTOR + to.slice(2).padStart(64, "0") + BigInt(amount).toString(16).padStart(64, "0");
}

function buildTrace(intent) {
  const calldata = encodeCalldata(intent.recipient, intent.amount);
  return {
    version: "CGEP/1",
    txHash: "0x" + "ab".repeat(32),
    from: MINE,
    to: intent.target,
    value: intent.amount,
    calldata,
    status: "SUCCESS",
    gasUsed: "70230",
    blockNumber: "123456",
    blockHash: "0x" + "cd".repeat(32),
    blockTimestamp: "100",
    calls: [{ depth: 0, from: MINE, to: intent.target, value: "0x0", calldata, returnData: "0x", status: "SUCCESS", gasUsed: "70000" }],
    events: [{ address: intent.target, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], data: "0x" }],
    balanceChanges: [],
    storageChanges: [],
  };
}

const TYPES = { ManifestDeclaration: [{ name: "manifestId", type: "bytes32" }] };

async function computeManifestIdOf(declaration) {
  const { computeManifestId } = await import("../../packages/intent/authorization.js");
  return computeManifestId(declaration);
}

async function signDeclaration(declaration) {
  const d = { ...declaration };
  delete d.manifestId;
  delete d.signature;
  d.manifestId = await computeManifestIdOf(d);
  const digest = EVM.typedDataDigest("ManifestDeclaration", TYPES, { manifestId: d.manifestId }, d.chainId);
  const sig = await EVM.signDigest(digest, PRIV);
  d.signature = {
    scheme: "EIP-712",
    signer: d.signerBinding.address,
    ...sig,
    digest: "0x" + Buffer.from(digest).toString("hex"),
  };
  return d;
}

async function signedIntent() {
  const intent = buildIntent();
  const declaration = {
    version: "CGEP/1",
    kind: "INTENT_DECLARATION",
    chainId: intent.chainId,
    nonce: String(intent.nonce),
    signerBinding: { address: intent.signer },
    intent,
  };
  return { intent, declaration: await signDeclaration(declaration) };
}

async function main() {
  const args = process.argv.slice(2);
  const txFlag = args.indexOf("--tx");
  const txHash = txFlag >= 0 ? args[txFlag + 1] : null;

  hr("CoreGuard x Stellar - Integration Pilot (offline-first, fail-closed)");
  console.log("  Anchor (Stellar Soroban mainnet): " + STELLAR_ANCHOR);
  console.log("  Wallet  (live Horizon account)  : " + STELLAR_WALLET);
  console.log("  Mode    : " + (txHash ? "live read-only verify (--tx " + txHash + ")" : "offline (no network, no keys, no money)"));

  const guard = createGuard();
  const signed = await signedIntent();
  const policy = buildPolicy();
  const simulation = buildSimulation(signed.intent);

  // 1. AUTHORIZE (PRE)
  hr("1. AUTHORIZE (PRE) - guard.authorize");
  const pre = await guard.authorize(signed.intent, {
    declaration: signed.declaration,
    policy,
    activePolicyIds: [policy.policyId],
    authorityAtState: "11600000",
    simulation,
    writer: "stellar-integration-pilot",
    evm: EVM,
  });
  console.log("  decision: " + pre.decision + "  (status=" + pre.status + ")");
  if (pre.decision !== "ALLOW") { console.error("expected ALLOW, got " + pre.decision); process.exit(1); }

  // 2. EXECUTE + CAPTURE
  hr("2. EXECUTE + CAPTURE (partner's Stellar action)");
  const trace = buildTrace(signed.intent);
  if (txHash) trace.txHash = txHash;
  console.log("  txHash : " + trace.txHash);
  console.log("  block  : " + trace.blockNumber);

  // 3. VERIFY (POST)
  hr("3. VERIFY (POST) - guard.verify");
  const v = await guard.verify({ chain: "1116", intent: signed.intent, policy, trace });
  console.log("  verdict:   " + v.verdict + "  (level=" + v.verificationLevel + ")");
  console.log("  receiptId: " + v.receiptId);
  if (v.verdict !== "VERIFIED") { console.error("expected VERIFIED, got " + v.verdict); process.exit(1); }

  // 4. ANCHOR
  hr("4. ANCHOR - guard.anchor (CGEP/1 commitment plan, no broadcast)");
  const plan = await guard.anchor(v.receipt);
  console.log("  commitment: " + plan.commitment);
  console.log("  proofId:    " + plan.proofId);
  console.log("  status:     " + plan.status);

  // 5. DDE/1 payout gate
  hr("5. DDE/1 PAYOUT GATE - release only on party acceptance");
  console.log("  Gate rule: execution verification does NOT decide delivery conformity.");
  console.log("  VERIFIED receipt + party REJECTED  => HOLD (neither decides conformity)");
  console.log("  VERIFIED receipt + party ACCEPTED  => RELEASE");
  console.log("  Tampered artifact byte             => 422 (E3 names the byte + both hashes)");
  console.log("  releaseWhen(report, () => acceptanceOnFile() === 'ACCEPTED')");

  hr("RESULT");
  console.log("  PRE  (authorize) : " + pre.decision);
  console.log("  POST (verify)    : " + v.verdict);
  console.log("  Anchor           : " + plan.status + " (offline, no broadcast)");
  console.log("  Payout gate      : HOLD until party acceptance (fail-closed)");
  console.log("");
  console.log("  This is the flow a Stellar partner ships: authorize -> execute -> verify -> anchor -> gate.");
  console.log("  Stellar mainnet anchor: " + STELLAR_ANCHOR);
  console.log("  Run with --tx <hash> to verify a real Stellar mainnet tx (read-only).");
}

main().catch((e) => { console.error("ERR", e && e.message); if (e && e.stack) console.error(e.stack); process.exit(1); });
