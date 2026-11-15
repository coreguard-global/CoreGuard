/**
 * Types for @coreguard/stellar — the Stellar adapter (STELLAR/1) plus the
 * PSAR/1 pre-sign receipt surface.
 *
 * Scope of this file, stated rather than implied: the adapter core and the
 * ENTIRE PSAR/1 surface are typed here. The five chain modules re-exported at
 * runtime (`freighter`, `mainnet`, `mainnet-executor`, `dex-gating`,
 * `soroban-dex`) are reachable through their own subpaths but are untyped in
 * 0.1.0 — importing them from the root gives you runtime values with no
 * declaration, which is honest about the gap instead of hiding it behind `any`.
 * Adapter functions return objects whose shapes are documented in the module
 * and on the wire; here they are `Record<string, unknown>` on purpose.
 */

export {
  PSAR_VERSION,
  PSAR_SCHEMA,
  PSAR_NETWORKS,
  RECEIPT_SCOPE,
  EXECUTION_PROOF_FIELD,
  DECISIONS,
  REJECT_CODES,
  canonicalJson,
  fingerprintXdr,
  normalizePolicy,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
  // Aliased exactly as index.mjs aliases them: this adapter has its own
  // status/selfCheck, and silently shadowing the receipt ones would be a bug.
  status as presignStatus,
  selfCheck as presignSelfCheck,
} from "./presign";

export type {
  AuthorizationClaims,
  AuthorizationReceipt,
  Decision,
  IssueInput,
  IssueResult,
  Issuer,
  Policy,
  PolicyNormalization,
  PresignStatus,
  PsarNetwork,
  RejectCode,
  SelfCheckResult,
  VerifyInput,
  VerifyResult,
} from "./presign";

export const STELLAR_VERSION: "STELLAR/1";

export const STELLAR_NETWORKS: Readonly<{
  TESTNET: "testnet";
  MAINNET: "mainnet";
  FUTURENET: "futurenet";
}>;

export const STELLAR_HORIZON: Readonly<{
  testnet: "https://horizon-testnet.stellar.org";
  mainnet: "https://horizon.stellar.org";
  futurenet: "https://horizon-futurenet.stellar.org";
}>;

export const STELLAR_STATES: readonly string[];

export interface HorizonRequest {
  network?: "testnet" | "mainnet" | "futurenet";
  path: string;
  timeoutMs?: number;
}

/** Read-only Horizon GET. Throws rather than returning a fabricated body. */
export function horizonFetch(options?: HorizonRequest): Promise<Record<string, unknown>>;

export function readAccount(options?: {
  network?: "testnet" | "mainnet" | "futurenet";
  accountId: string;
  timeoutMs?: number;
}): Promise<Record<string, unknown>>;

/** Builds an UNSIGNED payment intent. Never signs, never submits. */
export function buildPaymentIntent(options?: {
  source: string;
  destination: string;
  amount: string;
  asset?: string;
  memo?: string;
}): Record<string, unknown>;

/** Submits only through an injected settlement adapter; otherwise NOT_PERFORMED. */
export function submitTransaction(options?: {
  xdr: string;
  submitter?: unknown;
}): Promise<Record<string, unknown>>;

/** Honest status: DRY_RUN / NOT_BUILT until a real counterparty is observed. */
export function status(): Record<string, unknown>;

export function selfCheck(): { ok: boolean; status: Record<string, unknown> };
