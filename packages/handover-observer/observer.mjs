/**
 * CoreGuard independent handover observer (CG-HANDOVER/1).
 *
 * Reads an AER-1 handover bundle as published by Zambo and re-derives, from the
 * bundle's own bytes, what a receiving agent can rely on. It does not call
 * Zambo's verification endpoint and does not read the issuer's verdict as its
 * own: `receipt_checks` is copied under `issuerClaims` for comparison only.
 *
 * What is recomputed here:
 *   - every step receipt's SHA-256 over the decoded canonical bytes
 *   - the base64 and text forms of those bytes agree
 *   - the workflow Merkle root under the declared construction
 *   - the workflow-close receipt's own commitment
 *   - the handover id the caller expected, when one is supplied
 *
 * What is not:
 *   - issuer identity (no pinned key is published in the bundle)
 *   - outside timestamp
 *   - whether the recorded work was correct
 *   - the `steps_digest` and `metadata_hash` preimages, which the public
 *     material does not define; both are reported not_checked, never guessed
 *
 * A bundle whose receipts all recompute is `verified` as a record. That says the
 * saved bytes are internally consistent and bound to this handover; it does not
 * say the delivery succeeded in the world.
 */

import { createHash } from "node:crypto";

import {
  parseAer1Record,
  verifyAer1WorkflowMerkle,
  findDuplicateMembers,
} from "../agent-commerce/aer1.mjs";

export const OBSERVER_VERSION = "CG-HANDOVER/1";
export const SUPPORTED_HANDOVER_DRAFTS = Object.freeze(["draft-zambo-aer1-26"]);

export const RECORD_OUTCOMES = Object.freeze([
  "verified",
  "verification_failed",
  "not_checked",
  "absent",
  "unresolvable_record",
]);

export const OBSERVER_OUTCOMES = Object.freeze(["unavailable", "unsupported", "inconclusive"]);

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const sha256 = (buf) => `sha256:${createHash("sha256").update(buf).digest("hex")}`;

/**
 * CG-HANDOVER/1 steps_digest preimage, published for AER-1 handover bundles:
 * step receipt ids in steps-array order, joined by one U+000A, no trailing
 * newline. Refused receipts are not steps-array rows and are not covered.
 */
export const STEPS_DIGEST_RULE = "sha256(utf8(step ids joined by U+000A, in array order, no trailing newline))";

export function normalizeDigest(value) {
  return typeof value === "string" ? value.replace(/^sha256:/, "").toLowerCase() : null;
}

export function stepsDigestOf(bundle) {
  const ids = Array.isArray(bundle?.steps) ? bundle.steps.map((s) => s?.id) : [];
  if (ids.length === 0 || ids.some((id) => typeof id !== "string" || id.length === 0)) return null;
  return createHash("sha256").update(ids.join("\n"), "utf8").digest("hex");
}

/** Deterministic JSON: member names sorted, no whitespace. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * draft-zambo-aer1-26 §3.1 canonical metadata block. Every member is a JSON
 * string; member names are sorted by Unicode code point at every level; there
 * is no whitespace outside strings. Both public bundles are ASCII here, so
 * code-point and UTF-16 ordering coincide.
 */
export const METADATA_HASH_RULE = "sha256:utf8(canonical metadata block: created_at, id, output_hash, provenance_class, receipt_schema_version, tool{name,scope,version})";

const byCodePoint = (a, b) => {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0);
    if (d !== 0) return d;
  }
  return x.length - y.length;
};

export function metadataBlockOf(receipt) {
  const tool = isObject(receipt?.tool_context) ? receipt.tool_context : {};
  const block = {
    created_at: receipt?.timestamp,
    id: receipt?.id,
    output_hash: receipt?.output_hash,
    provenance_class: receipt?.provenance_class,
    receipt_schema_version: receipt?.receipt_schema_version,
    tool: {
      name: tool.name,
      scope: tool.scope,
      version: tool.version,
    },
  };
  return Object.keys(block).sort(byCodePoint).reduce((out, key) => {
    const value = block[key];
    out[key] = isObject(value)
      ? Object.keys(value).sort(byCodePoint).reduce((nested, k) => {
        nested[k] = value[k];
        return nested;
      }, {})
      : value;
    return out;
  }, {});
}

export function metadataHashOf(receipt) {
  const block = metadataBlockOf(receipt);
  const values = Object.values(block).flatMap((v) => (isObject(v) ? Object.values(v) : [v]));
  if (values.some((v) => typeof v !== "string")) return null;
  return sha256(Buffer.from(canonicalJson(block), "utf8"));
}

