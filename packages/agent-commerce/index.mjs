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

// CG-OUT/1 — the outcome layer above the reject codes: five outcomes over
// three layers, with ABSENT and NOT_CHECKED structurally unable to travel as a
// block. The bridges map what the existing surfaces already print onto it, and
// `authorizationDecision` is the one function that turns a vocabulary into
// behaviour (absent and not-checked yield NONE, never PASS and never BLOCK).
export {
  OUTCOME_VERSION,
  OUTCOMES,
  OUTCOME_CODES,
  NON_BLOCKING_OUTCOMES,
  BLOCKING_OUTCOMES,
  decideOutcome,
  assertNotRenderedAsBlock,
  selfCheck as outcomeSelfCheck,
} from "./outcomes.mjs";

// CG-ID/1 — identity split: recordId (who the record is) kept apart from
// contentDigest (what these bytes are) so an anchorRef can ride alongside.
export {
  IDENTITY_VERSION,
  IDENTITY_SCHEMA,
  ANCHOR_KINDS,
  recordIdFor,
  splitIdentity,
  normalizeAnchor,
  compareIdentities,
  anchorFacts,
  selfCheck as identitySelfCheck,
} from "./identity.mjs";

// CG-OUT/1 profile reference — the three fields a protocol would carry
// (receipt_id, profile, profile_version), with the version checked on arrival.
export {
  PROFILE_ID,
  PROFILE_VERSION,
  PROFILE_REFERENCE_SCHEMA,
  REFERENCE_FIELDS,
  makeProfileReference,
  parseProfileReference,
  selfCheck as profileSelfCheck,
} from "./profile-ref.mjs";

export {
  BRIDGE_VERSION,
  outcomeForVerificationReport,
  outcomeForPsarResult,
  authorizationDecision,
  profileReferenceFor,
} from "./outcomes-bridge.mjs";

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
  // Ledger reads/writes are awaited so an asynchronous adapter (a shared or
  // remote consumption store) is a first-class injection. A plain Set still
  // works unchanged: awaiting a non-promise is the value itself.
  const alreadyConsumed = (await ledger.has(consent.receiptId)) === true;

  const verification = await verifyReceipt(consent.receipt, null, consent.intent, consent.policy, trace);
  const risk = assessRisk({ intent: consent.intent, policy: consent.policy, trace, consumed: alreadyConsumed });

  const hardFail = verification.checks.some((c) => c.result === "FAIL");
  const drift = nameDrift(consent.intent, trace);
  const verified = verification.result === "VERIFIED" && !hardFail && risk.classification === "CLEAN";

  if (verified && consent.intent.singleUse) await ledger.add(consent.receiptId);

  return {
    spec: AGENT_COMMERCE_VERSION,
    verdict: verified ? "VERIFIED" : "INVALID",
    engineVerdict: verification.result,
    checks: verification.checks,
    risk,
    driftNamed: drift,
    consumed: alreadyConsumed || verified,
    consumedLedger: consumedSet
      ? "caller-supplied ledger — process-local Set, AC-CS/1 file store (cross-process on this host), or an asynchronous shared store; a global register and on-chain anchoring are NOT_BUILT"
      : "process-local — pass an AC-CS/1 store for cross-process anchoring on this host; cross-host reconciliation is CG-SPEND/1; a global register and on-chain anchoring are NOT_BUILT",
    boundary:
      "execution verification never decides delivery conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected",
  };
}

// CG-AER1/1 — a parser for AER-1 (draft-zambo-aer1-26) receipts. The committed
// payload and the receipt id are kept apart, because the format keeps them
// apart: the digest is recomputed, the id is bound only against something
// external (an expected id, or a resolved record that must agree on the digest).
export {
  AER1_PARSER_VERSION,
  SUPPORTED_RECEIPT_SCHEMAS,
  parseAer1Record,
  aer1Outcome,
  selfCheck as aer1SelfCheck,
} from "./aer1.mjs";

// CG-OBS/1 — the observation ledger: a verification is an event, not a property
// of the run. One immutable record per (observer, read), carrying who looked,
// what access they held, which bytes they recomputed, when they read, and why a
// check did not happen. A later read adds evidence; it never rewrites the
// earlier one, and it never replays the action.
export {
  OBSERVATION_VERSION,
  CHECK_OUTCOMES,
  NOT_CHECKED_REASONS,
  OBSERVATION_CODES,
  parseInstant,
  observationId,
  recordObservation,
  createLedger,
  appendObservation,
  buildLedger,
  accrue as accrueObservations,
  describeAccrual,
  selfCheck as observationsSelfCheck,
} from "./observations.mjs";

