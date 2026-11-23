import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createPublicKey } from "node:crypto";
import { verifyTelemetry, verifyDelegationChain } from "../../packages/agent-commerce/machine-economy.mjs";

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k)+":"+canonicalJson(value[k])).join(",") + "}";
}

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

test("verifyTelemetry verifies genuine Ed25519 signature under supplied trust root", () => {
  const kp = keyPair();
  const payload = { machineId: "m1", timestamp: 1, readings: [{ k: "temp", v: 21 }] };
  const signature = sign(null, Buffer.from(canonicalJson(payload)), kp.privateKeyPem).toString("base64");
  const telemetry = { ...payload, signature, signedPayload: payload };
  const r = verifyTelemetry({ taskId: "t1", telemetry, trust: { publicKeyPem: kp.publicKeyPem } });
  assert.equal(r.verdict, "SIGNATURE_VERIFIED");
  assert.equal(r.signatureVerified, true);
});

test("verifyTelemetry refuses tampered signed payload", () => {
  const kp = keyPair();
  const payload = { machineId: "m1", timestamp: 1, readings: [{ k: "temp", v: 21 }] };
  const signature = sign(null, Buffer.from(canonicalJson(payload)), kp.privateKeyPem).toString("base64");
  const telemetry = { machineId: "m1", timestamp: 1, readings: [{ k: "temp", v: 99 }], signature, signedPayload: payload };
  const r = verifyTelemetry({ taskId: "t1", telemetry, trust: { publicKeyPem: kp.publicKeyPem } });
  assert.notEqual(r.verdict, "SIGNATURE_VERIFIED");
  assert.ok(r.issues.some(i => i.includes("SIGNED_PAYLOAD_DOES_NOT_MATCH_OBSERVED_FIELDS")));
});

test("verifyTelemetry without trust root is NOT signature-verified", () => {
  const kp = keyPair();
  const payload = { machineId: "m1", timestamp: 1, readings: [] };
  const signature = sign(null, Buffer.from(canonicalJson(payload)), kp.privateKeyPem).toString("base64");
  const r = verifyTelemetry({ taskId: "t1", telemetry: { ...payload, signature, signedPayload: payload } });
  assert.equal(r.verdict, "EVIDENCE_PRESENT_UNVERIFIED_TRUST");
  assert.equal(r.signatureVerified, false);
});

test("verifyDelegationChain verifies all signatures when trust roots supplied", () => {
  const a = keyPair();
  const b = keyPair();
  const d1Signed = { delegator: "A", delegate: "B", scope: ["pay"], expiresAt: null };
  const d2Signed = { delegator: "B", delegate: "C", scope: ["pay"], expiresAt: null };
  const d1 = { ...d1Signed, signature: sign(null, Buffer.from(canonicalJson(d1Signed)), a.privateKeyPem).toString("base64"), signedPayload: d1Signed, publicKeyPem: a.publicKeyPem };
  const d2 = { ...d2Signed, signature: sign(null, Buffer.from(canonicalJson(d2Signed)), b.privateKeyPem).toString("base64"), signedPayload: d2Signed, publicKeyPem: b.publicKeyPem };
  const r = verifyDelegationChain({ chain: [d1, d2], trust: { publicKeys: [a.publicKeyPem, b.publicKeyPem] } });
  assert.equal(r.verdict, "VERIFIED");
  assert.equal(r.signaturesVerified, true);
});

test("verifyDelegationChain detects forged signature under trust root", () => {
  const a = keyPair();
  const wrong = keyPair();
  const signed = { delegator: "A", delegate: "B", scope: ["pay"], expiresAt: null };
  const d = { ...signed, signature: sign(null, Buffer.from(canonicalJson(signed)), wrong.privateKeyPem).toString("base64"), signedPayload: signed, publicKeyPem: a.publicKeyPem };
  const r = verifyDelegationChain({ chain: [d], trust: { publicKeyPem: a.publicKeyPem } });
  assert.equal(r.verdict, "INVALID");
  assert.ok(r.issues.some(i => i.includes("SIGNATURE_INVALID")));
});
