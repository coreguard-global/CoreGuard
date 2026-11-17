/**
 * CG-TAS/1 trust anchor set — v1 minimal slice tests.
 * Frozen decisions: docs/AER1-TRUST-ANCHOR-SET-SPEC-V1-DRAFT.md
 * (distribution = caller-pinned canonical document + optional sha256 digest
 * pin; rotation = per-key windows against injected decision time; revocation =
 * decisive and fail-closed). Deterministic, offline, no wall-clock.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, sign as edSign } from "node:crypto";

import {
  verifyResolvedRecordProvenance,
  PROVENANCE_SCHEMA,
  PROVENANCE_VERDICT_CODES,
} from "../../scripts/ladder/resolved-record-provenance.mjs";
import {
  verifyResolvedRecordProvenanceViaAnchorSet,
  validateAnchorSet,
  resolveAnchorKey,
  anchorSetDigestOf,
  ANCHOR_SET_SCHEMA,
} from "../../scripts/ladder/trust-anchor-set.mjs";

/* ------------------------------------------------ deterministic key material */

function keypairFromSeed(hexSeed, keyId) {
  const seed = Buffer.from(hexSeed, "hex");
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const priv = createPrivateKey({ key: Buffer.concat([pkcs8Prefix, seed]), format: "der", type: "pkcs8" });
  const pubDer = createPublicKey(priv).export({ format: "der", type: "spki" });
  const publicKeyHex = Buffer.from(pubDer).subarray(12).toString("hex");
  return { keyId, privateKey: priv, publicKeyHex };
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

const ISSUER = keypairFromSeed("aa".repeat(32), "tas-issuer-a");
const ROTATED = keypairFromSeed("bb".repeat(32), "tas-issuer-b");
const ATTACKER = keypairFromSeed("cc".repeat(32), "tas-attacker");

const BASE_NOW = 1750000000;
const CONTEXT = { network: "mainnet", chainId: "1116" };

function payloadFor(kp, overrides = {}) {
  const base = {
    v: PROVENANCE_SCHEMA,
    recordId: "rec-tas-1",
    artifactDigest: "sha256:tas-artifact",
    context: { network: CONTEXT.network, chainId: CONTEXT.chainId },
    issuerKeyId: kp.keyId,
  };
  return { ...base, ...overrides };
}

function signPayload(kp, payload) {
  return edSign(null, Buffer.from(canonicalJson(payload), "utf8"), kp.privateKey).toString("hex");
}

function envelopeFor(kp, payload, opts = {}) {
  const env = { payload, signature: opts.signature !== undefined ? opts.signature : signPayload(kp, payload) };
  if (opts.extraEnvelope) Object.assign(env, opts.extraEnvelope);
  return env;
}

function keyEntry(kp, extra = {}) {
  return { keyId: kp.keyId, publicKeyHex: kp.publicKeyHex, ...extra };
}

function baseSetObject({ withRotation = true } = {}) {
  const keys = [keyEntry(ISSUER, { notBefore: 1600000000, notAfter: 2000000000 })];
  if (withRotation) keys.push(keyEntry(ROTATED, { notBefore: 1800000000 }));
  return { spec: ANCHOR_SET_SCHEMA, anchorSetId: "tas-set-1", keys, generatedAt: 1690000000, annotations: { owner: "coreguard" } };
}

const SET_TEXT = canonicalJson(baseSetObject());
const SET_DIGEST = anchorSetDigestOf(baseSetObject());

function verifyViaSet(record, setSource = SET_TEXT, options = { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST }, ctx = CONTEXT) {
  return verifyResolvedRecordProvenanceViaAnchorSet(record, setSource, ctx, options);
}

const isEnumCode = (code) => Object.values(PROVENANCE_VERDICT_CODES).includes(code);

/* ------------------------------------------------------------------- tests */

test("gate: honest record verifies through the caller-pinned set AND the direct CG-RRP/1 path (parity)", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const viaSet = verifyViaSet(record);
  const direct = verifyResolvedRecordProvenance(record, { keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex }, CONTEXT, { nowSeconds: BASE_NOW });
  assert.equal(viaSet.verdict, "VERIFIED");
  assert.equal(viaSet.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  assert.equal(direct.verdictCode, viaSet.verdictCode, "set path and frozen direct path must agree on the honest record");
});

test("record self-selecting a key absent from the pinned set fails closed (UNKNOWN_KEY_ID)", () => {
  const payload = payloadFor(ISSUER, { issuerKeyId: "ghost-key" });
  const record = envelopeFor(ISSUER, payload);
  const out = verifyViaSet(record);
  assert.equal(out.verdict, "INVALID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER);
  assert.equal(out.setReason, "UNKNOWN_KEY_ID");
});

test("duplicate keyId (byte-identical duplicates) is an ambiguous distribution -> CONFLICT, never first-match", () => {
  const obj = baseSetObject();
  obj.keys.push({ ...obj.keys[0] });
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyViaSet(record, canonicalJson(obj), { nowSeconds: BASE_NOW });
  assert.equal(out.verdict, "INVALID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
  assert.equal(out.setReason, "DUPLICATE_KEY_ID");
});

test("duplicate keyId carried by two DIFFERENT keys is equally a CONFLICT", () => {
  const obj = baseSetObject({ withRotation: false });
  obj.keys.push({ keyId: ISSUER.keyId, publicKeyHex: ATTACKER.publicKeyHex }); // attacker's key under the issuer's keyId
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyViaSet(record, canonicalJson(obj), { nowSeconds: BASE_NOW });
  assert.equal(out.setReason, "DUPLICATE_KEY_ID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
});

test("revocation dominates: a revoked key with a VALID signature still fails closed", () => {
  const obj = baseSetObject({ withRotation: false });
  obj.keys[0] = { ...obj.keys[0], revoked: true, revokedAt: 1600000000 };
  const record = envelopeFor(ISSUER, payloadFor(ISSUER)); // signature is valid
  const out = verifyViaSet(record, canonicalJson(obj), { nowSeconds: BASE_NOW });
  assert.equal(out.verdict, "INVALID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER);
  assert.equal(out.setReason, "ANCHOR_REVOKED");
});

test("revokedAt is informational: changing it never changes the revocation verdict", () => {
  const objA = baseSetObject({ withRotation: false });
  objA.keys[0] = { ...objA.keys[0], revoked: true, revokedAt: 1600000000 };
  const objB = baseSetObject({ withRotation: false });
  objB.keys[0] = { ...objB.keys[0], revoked: true, revokedAt: 1999999999 };
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const a = verifyViaSet(record, canonicalJson(objA), { nowSeconds: BASE_NOW });
  const b = verifyViaSet(record, canonicalJson(objB), { nowSeconds: BASE_NOW });
  assert.equal(a.setReason, "ANCHOR_REVOKED");
  assert.equal(b.setReason, "ANCHOR_REVOKED");
  assert.deepEqual(
    { verdict: a.verdict, verdictCode: a.verdictCode },
    { verdict: b.verdict, verdictCode: b.verdictCode },
  );
});

test("key not yet valid (notBefore in the future, injected decision time) fails closed", () => {
  const obj = baseSetObject({ withRotation: false });
  obj.keys[0] = { ...obj.keys[0], notBefore: BASE_NOW + 1000, notAfter: 2000000000 };
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyViaSet(record, canonicalJson(obj), { nowSeconds: BASE_NOW });
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_NOT_YET_VALID);
  assert.equal(out.setReason, "ANCHOR_NOT_YET_VALID");
});

test("expired key (notAfter in the past, injected decision time) fails closed", () => {
  const obj = baseSetObject({ withRotation: false });
  obj.keys[0] = { ...obj.keys[0], notBefore: 1600000000, notAfter: BASE_NOW - 1000 };
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyViaSet(record, canonicalJson(obj), { nowSeconds: BASE_NOW });
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_EXPIRED);
  assert.equal(out.setReason, "ANCHOR_EXPIRED");
});

test("window bounds are inclusive at both edges (notBefore and notAfter admit equality)", () => {
  const t0 = 1750000000;
  const t1 = 1760000000;
  const obj = baseSetObject({ withRotation: false });
  obj.keys[0] = { ...keyEntry(ISSUER), notBefore: t0, notAfter: t1 };
  const record = envelopeFor(ISSUER, payloadFor(ISSUER)); // no record time window
  const atStart = verifyViaSet(record, canonicalJson(obj), { nowSeconds: t0 });
  const atEnd = verifyViaSet(record, canonicalJson(obj), { nowSeconds: t1 });
  const before = verifyViaSet(record, canonicalJson(obj), { nowSeconds: t0 - 1 });
  const after = verifyViaSet(record, canonicalJson(obj), { nowSeconds: t1 + 1 });
  assert.equal(atStart.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  assert.equal(atEnd.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  assert.equal(before.setReason, "ANCHOR_NOT_YET_VALID");
  assert.equal(after.setReason, "ANCHOR_EXPIRED");
});

test("rotation overlap resolves per record: both era keys work, each through its own declaration", () => {
  const obj = baseSetObject({ withRotation: true }); // A: [1.6e9, 2.0e9], B: [1.8e9, inf)
  const recordA = envelopeFor(ISSUER, payloadFor(ISSUER));
  const recordB = envelopeFor(ROTATED, payloadFor(ROTATED, { recordId: "rec-tas-2" }));
  const overlapTime = 1850000000; // inside both windows
  const a = verifyViaSet(recordA, canonicalJson(obj), { nowSeconds: overlapTime });
  const b = verifyViaSet(recordB, canonicalJson(obj), { nowSeconds: overlapTime });
  assert.equal(a.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  assert.equal(b.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  // and the rotated-in key is NOT usable before its window starts
  const bEarly = verifyViaSet(recordB, canonicalJson(obj), { nowSeconds: 1700000000 });
  assert.equal(bEarly.setReason, "ANCHOR_NOT_YET_VALID");
});

test("digest pin: the honest set verifies under its pin; a tampered set behind the ORIGINAL pin is a conflict", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const honest = verifyViaSet(record, SET_TEXT, { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST });
  assert.equal(honest.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);

  const tampered = baseSetObject({ withRotation: false });
  tampered.keys[0] = { ...tampered.keys[0], publicKeyHex: ATTACKER.publicKeyHex };
  const out = verifyViaSet(record, canonicalJson(tampered), { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST });
  assert.equal(out.verdict, "INVALID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
  assert.equal(out.setReason, "DIGEST_MISMATCH");
});

test("digest is defined over canonical bytes: pretty-printed transport text does not move the pin", () => {
  const pretty = JSON.stringify(baseSetObject(), null, 2);
  assert.equal(anchorSetDigestOf(JSON.parse(pretty)), SET_DIGEST, "digest must be formatting-independent");
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyViaSet(record, pretty, { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST });
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
});

test("strict shape: unknown top-level and unknown key fields are conflicts, never ignored", () => {
  const withUnknownTop = { ...baseSetObject(), backdoor: "attacker" };
  assert.equal(validateAnchorSet(withUnknownTop).code, "UNKNOWN_SET_FIELD");

  const withUnknownKeyField = baseSetObject({ withRotation: false });
  withUnknownKeyField.keys[0] = { ...withUnknownKeyField.keys[0], trustMe: true };
  assert.equal(validateAnchorSet(withUnknownKeyField).code, "UNKNOWN_KEY_FIELD");

  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const viaWrapper = verifyViaSet(record, canonicalJson(withUnknownTop), { nowSeconds: BASE_NOW });
  assert.equal(viaWrapper.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
});

test("strict shape: type confusion fails closed (uppercase hex, string windows, malformed revocation)", () => {
  const upper = baseSetObject({ withRotation: false });
  upper.keys[0] = { ...upper.keys[0], publicKeyHex: ATTACKER.publicKeyHex.toUpperCase() };
  assert.equal(validateAnchorSet(upper).code, "BAD_PUBLIC_KEY_HEX");

  const stringWindow = baseSetObject({ withRotation: false });
  stringWindow.keys[0] = { ...stringWindow.keys[0], notBefore: "1600000000" };
  assert.equal(validateAnchorSet(stringWindow).code, "BAD_WINDOW");

  const badRevocation = baseSetObject({ withRotation: false });
  badRevocation.keys[0] = { ...badRevocation.keys[0], revoked: true }; // revokedAt missing
  assert.equal(validateAnchorSet(badRevocation).code, "BAD_REVOCATION");

  const strayRevokedAt = baseSetObject({ withRotation: false });
  strayRevokedAt.keys[0] = { ...strayRevokedAt.keys[0], revokedAt: 1600000000 }; // not revoked
  assert.equal(validateAnchorSet(strayRevokedAt).code, "BAD_REVOCATION");

  const invertedWindow = baseSetObject({ withRotation: false });
  invertedWindow.keys[0] = { ...invertedWindow.keys[0], notBefore: 2000000000, notAfter: 1600000000 };
  assert.equal(validateAnchorSet(invertedWindow).code, "BAD_WINDOW");
});

test("the set path always requires a caller-injected decision time (no wall clock, ever)", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const missing = verifyViaSet(record, SET_TEXT, {});
  assert.equal(missing.verdict, "INVALID");
  assert.equal(missing.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED);
  assert.equal(missing.setReason, "MISSING_DECISION_TIME");

  const asString = verifyViaSet(record, SET_TEXT, { nowSeconds: String(BASE_NOW) });
  assert.equal(asString.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED);
});

test("non-decisional fields: annotations and generatedAt never move a verdict (no pin)", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const annotated = { ...baseSetObject(), annotations: { owner: "coreguard", extra: "noise" }, generatedAt: 1690000001 };
  const a = verifyViaSet(record, SET_TEXT, { nowSeconds: BASE_NOW });
  const b = verifyViaSet(record, canonicalJson(annotated), { nowSeconds: BASE_NOW });
  assert.equal(a.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  assert.equal(b.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
});

test("caller ambiguity: pinning both an anchor set and a single trust anchor fails closed", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const out = verifyResolvedRecordProvenanceViaAnchorSet(record, SET_TEXT, CONTEXT, {
    nowSeconds: BASE_NOW,
    anchorSetDigest: SET_DIGEST,
    trustAnchor: { keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex },
  });
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
  assert.equal(out.setReason, "CALLER_AMBIGUOUS_INPUT");
});

test("the record may not carry its own trust material: extra envelope fields are malformed (CG-RRP/1 unchanged)", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER), { extraEnvelope: { anchorSet: SET_TEXT } });
  const out = verifyViaSet(record);
  assert.equal(out.verdict, "INVALID");
  assert.equal(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED);
});

test("determinism: identical inputs produce byte-identical results across repeated runs", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER, { issuedAt: 1700000000, expiresAt: 1900000000 }));
  const first = JSON.stringify(verifyViaSet(record));
  for (let i = 0; i < 10; i++) {
    assert.equal(JSON.stringify(verifyViaSet(record)), first, `run ${i} drifted`);
  }
});

test("non-permissiveness sweep: no attack vector in the battery ever reaches VERIFIED", () => {
  const record = envelopeFor(ISSUER, payloadFor(ISSUER));
  const attackerRecordPayload = payloadFor(ATTACKER);
  const attackerRecord = envelopeFor(ATTACKER, attackerRecordPayload);
  const duplicate = baseSetObject();
  duplicate.keys.push({ ...duplicate.keys[0] });
  const revokedSet = baseSetObject({ withRotation: false });
  revokedSet.keys[0] = { ...revokedSet.keys[0], revoked: true, revokedAt: 1600000000 };
  const expiredKeySet = baseSetObject({ withRotation: false });
  expiredKeySet.keys[0] = { ...expiredKeySet.keys[0], notAfter: BASE_NOW - 1 };

  const vectors = [
    { name: "unknown keyId", run: () => verifyViaSet({ ...record, payload: payloadFor(ISSUER, { issuerKeyId: "ghost" }) }) },
    { name: "duplicate keyId", run: () => verifyViaSet(record, canonicalJson(duplicate), { nowSeconds: BASE_NOW }) },
    { name: "revoked key", run: () => verifyViaSet(record, canonicalJson(revokedSet), { nowSeconds: BASE_NOW }) },
    { name: "expired key", run: () => verifyViaSet(record, canonicalJson(expiredKeySet), { nowSeconds: BASE_NOW }) },
    { name: "attacker key not in pinned set", run: () => verifyViaSet(attackerRecord, SET_TEXT, { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST }) },
    { name: "digest pin mismatch", run: () => { const t = baseSetObject({ withRotation: false }); t.keys[0] = { ...t.keys[0], publicKeyHex: ATTACKER.publicKeyHex }; return verifyViaSet(record, canonicalJson(t), { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST }); } },
    { name: "corrupt signature behind the set", run: () => verifyViaSet({ ...record, signature: record.signature.slice(0, 126) }) },
    { name: "context mismatch behind the set", run: () => verifyViaSet(record, SET_TEXT, { nowSeconds: BASE_NOW, anchorSetDigest: SET_DIGEST }, { network: "testnet", chainId: "1116" }) },
    { name: "missing decision time", run: () => verifyViaSet(record, SET_TEXT, {}) },
    { name: "non-JSON set text", run: () => verifyViaSet(record, "{not json", { nowSeconds: BASE_NOW }) },
  ];
  for (const v of vectors) {
    const out = v.run();
    assert.ok(isEnumCode(out.verdictCode), `${v.name}: verdictCode must stay on the frozen axis`);
    assert.notEqual(out.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED, `${v.name}: must never verify`);
  }
});

test("resolveAnchorKey unit: exact match inside a validated set, inclusive bounds, deterministic", () => {
  const set = baseSetObject();
  const ok = resolveAnchorKey(set, ISSUER.keyId, BASE_NOW);
  assert.deepEqual(ok.key, { keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex });
  const rotated = resolveAnchorKey(set, ROTATED.keyId, 1800000000); // inclusive start
  assert.equal(rotated.ok, true);
  assert.equal(resolveAnchorKey(set, ROTATED.keyId, 1799999999).code, "ANCHOR_NOT_YET_VALID");
  assert.equal(resolveAnchorKey(set, "nope", BASE_NOW).code, "UNKNOWN_KEY_ID");
});
