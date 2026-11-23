/**
 * CoreGuard AER-1 record parser (CG-AER1/1) — the receipt format we did not write.
 *
 * AER-1 (draft-zambo-aer1-26) commits a canonical payload and keeps the receipt
 * id OUTSIDE that commitment. Two independent things follow from that design,
 * and a verifier that merges them will be wrong about one of them:
 *
 *   digest   what these bytes ARE — recomputed here, never taken on trust
 *   id       a label the payload does not cover — bindable only against
 *            something external: an expected id, or resolution of the id to a
 *            record whose own committed digest must agree
 *
 * With neither, the id is `unverified`: not matched, not refuted. That is a
 * fact about the evidence, and this module reports it as one.
 *
 * BOUNDARY (standing, load-bearing):
 *   - No network. Resolution is supplied by the caller; this module never goes
 *     looking, so "unresolvable" here means the caller could not resolve it.
 *   - No clock. `created_at` is read as a claim, never as ordering.
 *   - A supported-version check is explicit: an AER-1 schema this build does
 *     not implement is reported NOT_CHECKED with the version named, never
 *     failed, because a verifier that never judged a record may not convict it.
 *   - `verdict: "pass"` means the structural and commitment checks passed. It
 *     says nothing about whether the recorded work was correct.
 */

import { createHash } from "node:crypto";
import { decideOutcome } from "./outcomes.mjs";

export const AER1_PARSER_VERSION = "CG-AER1/1";

/**
 * Receipt schema versions this parser implements. Draft -26 publishes schema
 * 0.3 as current; 0.1 and 0.2 are accepted because their committed payload
 * shape is a subset. Anything else is NOT_CHECKED with the version named.
 */
export const SUPPORTED_RECEIPT_SCHEMAS = Object.freeze(["0.1", "0.2", "0.3", "0.4"]);

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const UUID_LOWER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Provenance classes AER-1 defines. A value outside this set is not a weaker
 * claim, it is an unknown one, and an unknown provenance may not pass as an
 * executed record. Exact match only: a trailing newline or a control character
 * makes the value a different string.
 */
export const KNOWN_PROVENANCE_CLASSES = Object.freeze(["EXECUTED BY ZAMBO", "LOGGED BY AGENT"]);

/**
 * Canonical base64 is the only accepted encoding: padded, four-character
 * groups, no whitespace, and re-encoding the decoded bytes must reproduce the
 * text exactly. Unpadded and pad-bit variants decode "fine" in most runtimes,
 * which is precisely why a verifier has to reject them here: the bytes it
 * hashes would not be the bytes another implementation hashes.
 */
const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;

/**
 * RFC 3339 with an honest calendar: the regex alone accepts 1900-02-29 and
 * 2023-02-29, and a leap second is not a value this build can verify. Absent
 * is allowed here because bare records in the corpus are valid without it,
 * and the field is a claim rather than ordering (see the module boundary).
 */
function isRfc3339(value, { strict = false } = {}) {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  const m = RFC3339_RE.exec(value);
  if (!m) return false;
  // Schema 0.4 makes the lexeme a claim, not just the instant: lowercase t/z
  // is a different spelling and the corpus rejects it. Older drafts accepted
  // both, and the corpus calls those records valid, so strictness is versioned.
  if (strict && (!value.includes("T") || (!value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value)))) return false;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const offsetHour = m[7] === undefined ? 0 : Number(m[7]);
  const offsetMinute = m[8] === undefined ? 0 : Number(m[8]);
  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (offsetHour > 23 || offsetMinute > 59) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= days;
}

const nonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * A record that claims `verification_status: "verified"` attests a specific
 * tool, so the descriptor there must be an object with three non-empty
 * strings. A bare legacy record (no verification claim) may carry the older
 * string form or none at all — the corpus has valid records of both shapes,
 * and a rule that refused the string form would be a false reject.
 */
const isToolDescriptor = (tool, verificationStatus) => {
  const structured = isObject(tool) && nonEmptyString(tool.name) && nonEmptyString(tool.version) && nonEmptyString(tool.scope);
  if (verificationStatus === "verified") return structured;
  if (tool === undefined) return true;
  if (typeof tool === "string") return tool.length > 0;
  return structured;
};

