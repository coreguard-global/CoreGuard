/**
 * Types for @coreguard/stellar/presign — PSAR/1 pre-sign authorization receipts.
 *
 * These declarations describe the module as it behaves, not as it might
 * eventually behave: `verifyAuthorizationReceipt` always returns a decision,
 * `executionProof` is always the literal "NOT_INCLUDED" (a pre-sign receipt
 * never proves execution), and `code` is null exactly when the decision is PASS.
 */

/** Networks a receipt can name; aligned with what a Freighter wallet reports. */
export type PsarNetwork = "TESTNET" | "PUBLIC" | "FUTURENET" | "SANDBOX";

/** Two-valued on purpose: there is no soft pass. */
export type Decision = "PASS" | "BLOCK";

/** Policy values are strings — amounts never travel as floats. */
export type Policy = Record<string, string>;

/** The frozen fail-closed vocabulary; a new code lands with its own test. */
export type RejectCode =
  | "MALFORMED_RECEIPT"
  | "MALFORMED_INPUT"
  | "BAD_DIGEST"
  | "BAD_SIGNATURE"
  | "ISSUER_MISMATCH"
  | "XDR_BINDING_MISMATCH"
  | "NETWORK_MISMATCH"
  | "POLICY_MISMATCH"
  | "NOT_YET_VALID"
  | "RECEIPT_EXPIRED"
  | "VERIFIER_ERROR";

export const PSAR_VERSION: "PSAR/1";
export const PSAR_SCHEMA: "coreguard.psar/1";
export const RECEIPT_SCOPE: "PRE_SIGN_AUTHORIZATION";
export const EXECUTION_PROOF_FIELD: "NOT_INCLUDED";
export const PSAR_NETWORKS: readonly PsarNetwork[];
export const DECISIONS: readonly Decision[];
export const REJECT_CODES: readonly RejectCode[];

/** Sorted-key, whitespace-free canonical JSON — byte-deterministic. */
export function canonicalJson(value: unknown): string;

/** sha256 over the EXACT envelope string the caller will hand to a wallet. */
export function fingerprintXdr(xdr: string): string;

export interface PolicyNormalization {
  ok: boolean;
  policy: Policy | null;
  error: string | null;
}

export function normalizePolicy(policy: unknown): PolicyNormalization;

/**
 * DEMO/DEV-only issuer for the offline demo and tests. It exposes a `sign`
 * closure, never the private key, and never touches transaction material.
 * In production the issuer is a verification service the owner runs.
 */
export interface Issuer {
  readonly publicKeyHex: string;
  readonly algorithm: "Ed25519";
  readonly demoOnly: true;
  sign(bytes: Uint8Array): string;
}

export function createInMemoryIssuer(options?: { seedHex?: string }): Issuer;

/** The eight ADR fields that are digested and signed. */
export interface AuthorizationClaims {
  v: string;
  scope: string;
  network: PsarNetwork;
  xdrFingerprint: string;
  policy: Policy;
  issuedAt: number;
  expiresAt: number;
  issuer: string;
}

/** What is handed to a verifier: the claims plus digest and signature. */
export interface AuthorizationReceipt extends AuthorizationClaims {
  digest: string;
  signature: string;
}

export interface IssueInput {
  network: PsarNetwork;
  xdr: string;
  policy: Policy;
  issuer: Issuer;
  /** Injected clock; the module never reads Date. */
  nowSeconds: number;
  ttlSeconds?: number;
}

export interface IssueResult {
  ok: boolean;
  error: string | null;
  receipt: AuthorizationReceipt | null;
  digest?: string;
  adr?: AuthorizationClaims;
}

export function issueAuthorizationReceipt(input?: IssueInput): IssueResult;

export interface VerifyInput {
  receipt: unknown;
  xdr: string;
  network: PsarNetwork;
  policy: unknown;
  nowSeconds: number;
  /** The pinned issuer key: 64-char hex, or an object carrying it. */
  issuerPublicKey: string | { publicKeyHex: string };
}

export interface VerifyResult {
  decision: Decision;
  code: RejectCode | null;
  reasons: string[];
  executionProof: "NOT_INCLUDED";
  checkedAtSeconds: number | null;
  receiptId: string | null;
}

export function verifyAuthorizationReceipt(input?: VerifyInput): VerifyResult;

export interface PresignStatus {
  version: string;
  schema: string;
  scope: string;
  runMode: "OFFLINE_PROTOTYPE";
  integrationStatus: "NOT_BUILT";
  networks: PsarNetwork[];
  proves: string;
  doesNotProve: string;
  failClosed: string;
  signerBoundary: string;
  executed: false;
  receiptCaptured: false;
}

export function status(): PresignStatus;

export interface SelfCheckResult {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean }>;
}

/** The full issue → verify → tamper → expire cycle, in memory. */
export function selfCheck(): SelfCheckResult;
