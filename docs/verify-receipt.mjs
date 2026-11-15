/**
 * docs/verify-receipt.mjs — PSAR/1 verification that runs in a browser.
 *
 * Why this exists: a receipt is only evidence if the person holding it can
 * check it without installing anything and without trusting a server. This
 * module is the browser-side twin of `verifyAuthorizationReceipt` in
 * `packages/stellar/presign.mjs`; the two are compared case by case in
 * `test/integrations/verify-page.test.mjs`, because duplicated logic that is
 * not compared is a second implementation, not a second opinion.
 *
 * Boundaries, stated instead of implied:
 *   - No network. No fetch, no XHR, no analytics, no fonts, no CDN.
 *   - `policy` is optional: without it the receipt's policy is DISPLAYED, not
 *     enforced, and `policyChecked` says so. The page never pretends to know
 *     the policy the enforcer ran with.
 *   - `nowSeconds` comes from the browser clock unless the bundle pins `at`
 *     (an audit replay uses the pinned value, not today's date).
 *   - A pre-sign receipt never proves execution: `executionProof` is always
 *     "NOT_INCLUDED".
 */

export const PSAR_VERSION = "PSAR/1";
export const RECEIPT_SCOPE = "PRE_SIGN_AUTHORIZATION";
export const EXECUTION_PROOF_FIELD = "NOT_INCLUDED";

export const REJECT_CODES = Object.freeze([
  "MALFORMED_RECEIPT",
  "MALFORMED_INPUT",
  "BAD_DIGEST",
  "BAD_SIGNATURE",
  "ISSUER_MISMATCH",
  "XDR_BINDING_MISMATCH",
  "NETWORK_MISMATCH",
  "POLICY_MISMATCH",
  "NOT_YET_VALID",
  "RECEIPT_EXPIRED",
  "VERIFIER_ERROR",
]);

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const RECEIPT_FIELDS = Object.freeze([
  "v", "scope", "network", "xdrFingerprint", "policy", "issuedAt", "expiresAt", "issuer", "digest", "signature",
]);

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonNegativeInt = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Sorted-key, whitespace-free canonical JSON — same bytes as the issuer signed. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/** Normalize a policy: every value must be a string; amounts never ride as floats. */
export function normalizePolicy(policy) {
  if (!isPlainObject(policy)) return { ok: false, policy: null, error: "policy must be a plain object" };
  for (const [k, v] of Object.entries(policy)) {
    if (typeof v !== "string") return { ok: false, policy: null, error: `policy.${k} must be a string` };
  }
  return { ok: true, policy, error: null };
}

/**
 * Verify a receipt bundle. FAIL-CLOSED: any mismatch, any malformed shape, any
 * error inside the verifier itself returns BLOCK with a named code.
 *
 * { receipt, xdr, network, policy?, nowSeconds, issuerPublicKey }
 * issuerPublicKey: 64-char hex of the pinned issuer Ed25519 key.
 */