const isCanonicalBase64 = (s) =>
  typeof s === "string" && s.length > 0 && BASE64_RE.test(s) && Buffer.from(s, "base64").toString("base64") === s;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Canonical JSON for the schema 0.4 input_hash: member names ordered by code
 * point, no whitespace, string bytes left as UTF-8 (no NFC/NFD rewriting).
 * The hash is over the claim as written, so a reordered key list is a different
 * input set, exactly as the corpus's key-order vector requires.
 */
const byCodePoint = (a, b) => {
  const left = Array.from(a, (c) => c.codePointAt(0));
  const right = Array.from(b, (c) => c.codePointAt(0));
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
};
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort(byCodePoint)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const check = (name, ok, detail) => (detail === undefined ? { name, ok } : { name, ok, detail });

/**
 * findDuplicateMembers(jsonText) -> [{ path, key }]
 *
 * JSON.parse silently keeps the last of two same-named members, so two parsers
 * can read two different commitments from identical bytes. The only place the
 * duplicate is still visible is the text, which is why a caller that has the
 * bytes should pass them in. This is a small scanner, not a validator: it
 * walks the same grammar JSON.parse accepts and reports keys seen twice per
 * object. Malformed text simply stops the walk; JSON.parse is the authority on
 * whether the document is well formed.
 */
export function findDuplicateMembers(jsonText) {
  const duplicates = [];
  const n = jsonText.length;
  let i = 0;
  const skipWs = () => {
    while (i < n && (jsonText[i] === " " || jsonText[i] === "\t" || jsonText[i] === "\n" || jsonText[i] === "\r")) i += 1;
  };
  const readString = () => {
    i += 1; // opening quote
    while (i < n) {
      if (jsonText[i] === "\\") {
        i += 2;
        continue;
      }
      if (jsonText[i] === '"') {
        i += 1;
        return;
      }
      i += 1;
    }
  };
  const readValue = (path) => {
    skipWs();
    const c = jsonText[i];
    if (c === "{") {
      i += 1;
      skipWs();
      if (jsonText[i] === "}") {
        i += 1;
        return;
      }
      const seen = new Set();
      for (;;) {
        skipWs();
        const start = i;
        readString();
        let key;
        try {
          key = JSON.parse(jsonText.slice(start, i));
        } catch {
          return;
        }
        if (seen.has(key)) duplicates.push({ path: path || "$", key });
        seen.add(key);
        skipWs();
        if (jsonText[i] === ":") i += 1;
        readValue(path ? `${path}.${key}` : key);
        skipWs();
        if (jsonText[i] === ",") {
          i += 1;
          continue;
        }
        if (jsonText[i] === "}") i += 1;
        return;
      }
    }
    if (c === "[") {
      i += 1;
      skipWs();
      if (jsonText[i] === "]") {
        i += 1;
        return;
      }
      let index = 0;
      for (;;) {
        readValue(`${path}[${index}]`);
        index += 1;
        skipWs();
        if (jsonText[i] === ",") {
          i += 1;
          continue;
        }
        if (jsonText[i] === "]") i += 1;
        return;
      }
    }
    if (c === '"') {
      readString();
      return;
    }
    while (i < n && !" \t\n\r,]}:".includes(jsonText[i])) i += 1;
  };
  try {
    readValue("");
  } catch {
    // malformed text: nothing to report here, JSON.parse decides validity
  }
  return duplicates;
}

/**
 * parseAer1Record(record, { expectedId, resolvedRecord })
 *
 *   record          the AER-1 artifact as published (outer envelope)
 *   expectedId      an id the caller independently expects (string)
 *   resolvedRecord  the record `record.id` resolved to — { id, output_hash }
 *
 * Returns frozen facts plus one verdict. Nothing here throws on a malformed
 * artifact: a caller handing us garbage is evidence, not a program defect.
 */
