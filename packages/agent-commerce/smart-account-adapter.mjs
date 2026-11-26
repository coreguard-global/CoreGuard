/**
 * Smart-account adapter (CG-W6/1-ADAPTER).
 *
 * Maps a caller-supplied account snapshot into the exact argument objects of
 * three CG-W6/1 tools:
 *
 *   coreguard_verify_stellar_smart_account_signers
 *   coreguard_verify_stellar_multisig_thresholds
 *   coreguard_verify_stellar_soroban_auth_entry
 *
 * Boundary: this module never reads the network, never signs, never deploys and
 * never decides authorization. It only reshapes evidence the caller already
 * has, sorts it deterministically and digests it so a tamper is visible.
 * VERIFIED ≠ SAFE.
 */

import { canonicalJson, digestOf } from "./wave6.mjs";

export const ADAPTER_SPEC = "CG-W6/1-ADAPTER";

export const ADAPTER_BOUNDARY =
  "maps a caller-supplied account snapshot into CG-W6/1 tool arguments; no network, no signing, no deployment, no authorization decision; VERIFIED ≠ SAFE";

const NETWORKS = new Set(["testnet", "mainnet", "futurenet"]);

const refuse = (code, detail, field) => ({
  ok: false,
  spec: ADAPTER_SPEC,
  error: { code, detail, ...(field ? { field } : {}) },
});

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const int = (v) => {
  if (typeof v === "number" && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^-?[0-9]+$/.test(v.trim())) return BigInt(v.trim());
  if (typeof v === "bigint") return v;
  return null;
};
const keyOf = (k) => String(k);

/**
 * @param {object} snapshot caller-supplied account snapshot
 * @param {{ level?: "low"|"medium"|"high"|"LOW"|"MEDIUM"|"HIGH" }} [options]
 * @returns {{ok: true, spec, network, accountId, snapshotDigest, inputs, toolCalls} |
 *           {ok: false, spec, error: {code, detail, field?}}}
 */
