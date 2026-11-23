/**
 * Real x402 / settlement verifier adapter (CG-X402/1)
 *
 * This adapter NEVER signs, broadcasts, custodies, or moves funds. It asks a
 * real external settlement verifier whether caller-supplied payment evidence
 * matches a parsed x402 challenge, then re-checks the response locally so a
 * compromised or mistaken verifier cannot inflate the verdict.
 */

import { readFileSync } from "node:fs";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import {
  INTEGRATIONS_VERSION, INTEGRATIONS_BOUNDARY, requireProvisioned, canonicalJson,
  domainDigest, safeEqual, requestJson, verdict, nowIso, isPlaceholder,
} from "./common.mjs";

export const X402_VERSION = "CG-X402/1";

const ALLOWED_STATUS = Object.freeze(["SETTLED", "SETTLEMENT_CONFIRMED"]);
const SETTLED_STATUSES = Object.freeze(["SETTLED", "SETTLEMENT_CONFIRMED", "CONFIRMED", "COMPLETED", "SUCCESS"]);

function requiredString(obj, key, path) {
  const v = obj?.[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${path}.${key} must be a non-empty string`);
  return v;
}

function optionalString(obj, key) {
  const v = obj?.[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new Error(`${key} must be a string when supplied`);
  return v;
}

function amountKey(amount) {
  if (typeof amount === "string" || typeof amount === "number") return String(amount);
  if (amount && typeof amount === "object") {
    if (amount.minor !== undefined) return String(amount.minor);
    if (amount.value !== undefined) return String(amount.value);
  }
  return null;
}

function parseChallenge(input) {
  const c = input?.challenge ?? input;
  if (!c || typeof c !== "object" || Array.isArray(c)) throw new Error("challenge must be an object");
  const out = {
    scheme: requiredString(c, "scheme", "challenge").toLowerCase(),
    network: requiredString(c, "network", "challenge").toLowerCase(),
    asset: requiredString(c, "asset", "challenge").toUpperCase(),
    payTo: requiredString(c, "payTo", "challenge"),
    amount: amountKey(c.amount),
    nonce: requiredString(c, "nonce", "challenge"),
    resource: optionalString(c, "resource"),
    expiresAt: optionalString(c, "expiresAt"),
  };
  if (out.amount === null) throw new Error("challenge.amount must be present");
  if (out.scheme !== "x402" && !out.scheme.startsWith("x402")) {
    throw new Error(`unsupported challenge scheme: ${out.scheme}`);
  }
  if (out.expiresAt) {
    const t = Date.parse(out.expiresAt);
    if (!Number.isFinite(t)) throw new Error("challenge.expiresAt must be an ISO-8601 timestamp");
    if (t <= Date.now()) throw new Error("challenge expired before verification");
  }
  return out;
}

function parsePayment(input) {
  const p = input?.payment ?? input;
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("payment evidence must be an object");
  return {
    txHash: requiredString(p, "txHash", "payment"),
    payer: optionalString(p, "payer"),
    amount: amountKey(p.amount),
    asset: optionalString(p, "asset")?.toUpperCase() ?? null,
    network: optionalString(p, "network")?.toLowerCase() ?? null,
    confirmations: p.confirmations === undefined ? 0 : Number(p.confirmations),
    settledAt: optionalString(p, "settledAt"),
    verifierId: optionalString(p, "verifierId"),
  };
}

/**
 * createSettlementVerifier(config)
 *   endpoint          real HTTPS verifier URL (required, no placeholders)
 *   apiKeyFile        path to a secret file read at call time (required unless allowLocal)
 *   network/asset     expected settlement context (required)
 *   minConfirmations  integer >= 0 (default 1)
 *   verifierPublicKeyPem  optional Ed25519/SHA256 key to authenticate verifier responses
 *   allowLocal        ONLY for local mock tests; never set in production config
 */
export function createSettlementVerifier(config = {}) {
  requireProvisioned(config, ["endpoint", "network", "asset"], { allowLocal: !!config.allowLocal });
  if (!config.allowLocal && !config.apiKeyFile) throw Object.assign(new Error("CG-X402/1: apiKeyFile is required"), { code: "NOT_PROVISIONED" });
  if (config.allowLocal && !!config.apiKeyFile && isPlaceholder(config.apiKeyFile)) {
    throw Object.assign(new Error("CG-X402/1: placeholder apiKeyFile in local mode"), { code: "NOT_PROVISIONED" });
  }
  const endpoint = String(config.endpoint).replace(/\/+$/, "");
  if (!config.allowLocal && !endpoint.startsWith("https://")) {
    throw Object.assign(new Error("CG-X402/1: production verifier endpoint must be HTTPS"), { code: "INSECURE_ENDPOINT" });
  }
  const minConfirmations = config.minConfirmations === undefined ? 1 : Number(config.minConfirmations);
  if (!Number.isInteger(minConfirmations) || minConfirmations < 0) throw new TypeError("minConfirmations must be a non-negative integer");

  const seen = new Set();

  function apiKey() {
    if (!config.apiKeyFile) return "local-test-key";
    return readFileSync(config.apiKeyFile, "utf8").trim();
  }

  function verifyVerifierSignature(body, signature) {
    if (!config.verifierPublicKeyPem) return { checked: false, ok: null };
    if (!signature) return { checked: true, ok: false, reason: "MISSING_VERIFIER_SIGNATURE" };
    try {
      const ok = cryptoVerify(
        null,
        Buffer.from(canonicalJson({ response: body }), "utf8"),
        createPublicKey(config.verifierPublicKeyPem),
        Buffer.from(signature, "base64"),
      );
      return { checked: true, ok: ok === true, reason: ok ? null : "VERIFIER_SIGNATURE_INVALID" };
    } catch (err) {
      return { checked: true, ok: false, reason: `VERIFIER_SIGNATURE_ERROR: ${err.message}` };
    }
  }

  async function verify(input = {}) {
    let challenge, payment, challengeDigest;
    try {
      challenge = parseChallenge(input);
      payment = parsePayment(input);
    } catch (err) {
      return verdict("INVALID_INPUT", { message: err.message });
    }

    challengeDigest = domainDigest("coreguard-x402-challenge/1", challenge);
    const issues = [];

    if (challenge.network !== String(config.network).toLowerCase()) issues.push("NETWORK_MISMATCH");
    if (challenge.asset !== String(config.asset).toUpperCase()) issues.push("ASSET_MISMATCH");
    if (payment.asset && payment.asset !== challenge.asset) issues.push("PAYMENT_ASSET_MISMATCH");
    if (payment.network && payment.network !== challenge.network) issues.push("PAYMENT_NETWORK_MISMATCH");
    if (payment.amount !== challenge.amount) issues.push("AMOUNT_MISMATCH");
    if (!Number.isFinite(payment.confirmations) || payment.confirmations < 0) issues.push("INVALID_CONFIRMATIONS");
    if (payment.confirmations < minConfirmations) issues.push("INSUFFICIENT_CONFIRMATIONS");
    if (!SETTLED_STATUSES.includes(String(input.upstreamStatus ?? "SETTLED").toUpperCase())) issues.push("UPSTREAM_STATUS_NOT_SETTLED");

    const replayKey = `${challenge.network}:${payment.txHash}`;
    if (seen.has(replayKey) || seen.has(challenge.nonce)) issues.push("REPLAYED_SETTLEMENT_EVIDENCE");
    if (issues.length > 0) {
      return verdict(issues[0], { issues, challengeDigest, paymentDigest: domainDigest("coreguard-x402-payment/1", payment) });
    }

    let response;
    try {
      response = await requestJson(`${endpoint}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey()}`,
          "Idempotency-Key": challengeDigest,
          "User-Agent": "CoreGuard-CG-X402/1",
        },
        body: { challengeDigest, challenge, payment, expected: { network: config.network, asset: config.asset, minConfirmations } },
        expectStatus: [200, 201],
        timeoutMs: config.timeoutMs ?? 8000,
        retries: config.retries ?? 2,
        label: "x402-settlement-verifier",
      });
    } catch (err) {
      return verdict("VERIFIER_UNREACHABLE", {
        issues: ["VERIFIER_UNREACHABLE"],
        challengeDigest,
        detail: err.detail ?? { message: err.message },
      });
    }

    const r = response.body;
    if (!r || typeof r !== "object") return verdict("INVALID_VERIFIER_RESPONSE", { issues: ["INVALID_VERIFIER_RESPONSE"], challengeDigest });

    const remoteIssues = [];
    if (!ALLOWED_STATUS.includes(String(r.status).toUpperCase()) && !SETTLED_STATUSES.includes(String(r.status).toUpperCase())) remoteIssues.push("VERIFIER_DID_NOT_CONFIRM_SETTLEMENT");
    if (r.network && String(r.network).toLowerCase() !== challenge.network) remoteIssues.push("VERIFIER_NETWORK_MISMATCH");
    if (r.asset && String(r.asset).toUpperCase() !== challenge.asset) remoteIssues.push("VERIFIER_ASSET_MISMATCH");
    if (r.payTo && String(r.payTo) !== challenge.payTo) remoteIssues.push("VERIFIER_PAY_TO_MISMATCH");
    if (r.amount !== undefined && amountKey(r.amount) !== challenge.amount) remoteIssues.push("VERIFIER_AMOUNT_MISMATCH");
    if (r.txHash && String(r.txHash) !== payment.txHash) remoteIssues.push("VERIFIER_TX_HASH_MISMATCH");
    if (r.confirmations !== undefined && Number(r.confirmations) < minConfirmations) remoteIssues.push("VERIFIER_INSUFFICIENT_CONFIRMATIONS");
    if (r.challengeDigest && !safeEqual(String(r.challengeDigest), challengeDigest)) remoteIssues.push("VERIFIER_CHALLENGE_DIGEST_MISMATCH");

    const { signature: responseSignature, ...signedResponse } = r;
    const sig = verifyVerifierSignature(signedResponse, responseSignature ?? null);
    if (sig.checked && !sig.ok) remoteIssues.push(sig.reason);

    const evidence = {
      challengeDigest,
      verifierResponseDigest: response.digest,
      verifierId: r.verifierId ?? null,
      txHash: r.txHash ?? payment.txHash,
      confirmations: r.confirmations ?? payment.confirmations,
      network: challenge.network,
      asset: challenge.asset,
      amount: challenge.amount,
      verifiedAt: nowIso(),
    };

    if (remoteIssues.length > 0) {
      return verdict("VERIFIER_RESPONSE_REFUSED", { issues: remoteIssues, evidence, response: r });
    }

    seen.add(replayKey);
    seen.add(challenge.nonce);

    return verdict("OK", {
      evidence,
      response: r,
      signatureChecked: sig.checked,
      note: "Settlement status was confirmed by an external verifier; CoreGuard did not sign, broadcast, or custody funds.",
    });
  }

  return Object.freeze({ spec: X402_VERSION, boundary: INTEGRATIONS_BOUNDARY, verify });
}

export function selfCheck() {
  const checks = [];
  const push = (name, ok) => checks.push({ name, ok: ok === true });
  push("exports", typeof createSettlementVerifier === "function" && X402_VERSION === "CG-X402/1");
  let refused = false;
  try { createSettlementVerifier({ endpoint: "https://idp.example.com", network: "stellar", asset: "USDC" }); } catch (e) { refused = e.code === "NOT_PROVISIONED"; }
  push("refuses placeholder endpoint", refused);
  let insecure = false;
  try { createSettlementVerifier({ endpoint: "http://verifier.internal:8080", apiKeyFile: "/run/secrets/k", network: "stellar", asset: "USDC" }); } catch (e) { insecure = e.code === "INSECURE_ENDPOINT"; }
  push("refuses http in production", insecure);
  push("boundary names no custody", /no adapter here/.test(INTEGRATIONS_BOUNDARY) && /holds funds/.test(INTEGRATIONS_BOUNDARY));
  return { ok: checks.every(c => c.ok), checks };
}