export function parseAer1Record(record, { expectedId, resolvedRecord, rawText } = {}) {
  if (!isObject(record)) {
    const structure = [check("artifact is an object", false)];
    return freeze({
      parserVersion: AER1_PARSER_VERSION,
      version: null,
      supportedVersion: false,
      structure,
      structureOk: false,
      digest: { claimed: null, computed: null, ok: false, byteLength: null, byteLengthClaimed: null },
      id: { present: false, state: "unverified", verdict: "absent", expected: null, resolved: null },
      verdict: "fail",
      code: "STRUCTURE_INVALID",
    });
  }

  const version = typeof record.receipt_schema_version === "string" ? record.receipt_schema_version : null;
  const supportedVersion = version !== null && SUPPORTED_RECEIPT_SCHEMAS.includes(version);

  const structure = [];
  const idPresent = typeof record.id === "string" && record.id.length > 0;
  const claimed = typeof record.output_hash === "string" ? record.output_hash : null;
  const encoded = typeof record.canonical_bytes === "string" ? record.canonical_bytes : null;

  // Duplicate member names must be refused before any value is trusted: the
  // parsed object no longer shows them, so only the original text can.
  if (typeof rawText === "string") {
    const duplicates = findDuplicateMembers(rawText);
    structure.push(
      check("record text has no duplicate member names", duplicates.length === 0, duplicates.length === 0 ? undefined : duplicates),
    );
  }

  structure.push(check("id is present (outer envelope)", idPresent));
  structure.push(check("id is a lowercase UUID", idPresent && UUID_LOWER_RE.test(record.id)));
  structure.push(
    check("id is not the nil UUID", !idPresent || record.id !== "00000000-0000-0000-0000-000000000000"),
  );
  structure.push(
    check("created_at is RFC 3339 (when present)", isRfc3339(record.created_at, { strict: version === "0.4" })),
  );
  structure.push(
    check(
      "tool names a real descriptor when the record claims verification",
      isToolDescriptor(record.tool, record.verification_status),
    ),
  );
  structure.push(
    check(
      "provenance_class is a known class (when present)",
      record.provenance_class === undefined ||
        (typeof record.provenance_class === "string" && KNOWN_PROVENANCE_CLASSES.includes(record.provenance_class)),
    ),
  );
  structure.push(check("output_hash is sha256:<64 hex>", claimed !== null && DIGEST_RE.test(claimed)));
  structure.push(check("canonical_bytes is base64 text", encoded !== null && encoded.length > 0));
  structure.push(check("canonical_bytes is canonical base64", isCanonicalBase64(encoded)));

  let computed = null;
  let byteLength = null;
  let payload = null;
  let payloadParses = false;

  if (encoded !== null && encoded.length > 0) {
    const bytes = Buffer.from(encoded, "base64");
    computed = sha256(bytes);
    byteLength = bytes.length;
    try {
      payload = JSON.parse(bytes.toString("utf8"));
      payloadParses = isObject(payload);
    } catch {
      payloadParses = false;
    }
    structure.push(check("canonical_bytes decode to a byte string", byteLength > 0));
    structure.push(check("canonical_bytes parse to a JSON object", payloadParses));
    if (payloadParses) {
      const payloadDuplicates = findDuplicateMembers(bytes.toString("utf8"));
      structure.push(
        check(
          "committed payload has no duplicate member names",
          payloadDuplicates.length === 0,
          payloadDuplicates.length === 0 ? undefined : payloadDuplicates,
        ),
      );
      // A canonical execution record commits both sides of the work. Legacy
      // artifacts commit neither, and the corpus calls those valid, so the
      // strict rules apply only where the payload carries an execution result.
      const canonicalExecution = payload.inputs !== undefined || payload.outputs !== undefined;
      if (canonicalExecution) {
        structure.push(check("committed payload carries an inputs object", isObject(payload.inputs)));
        if (record.verification_status !== undefined) {
          structure.push(
            check(
              "verification_status is verified when the record claims it",
              record.verification_status === "verified",
              record.verification_status === "verified" ? undefined : { found: record.verification_status },
            ),
          );
        }
      }
      if (version === "0.4") {
        // The outer input_hash binds the recorded inputs, not the whole payload.
        // A reordered key list is a different claim even though JSON.parse
        // produces the same object, so the hash runs over canonical text.
        if (record.input_hash !== undefined) {
          const expectedInputHash = isObject(payload.inputs) ? `sha256:${sha256(Buffer.from(canonicalJson(payload.inputs), "utf8"))}` : null;
          structure.push(
            check("input_hash binds the canonical JSON of the recorded inputs", expectedInputHash !== null && expectedInputHash === record.input_hash, {
              expected: expectedInputHash,
              found: record.input_hash,
            }),
          );
        }
        // Schema 0.4 commits the provenance claim twice: outside the digest and
        // inside issuer_claims. One side missing, or a different class, is a
        // broken binding, not a weaker provenance claim.
        const committed = payload.issuer_claims;
        const committedClass = isObject(committed) && typeof committed.provenance_class === "string" ? committed.provenance_class : null;
        structure.push(
          check(
            "provenance_class matches the committed issuer_claims",
            committedClass !== null && record.provenance_class === committedClass,
            { outer: record.provenance_class ?? null, committed: committedClass },
          ),
        );
      }
    }
  }

  const byteLengthClaimed =
    typeof record.canonical_byte_length === "number" ? record.canonical_byte_length : null;
  if (byteLengthClaimed !== null) {
    structure.push(
      check("canonical_byte_length matches the decoded bytes", byteLength === byteLengthClaimed, {
        claimed: byteLengthClaimed,
        actual: byteLength,
      }),
    );
  }
  if (record.metadata_hash !== undefined) {
    // The vendored corpus exercises only the format of this 0.4 member; it
    // publishes no preimage rule, so this build checks the shape and says so
    // rather than inventing a recomputation nobody can reproduce.
    structure.push(check("metadata_hash is sha256:<64 hex>", typeof record.metadata_hash === "string" && DIGEST_RE.test(record.metadata_hash)));
  }

  const digestOk = computed !== null && claimed !== null && `sha256:${computed}` === claimed;
  structure.push(check("output_hash matches the recomputed digest", digestOk));

  // The id must NOT be inside the commitment. If it is, the artifact's own
  // claim ("the label is outside the signed payload") is false.
  if (payloadParses) {
    structure.push(check("committed payload does not carry the id", !("id" in payload)));
    structure.push(
      check(
        "committed payload carries receipt_schema_version",
        payload.receipt_schema_version === undefined || payload.receipt_schema_version === version,
      ),
    );
  }

  const structureOk = structure.every((c) => c.ok);

  const id = bindId({ idPresent, record, expectedId, resolvedRecord });

  const verdict = structureOk && id.verdict !== "mismatched" && id.state !== "absent" ? "pass" : "fail";
  const code =
    verdict === "pass"
      ? null
      : id.verdict === "mismatched"
        ? "RECEIPT_ID_MISMATCH"
        : structureOk
          ? "STRUCTURE_INVALID"
          : digestOk || !structure.some((c) => c.name.includes("digest"))
            ? "STRUCTURE_INVALID"
            : "DIGEST_MISMATCH";

  return freeze({
    parserVersion: AER1_PARSER_VERSION,
    version,
    supportedVersion,
    structure,
    structureOk,
    digest: { claimed, computed: computed === null ? null : `sha256:${computed}`, ok: digestOk, byteLength, byteLengthClaimed },
    id,
    verdict,
    code,
  });
}

