/**
 * CoreGuard Agent Commerce SDK (AC-SDK/1) — TypeScript declaration surface.
 *
 * A TYPE-ONLY façade over the committed runtime modules (`index.mjs`, `risk.mjs`).
 * Declaration surface for editors and downstream adopters; it adds no runtime
 * code, no trust assumption and no dependency. The CI lane `tsc --noEmit` over
 * this declaration surface (via `packages/agent-commerce/typecheck-smoke.ts`)
 * type-checks the declarations for real; the structural tests below pin the
 * declared names against the runtime exports on top of that.
 *
 * BOUNDARY (standing): execution verification never decides delivery conformity
 * (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected; every order
 * is synthetic; no contact with any commerce platform or payment network is
 * made or implied; this is a deterministic rule taxonomy,
 * never a probabilistic fraud score.
 */

// ---------------------------------------------------------------------------
// Facade constants
// ---------------------------------------------------------------------------

export const AGENT_COMMERCE_VERSION: "AC-SDK/1";
export const CONSENT_SPEC: "CGCR/1";

// ---------------------------------------------------------------------------
// CGCR/1 — consent record (the object returned by createConsent)
// ---------------------------------------------------------------------------

/** The approved order. Field names mirror the committed CGEP/1 intent shape. */
export interface ConsentIntent {
  version: string;
  chainId: string;
  signer: string;
  nonce: string;
  validAfter: string;
  validUntil: string;
  action: string;
  target: string;
  selector: string;
  asset: string;
  /** Approved total as an integer minor-unit string (never a float). */
  amount: string;
  recipient?: string;
  constraints?: Array<{ type: string; value?: string; addresses?: string[] }>;
  merchantName?: string;
  currency?: string;
  items?: Array<{ sku: string; name: string; qty: number; unitPriceMinor: string }>;
  /** Placeholder tokenized-credential reference — never a PAN, never a secret. */
  paymentCredentialRef?: string;
  agentRef?: string;
  authorizedAtUtc?: string;
  expiryUtc?: string;
  singleUse?: boolean;
  [key: string]: unknown;
}

/** The committed policy rules the approval ran under (CGEP/1 policy shape). */
export interface ConsentPolicy {
  version: string;
  policyId: string;
  name: string;
  rules: Array<{
    ruleId: string;
    type: string;
    params: Record<string, unknown>;
    severity: string;
  }>;
  [key: string]: unknown;
}

/** The exact submit-order payload the approval covers (declared execution shape). */
export interface DeclaredTrace {
  txHash: string;
  blockHash: string;
  blockNumber: number;
  blockTimestamp?: string;
  from?: string;
  to?: string;
  value?: string;
  calldata?: string;
  items?: Array<{ sku: string; name: string; qty: number; unitPriceMinor: string }>;
  paymentCredentialRef?: string;
  [key: string]: unknown;
}

/** A CGEP/1 receipt as embedded in the consent record (timestamp PINNED). */
export interface ConsentReceipt {
  receiptId: string;
  timestamp: string;
  chainId: string;
  txHash: string;
  intentHash: string;
  policyHash: string;
  executionTraceHash: string;
  stateDeltaHash: string;
  evidenceRoot: string;
  verificationLevel: string;
  result: string;
  [key: string]: unknown;
}

/** CGCR/1 consent record — the user's approval bound to the EXACT approved bytes. */
export interface ConsentRecord {
  spec: "CGCR/1";
  sdkVersion: "AC-SDK/1";
  receipt: ConsentReceipt;
  receiptId: string;
  intent: ConsentIntent;
  policy: ConsentPolicy;
  declaredTrace: DeclaredTrace;
}

// ---------------------------------------------------------------------------
// AGR/1 — the risk taxonomy (from ./risk.mjs)
// ---------------------------------------------------------------------------

export const AGR_VERSION: "AGR/1";

/** The eight named drift classes. Adding is additive; renaming is forbidden. */
export type AgrClass =
  | "RECIPIENT_SUBSTITUTION"
  | "VALUE_ESCALATION"
  | "ITEM_MUTATION"
  | "CREDENTIAL_SUBSTITUTION"
  | "EXPIRED_AUTHORIZATION"
  | "POLICY_VIOLATION"
  | "SINGLE_USE_REUSE"
  | "MALFORMED_EXECUTION";

export interface RiskViolation {
  code: AgrClass;
  severity: "CRITICAL" | "HIGH";
  field: string;
  expected?: string;
  observed?: string;
  detail?: string;
}