/** Stable identity for a verdict, so two observers can compare reports. */
export function verdictDigest(verdict) {
  const { verdictDigest: _omit, ...rest } = verdict;
  return sha256(Buffer.from(canonicalJson(rest), "utf8"));
}

const check = (id, ok, detail) => (detail === undefined ? { id, ok } : { id, ok, detail });

/**
 * verifyHandover(text, { observer, readAt, expectedId, sourceUrl })
 *
 * `text` is the exact fetched bundle text. Passing text rather than an object is
 * deliberate: duplicate member names and the bundle digest are properties of
 * the bytes, and JSON.parse would erase the first.
 */
export function verifyHandover(text, { observer, readAt, expectedId, sourceUrl } = {}) {
  const checks = [];
  const notChecked = [];
  const notEstablished = [];
  const add = (id, ok, detail) => checks.push(check(id, ok, detail));

  if (typeof text !== "string" || text.length === 0) {
    return finalize({
      observer,
      readAt,
      sourceUrl,
      bundleDigest: null,
      handover: null,
      outcome: "unavailable",
      coverage: null,
      steps: [],
      merkle: null,
      workflowReceipt: null,
      issuerClaims: null,
      checks: [check("bundle bytes were supplied", false)],
      notChecked: [{ scope: "bundle", reason: "not_attempted", detail: "no bytes" }],
      notEstablished: ["everything: no bundle bytes were supplied"],
    });
  }

  const bundleDigest = sha256(Buffer.from(text, "utf8"));
  let bundle;
  try {
    bundle = JSON.parse(text);
  } catch (error) {
    return finalize({
      observer,
      readAt,
      sourceUrl,
      bundleDigest,
      handover: null,
      outcome: "verification_failed",
      coverage: null,
      steps: [],
      merkle: null,
      workflowReceipt: null,
      issuerClaims: null,
      checks: [check("bundle parses as JSON", false, error instanceof Error ? error.message : String(error))],
      notChecked: [],
      notEstablished: ["everything: the bundle is not JSON"],
    });
  }

  if (!isObject(bundle)) {
    return finalize({
      observer,
      readAt,
      sourceUrl,
      bundleDigest,
      handover: null,
      outcome: "verification_failed",
      coverage: null,
      steps: [],
      merkle: null,
      workflowReceipt: null,
      issuerClaims: null,
      checks: [check("bundle is a JSON object", false)],
      notChecked: [],
      notEstablished: ["everything: a handover bundle must be an object"],
    });
  }

  const duplicates = findDuplicateMembers(text);
  add("bundle text has no duplicate member names", duplicates.length === 0, duplicates.length ? duplicates : undefined);
  add("bundle carries an id", typeof bundle.id === "string" && bundle.id.length > 0);
  add(
    "bundle id matches the id the caller asked for",
    typeof expectedId !== "string" || expectedId === bundle.id,
    typeof expectedId === "string" ? { expected: expectedId, found: bundle.id ?? null } : undefined,
  );

  const draft = isObject(bundle.graph) && typeof bundle.graph.aer === "string" ? bundle.graph.aer : null;
  if (draft === null) {
    notChecked.push({ scope: "handover draft", reason: "outside_scope", detail: "the bundle declares no graph.aer" });
  } else {
    add(
      "handover draft is one this build implements",
      SUPPORTED_HANDOVER_DRAFTS.includes(draft),
      { declared: draft, supported: SUPPORTED_HANDOVER_DRAFTS },
    );
  }

  const rawSteps = Array.isArray(bundle.steps) ? bundle.steps : [];
  add("bundle carries at least one step", rawSteps.length > 0, { steps: rawSteps.length });

  const steps = rawSteps.map((step, index) => verifyStep(step, index, add, notChecked));
  const receiptsOk = steps.length > 0 && steps.every((step) => step.outcome !== "verification_failed");

  const merkle = verifyMerkle(bundle, rawSteps, add);
  const workflowReceipt = verifyWorkflowReceipt(bundle, add, notChecked);

  const refused = Array.isArray(bundle.refused_receipt_ids) ? bundle.refused_receipt_ids : [];
  const stepIds = new Set(rawSteps.map((step) => step?.id));
  add(
    "refused receipt ids are not also counted as steps",
    refused.every((id) => !stepIds.has(id)),
    refused.length ? { refused } : undefined,
  );

  const declaredNotChecked = Array.isArray(bundle.not_checked) ? bundle.not_checked : [];
  add(
    "the issuer's not_checked list is preserved, not promoted",
    declaredNotChecked.every((entry) => typeof entry === "string"),
    declaredNotChecked.length ? { entries: declaredNotChecked.length } : undefined,
  );

  const failed = checks.filter((c) => !c.ok);
  const outcome = failed.length > 0 || !receiptsOk ? "verification_failed" : "verified";

  notEstablished.push(
    "issuer identity: the bundle publishes no pinned signing key",
    "outside timestamp: no independent time source is consulted",
    "result correctness: a matching digest says the record is unchanged, not that the work was right",
  );
  if (!workflowReceipt?.metadataHash?.present) {
    notEstablished.push("metadata_hash: the workflow-close receipt does not carry the schema-0.4 field");
  } else {
    notEstablished.push("metadata_hash coverage: the canonical block binds six string members; it does not authenticate the issuer");
  }
  if (typeof bundle.steps_digest === "string") {
    add(
      "steps_digest matches the published preimage rule (newline-joined receipt ids)",
      stepsDigestOf(bundle) === normalizeDigest(bundle.steps_digest),
      { declared: normalizeDigest(bundle.steps_digest), computed: stepsDigestOf(bundle) },
    );
    notEstablished.push("steps_digest coverage: receipt ids only, not output hashes, statuses or the Merkle root");
  }

  return finalize({
    observer,
    readAt,
    sourceUrl,
    bundleDigest,
    handover: {
      id: typeof bundle.id === "string" ? bundle.id : null,
      expectedId: typeof expectedId === "string" ? expectedId : null,
      draft,
      status: typeof bundle.status === "string" ? bundle.status : null,
      kind: typeof bundle.kind === "string" ? bundle.kind : null,
      recipientType: typeof bundle.recipient_type === "string" ? bundle.recipient_type : null,
      createdAt: typeof bundle.created_at === "string" ? bundle.created_at : null,
      stepCount: rawSteps.length,
      refusedReceiptIds: refused,
      declaredNotChecked,
    },
    outcome,
    coverage: {
      steps: rawSteps.length,
      receiptsVerified: steps.filter((s) => s.outcome !== "verification_failed").length,
      receiptsFailed: steps.filter((s) => s.outcome === "verification_failed").length,
      operationsNotChecked: steps.filter((s) => s.outcome === "not_checked").length,
      declaredNotChecked: declaredNotChecked.length,
    },
    steps,
    merkle,
    workflowReceipt,
    issuerClaims: {
      receiptChecks: isObject(bundle.receipt_checks) ? bundle.receipt_checks : null,
      notChecked: declaredNotChecked,
      notProven: Array.isArray(bundle.not_proven) ? bundle.not_proven : [],
      statusSemantics: typeof bundle.status_semantics === "string" ? bundle.status_semantics : null,
      note: "Issuer-reported; copied for comparison only. This observer does not inherit these claims.",
    },
    checks,
    notChecked,
    notEstablished,
  });
}

