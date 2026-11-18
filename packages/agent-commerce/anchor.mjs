/**
 * CoreGuard Anchor Service (CG-ANCHOR/1) — our own append-only witness.
 *
 * A verification layer that cannot say WHERE it saw a record is a layer that
 * asks to be trusted. This service is the smallest thing we can run ourselves
 * and that a stranger can check without asking us:
 *
 *   attestation  a signed statement: "at T, I saw this digest" — Ed25519 over
 *                canonical JSON, carrying the signing public key, so it verifies
 *                offline and outlives the file it arrived in
 *   log          append-only, hash-chained: entry n names the digest of entry
 *                n-1, so a silent rewrite anywhere is visible at the tail
 *   root         one Merkle root over the log; that 32-byte value is the only
 *                thing that ever needs to reach a chain, a notary or a mirror
 *
 * That last line is the design decision worth stating: the log does not need a
 * chain to be useful, and a chain does not make the log honest. Anchoring the
 * root elsewhere is an upgrade, never a precondition.
 *
 * BOUNDARY (standing, load-bearing):
 *   - No clock, no network, no keys inside this repository. The caller passes
 *     `now` and a key; the CLI generates a key locally and prints the path.
 *   - Nothing here broadcasts. `prepareChainAnchor` returns the exact 32-byte
 *     memo a chain anchor would carry and refuses `mainnet` outright — the
 *     decision to write to a live network is not a library call.
 *   - An anchor says a digest existed at a time, in a place. It never says the
 *     record was correct, authorized or safe, and it cannot resurrect bytes.
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

export const ANCHOR_VERSION = "CG-ANCHOR/1";
export const ANCHOR_SCHEMA = "coreguard.anchor/1";

const HEX64 = /^[0-9a-f]{64}$/;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");

/** Canonical JSON: sorted keys, no whitespace, recursive. Byte-deterministic. */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

/** Normalize a subject digest to `sha256:<64 lowercase hex>`. */
export function normalizeSubject({ kind, digest } = {}) {
  if (typeof kind !== "string" || kind.length === 0) throw new TypeError("subject.kind must be a non-empty string");
  const raw = typeof digest === "string" ? digest.trim() : "";
  const hex = raw.startsWith("sha256:") ? raw.slice(7) : raw;
  if (!HEX64.test(hex)) throw new TypeError("subject.digest must be 32 bytes of lowercase hex (sha256:<hex>)");
  return Object.freeze({ kind, digest: `sha256:${hex}` });
}

/** A fresh Ed25519 key pair. The private key is the caller's to keep. */
export function generateIssuerKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
}

/** keyId = sha256 over the DER of the public key. Stable, and not a fingerprint. */
export function keyIdFor(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256hex(der);
}

/** Build and sign one attestation. `now` is an ISO-8601 string supplied by the caller. */
export function signAttestation({ subject, issuedAt, privateKeyPem, sequence = 0, previous = null } = {}) {
  const normalized = normalizeSubject(subject);
  if (typeof issuedAt !== "string" || Number.isNaN(Date.parse(issuedAt))) {
    throw new TypeError("issuedAt must be an ISO-8601 timestamp");
  }
  if (typeof privateKeyPem !== "string" || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new TypeError("privateKeyPem must be a PKCS#8 PEM string");
  }
  const publicKeyPem = createPublicKeyFromPrivate(privateKeyPem);
  const body = {
    anchorVersion: ANCHOR_VERSION,
    schema: ANCHOR_SCHEMA,
    subject: normalized,
    sequence,
    previous: previous ?? null,
    issuedAt,
    issuer: { keyId: keyIdFor(publicKeyPem), publicKeyPem },
  };
  const signature = sign(null, Buffer.from(canonicalJson(body), "utf8"), privateKeyPem).toString("base64");
  return Object.freeze({ ...body, signature });
}

function createPublicKeyFromPrivate(privateKeyPem) {
  const priv = createPrivateKey(privateKeyPem);
  return createPublicKey(priv).export({ type: "spki", format: "pem" }).toString();
}

