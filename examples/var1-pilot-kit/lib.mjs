/**
 * VAR/1 pilot kit — shared primitives.
 *
 * Everything here is deliberately small and boring: canonical bytes, a digest,
 * a key from a seed, a field-level comparison, and an HTTP fetch that refuses
 * to invent an answer. The interesting policy lives in the modules this kit
 * imports, not in glue code.
 *
 * BOUNDARY: this kit runs a LOCAL reference merchant. It is not a customer
 * pilot, not a certification, and not evidence that a third party has adopted
 * anything. It is a harness a stranger can run to watch the four mechanisms
 * behave, including the ways they refuse.
 */

import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { canonicalize } from "../../packages/canonical/index.js";

export const PILOT_VERSION = "VAR1-PILOT/1";
export const MAX_BYTES = 1 << 20;

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** sha256 over the canonical JSON of a value, in the repo's prefixed form. */
export function digestOf(value) {
  return "sha256:" + sha256Hex(Buffer.from(canonicalize(value), "utf8"));
}

/** The exact bytes a content-addressed id commits to. */
export function canonicalBytes(value) {
  return canonicalize(value);
}

/**
 * Deterministic Ed25519 key from a 32-byte seed, for reproducible runs.
 * PKCS#8 for Ed25519 is a fixed 16-byte prefix followed by the seed; nothing
 * here is a secret worth keeping, and the default path generates a fresh key.
 */
export function seededKey(seedHex) {
  if (typeof seedHex !== "string" || !/^[0-9a-f]{64}$/i.test(seedHex)) {
    throw new TypeError("seed must be 64 hex characters (32 bytes)");
  }
  const der = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seedHex, "hex"),
  ]);
  const signingKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  return Object.freeze({
    privateKeyPem: signingKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: createPublicKey(signingKey).export({ type: "spki", format: "pem" }).toString(),
  });
}

const APPROVED_FIELDS = Object.freeze(["merchant_id", "payee", "total_minor", "currency"]);
const LINE_FIELDS = Object.freeze(["name", "qty", "unit_minor"]);

/** The fields an execution must still match after the approval was signed. */
export function approvedFields(intent) {
  const out = {};
  for (const f of APPROVED_FIELDS) out[f] = intent?.[f] ?? null;
  out.items = (intent?.items ?? []).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, unit_minor: i.unit_minor }));
  return out;
}

/**
 * Field-level drift, named rather than summarised. Line items are matched by
 * SKU, not by array position, so a reordered cart is not a false positive and
 * an injected line is still visible.
 */
export function fieldDrift(approved, executed) {
  const diffs = [];
  for (const f of APPROVED_FIELDS) {
    if (canonicalize(approved?.[f] ?? null) !== canonicalize(executed?.[f] ?? null)) {
      diffs.push({ field: f, approved: approved?.[f] ?? null, executed: executed?.[f] ?? null });
    }
  }
  const a = new Map((approved?.items ?? []).map((i) => [i.sku, i]));
  const e = new Map((executed?.items ?? []).map((i) => [i.sku, i]));
  for (const sku of new Set([...a.keys(), ...e.keys()])) {
    const ai = a.get(sku);
    const ei = e.get(sku);
    if (!ai) {
      diffs.push({ field: `items[${sku}]`, approved: null, executed: ei });
      continue;
    }
    if (!ei) {
      diffs.push({ field: `items[${sku}]`, approved: ai, executed: null });
      continue;
    }
    for (const f of LINE_FIELDS) {
      if (canonicalize(ai[f] ?? null) !== canonicalize(ei[f] ?? null)) {
        diffs.push({ field: `items[${sku}].${f}`, approved: ai[f] ?? null, executed: ei[f] ?? null });
      }
    }
  }
  return diffs;
}

/** Sum of the lines, in integer minor units. */
export function lineTotal(items) {
  let sum = 0;
  for (const it of items ?? []) sum += (it.qty ?? 0) * (it.unit_minor ?? 0);
  return sum;
}

/**
 * A fetch that returns bytes or nothing. A 404 is "no answer", a 5xx is "no
 * answer", and a redirect is refused rather than followed into a different
 * origin. The resolver decides what the absence means.
 */
export async function fetchBytes(url, { signal } = {}) {
  const res = await fetch(url, { signal, redirect: "error" });
  if (!res.ok) return { url, status: res.status, bytes: null };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`answer exceeds ${MAX_BYTES} bytes`);
  return { url, status: res.status, bytes: buf.toString("utf8") };
}
