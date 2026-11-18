/**
 * CG-OUT/1 profile reference — the two fields a protocol would carry.
 *
 * A wire protocol should not embed our vocabulary. If ACP, AER-1 or anything
 * else ever wants to point at an outcome computed here, what it needs is a
 * pointer, not a copy of our rules: which receipt, and under which profile
 * those words were produced. Everything else — the five outcomes, the layer
 * precedence, the tests — stays ours to version.
 *
 *   {
 *     "receipt_id": "…",
 *     "profile": "CG-OUT/1",
 *     "profile_version": 1
 *   }
 *
 * Three fields, not two, and the third is the important one: `profile` is a
 * name, `profile_version` is what a reader can actually check. A pointer that
 * names a profile without a version asks a consumer to guess which rules were
 * in force, which is the same defect as a receipt that cannot say what it is
 * certified under.
 *
 * BOUNDARY (standing):
 *   - A reference is not a verdict. Holding one tells you where an outcome
 *     lives and under which rules it was computed; it says nothing about what
 *     that outcome is. A consumer that renders a reference as a pass has
 *     invented a decision.
 *   - Unknown profile or unsupported version is refused by name, never coerced
 *     into the nearest version. Version confusion is the failure mode this
 *     file exists to prevent, so it fails closed on it.
 */

export const PROFILE_ID = "CG-OUT/1";
export const PROFILE_VERSION = 1;
export const PROFILE_REFERENCE_SCHEMA = "coreguard.profile-ref/1";

/** The exact field set. Unknown fields are a defect, not decoration. */
export const REFERENCE_FIELDS = Object.freeze(["receipt_id", "profile", "profile_version"]);

const MAX_ID = 512;

function requireReceiptId(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("receipt_id must be a non-empty string");
  }
  if (value.length > MAX_ID) throw new TypeError(`receipt_id must be at most ${MAX_ID} characters`);
  if (/\s/.test(value)) throw new TypeError("receipt_id must not contain whitespace");
  return value;
}

/**
 * Build a profile reference for a receipt. `outcome` is accepted only to keep
 * the reference tied to the run that produced it in logs; it is NOT part of the
 * wire shape and is deliberately not emitted.
 */
export function makeProfileReference({ receiptId } = {}) {
  return Object.freeze({
    receipt_id: requireReceiptId(receiptId),
    profile: PROFILE_ID,
    profile_version: PROFILE_VERSION,
  });
}

/**
 * Parse and validate a reference received from someone else. Returns
 * { ok, reference, error }. Never throws on hostile input: a foreign document
 * arriving here is untrusted data, and a parser that throws on it is a parser
 * that can be crashed by a stranger.
 */
export function parseProfileReference(input) {
  const fail = (error) => ({ ok: false, reference: null, error });
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail("reference must be an object");
  }
  let keys;
  try {
    keys = Object.keys(input).sort();
  } catch {
    return fail("reference is not a readable object");
  }
  const unknown = keys.filter((k) => !REFERENCE_FIELDS.includes(k));
  if (unknown.length) return fail(`unknown reference fields: ${unknown.join(", ")}`);
  const missing = REFERENCE_FIELDS.filter((f) => !keys.includes(f));
  if (missing.length) return fail(`missing reference fields: ${missing.join(", ")}`);

  let receiptId;
  let profile;
  let version;
  try {
    receiptId = input.receipt_id;
    profile = input.profile;
    version = input.profile_version;
  } catch {
    return fail("reference fields are not readable");
  }

  if (typeof receiptId !== "string" || receiptId.length === 0 || /\s/.test(receiptId)) {
    return fail("receipt_id must be a non-empty string without whitespace");
  }
  if (profile !== PROFILE_ID) {
    return fail(`unknown profile: ${JSON.stringify(profile)} (this build speaks ${PROFILE_ID})`);
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail("profile_version must be a positive integer");
  }
  if (version !== PROFILE_VERSION) {
    // Named, not rounded: a version we do not implement is not a version we
    // may interpret as if we did.
    return fail(`unsupported profile_version: ${version} (this build implements ${PROFILE_VERSION})`);
  }
  return { ok: true, reference: makeProfileReference({ receiptId }), error: null };
}

/** Self-check: shape, refusal and round-trip, for callers that cannot run tests. */
export function selfCheck() {
  const ref = makeProfileReference({ receiptId: "a".repeat(64) });
  const roundTrip = parseProfileReference(ref);
  const extra = parseProfileReference({ ...ref, outcome: "VERIFIED" });
  const wrongProfile = parseProfileReference({ ...ref, profile: "CG-OUT/2" });
  const future = parseProfileReference({ ...ref, profile_version: 2 });
  const noVersion = parseProfileReference({ receipt_id: "a".repeat(64), profile: PROFILE_ID });
  const checks = [
    { name: "a reference round-trips", pass: roundTrip.ok && roundTrip.reference.receipt_id === ref.receipt_id },
    { name: "the wire shape is exactly three fields", pass: Object.keys(ref).length === REFERENCE_FIELDS.length },
    { name: "an outcome smuggled into the shape is refused", pass: extra.ok === false },
    { name: "an unknown profile is refused", pass: wrongProfile.ok === false },
    { name: "a future version is refused, not rounded", pass: future.ok === false && /unsupported profile_version/.test(future.error) },
    { name: "a reference without a version is refused", pass: noVersion.ok === false },
  ];
  return Object.freeze({ profile: PROFILE_ID, checks, ok: checks.every((c) => c.pass) });
}
