#!/usr/bin/env node
/**
 * provenance-fuzz.mjs — deterministic, offline fuzz campaign over the
 * provenance layer (CG-RRP/1 + CG-TAS/1).
 *
 * Complements `npm run mutation` (receipt/execution mutations): this lab
 * fuzzes the EVIDENCE-PROVENANCE boundary — the signed resolved record and
 * the caller-pinned trust-anchor set — with a fixed seed, no randomness and
 * no network, so CI and any reviewer reproduce byte-identical results.
 *
 * Gate rule (fail-closed, same discipline as the mutation lab):
 *   - the honest baseline MUST verify (PROVENANCE_VERIFIED);
 *   - every attack-family mutation MUST be refused (never PROVENANCE_VERIFIED);
 *   - every benign canonicalization variant MUST keep the baseline verdict
 *     (canonicalization invariance — reordering keys/whitespace never flips
 *     a decision);
 *   - no call may escape the verdict contract (verdict/verdictCode always in
 *     the frozen enums; no uncaught throw escapes the runner);
 *   - a deterministic re-run of sampled iterations must be byte-identical.
 *
 * Usage:
 *   node scripts/ladder/provenance-fuzz.mjs [iterations]
 * Exit 0 only when escaped === 0 && benignFailures === 0 && violations === 0.
 */