function bindId({ idPresent, record, expectedId, resolvedRecord }) {
  if (!idPresent) {
    return Object.freeze({ present: false, state: "unverified", verdict: "absent", expected: null, resolved: null });
  }
  const ownId = record.id;

  if (typeof expectedId === "string") {
    const same = expectedId === ownId;
    return Object.freeze({
      present: true,
      state: same ? "verified-expected" : "mismatch",
      verdict: same ? "matched" : "mismatched",
      expected: expectedId,
      resolved: null,
    });
  }

  if (isObject(resolvedRecord)) {
    const resolvedDigest = typeof resolvedRecord.output_hash === "string" ? resolvedRecord.output_hash : null;
    const ownDigest = typeof record.output_hash === "string" ? record.output_hash : null;
    const agree = resolvedDigest !== null && ownDigest !== null && resolvedDigest === ownDigest;
    return Object.freeze({
      present: true,
      state: agree ? "verified-resolved" : "mismatch",
      verdict: agree ? "resolved" : "mismatched",
      expected: null,
      resolved: { id: typeof resolvedRecord.id === "string" ? resolvedRecord.id : null, digest: resolvedDigest },
    });
  }

  return Object.freeze({ present: true, state: "unverified", verdict: "unverified", expected: null, resolved: null });
}