export async function verifyBundle({
  receipt,
  xdr,
  network,
  policy,
  nowSeconds,
  issuerPublicKey,
} = {}) {
  const checks = [];
  const note = (name, pass, detail) => checks.push({ name, pass, detail });
  const block = (code, reason, extra = {}) => ({
    decision: "BLOCK",
    code,
    reasons: [`${code}: ${reason}`],
    executionProof: EXECUTION_PROOF_FIELD,
    checkedAtSeconds: isNonNegativeInt(nowSeconds) ? nowSeconds : null,
    receiptId: isPlainObject(receipt) && typeof receipt.digest === "string" && HEX64.test(receipt.digest) ? receipt.digest : null,
    checks,
    ...extra,
  });

  try {
    if (!isPlainObject(receipt)) return block("MALFORMED_RECEIPT", "receipt must be a plain object");
    const keys = Object.keys(receipt).sort();
    const unknown = keys.filter((k) => !RECEIPT_FIELDS.includes(k));
    if (unknown.length || keys.length !== RECEIPT_FIELDS.length) {
      return block("MALFORMED_RECEIPT", unknown.length ? `unknown receipt fields: ${unknown.join(", ")}` : "missing receipt fields");
    }
    note("receipt shape: exactly the ten PSAR/1 fields", true);

    if (receipt.v !== PSAR_VERSION) return block("MALFORMED_RECEIPT", `unsupported receipt version: ${JSON.stringify(receipt.v)}`);
    if (receipt.scope !== RECEIPT_SCOPE) return block("MALFORMED_RECEIPT", `receipt scope must be ${RECEIPT_SCOPE}`);
    note("version and scope", true);

    const receiptPolicy = normalizePolicy(receipt.policy);
    if (!receiptPolicy.ok) return block("MALFORMED_RECEIPT", receiptPolicy.error);
    if (typeof receipt.xdrFingerprint !== "string" || !HEX64.test(receipt.xdrFingerprint)) return block("MALFORMED_RECEIPT", "xdrFingerprint must be 32 bytes of hex");
    if (typeof receipt.issuer !== "string" || !HEX64.test(receipt.issuer)) return block("MALFORMED_RECEIPT", "issuer must be 32 bytes of hex");
    if (typeof receipt.digest !== "string" || !HEX64.test(receipt.digest)) return block("MALFORMED_RECEIPT", "digest must be 32 bytes of hex");
    if (typeof receipt.signature !== "string" || !HEX128.test(receipt.signature)) return block("MALFORMED_RECEIPT", "signature must be 64 bytes of hex");
    if (!isNonNegativeInt(receipt.issuedAt) || !isNonNegativeInt(receipt.expiresAt) || receipt.expiresAt <= receipt.issuedAt) {
      return block("MALFORMED_RECEIPT", "issuedAt/expiresAt must be non-negative integers with expiresAt > issuedAt");
    }
    note("field shapes (hex widths, string-only policy, window ordering)", true);

    if (typeof xdr !== "string" || xdr.length === 0) return block("MALFORMED_INPUT", "envelope required (the exact transaction bytes)");
    if (typeof network !== "string" || !["TESTNET", "PUBLIC", "FUTURENET", "SANDBOX"].includes(network)) {
      return block("MALFORMED_INPUT", `unknown network: ${JSON.stringify(network)}`);
    }
    if (!isNonNegativeInt(nowSeconds)) return block("MALFORMED_INPUT", "nowSeconds required (pinned in the bundle or taken from the clock)");
    const pubHex = isPlainObject(issuerPublicKey) ? issuerPublicKey.publicKeyHex : issuerPublicKey;
    if (typeof pubHex !== "string" || !HEX64.test(pubHex)) return block("MALFORMED_INPUT", "issuerPublicKey must be the pinned 32-byte hex Ed25519 public key");
    note("inputs: envelope, network, clock, pinned issuer key", true);

    // (1) the receipt's own digest, recomputed from its ADR fields.
    const adr = {
      v: receipt.v, scope: receipt.scope, network: receipt.network, xdrFingerprint: receipt.xdrFingerprint,
      policy: receipt.policy, issuedAt: receipt.issuedAt, expiresAt: receipt.expiresAt, issuer: receipt.issuer,
    };
    const adrBytes = new TextEncoder().encode(canonicalJson(adr));
    const recomputed = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", adrBytes)));
    if (recomputed !== receipt.digest) return block("BAD_DIGEST", "the receipt's digest does not match its own fields");
    note("digest recomputed from the receipt's fields", true);

    // (2) the issuer's signature over the canonical ADR bytes, against the pinned key.
    let verified = false;
    try {
      const key = await crypto.subtle.importKey("raw", hexToBytes(pubHex), { name: "Ed25519" }, false, ["verify"]);
      verified = await crypto.subtle.verify({ name: "Ed25519" }, key, hexToBytes(receipt.signature), adrBytes);
    } catch {
      verified = false;
    }
    if (!verified) return block("BAD_SIGNATURE", "the issuer's signature does not verify against the pinned public key");
    note("Ed25519 signature over the canonical bytes, pinned key", true);

    if (receipt.issuer !== pubHex) return block("ISSUER_MISMATCH", "the receipt names an issuer that is not the pinned verification key");
    note("receipt names the pinned issuer", true);

    // (3) the byte-exact binding: the envelope shown here is the one authorized.
    if ((await sha256Hex(xdr)) !== receipt.xdrFingerprint) {
      return block("XDR_BINDING_MISMATCH", "this envelope is NOT the transaction the receipt was issued for");
    }
    note("envelope sha256 equals the receipt's fingerprint", true);

    // (4) the network the receipt names must be the one being verified.
    if (network !== receipt.network) return block("NETWORK_MISMATCH", `receipt was issued for ${receipt.network}, verification context is ${network}`);
    note("network matches the receipt", true);

    // (5) optional: the policy the enforcer ran with.
    let policyChecked = false;
    if (policy !== undefined && policy !== null) {
      const given = normalizePolicy(policy);
      if (!given.ok) return block("MALFORMED_INPUT", given.error);
      if (canonicalJson(given.policy) !== canonicalJson(receipt.policy)) {
        return block("POLICY_MISMATCH", "the policy provided is not the policy the receipt authorized");
      }
      policyChecked = true;
      note("enforced policy equals the receipt's policy", true);
    }

    // (6) the time window, against the pinned clock when the bundle carries one.
    if (nowSeconds < receipt.issuedAt) return block("NOT_YET_VALID", `receipt is valid from ${receipt.issuedAt}`);
    if (nowSeconds >= receipt.expiresAt) return block("RECEIPT_EXPIRED", `receipt expired at ${receipt.expiresAt}`);
    note("inside the authorization window", true);

    return {
      decision: "PASS",
      code: null,
      reasons: [],
      executionProof: EXECUTION_PROOF_FIELD,
      checkedAtSeconds: nowSeconds,
      receiptId: receipt.digest,
      checks,
      policyChecked,
    };
  } catch (e) {
    return block("VERIFIER_ERROR", `verifier failure (fail-closed): ${e && e.message ? e.message : e}`);
  }
}

export const __internal = { sha256Hex, canonicalJson };
