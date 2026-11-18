/**
 * CoreGuard Key Trust (CG-KEYS/1) — who signed, whether they were allowed to,
 * and what happens when that answer changes.
 *
 * A signature proves that whoever holds a private key signed some bytes. It
 * does not prove that the signer is the party you mean, that they still are, or
 * that they were when they signed. Those are three different questions, and
 * this module answers each one separately:
 *
 *   trust      a key is trusted because it is PINNED by the verifier (offline,
 *              no PKI assumption), or because a pinned key signed a rotation
 *              statement that leads to it. Trust is never inferred from the key
 *              embedded in an attestation: that is self-certification, which is
 *              exactly the input an attacker controls.
 *   rotation   the old key signs a statement that names the new public key and
 *              an overlap window. Records signed inside the overlap stay valid;
 *              new signatures from the old key after it are refused. The chain
 *              verifies offline from the pinned root, with no registry.
 *   revocation the key (or a verified successor) signs a statement with a time
 *              and whether it is retroactive. A non-retroactive revocation says
 *              "stop trusting new signatures"; a retroactive one says "and the
 *              old ones were never good". That is the difference between a
 *              routine rotation and a compromise, and a vocabulary that cannot
 *              say it forces every consumer to guess.
 *
 * Verification is time-aware by construction: `issuedAt` is part of the signed
 * body, so trust is evaluated at the moment the attestation claims, not at the
 * moment somebody got around to checking. A caller asking "is this key good
 * now" calls `checkKey` with its own clock; nothing here reads a clock.
 *
 * BOUNDARY (standing, load-bearing):
 *   - An `unknown` key is not a failed signature. It is NOT_CHECKED with a
 *     reason, returned as such so a caller cannot render "I have no opinion"
 *     as "this is forged".
 *   - Trust here is about keys, never about people: a trusted key says the same
 *     party signed, not that the record is correct or the merchant honest.
 *   - Statements are pure data. No key server, no OCSP, no callback: freshness
 *     is whatever the verifier's own keyring says, stated rather than hidden
 *     behind a network call.
 */

import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { generateIssuerKey, keyIdFor, signAttestation, verifyAttestation } from "./anchor.mjs";

export const KEYS_VERSION = "CG-KEYS/1";
export const KEYS_SCHEMA = "coreguard.keyring/1";
export const KEY_STATUSES = Object.freeze(["trusted", "rotated", "revoked", "expired", "not-yet-valid", "unknown"]);

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

const iso = (value, field) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  return value;
};

const publicFromPrivate = (privateKeyPem) =>
  createPublicKey(createPrivateKey(privateKeyPem)).export({ type: "spki", format: "pem" }).toString();

const rotationBody = (r) => ({
  keysVersion: r.keysVersion,
  schema: r.schema,
  type: "rotate",
  from: r.from,
  to: r.to,
  toPublicKeyPem: r.toPublicKeyPem,
  at: r.at,
  overlapUntil: r.overlapUntil,
});

const revocationBody = (r) => ({
  keysVersion: r.keysVersion,
  schema: r.schema,
  type: "revoke",
  keyId: r.keyId,
  by: r.by,
  at: r.at,
  retroactive: r.retroactive,
  reason: r.reason,
});

