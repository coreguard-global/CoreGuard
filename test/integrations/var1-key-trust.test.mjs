/**
 * CG-KEYS/1 — trust is pinned, rotation is signed, revocation knows when.
 *
 * The negative controls are the point: an unknown key is NOT_CHECKED (not
 * forged), a signature that verifies under a key the verifier never trusted is
 * not a pass, a rotation statement signed by somebody else is ignored, and a
 * revocation's retroactivity decides whether yesterday's record still stands.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEYS_VERSION,
  checkKey,
  createKeyring,
  pinKey,
  revokeKey,
  rotateKey,
  selfCheck,
  verifyWithTrust,
} from "../../packages/agent-commerce/trust.mjs";
import { generateIssuerKey, keyIdFor, signAttestation } from "../../packages/agent-commerce/anchor.mjs";

const subject = { kind: "receipt", digest: "sha256:" + "1".repeat(64) };
const attest = (key, at) => signAttestation({ subject, issuedAt: at, privateKeyPem: key.privateKeyPem });

test("selfCheck passes", () => {
  const r = selfCheck();
  assert.equal(r.ok, true, r.checks.filter((c) => !c.pass).map((c) => c.name).join(", "));
});

test("the version is pinned", () => assert.equal(KEYS_VERSION, "CG-KEYS/1"));

test("a signature that verifies under an untrusted key is NOT_CHECKED, not failed", () => {
  const key = generateIssuerKey();
  const r = verifyWithTrust(attest(key, "2026-01-01T00:00:00Z"), createKeyring());
  assert.equal(r.signatureOk, true);
  assert.equal(r.keyStatus, "unknown");
  assert.equal(r.outcome, "NOT_CHECKED");
  assert.equal(r.ok, false);
});

test("pinning is the only way in: the embedded key is not self-certifying", () => {
  const key = generateIssuerKey();
  const ring = pinKey(createKeyring(), { publicKeyPem: key.publicKeyPem, issuer: "acme" });
  const r = verifyWithTrust(attest(key, "2026-01-01T00:00:00Z"), ring);
  assert.equal(r.outcome, "VERIFIED");
  assert.equal(r.ok, true);
});

test("rotation chains A→B→C offline from a single pinned root", () => {
  const a = generateIssuerKey();
  const b = generateIssuerKey();
  const c = generateIssuerKey();
  let ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  ring = rotateKey(ring, { privateKeyPem: a.privateKeyPem, newPublicKeyPem: b.publicKeyPem, at: "2026-02-01T00:00:00Z", overlapUntil: "2026-02-08T00:00:00Z" });
  ring = rotateKey(ring, { privateKeyPem: b.privateKeyPem, newPublicKeyPem: c.publicKeyPem, at: "2026-03-01T00:00:00Z", overlapUntil: "2026-03-08T00:00:00Z" });

  assert.equal(checkKey(ring, { keyId: keyIdFor(c.publicKeyPem), at: "2026-03-02T00:00:00Z" }).status, "trusted");
  assert.equal(checkKey(ring, { keyId: keyIdFor(c.publicKeyPem), at: "2026-03-02T00:00:00Z" }).chainFrom, keyIdFor(b.publicKeyPem));
  assert.equal(verifyWithTrust(attest(c, "2026-03-02T00:00:00Z"), ring).outcome, "VERIFIED");
});

test("a rotation statement signed by an unrelated key does not extend trust", () => {
  const a = generateIssuerKey();
  const b = generateIssuerKey();
  const mallory = generateIssuerKey();
  let ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  ring = rotateKey(ring, { privateKeyPem: mallory.privateKeyPem, newPublicKeyPem: b.publicKeyPem, at: "2026-02-01T00:00:00Z", overlapUntil: "2026-02-08T00:00:00Z" });
  assert.equal(checkKey(ring, { keyId: keyIdFor(b.publicKeyPem), at: "2026-02-02T00:00:00Z" }).status, "unknown");
});

test("post-overlap signatures from the old key are refused; earlier ones are not", () => {
  const a = generateIssuerKey();
  const b = generateIssuerKey();
  let ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  ring = rotateKey(ring, { privateKeyPem: a.privateKeyPem, newPublicKeyPem: b.publicKeyPem, at: "2026-02-01T00:00:00Z", overlapUntil: "2026-02-08T00:00:00Z" });

  assert.equal(verifyWithTrust(attest(a, "2026-02-07T00:00:00Z"), ring).outcome, "VERIFIED");
  const late = verifyWithTrust(attest(a, "2026-02-09T00:00:00Z"), ring);
  assert.equal(late.keyStatus, "rotated");
  assert.equal(late.outcome, "VERIFICATION_FAILED");
});

test("non-retroactive revocation keeps history and refuses new signatures", () => {
  const a = generateIssuerKey();
  const ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  const revoked = revokeKey(ring, { privateKeyPem: a.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-05-01T00:00:00Z", retroactive: false, reason: "retired" });

  assert.equal(verifyWithTrust(attest(a, "2026-04-30T00:00:00Z"), revoked).ok, true);
  const after = verifyWithTrust(attest(a, "2026-05-02T00:00:00Z"), revoked);
  assert.equal(after.ok, false);
  assert.equal(after.keyStatus, "revoked");
  assert.match(after.reason, /retired|revoked/);
});

test("retroactive revocation invalidates even signatures made before it", () => {
  const a = generateIssuerKey();
  const ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  const compromised = revokeKey(ring, { privateKeyPem: a.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-05-01T00:00:00Z", retroactive: true, reason: "key compromise" });
  const r = verifyWithTrust(attest(a, "2026-01-01T00:00:00Z"), compromised);
  assert.equal(r.ok, false);
  assert.equal(r.keyStatus, "revoked");
});

test("a successor can revoke its predecessor, an unrelated key cannot", () => {
  const a = generateIssuerKey();
  const b = generateIssuerKey();
  const mallory = generateIssuerKey();
  let ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme" });
  ring = rotateKey(ring, { privateKeyPem: a.privateKeyPem, newPublicKeyPem: b.publicKeyPem, at: "2026-02-01T00:00:00Z", overlapUntil: "2026-02-08T00:00:00Z" });

  const bySuccessor = revokeKey(ring, { privateKeyPem: b.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-02-02T00:00:00Z", retroactive: true, reason: "old key leaked" });
  assert.equal(checkKey(bySuccessor, { keyId: keyIdFor(a.publicKeyPem), at: "2026-01-20T00:00:00Z" }).status, "revoked");

  const byStranger = revokeKey(ring, { privateKeyPem: mallory.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-02-02T00:00:00Z", retroactive: true });
  assert.equal(checkKey(byStranger, { keyId: keyIdFor(a.publicKeyPem), at: "2026-02-03T00:00:00Z" }).status, "trusted");
});

test("the pinned validity window is honoured in both directions", () => {
  const a = generateIssuerKey();
  const ring = pinKey(createKeyring(), { publicKeyPem: a.publicKeyPem, issuer: "acme", notBefore: "2026-01-01T00:00:00Z", notAfter: "2026-12-31T00:00:00Z" });
  assert.equal(checkKey(ring, { keyId: keyIdFor(a.publicKeyPem), at: "2025-12-31T00:00:00Z" }).status, "not-yet-valid");
  assert.equal(checkKey(ring, { keyId: keyIdFor(a.publicKeyPem), at: "2027-01-01T00:00:00Z" }).status, "expired");
  assert.equal(checkKey(ring, { keyId: keyIdFor(a.publicKeyPem), at: "2026-06-01T00:00:00Z" }).status, "trusted");
});
