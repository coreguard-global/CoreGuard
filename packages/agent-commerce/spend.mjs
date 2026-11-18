/**
 * CoreGuard Spend Ledger (CG-SPEND/1) — single-use, across processes and across
 * parties that never share a database.
 *
 * "Single use" is not a boolean a verifier can read out of a receipt. A receipt
 * that says `used: false` is a receipt from before it was used. The only way to
 * know an approval has already been spent is to keep a record of the spending,
 * and the only way that record survives a restart, a second worker, or a second
 * system is for it to be append-only, signed, and readable by both sides.
 *
 * So the unit here is a spend ATTESTATION: "this approval, under this nonce, was
 * spent for this order at this time, by this key". It is appended to a log and
 * signed with the issuer's Ed25519 key, which gives three properties that a
 * process-local Set cannot:
 *
 *   - a second worker in the same machine sees it (file lock + append),
 *   - a second machine sees it once the log is exchanged or mirrored, and
 *   - two logs that DISAGREE are detectable: the same approval spent under two
 *     different nonces is a `conflict`, not a duplicate to be settled quietly.
 *
 * BOUNDARY (standing, load-bearing), stated here because it is the difference
 * between a ledger and a fake:
 *   - The ledger is only as global as the logs the verifier can see. There is no
 *     world-wide register and this module does not pretend to be one: it
 *     guarantees single-use WITHIN every log supplied to `checkSpent`, and it
 *     makes disagreement between logs visible. A deployment that needs stronger
 *     freshness publishes the log head (the anchor module already produces a
 *     Merkle root) and refuses approvals whose head is older than its policy.
 *   - A verified spend entry proves an approval was recorded as spent. It proves
 *     nothing about delivery, amount or who the buyer was.
 *   - The file lock is an OS guarantee on one host; the signature is what
 *     carries across hosts. Neither replaces the other.
 */

import { createHash } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { keyIdFor } from "./anchor.mjs";

export const SPEND_VERSION = "CG-SPEND/1";
export const SPEND_SCHEMA = "coreguard.spend/1";
export const SPEND_STATES = Object.freeze(["unspent", "spent", "conflict", "busy", "unreadable"]);

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

const sha256 = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const isDigest = (v) => typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);

/**
 * The spend key: one approval, one nonce, one identity. Committed inside the
 * approval, so replaying the approval under a different nonce is not a second
 * legitimate spend — it is a different key, and its presence in a log alongside
 * the first is exactly the conflict this ledger reports.
 */
export function spendKeyFor({ receiptDigest, approvalNonce } = {}) {
  if (!isDigest(receiptDigest)) throw new TypeError("receiptDigest must be sha256:<64 hex>");
  if (typeof approvalNonce !== "string" || approvalNonce.length === 0) throw new TypeError("approvalNonce must be a non-empty string");
  return "sha256:" + sha256(canonicalJson({ receiptDigest, approvalNonce }));
}

export function createSpendLog({ path = null } = {}) {
  return Object.freeze({ spendVersion: SPEND_VERSION, schema: SPEND_SCHEMA, path, entries: Object.freeze([]) });
}

function spendBody({ receiptDigest, approvalNonce, at, orderRef }) {
  return {
    spendVersion: SPEND_VERSION,
    schema: SPEND_SCHEMA,
    type: "spend",
    receiptDigest,
    approvalNonce,
    spendKey: spendKeyFor({ receiptDigest, approvalNonce }),
    at,
    orderRef: typeof orderRef === "string" ? orderRef : null,
  };
}

/** Pure: sign one spend attestation and return it. Nothing is written here. */
export function makeSpendEntry({ receiptDigest, approvalNonce, at, orderRef = null, privateKeyPem } = {}) {
  if (!isDigest(receiptDigest)) throw new TypeError("receiptDigest must be sha256:<64 hex>");
  if (typeof approvalNonce !== "string" || approvalNonce.length === 0) throw new TypeError("approvalNonce must be a non-empty string");
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) throw new TypeError("at must be an ISO-8601 timestamp");
  if (typeof privateKeyPem !== "string" || !privateKeyPem.includes("PRIVATE KEY")) throw new TypeError("privateKeyPem must be a PKCS#8 PEM string");
  const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem)).export({ type: "spki", format: "pem" }).toString();
  const body = { ...spendBody({ receiptDigest, approvalNonce, at, orderRef }), issuer: { keyId: keyIdFor(publicKeyPem), publicKeyPem } };
  const signature = sign(null, Buffer.from(canonicalJson(body), "utf8"), privateKeyPem).toString("base64");
  return Object.freeze({ ...body, signature });
}

