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
  options?: { consumedSet?: { has(id: string): boolean; add(id: string): unknown } },
): Promise<ExecutionVerdict>;

// ---------------------------------------------------------------------------
// CGXA/1 — cross-chain execution attestation (product 5, from ./attest.mjs)
// ---------------------------------------------------------------------------

/**
 * Product 5: attests a consent↔execution arc against a chain's COMMITTED
 * binding record. Soroban consent-binding preparation is offline (invocation
 * payload only); THERE IS NO BROADCAST SURFACE — a commit_authorized call is
 * owner-authorized only and NOT_PERFORMED. VERIFIED ≠ SAFE; an attestation of
 * one environment is never bridge trust, never a relay, and never delivery
 * conformity (DDE/1); the actor is declared, never detected; every demo order
 * is synthetic; AGR/1 remains never a probabilistic fraud score.
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

// ---------------------------------------------------------------------------
// CGXA-SOROBAN/1 — Soroban consent-binding preparation (product 5 integration)
// ---------------------------------------------------------------------------

export const SOROBAN_AUTH_DOMAIN: "coreguard-anchor-auth/1";
export const SOROBAN_CONSENT_BINDING_VERSION: "CGXA-SOROBAN/1";

/** Derive the Soroban authorized-anchor id: sha256(utf8(AUTH_DOMAIN)+utf8(owner)+hash_bytes). */
export declare function deriveSorobanAuthorizedAnchorId(owner: string, hash: string): string;

/** Build offline Soroban commit_authorized invocation payload carrying the consent↔execution attestation (NO broadcast). */
export declare function buildSorobanConsentBinding(args: {
  consent: unknown;
  executedTrace?: unknown;
  owner: string;
  nowSeconds?: number;
  adapterId?: string;
  attestation?: unknown;
  attestationId?: string;
}): Promise<SorobanConsentBinding>;

export interface SorobanConsentBinding {
  spec: "CGXA-SOROBAN/1";
  adapterId: string;
  network: string;
  chainBinding: Record<string, string>;
  consentReceiptId: string;
  executedCommitment: string;
  attestationId: string;
  owner: string;
  commitHash: string;
  authorizedAnchorId: string;
  invocation: { contract: string; method: "commit_authorized"; args: { owner: string; hash: string } };
  broadcast: "OWNER-GATED / NOT_PERFORMED";
  boundary: string;
}

// ---------------------------------------------------------------------------
// AC-CS/1 — durable single-use consumption store (file-backed, Set-compatible)
// ---------------------------------------------------------------------------

export const CONSUMPTION_STORE_VERSION: "AC-CS/1";
export const CONSUMPTION_STORE_BOUNDARY: string;

/** File-backed Set-compatible consumption ledger (durable across process restarts on host; NOT distributed, NOT on-chain). */
export declare function createConsumptionStore(filePath: string): ConsumptionStore;
export declare function openConsumptionStore(filePath: string): Readonly<ConsumptionStoreView>;

export interface ConsumptionStore {
  spec: "AC-CS/1";
  filePath: string;
  boundary: string;
  has(id: string): boolean;
  add(id: string): ConsumptionStore;
  delete(id: string): boolean;
  clear(): void;
  readonly size: number;
  ids(): string[];
  toJSON(): { spec: "AC-CS/1"; ids: string[]; boundary: string };
  [Symbol.iterator](): Iterator<string>;
}

export interface ConsumptionStoreView {
  spec: "AC-CS/1";
  filePath: string;
  boundary: string;
  has(id: string): boolean;
  readonly size: number;
  ids(): string[];
}

// ---------------------------------------------------------------------------
// CG-OUT/1 — the outcome layer above the reject codes.
//
// Nothing here types a verdict as a boolean: `blocks` is not `!verified`, and
// ABSENT is not a failure. Five names, one result shape, no sixth value.
// ---------------------------------------------------------------------------

export type OutcomeName =
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "ABSENT"
  | "NOT_CHECKED"
  | "UNRESOLVABLE_RECORD";

