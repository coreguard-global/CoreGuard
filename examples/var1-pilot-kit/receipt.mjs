/**
 * The VAR/1 receipt this kit issues — a record plus a signed statement about
 * its bytes.
 *
 * Two things are kept apart on purpose:
 *
 *   body         what the merchant says happened, as canonical bytes
 *   attestation  CG-ANCHOR/1's signed statement that those exact bytes existed
 *                at a time, carrying its own public key so it verifies offline
 *
 * The receipt id is the sha256 of the canonical envelope, so the name is the
 * bytes and nothing else. The attestation's subject digest is the sha256 of the
 * body alone, so a verifier can check the signature and the body binding
 * without trusting the id or whoever served the file.
 */

import { digestOf, canonicalBytes, sha256Hex, fieldDrift, lineTotal } from "./lib.mjs";
import { signAttestation, verifyAttestation } from "../../packages/agent-commerce/anchor.mjs";
import { verifyWithTrust } from "../../packages/agent-commerce/trust.mjs";

export const RECEIPT_SCHEMA = "coreguard.var1.receipt/1";
export const RECEIPT_PROFILE = "VAR/1";

/** Build the signed envelope. `at` is the caller's clock, never read here. */
export function buildReceipt({ merchant, approved, approvalNonce, executed, at, privateKeyPem }) {
  if (!merchant || typeof merchant.id !== "string") throw new TypeError("merchant.id is required");
  if (!approved || typeof approved !== "object") throw new TypeError("approved intent is required");
  if (typeof approvalNonce !== "string" || approvalNonce.length === 0) throw new TypeError("approvalNonce is required");
  if (!executed || typeof executed !== "object") throw new TypeError("executed order is required");
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) throw new TypeError("at must be an ISO-8601 timestamp");

  const body = {
    schema: RECEIPT_SCHEMA,
    profile: RECEIPT_PROFILE,
    issued_at: at,
    merchant: { id: merchant.id, name: merchant.name ?? merchant.id },
    approval: {
      intent: approved,
      intent_digest: digestOf(approved),
      approval_nonce: approvalNonce,
    },
    execution: executed,
  };

  const attestation = signAttestation({
    subject: { kind: "var1-receipt", digest: digestOf(body) },
    issuedAt: at,
    privateKeyPem,
  });

  const bytes = canonicalBytes({ body, attestation });
  return Object.freeze({
    body,
    attestation,
    bytes,
    receiptId: "urn:sha256:" + sha256Hex(Buffer.from(bytes, "utf8")),
    bodyDigest: digestOf(body),
  });
}

/**
 * Verify a fetched receipt against the intent the verifier already holds and a
 * keyring it already trusts.
 *
 * The verifier's copy of the approved intent is the authority. The receipt's
 * copy is evidence: if the receipt names a different intent, that is a failed
 * binding, not a different order.
 */
export function inspectReceipt({ bytes, expectedIntent, keyring }) {
  const checks = [];
  const add = (name, ok, detail = null) => checks.push(detail === null ? { name, ok } : { name, ok, detail });

  let parsed = null;
  try {
    parsed = JSON.parse(bytes);
    add("the fetched bytes parse as JSON", true);
  } catch (err) {
    add("the fetched bytes parse as JSON", false, err?.message ?? String(err));
    return finish({ checks, drift: [], parsed: null, trust: null, signatureOk: false, outcome: "VERIFICATION_FAILED" });
  }

  const body = parsed?.body;
  const attestation = parsed?.attestation;
  add(`schema is ${RECEIPT_SCHEMA}`, body?.schema === RECEIPT_SCHEMA);
  add("profile is VAR/1", body?.profile === RECEIPT_PROFILE);

  let bodyDigest = null;
  try {
    bodyDigest = digestOf(body);
    add("the body has canonical bytes", true);
  } catch (err) {
    add("the body has canonical bytes", false, err?.message ?? String(err));
  }
  add(
    "the attestation's subject is the receipt body",
    bodyDigest !== null && attestation?.subject?.digest === bodyDigest,
    { attested: attestation?.subject?.digest ?? null, computed: bodyDigest },
  );

  const sig = verifyAttestation(attestation);
  add("the attestation signature verifies over canonical JSON", sig.ok);

  let internalIntentOk = false;
  try {
    internalIntentOk = digestOf(body?.approval?.intent) === body?.approval?.intent_digest;
  } catch {
    internalIntentOk = false;
  }
  add("the receipt's own intent matches its digest", internalIntentOk);
  add("issued_at equals the attestation time", body?.issued_at === attestation?.issuedAt, {
    body: body?.issued_at ?? null,
    attestation: attestation?.issuedAt ?? null,
  });

  let trust = null;
  if (keyring) {
    trust = verifyWithTrust(attestation, keyring);
    add(`the issuer key is trusted at issuedAt (${trust.keyStatus})`, trust.ok, {
      keyStatus: trust.keyStatus,
      keyId: attestation?.issuer?.keyId ?? null,
    });
  } else {
    add("a keyring was supplied", false, "no pin, no opinion");
  }

  const expectedDigest = expectedIntent ? digestOf(expectedIntent) : null;
  const namedDigest = body?.approval?.intent_digest ?? null;
  add(
    "the receipt names the intent the verifier holds",
    expectedDigest !== null && namedDigest === expectedDigest,
    { verifier: expectedDigest, receipt: namedDigest },
  );

  const drift = expectedIntent ? fieldDrift(expectedIntent, body?.execution) : [];
  add("executed fields equal the approved fields", drift.length === 0, drift.length > 0 ? drift : null);

  const sum = lineTotal(body?.execution?.items);
  add("the executed total equals the sum of its lines", body?.execution?.total_minor === sum, {
    total_minor: body?.execution?.total_minor ?? null,
    line_sum: sum,
  });

  let outcome;
  if (
    !body ||
    body?.schema !== RECEIPT_SCHEMA ||
    attestation?.subject?.digest !== bodyDigest ||
    !sig.ok ||
    !internalIntentOk ||
    body?.issued_at !== attestation?.issuedAt
  ) {
    outcome = "VERIFICATION_FAILED";
  } else if (!trust || !trust.ok) {
    // Unknown key is NOT_CHECKED, not forged; a revoked/rotated key is a
    // failure of the trust question, which verifyWithTrust already named.
    outcome = trust?.outcome ?? "NOT_CHECKED";
  } else if (namedDigest !== expectedDigest || drift.length > 0 || body?.execution?.total_minor !== sum) {
    outcome = "VERIFICATION_FAILED";
  } else {
    outcome = "VERIFIED";
  }

  return finish({ checks, drift, parsed, trust, signatureOk: sig.ok, outcome });
}

function finish({ checks, drift, parsed, trust, signatureOk, outcome }) {
  return Object.freeze({
    ok: outcome === "VERIFIED",
    outcome,
    checks: Object.freeze(checks),
    drift: Object.freeze(drift),
    parsed,
    trust,
    signatureOk,
    keyStatus: trust?.keyStatus ?? "unknown",
  });
}