export function fromSmartAccountSnapshot(snapshot, options = {}) {
  if (!isObj(snapshot)) return refuse("INVALID_SNAPSHOT", "snapshot must be an object", "snapshot");

  const network = str(snapshot.network).toLowerCase();
  if (!NETWORKS.has(network)) {
    return refuse("UNSUPPORTED_NETWORK", "network must be testnet, mainnet or futurenet", "network");
  }

  const accountId = str(snapshot.accountId);
  if (!accountId) return refuse("MISSING_ACCOUNT_ID", "accountId is required", "accountId");

  const masterWeight = int(snapshot.masterWeight);
  if (masterWeight === null || masterWeight < 0n) {
    return refuse("INVALID_MASTER_WEIGHT", "masterWeight must be a non-negative integer", "masterWeight");
  }

  const t = isObj(snapshot.thresholds) ? snapshot.thresholds : null;
  const low = t ? int(t.low) : null;
  const medium = t ? int(t.medium) : null;
  const high = t ? int(t.high) : null;
  if (low === null || medium === null || high === null || low < 0n || medium < 0n || high < 0n) {
    return refuse("INVALID_THRESHOLDS", "thresholds.low/medium/high must be non-negative integers", "thresholds");
  }
  if (!(medium >= low && high >= medium && high > 0n)) {
    return refuse("THRESHOLD_ORDER", "thresholds must satisfy low <= medium <= high and high > 0", "thresholds");
  }

  if (!Array.isArray(snapshot.signers) || snapshot.signers.length === 0) {
    return refuse("NO_SIGNERS", "signers must be a non-empty array", "signers");
  }

  const signers = [];
  for (const [i, s] of snapshot.signers.entries()) {
    if (!isObj(s)) return refuse("INVALID_SIGNER", `signers[${i}] must be an object`, `signers[${i}]`);
    const key = str(s.key) || str(s.publicKey) || str(s.address);
    if (!key) return refuse("MISSING_SIGNER_KEY", `signers[${i}] needs key, publicKey or address`, `signers[${i}].key`);
    const weight = int(s.weight);
    if (weight === null || weight < 0n) {
      return refuse("INVALID_WEIGHT", `signers[${i}].weight must be a non-negative integer`, `signers[${i}].weight`);
    }
    signers.push({
      key,
      kind: (str(s.kind) || "ed25519").toUpperCase(),
      weight: weight.toString(),
    });
  }

  signers.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i = 1; i < signers.length; i += 1) {
    if (signers[i].key === signers[i - 1].key) {
      return refuse("DUPLICATE_SIGNER", `signer ${signers[i].key} appears more than once`, "signers");
    }
  }

  const byKey = new Map(signers.map((s) => [s.key, s]));
  const presentedRaw = snapshot.presentedSigners === undefined ? signers : snapshot.presentedSigners;
  if (!Array.isArray(presentedRaw)) {
    return refuse("INVALID_PRESENTED_SIGNERS", "presentedSigners must be an array when supplied", "presentedSigners");
  }
  const presented = [];
  for (const [i, p] of presentedRaw.entries()) {
    if (!isObj(p)) return refuse("INVALID_PRESENTED_SIGNER", `presentedSigners[${i}] must be an object`, `presentedSigners[${i}]`);
    const key = str(p.key) || str(p.publicKey) || str(p.address);
    const known = byKey.get(key);
    if (!known) {
      return refuse("UNKNOWN_PRESENTED_SIGNER", `presented signer ${key || `#${i}`} is not in the account signer set`, `presentedSigners[${i}]`);
    }
    const weight = p.weight === undefined ? BigInt(known.weight) : int(p.weight);
    if (weight === null || weight < 0n) {
      return refuse("INVALID_WEIGHT", `presentedSigners[${i}].weight must be a non-negative integer`, `presentedSigners[${i}].weight`);
    }
    presented.push({ key, weight: weight.toString() });
  }
  presented.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const account = {
    accountId,
    masterWeight: masterWeight.toString(),
    thresholds: { low: low.toString(), medium: medium.toString(), high: high.toString() },
    signers,
  };

  const level = (str(options.level) || "high").toUpperCase();
  if (!["LOW", "MEDIUM", "HIGH"].includes(level)) {
    return refuse("INVALID_LEVEL", "level must be low, medium or high", "level");
  }

  const thresholdsInput = { evidence: { thresholds: account.thresholds, presentSigners: presented }, level };

  let sorobanAuth = null;
  if (snapshot.soroban !== undefined && snapshot.soroban !== null) {
    const s = snapshot.soroban;
    if (!isObj(s)) return refuse("INVALID_SOROBAN", "soroban must be an object", "soroban");
    if (!isObj(s.entry)) return refuse("SOROBAN_ENTRY_MISSING", "soroban.entry is required", "soroban.entry");
    if (!isObj(s.expected)) return refuse("SOROBAN_EXPECTED_MISSING", "soroban.expected is required", "soroban.expected");
    const currentLedger = int(s.currentLedger);
    if (currentLedger === null || currentLedger < 0n) {
      return refuse("CURRENT_LEDGER_MISSING", "soroban.currentLedger must be a non-negative integer", "soroban.currentLedger");
    }
    const entry = {
      contractId: str(s.entry.contractId),
      functionName: str(s.entry.functionName),
      argsDigest: str(s.entry.argsDigest),
      signatureExpirationLedger: int(s.entry.signatureExpirationLedger)?.toString() ?? null,
      rootInvocation: s.entry.rootInvocation === true,
      subInvocations: Array.isArray(s.entry.subInvocations)
        ? s.entry.subInvocations.map((x) => ({
            contractId: str(x?.contractId),
            functionName: str(x?.functionName),
          }))
        : [],
    };
    const expected = {
      contractId: str(s.expected.contractId),
      functionName: str(s.expected.functionName),
      argsDigest: str(s.expected.argsDigest),
    };
    const allowedContracts = Array.isArray(s.allowedContracts) ? s.allowedContracts.map((c) => str(c)).filter(Boolean) : [];
    const policy = allowedContracts.length ? { allowedContracts } : undefined;
    sorobanAuth = {
      entry,
      expected,
      currentLedger: currentLedger.toString(),
      ...(policy ? { policy } : {}),
    };
  }

  const inputs = {
    signers: { account },
    thresholds: thresholdsInput,
    sorobanAuth,
  };

  const toolCalls = [
    { name: "coreguard_verify_stellar_smart_account_signers", arguments: inputs.signers },
    { name: "coreguard_verify_stellar_multisig_thresholds", arguments: inputs.thresholds },
  ];
  if (sorobanAuth) {
    toolCalls.push({ name: "coreguard_verify_stellar_soroban_auth_entry", arguments: sorobanAuth });
  }

  const snapshotDigest = digestOf(canonicalJson({ network, accountId, account, presented, sorobanAuth }));

  return {
    ok: true,
    spec: ADAPTER_SPEC,
    boundary: ADAPTER_BOUNDARY,
    network,
    accountId,
    snapshotDigest,
    inputs,
    toolCalls,
  };
}

export default fromSmartAccountSnapshot;
