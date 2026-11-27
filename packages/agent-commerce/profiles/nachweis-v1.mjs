/**
 * nachweis/v1 profile resolver (CG-PROFILE-NACHWEIS/1).
 *
 * A receipt pointer carries two strings: `{ receipt_id, profile }`. For
 * `profile: "nachweis/v1"`, the id names the *execution* record, `refId` leads
 * to the decision it follows, and the id is recomputable from the record.
 * This module implements only that: locate, recompute, link, and name drift.
 *
 * It does NOT verify signatures, the mandate credential, revocation, or any
 * server key. It does not contact the network and has no lookup by hash, so the
 * holder must supply the export. VERIFIED != SAFE.
 *
 * Record hashing follows the layout documented by the reference verifier
 * (prokura-verify, Apache-2.0): SHA-256 over the RFC 8785 canonical JSON array
 * [prevHash, intent, decision, reasons, railRef, createdAt, recordFields].
 * Cross-checked against its public demo fixture: 7/7 record ids reproduce.
 */

import { createHash } from "node:crypto";

import { canonicalize } from "@coreguard/canonical";

export const NACHWEIS_PROFILE = "nachweis/v1";
export const NACHWEIS_SPEC = "CG-PROFILE-NACHWEIS/1";

export const NACHWEIS_BOUNDARY =
  "locates and recomputes nachweis/v1 records supplied by the holder; no signature, credential, revocation or lookup verification; VERIFIED != SAFE";

const RECORD_FIELDS = [
  "id", "kind", "refId", "mandateId", "agentId", "principalId", "intentHash",
  "stepUp", "gateState", "rail", "railStatus", "amount", "currency", "payee",
];

const DRIFT_FIELDS = ["amount", "currency", "rail"];

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const sha256Hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** The record fields that feed the hash, excluding the outer array slots. */
export function recordFields(record) {
  const rest = {};
  for (const key of RECORD_FIELDS) {
    if (record[key] !== undefined) rest[key] = record[key];
  }
  if (record.v === 2) {
    rest.v = 2;
    rest.mandateSeq = record.mandateSeq ?? null;
    rest.mandatePrevHash = record.mandatePrevHash ?? null;
    rest.agentName = record.agentName ?? null;
  }
  return rest;
}

/** Recompute the id of one record: hex SHA-256, no `sha256:` prefix. */
export function recordHash(record) {
  if (!isObj(record)) throw new TypeError("record must be an object");
  const array = [
    record.prevHash ?? null,
    record.intent ?? null,
    record.decision ?? null,
    record.reasons ?? null,
    record.railRef ?? null,
    record.createdAt ?? null,
    recordFields(record),
  ];
  return sha256Hex(canonicalize(array));
}

/** Intent id as the record format carries it, including the `sha256:` prefix. */
export function intentHash(intent) {
  if (!isObj(intent)) throw new TypeError("intent must be an object");
  return "sha256:" + sha256Hex(canonicalize(intent));
}

const refusal = (receiptId, code, detail) => ({
  ok: false,
  spec: NACHWEIS_SPEC,
  profile: NACHWEIS_PROFILE,
  receiptId,
  codes: [code],
  detail,
  boundary: NACHWEIS_BOUNDARY,
});

/**
 * @param {object|object[]} exportDoc `{ records: [...] }` or a bare record array
 * @param {string} receiptId the `receipt_id` the checkout carries
 * @returns {{ok: boolean, spec, profile, receiptId, record?, decision?, checks?,
 *            codes: string[], detail?: string, boundary: string}}
 */
export function resolveNachweisExport(exportDoc, receiptId) {
  const records = Array.isArray(exportDoc) ? exportDoc : exportDoc?.records;
  if (!Array.isArray(records) || records.length === 0) {
    return refusal(receiptId, "NO_RECORDS", "export carries no records");
  }
  if (typeof receiptId !== "string" || !/^[0-9a-f]{64}$/.test(receiptId)) {
    return refusal(receiptId, "INVALID_RECEIPT_ID", "receipt_id must be 64 lowercase hex characters");
  }

  const record = records.find((r) => isObj(r) && r.hash === receiptId);
  if (!record) {
    return refusal(receiptId, "RECORD_NOT_FOUND", "no record in this export has that hash");
  }

  const codes = [];
  const checks = { receiptId: "MATCH", kind: record.kind, intent: "NOT_CHECKED", drift: [] };

  if (recordHash(record) !== record.hash) {
    codes.push("HASH_MISMATCH");
    checks.receiptId = "MISMATCH";
  }
  if (record.kind !== "execution") {
    codes.push("UNEXPECTED_KIND");
  }

  const decision = records.find((r) => isObj(r) && r.id === record.refId);
  if (!decision) {
    codes.push("REF_MISSING");
    return {
      ok: false, spec: NACHWEIS_SPEC, profile: NACHWEIS_PROFILE, receiptId,
      record, checks, codes, detail: "refId does not resolve inside this export",
      boundary: NACHWEIS_BOUNDARY,
    };
  }

  if (record.intentHash !== decision.intentHash) {
    codes.push("INTENT_HASH_MISMATCH");
    checks.intent = "MISMATCH";
  } else {
    checks.intent = "MATCH";
  }

  const approved = isObj(decision.intent) ? decision.intent : {};
  if (checks.intent === "MATCH") {
    for (const field of DRIFT_FIELDS) {
      if (record[field] !== approved[field]) {
        codes.push(`${field.toUpperCase()}_DRIFT`);
        checks.drift.push(field);
      }
    }
    const approvedPayee = isObj(approved.payee) ? approved.payee.value : undefined;
    const executedPayee = isObj(record.payee) ? record.payee.value : undefined;
    if (executedPayee !== approvedPayee) {
      codes.push("PAYEE_DRIFT");
      checks.drift.push("payee");
    }
  }

  return {
    ok: codes.length === 0,
    spec: NACHWEIS_SPEC,
    profile: NACHWEIS_PROFILE,
    receiptId,
    record,
    decision: {
      id: decision.id,
      decision: decision.decision,
      reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
    },
    checks,
    codes,
    boundary: NACHWEIS_BOUNDARY,
  };
}

export default resolveNachweisExport;
