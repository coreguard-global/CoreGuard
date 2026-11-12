/**
 * packages/stellar/presign.mjs — PSAR/1
 * Pre-sign Authorization Receipt for Stellar transactions.
 *
 * The problem it closes: a dApp or agent asks a user (or an AI agent's
 * principal) to approve a transfer; by the time the wallet shows the signing
 * prompt, the transaction XDR it carries may no longer be the transaction that
 * was approved. PSAR/1 binds an authorization decision to the EXACT
 * transaction bytes, before any signature exists, and lets the wallet verify
 * that binding itself - locally, from the receipt, without trusting a verdict
 * string, an image, or a DApp's claim.
 *
 * What a receipt proves (and only this):
 *   - that THIS authorization record (network + exact-XDR fingerprint +
 *     policy) was checked and passed before signing time, inside the window;
 *   - who issued it (an Ed25519 public key the verifier pins).
 *
 * What a receipt does NOT prove - by construction, named in every result:
 *   - that the transaction was EXECUTED. Execution evidence comes from the
 *     ledger after submission (read-back), never from a pre-sign receipt.
 *   - that the underlying authorization was wise, or that the user was not
 *     deceived into approving it. It binds bytes to a decision, not judgment.
 *
 * Boundaries, deliberate and named:
 *   - it never signs a Stellar transaction and never holds wallet keys. The
 *     issuer key belongs to the verification service that issued the receipt
 *     (in production, a service the owner runs); `createInMemoryIssuer` is a
 *     DEMO/DEV-only stand-in so the offline demo and tests are deterministic.
 *   - verification is FAIL-CLOSED: a receipt that fails any check BLOCKs, and
 *     an error inside the verifier itself BLOCKs. A verification failure can
 *     never surface as a pass - the only pass is a fully verified receipt.
 *   - the binding is byte-exact: the receipt carries sha256 over the exact
 *     XDR string it was issued for. One appended byte, one different stroop,
 *     one changed destination invalidates it (XDR_BINDING_MISMATCH).
 *   - it does not read Horizon and does not submit. Sequencing is the caller's
 *     business; this module is offline by design.
 *   - it does not replace Soroban authorization or wallet risk scanners: it
 *     adds the authorization-to-exact-bytes binding layer on top of whatever
 *     the wallet already shows.
 *
 * Status: code BUILT, execution TEST_EXECUTED (deterministic, offline,
 * known-answer vectors), integration NOT_BUILT (no wallet embeds it yet).
 */

import { createHash, createPrivateKey, createPublicKey, randomBytes, sign as edSign, verify as edVerify } from "node:crypto";

export const PSAR_VERSION = "PSAR/1";
export const PSAR_SCHEMA = "coreguard.psar/1";

/** The only thing a receipt attests - never more. */
export const RECEIPT_SCOPE = "PRE_SIGN_AUTHORIZATION";

/** What the result says about execution - always, in every verdict. */
export const EXECUTION_PROOF_FIELD = "NOT_INCLUDED";

/** Networks a receipt can name. Aligned with what a Freighter wallet reports. */
export const PSAR_NETWORKS = Object.freeze(["TESTNET", "PUBLIC", "FUTURENET", "SANDBOX"]);

/** Decisions are two-valued: there is no soft pass. */
export const DECISIONS = Object.freeze(["PASS", "BLOCK"]);

/**
 * Fail-closed reason codes. Every non-pass path lands here by name, and the
 * verifier's own failure is a code too - never an exception leaking a pass.
 */
export const REJECT_CODES = Object.freeze([
  "MALFORMED_RECEIPT",
  "MALFORMED_INPUT",
  "BAD_DIGEST",
  "BAD_SIGNATURE",
  "XDR_BINDING_MISMATCH",
  "NETWORK_MISMATCH",
  "POLICY_MISMATCH",
  "NOT_YET_VALID",
  "RECEIPT_EXPIRED",
  "VERIFIER_ERROR",
]);

/** The exact receipt field set. Unknown fields are a defect, not decoration. */
const ADR_FIELDS = Object.freeze(["v", "scope", "network", "xdrFingerprint", "policy", "issuedAt", "expiresAt", "issuer"]);
const RECEIPT_FIELDS = Object.freeze([...ADR_FIELDS, "digest", "signature"]);

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