export const OUTCOME_VERSION: "CG-OUT/1";
export const OUTCOMES: readonly OutcomeName[];
export const OUTCOME_CODES: Readonly<{
  ABSENT: "ABSENT";
  NOT_CHECKED: "NOT_CHECKED";
  UNRESOLVABLE_RECORD: "UNRESOLVABLE_RECORD";
}>;
export const NON_BLOCKING_OUTCOMES: readonly OutcomeName[];
export const BLOCKING_OUTCOMES: readonly OutcomeName[];

export interface RecordLayerFacts {
  evaluated?: boolean;
  ok?: boolean;
  code?: string | null;
  reason?: string | null;
  version?: string | null;
}

export interface AnchorLayerFacts {
  present?: boolean;
  evaluated?: boolean;
  outcome?: "verified" | "absent" | "not_checked" | "unresolvable" | string | null;
}

export interface OutcomeResult {
  outcome: OutcomeName;
  code: string | null;
  reason: string;
  layers: Readonly<{
    record: { evaluated: boolean; ok: boolean | null; code: string | null };
    anchor: { present: boolean; evaluated: boolean; outcome: string | null };
  }>;
  blocks: boolean;
  outcomeVersion: string;
  detail: unknown;
}

export declare function decideOutcome(facts?: {
  presented?: boolean;
  record?: RecordLayerFacts | null;
  anchor?: AnchorLayerFacts | null;
}): OutcomeResult;

export declare function assertNotRenderedAsBlock(outcome: OutcomeName): OutcomeName;

export declare function outcomeSelfCheck(): Readonly<{
  outcomeVersion: string;
  outcomes: readonly OutcomeName[];
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
  ok: boolean;
}>;

// ---------------------------------------------------------------------------
// CG-ID/1 — identity split: the record's name, kept apart from its bytes.
// ---------------------------------------------------------------------------

export const IDENTITY_VERSION: "CG-ID/1";
export const IDENTITY_SCHEMA: "coreguard.identity/1";
export const ANCHOR_KINDS: readonly ("chain" | "transparency-log" | "notary" | "mirror")[];

export interface AnchorReference {
  kind: "chain" | "transparency-log" | "notary" | "mirror";
  locator: string;
}

export interface SplitIdentity {
  identityVersion: string;
  schema: string;
  recordId: string;
  contentDigest: string;
  anchorRef: AnchorReference | null;
}

export declare function recordIdFor(args: { issuer: string; scope: string; subject: string }): string;

export declare function splitIdentity(args: {
  issuer: string;
  scope: string;
  subject: string;
  contentDigest: string;
  anchor?: AnchorReference | null;
}): SplitIdentity;

export declare function normalizeAnchor(anchor: AnchorReference): AnchorReference;

export declare function compareIdentities(
  a: Pick<SplitIdentity, "recordId" | "contentDigest">,
  b: Pick<SplitIdentity, "recordId" | "contentDigest">,
): Readonly<{ sameRecord: boolean; sameBytes: boolean; drifted: boolean; verdictHint: string }>;

export declare function anchorFacts(
  identity: Pick<SplitIdentity, "anchorRef">,
  options?: { resolved?: boolean | null },
): Readonly<{
  present: boolean;
  evaluated: boolean;
  outcome: "verified" | "absent" | "not_checked" | "unresolvable";
}>;

export declare function identitySelfCheck(): Readonly<{
  identityVersion: string;
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
  ok: boolean;
}>;

// ---------------------------------------------------------------------------
// CG-OUT/1 profile reference — the three fields a protocol would carry.
// ---------------------------------------------------------------------------

export const PROFILE_ID: "CG-OUT/1";
export const PROFILE_VERSION: 1;
export const PROFILE_REFERENCE_SCHEMA: "coreguard.profile-ref/1";
export const REFERENCE_FIELDS: readonly ["receipt_id", "profile", "profile_version"];

export interface ProfileReference {
  receipt_id: string;
  profile: "CG-OUT/1";
  profile_version: 1;
}

export declare function makeProfileReference(args: { receiptId: string }): ProfileReference;

export declare function parseProfileReference(input: unknown): {
  ok: boolean;
  reference: ProfileReference | null;
  error: string | null;
};

export declare function profileSelfCheck(): Readonly<{
  profile: string;
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
  ok: boolean;
}>;

// ---------------------------------------------------------------------------
// Bridges — the outcome layer as the surfaces actually print it.
// ---------------------------------------------------------------------------

