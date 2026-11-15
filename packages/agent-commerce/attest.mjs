/**
 * CGXA/1 — Cross-Chain Execution Attestation (product 5).
 *
 * One verifiable statement — "this executed order corresponds to the
 * authorization bound in consent record C, and the chain binding it cites is
 * the chain's committed record" — re-derived offline from committed machinery
 * alone. The record binds:
 *
 *   consentReceiptId      the CGCR/1 consent the execution is attested against
 *   executedCommitment    the CGEP/1 trace-domain hash of the EXECUTED trace —
 *                         the same domain verifyExecution re-derives, so an
 *                         attestation is only mintable for an arc that the
 *                         family's own verifier would call exact
 *   adapter + chainBinding   the target chain's binding record, byte-exact
 *                         against the frozen ADAPTERS registry, whose facts
 *                         are the COMMITTED on-chain truths cited by name in
 *                         the repo's own documents (a test pins each fact to
 *                         the document that holds it)
 *   verificationLevel     COMMITTED_EVIDENCE — the record cites committed
 *                         chain truth; it never cites a broadcast this module
 *                         performed
 *
 * THERE IS NO BROADCAST SURFACE HERE — no signing, no submitting, no network,
 * no keys, no wall clock. A fresh anchor commit or a Soroban call is a NEW
 * on-chain transaction: by repo rule that is owner-authorized only, and this
 * module does not contain the code to attempt it. The adapter verifies
 * committed facts; it never performs anything.
 *
 * Consumption semantics: verifyAttestation is an attestation VIEW — it never
 * consumes a consent (single-use consumption stays in verifyExecution's
 * ledger) and it mutates nothing.
 *
 * BOUNDARY (standing): execution verification never decides delivery
 * conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected;
 * an attestation of one environment is not bridge trust or a relay claim.
 */

import { domainHash, hashTrace } from "@coreguard/canonical";

export const CGXA_VERSION = "CGXA/1";

export const CONSENT_SPEC = "CGCR/1";

/**
 * Fail-closed reason codes. Every non-verified path lands here by name, and
 * an error inside the verifier itself is a code too — never an exception
 * leaking a pass. The vocabulary is frozen and versioned: a new code lands
 * with its own negative test in the same push.
 */
export const CGXA_REJECT_CODES = Object.freeze([
  "MALFORMED_ATTESTATION",
  "ADAPTER_UNKNOWN",
  "CHAIN_BINDING_MISMATCH",
  "LEVEL_MISMATCH",
  "CONSENT_MISMATCH",
  "EXECUTION_MISMATCH",
  "TIME_INVALID",
  "ID_MISMATCH",
  "VERIFIER_ERROR",
]);

export const VERIFICATION_LEVELS = Object.freeze(["COMMITTED_EVIDENCE"]);

/**
 * The adapter registry: the chains this surface can attest AGAINST, each
 * carrying only facts that are already committed on-chain truth in this repo
 * (recorded, owner-authorized executions), with the document that holds each
 * fact named in `source`. A test pins every fact literal to its cited
 * document, so the registry cannot drift from the repo's own evidence.
 *
 * No adapter carries a broadcast capability — see the header.
 */
export const CGXA_ADAPTERS = Object.freeze([
  Object.freeze({
    id: "core-dao-anchor",
    network: "core-dao-mainnet-1116",
    binding: Object.freeze({
      chainId: "1116",
      anchor: "0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E",
    }),
    source: "docs/DEPLOYMENT.md",
    note: "LIVE/RECORDED per docs/DEPLOYMENT.md — a NEW anchor commit for a consent receipt is owner-authorized only and is NOT code here",
  }),
  Object.freeze({
    id: "stellar-anchor",
    network: "stellar-mainnet",
    binding: Object.freeze({
      anchorContract: "CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP",
    }),
    source: "docs/EVIDENCE-MATRIX.md",
    note: "EXECUTED deploy + first commit INVOKED per docs/EVIDENCE-MATRIX.md — carrying a consent binding into the Soroban lane is integration NOT_BUILT and is NOT code here",
  }),
]);