/** Deterministic report; `boundary` travels inside every report. */
export interface RiskReport {
  spec: "AGR/1";
  classification: "CLEAN" | "VIOLATIONS";
  violations: RiskViolation[];
  boundary: string;
}

/**
 * Deterministic authorization-drift taxonomy — never a probabilistic fraud
 * score, never a substitute for a payment network's fraud systems.
 */
export declare function assessRisk(input: {
  intent: ConsentIntent;
  policy?: ConsentPolicy;
  trace: DeclaredTrace;
  consumed?: boolean;
}): RiskReport;

export declare const RISK_CLASSES: Readonly<
  Record<AgrClass, { severity: "CRITICAL" | "HIGH"; description: string; fields: string[]; severityNote?: string }>
>;

// ---------------------------------------------------------------------------
// Facade functions (from ./index.mjs)
// ---------------------------------------------------------------------------

/** Name the drifted fields between the approved intent and the executed order. */
export declare function nameDrift(approvedIntent: ConsentIntent, executed: DeclaredTrace): string[];

/**
 * Create a consent record (CGCR/1): bind the approval to the exact approved
 * order bytes. `nowSeconds` is REQUIRED — the wall clock is never read.
 * Same inputs regenerate the record byte-identically.
 */
export declare function createConsent(input: {
  intent: ConsentIntent;
  policy: ConsentPolicy;
  declaredTrace: DeclaredTrace;
  nowSeconds: string | number;
}): Promise<ConsentRecord>;

/** Verifier outcome shape shared by the facade verdicts. */
export interface EngineVerification {
  result: string;
  checks: Array<{ name: string; result: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Verify the consent record itself (integrity + binding), fail-closed. */
export declare function verifyConsent(consent: ConsentRecord): Promise<EngineVerification>;

/** The fail-closed end-to-end verdict over one executed order. */
export interface ExecutionVerdict {
  spec: "AC-SDK/1";
  verdict: "VERIFIED" | "INVALID";
  engineVerdict: string;
  checks: EngineVerification["checks"];
  risk: RiskReport;
  driftNamed: string[];
  consumed: boolean;
  consumedLedger: string;
  boundary: string;
}

/**
 * Verify an executed order against a consent record — fail-closed end to end.
 * A `singleUse` consent is consumed by its FIRST verified execution; the
 * default ledger is process-local (durable single-use anchoring NOT_BUILT —
 * pass an external `consumedSet` for cross-session consumption control).
 */
export declare function verifyExecution(
  consent: ConsentRecord,
  trace: DeclaredTrace,
  options?: { consumedSet?: Set<string> },
): Promise<ExecutionVerdict>;

// ---------------------------------------------------------------------------
// CGXA/1 — cross-chain execution attestation (product 5, from ./attest.mjs)
// ---------------------------------------------------------------------------

/**
 * Product 5: attests a consent↔execution arc against a chain's COMMITTED
 * binding record. THERE IS NO BROADCAST SURFACE — a new anchor commit or a
 * Soroban call is owner-authorized only and is not code here. VERIFIED ≠
 * SAFE; an attestation of one environment is never bridge trust, never a
 * relay, and never delivery conformity (DDE/1); the actor is declared, never
 * detected; every demo order is synthetic; AGR/1 remains never a
 * probabilistic fraud score.
 */
export const CGXA_VERSION: "CGXA/1";

/** Frozen, versioned reject vocabulary — every REFUSED carries a named code; the verifier's own failure is VERIFIER_ERROR, never a leaked pass. */
export declare const CGXA_REJECT_CODES: readonly string[];

/** The committed-fact adapter registry (Core DAO anchor · Stellar anchor contract); a test pins every fact to the committed document that holds it. */
export declare const CGXA_ADAPTERS: readonly unknown[];

/** Mint the attestation deterministically (pinned clock required; wall clock never read). */
export declare function buildAttestation(args: { consent: unknown; executedTrace: unknown; adapterId: string; nowSeconds: number }): Promise<CgxaResult>;

/** Verify offline, fail-closed; consumes nothing and mutates nothing. */
export declare function verifyAttestation(args: { attestation: unknown; attestationId?: string; consent: unknown; executedTrace: unknown }): Promise<CgxaVerdict>;

export interface CgxaResult {
  spec: "CGXA/1";
  attestation: Record<string, unknown>;
  attestationId: string;
}

export interface CgxaVerdict {
  decision: "VERIFIED" | "REFUSED";
  code: string | null;
  reasons: string[];
}
