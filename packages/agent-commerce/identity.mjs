/**
 * CoreGuard Identity Split (CG-ID/1) — a record's name, kept apart from its bytes.
 *
 * The defect this closes: when identity is a function of the content digest,
 * the digest is the only handle a consumer has on a record. Two consequences
 * follow, both bad.
 *
 *   1. An anchor cannot be carried. An anchor points at a PLACE ("this receipt
 *      is at ledger 4123, tx 0x…"), and a place is not a property of bytes. A
 *      content-addressed name has nowhere to put it, so every consumer has to
 *      re-derive which copy it holds from content alone — and content cannot say
 *      where it was anchored.
 *   2. Drift stops being visible. If the bytes change, the name changes, and a
 *      verifier comparing names sees two unrelated records instead of one
 *      record whose content moved.
 *
 * So identity is split into three fields that answer three different questions:
 *
 *   recordId       who this record IS  — sha256 over {issuer, scope, subject}
 *   contentDigest  what these bytes ARE — sha256 over the committed bytes,
 *                  supplied by the caller and never derived here
 *   anchorRef      where a copy of it IS — { kind, locator }, or null
 *
 * recordId is deliberately NOT derived from contentDigest. Same record, new
 * bytes: same recordId, different digest — drift, named. Same bytes, two
 * anchors: same recordId, same digest, two anchorRefs — a mirrored record.
 *
 * BOUNDARY (standing, load-bearing):
 *   - This module computes nothing about truth. A split identity says which
 *     record you hold and where a copy of it sits; it never says the record is
 *     correct, current or safe.
 *   - It performs no network I/O and reads no clock. An anchor is resolved by
 *     the caller, and the caller passes back what happened; this module only
 *     describes the reference.
 *   - An identity with no anchor is not broken: unfinished anchoring is the
 *     normal state of a young record, and `anchorFacts` reports it as absent
 *     rather than as a failure.
 */

import { createHash } from "node:crypto";

export const IDENTITY_VERSION = "CG-ID/1";
export const IDENTITY_SCHEMA = "coreguard.identity/1";

/** Anchor kinds this layer can name. Adding one is a schema change. */
export const ANCHOR_KINDS = Object.freeze(["chain", "transparency-log", "notary", "mirror"]);

const HEX64 = /^[0-9a-f]{64}$/;
const MAX_TEXT = 512;

/** Canonical JSON: sorted keys, no whitespace, recursive. Byte-deterministic. */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  if (value.length > MAX_TEXT) {
    throw new TypeError(`${field} must be at most ${MAX_TEXT} characters`);
  }
  return value;
}

/**
 * The record's name, and nothing else. Purpose-built so a reader can say out
 * loud what a recordId means: "the same issuer, in the same scope, about the
 * same subject" — never "the same bytes".
 */
export function recordIdFor({ issuer, scope, subject }) {
  const name = {
    issuer: requireText(issuer, "issuer"),
    scope: requireText(scope, "scope"),
    subject: requireText(subject, "subject"),
  };
  return createHash("sha256").update(Buffer.from(canonicalJson(name), "utf8")).digest("hex");
}

/**
 * splitIdentity({ issuer, scope, subject, contentDigest, anchor })
 *
 *   anchor: { kind, locator } | null
 *
 * Returns a frozen identity. Throws TypeError on a caller defect (a wrong type
 * is a bug in the caller, never something to coerce), and Error with a named
 * code on a value this layer refuses.
 */
export function splitIdentity({ issuer, scope, subject, contentDigest, anchor = null } = {}) {
  const recordId = recordIdFor({ issuer, scope, subject });
  const digest = requireText(contentDigest, "contentDigest");
  if (!HEX64.test(digest)) throw new TypeError("contentDigest must be 32 bytes of lowercase hex");
  const anchorRef = anchor === null || anchor === undefined ? null : normalizeAnchor(anchor);
  return Object.freeze({
    identityVersion: IDENTITY_VERSION,
    schema: IDENTITY_SCHEMA,
    recordId,
    contentDigest: digest,
    anchorRef,
  });
}

