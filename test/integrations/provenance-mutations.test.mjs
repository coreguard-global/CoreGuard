/**
 * Source-mutation battery for the provenance layer (CG-RRP/1 + CG-TAS/1).
 *
 * Applied-AND-bites discipline: each named mutation is string-applied to the
 * module source, loaded from a temp copy, and must demonstrably change the
 * frozen verdict on its probe — a mutant that still passes is a HOLE in the
 * suite, not a green. Deterministic, offline, temp files under os.tmpdir().
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPrivateKey, createPublicKey, sign as edSign } from "node:crypto";

import {
  verifyResolvedRecordProvenance,
  PROVENANCE_SCHEMA,
  PROVENANCE_VERDICT_CODES,
} from "../../scripts/ladder/resolved-record-provenance.mjs";
import {
  verifyResolvedRecordProvenanceViaAnchorSet,
  anchorSetDigestOf,
  ANCHOR_SET_SCHEMA,
} from "../../scripts/ladder/trust-anchor-set.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const RRP_FILE = join(REPO, "scripts", "ladder", "resolved-record-provenance.mjs");
const TAS_FILE = join(REPO, "scripts", "ladder", "trust-anchor-set.mjs");

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

const ISSUER = keypairFromSeed("aa".repeat(32), "mut-issuer-a");
const ATTACKER = keypairFromSeed("cc".repeat(32), "mut-attacker");

const CONTEXT = { network: "mainnet", chainId: "1116" };
const BASE_NOW = 1750000000;
const anchorOf = (kp) => ({ keyId: kp.keyId, publicKeyHex: kp.publicKeyHex });

function payloadFor(kp, overrides = {}) {
  return {
    v: PROVENANCE_SCHEMA,
    recordId: "rec-mut-1",
    artifactDigest: "sha256:mut-artifact",
    context: { network: CONTEXT.network, chainId: CONTEXT.chainId },
    issuerKeyId: kp.keyId,
    ...overrides,
  };
}

function signPayload(kp, payload) {
  return edSign(null, Buffer.from(canonicalJson(payload), "utf8"), kp.privateKey).toString("hex");
}

function envelopeFor(kp, payload) {
  return { payload, signature: signPayload(kp, payload) };
}

function baseSetObject() {
  return {
    spec: ANCHOR_SET_SCHEMA,
    anchorSetId: "mut-set-1",
    keys: [{ keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex, notBefore: 1600000000, notAfter: 2000000000 }],
  };
}

/* ----------------------------------------------------- the mutation battery */

const MUTATIONS = [
  {
    name: "rrp/issuer-keyid-match-bypass",
    file: RRP_FILE,
    from: "if (ta.anchor.keyId !== p.payload.issuerKeyId) {",
    to: "if (false) {",
    correct: () =>
      verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuerKeyId: ISSUER.keyId + "-evil" })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER },
    runMutant: (m) =>
      m.verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuerKeyId: ISSUER.keyId + "-evil" })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
  },
  {
    name: "rrp/context-binding-dropped",
    file: RRP_FILE,
    from: "if (p.payload.context.network !== ec.context.network || p.payload.context.chainId !== ec.context.chainId) {",
    to: "if (false) {",
    correct: () =>
      verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { context: { network: "testnet", chainId: "1116" } })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_CONTEXT_MISMATCH },
    runMutant: (m) =>
      m.verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { context: { network: "testnet", chainId: "1116" } })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
  },
  {
    name: "rrp/record-expiry-dropped",
    file: RRP_FILE,
    from: "p.expiresAt !== null && now > p.expiresAt",
    to: "false",
    correct: () =>
      verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuedAt: 1, expiresAt: 2 })),
        anchorOf(ISSUER), CONTEXT, { nowSeconds: 1000 },
      ),
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_EXPIRED },
    runMutant: (m) =>
      m.verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuedAt: 1, expiresAt: 2 })),
        anchorOf(ISSUER), CONTEXT, { nowSeconds: 1000 },
      ),
  },
  {
    name: "rrp/missing-nowseconds-accepted",
    file: RRP_FILE,
    from: 'if (!isSafeInt(now) || now < 0) return malformed("nowSeconds (non-negative safe integer) is required when a time window is present");',
    to: 'if (false) return malformed("nowSeconds (non-negative safe integer) is required when a time window is present");',
    correct: () =>
      verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuedAt: 1, expiresAt: 2 })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_MALFORMED },
    runMutant: (m) =>
      m.verifyResolvedRecordProvenance(
        envelopeFor(ISSUER, payloadFor(ISSUER, { issuedAt: 1, expiresAt: 2 })),
        anchorOf(ISSUER), CONTEXT, {},
      ),
  },
  {
    name: "tas/revocation-ignored",
    file: TAS_FILE,
    from: "const entry = matches[0];\n  if (entry.revoked === true) {",
    to: "const entry = matches[0];\n  if (false) {",
    correct: () => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], revoked: true, revokedAt: 1600000000 };
      return verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_UNTRUSTED_ISSUER, setReason: "ANCHOR_REVOKED" },
    runMutant: (m) => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], revoked: true, revokedAt: 1600000000 };
      return m.verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
  },
  {
    name: "tas/duplicate-keyid-first-match",
    file: TAS_FILE,
    from: "if (matches.length !== 1) {",
    to: "if (matches.length < 1) {",
    correct: () => {
      const obj = baseSetObject();
      obj.keys.push({ ...obj.keys[0] });
      return verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT, setReason: "DUPLICATE_KEY_ID" },
    runMutant: (m) => {
      const obj = baseSetObject();
      obj.keys.push({ ...obj.keys[0] });
      return m.verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
  },
  {
    name: "tas/notbefore-window-dropped",
    file: TAS_FILE,
    from: "if (entry.notBefore !== undefined && decisionTime < entry.notBefore) {",
    to: "if (false) {",
    correct: () => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], notBefore: BASE_NOW + 1000 };
      return verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_NOT_YET_VALID, setReason: "ANCHOR_NOT_YET_VALID" },
    runMutant: (m) => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], notBefore: BASE_NOW + 1000 };
      return m.verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
  },
  {
    name: "tas/notafter-window-dropped",
    file: TAS_FILE,
    from: "if (entry.notAfter !== undefined && decisionTime > entry.notAfter) {",
    to: "if (false) {",
    correct: () => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], notAfter: BASE_NOW - 1000 };
      return verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_EXPIRED, setReason: "ANCHOR_EXPIRED" },
    runMutant: (m) => {
      const obj = baseSetObject();
      obj.keys[0] = { ...obj.keys[0], notAfter: BASE_NOW - 1000 };
      return m.verifyResolvedRecordProvenanceViaAnchorSet(
        envelopeFor(ISSUER, payloadFor(ISSUER)), canonicalJson(obj), CONTEXT, { nowSeconds: BASE_NOW },
      );
    },
  },
  {
    name: "tas/digest-pin-ignored",
    file: TAS_FILE,
    from: "if (expectedDigest !== undefined) {",
    to: "if (false) {",
    correct: async () => {
      // Tampered set (attacker key under the issuer's keyId) behind the pinned
      // ORIGINAL digest of the honest set — the pin is what catches it.
      const tampered = baseSetObject();
      tampered.keys[0] = { ...tampered.keys[0], publicKeyHex: ATTACKER.publicKeyHex };
      const record = envelopeFor(ATTACKER, payloadFor(ATTACKER, { issuerKeyId: ISSUER.keyId }));
      return verifyResolvedRecordProvenanceViaAnchorSet(
        record, canonicalJson(tampered), CONTEXT,
        { nowSeconds: BASE_NOW, anchorSetDigest: anchorSetDigestOf(baseSetObject()) },
      );
    },
    expect: { verdictCode: PROVENANCE_VERDICT_CODES.PROVENANCE_CONFLICT, setReason: "DIGEST_MISMATCH" },
    runMutant: async (m) => {
      const tampered = baseSetObject();
      tampered.keys[0] = { ...tampered.keys[0], publicKeyHex: ATTACKER.publicKeyHex };
      const real = await import(pathToFileURL(TAS_FILE).href);
      const pin = real.anchorSetDigestOf(baseSetObject()); // ORIGINAL honest-set digest
      const record = envelopeFor(ATTACKER, payloadFor(ATTACKER, { issuerKeyId: ISSUER.keyId }));
      return m.verifyResolvedRecordProvenanceViaAnchorSet(
        record, canonicalJson(tampered), CONTEXT, { nowSeconds: BASE_NOW, anchorSetDigest: pin },
      );
    },
  },
];