/**
 * Turn parsed AER-1 facts into a CG-OUT/1 outcome.
 *
 * `anchor` is the anchor-layer fact set the caller measured, in CG-OUT/1's
 * vocabulary: { present, evaluated, outcome } where outcome is "verified" |
 * "absent" | "not_checked" | "unresolvable".
 *
 * Composition is deliberately CoreGuard's default here (anchor unresolvable
 * composes to UNRESOLVABLE_RECORD). The layered alternative — where the record
 * verdict never moves — is in composition.mjs, and the difference is a switch,
 * not an argument.
 */
export function aer1Outcome(parsed, { anchor } = {}) {
  if (!parsed || typeof parsed !== "object") throw new TypeError("aer1Outcome requires parsed facts");
  if (!parsed.supportedVersion) {
    return decideOutcome({
      presented: true,
      record: {
        evaluated: false,
        version: parsed.version ?? "unknown",
        reason: `this build does not implement AER-1 receipt schema ${parsed.version ?? "(absent)"}`,
      },
      anchor,
    });
  }
  return decideOutcome({
    presented: true,
    record: {
      evaluated: true,
      ok: parsed.verdict === "pass",
      code: parsed.code,
      reason:
        parsed.verdict === "pass"
          ? undefined
          : parsed.id.verdict === "mismatched"
            ? "the committed digest disagrees with the id it was presented under"
            : "a structural check on the AER-1 artifact failed",
    },
    anchor,
  });
}

function freeze(value) {
  return Object.freeze(value);
}

/**
 * AER-1 timelines — the part of the record that lives across receipts.
 *
 * Three constructions are implemented here, each pinned by the corpus:
 *   v1    draft Section 7 before -07: entry digest over the decoded bytes
 *   v07   entry digest binds prev_digest, seq, job_id, close, id, tool,
 *         provenance_class and the output commitment, serialized as canonical
 *         JSON with member names sorted by code point and strings escaped per
 *         RFC 8259, non-ASCII as \uXXXX
 *   workflow  a binary Merkle tree over step leaves: receipt_id (receipt-id-v0)
 *         or "seq:output_hash" (seq-output-v1), last-duplicate on odd levels
 *
 * Boundary, standing: no clock, no network, no anchoring. A chain that verifies
 * proves its own order and metadata; it does not prove the work happened.
 */
export const AER1_CHAIN_VERSIONS = Object.freeze(["v1", "v07"]);
export const AER1_MERKLE_VERSIONS = Object.freeze(["receipt-id-v0", "seq-output-v1"]);

const ZERO_DIGEST = "0".repeat(64);
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const isLowerHex64 = (value) => typeof value === "string" && LOWER_HEX_64.test(value);
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

/** RFC 8259 string escaping with every non-ASCII code point written as \uXXXX. */
function aer1Escape(value) {
  let out = "";
  for (const char of value) {
    const cp = char.codePointAt(0);
    if (char === '"') out += '\\"';
    else if (char === "\\") out += "\\\\";
    else if (cp === 0x08) out += "\\b";
    else if (cp === 0x09) out += "\\t";
    else if (cp === 0x0a) out += "\\n";
    else if (cp === 0x0c) out += "\\f";
    else if (cp === 0x0d) out += "\\r";
    else if (cp < 0x20) out += `\\u${cp.toString(16).padStart(4, "0")}`;
    else if (cp > 0x7e) {
      if (cp > 0xffff) {
        const offset = cp - 0x10000;
        out += "\\u" + (0xd800 + (offset >> 10)).toString(16) + "\\u" + (0xdc00 + (offset & 0x3ff)).toString(16);
      } else out += `\\u${cp.toString(16).padStart(4, "0")}`;
    } else out += char;
  }
  return out;
}
const aer1Quoted = (value) => `"${aer1Escape(String(value))}"`;

const sha256Hex = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** The v1 entry digest: SHA-256 over the base64-decoded canonical bytes. */
function entryDigestV1(entry) {
  if (!isNonEmptyString(entry?.canonical_bytes)) return null;
  return sha256Hex(Buffer.from(entry.canonical_bytes, "base64"));
}

/**
 * The v07 entry digest: canonical JSON with exactly the eight members named in
 * Section 7.1, sorted by code point, no whitespace outside strings.
 */
