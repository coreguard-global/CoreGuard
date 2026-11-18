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
export const SUPPORTED_RECEIPT_SCHEMAS = Object.freeze(["0.1", "0.2", "0.3"]);

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const check = (name, ok, detail) => (detail === undefined ? { name, ok } : { name, ok, detail });

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
export function parseAer1Record(record, { expectedId, resolvedRecord } = {}) {
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

  structure.push(check("id is present (outer envelope)", idPresent));
  structure.push(check("output_hash is sha256:<64 hex>", claimed !== null && DIGEST_RE.test(claimed)));
  structure.push(check("canonical_bytes is base64 text", encoded !== null && encoded.length > 0));

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
  ];
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