function verifyStep(step, index, add, notChecked) {
  const prefix = `step[${index + 1}]`;
  if (!isObject(step)) {
    add(`${prefix} is an object`, false);
    return { index: index + 1, receiptId: null, tool: null, status: null, outcome: "absent" };
  }

  const receiptId = typeof step.id === "string" ? step.id : null;
  const encoded = typeof step.canonical_bytes_base64 === "string" ? step.canonical_bytes_base64 : null;
  const textForm = typeof step.canonical_bytes === "string" ? step.canonical_bytes : null;
  const claimed = typeof step.output_hash === "string" ? step.output_hash : null;

  add(`${prefix} names a receipt id`, receiptId !== null);
  add(`${prefix} carries canonical_bytes_base64`, encoded !== null);
  add(`${prefix} carries the text form of the same bytes`, textForm !== null);

  let decoded = null;
  if (encoded !== null) {
    decoded = Buffer.from(encoded, "base64");
    add(`${prefix} base64 is canonical`, decoded.toString("base64") === encoded);
    add(`${prefix} text and base64 forms agree`, textForm === null || decoded.toString("utf8") === textForm);
    add(`${prefix} output_hash matches the decoded bytes`, claimed !== null && sha256(decoded) === claimed, {
      claimed,
      computed: sha256(decoded),
    });
  }

  let parsed = null;
  if (encoded !== null && claimed !== null) {
    parsed = parseAer1Record(
      { ...step, canonical_bytes: encoded },
      { expectedId: receiptId ?? undefined },
    );
    add(`${prefix} passes the AER-1 parser`, parsed.verdict === "pass", {
      code: parsed.code,
      failed: parsed.structure.filter((c) => !c.ok).map((c) => c.name),
    });
  }

  if (step.status !== "success") {
    notChecked.push({
      scope: `step[${index + 1}] receipt ${receiptId}`,
      reason: "not_attempted",
      detail: `recorded status is ${String(step.status)}; the receipt bytes verify, the operation did not complete`,
    });
  }

  // Two different questions, kept apart: did the receipt's bytes verify, and
  // did the operation the receipt records complete? A refused step's bytes can
  // verify while the step remains not_checked; calling that a failed receipt
  // would convict the record for an honest refusal it preserved.
  const bytesOk = parsed?.verdict === "pass";
  const completed = step.status === "success";
  const outcome = !bytesOk ? "verification_failed" : completed ? "verified" : "not_checked";
  return {
    index: index + 1,
    receiptId,
    tool: typeof step.tool === "string" ? step.tool : null,
    status: typeof step.status === "string" ? step.status : null,
    schema: typeof step.receipt_schema_version === "string" ? step.receipt_schema_version : null,
    provenanceClass: typeof step.provenance_class === "string" ? step.provenance_class : null,
    digest: { claimed, computed: encoded === null ? null : sha256(decoded), ok: claimed !== null && encoded !== null && sha256(decoded) === claimed },
    idBound: parsed?.id?.verdict === "matched",
    outcome,
  };
}