export const BRIDGE_VERSION: "CG-OUT-BRIDGE/1";

export declare function outcomeForVerificationReport(report: unknown): OutcomeResult;

export declare function outcomeForPsarResult(
  result: { decision?: string; code?: string | null; reasons?: readonly string[] } | null,
  options?: { receipt?: unknown },
): OutcomeResult;

export declare function authorizationDecision(
  outcome: OutcomeResult | OutcomeName,
): Readonly<{ decision: "PASS" | "BLOCK" | "NONE"; reason: string | null }>;

export declare function profileReferenceFor(receiptId: string): ProfileReference;

// ---------------------------------------------------------------------------
// CG-AER1/1 — a parser for AER-1 receipts (draft-zambo-aer1-26). The committed
// payload and the receipt id are separate facts: the digest is recomputed, the
// id is bound only against an expected id or a resolved record that must agree
// on the digest.
// ---------------------------------------------------------------------------

export const AER1_PARSER_VERSION: "CG-AER1/1";
export const SUPPORTED_RECEIPT_SCHEMAS: readonly string[];

export interface Aer1Check {
  name: string;
  ok: boolean;
  detail?: unknown;
}

export interface Aer1Digest {
  claimed: string | null;
  computed: string | null;
  ok: boolean;
  byteLength: number | null;
  byteLengthClaimed: number | null;
}

export interface Aer1IdFacts {
  present: boolean;
  state: "unverified" | "verified-expected" | "verified-resolved" | "mismatch";
  verdict: "matched" | "mismatched" | "resolved" | "unverified" | "absent";
  expected: string | null;
  resolved: { id: string | null; digest: string | null } | null;
}

export interface Aer1Parsed {
  parserVersion: string;
  version: string | null;
  supportedVersion: boolean;
  structure: readonly Aer1Check[];
  structureOk: boolean;
  digest: Aer1Digest;
  id: Aer1IdFacts;
  verdict: "pass" | "fail";
  code: string | null;
}

/** Anchor facts in CG-OUT/1's vocabulary, as a caller measured them. */
export interface AnchorFacts {
  present?: boolean;
  evaluated?: boolean;
  outcome?: "verified" | "absent" | "not_checked" | "unresolvable" | string;
}

export declare function parseAer1Record(
  record: unknown,
  options?: { expectedId?: string; resolvedRecord?: unknown },
): Aer1Parsed;

export declare function aer1Outcome(parsed: Aer1Parsed, options?: { anchor?: AnchorFacts }): OutcomeResult;

export declare function aer1SelfCheck(): Readonly<{
  ok: boolean;
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
}>;

// ---------------------------------------------------------------------------
// CG-ANCHOR/1 — the anchor service we run: offline-verifiable attestations, an
// append-only hash-chained log, one Merkle root, and a prepare-only chain
// adapter that refuses mainnet. No broadcast path is declared because none
// exists.
// ---------------------------------------------------------------------------

export const ANCHOR_VERSION: "CG-ANCHOR/1";
export const ANCHOR_SCHEMA: "coreguard.anchor/1";

export interface AnchorSubject {
  kind: string;
  digest: string;
}

export interface AnchorAttestation {
  anchorVersion: string;
  schema: string;
  subject: AnchorSubject;
  sequence: number;
  previous: string | null;
  issuedAt: string;
  issuer: { keyId: string; publicKeyPem: string };
  signature: string;
}

export interface AnchorLog {
  anchorVersion: string;
  schema: string;
  entries: readonly AnchorAttestation[];
  root?: string;
}

export declare function normalizeSubject(subject: { kind: string; digest: string }): AnchorSubject;

export declare function generateIssuerKey(): Readonly<{ publicKeyPem: string; privateKeyPem: string }>;

export declare function keyIdFor(publicKeyPem: string): string;

export declare function signAttestation(args: {
  subject: { kind: string; digest: string };
  issuedAt: string;
  privateKeyPem: string;
  sequence?: number;
  previous?: string | null;
}): AnchorAttestation;

export declare function verifyAnchorAttestation(attestation: unknown): Readonly<{
  ok: boolean;
  checks: ReadonlyArray<{ name: string; ok: boolean }>;
}>;

