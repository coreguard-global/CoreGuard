#!/usr/bin/env node
/**
 * stellar-testnet-proof.mjs — OPTIONAL, MANUAL P5 technical proof.
 *
 * This script performs a REAL Stellar Testnet transaction using a fresh
 * ephemeral keypair and public endpoints. It is deliberately NOT part of
 * `npm test`: it performs network I/O, uses Friendbot, and submits a signed
 * transaction. It must never be described as a customer, pilot, owner-held
 * key run, signing authority, production compatibility or security evidence.
 *
 * Safety: nothing happens unless --i-understand-this-submits-a-real-testnet-transaction
 * is supplied. The generated secret key is used in memory only and never
 * written, logged or returned.
 *
 * Usage:
 *   node scripts/stellar-testnet-proof.mjs \
 *     --i-understand-this-submits-a-real-testnet-transaction [--write docs/STELLAR-TESTNET-PROOF.json]
 */

import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder, Horizon } from "@stellar/stellar-sdk";
import {
  preflightStellarAgentPayment,
  bindStellarAuthorization,
  verifyStellarSubmissionEvidence,
  STELLAR_GATE_BOUNDARY,
} from "../packages/agent-commerce/stellar-gate.mjs";
import { writeFileSync } from "node:fs";

const CONSENT = "--i-understand-this-submits-a-real-testnet-transaction";
const args = process.argv.slice(2);
const writeIndex = args.indexOf("--write");
const outPath = writeIndex >= 0 ? args[writeIndex + 1] : null;
const explicitlyAllowed = args.includes(CONSENT);

if (!explicitlyAllowed) {
  console.error(`REFUSED: pass ${CONSENT} to perform a real Testnet submission.`);
  process.exit(2);
}
if (writeIndex >= 0 && (!outPath || outPath.startsWith("--"))) {
  console.error("REFUSED: --write needs a file path.");
  process.exit(2);
}

const ENDPOINT = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const MEMO = "cg-sg-proof";
const AMOUNT = "1";

const fail = (code, detail, extra = {}) => ({
  status: "FAILED",
  code,
  detail,
  network: "testnet",
  endpoint: ENDPOINT,
  friendbot: FRIENDBOT,
  boundary: STELLAR_GATE_BOUNDARY,
  claim: "No successful Testnet submission is claimed by this failure.",
  ...extra,
});

async function postJson(url) {
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try { body = text.length ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  // The secret is used only for tx.sign() in this process. It is never persisted.
  const funded = await postJson(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!funded.ok) return fail("FRIENDBOT_FAILED", `Friendbot returned HTTP ${funded.status}`, { publicKey });

  const server = new Horizon.Server(ENDPOINT);
  let account;
  try {
    account = await server.loadAccount(publicKey);
  } catch (e) {
    return fail("ACCOUNT_READ_FAILED", String(e && e.message ? e.message : e), { publicKey });
  }

  const now = Math.floor(Date.now() / 1000);
  const timeBounds = { minTime: String(now - 30), maxTime: String(now + 180) };
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: timeBounds,
  })
    .addOperation(Operation.payment({ destination: publicKey, asset: Asset.native(), amount: AMOUNT }))
    .addMemo(Memo.text(MEMO))
    .build();
  tx.sign(keypair);
  const envelopeXdr = tx.toXDR();

  const projection = {
    network: "testnet",
    sourceAccount: publicKey,
    destination: publicKey,
    asset: "native",
    amount: AMOUNT,
    memo: MEMO,
    sequence: String(account.sequence),
  };
  const proposal = {
    ...projection,
    envelopeXdr,
    envelopeProjection: projection,
    nonce: `testnet-proof-${publicKey.slice(0, 12)}`,
    scopes: ["pay"],
    agentScopes: ["pay", "read"],
    timeBounds,
    purpose: "CG-SG/1 synthetic Testnet proof",
  };
  const policy = {
    allowedNetworks: ["testnet"],
    allowedAssets: ["native"],
    allowedDestinations: [publicKey],
    maxAmount: "5",
    requireMemo: true,
    requireNonce: true,
    requireTimeBounds: true,
    requiredScopes: ["pay"],
    usedNonces: [],
  };
  const authorization = preflightStellarAgentPayment({ proposal, policy, nowSeconds: String(now) });
  if (authorization.status !== "OK" || authorization.verdict !== "ALLOW") {
    return fail("PREFLIGHT_REFUSED", "gate refused before any submission", { publicKey, authorization });
  }
  const binding = bindStellarAuthorization({ authorization, envelopeXdr, observed: projection });
  if (binding.status !== "OK" || binding.statusValue !== "BOUND") {
    return fail("BINDING_REFUSED", "gate refused before any submission", { publicKey, binding });
  }

  let submitted;
  try {
    submitted = await server.submitTransaction(tx);
  } catch (e) {
    return fail("SUBMIT_FAILED", String(e && e.message ? e.message : e), { publicKey });
  }

  const evidence = {
    network: "testnet",
    envelopeXdr,
    txHash: String(submitted.hash || "").toLowerCase(),
    successful: submitted.successful === true,
    ledger: Number(submitted.ledger),
    resultXdr: String(submitted.result_xdr || ""),
    operation: projection,
  };
  const verification = verifyStellarSubmissionEvidence({ binding, evidence });
  const pass = verification.status === "OK" && verification.verdict === "VERIFIED";

  return {
    status: pass ? "PROOF_RECORDED" : "PROOF_INCOMPLETE",
    network: "testnet",
    endpoint: ENDPOINT,
    friendbot: FRIENDBOT,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey,
    keys: "Ephemeral agent-generated keypair; secret used in memory only, never written or logged; not owner-held keys.",
    transaction: {
      hash: evidence.txHash,
      ledger: evidence.ledger,
      successful: evidence.successful,
      resultXdr: evidence.resultXdr,
      createdAt: submitted.created_at ?? null,
    },
    gate: {
      authorizationVerdict: authorization.verdict,
      authorizationDigest: authorization.boundDigest,
      bindingStatus: binding.statusValue,
      evidenceDigest: verification.evidenceDigest,
      verificationVerdict: verification.verdict ?? verification.status,
      breaks: verification.summary?.breaks ?? [],
    },
    replay: "node scripts/stellar-testnet-proof.mjs is a live script; offline replay uses packages/agent-commerce/stellar-gate.mjs with the saved envelopeXdr, binding and evidence fields.",
    boundary: STELLAR_GATE_BOUNDARY,
    claim: "Synthetic technical proof only. Not a customer, pilot, sponsor, audit, funding, production compatibility, owner-held-key run or signing-authority claim. No Mainnet or production action is implied.",
    recordedAtUtc: new Date().toISOString(),
  };
}

try {
  const result = await main();
  const text = JSON.stringify(result, null, 2) + "\n";
  if (outPath) {
    writeFileSync(outPath, text);
    console.error(`wrote ${outPath}`);
  }
  console.log(text);
  process.exitCode = result.status === "PROOF_RECORDED" ? 0 : 1;
} catch (e) {
  console.error(`UNEXPECTED_FAILURE: ${String(e && e.stack ? e.stack : e)}`);
  process.exitCode = 2;
}