function signedBy(publicKeyPem, body, signature) {
  try {
    return verify(null, Buffer.from(canonicalJson(body), "utf8"), publicKeyPem, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/** A keyring is plain data: safe to write to disk, diff, or hand to an auditor. */
export function createKeyring({ id = "keyring" } = {}) {
  return Object.freeze({
    keysVersion: KEYS_VERSION,
    schema: KEYS_SCHEMA,
    id,
    pinned: Object.freeze([]),
    rotations: Object.freeze([]),
    revocations: Object.freeze([]),
  });
}

/** Pin a key as a trust root. The verifier must already believe this key. */
export function pinKey(keyring, { publicKeyPem, issuer = null, notBefore = null, notAfter = null } = {}) {
  if (typeof publicKeyPem !== "string" || !publicKeyPem.includes("PUBLIC KEY")) {
    throw new TypeError("publicKeyPem must be an SPKI PEM string");
  }
  const key = Object.freeze({
    keyId: keyIdFor(publicKeyPem),
    publicKeyPem,
    issuer,
    notBefore: notBefore ? iso(notBefore, "notBefore") : null,
    notAfter: notAfter ? iso(notAfter, "notAfter") : null,
  });
  if (keyring.pinned.some((k) => k.keyId === key.keyId)) return keyring;
  return Object.freeze({ ...keyring, pinned: Object.freeze([...keyring.pinned, key]) });
}

/** rotateKey(keyring, { privateKeyPem, newPublicKeyPem, at, overlapUntil }) */
export function rotateKey(keyring, { privateKeyPem, newPublicKeyPem, at, overlapUntil } = {}) {
  if (typeof newPublicKeyPem !== "string" || !newPublicKeyPem.includes("PUBLIC KEY")) {
    throw new TypeError("newPublicKeyPem must be an SPKI PEM string");
  }
  const statement = {
    keysVersion: KEYS_VERSION,
    schema: KEYS_SCHEMA,
    type: "rotate",
    from: keyIdFor(publicFromPrivate(privateKeyPem)),
    to: keyIdFor(newPublicKeyPem),
    toPublicKeyPem: newPublicKeyPem,
    at: iso(at, "at"),
    overlapUntil: iso(overlapUntil, "overlapUntil"),
  };
  if (Date.parse(statement.overlapUntil) < Date.parse(statement.at)) {
    throw new TypeError("overlapUntil must not precede at");
  }
  const signature = sign(null, Buffer.from(canonicalJson(statement), "utf8"), privateKeyPem).toString("base64");
  return Object.freeze({ ...keyring, rotations: Object.freeze([...keyring.rotations, Object.freeze({ ...statement, signature })]) });
}

/** revokeKey(keyring, { privateKeyPem, keyId, at, retroactive, reason }) */
export function revokeKey(keyring, { privateKeyPem, keyId, at, retroactive = false, reason = null } = {}) {
  if (typeof keyId !== "string" || !/^[0-9a-f]{64}$/.test(keyId)) throw new TypeError("keyId must be a 64-character hex id");
  const statement = {
    keysVersion: KEYS_VERSION,
    schema: KEYS_SCHEMA,
    type: "revoke",
    keyId,
    by: keyIdFor(publicFromPrivate(privateKeyPem)),
    at: iso(at, "at"),
    retroactive: retroactive === true,
    reason: typeof reason === "string" ? reason : null,
  };
  const signature = sign(null, Buffer.from(canonicalJson(statement), "utf8"), privateKeyPem).toString("base64");
  return Object.freeze({ ...keyring, revocations: Object.freeze([...keyring.revocations, Object.freeze({ ...statement, signature })]) });
}

/**
 * The trust closure: pinned roots plus every key reachable through a rotation
 * statement that verifies against a key already in the closure. Iterated to a
 * fixpoint, so A→B→C is trusted exactly when both links verify.
 */
function trustClosure(keyring) {
  const keys = new Map();
  for (const k of keyring.pinned) keys.set(k.keyId, { ...k, depth: 0, from: null });
  const links = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of keyring.rotations) {
      const parent = keys.get(r.from);
      if (!parent) continue;
      if (r.to !== keyIdFor(r.toPublicKeyPem)) continue;
      if (!signedBy(parent.publicKeyPem, rotationBody(r), r.signature)) continue;
      if (!links.has(r.from)) links.set(r.from, Object.freeze({ to: r.to, at: r.at, overlapUntil: r.overlapUntil }));
      if (!keys.has(r.to)) {
        keys.set(r.to, Object.freeze({ keyId: r.to, publicKeyPem: r.toPublicKeyPem, issuer: parent.issuer, notBefore: null, notAfter: null, depth: parent.depth + 1, from: r.from }));
        changed = true;
      }
    }
  }
  return { keys, links };
}

function checkKeyInner(keyring, keyId, when, seen) {
  const t = Date.parse(when);
  const { keys, links } = trustClosure(keyring);
  const key = keys.get(keyId);
  if (!key) {
    return Object.freeze({
      keyId,
      status: "unknown",
      trustedAtTime: false,
      acceptsNew: false,
      at: when,
      reason: "key is not in this keyring's trust closure",
      chainFrom: null,
    });
  }
  const base = { keyId, at: when, issuer: key.issuer ?? null, chainFrom: key.from ?? null, depth: key.depth };

  for (const r of keyring.revocations.filter((x) => x.keyId === keyId)) {
    const signer = keys.get(r.by);
    if (!signer) continue;
    if (!signedBy(signer.publicKeyPem, revocationBody(r), r.signature)) continue;
    const self = r.by === keyId;
    const authorised = self || (seen.has(r.by) ? false : (seen.add(r.by), checkKeyInner(keyring, r.by, r.at, seen).trustedAtTime === true));
    if (!authorised) continue;
    if (r.retroactive === true) {
      return Object.freeze({ ...base, status: "revoked", trustedAtTime: false, acceptsNew: false, reason: r.reason ?? "retroactive revocation" });
    }
    if (t >= Date.parse(r.at)) {
      return Object.freeze({ ...base, status: "revoked", trustedAtTime: false, acceptsNew: false, reason: r.reason ?? `revoked at ${r.at}` });
    }
  }

  if (key.notAfter && t > Date.parse(key.notAfter)) {
    return Object.freeze({ ...base, status: "expired", trustedAtTime: false, acceptsNew: false, reason: `notAfter ${key.notAfter}` });
  }
  if (key.notBefore && t < Date.parse(key.notBefore)) {
    return Object.freeze({ ...base, status: "not-yet-valid", trustedAtTime: false, acceptsNew: false, reason: `notBefore ${key.notBefore}` });
  }

  const successor = links.get(keyId);
  if (successor && t > Date.parse(successor.overlapUntil)) {
    return Object.freeze({ ...base, status: "rotated", trustedAtTime: false, acceptsNew: false, rotatedTo: successor.to, reason: `overlap ended ${successor.overlapUntil}` });
  }
  return Object.freeze({
    ...base,
    status: "trusted",
    trustedAtTime: true,
    acceptsNew: !successor,
    rotatedTo: successor ? successor.to : null,
    reason: null,
  });
}

/**
 * checkKey(keyring, { keyId, at })
 *
 *   trusted        in the closure and valid at `at`
 *   rotated        genuine, but past its overlap: only records it signed before
 *                  `overlapUntil` are good, and new signatures are refused
 *   revoked        a revocation applies at `at`, or retroactively
 *   expired        outside the pinned validity window
 *   not-yet-valid  before `notBefore`
 *   unknown        this keyring has no opinion — NOT_CHECKED, not forged
 */
export function checkKey(keyring, { keyId, at } = {}) {
  if (!keyring || typeof keyring !== "object") throw new TypeError("checkKey requires a keyring");
  if (typeof keyId !== "string") throw new TypeError("keyId must be a string");
  return checkKeyInner(keyring, keyId, iso(at, "at"), new Set([keyId]));
}

/**
 * verifyWithTrust(attestation, keyring)
 *
 * Two checks, kept apart in the output so triage can tell them apart:
 *   signature  the bytes verify against the key the attestation carries
 *   trust      that key was trusted at the moment the attestation claims
 *
 * `ok` requires both. An unknown key is NOT_CHECKED; a signature that verifies
 * under a revoked or rotated key is VERIFICATION_FAILED, with the key status
 * named. Neither is ever reported as "absent".
 */
export function verifyWithTrust(attestation, keyring) {
  const checks = [];
  if (!attestation || typeof attestation !== "object") {
    return Object.freeze({ ok: false, keyStatus: "unknown", outcome: "NOT_CHECKED", checks: Object.freeze([{ name: "attestation is an object", ok: false }]) });
  }
  const sig = verifyAttestation(attestation);
  checks.push({ name: "attestation verifies against its own key", ok: sig.ok });
  const status = checkKey(keyring, { keyId: attestation?.issuer?.keyId, at: attestation?.issuedAt ?? new Date(0).toISOString() });
  checks.push({ name: `key status at issuedAt: ${status.status}`, ok: status.trustedAtTime === true });
  const ok = sig.ok && status.trustedAtTime === true;
  const outcome = ok ? "VERIFIED" : status.status === "unknown" ? "NOT_CHECKED" : "VERIFICATION_FAILED";
  return Object.freeze({
    ok,
    keyStatus: status.status,
    outcome,
    acceptsNew: status.acceptsNew === true,
    reason: ok ? null : status.reason ?? "signature did not verify",
    checks: Object.freeze(checks),
    signatureOk: sig.ok,
    chain: status.chainFrom ? { from: status.chainFrom, depth: status.depth ?? null } : null,
  });
}

export function selfCheck() {
  const checks = [];
  const a = generateIssuerKey();
  const b = generateIssuerKey();
  const subject = { kind: "receipt", digest: "sha256:" + "b".repeat(64) };
  let ring = pinKey(createKeyring({ id: "selfcheck" }), { publicKeyPem: a.publicKeyPem, issuer: "self" });
  const att = signAttestation({ subject, issuedAt: "2026-01-01T00:00:00Z", privateKeyPem: a.privateKeyPem });

  checks.push({ name: "pinned key verifies its own attestation", pass: verifyWithTrust(att, ring).ok === true });

  const unpinned = verifyWithTrust(att, createKeyring());
  checks.push({ name: "unknown key is NOT_CHECKED, not failed", pass: unpinned.outcome === "NOT_CHECKED" && unpinned.keyStatus === "unknown" });

  const rotated = rotateKey(ring, { privateKeyPem: a.privateKeyPem, newPublicKeyPem: b.publicKeyPem, at: "2026-02-01T00:00:00Z", overlapUntil: "2026-02-08T00:00:00Z" });
  checks.push({ name: "successor key is trusted through the rotation chain", pass: checkKey(rotated, { keyId: keyIdFor(b.publicKeyPem), at: "2026-02-02T00:00:00Z" }).status === "trusted" });
  checks.push({ name: "old key inside the overlap stays valid", pass: checkKey(rotated, { keyId: keyIdFor(a.publicKeyPem), at: "2026-02-03T00:00:00Z" }).trustedAtTime === true });
  checks.push({ name: "old key after the overlap is rotated, not trusted", pass: checkKey(rotated, { keyId: keyIdFor(a.publicKeyPem), at: "2026-03-01T00:00:00Z" }).status === "rotated" });

  const late = signAttestation({ subject, issuedAt: "2026-03-01T00:00:00Z", privateKeyPem: a.privateKeyPem });
  checks.push({ name: "post-overlap signature by the old key is refused", pass: verifyWithTrust(late, rotated).outcome === "VERIFICATION_FAILED" });

  const retro = revokeKey(ring, { privateKeyPem: a.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-01-15T00:00:00Z", retroactive: true, reason: "compromise" });
  checks.push({ name: "retroactive revocation invalidates a past attestation", pass: verifyWithTrust(att, retro).ok === false && verifyWithTrust(att, retro).keyStatus === "revoked" });

  const forward = revokeKey(ring, { privateKeyPem: a.privateKeyPem, keyId: keyIdFor(a.publicKeyPem), at: "2026-01-15T00:00:00Z", retroactive: false });
  checks.push({ name: "non-retroactive revocation keeps records from before it", pass: verifyWithTrust(att, forward).ok === true });
  const after = signAttestation({ subject, issuedAt: "2026-02-01T00:00:00Z", privateKeyPem: a.privateKeyPem });
  checks.push({ name: "non-retroactive revocation refuses records after it", pass: verifyWithTrust(after, forward).ok === false });

  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
