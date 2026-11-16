/**
 * CoreGuard Agent Commerce SDK (AC-SDK/1) — the product façade over CGEP/1.
 *
 * One surface for the agent-commerce question — "did the executed order match
 * what the user approved?" — composed entirely from the repo's committed
 * machinery (canonical · evidence · verifier · policy). No new hashing
 * domains, no new trust assumptions, no network, no keys, no wall clock.
 *
 * The consent model (CGCR/1 — CoreGuard Consent Receipt):
 *   APPROVE    the user's approval is bound as a CGEP/1 receipt to the EXACT
 *              canonical bytes of the approved order (intent + policy + the
 *              declared submit payload). Anyone holding the consent record can
 *              re-derive the binding (L2 evidence set, timestamp pinned).
 *   EXECUTE    the actual executed order payload is verified against that
 *              binding: exact → VERIFIED; any byte of drift → INVALID,
 *              fail-closed, with the drifted field named (AGR/1 classes).
 *   TAMPER     any byte of the stored consent record itself → commitment
 *              mismatch, INVALID.
 *
 * Consumption semantics (single-use): the default ledger is process-local and
 * DOCUMENTED as such. A file-backed Set-compatible store adapter (AC-CS/1,
 * `createConsumptionStore`) is provided for durable cross-process anchoring on
 * the same host via the existing `consumedSet` injection — it is NOT a
 * distributed ledger and NOT an on-chain marker. An on-chain single-use
 * consumption marker remains OWNER-GATED / NOT_BUILT. A fresh process without a
 * shared ledger cannot see a previous consumption; nothing here hides that.
 *
 * BOUNDARY (standing): execution verification never decides delivery
 * conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected;
 * every order in demos/examples is synthetic.
 */

import { hashIntent, hashPolicy, hashTrace, computeReceiptId, hashStateDelta } from "@coreguard/canonical";
import { createEvidenceBundle, createReceipt } from "@coreguard/evidence";
import { verifyReceipt } from "@coreguard/verifier";
import { assessRisk, AGR_VERSION } from "./risk.mjs";

export { assessRisk, AGR_VERSION };

// AC-CS/1 — durable single-use consumption store adapter (file-backed,
// Set-compatible; cross-process on host). NOT a distributed ledger, NOT an
// on-chain marker (on-chain anchoring OWNER-GATED / NOT_BUILT).
export {
  CONSUMPTION_STORE_VERSION,
  CONSUMPTION_STORE_BOUNDARY,
  createConsumptionStore,
  openConsumptionStore,
} from "./consumption-store.mjs";

// CGXA/1 — cross-chain execution attestation (product 5): the offline
// attestation surface over committed chain facts. Soroban consent-binding
// preparation is offline (invocation payload only); NO broadcast capability is
// exported because none exists in the module (see attest.mjs header).
export {
  CGXA_VERSION,
  CGXA_REJECT_CODES,
  CGXA_ADAPTERS,
  buildAttestation,
  verifyAttestation,
  SOROBAN_AUTH_DOMAIN,
  SOROBAN_CONSENT_BINDING_VERSION,
  deriveSorobanAuthorizedAnchorId,
  buildSorobanConsentBinding,
} from "./attest.mjs";

export const AGENT_COMMERCE_VERSION = "AC-SDK/1";
export const CONSENT_SPEC = "CGCR/1";

// Synthetic state-delta constant for offline consent records: there is no
// on-chain state to pin at approval time, and CGEP/1's L2 evidence set needs a
// commitment — the constant is fixed, deterministic and documented (never a
// claim about chain state).
const OFFLINE_STATE_DELTA = "0x" + "11".repeat(32);

/** Process-local consumption ledger for single-use consents. */
const processConsumed = new Set();

function requireConsent(consent) {
  if (!consent || consent.spec !== CONSENT_SPEC || !consent.receipt || !consent.intent || !consent.policy || !consent.declaredTrace) {
    throw new Error(`AC-SDK/1: not a ${CONSENT_SPEC} consent record`);
  }
}

/**
 * Name the drifted fields between the approved intent and the executed order —
 * the human-readable face of a fail-closed verdict.
 */
export function nameDrift(approvedIntent, executed) {
  const diffs = [];
  if (executed.value !== undefined && String(executed.value) !== String(approvedIntent.amount)) {
    diffs.push(`total: approved ${approvedIntent.amount} -> executed ${executed.value}`);
  }
  const approvedPayee = approvedIntent.recipient ?? approvedIntent.target;
  if (executed.to !== undefined && approvedPayee && String(executed.to).toLowerCase() !== String(approvedPayee).toLowerCase()) {
    diffs.push(`payee: approved ${approvedPayee} -> executed ${executed.to}`);
  }
  if (
    executed.paymentCredentialRef !== undefined &&
    approvedIntent.paymentCredentialRef !== undefined &&
    String(executed.paymentCredentialRef) !== String(approvedIntent.paymentCredentialRef)
  ) {
    diffs.push("payment credential reference changed after approval");
  }
  if (
    executed.items !== undefined &&
    approvedIntent.items !== undefined &&
    JSON.stringify(executed.items) !== JSON.stringify(approvedIntent.items)
  ) {
    diffs.push("cart items changed after approval");
  }
  return diffs;
}