export declare function leafHash(attestation: AnchorAttestation): string;

export declare function merkleRoot(leaves: readonly string[]): string;

export declare function createLog(): AnchorLog;

export declare function appendAnchor(
  log: AnchorLog,
  args: { subject: { kind: string; digest: string }; issuedAt: string; privateKeyPem: string },
): AnchorLog;

export declare function verifyLog(log: AnchorLog): Readonly<{
  ok: boolean;
  checks: ReadonlyArray<{ name: string; ok: boolean }>;
  root: string;
}>;

export declare function resolveAnchor(
  log: AnchorLog,
  digest: string,
): Readonly<{
  present: boolean;
  evaluated: boolean;
  outcome: "verified" | "absent" | "unresolvable";
  matches?: number;
  reason?: string;
}>;

export declare function prepareChainAnchor(
  log: AnchorLog,
  options?: { network?: string },
): Readonly<{
  ok: boolean;
  adapter?: string;
  network?: string;
  memoHashHex?: string;
  memoType?: string;
  broadcast?: boolean;
  root?: string;
  entries?: number;
  reason?: string;
  checks?: ReadonlyArray<{ name: string; ok: boolean }>;
}>;

export declare function anchorSelfCheck(): Readonly<{
  ok: boolean;
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
}>;

// ---------------------------------------------------------------------------
// CG-COMPOSE/1 — the anchor composition difference as a mode. `composed` lets
// an unresolvable anchor block the headline; `layered` keeps the record verdict
// fixed and reports the rejection on the anchor layer.
// ---------------------------------------------------------------------------

export const COMPOSITION_VERSION: "CG-COMPOSE/1";
export const COMPOSITION_MODES: readonly ["composed", "layered"];

export type CompositionMode = "composed" | "layered";

export interface CompositionResult {
  compositionVersion: string;
  mode: CompositionMode;
  headline: OutcomeName;
  record: Readonly<{ outcome: OutcomeName; moved: boolean }>;
  anchor: Readonly<{ present: boolean; evaluated: boolean; outcome: string; rejected: string | null }>;
  blocks: boolean;
  resolutionSensitive: boolean;
  code: string | null;
  reason: string | null;
  layers: unknown;
}

export declare function composeOutcome(input?: {
  presented?: boolean;
  record?: unknown;
  anchor?: AnchorFacts;
  mode?: CompositionMode;
}): CompositionResult;

export declare function compareModes(input?: {
  presented?: boolean;
  record?: unknown;
  anchor?: AnchorFacts;
}): Readonly<{
  compositionVersion: string;
  composed: CompositionResult;
  layered: CompositionResult;
  diverges: boolean;
  recordStable: boolean;
}>;

export declare function compositionSelfCheck(): Readonly<{
  ok: boolean;
  checks: ReadonlyArray<{ name: string; pass: boolean }>;
}>;

// ---------------------------------------------------------------------------
// CG-REF/1 — from `receipt_id` to bytes, with the four answers kept apart:
// resolved, absent, unresolvable, tampered. A name alone proves nothing.
// ---------------------------------------------------------------------------

export const REFERENCE_VERSION: "CG-REF/1";
export const REFERENCE_SCHEMA: "coreguard.reference/1";
export const ID_FORMS: readonly ["urn-sha256", "url", "opaque"];

export interface ReceiptIdFacts {
  form: "urn-sha256" | "url" | "opaque";
  receiptId: string;
  digest: string | null;
  contentAddressed: boolean;
}

export interface ResolutionStep {
  tier: "inline" | "registry" | "locator";
  proves: string;
  possible: boolean;
  candidates?: readonly string[];
}

export interface ResolutionPlan {
  refVersion: string;
  idForm: string;
  contentAddressed: boolean;
  idDigest: string | null;
  steps: readonly ResolutionStep[];
  strongestPossible: "resolved-by-content" | "resolved-by-expectation";
}