/** Canonical JSON: sorted keys, no whitespace, recursive. Byte-deterministic. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

/** The binding primitive: sha256 over the EXACT utf8 XDR string. */
export function fingerprintXdr(xdr) {
  return createHash("sha256").update(String(xdr), "utf8").digest("hex");
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNonNegativeInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * Normalize + validate a policy object: plain object whose values are all
 * strings (amounts are strings - stroops never ride JS floats). Returns
 * { ok, policy, error }.
 */
export function normalizePolicy(policy) {
  if (!isPlainObject(policy)) return { ok: false, policy: null, error: "policy must be a plain object" };
  for (const [k, v] of Object.entries(policy)) {
    if (typeof v !== "string") return { ok: false, policy: null, error: `policy.${k} must be a string (amounts are strings, never floats)` };
  }
  return { ok: true, policy, error: null };
}

/**
 * DEMO/DEV-only issuer so the offline demo and the known-answer vectors are
 * deterministic. In production the issuer is the verification service the
 * owner runs; its PRIVATE key never lives in a repo, a client, or a wallet.
 * This factory never exposes the private key - only a sign(bytes) closure -
 * and never signs a Stellar transaction with it.
 */
export function createInMemoryIssuer({ seedHex } = {}) {
  let seed;
  if (seedHex !== undefined) {
    if (typeof seedHex !== "string" || !HEX64.test(seedHex)) throw new Error("seedHex must be 32 bytes of hex");
    seed = Buffer.from(seedHex, "hex");
  } else {
    seed = randomBytes(32);
  }
  // Ed25519 PKCS8 wrapper: fixed 16-byte prefix + 32-byte seed.
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
  const priv = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ type: "spki", format: "der" });
  const publicKeyHex = Buffer.from(spki.subarray(spki.length - 32)).toString("hex");
  return {
    publicKeyHex,
    algorithm: "Ed25519",
    demoOnly: true,
    /** Sign raw bytes; returns 64-byte hex. Never touches transaction material. */
    sign(bytes) {
      return edSign(null, Buffer.from(bytes), priv).toString("hex");
    },
  };
}

/**
 * Issue a pre-sign authorization receipt.
 * { network, xdr, policy, issuer, nowSeconds, ttlSeconds = 600 }
 * Returns { ok, error, receipt, digest, adr }.
 */