// CG-ANCHOR/1 — the anchor service we run ourselves: Ed25519 attestations that
// verify offline, an append-only hash-chained log, one Merkle root over it, and
// a chain adapter that prepares a 32-byte memo and refuses mainnet by name.
// No broadcast path exists in the module.
export {
  ANCHOR_VERSION,
  ANCHOR_SCHEMA,
  normalizeSubject,
  generateIssuerKey,
  keyIdFor,
  signAttestation,
  verifyAttestation as verifyAnchorAttestation,
  leafHash,
  merkleRoot,
  createLog,
  appendAnchor,
  verifyLog,
  resolveAnchor,
  prepareChainAnchor,
  selfCheck as anchorSelfCheck,
} from "./anchor.mjs";

// CG-COMPOSE/1 — one composition rule, two defensible answers. "composed"
// lets an unresolvable anchor block the headline (best for a commerce consumer
// that needs one answer now); "layered" keeps the record verdict fixed and
// reports the rejection on the anchor layer (best for a record that outlives
// any single anchor). The difference is a mode, not an argument.
export {
  COMPOSITION_VERSION,
  COMPOSITION_MODES,
  composeOutcome,
  compareModes,
  selfCheck as compositionSelfCheck,
} from "./composition.mjs";

// CG-REF/1 — the procedure behind a receipt_id. A name proves nothing on its
// own: resolution produces bytes, the bytes are hashed against an expectation,
// and "no expectation" is unresolvable rather than resolved.
export {
  REFERENCE_VERSION,
  REFERENCE_SCHEMA,
  ID_FORMS,
  digestOf,
  classifyReceiptId,
  deriveLocatorCandidates,
  planResolution,
  resolveReceipt,
  resolutionOutcome,
  selfCheck as referenceSelfCheck,
} from "./reference.mjs";

// CG-KEYS/1 — pinned trust, signed rotation chains and time-aware revocation.
// An unknown key is NOT_CHECKED, never forged; retroactive revocation is a
// distinct statement from a routine retirement.
export {
  KEYS_VERSION,
  KEYS_SCHEMA,
  KEY_STATUSES,
  createKeyring,
  pinKey,
  rotateKey,
  revokeKey,
  checkKey,
  verifyWithTrust,
  selfCheck as keysSelfCheck,
} from "./trust.mjs";

// CG-SPEND/1 — single use as an append-only, signed, lock-guarded log rather
// than a process-local boolean. Two systems that spent the same approval under
// different nonces produce a `conflict`, which is the only honest way to say
// "both of us thought we were first".
export {
  SPEND_VERSION,
  SPEND_SCHEMA,
  SPEND_STATES,
  spendKeyFor,
  createSpendLog,
  makeSpendEntry,
  verifySpendEntry,
  checkSpent,
  readSpendLog,
  claimSpend,
  mergeLogs,
  selfCheck as spendSelfCheck,
} from "./spend.mjs";

// CG-DECIDE/1 — outcome to authorisation. Four decisions, not two, so missing
// evidence can neither decline a sale nor masquerade as a pass.
export {
  DECISION_VERSION,
  DECISION_SCHEMA,
  DECISIONS,
  POLICIES,
  decidePayment,
  explainDecision,
  decisionMatrix,
  assertDecisionInvariants,
  selfCheck as decisionSelfCheck,
} from "./decision.mjs";

// CGCP/1 — self-hosted Policy & Evidence Control Plane: versioned policies,
// approvals, spend windows, execution/verification ledgers, revocation, a
// hash-chained audit trail, an authenticated HTTP API and a CLI. Single host,
// single API key; multi-tenant RBAC/SSO, distributed HA and KMS are NOT_BUILT.
export {
  CONTROL_PLANE_VERSION,
  CONTROL_PLANE_SCHEMA,
  CONTROL_PLANE_BOUNDARY,
  CONTROL_PLANE_DECISION_REASONS,
  createControlPlane,
  verifyAuditChain,
} from "./control-plane.mjs";

export {
  createControlPlaneHandler,
  createControlPlaneServer,
  startControlPlaneServer,
} from "./control-plane-http.mjs";

// CG-ME/1 - Machine Economy Wave 1: deterministic offline x402/machine/delegation
// verification and evidence records. No custody, no broadcast, no network calls;
// physical-world truth/signature trust roots NOT proven here. VERIFIED != SAFE.
export {
  MACHINE_ECONOMY_VERSION,
  MACHINE_ECONOMY_BOUNDARY,
  parseX402Challenge,
  authorizeX402Payment,
  verifyX402Settlement,
  reconcilePayment,
  meterAgentUsage,
  registerMachine,
  createMachineTask,
  verifyTelemetry,
  verifyTaskCompletion,
  verifyDelegationChain,
  machineEconomySelfCheck,
} from "./machine-economy.mjs";

// CGCP/1 MCP Wave 2 mapping tools (file-backed single-host control plane).
export {
  CGCP_MCP_BOUNDARY,
  createIntent,
  issueReceipt,
  verifyReceipt as verifyCgcpReceipt,
  checkLimits,
  revokeConsent,
  auditTransaction,
} from "./cgcp-mcp-tools.mjs";