export interface ResolutionResult {
  refVersion: string;
  schema: string;
  receiptId: string;
  idForm: string;
  source: "inline" | "registry" | "locator" | null;
  state: "resolved" | "resolved-unchecked" | "absent" | "unresolvable" | "tampered";
  digest: string | null;
  expectedDigest: string | null;
  bytes: string | null;
  size: number;
  checks: readonly { name: string; ok: boolean }[];
  tried: readonly { tier: string; ok: boolean; url?: string; reason?: string; status?: number | null }[];
  reason: string | null;
}

export declare function digestOf(bytes: string | Uint8Array): string;
export declare function classifyReceiptId(receiptId: string): ReceiptIdFacts;
export declare function deriveLocatorCandidates(input: { receiptId: string; issuerOrigin?: string; path?: string }): readonly string[];
export declare function planResolution(input: { receiptId: string; issuerOrigin?: string }): ResolutionPlan;
export declare function resolveReceipt(input: {
  reference: { receiptId: string; profile?: string; issuerOrigin?: string };
  inline?: { bytes: string | Uint8Array; digest?: string } | null;
  registry?: ((id: string) => { bytes: string | Uint8Array; digest?: string } | null) | Map<string, { bytes: string | Uint8Array; digest?: string }> | null;
  expectedDigest?: string | null;
  fetchImpl?: ((url: string, init: { signal: AbortSignal; maxBytes: number }) => Promise<{ url?: string; status?: number; bytes?: string; digest?: string }>) | null;
  maxBytes?: number;
  timeoutMs?: number;
  allowInsecureLoopback?: boolean;
}): Promise<ResolutionResult>;
export declare function resolutionOutcome(resolution: ResolutionResult): Readonly<{
  outcome: OutcomeName;
  blocks: boolean;
  state: string;
  reason: string | null;
  source: string | null;
  digest: string | null;
}>;
export declare function referenceSelfCheck(): Readonly<{ ok: boolean; checks: ReadonlyArray<{ name: string; pass: boolean }> }>;

// ---------------------------------------------------------------------------
// CG-KEYS/1 — pinned trust roots, signed rotation chains, time-aware revocations.
// ---------------------------------------------------------------------------

export const KEYS_VERSION: "CG-KEYS/1";
export const KEYS_SCHEMA: "coreguard.keyring/1";
export const KEY_STATUSES: readonly ["trusted", "rotated", "revoked", "expired", "not-yet-valid", "unknown"];

export interface PinnedKey {
  keyId: string;
  publicKeyPem: string;
  issuer: string | null;
  notBefore: string | null;
  notAfter: string | null;
}

export interface Keyring {
  keysVersion: string;
  schema: string;
  id: string;
  pinned: readonly PinnedKey[];
  rotations: readonly Record<string, unknown>[];
  revocations: readonly Record<string, unknown>[];
}

export interface KeyStatus {
  keyId: string;
  status: "trusted" | "rotated" | "revoked" | "expired" | "not-yet-valid" | "unknown";
  trustedAtTime: boolean;
  acceptsNew: boolean;
  at: string;
  reason: string | null;
  issuer?: string | null;
  chainFrom?: string | null;
  depth?: number;
  rotatedTo?: string | null;
}

export declare function createKeyring(input?: { id?: string }): Keyring;
export declare function pinKey(keyring: Keyring, input: { publicKeyPem: string; issuer?: string | null; notBefore?: string | null; notAfter?: string | null }): Keyring;
export declare function rotateKey(keyring: Keyring, input: { privateKeyPem: string; newPublicKeyPem: string; at: string; overlapUntil: string }): Keyring;
export declare function revokeKey(keyring: Keyring, input: { privateKeyPem: string; keyId: string; at: string; retroactive?: boolean; reason?: string | null }): Keyring;
export declare function checkKey(keyring: Keyring, input: { keyId: string; at: string }): KeyStatus;
export declare function verifyWithTrust(attestation: AnchorAttestation, keyring: Keyring): Readonly<{
  ok: boolean;
  keyStatus: string;
  outcome: OutcomeName;
  acceptsNew: boolean;
  reason: string | null;
  checks: readonly { name: string; ok: boolean }[];
  signatureOk: boolean;
  chain: { from: string; depth: number | null } | null;
}>;
export declare function keysSelfCheck(): Readonly<{ ok: boolean; checks: ReadonlyArray<{ name: string; pass: boolean }> }>;