import { createPrivateKey, createPublicKey, sign as edSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { verifyResolvedRecordProvenance, PROVENANCE_SCHEMA } from "./resolved-record-provenance.mjs";
import {
  verifyResolvedRecordProvenanceViaAnchorSet,
  anchorSetDigestOf,
  ANCHOR_SET_SCHEMA,
} from "./trust-anchor-set.mjs";

const HEX = "0123456789abcdef";
const VERDICT_CODES = new Set([
  "PROVENANCE_VERIFIED", "PROVENANCE_MALFORMED", "PROVENANCE_UNTRUSTED_ISSUER",
  "PROVENANCE_BAD_SIGNATURE", "PROVENANCE_CONTEXT_MISMATCH", "PROVENANCE_NOT_YET_VALID",
  "PROVENANCE_EXPIRED", "PROVENANCE_CONFLICT", "PROVENANCE_UNVERIFIABLE",
]);
const VERDICTS = new Set(["VERIFIED", "INVALID", "UNKNOWN"]);

/* ---------------------------------------------------------- fixed material */

// Deterministic key material (fixed seeds — no randomBytes anywhere here).
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

const ISSUER = keypairFromSeed("11".repeat(32), "fuzz-issuer-a");
const ROTATED = keypairFromSeed("22".repeat(32), "fuzz-issuer-b");
const ATTACKER = keypairFromSeed("33".repeat(32), "fuzz-attacker");

const EXPECTED_CONTEXT = Object.freeze({ network: "mainnet", chainId: "1116" });

function payloadFor(kp, overrides = {}) {
  return {
    v: PROVENANCE_SCHEMA,
    recordId: "rec-fuzz-1",
    artifactDigest: "sha256:fuzz-artifact",
    context: { network: EXPECTED_CONTEXT.network, chainId: EXPECTED_CONTEXT.chainId },
    issuerKeyId: kp.keyId,
    issuedAt: 1700000000,
    expiresAt: 1900000000,
    ...overrides,
  };
}

function signPayload(kp, payload) {
  return edSign(null, Buffer.from(canonicalJson(payload), "utf8"), kp.privateKey).toString("hex");
}

function envelopeFor(kp, payload, sigOver = payload) {
  return { payload, signature: signPayload(kp, sigOver) };
}

// Baseline anchor set: issuer A valid across the record window; issuer B is
// the rotated-in key (valid later) — both eras live in one pinned set.
function baselineSetObject() {
  return {
    spec: ANCHOR_SET_SCHEMA,
    anchorSetId: "fuzz-anchor-set-1",
    keys: [
      { keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex, notBefore: 1600000000, notAfter: 2000000000 },
      { keyId: ROTATED.keyId, publicKeyHex: ROTATED.publicKeyHex, notBefore: 1800000000 },
    ],
    generatedAt: 1690000000,
    annotations: { owner: "coreguard", note: "fuzz baseline" },
  };
}

const BASELINE_NOW = 1750000000;
const BASELINE_SET_TEXT = canonicalJson(baselineSetObject());
const BASELINE_SET_DIGEST = anchorSetDigestOf(baselineSetObject());
const BASELINE_RECORD = envelopeFor(ISSUER, payloadFor(ISSUER));
const BASELINE_ANCHOR = Object.freeze({ keyId: ISSUER.keyId, publicKeyHex: ISSUER.publicKeyHex });

/* -------------------------------------------------------------- mutations */

function flipHexAt(hexStr, pos) {
  const chars = hexStr.split("");
  const idx = pos % chars.length;
  const c = HEX.indexOf(chars[idx]);
  chars[idx] = HEX[(c + 1) % 16];
  return chars.join("");
}

function setVariant(mutateKeys, extra = {}) {
  const obj = baselineSetObject();
  if (mutateKeys) obj.keys = mutateKeys(obj.keys.slice());
  return { ...obj, ...extra };
}

function runCase(record, setSource, ctx, options) {
  return verifyResolvedRecordProvenanceViaAnchorSet(record, setSource, ctx, options);
}

/** Families are deterministic in (cat, k). Every attack must be refused. */
function attackCase(cat, k) {
  switch (cat % 10) {
    case 0: { // signature corruption (byte flip / truncation / extension)
      const sig = BASELINE_RECORD.signature;
      const mutated = k % 3 === 0 ? flipHexAt(sig, k) : k % 3 === 1 ? sig.slice(0, sig.length - 2) : sig + "aa";
      return { record: { payload: BASELINE_RECORD.payload, signature: mutated }, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: pin() };
    }
    case 1: { // signed-payload tamper without re-signing → BAD_SIGNATURE
      const payload = payloadFor(ISSUER, k % 2 === 0
        ? { recordId: "rec-fuzz-" + String(2 + (k % 9)) } // always differs from the baseline id
        : { artifactDigest: "sha256:fuzz-artifac" + flipHexAt("t", k) });
      return { record: { payload, signature: BASELINE_RECORD.signature }, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: pin() };
    }
    case 2: { // context drift (record-side tamper, or expected-side swap)
      if (k % 2 === 0) {
        const payload = payloadFor(ISSUER, { context: { network: "testnet", chainId: "1116" } });
        return { record: { payload, signature: BASELINE_RECORD.signature }, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: pin() };
      }
      return { record: BASELINE_RECORD, set: BASELINE_SET_TEXT, ctx: { network: "testnet", chainId: "1116" }, options: pin() };
    }
    case 3: { // issuer keyId attacks (unknown / rotated-declared / case games)
      const keyId = k % 3 === 0 ? "unknown-key-id" : k % 3 === 1 ? ROTATED.keyId : ISSUER.keyId.toUpperCase();
      const payload = payloadFor(ISSUER, { issuerKeyId: keyId });
      return { record: { payload, signature: signPayload(ISSUER, payload) }, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: pin() };
    }
    case 4: { // decision-time shifts (record window and anchor-set window)
      const now = k % 4 === 0 ? 1700000000 - (k + 1) * 86400
        : k % 4 === 1 ? 1900000000 + (k + 1) * 86400
        : k % 4 === 2 ? 1600000000 - (k + 1) * 86400
        : 2000000000 + (k + 1) * 86400;
      return { record: BASELINE_RECORD, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: { ...pin(), nowSeconds: now } };
    }
    case 5: { // anchor-set tampering (key swap / duplicate / revoke / window / unknown field)
      const variant = k % 5;
      const keys = baselineSetObject().keys;
      let obj;
      if (variant === 0) obj = setVariant((ks) => { ks[0] = { ...ks[0], publicKeyHex: ATTACKER.publicKeyHex }; return ks; });
      else if (variant === 1) obj = setVariant((ks) => { ks.push({ ...ks[0] }); return ks; });
      else if (variant === 2) obj = setVariant((ks) => { ks[0] = { ...ks[0], revoked: true, revokedAt: 1600000000 }; return ks; });
      else if (variant === 3) obj = setVariant((ks) => { ks[0] = { ...ks[0], notAfter: 1700000000 }; return ks; });
      else obj = { ...baselineSetObject(), backdoor: "attacker-field" };
      return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
    }
    case 6: { // digest-pin attacks (wrong pin / pinned original over tampered set)
      const variant = k % 3;
      if (variant === 0) {
        return { record: BASELINE_RECORD, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW, anchorSetDigest: flipHexAt(BASELINE_SET_DIGEST, k) } };
      }
      if (variant === 1) {
        const tampered = setVariant((ks) => { ks[0] = { ...ks[0], publicKeyHex: ATTACKER.publicKeyHex }; return ks; });
        return { record: BASELINE_RECORD, set: canonicalJson(tampered), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW, anchorSetDigest: BASELINE_SET_DIGEST } };
      }
      const other = setVariant((ks) => [ks[1]]);
      return { record: BASELINE_RECORD, set: canonicalJson(other), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW, anchorSetDigest: BASELINE_SET_DIGEST } };
    }
    case 7: { // type confusion / structure attacks on the pinned set or inputs
      const variant = k % 5;
      if (variant === 0) {
        const obj = { ...baselineSetObject(), keys: { not: "an array" } };
        return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 1) {
        const obj = setVariant((ks) => { ks[0] = { ...ks[0], keyId: 123 }; return ks; });
        return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 2) {
        const obj = setVariant((ks) => { ks[0] = { ...ks[0], publicKeyHex: ATTACKER.publicKeyHex.toUpperCase() }; return ks; });
        return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 3) {
        return { record: BASELINE_RECORD, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: { nowSeconds: String(BASELINE_NOW) } };
      }
      const obj = setVariant((ks) => { ks[0] = { ...ks[0], notBefore: "1600000000" }; return ks; });
      return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
    }
    case 8: { // direct CG-RRP/1 path attacks (frozen API must stay fail-closed)
      const variant = k % 4;
      if (variant === 0) {
        return { direct: true, record: { payload: BASELINE_RECORD.payload, signature: flipHexAt(BASELINE_RECORD.signature, k) }, anchor: BASELINE_ANCHOR, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 1) {
        return { direct: true, record: BASELINE_RECORD, anchor: BASELINE_ANCHOR, ctx: { network: "testnet", chainId: "1116" }, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 2) {
        return { direct: true, record: BASELINE_RECORD, anchor: BASELINE_ANCHOR, ctx: EXPECTED_CONTEXT, options: { nowSeconds: 1900000000 + (k + 1) * 86400 } };
      }
      return { direct: true, record: BASELINE_RECORD, anchor: { keyId: ISSUER.keyId, publicKeyHex: ATTACKER.publicKeyHex }, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
    }
    case 9: { // direct-path issuer/anchor mismatches (frozen API adversarial corner)
      const variant = k % 4;
      if (variant === 0) {
        return { direct: true, record: BASELINE_RECORD, anchor: { keyId: ISSUER.keyId, publicKeyHex: ATTACKER.publicKeyHex }, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 1) {
        return { direct: true, record: { payload: payloadFor(ISSUER, { issuerKeyId: "unknown-issuer" }), signature: BASELINE_RECORD.signature }, anchor: BASELINE_ANCHOR, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      if (variant === 2) {
        return { direct: true, record: { ...BASELINE_RECORD, smuggled: "anchor-material" }, anchor: BASELINE_ANCHOR, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
      }
      return { direct: true, record: [BASELINE_RECORD, BASELINE_RECORD], anchor: BASELINE_ANCHOR, ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
    }
    default: // unreachable — categories are 0..9
      throw new Error(`unknown fuzz category ${cat}`);
  }
}

/** Benign canonicalization variants MUST keep the baseline verdict. */
function benignCase(k) {
  const variant = k % 4;
  if (variant === 0) {
    // Payload key insertion order reversed — canonical bytes identical.
    const payload = Object.fromEntries(Object.entries(payloadFor(ISSUER)).reverse());
    return { record: { payload, signature: BASELINE_RECORD.signature }, set: BASELINE_SET_TEXT, ctx: EXPECTED_CONTEXT, options: pin() };
  }
  if (variant === 1) {
    // Pretty-printed set text — canonical bytes (and the digest) identical.
    return { record: BASELINE_RECORD, set: JSON.stringify(baselineSetObject(), null, 2), ctx: EXPECTED_CONTEXT, options: pin() };
  }
  if (variant === 2) {
    // Non-decisional annotations changed — verdict unchanged (no digest pin:
    // the pin binds the whole canonical document, annotation edits change it).
    const obj = setVariant(null, { annotations: { owner: "coreguard", note: "fuzz baseline", extra: "noise" } });
    return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
  }
  // Informational generatedAt changed — verdict unchanged (no digest pin).
  const obj = setVariant(null, { generatedAt: 1690000001 });
  return { record: BASELINE_RECORD, set: canonicalJson(obj), ctx: EXPECTED_CONTEXT, options: { nowSeconds: BASELINE_NOW } };
}

function pin() {
  return { nowSeconds: BASELINE_NOW, anchorSetDigest: BASELINE_SET_DIGEST };
}

/* ------------------------------------------------------------- the runner */

export function runProvenanceFuzz(iterations = 1000) {
  const started = Date.now(); // wall clock is used for the REPORT ONLY, never for decisions
  const t0 = started;

  // Gate: the honest baseline MUST verify through both paths.
  const baseSet = runCase(BASELINE_RECORD, BASELINE_SET_TEXT, EXPECTED_CONTEXT, pin());
  const baseDirect = verifyResolvedRecordProvenance(BASELINE_RECORD, BASELINE_ANCHOR, EXPECTED_CONTEXT, { nowSeconds: BASELINE_NOW });
  if (baseSet.verdictCode !== "PROVENANCE_VERIFIED" || baseDirect.verdictCode !== "PROVENANCE_VERIFIED") {
    return { ok: false, fatal: "baseline did not verify", baseSet, baseDirect, iterations, t0 };
  }

  let refused = 0;
  let escaped = 0;
  let benignChecked = 0;
  let benignFailures = 0;
  let determinismChecks = 0;
  const refusedByFamily = {};
  const violations = [];
  const escapes = [];

  const shapeOk = (r) => r && VERDICTS.has(r.verdict) && VERDICT_CODES.has(r.verdictCode) && typeof r.reason === "string" && r.reason.length > 0;

  for (let i = 0; i < iterations; i++) {
    const cat = i % 10;
    const k = Math.floor(i / 10);
    const isDirect = cat === 8 || cat === 9;
    const c = attackCase(cat, k);
    const out = isDirect
      ? verifyResolvedRecordProvenance(c.record, c.anchor, c.ctx, c.options)
      : runCase(c.record, c.set, c.ctx, c.options);

    if (!shapeOk(out)) {
      violations.push({ i, cat, kind: "SHAPE", out });
    } else if (out.verdictCode === "PROVENANCE_VERIFIED") {
      escaped++;
      escapes.push({ i, cat });
    } else {
      refused++;
      refusedByFamily[cat] = (refusedByFamily[cat] || 0) + 1;
    }

    // Determinism sample: re-run every 97th attack byte-identically.
    if (i % 97 === 0) {
      const again = isDirect
        ? verifyResolvedRecordProvenance(c.record, c.anchor, c.ctx, c.options)
        : runCase(c.record, c.set, c.ctx, c.options);
      determinismChecks++;
      if (JSON.stringify(again) !== JSON.stringify(out)) {
        violations.push({ i, cat, kind: "NON_DETERMINISTIC" });
      }
    }

    // Benign invariance slice: canonicalization must never flip the verdict.
    if (i % 2 === 0) {
      const b = benignCase(Math.floor(i / 2));
      const bout = runCase(b.record, b.set, b.ctx, b.options);
      benignChecked++;
      if (!shapeOk(bout) || bout.verdictCode !== "PROVENANCE_VERIFIED") {
        benignFailures++;
        violations.push({ i, cat: "benign", kind: "BENIGN_DRIFT", out: bout });
      }
    }
  }

  const elapsed = Date.now() - t0;
  const ok = escaped === 0 && benignFailures === 0 && violations.length === 0;
  return {
    ok,
    iterations,
    refused,
    refusedByFamily,
    escaped,
    benignChecked,
    benignFailures,
    determinismChecks,
    violations,
    escapes,
    elapsedMs: elapsed,
    baseline: { set: baseSet.verdictCode, direct: baseDirect.verdictCode },
  };
}

/* ------------------------------------------------------------------ the CLI */

// The CLI entrypoint runs only when this module IS the entry script — never
// when the suite imports the runner (an accidental process.exit would kill it).
const isMain = (() => {
  try {
    if (!process.argv[1]) return false;
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

function main() {
  const arg = Number(process.argv[2]);
  const iterations = Number.isInteger(arg) && arg > 0 ? arg : 1000;
  const r = runProvenanceFuzz(iterations);
  console.log("CoreGuard Provenance Fuzz Laboratory (CG-RRP/1 + CG-TAS/1)");
  console.log("-".repeat(60));
  if (r.fatal) {
    console.error(`  FATAL: ${r.fatal} — the lab itself is malformed, nothing is certified`);
    process.exit(2);
  }
  console.log(`  baseline              : VERIFIED (gate) — set path ${r.baseline.set}, direct path ${r.baseline.direct}`);
  console.log(`  attack iterations     : ${r.iterations}`);
  console.log(`  refused (fail-closed) : ${r.refused}`);
  console.log(`  escaped (VERIFIED)    : ${r.escaped}  (target 0 — any is a CI FAIL)`);
  console.log(`  benign invariance     : ${r.benignChecked} checked, ${r.benignFailures} failures (target 0)`);
  console.log(`  determinism samples   : ${r.determinismChecks} re-runs, ${r.violations.filter((v) => v.kind === "NON_DETERMINISTIC").length} mismatches`);
  console.log(`  contract violations   : ${r.violations.length}  (target 0)`);
  console.log(`  elapsed               : ${r.elapsedMs}ms`);
  console.log("-".repeat(60));
  if (r.escapes.length > 0) {
    console.log("Escaped mutants (first 5):");
    for (const e of r.escapes.slice(0, 5)) console.log(`  #[${e.i}] family ${e.cat} — VERIFIED (must be refused)`);
  }
  if (r.violations.length > 0) {
    console.log("Violations (first 5):");
    for (const v of r.violations.slice(0, 5)) console.log(`  ${JSON.stringify(v).slice(0, 200)}`);
  }
  console.log(r.ok
    ? "Provenance fuzz gate: PASS — no escapes, no benign drift, no violations."
    : `Provenance fuzz gate: FAIL — ${r.escaped} escaped / ${r.benignFailures} benign drift / ${r.violations.length} violations.`);
  process.exit(r.ok ? 0 : 1);
}

if (isMain) {
  main();
}
