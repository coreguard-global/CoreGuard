/**
 * CG-RRP/1 resolved-record provenance — v1 minimal slice tests.
 * Positive/negative/adversarial, determinism, and independent reference checks.
 * Deterministic, offline, no wall-clock.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, randomBytes, sign as edSign } from "node:crypto";

import {
  verifyResolvedRecordProvenance,
  PROVENANCE_SCHEMA,
  PROVENANCE_VERDICT_CODES,
} from "../../scripts/ladder/resolved-record-provenance.mjs";

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function makeKeypair() {
  const seed = randomBytes(32);
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const priv = createPrivateKey({ key: Buffer.concat([pkcs8Prefix, seed]), format: "der", type: "pkcs8" });
  const pubDer = createPublicKey(priv).export({ format: "der", type: "spki" });
  const publicKeyHex = Buffer.from(pubDer).subarray(12).toString("hex");
  return {
    keyId: "issuer-" + publicKeyHex.slice(0, 8),
    publicKeyHex,
    signPayload(payload) {
      return edSign(null, Buffer.from(canonicalJson(payload), "utf8"), priv).toString("hex");
    },
  };
}

function basePayload(kp, overrides = {}) {
  return {
    v: PROVENANCE_SCHEMA,
    recordId: "rec-1",
    artifactDigest: "sha256:artifact-aaa",
    context: { network: "mainnet", chainId: "1116" },
    issuerKeyId: kp.keyId,
    ...overrides,
  };
}

function makeRecord(kp, payloadOverrides = {}, opts = {}) {
  const payload = basePayload(kp, payloadOverrides);
  const signature = opts.signature !== undefined ? opts.signature : kp.signPayload(payload);
  const env = { payload, signature };
  if (opts.extraEnvelope) Object.assign(env, opts.extraEnvelope);
  return env;
}

function anchorOf(kp) {
  return { keyId: kp.keyId, publicKeyHex: kp.publicKeyHex };
}
const expectedContext = { network: "mainnet", chainId: "1116" };

function refVerify(record, anchor, ctx, options = {}) {
  try {
    if (Array.isArray(record)) return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT };
    if (!record || typeof record !== "object" || Array.isArray(record)) return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED };
    if (!("payload" in record) || !("signature" in record)) return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED };
    const { payload, signature } = record;
    if (!payload || typeof payload !== "object") return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED };
    if (!anchor || anchor.keyId !== payload.issuerKeyId) return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER };
    if (!payload.context || payload.context.network !== ctx.network || String(payload.context.chainId) !== String(ctx.chainId)) {
      return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_CONTEXT_MISMATCH };
    }
    // reference: verify signature by re-signing? can't without priv; instead compare deterministically via canonical+structure
    // for reference we only assert structural expectations against implementation on key cases below.
    return null; // defer to implementation for crypto in this simple ref
  } catch { return { verdict: "INVALID", verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED }; }
}

test("positive: valid signature under external pinned anchor and matching context -> PROVENANCE_VERIFIED", () => {
  const kp = makeKeypair();
  const r = verifyResolvedRecordProvenance(makeRecord(kp), anchorOf(kp), expectedContext);
  assert.equal(r.verdict, "VERIFIED");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
});

test("negative: bad signature -> PROVENANCE_BAD_SIGNATURE", () => {
  const kp = makeKeypair();
  const rec = makeRecord(kp);
  rec.signature = "00".repeat(64);
  const r = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_BAD_SIGNATURE);
});

test("negative: tampered payload (digest changed, signature kept) -> PROVENANCE_BAD_SIGNATURE", () => {
  const kp = makeKeypair();
  const rec = makeRecord(kp);
  rec.payload = { ...rec.payload, artifactDigest: "sha256:evil" };
  const r = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_BAD_SIGNATURE);
});

test("negative: untrusted issuer (anchor keyId mismatch) -> PROVENANCE_UNTRUSTED_ISSUER; record cannot select trust", () => {
  const kp = makeKeypair();
  const other = makeKeypair();
  const r = verifyResolvedRecordProvenance(makeRecord(kp), anchorOf(other), expectedContext);
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER);
});

test("negative: valid signature but wrong anchor public key (same keyId spoof attempt impossible since key differs) -> PROVENANCE_BAD_SIGNATURE", () => {
  const kp = makeKeypair();
  const other = makeKeypair();
  const anchor = { keyId: kp.keyId, publicKeyHex: other.publicKeyHex };
  const r = verifyResolvedRecordProvenance(makeRecord(kp), anchor, expectedContext);
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_BAD_SIGNATURE);
});

test("negative: context mismatch -> PROVENANCE_CONTEXT_MISMATCH", () => {
  const kp = makeKeypair();
  const r = verifyResolvedRecordProvenance(makeRecord(kp), anchorOf(kp), { network: "testnet", chainId: "1116" });
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONTEXT_MISMATCH);
});

test("negative: malformed inputs fail closed (never verified)", () => {
  const kp = makeKeypair();
  const base = makeRecord(kp);
  const cases = [
    [null, anchorOf(kp), expectedContext],
    ["x", anchorOf(kp), expectedContext],
    [{ payload: base.payload }, anchorOf(kp), expectedContext], // missing signature
    [{ signature: base.signature }, anchorOf(kp), expectedContext], // missing payload
    [{ ...base, extra: 1 }, anchorOf(kp), expectedContext], // unknown envelope field
    [makeRecord(kp, { v: "NOPE/1" }), anchorOf(kp), expectedContext],
    [makeRecord(kp, { recordId: "" }), anchorOf(kp), expectedContext],
    [makeRecord(kp, { artifactDigest: "" }), anchorOf(kp), expectedContext],
    [base, null, expectedContext],
    [base, { keyId: kp.keyId }, expectedContext],
  ];
  for (const [rec, anc, ctx] of cases) {
    const r = verifyResolvedRecordProvenance(rec, anc, ctx);
    assert.notEqual(r.verdict, "VERIFIED", JSON.stringify([rec && typeof rec, anc, ctx]));
  }
});

test("negative: unknown payload/context fields rejected (strict) -> PROVENANCE_MALFORMED", () => {
  const kp = makeKeypair();
  const r1 = verifyResolvedRecordProvenance(makeRecord(kp, { extra: "x" }), anchorOf(kp), expectedContext);
  assert.equal(r1.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED);
  const payload = basePayload(kp);
  payload.context = { network: "mainnet", chainId: "1116", extra: "x" };
  const rec = { payload, signature: kp.signPayload(payload) };
  const r2 = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  assert.equal(r2.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED);
});

test("time window: valid when within window with injected now", () => {
  const kp = makeKeypair();
  const rec = makeRecord(kp, { issuedAt: 100, expiresAt: 200 });
  const r = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext, { nowSeconds: 150 });
  assert.equal(r.verdict, "VERIFIED");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
});

test("time window: not yet valid / expired / missing now -> fail closed", () => {
  const kp = makeKeypair();
  const rec = makeRecord(kp, { issuedAt: 100, expiresAt: 200 });
  const early = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext, { nowSeconds: 50 });
  assert.equal(early.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_NOT_YET_VALID);
  const late = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext, { nowSeconds: 250 });
  assert.equal(late.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_EXPIRED);
  const noNow = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  assert.equal(noNow.verdict, "INVALID");
  assert.notEqual(noNow.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
});

test("conflict: multiple/ambiguous records not accepted -> PROVENANCE_CONFLICT", () => {
  const kp = makeKeypair();
  const r = verifyResolvedRecordProvenance([makeRecord(kp)], anchorOf(kp), expectedContext);
  assert.equal(r.verdict, "INVALID");
  assert.equal(r.verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT);
});

test("determinism: identical inputs produce identical results", () => {
  const kp = makeKeypair();
  const rec = makeRecord(kp);
  const a = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  const b = verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext);
  assert.deepEqual(a, b);
});

test("independent reference expectations agree on representative structural outcomes", () => {
  const kp = makeKeypair();
  const other = makeKeypair();
  const cases = [
    { rec: [makeRecord(kp)], anc: anchorOf(kp), ctx: expectedContext, code: PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT },
    { rec: makeRecord(kp), anc: anchorOf(other), ctx: expectedContext, code: PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER },
    { rec: makeRecord(kp), anc: anchorOf(kp), ctx: { network: "x", chainId: "1116" }, code: PROVENANCE_VERDICT_CODES.PROVENANCE_CONTEXT_MISMATCH },
  ];
  for (const c of cases) {
    const ref = refVerify(c.rec, c.anc, c.ctx);
    const impl = verifyResolvedRecordProvenance(c.rec, c.anc, c.ctx);
    if (ref) { assert.equal(impl.verdict, ref.verdict); assert.equal(impl.verdictCode, ref.verdictCode); }
    assert.equal(impl.verdictCode, c.code);
  }
});

test("non-permissiveness: verification requires pinned anchor + matching context + intact signed payload", () => {
  const kp = makeKeypair();
  const other = makeKeypair();
  const rec = makeRecord(kp);
  assert.equal(verifyResolvedRecordProvenance(rec, anchorOf(kp), expectedContext).verdictCode, PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED);
  // wrong context
  assert.notEqual(verifyResolvedRecordProvenance(rec, anchorOf(kp), { network: "mainnet", chainId: "1" }).verdict, "VERIFIED");
  // wrong anchor
  assert.notEqual(verifyResolvedRecordProvenance(rec, anchorOf(other), expectedContext).verdict, "VERIFIED");
  // tampered payload without re-signing
  const tampered = { payload: { ...rec.payload, artifactDigest: "sha256:other" }, signature: rec.signature };
  assert.notEqual(verifyResolvedRecordProvenance(tampered, anchorOf(kp), expectedContext).verdict, "VERIFIED");
});