/** One entry's own integrity: schema, keyId binding, Ed25519 signature. */
export function verifySpendEntry(entry) {
  const checks = [];
  if (!entry || typeof entry !== "object") return Object.freeze({ ok: false, checks: Object.freeze([{ name: "entry is an object", ok: false }]) });
  checks.push({ name: "spend version is CG-SPEND/1", ok: entry.spendVersion === SPEND_VERSION });
  checks.push({ name: "spend key recomputes", ok: entry.spendKey === (() => { try { return spendKeyFor(entry); } catch { return null; } })() });
  const keyOk = entry?.issuer && typeof entry.issuer.publicKeyPem === "string";
  checks.push({ name: "issuer carries a public key", ok: !!keyOk });
  if (keyOk) checks.push({ name: "keyId matches the public key", ok: entry.issuer.keyId === keyIdFor(entry.issuer.publicKeyPem) });
  const { signature, ...body } = entry;
  let sigOk = false;
  if (keyOk && typeof signature === "string") {
    try {
      sigOk = verify(null, Buffer.from(canonicalJson(body), "utf8"), entry.issuer.publicKeyPem, Buffer.from(signature, "base64"));
    } catch {
      sigOk = false;
    }
  }
  checks.push({ name: "Ed25519 signature verifies over canonical JSON", ok: sigOk });
  return Object.freeze({ ok: checks.every((c) => c.ok), checks: Object.freeze(checks) });
}

const entriesOf = (item) => {
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item)) return item.flatMap(entriesOf);
  if (Array.isArray(item.entries)) return item.entries.flatMap(entriesOf);
  return typeof item.spendKey === "string" ? [item] : [];
};

/**
 * checkSpent(logs, { receiptDigest, approvalNonce })
 *
 *   logs  one log, an array of logs, or an array of entry arrays — the caller
 *         decides whose copies count as evidence.
 *
 * Returns `spent` when the same approval+nonce is recorded, `conflict` when the
 * same approval is recorded under a DIFFERENT nonce (two systems both believe
 * they were the first), `unspent` when no log mentions it, and `unreadable`
 * when a supplied entry fails its own signature.
 */
export function checkSpent(logs, { receiptDigest, approvalNonce } = {}) {
  if (!isDigest(receiptDigest)) throw new TypeError("receiptDigest must be sha256:<64 hex>");
  if (typeof approvalNonce !== "string" || approvalNonce.length === 0) throw new TypeError("approvalNonce must be a non-empty string");
  const all = [];
  const supplied = Array.isArray(logs) ? logs : [logs];
  for (const l of supplied) for (const e of entriesOf(l)) all.push(e);

  const invalid = all.filter((e) => !verifySpendEntry(e).ok);
  if (invalid.length > 0) {
    return Object.freeze({
      state: "unreadable",
      reason: `${invalid.length} entry/entries in the supplied log(s) fail their own signature`,
      matches: invalid.length,
      sources: supplied.length,
    });
  }
  const sameApproval = all.filter((e) => e?.receiptDigest === receiptDigest);
  const exact = sameApproval.filter((e) => e?.approvalNonce === approvalNonce);
  const otherNonce = sameApproval.filter((e) => e?.approvalNonce !== approvalNonce);

  if (exact.length > 0 && otherNonce.length > 0) {
    return Object.freeze({ state: "conflict", reason: "the same approval appears under two different nonces", matches: sameApproval.length, sources: supplied.length, entries: Object.freeze(sameApproval) });
  }
  if (exact.length > 0) {
    return Object.freeze({ state: "spent", reason: null, matches: exact.length, sources: supplied.length, entries: Object.freeze(exact) });
  }
  if (otherNonce.length > 0) {
    return Object.freeze({ state: "conflict", reason: "this approval was already spent under a different nonce", matches: otherNonce.length, sources: supplied.length, entries: Object.freeze(otherNonce) });
  }
  return Object.freeze({ state: "unspent", reason: null, matches: 0, sources: supplied.length });
}

/** Read a JSON spend log from disk. A missing file is an empty log, not an error. */
export function readSpendLog(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
    return Object.freeze({ spendVersion: SPEND_VERSION, schema: SPEND_SCHEMA, path, entries: Object.freeze(entries) });
  } catch (err) {
    if (err && err.code === "ENOENT") return createSpendLog({ path });
    throw err;
  }
}

function writeSpendLog(path, entries) {
  const body = JSON.stringify({ spendVersion: SPEND_VERSION, schema: SPEND_SCHEMA, entries }, null, 2);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body + "\n", { mode: 0o600 });
  const fd = openSync(tmp, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}

function acquire(path, timeoutMs) {
  const lock = `${path}.lock`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(lock, "wx", 0o600);
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return lock;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      if (Date.now() >= deadline) return null;
    }
  }
}

