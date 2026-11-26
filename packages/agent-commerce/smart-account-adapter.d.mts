/**
 * Smart-account adapter (CG-W6/1-ADAPTER) — declaration surface.
 * Type-only. The runtime module is ./smart-account-adapter.mjs.
 * Boundary: no network, no signing, no deployment, no authorization decision.
 */

export declare const ADAPTER_SPEC: "CG-W6/1-ADAPTER";

export declare const ADAPTER_BOUNDARY: string;

export interface SmartAccountSigner {
  key: string;
  publicKey?: string;
  address?: string;
  kind?: string;
  weight: number | string;
}

export interface SmartAccountThresholds {
  low: number | string;
  medium: number | string;
  high: number | string;
}

export interface SorobanAuthSnapshot {
  entry: {
    contractId: string;
    functionName: string;
    argsDigest: string;
    signatureExpirationLedger: number | string;
    rootInvocation?: boolean;
    subInvocations?: Array<{ contractId: string; functionName: string }>;
  };
  expected: {
    contractId: string;
    functionName: string;
    argsDigest: string;
  };
  currentLedger: number | string;
  allowedContracts?: string[];
}

export interface SmartAccountSnapshot {
  network: "testnet" | "mainnet" | "futurenet" | string;
  accountId: string;
  masterWeight: number | string;
  thresholds: SmartAccountThresholds;
  signers: SmartAccountSigner[];
  presentedSigners?: Array<Pick<SmartAccountSigner, "key" | "publicKey" | "address"> & { weight?: number | string }>;
  soroban?: SorobanAuthSnapshot | null;
}

export interface SmartAccountToolCall {
  name:
    | "coreguard_verify_stellar_smart_account_signers"
    | "coreguard_verify_stellar_multisig_thresholds"
    | "coreguard_verify_stellar_soroban_auth_entry";
  arguments: Record<string, unknown>;
}

export interface SmartAccountAdapterInputs {
  signers: {
    account: {
      accountId: string;
      masterWeight: string;
      thresholds: { low: string; medium: string; high: string };
      signers: Array<{ key: string; kind: string; weight: string }>;
    };
  };
  thresholds: {
    evidence: {
      thresholds: { low: string; medium: string; high: string };
      presentSigners: Array<{ key: string; weight: string }>;
    };
    level: "LOW" | "MEDIUM" | "HIGH";
  };
  sorobanAuth: {
    entry: SorobanAuthSnapshot["entry"];
    expected: SorobanAuthSnapshot["expected"];
    currentLedger: string;
    policy?: { allowedContracts: string[] };
  } | null;
}

export type SmartAccountAdapterResult =
  | {
      ok: true;
      spec: "CG-W6/1-ADAPTER";
      boundary: string;
      network: string;
      accountId: string;
      snapshotDigest: string;
      inputs: SmartAccountAdapterInputs;
      toolCalls: SmartAccountToolCall[];
    }
  | {
      ok: false;
      spec: "CG-W6/1-ADAPTER";
      error: { code: string; detail: string; field?: string };
    };

export declare function fromSmartAccountSnapshot(
  snapshot: SmartAccountSnapshot,
  options?: { level?: "low" | "medium" | "high" | "LOW" | "MEDIUM" | "HIGH" },
): SmartAccountAdapterResult;

export default fromSmartAccountSnapshot;