export function issueAuthorizationReceipt({ network, xdr, policy, issuer, nowSeconds, ttlSeconds = 600 } = {}) {
  if (!PSAR_NETWORKS.includes(network)) return { ok: false, error: `unknown network: ${network} (use one of ${PSAR_NETWORKS.join(", ")})`, receipt: null };
  if (typeof xdr !== "string" || xdr.length === 0) return { ok: false, error: "xdr required (the EXACT transaction envelope string)", receipt: null };
  const pol = normalizePolicy(policy);
  if (!pol.ok) return { ok: false, error: pol.error, receipt: null };
  if (!isPlainObject(issuer) || typeof issuer.sign !== "function" || typeof issuer.publicKeyHex !== "string" || !HEX64.test(issuer.publicKeyHex)) {
    return { ok: false, error: "issuer must be { publicKeyHex, sign(bytes) } - never a wallet key", receipt: null };
  }
  if (!isNonNegativeInt(nowSeconds)) return { ok: false, error: "nowSeconds required (inject the clock; never read Date inside the module)", receipt: null };
  if (!isNonNegativeInt(ttlSeconds) || ttlSeconds === 0) return { ok: false, error: "ttlSeconds must be a positive integer", receipt: null };

  const adr = {
    v: PSAR_VERSION,
    scope: RECEIPT_SCOPE,
    network,
    xdrFingerprint: fingerprintXdr(xdr),
    policy: pol.policy,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
    issuer: issuer.publicKeyHex,
  };
  const bytes = Buffer.from(canonicalJson(adr), "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  let signature;
  try {
    signature = issuer.sign(bytes);
  } catch (e) {
    return { ok: false, error: `issuer.sign failed: ${e && e.message ? e.message : e}`, receipt: null };
  }
  if (typeof signature !== "string" || !HEX128.test(signature)) {
    return { ok: false, error: "issuer.sign must return 64 bytes of hex", receipt: null };
  }
  return { ok: true, error: null, receipt: { ...adr, digest, signature }, digest, adr };
}

/**
 * Verify a pre-sign authorization receipt against what is about to be signed.
 * FAIL-CLOSED: any mismatch, any malformed shape, any verifier error => BLOCK
 * with a named code. The only PASS is a fully verified receipt.
 *
 * { receipt, xdr, network, policy, nowSeconds, issuerPublicKey }
 * issuerPublicKey: the pinned 64-char hex Ed25519 public key of the issuer
 * (or an object with publicKeyHex).
 *
 * Returns { decision, code, reasons, executionProof, checkedAtSeconds, receiptId }.
 * executionProof is ALWAYS "NOT_INCLUDED" - a pre-sign receipt never proves
 * execution; that proof comes from the ledger read-back after submission.
 */
export function verifyAuthorizationReceipt({ receipt, xdr, network, policy, nowSeconds, issuerPublicKey } = {}) {
  const run = () => {
    if (!isPlainObject(receipt)) return block("MALFORMED_RECEIPT", "receipt must be a plain object");
    const keys = Object.keys(receipt).sort();
    if (keys.length !== RECEIPT_FIELDS.length || RECEIPT_FIELDS.some((f) => !keys.includes(f))) {
      const unknown = keys.filter((k) => !RECEIPT_FIELDS.includes(k));
      return block("MALFORMED_RECEIPT", unknown.length ? `unknown receipt fields: ${unknown.join(", ")}` : "missing receipt fields");
    }
    if (receipt.v !== PSAR_VERSION) return block("MALFORMED_RECEIPT", `unsupported receipt version: ${JSON.stringify(receipt.v)}`);
    if (receipt.scope !== RECEIPT_SCOPE) return block("MALFORMED_RECEIPT", `receipt scope must be ${RECEIPT_SCOPE}`);

    const pol = normalizePolicy(receipt.policy);
    if (!pol.ok) return block("MALFORMED_RECEIPT", pol.error);
    if (!PSAR_NETWORKS.includes(receipt.network)) return block("MALFORMED_RECEIPT", `receipt names an unknown network: ${JSON.stringify(receipt.network)}`);
    if (typeof receipt.xdrFingerprint !== "string" || !HEX64.test(receipt.xdrFingerprint)) return block("MALFORMED_RECEIPT", "xdrFingerprint must be 32 bytes of hex");
    if (typeof receipt.digest !== "string" || !HEX64.test(receipt.digest)) return block("MALFORMED_RECEIPT", "digest must be 32 bytes of hex");
    if (typeof receipt.signature !== "string" || !HEX128.test(receipt.signature)) return block("MALFORMED_RECEIPT", "signature must be 64 bytes of hex");
    if (typeof receipt.issuer !== "string" || !HEX64.test(receipt.issuer)) return block("MALFORMED_RECEIPT", "issuer must be 32 bytes of hex");
    if (!isNonNegativeInt(receipt.issuedAt) || !isNonNegativeInt(receipt.expiresAt) || receipt.expiresAt <= receipt.issuedAt) {
      return block("MALFORMED_RECEIPT", "issuedAt/expiresAt must be non-negative integers with expiresAt > issuedAt");
    }
    if (!isNonNegativeInt(nowSeconds)) return block("MALFORMED_INPUT", "nowSeconds required (inject the clock)");
    if (typeof xdr !== "string" || xdr.length === 0) return block("MALFORMED_INPUT", "xdr required (the EXACT envelope about to be signed)");
    if (!PSAR_NETWORKS.includes(network)) return block("MALFORMED_INPUT", `unknown network: ${JSON.stringify(network)}`);
    const givenPol = normalizePolicy(policy);
    if (!givenPol.ok) return block("MALFORMED_INPUT", givenPol.error);
    const pubHex = isPlainObject(issuerPublicKey) ? issuerPublicKey.publicKeyHex : issuerPublicKey;
    if (typeof pubHex !== "string" || !HEX64.test(pubHex)) return block("MALFORMED_INPUT", "issuerPublicKey must be the pinned 32-byte hex Ed25519 public key");

    // (1) the receipt's own digest - recomputed from its ADR fields.
    const adr = {
      v: receipt.v, scope: receipt.scope, network: receipt.network, xdrFingerprint: receipt.xdrFingerprint,
      policy: receipt.policy, issuedAt: receipt.issuedAt, expiresAt: receipt.expiresAt, issuer: receipt.issuer,
    };
    const recomputed = createHash("sha256").update(Buffer.from(canonicalJson(adr), "utf8")).digest("hex");
    if (recomputed !== receipt.digest) return block("BAD_DIGEST", "the receipt's digest does not match its own fields");

    // (2) the issuer's signature over the digest bytes - pinned key, no trust
    // in a verdict string, an image, or a DApp's claim.
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pubHex, "hex")]);
    let pub;
    try {
      pub = createPublicKey({ key: spki, format: "der", type: "spki" });
    } catch {
      return block("BAD_SIGNATURE", "issuer public key is not a valid Ed25519 key");
    }
    let okSig = false;
    try {
      okSig = edVerify(null, Buffer.from(canonicalJson(adr), "utf8"), pub, Buffer.from(receipt.signature, "hex"));
    } catch {
      okSig = false;
    }
    if (!okSig) return block("BAD_SIGNATURE", "the issuer's signature does not verify against the pinned public key");

    // (3) the byte-exact binding: what is about to be signed must be the exact
    // bytes the receipt was issued for. One byte of difference ends it.
    if (fingerprintXdr(xdr) !== receipt.xdrFingerprint) {
      return block("XDR_BINDING_MISMATCH", "the transaction about to be signed is NOT the transaction the receipt was issued for");
    }

    // (4) the network the wallet is actually on must be the receipt's network.
    if (network !== receipt.network) {
      return block("NETWORK_MISMATCH", `receipt was issued for ${receipt.network}, the signing context is ${network}`);
    }

    // (5) the policy must be the exact policy the receipt authorized.
    if (canonicalJson(givenPol.policy) !== canonicalJson(receipt.policy)) {
      return block("POLICY_MISMATCH", "the policy being enforced is not the policy the receipt authorized");
    }

    // (6) the time window.
    if (nowSeconds < receipt.issuedAt) return block("NOT_YET_VALID", `receipt is valid from ${receipt.issuedAt}`);
    if (nowSeconds >= receipt.expiresAt) return block("RECEIPT_EXPIRED", `receipt expired at ${receipt.expiresAt}`);

    return { decision: "PASS", code: null, reasons: [], executionProof: EXECUTION_PROOF_FIELD, checkedAtSeconds: nowSeconds, receiptId: receipt.digest };
  };

  try {
    return run();
  } catch (e) {
    // Fail-closed even for an internal error: a broken verifier never yields a pass.
    return block("VERIFIER_ERROR", `verifier failure (fail-closed): ${e && e.message ? e.message : e}`);
  }

  function block(code, reason) {
    return { decision: "BLOCK", code, reasons: [`${code}: ${reason}`], executionProof: EXECUTION_PROOF_FIELD, checkedAtSeconds: isNonNegativeInt(nowSeconds) ? nowSeconds : null, receiptId: isPlainObject(receipt) && HEX64.test(String(receipt.digest)) ? receipt.digest : null };
  }
}