function entryDigestV07(entry) {
  if (!isNonEmptyString(entry?.canonical_bytes)) return null;
  const output = sha256Hex(Buffer.from(entry.canonical_bytes, "base64"));
  const members = [
    ["close", entry.close === undefined ? false : entry.close],
    ["id", entry.id],
    ["job_id", entry.job_id],
    ["output_hash", output],
    ["prev_digest", entry.prev_digest],
    ["provenance_class", entry.provenance_class],
    ["seq", entry.seq],
    ["tool", entry.tool],
  ];
  const body = members
    .map(([key, value]) => {
      const encoded =
        typeof value === "number" && Number.isInteger(value)
          ? String(value)
          : typeof value === "boolean"
            ? String(value)
            : aer1Quoted(value ?? "");
      return `${aer1Quoted(key)}:${encoded}`;
    })
    .join(",");
  return sha256Hex(Buffer.from(`{${body}}`, "utf8"));
}

/**
 * verifyAer1Chain(timeline, { version })
 *
 * Returns { version, ok, checks, code } and never throws on hostile input. The
 * checks are named so a caller can report which rule refused a timeline.
 */
export function verifyAer1Chain(timeline, { version = "v07" } = {}) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  const done = (code) => ({ version, ok: checks.every((c) => c.ok), checks, code: checks.every((c) => c.ok) ? null : code });

  if (!AER1_CHAIN_VERSIONS.includes(version)) return { version, ok: false, checks: [], code: "CHAIN_VERSION_UNSUPPORTED" };
  add("timeline is a non-empty array", Array.isArray(timeline) && timeline.length > 0);
  if (!Array.isArray(timeline) || timeline.length === 0) return done("CHAIN_EMPTY");

  const first = timeline[0];
  add("first entry carries the zero genesis digest", first?.prev_digest === ZERO_DIGEST);

  let linksOk = true;
  let metadataOk = true;
  let closeOk = true;
  for (let i = 0; i < timeline.length; i += 1) {
    const entry = timeline[i] ?? {};
    if (i > 0) {
      const previous = timeline[i - 1];
      const expected = version === "v07" ? entryDigestV07(previous) : entryDigestV1(previous);
      if (expected === null || entry.prev_digest !== expected) linksOk = false;
    }
    if (entry.close !== undefined && typeof entry.close !== "boolean") closeOk = false;
    if (i < timeline.length - 1 && entry.close === true) closeOk = false;
    if (version === "v07") {
      if (!Number.isInteger(entry.seq) || entry.seq !== i + 1) metadataOk = false;
      if (!isNonEmptyString(entry.job_id) || entry.job_id !== first.job_id) metadataOk = false;
      if (!isNonEmptyString(entry.id)) metadataOk = false;
      if (!isNonEmptyString(entry.tool)) metadataOk = false;
      if (!isNonEmptyString(entry.provenance_class)) metadataOk = false;
    }
  }

  add("every link recomputes from the previous entry", linksOk);
  if (version === "v07"){
    add("seq is contiguous from 1 and the job id is constant", metadataOk);
    add("each entry names an id, tool and provenance class", metadataOk);
  }
  add("close is boolean and true only on the last entry", closeOk);
  add("the timeline ends with a closing entry", timeline[timeline.length - 1]?.close === true);

  return done(!linksOk ? "CHAIN_LINK_MISMATCH" : !metadataOk ? "CHAIN_METADATA_INVALID" : "CHAIN_NOT_CLOSED");
}

/**
 * verifyAer1Commitment(timeline, commitment, { entryCountLexeme })
 *
 * The external commitment binds a chain's job, length, final entry digest and
 * publication time. `entryCountLexeme` is the raw JSON text of entry_count when
 * the caller has it: `5.0` is the same number as `5` but a different claim, and
 * the corpus rejects the fractional spelling.
 */