/** Normalize one anchor reference. Unknown kinds are refused, never passed through. */
export function normalizeAnchor(anchor) {
  if (typeof anchor !== "object" || anchor === null || Array.isArray(anchor)) {
    throw new TypeError("anchor must be an object { kind, locator }");
  }
  const { kind } = anchor;
  if (!ANCHOR_KINDS.includes(kind)) {
    throw new Error(`unknown anchor kind: ${JSON.stringify(kind)} (use one of ${ANCHOR_KINDS.join(", ")})`);
  }
  const extra = Object.keys(anchor).filter((k) => k !== "kind" && k !== "locator");
  if (extra.length) throw new Error(`unknown anchor fields: ${extra.join(", ")}`);
  return Object.freeze({ kind, locator: requireText(anchor.locator, "anchor.locator") });
}

/**
 * The two things a split identity makes checkable, as facts — not verdicts.
 *
 *   { identity, heldDigest }        -> { sameRecord, sameBytes }
 *   { identity, resolved }          -> { present, evaluated, outcome }
 *
 * `sameRecord` is true when the two identities name the same record (drift is
 * possible); `sameBytes` is true when they also hold the same content. A record
 * that drifted is sameRecord && !sameBytes, which a content-addressed identity
 * cannot express at all.
 */
export function compareIdentities(a, b) {
  if (!a || !b) throw new TypeError("compareIdentities requires two identities");
  for (const [label, value] of [
    ["a", a],
    ["b", b],
  ]) {
    if (typeof value.recordId !== "string" || !HEX64.test(value.recordId)) {
      throw new TypeError(`identities.${label}.recordId must be 32 bytes of lowercase hex`);
    }
    if (typeof value.contentDigest !== "string" || !HEX64.test(value.contentDigest)) {
      throw new TypeError(`identities.${label}.contentDigest must be 32 bytes of lowercase hex`);
    }
  }
  const sameRecord = a.recordId === b.recordId;
  const sameBytes = a.contentDigest === b.contentDigest;
  return Object.freeze({
    sameRecord,
    sameBytes,
    drifted: sameRecord && !sameBytes,
    verdictHint: sameRecord
      ? sameBytes
        ? "same record, same bytes"
        : "same record, different bytes — drift, not a different record"
      : "different records",
  });
}

/**
 * Anchor-layer facts for the outcome layer (CG-OUT/1), in its own vocabulary.
 *
 *   resolved  true  -> the anchor resolved and its target matched
 *             false -> the anchor was looked for and could not be resolved
 *             undefined/null -> the anchor was never resolved (deliberately
 *                               skipped, or nothing tried)
 *
 * No anchorRef at all is `absent`: an unanchored record has an absent anchor
 * layer, which is not a failed verification of anything.
 */
export function anchorFacts(identity, { resolved } = {}) {
  const ref = identity?.anchorRef ?? null;
  if (!ref) return Object.freeze({ present: false, evaluated: false, outcome: "absent" });
  if (resolved === undefined || resolved === null) {
    return Object.freeze({ present: true, evaluated: false, outcome: "not_checked" });
  }
  if (resolved === false) {
    return Object.freeze({ present: true, evaluated: true, outcome: "unresolvable" });
  }
  return Object.freeze({ present: true, evaluated: true, outcome: "verified" });
}

/** Self-check: the split's own invariants, for callers that cannot run tests. */
export function selfCheck() {
  const bytes = "a".repeat(64);
  const other = "b".repeat(64);
  const base = { issuer: "coreguard", scope: "execution-receipt", subject: "order-42" };
  const plain = splitIdentity({ ...base, contentDigest: bytes });
  const mirrored = splitIdentity({
    ...base,
    contentDigest: bytes,
    anchor: { kind: "chain", locator: "core:4123:0xabc" },
  });
  const drifted = splitIdentity({ ...base, contentDigest: other });
  const checks = [
    { name: "a record keeps its name when bytes change", pass: plain.recordId === drifted.recordId },
    { name: "a record's bytes are still distinguishable", pass: plain.contentDigest !== drifted.contentDigest },
    { name: "an anchor does not rename the record", pass: plain.recordId === mirrored.recordId },
    { name: "an unanchored identity reports an absent anchor", pass: anchorFacts(plain).outcome === "absent" },
    {
      name: "an unresolved anchor is unresolvable, never a failure of the record",
      pass: anchorFacts(mirrored, { resolved: false }).outcome === "unresolvable",
    },
    { name: "drift is visible as drift", pass: compareIdentities(plain, drifted).drifted === true },
  ];
  return Object.freeze({ identityVersion: IDENTITY_VERSION, checks, ok: checks.every((c) => c.pass) });
}