/* ------------------------------------------------------------ the machinery */

async function importMutant(mutation) {
  const src = readFileSync(mutation.file, "utf8");
  assert.ok(src.includes(mutation.from), `mutation "${mutation.name}" does not apply — source anchor not found`);
  let mutated = src.replace(mutation.from, mutation.to);
  assert.notEqual(mutated, src, `mutation "${mutation.name}" did not change the source`);
  if (mutation.file === TAS_FILE) {
    // The temp copy leaves the repo — repoint the sibling import at the real
    // CG-RRP/1 module so the mutant runs in isolation.
    mutated = mutated.replace(
      'from "./resolved-record-provenance.mjs"',
      `from "${pathToFileURL(RRP_FILE).href}"`,
    );
    assert.ok(mutated.includes(pathToFileURL(RRP_FILE).href), "sibling import rewrite failed");
  }
  const dir = mkdtempSync(join(tmpdir(), "prov-mut-"));
  const outPath = join(dir, basename(mutation.file));
  writeFileSync(outPath, mutated, "utf8");
  try {
    return await import(pathToFileURL(outPath).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the battery is real: nine named mutants, unique names, all anchored in current sources", () => {
  assert.equal(MUTATIONS.length, 9);
  const names = MUTATIONS.map((m) => m.name);
  assert.deepEqual(new Set(names).size, names.length, "mutation names must be unique");
  for (const m of MUTATIONS) {
    assert.ok(readFileSync(m.file, "utf8").includes(m.from), `anchor missing for ${m.name} — update the battery with the module`);
  }
});

for (const mutation of MUTATIONS) {
  test(`mutation applies AND bites: ${mutation.name}`, async () => {
    // 1) The CORRECT module must produce the frozen expectation on the probe.
    const correct = await mutation.correct();
    assert.equal(correct.verdictCode, mutation.expect.verdictCode, `${mutation.name}: probe expectation drifted from the frozen contract`);
    if (mutation.expect.setReason) assert.equal(correct.setReason, mutation.expect.setReason);

    // 2) The MUTANT must apply and then BITE: behavior must move — for every
    //    probe here, the dangerous direction is reaching PROVENANCE_VERIFIED.
    const mutant = await importMutant(mutation);
    const result = await mutation.runMutant(mutant);
    assert.equal(
      result.verdictCode,
      PROVENANCE_VERDICT_CODES.PROVENANCE_VERIFIED,
      `${mutation.name}: mutant did NOT escape the probe — the suite would miss this regression class (${JSON.stringify(result)})`,
    );
  });
}