export function verifyAer1Commitment(timeline, commitment, { entryCountLexeme } = {}) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  const chain = verifyAer1Chain(timeline, { version: "v07" });
  add("the timeline verifies under the v07 chain rules", chain.ok);
  const isObjectCommitment = isObject(commitment);
  add("commitment is an object", isObjectCommitment);

  if (isObjectCommitment) {
    add(
      "commitment carries job_id, final_entry_digest, entry_count and published_at",
      ["job_id", "final_entry_digest", "entry_count", "published_at"].every((key) => commitment[key] !== undefined),
    );
    const jobOk = isNonEmptyString(commitment.job_id) && Array.isArray(timeline) && timeline[0]?.job_id === commitment.job_id;
    add("commitment job_id matches the timeline's job", jobOk);

    const finalDigest = Array.isArray(timeline) && timeline.length > 0 ? entryDigestV07(timeline[timeline.length - 1]) : null;
    add(
      "final_entry_digest is lowercase hex and matches the last entry",
      isLowerHex64(commitment.final_entry_digest) && finalDigest !== null && commitment.final_entry_digest === finalDigest,
    );

    const countOk =
      Number.isInteger(commitment.entry_count) && Array.isArray(timeline) && commitment.entry_count === timeline.length;
    const lexemeOk = entryCountLexeme === undefined || entryCountLexeme === null || !/[.eE]/.test(entryCountLexeme);
    add("entry_count is an integer equal to the number of entries", countOk && lexemeOk);

    add("published_at is an RFC 3339 timestamp", isRfc3339(commitment.published_at) && typeof commitment.published_at === "string");
  }

  return { ok: checks.every((c) => c.ok), checks, code: checks.every((c) => c.ok) ? null : "COMMITMENT_INVALID" };
}

/**
 * verifyAer1WorkflowMerkle({ steps, merkleRoot, merkleVersion, merkleVersionPresent })
 *
 * Leaf construction follows the declared merkle_version; an absent member means
 * receipt-id-v0. An unknown version is a refusal, never a guess: the two
 * constructions give different roots for the same workflow.
 */
export function verifyAer1WorkflowMerkle({ steps, merkleRoot, merkleVersion, merkleVersionPresent = true } = {}) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  const declared = merkleVersionPresent === false || merkleVersion === undefined ? "receipt-id-v0" : merkleVersion;
  add("merkle_version is one this build implements", AER1_MERKLE_VERSIONS.includes(declared));

  const stepsOk =
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every((step, index) => isObject(step) && step.seq === index + 1 && isNonEmptyString(step.receipt_id));
  add("steps are a non-empty ordered array with seq from 1", stepsOk);

  if (stepsOk) {
    const ids = steps.map((step) => step.receipt_id);
    add("no receipt id appears twice", new Set(ids).size === ids.length);
    if (declared === "seq-output-v1") {
      add("every step carries an output_hash", steps.every((step) => isLowerHex64(String(step.output_hash ?? "").replace(/^sha256:/, ""))));
    }
  }

  let computed = null;
  if (stepsOk && AER1_MERKLE_VERSIONS.includes(declared)) {
    const leaf = (step) =>
      declared === "seq-output-v1"
        ? sha256Hex(Buffer.from(`${step.seq}:${String(step.output_hash).replace(/^sha256:/, "")}`, "utf8"))
        : sha256Hex(Buffer.from(step.receipt_id, "utf8"));
    let level = steps.map((step) => Buffer.from(leaf(step), "hex"));
    while (level.length > 1) {
      if (level.length % 2 === 1) level = [...level, level[level.length - 1]];
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(Buffer.from(sha256Hex(Buffer.concat([level[i], level[i + 1]])), "hex"));
      }
      level = next;
    }
    computed = level[0].toString("hex");
  }

  add(
    "merkle_root is lowercase hex and matches the recomputed root",
    computed !== null && isLowerHex64(merkleRoot) && computed === merkleRoot,
  );

  return { ok: checks.every((c) => c.ok), computed, declared, checks, code: checks.every((c) => c.ok) ? null : "WORKFLOW_MERKLE_INVALID" };
}

/**
 * verifyAer1MerkleVector(vector) — corpus family `merkle`, 9 vectors / 12 kit
 * checks. Section 8.1 is one construction only: leaf = SHA-256(UTF-8
 * receipt_id), internal node = SHA-256(raw left || raw right), last node
 * duplicated at an odd level, and an empty workflow's root is SHA-256(empty).
 *
 * The corpus also pins two ways to be wrong. A legacy `seq:receipt_hash`
 * preimage tree produces a different root and is refused on sight, and a
 * duplicate receipt_id that happens to recompute the canonical root is still
 * an invalid workflow under Section 8.2. No root-only shortcut: both checks
 * have to be made before a verdict is returned.
 */