const ATTESTATION_FIELDS = Object.freeze([
  "v",
  "consentReceiptId",
  "executedCommitment",
  "adapter",
  "chainBinding",
  "verificationLevel",
  "issuedAtSeconds",
]);

const ADAPTER_FIELDS = Object.freeze(["id", "network"]);
const HEX64 = /^[0-9a-f]{64}$/;

function adapterById(id) {
  return CGXA_ADAPTERS.find((a) => a.id === id) ?? null;
}

function isNonNegativeInt(n) {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

function requireConsent(consent) {
  if (!consent || consent.spec !== CONSENT_SPEC || !consent.receiptId || typeof consent.receiptId !== "string") {
    const err = new Error(`CGXA/1: not a ${CONSENT_SPEC} consent record`);
    err.code = "CONSENT_MISMATCH";
    throw err;
  }
}

/**
 * Mint the attestation record. Deterministic: the same consent, executed
 * trace, adapter and pinned clock regenerate the record byte-identically.
 *
 * `nowSeconds` is REQUIRED — the wall clock is never read (the C40 rule:
 * every input to a byte-equality claim is pinned, including time).
 */
export async function buildAttestation({ consent, executedTrace, adapterId, nowSeconds }) {
  requireConsent(consent);
  if (!executedTrace || typeof executedTrace !== "object" || Array.isArray(executedTrace)) {
    const err = new Error("CGXA/1: buildAttestation requires an executed trace object");
    err.code = "MALFORMED_ATTESTATION";
    throw err;
  }
  const adapter = adapterById(adapterId);
  if (!adapter) {
    const err = new Error(`CGXA/1: unknown adapter id ${JSON.stringify(adapterId)}`);
    err.code = "ADAPTER_UNKNOWN";
    throw err;
  }
  if (!isNonNegativeInt(nowSeconds)) {
    const err = new Error("CGXA/1: buildAttestation requires a pinned non-negative-integer nowSeconds — the wall clock is never read");
    err.code = "TIME_INVALID";
    throw err;
  }

  const executedCommitment = await hashTrace(executedTrace);

  const attestation = Object.freeze({
    v: CGXA_VERSION,
    consentReceiptId: consent.receiptId,
    executedCommitment,
    adapter: Object.freeze({ id: adapter.id, network: adapter.network }),
    chainBinding: Object.freeze({ ...adapter.binding }),
    verificationLevel: "COMMITTED_EVIDENCE",
    issuedAtSeconds: nowSeconds,
  });

  const attestationId = await domainHash("CGXA/1:RECORD", attestation);

  return {
    spec: CGXA_VERSION,
    attestation,
    attestationId,
  };
}

/**
 * Verify an attestation offline — fail-closed end to end.
 *
 * Re-derives everything: the adapter facts byte-exact against the frozen
 * registry, the executed commitment against the executed trace handed in,
 * the consent id against the consent handed in, the level against the frozen
 * vocabulary, and (when `attestationId` is supplied) the record id against a
 * fresh recomputation. Any mismatch REFUSES with a named code; an error
 * inside the verifier itself REFUSES with VERIFIER_ERROR — never an
 * exception leaking a pass. Consumes nothing.
 */
export async function verifyAttestation({ attestation, attestationId, consent, executedTrace }) {
  try {
    if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) {
      return refused("MALFORMED_ATTESTATION", "attestation is not a record object");
    }
    const fields = Object.keys(attestation).sort();
    if (fields.join(",") !== [...ATTESTATION_FIELDS].sort().join(",")) {
      return refused("MALFORMED_ATTESTATION", `field set must be exactly ${ATTESTATION_FIELDS.join(", ")}`);
    }
    if (attestation.v !== CGXA_VERSION) {
      return refused("MALFORMED_ATTESTATION", `v must be ${CGXA_VERSION}`);
    }
    if (typeof attestation.consentReceiptId !== "string" || !attestation.consentReceiptId) {
      return refused("MALFORMED_ATTESTATION", "consentReceiptId must be a non-empty string");
    }
    if (typeof attestation.executedCommitment !== "string" || !HEX64.test(attestation.executedCommitment.slice(2))) {
      return refused("MALFORMED_ATTESTATION", "executedCommitment must be a 0x + 64-hex digest");
    }
    if (!attestation.adapter || typeof attestation.adapter !== "object") {
      return refused("MALFORMED_ATTESTATION", "adapter must be a record");
    }
    if (Object.keys(attestation.adapter).sort().join(",") !== [...ADAPTER_FIELDS].sort().join(",")) {
      return refused("MALFORMED_ATTESTATION", "adapter fields must be exactly id, network");
    }
    if (!isNonNegativeInt(attestation.issuedAtSeconds)) {
      return refused("TIME_INVALID", "issuedAtSeconds must be a non-negative integer");
    }
    if (!VERIFICATION_LEVELS.includes(attestation.verificationLevel)) {
      return refused("LEVEL_MISMATCH", `verificationLevel must be one of ${VERIFICATION_LEVELS.join(", ")}`);
    }

    const adapter = adapterById(attestation.adapter.id);
    if (!adapter) {
      return refused("ADAPTER_UNKNOWN", `no committed adapter with id ${JSON.stringify(attestation.adapter.id)}`);
    }
    if (attestation.adapter.network !== adapter.network) {
      return refused("CHAIN_BINDING_MISMATCH", `network drift: registry ${adapter.network} vs record ${attestation.adapter.network}`);
    }
    const registryKeys = Object.keys(adapter.binding).sort();
    const recordKeys = Object.keys(attestation.chainBinding ?? {}).sort();
    if (registryKeys.join(",") !== recordKeys.join(",")) {
      return refused("CHAIN_BINDING_MISMATCH", `binding fields must be exactly ${registryKeys.join(", ")}`);
    }
    for (const k of registryKeys) {
      if (attestation.chainBinding[k] !== adapter.binding[k]) {
        return refused("CHAIN_BINDING_MISMATCH", `binding fact ${k} drift: registry ${JSON.stringify(adapter.binding[k])} vs record ${JSON.stringify(attestation.chainBinding[k])}`);
      }
    }

    requireConsent(consent);
    if (attestation.consentReceiptId !== consent.receiptId) {
      return refused("CONSENT_MISMATCH", `consent receiptId ${JSON.stringify(consent.receiptId)} does not match the attested ${JSON.stringify(attestation.consentReceiptId)}`);
    }
    if (!executedTrace || typeof executedTrace !== "object" || Array.isArray(executedTrace)) {
      return refused("EXECUTION_MISMATCH", "executed trace is not a record object");
    }
    const recomputedCommitment = await hashTrace(executedTrace);
    if (recomputedCommitment !== attestation.executedCommitment) {
      return refused("EXECUTION_MISMATCH", `executed trace does not re-derive the attested commitment (approved-domain hash drift)`);
    }

    if (attestationId !== undefined) {
      if (typeof attestationId !== "string") {
        return refused("ID_MISMATCH", "attestationId must be a string when supplied");
      }
      const recomputedId = await domainHash("CGXA/1:RECORD", attestation);
      if (recomputedId !== attestationId) {
        return refused("ID_MISMATCH", `attestation id does not re-derive from the record bytes`);
      }
    }

    return {
      decision: "VERIFIED",
      code: null,
      reasons: [],
      attested: {
        adapterId: adapter.id,
        network: adapter.network,
        verificationLevel: attestation.verificationLevel,
        source: adapter.source,
      },
      boundary:
        "attests that this arc's committed chain binding is the record the adapter cites; never bridge trust, never a relay, never delivery conformity (DDE/1); VERIFIED ≠ SAFE",
    };
  } catch (err) {
    // The fail-closed guarantee is "always a REFUSED", never an exception
    // escaping the verifier (the same discipline as the PSAR/1 BLOCK path).
    const code = err && typeof err.code === "string" && CGXA_REJECT_CODES.includes(err.code) ? err.code : "VERIFIER_ERROR";
    return refused(code, `verifier refused: ${err && err.message ? err.message : "unknown error"}`);
  }
}

function refused(code, reason) {
  if (!CGXA_REJECT_CODES.includes(code)) code = "VERIFIER_ERROR";
  return {
    decision: "REFUSED",
    code,
    reasons: [`${code}: ${reason}`],
    boundary:
      "fail-closed: verification failure is never a pass; the verifier's own failure is a named code too",
  };
}