function verifyMerkle(bundle, rawSteps, add) {
  const declared = typeof bundle.merkle_version === "string" ? bundle.merkle_version : null;
  const root = typeof bundle.merkle_root === "string" ? bundle.merkle_root : null;
  if (declared === null || root === null) {
    add("bundle declares merkle_version and merkle_root", false);
    return { declared, root, computed: null, ok: false };
  }
  const mapped = rawSteps.map((step, index) => ({
    seq: index + 1,
    receipt_id: step?.id,
    output_hash: step?.output_hash,
  }));
  const result = verifyAer1WorkflowMerkle({
    steps: mapped,
    merkleRoot: root,
    merkleVersion: declared,
  });
  add("workflow Merkle root recomputes under the declared construction", result.ok, {
    declared,
    computed: result.computed,
    failed: result.checks.filter((c) => !c.ok).map((c) => c.name),
  });
  return { declared, root, computed: result.computed, ok: result.ok };
}

function verifyWorkflowReceipt(bundle, add, notChecked) {
  const receipt = isObject(bundle.workflow_receipt) ? bundle.workflow_receipt : null;
  if (receipt === null) {
    add("bundle carries a workflow-close receipt", false);
    return null;
  }
  const encoded = typeof receipt.canonical_bytes_base64 === "string" ? receipt.canonical_bytes_base64 : null;
  if (encoded === null) {
    add("workflow-close receipt carries canonical_bytes_base64", false);
    return null;
  }
  const parsed = parseAer1Record({ ...receipt, canonical_bytes: encoded }, { expectedId: receipt.id });
  add("workflow-close receipt passes the AER-1 parser", parsed.verdict === "pass", {
    code: parsed.code,
    failed: parsed.structure.filter((c) => !c.ok).map((c) => c.name),
  });
  const metadataHash = typeof receipt.metadata_hash === "string" ? receipt.metadata_hash : null;
  const metadataPresent = metadataHash !== null;
  const metadataFormatOk = metadataPresent && DIGEST_RE.test(metadataHash);
  add(
    "workflow-close receipt carries a schema-0.4 metadata_hash with the published format",
    metadataFormatOk,
    { present: metadataPresent, found: metadataHash },
  );
  const computedMetadataHash = metadataPresent ? metadataHashOf(receipt) : null;
  const metadataOk = metadataFormatOk && computedMetadataHash === metadataHash;
  if (metadataPresent) {
    add("workflow-close metadata_hash matches the canonical metadata block", metadataOk, {
      declared: metadataHash,
      computed: computedMetadataHash,
    });
  } else {
    notChecked.push({ scope: "workflow-close metadata_hash", reason: "not_attempted", detail: "field absent" });
  }
  return {
    id: typeof receipt.id === "string" ? receipt.id : null,
    schema: typeof receipt.receipt_schema_version === "string" ? receipt.receipt_schema_version : null,
    outcome: parsed.verdict === "pass" ? "verified" : "verification_failed",
    metadataHash: {
      present: metadataPresent,
      formatOk: metadataFormatOk,
      value: metadataHash,
      preimageChecked: metadataPresent,
      matched: metadataPresent ? metadataOk : null,
      computed: computedMetadataHash,
    },
  };
}

function finalize(fields) {
  const verdict = { observerVersion: OBSERVER_VERSION, ...fields };
  return Object.freeze({ ...verdict, verdictDigest: verdictDigest(verdict) });
}