export function verifyAer1MerkleVector(vector) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  const v = isObject(vector) ? vector : {};
  const ids = v.receipt_ids;
  add("vector carries receipt_ids, not the legacy preimage form", Array.isArray(ids) && v.leaves === undefined);
  const idsOk = Array.isArray(ids) && ids.every((id) => isNonEmptyString(id));
  add("every receipt_id is a non-empty string", idsOk);
  add("no receipt_id appears twice", !idsOk || new Set(ids).size === ids.length);
  let computed = null;
  if (idsOk) {
    let level = ids.map((id) => Buffer.from(sha256Hex(Buffer.from(id, "utf8")), "hex"));
    if (level.length === 0) computed = sha256Hex(Buffer.alloc(0));
    else {
      while (level.length > 1) {
        if (level.length % 2 === 1) level = [...level, level[level.length - 1]];
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
          next.push(Buffer.from(sha256Hex(Buffer.concat([level[i], level[i + 1]])), "hex"));
        }
        level = next;
      }
      computed = level[0].toString("hex");
    }
  }
  add("expected_root is lowercase hex", isLowerHex64(v.expected_root));
  add("merkle root recomputes from the receipt ids in file order", computed !== null && computed === v.expected_root);
  if (v.must_not_equal !== undefined) {
    add("the root is not the rejected construction's root", computed !== null && computed !== v.must_not_equal);
  }
  const ok = checks.every((c) => c.ok);
  return { ok, computed, checks, code: ok ? null : "MERKLE_VECTOR_INVALID" };
}

/**
 * verifyAer1UnicodeVector(vector) — corpus family `unicode`, 5 vectors.
 * The commitment is over the payload's exact bytes. No NFC/NFD rewriting, no
 * re-encoding, no "visually identical" equivalence: the two spellings of café
 * hash differently and the corpus pins both directions of that difference.
 */
export function verifyAer1UnicodeVector(vector) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok });
  const v = isObject(vector) ? vector : {};
  const encoded = v.payload_base64;
  add("payload_base64 is canonical base64 text", isCanonicalBase64(encoded));
  let bytes = null;
  let computed = null;
  if (isCanonicalBase64(encoded)) {
    bytes = Buffer.from(encoded, "base64");
    computed = sha256Hex(bytes);
  }
  add("payload_utf8_hex is the exact decoded bytes", bytes !== null && typeof v.payload_utf8_hex === "string" && bytes.toString("hex") === v.payload_utf8_hex);
  add("sha256 is lowercase hex", isLowerHex64(v.sha256));
  add("the digest recomputes from the raw bytes without normalization", computed !== null && computed === v.sha256);
  const ok = checks.every((c) => c.ok);
  return { ok, computed, checks, code: ok ? null : "UNICODE_VECTOR_INVALID" };
}

/** Self-check: the parser's own invariants, for callers that cannot run tests. */
export function selfCheck() {
  const bytes = Buffer.from(JSON.stringify({ receipt_schema_version: "0.3", output: { text: "ok" } }), "utf8");
  const good = {
    id: "11111111-1111-4111-8111-111111111111",
    receipt_schema_version: "0.3",
    canonical_byte_length: bytes.length,
    canonical_bytes: bytes.toString("base64"),
    output_hash: `sha256:${sha256(bytes)}`,
  };
  const alone = parseAer1Record(good);
  const matched = parseAer1Record(good, { expectedId: good.id });
  const swapped = parseAer1Record(good, { expectedId: "22222222-2222-4222-8222-222222222222" });
  const future = parseAer1Record({ ...good, receipt_schema_version: "9.9" });
  const checks = [
    { name: "a well-formed artifact verifies", pass: alone.verdict === "pass" },
    { name: "an unbound id is unverified, not matched", pass: alone.id.verdict === "unverified" },
    { name: "the same id binds as matched", pass: matched.id.verdict === "matched" },
    { name: "a swapped id is mismatched", pass: swapped.id.verdict === "mismatched" },
    { name: "an unimplemented version is not checked", pass: future.supportedVersion === false },
    { name: "a duplicate member name is refused", pass: findDuplicateMembers('{"a":1,"a":2}').length === 1 },
  ];
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