/** Leaf hash of one attestation: sha256 over its canonical JSON, signature included. */
export function leafHash(attestation) {
  return sha256hex(Buffer.from(canonicalJson(attestation), "utf8"));
}

/** Merkle root over leaf hashes, duplicated-last, empty tree = 64 zeros. */
export function merkleRoot(leaves) {
  if (!Array.isArray(leaves)) throw new TypeError("merkleRoot requires an array of leaf hashes");
  if (leaves.length === 0) return "0".repeat(64);
  let level = leaves.map((l) => {
    const hex = String(l).startsWith("sha256:") ? String(l).slice(7) : String(l);
    if (!HEX64.test(hex)) throw new TypeError("every leaf must be 32 bytes of lowercase hex");
    return hex;
  });
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? a;
      next.push(sha256hex(Buffer.from(a + b, "hex")));
    }
    level = next;
  }
  return level[0];
}

/** A new, empty log. Logs are immutable by convention: append returns a copy. */
export function createLog() {
  return Object.freeze({ anchorVersion: ANCHOR_VERSION, schema: ANCHOR_SCHEMA, entries: Object.freeze([]) });
}

/**
 * Append one anchor. Returns a NEW log; the input is never mutated.
 *
 * The chain is over attestations, so `previous` is the leaf hash of the last
 * entry — not its sequence number. Renumbering entries therefore breaks the
 * chain, which is the point.
 */
export function appendAnchor(log, { subject, issuedAt, privateKeyPem } = {}) {
  if (!isObject(log) || !Array.isArray(log.entries)) throw new TypeError("appendAnchor requires a log");
  const previous = log.entries.length === 0 ? null : leafHash(log.entries[log.entries.length - 1]);
  const attestation = signAttestation({
    subject,
    issuedAt,
    privateKeyPem,
    sequence: log.entries.length,
    previous,
  });
  const entries = Object.freeze([...log.entries, attestation]);
  return Object.freeze({ ...log, entries, root: merkleRoot(entries.map(leafHash)) });
}

/** Verify one attestation, offline and self-contained. */
export function verifyAttestation(attestation) {
  const checks = [];
  if (!isObject(attestation)) return Object.freeze({ ok: false, checks: [{ name: "attestation is an object", ok: false }] });
  const { signature, ...body } = attestation;
  checks.push({ name: "anchor version is CG-ANCHOR/1", ok: body.anchorVersion === ANCHOR_VERSION });
  try {
    normalizeSubject(body.subject);
    checks.push({ name: "subject digest is sha256:<64 hex>", ok: true });
  } catch {
    checks.push({ name: "subject digest is sha256:<64 hex>", ok: false });
  }
  const keyOk = isObject(body.issuer) && typeof body.issuer.publicKeyPem === "string";
  checks.push({ name: "issuer carries a public key", ok: keyOk });
  if (keyOk) checks.push({ name: "keyId matches the public key", ok: body.issuer.keyId === keyIdFor(body.issuer.publicKeyPem) });
  let sigOk = false;
  if (keyOk && typeof signature === "string") {
    try {
      sigOk = verify(null, Buffer.from(canonicalJson(body), "utf8"), body.issuer.publicKeyPem, Buffer.from(signature, "base64"));
    } catch {
      sigOk = false;
    }
  }
  checks.push({ name: "Ed25519 signature verifies over canonical JSON", ok: sigOk });
  return Object.freeze({ ok: checks.every((c) => c.ok), checks });
}

/** Verify a whole log: every signature, the previous-link chain, and the root. */
export function verifyLog(log) {
  if (!isObject(log) || !Array.isArray(log.entries)) throw new TypeError("verifyLog requires a log");
  const checks = [];
  let prevLeaf = null;
  for (let i = 0; i < log.entries.length; i++) {
    const entry = log.entries[i];
    const single = verifyAttestation(entry);
    checks.push({ name: `entry ${i} verifies`, ok: single.ok });
    checks.push({ name: `entry ${i} sequence is ${i}`, ok: entry.sequence === i });
    checks.push({ name: `entry ${i} links to the previous entry`, ok: entry.previous === prevLeaf });
    prevLeaf = leafHash(entry);
  }
  const root = merkleRoot(log.entries.map(leafHash));
  checks.push({ name: "declared root matches the computed root", ok: log.root === undefined || log.root === root });
  return Object.freeze({ ok: checks.every((c) => c.ok), checks, root });
}