// ---------------------------------------------------------------------------
// CG-SPEND/1 — single use that survives a restart, a second worker and a second
// system; disagreement between logs is a named conflict, not a duplicate.
// ---------------------------------------------------------------------------

export const SPEND_VERSION: "CG-SPEND/1";
export const SPEND_SCHEMA: "coreguard.spend/1";
export const SPEND_STATES: readonly ["unspent", "spent", "conflict", "busy", "unreadable"];

export interface SpendEntry {
  spendVersion: string;
  schema: string;
  type: "spend";
  receiptDigest: string;
  approvalNonce: string;
  spendKey: string;
  at: string;
  orderRef: string | null;
  issuer: { keyId: string; publicKeyPem: string };
  signature: string;
}

export interface SpendLog {
  spendVersion: string;
  schema: string;
  path: string | null;
  entries: readonly SpendEntry[];
}

export interface SpendVerdict {
  state: "unspent" | "spent" | "conflict" | "busy" | "unreadable";
  reason: string | null;
  matches: number;
  sources: number;
  entries?: readonly SpendEntry[];
}

export declare function spendKeyFor(input: { receiptDigest: string; approvalNonce: string }): string;
export declare function createSpendLog(input?: { path?: string | null }): SpendLog;
export declare function makeSpendEntry(input: { receiptDigest: string; approvalNonce: string; at: string; orderRef?: string | null; privateKeyPem: string }): SpendEntry;
export declare function verifySpendEntry(entry: unknown): Readonly<{ ok: boolean; checks: readonly { name: string; ok: boolean }[] }>;
export declare function checkSpent(
  logs: SpendLog | readonly SpendLog[] | readonly SpendEntry[] | readonly unknown[],
  input: { receiptDigest: string; approvalNonce: string },
): SpendVerdict;
export declare function readSpendLog(path: string): SpendLog;
export declare function claimSpend(input: {
  path: string;
  receiptDigest: string;
  approvalNonce: string;
  at: string;
  orderRef?: string | null;
  privateKeyPem: string;
  timeoutMs?: number;
}): Readonly<{ ok: boolean; state: string; reason: string | null; entry: SpendEntry | null; entries: readonly SpendEntry[] }>;
export declare function mergeLogs(logs: readonly unknown[]): Readonly<{
  spendVersion: string;
  entries: readonly SpendEntry[];
  uniqueSpends: number;
  conflicts: readonly { receiptDigest: string; nonces: readonly string[]; entries: readonly SpendEntry[] }[];
}>;
export declare function spendSelfCheck(): Readonly<{ ok: boolean; checks: ReadonlyArray<{ name: string; pass: boolean }> }>;

// ---------------------------------------------------------------------------
// CG-DECIDE/1 — outcome to authorisation. Only a failed check may decline;
// missing evidence is an allow that says so, never a silent pass.
// ---------------------------------------------------------------------------

export const DECISION_VERSION: "CG-DECIDE/1";
export const DECISION_SCHEMA: "coreguard.decision/1";
export const DECISIONS: readonly ["ALLOW", "ALLOW_UNVERIFIED", "HOLD", "DECLINE"];
export const POLICIES: readonly ["strict", "balanced", "availability"];

export interface PaymentDecision {
  decisionVersion: string;
  schema: string;
  decision: "ALLOW" | "ALLOW_UNVERIFIED" | "HOLD" | "DECLINE";
  outcome: OutcomeName;
  policy: "strict" | "balanced" | "availability";
  code: string | null;
  reason: string | null;
  unverified: boolean;
  verified: boolean;
  blocks: boolean;
  captureAllowed: boolean;
  retry: boolean;
  explain: string;
}

export declare function decidePayment(input: { outcome: OutcomeName; policy?: "strict" | "balanced" | "availability" }): PaymentDecision;
export declare function explainDecision(input: { decision: PaymentDecision["decision"]; outcome: OutcomeName; policy: string }): string;
export declare function decisionMatrix(): readonly PaymentDecision[];
export declare function assertDecisionInvariants(): Readonly<{ ok: boolean; violations: readonly string[]; rows: number }>;
export declare function decisionSelfCheck(): Readonly<{ ok: boolean; checks: ReadonlyArray<{ name: string; pass: boolean }> }>;
