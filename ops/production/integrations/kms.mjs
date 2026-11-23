/**
 * Key management adapter (CG-KMS/1)
 *
 * Real signer clients for AWS KMS (SigV4), GCP KMS, Azure Key Vault, HashiCorp
 * Vault Transit, and an injectable PKCS#11/HSM signer. A software signer exists
 * ONLY as `local-dev-only` and is labeled as such in every result.
 *
 * CoreGuard never extracts, exports, or persists private key material. All
 * signing happens inside the external KMS/HSM boundary.
 */

import { readFileSync } from "node:fs";
import { createHash, createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import {
  INTEGRATIONS_BOUNDARY, requireProvisioned, requestJson, verdict, nowIso, isPlaceholder, canonicalJson,
} from "./common.mjs";
import {
  createKeyring, pinKey, rotateKey, revokeKey, checkKey, KEYS_VERSION,
} from "../../../packages/agent-commerce/trust.mjs";

export const KMS_VERSION = "CG-KMS/1";
export const SUPPORTED_PROVIDERS = Object.freeze(["aws-kms", "gcp-kms", "azure-keyvault", "vault", "pkcs11", "local-dev-only"]);

const secret = (file, allowLocal) => {
  if (allowLocal && !file) return "local-test-secret";
  requireProvisioned({ file }, ["file"], { allowLocal });
  return readFileSync(file, "utf8").trim();
};

const b64 = (buf) => Buffer.from(buf).toString("base64");
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const hex = (buf) => Buffer.from(buf).toString("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const sha256hex = (data) => createHash("sha256").update(data).digest("hex");

/** Real AWS Signature Version 4 signer for KMS `TrentService.Sign`. */
export function awsSigV4({ url, target, body, region, accessKeyId, secretAccessKey, sessionToken, now = new Date() }) {
  const u = new URL(url);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzDate.slice(0, 8);
  const canonicalUri = u.pathname || "/";
  const canonicalQuery = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = [
    `content-type:application/x-amz-json-1.1`,
    `host:${u.host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`,
    ...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
  ].join("\n") + "\n";
  const signedHeaders = [
    "content-type", "host", "x-amz-date", "x-amz-target",
    ...(sessionToken ? ["x-amz-security-token"] : []),
  ].join(";");
  const canonicalRequest = ["POST", canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, sha256hex(body)].join("\n");
  const scope = `${datestamp}/${region}/kms/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, datestamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "kms");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hex(hmac(kSigning, stringToSign));
  return {
    "Content-Type": "application/x-amz-json-1.1",
    "X-Amz-Date": amzDate,
    "X-Amz-Target": target,
    "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    ...(sessionToken ? { "X-Amz-Security-Token": sessionToken } : {}),
  };
}

/**
 * createKmsSigner(config)
 *   provider: aws-kms|gcp-kms|azure-keyvault|vault|pkcs11|local-dev-only
 *   keyId:    provider key identifier (required for external providers)
 *   allowLocal: ONLY for tests with local-dev-only mock endpoints
 */
export function createKmsSigner(config = {}) {
  const provider = String(config.provider || "");
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw Object.assign(new Error(`CG-KMS/1: unsupported provider ${provider}`), { code: "UNSUPPORTED_PROVIDER" });
  const allowLocal = !!config.allowLocal && provider === "local-dev-only";
  if (provider === "local-dev-only" && !config.allowLocal) {
    throw Object.assign(new Error("CG-KMS/1: local-dev-only signer requires explicit allowLocal"), { code: "NOT_PRODUCTION" });
  }
  if (provider !== "local-dev-only") requireProvisioned(config, ["keyId"], { allowLocal: false });

  let localPrivateKey = null;
  if (provider === "local-dev-only") {
    const kp = generateKeyPairSync("ed25519");
    localPrivateKey = kp.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    config.publicKeyPem = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
  }

  function endpointFor() {
    if (provider === "aws-kms") return config.endpointOverride || `https://kms.${config.region}.amazonaws.com/`;
    if (provider === "gcp-kms") return config.endpointOverride || `https://cloudkms.googleapis.com/v1/${config.keyId}:asymmetricsign`;
    if (provider === "azure-keyvault") return config.endpointOverride || `https://${config.vault}.vault.azure.net/keys/${config.key}/${config.keyVersion || ""}/sign?api-version=7.4`;
    if (provider === "vault") return config.endpointOverride || `${config.addr}/v1/transit/sign/${config.keyId}`;
    return null;
  }

  function payloadBytes(payload) {
    if (Buffer.isBuffer(payload)) return payload;
    if (typeof payload === "string") return Buffer.from(payload, "utf8");
    if (payload && typeof payload === "object") return Buffer.from(canonicalJson(payload), "utf8");
    throw new TypeError("payload must be a string, Buffer, or plain object");
  }

  async function signPayload(payload, options = {}) {
    const bytes = payloadBytes(payload);
    const digest = sha256hex(bytes);
    let signature;
    let algorithm = "ECDSA_SHA_256";

    if (provider === "local-dev-only") {
      signature = cryptoSign(null, bytes, createPrivateKey(localPrivateKey)).toString("base64");
      algorithm = "Ed25519";
    } else if (provider === "aws-kms") {
      requireProvisioned(config, ["region", "accessKeyIdFile", "secretAccessKeyFile"]);
      algorithm = config.algorithm || "ECDSA_SHA_256";
      const url = endpointFor();
      if (!config.allowLocal && !url.startsWith("https://")) throw Object.assign(new Error("CG-KMS/1: AWS endpoint must be HTTPS"), { code: "INSECURE_ENDPOINT" });
      const body = JSON.stringify({ KeyId: config.keyId, Message: b64(bytes), MessageType: "RAW", SigningAlgorithm: algorithm });
      const headers = awsSigV4({
        url, target: "TrentService.Sign", body, region: config.region,
        accessKeyId: secret(config.accessKeyIdFile, false),
        secretAccessKey: secret(config.secretAccessKeyFile, false),
        sessionToken: config.sessionTokenFile ? secret(config.sessionTokenFile, false) : null,
        now: options.now,
      });
      const res = await requestJson(url, { method: "POST", headers, body, expectStatus: [200], timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "aws-kms-sign" });
      signature = res.body?.Signature;
      if (typeof signature !== "string") return verdict("INVALID_KMS_RESPONSE", { reason: "INVALID_KMS_RESPONSE", keyId: config.keyId });
    } else if (provider === "gcp-kms") {
      requireProvisioned(config, ["tokenFile"]);
      const res = await requestJson(endpointFor(), {
        method: "POST",
        headers: { "Authorization": `Bearer ${secret(config.tokenFile)}`, "Content-Type": "application/json" },
        body: { message: b64(bytes) },
        expectStatus: [200], timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "gcp-kms-sign",
      });
      signature = res.body?.signature;
      algorithm = res.body?.algorithm || algorithm;
      if (typeof signature !== "string") return verdict("INVALID_KMS_RESPONSE", { reason: "INVALID_KMS_RESPONSE", keyId: config.keyId });
    } else if (provider === "azure-keyvault") {
      requireProvisioned(config, ["vault", "key", "tokenFile"]);
      algorithm = config.algorithm || "ES256";
      const res = await requestJson(endpointFor(), {
        method: "POST",
        headers: { "Authorization": `Bearer ${secret(config.tokenFile)}`, "Content-Type": "application/json" },
        body: { value: b64url(bytes), alg: algorithm },
        expectStatus: [200], timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "azure-kv-sign",
      });
      signature = res.body?.value;
      if (typeof signature !== "string") return verdict("INVALID_KMS_RESPONSE", { reason: "INVALID_KMS_RESPONSE", keyId: config.keyId });
    } else if (provider === "vault") {
      requireProvisioned(config, ["addr", "tokenFile"]);
      const res = await requestJson(endpointFor(), {
        method: "POST",
        headers: { "X-Vault-Token": secret(config.tokenFile), "Content-Type": "application/json" },
        body: { input: b64(bytes) },
        expectStatus: [200], timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "vault-transit-sign",
      });
      const enc = res.body?.data?.signature;
      signature = typeof enc === "string" && enc.startsWith("vault:v") ? enc.slice(enc.indexOf(":") + 1) : enc;
      if (typeof signature !== "string") return verdict("INVALID_KMS_RESPONSE", { reason: "INVALID_KMS_RESPONSE", keyId: config.keyId });
    } else if (provider === "pkcs11") {
      if (typeof config.sign !== "function") {
        return verdict("HSM_SIGNER_REQUIRED", { reason: "HSM_SIGNER_REQUIRED", note: "Inject a PKCS#11/native HSM sign callback; no private key is exported." });
      }
      try { signature = await config.sign(bytes, { keyId: config.keyId, algorithm: config.algorithm || "ECDSA_SHA_256" }); }
      catch (err) { return verdict("HSM_SIGN_FAILED", { reason: "HSM_SIGN_FAILED", message: err.message }); }
      if (typeof signature !== "string") return verdict("INVALID_HSM_RESPONSE", { reason: "INVALID_HSM_RESPONSE" });
    }

    return {
      spec: KMS_VERSION,
      verdict: "VERIFIED",
      reason: "OK",
      boundary: INTEGRATIONS_BOUNDARY + (allowLocal ? " LOCAL_DEV_ONLY: software key, NOT a production HSM." : ""),
      at: nowIso(),
      signature,
      algorithm,
      provider,
      keyId: config.keyId ?? null,
      payloadDigest: digest,
      signingMode: allowLocal ? "LOCAL_DEV_ONLY" : "EXTERNAL_KMS_HSM",
    };
  }

  return Object.freeze({
    spec: KMS_VERSION,
    provider,
    sign: signPayload,
    getPublicKeyPem: () => config.publicKeyPem ?? null,
    verify: (payload, signature, publicKeyPem) => verifySignature(payload, signature, publicKeyPem || config.publicKeyPem, provider === "local-dev-only" ? "Ed25519" : "auto"),
  });
}

/** Local verification of an externally produced signature when a public key is supplied. */
export function verifySignature(payload, signature, publicKeyPem, algorithm = "auto") {
  if (!publicKeyPem || isPlaceholder(publicKeyPem)) return verdict("TRUST_ROOT_REQUIRED", { reason: "TRUST_ROOT_REQUIRED" });
  const bytes = Buffer.isBuffer(payload) ? payload : typeof payload === "string" ? Buffer.from(payload, "utf8") : Buffer.from(canonicalJson(payload), "utf8");
  const sig = Buffer.from(String(signature || ""), "base64");
  const candidates = algorithm === "auto"
    ? ["Ed25519", "sha256", "RSA-SHA256"]
    : [algorithm];
  for (const alg of candidates) {
    try {
      const nodeAlg = alg === "Ed25519" ? null : alg;
      if (cryptoVerify(nodeAlg, bytes, createPublicKey(publicKeyPem), sig)) return verdict("OK", { algorithm: alg, signatureDigest: sha256hex(sig) });
    } catch { /* try next candidate */ }
  }
  return verdict("SIGNATURE_INVALID", { reason: "SIGNATURE_INVALID", tried: candidates });
}

/** Key lifecycle wrapper over CG-KEYS/1 (pin / rotate-overlap / revoke). */
export function createKeyLifecycle({ id = "cgcp-kms" } = {}) {
  let keyring = createKeyring({ id });
  const audit = [];
  function record(type, detail) { audit.push({ type, detail, at: nowIso() }); }
  return Object.freeze({
    spec: KMS_VERSION,
    keysSpec: KEYS_VERSION,
    pin: (args) => {
      const next = pinKey(keyring, args);
      const key = next.pinned.find(k => k.publicKeyPem === args.publicKeyPem);
      keyring = next;
      record("key.pinned", { keyId: key?.keyId ?? null });
      return key ?? null;
    },
    rotate: (args) => {
      const next = rotateKey(keyring, args);
      const last = next.rotations[next.rotations.length - 1];
      keyring = next;
      record("key.rotated", { from: last.from, to: last.to, overlapUntil: last.overlapUntil });
      return { from: last.from, to: last.to, overlapUntil: last.overlapUntil };
    },
    revoke: (args) => {
      const next = revokeKey(keyring, args);
      const last = next.revocations[next.revocations.length - 1];
      keyring = next;
      record("key.revoked", { keyId: last.keyId, retroactive: last.retroactive });
      return { keyId: last.keyId, at: last.at, retroactive: last.retroactive };
    },
    check: (args) => checkKey(keyring, args),
    snapshot: () => JSON.parse(JSON.stringify(keyring)),
    audit: () => audit.slice(),
  });
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  push("exports", [createKmsSigner, awsSigV4, verifySignature, createKeyLifecycle].every(f => typeof f === "function"));
  let refused = false;
  try { createKmsSigner({ provider: "local-dev-only" }); } catch (e) { refused = e.code === "NOT_PRODUCTION"; }
  push("local signer refuses without allowLocal", refused);
  const headers = awsSigV4({ url: "https://kms.eu-central-1.amazonaws.com/", target: "TrentService.Sign", body: "{}", region: "eu-central-1", accessKeyId: "AKID", secretAccessKey: "SECRET" });
  push("sigv4 has authorization", /AWS4-HMAC-SHA256 Credential=AKID\//.test(headers.Authorization));
  push("sigv4 signs target", headers["X-Amz-Target"] === "TrentService.Sign");
  const lifecycle = createKeyLifecycle();
  push("lifecycle starts empty", Array.isArray(lifecycle.audit()) && lifecycle.audit().length === 0);
  return { ok: checks.every(c => c.ok), checks };
}