/**
 * Resolve a digest against a log, in CG-OUT/1's anchor vocabulary.
 *
 *   { present, evaluated, outcome }  outcome: verified | absent | unresolvable
 *
 * A digest with matching entries is `verified`. A digest addressed by a broken
 * entry is `unresolvable` — we can see it was written, and we cannot stand
 * behind it. A digest with no entry at all is `absent`: no one claimed it.
 */
export function resolveAnchor(log, digest) {
  let subject;
  try {
    subject = normalizeSubject({ kind: "unknown", digest });
  } catch {
    return Object.freeze({ present: false, evaluated: false, outcome: "absent", reason: "digest is not sha256:<64 hex>" });
  }
  if (!isObject(log) || !Array.isArray(log.entries)) {
    return Object.freeze({ present: false, evaluated: false, outcome: "absent", reason: "no log was supplied" });
  }
  const matches = log.entries.filter((e) => e?.subject?.digest === subject.digest);
  if (matches.length === 0) {
    return Object.freeze({ present: false, evaluated: true, outcome: "absent", matches: 0 });
  }
  const allValid = matches.every((e) => verifyAttestation(e).ok);
  return Object.freeze({
    present: true,
    evaluated: true,
    outcome: allValid ? "verified" : "unresolvable",
    matches: matches.length,
    reason: allValid ? undefined : "an entry for this digest failed its own signature check",
  });
}

/**
 * The only thing that would need to reach a chain: the 32-byte root.
 *
 * `broadcast` is hard-coded false and `mainnet` is refused by name. Preparing a
 * memo is not authorization to write it, and this repository has no path from
 * here to a signed transaction.
 */
export function prepareChainAnchor(log, { network = "testnet" } = {}) {
  const verified = verifyLog(log);
  if (!verified.ok) return Object.freeze({ ok: false, reason: "the log does not verify", checks: verified.checks });
  if (network === "mainnet" || network === "public") {
    return Object.freeze({
      ok: false,
      reason: "mainnet is refused here by name: anchoring the root to a live network is a deliberate, separate decision",
    });
  }
  return Object.freeze({
    ok: true,
    adapter: "stellar",
    network,
    memoHashHex: verified.root,
    memoType: "hash",
    broadcast: false,
    root: verified.root,
    entries: log.entries.length,
  });
}

/** Self-check: the service's own invariants, for callers that cannot run tests. */
export function selfCheck() {
  const keys = generateIssuerKey();
  const digest = sha256hex(Buffer.from("self-check"));
  const t0 = "2026-01-01T00:00:00.000Z";
  const log1 = appendAnchor(createLog(), { subject: { kind: "receipt", digest }, issuedAt: t0, privateKeyPem: keys.privateKeyPem });
  const log2 = appendAnchor(log1, { subject: { kind: "receipt", digest }, issuedAt: t0, privateKeyPem: keys.privateKeyPem });
  const tampered = Object.freeze({
    ...log1,
    entries: Object.freeze([{ ...log1.entries[0], issuedAt: "2026-01-02T00:00:00.000Z" }]),
  });
  const checks = [
    { name: "a fresh log verifies", pass: verifyLog(log1).ok },
    { name: "a two-entry log verifies", pass: verifyLog(log2).ok },
    { name: "a re-signed-looking edit breaks the log", pass: verifyLog(tampered).ok === false },
    { name: "a known digest resolves to verified", pass: resolveAnchor(log2, `sha256:${digest}`).outcome === "verified" },
    { name: "an unknown digest is absent, not unresolvable", pass: resolveAnchor(log2, `sha256:${"a".repeat(64)}`).outcome === "absent" },
    { name: "mainnet preparation is refused", pass: prepareChainAnchor(log1, { network: "mainnet" }).ok === false },
    { name: "the chain memo is the Merkle root", pass: prepareChainAnchor(log1).memoHashHex === verifyLog(log1).root },
  ];
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