/** Honest status: what exists, what ran, what nothing has adopted yet. */
export function status() {
  return {
    version: PSAR_VERSION,
    schema: PSAR_SCHEMA,
    scope: RECEIPT_SCOPE,
    runMode: "OFFLINE_PROTOTYPE",
    integrationStatus: "NOT_BUILT",
    networks: [...PSAR_NETWORKS],
    proves: "the named authorization (network + exact XDR fingerprint + policy) passed pre-sign verification inside its window, issued by the pinned key",
    doesNotProve: "EXECUTION - a pre-sign receipt never proves the transaction executed; ledger read-back does that after submission",
    failClosed: "every check failure BLOCKs by name; a verifier error BLOCKs; verification failure is never a pass",
    signerBoundary: "this module never signs a transaction and never holds wallet keys; the demo issuer is a deterministic stand-in",
    executed: false,
    receiptCaptured: false,
  };
}

/** Self-check: the full issue -> verify -> tamper -> expire cycle, in-memory. */
export function selfCheck() {
  const issuer = createInMemoryIssuer({ seedHex: "11".repeat(32) });
  const xdr = "AAAAAgAAAABkbe0AAAAAAAAAAAAAAAA=";
  const policy = { asset: "XLM", maxAmount: "10", destination: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" };
  const now = 1700000000;
  const issued = issueAuthorizationReceipt({ network: "TESTNET", xdr, policy, issuer, nowSeconds: now, ttlSeconds: 600 });
  if (!issued.ok) return { ok: false, checks: [{ name: "issue", pass: false }] };
  const pass = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr, network: "TESTNET", policy, nowSeconds: now + 1, issuerPublicKey: issuer.publicKeyHex });
  const tampered = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr: xdr + " ", network: "TESTNET", policy, nowSeconds: now + 1, issuerPublicKey: issuer.publicKeyHex });
  const expired = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr, network: "TESTNET", policy, nowSeconds: issued.receipt.expiresAt, issuerPublicKey: issuer.publicKeyHex });
  const checks = [
    { name: "matching authorization PASSes", pass: pass.decision === "PASS" },
    { name: "one appended byte BLOCKs (XDR_BINDING_MISMATCH)", pass: tampered.decision === "BLOCK" && tampered.code === "XDR_BINDING_MISMATCH" },
    { name: "expiry BLOCKs (RECEIPT_EXPIRED)", pass: expired.decision === "BLOCK" && expired.code === "RECEIPT_EXPIRED" },
    { name: "executionProof is NOT_INCLUDED in every verdict", pass: [pass, tampered, expired].every((r) => r.executionProof === EXECUTION_PROOF_FIELD) },
  ];
  return { ok: checks.every((c) => c.pass), checks };
}