/**
 * Create a consent record (CGCR/1): the user's approval bound to the exact
 * approved bytes, as a CGEP/1 receipt with a PINNED timestamp.
 *
 * `nowSeconds` is REQUIRED — the wall clock is never read here (the C40 rule:
 * every input to a byte-equality claim is pinned, including time). Re-running
 * with the same inputs regenerates the receipt byte-identically.
 *
 * `declaredTrace` is the exact submit-order payload the approval covers (the
 * platform's declared execution shape: payee, total, items, credential ref).
 * The consent binds THAT; an execution deviating from it fails closed.
 */
export async function createConsent({ intent, policy, declaredTrace, nowSeconds }) {
  if (!intent || !policy || !declaredTrace) {
    throw new Error("AC-SDK/1: createConsent requires intent, policy and declaredTrace");
  }
  if (nowSeconds === undefined || nowSeconds === null) {
    throw new Error("AC-SDK/1: createConsent requires a pinned nowSeconds — the wall clock is never read");
  }

  const intentHash = await hashIntent(intent);
  const policyHash = await hashPolicy(policy);
  const traceHash = await hashTrace(declaredTrace);
  const stateDeltaHash = await hashStateDelta({ synthetic: "offline-consent", value: OFFLINE_STATE_DELTA });

  const evidence = await createEvidenceBundle({
    intentHash,
    policyHash,
    traceHash,
    stateDeltaHash,
    result: "VALID",
    verifications: [{ level: "L2", engine: "coreguard-agent-commerce" }],
    simulation: { blockNumber: String(declaredTrace.blockNumber ?? 0), blockHash: declaredTrace.blockHash ?? "0x" },
    execution: { blockNumber: String(declaredTrace.blockNumber ?? 0), blockHash: declaredTrace.blockHash ?? "0x" },
  });

  const { receiptId, receipt } = await createReceipt({
    chainId: intent.chainId ?? "0",
    txHash: declaredTrace.txHash,
    blockHash: declaredTrace.blockHash,
    blockNumber: declaredTrace.blockNumber,
    intentHash,
    policyHash,
    executionTraceHash: traceHash,
    stateDeltaHash: evidence.evidence.stateDeltaHash,
    evidenceRoot: evidence.hash,
    simulation: { blockNumber: String(declaredTrace.blockNumber ?? 0), blockHash: declaredTrace.blockHash ?? "0x" },
    execution: { blockNumber: String(declaredTrace.blockNumber ?? 0), blockHash: declaredTrace.blockHash ?? "0x" },
    verifierVersion: "0.1.0",
    verificationLevel: "L2",
    result: "VALID",
    checks: [],
  });

  // Pin the receipt timestamp to the approval epoch and recompute the
  // commitment over the pinned payload (the shared createReceipt embeds a
  // wall-clock second; the consent binds its own pinned time instead).
  const pinned = { ...receipt, timestamp: String(nowSeconds) };
  const pinnedId = await computeReceiptId(pinned);

  return {
    spec: CONSENT_SPEC,
    sdkVersion: AGENT_COMMERCE_VERSION,
    receipt: { ...pinned, receiptId: pinnedId },
    receiptId: pinnedId,
    intent,
    policy,
    declaredTrace,
  };
}

/**
 * Verify the consent record itself (integrity + binding): recomputes every
 * hash against the record's own approved bytes. Tampering with ANY byte of
 * the stored record fails the commitment.
 */
export async function verifyConsent(consent) {
  requireConsent(consent);
  const verification = await verifyReceipt(consent.receipt, null, consent.intent, consent.policy, consent.declaredTrace);
  return verification;
}

/**
 * Verify an executed order against a consent record — fail-closed end to end.
 *
 * Semantics:
 *  - the CGEP/1 verifier re-derives every commitment (exact bytes → PASS; any
 *    drift → FAIL with the check named);
 *  - the AGR/1 taxonomy classifies the drift by named class + severity;
 *  - a single-use consent is consumed by its FIRST verified execution
 *    (default ledger process-local; pass a shared `consumedSet`, e.g. an
 *    AC-CS/1 store, for cross-process anchoring on host — on-chain marker
 *    OWNER-GATED / NOT_BUILT);
 *  - the verdict is VERIFIED only when the verifier verdict is VERIFIED, no
 *    taxonomy violation exists, and no consumption rule fires.
 *
 * `consumedSet` (optional) injects an external consumption ledger; the
 * default is this process's own.
 */
export async function verifyExecution(consent, trace, { consumedSet } = {}) {
  requireConsent(consent);
  const ledger = consumedSet ?? processConsumed;
  const alreadyConsumed = ledger.has(consent.receiptId);

  const verification = await verifyReceipt(consent.receipt, null, consent.intent, consent.policy, trace);
  const risk = assessRisk({ intent: consent.intent, policy: consent.policy, trace, consumed: alreadyConsumed });

  const hardFail = verification.checks.some((c) => c.result === "FAIL");
  const drift = nameDrift(consent.intent, trace);
  const verified = verification.result === "VERIFIED" && !hardFail && risk.classification === "CLEAN";

  if (verified && consent.intent.singleUse) ledger.add(consent.receiptId);

  return {
    spec: AGENT_COMMERCE_VERSION,
    verdict: verified ? "VERIFIED" : "INVALID",
    engineVerdict: verification.result,
    checks: verification.checks,
    risk,
    driftNamed: drift,
    consumed: alreadyConsumed || verified,
    consumedLedger: "process-local (durable single-use anchoring NOT_BUILT)",
    boundary:
      "execution verification never decides delivery conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected",
  };
}