/**
 * claimSpend({ path, receiptDigest, approvalNonce, at, orderRef, privateKeyPem })
 *
 * The cross-process primitive: take the lock, read the whole log, decide, and
 * append under the same lock. Two workers racing for the same approval produce
 * exactly one `ok: true`; the loser sees `spent` and the winning entry.
 *
 * Returns `busy` when the lock could not be acquired in `timeoutMs` — a refusal
 * to guess, not a decision that the spend is free.
 */
export function claimSpend({ path, receiptDigest, approvalNonce, at, orderRef = null, privateKeyPem, timeoutMs = 2000 } = {}) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("claimSpend requires a log path");
  const entry = makeSpendEntry({ receiptDigest, approvalNonce, at, orderRef, privateKeyPem });
  const lock = acquire(path, Math.max(1, timeoutMs));
  if (!lock) return Object.freeze({ ok: false, state: "busy", reason: `lock not acquired within ${timeoutMs}ms`, entry: null, entries: Object.freeze([]) });
  try {
    const log = readSpendLog(path);
    const verdict = checkSpent(log, { receiptDigest, approvalNonce });
    if (verdict.state !== "unspent") {
      return Object.freeze({ ok: false, state: verdict.state, reason: verdict.reason, entry: null, entries: log.entries });
    }
    const entries = [...log.entries, entry];
    writeSpendLog(path, entries);
    return Object.freeze({ ok: true, state: "spent", reason: null, entry, entries: Object.freeze(entries) });
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      /* a lost lock file is not a failed spend */
    }
  }
}

/**
 * mergeLogs(logs) — the cross-system fold. Returns every distinct spend key plus
 * the approvals that appear under more than one nonce. Two honest systems that
 * exchanged logs end up with the same conflict list, which is the point.
 */
export function mergeLogs(logs) {
  const all = [];
  for (const l of Array.isArray(logs) ? logs : [logs]) for (const e of entriesOf(l)) all.push(e);
  const bySpend = new Map();
  const byApproval = new Map();
  for (const e of all) {
    if (!verifySpendEntry(e).ok) continue;
    bySpend.set(e.spendKey, e);
    const list = byApproval.get(e.receiptDigest) ?? [];
    list.push(e);
    byApproval.set(e.receiptDigest, list);
  }
  const conflicts = [];
  for (const [receiptDigest, list] of byApproval) {
    const nonces = new Set(list.map((e) => e.approvalNonce));
    if (nonces.size > 1) conflicts.push(Object.freeze({ receiptDigest, nonces: Object.freeze([...nonces]), entries: Object.freeze(list) }));
  }
  return Object.freeze({
    spendVersion: SPEND_VERSION,
    entries: Object.freeze([...bySpend.values()]),
    uniqueSpends: bySpend.size,
    conflicts: Object.freeze(conflicts),
  });
}

export function selfCheck() {
  const checks = [];
  const { generateIssuerKey } = anchorForSelfCheck();
  const key = generateIssuerKey();
  const receiptDigest = "sha256:" + "c".repeat(64);
  const e1 = makeSpendEntry({ receiptDigest, approvalNonce: "n1", at: "2026-01-01T00:00:00Z", privateKeyPem: key.privateKeyPem });
  checks.push({ name: "a spend entry verifies", pass: verifySpendEntry(e1).ok === true });
  checks.push({ name: "same approval+nonce reads spent", pass: checkSpent([e1], { receiptDigest, approvalNonce: "n1" }).state === "spent" });
  checks.push({ name: "same approval, other nonce reads conflict", pass: checkSpent([e1], { receiptDigest, approvalNonce: "n2" }).state === "conflict" });
  checks.push({ name: "unknown approval reads unspent", pass: checkSpent([e1], { receiptDigest: "sha256:" + "d".repeat(64), approvalNonce: "n1" }).state === "unspent" });
  const tampered = { ...e1, orderRef: "changed" };
  checks.push({ name: "tampered entry makes the log unreadable", pass: checkSpent([tampered], { receiptDigest, approvalNonce: "n1" }).state === "unreadable" });
  const e2 = makeSpendEntry({ receiptDigest, approvalNonce: "n2", at: "2026-01-02T00:00:00Z", privateKeyPem: key.privateKeyPem });
  checks.push({ name: "merging two logs surfaces the conflict", pass: mergeLogs([[e1], [e2]]).conflicts.length === 1 });
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}

import { generateIssuerKey as generateIssuerKeyFromAnchor } from "./anchor.mjs";
function anchorForSelfCheck() {
  return { generateIssuerKey: generateIssuerKeyFromAnchor };
}
