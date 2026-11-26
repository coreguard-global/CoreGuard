/**
 * CoreGuard Agent Commerce — smart-account snapshot adapter (CG-SA/1)
 *
 * Deterministic, offline reshaping of a CALLER-SUPPLIED smart-account
 * snapshot into argument objects for three checks. This is an SDK helper,
 * not an MCP tool: it never contacts a network, calls fetch, signs, deploys,
 * submits, resolves an address, reads a ledger, or decides authorization.
 * VERIFIED ≠ SAFE — a mapped snapshot means the supplied fields cohere with
 * the supplied rules; it is not payment safety, settlement finality, a
 * compliance decision, or a claim of OpenZeppelin compatibility.
 *
 * EXACT SNAPSHOT FIELDS READ (no others are fetched or inferred):
 *   network                         string; one of testnet, pubnet, futurenet, standalone
 *   accountId                       C... Stellar contract account id
 *   masterWeight                    integer 0..255; 0 means the master key is disabled
 *   thresholds.low                  integer 0..255
 *   thresholds.medium               integer 0..255
 *   thresholds.high                 integer 0..255
 *   signers[].key                   G... or C... Stellar strkey
 *   signers[].kind                  ed25519 | passkey | session_key
 *   signers[].weight                integer 0..255
 *   soroban.entry.contractId        C... contract id in the supplied authorization entry
 *   soroban.entry.functionName      non-empty function name
 *   soroban.entry.argsDigest        sha256:<64 lowercase hex>
 *   soroban.entry.signatureExpirationLedger  integer ledger bound in the entry
 *   soroban.entry.rootInvocation    boolean (must be true)
 *   soroban.expected.contractId     C... expected contract id
 *   soroban.expected.functionName   expected function name
 *   soroban.expected.argsDigest     expected sha256:<64 lowercase hex>
 *   soroban.currentLedger           integer ledger at which the entry is checked
 *
 * NAMED REFUSAL CODES (never a generic error):
 *   ACCOUNT_ID       network/accountId missing or malformed
 *   SIGNERS          signers array, key, kind or weight malformed or kind not allowed
 *   UNIQUE_KEYS      duplicate signer key
 *   THRESHOLDS       thresholds missing, malformed, or not low <= medium <= high
 *   MASTER_DISABLED  masterWeight is not 0
 *   THRESHOLD_MET    signer weights do not reach every named threshold level
 *   EXPIRATION       entry/expected mismatch, expired or malformed Soroban evidence
 *
 * @param {object} snapshot          Caller-supplied object with the exact fields above.
 * @param {object} [options]         Reserved; no option performs external work.
 * @returns {object} A frozen result with status MAPPED or REFUSED. A mapped result
 *   has a deterministic snapshotDigest and exactly three toolCalls entries.
 */
import { digestOf } from "./wave5.mjs";

export const SMART_ACCOUNT_ADAPTER_VERSION = "CG-SA/1";
export const SMART_ACCOUNT_ADAPTER_BOUNDARY =
  "CG-SA/1 is deterministic and offline. It reshapes caller-supplied smart-account evidence, " +
  "sorts signers before digesting, and emits argument objects for three checks. It makes no " +
  "network, fetch, RPC, wallet, signing, deployment or submission call, decides no authorization, " +
  "and claims no Stellar/OpenZeppelin compatibility, partnership, audit or settlement finality. VERIFIED ≠ SAFE.";

export const SMART_ACCOUNT_REFUSAL_CODES = Object.freeze({
  ACCOUNT_ID: "ACCOUNT_ID",
  SIGNERS: "SIGNERS",
  UNIQUE_KEYS: "UNIQUE_KEYS",
  THRESHOLDS: "THRESHOLDS",
  MASTER_DISABLED: "MASTER_DISABLED",
  THRESHOLD_MET: "THRESHOLD_MET",
  EXPIRATION: "EXPIRATION",
});

export const SMART_ACCOUNT_SNAPSHOT_FIELDS = Object.freeze([
  "network", "accountId", "masterWeight",
  "thresholds.low", "thresholds.medium", "thresholds.high",
  "signers[].key", "signers[].kind", "signers[].weight",
  "soroban.entry.contractId", "soroban.entry.functionName", "soroban.entry.argsDigest",
  "soroban.entry.signatureExpirationLedger", "soroban.entry.rootInvocation",
  "soroban.expected.contractId", "soroban.expected.functionName", "soroban.expected.argsDigest",
  "soroban.currentLedger",
]);

const NETWORKS = Object.freeze(["testnet", "pubnet", "futurenet", "standalone"]);
const SIGNER_KINDS = Object.freeze(["ed25519", "passkey", "session_key"]);
const G_OR_C = /^[GC][A-Z2-7]{55}$/;
const C_CONTRACT = /^C[A-Z2-7]{55}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v : "");
const int = (v) => (Number.isInteger(v) ? v : null);

function result(status, fields) {
  return Object.freeze({
    type: "smart_account_snapshot",
    spec: SMART_ACCOUNT_ADAPTER_VERSION,
    status,
    ...fields,
    boundary: SMART_ACCOUNT_ADAPTER_BOUNDARY,
  });
}

function refused(code, detail, canonical) {
  return result("REFUSED", {
    refusal: Object.freeze({ code, detail }),
    snapshotDigest: digestOf(canonical),
    canonicalSnapshot: Object.freeze(canonical),
    toolCalls: Object.freeze([]),
  });
}

function mapped(canonical, toolCalls) {
  return result("MAPPED", {
    refusal: null,
    snapshotDigest: digestOf(canonical),
    canonicalSnapshot: Object.freeze(canonical),
    toolCalls: Object.freeze(toolCalls.map((call) => Object.freeze({
      name: call.name,
      arguments: Object.freeze(call.arguments),
    }))),
  });
}

/** Exact-field projection. Missing leaves stay null so a refusal still has a stable digest. */
function project(snapshot) {
  const s = isObj(snapshot) ? snapshot : {};
  const t = isObj(s.thresholds) ? s.thresholds : {};
  const so = isObj(s.soroban) ? s.soroban : {};
  const entry = isObj(so.entry) ? so.entry : {};
  const expected = isObj(so.expected) ? so.expected : {};
  const signers = Array.isArray(s.signers) ? s.signers.map((v) => {
    const signer = isObj(v) ? v : {};
    return { key: str(signer.key), kind: str(signer.kind), weight: int(signer.weight) };
  }) : [];
  signers.sort((a, b) =>
    a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind) || (a.weight ?? -1) - (b.weight ?? -1));
  return {
    network: str(s.network),
    accountId: str(s.accountId),
    masterWeight: int(s.masterWeight),
    thresholds: { low: int(t.low), medium: int(t.medium), high: int(t.high) },
    signers,
    soroban: {
      entry: {
        contractId: str(entry.contractId),
        functionName: str(entry.functionName),
        argsDigest: str(entry.argsDigest),
        signatureExpirationLedger: int(entry.signatureExpirationLedger),
        rootInvocation: entry.rootInvocation === true,
      },
      expected: {
        contractId: str(expected.contractId),
        functionName: str(expected.functionName),
        argsDigest: str(expected.argsDigest),
      },
      currentLedger: int(so.currentLedger),
    },
  };
}

/**
 * Reshape a caller-supplied snapshot. No branch of this function performs I/O.
 * @param {object} snapshot See the exact field list in the module JSDoc above.
 * @returns {object} Frozen MAPPED or REFUSED result with a named refusal code.
 */
export function fromSmartAccountSnapshot(snapshot) {
  const c = project(snapshot);

  if (!NETWORKS.includes(c.network) || !C_CONTRACT.test(c.accountId)) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.ACCOUNT_ID,
      "network must be a named Stellar network and accountId must be a C... contract id", c);
  }
  if (!Array.isArray(c.signers) || c.signers.length === 0 || c.signers.some((s) =>
    !G_OR_C.test(s.key) || !SIGNER_KINDS.includes(s.kind) || s.weight === null || s.weight < 0 || s.weight > 255)) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.SIGNERS,
      "every signer needs a G.../C... key, an allowed kind, and an integer weight 0..255", c);
  }
  if (new Set(c.signers.map((s) => s.key)).size !== c.signers.length) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.UNIQUE_KEYS,
      "signer keys must be unique", c);
  }
  const { low, medium, high } = c.thresholds;
  if ([low, medium, high].some((v) => v === null || v < 0 || v > 255) || !(low <= medium && medium <= high)) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.THRESHOLDS,
      "thresholds need integer low/medium/high in 0..255 with low <= medium <= high", c);
  }
  if (c.masterWeight !== 0) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.MASTER_DISABLED,
      "masterWeight must be 0 (master key disabled)", c);
  }

  const present = c.signers.reduce((sum, s) => sum + s.weight, 0);
  const levels = [
    { level: "low", required: low, presentWeight: present, met: present >= low },
    { level: "medium", required: medium, presentWeight: present, met: present >= medium },
    { level: "high", required: high, presentWeight: present, met: present >= high },
  ];
  if (levels.some((l) => !l.met)) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.THRESHOLD_MET,
      `present signer weight ${present} does not reach every named threshold level`, c);
  }

  const { entry, expected, currentLedger } = c.soroban;
  if (!C_CONTRACT.test(entry.contractId) || !C_CONTRACT.test(expected.contractId) ||
      !entry.functionName || entry.functionName !== expected.functionName ||
      !SHA256.test(entry.argsDigest) || entry.argsDigest !== expected.argsDigest ||
      entry.rootInvocation !== true ||
      currentLedger === null || currentLedger < 0 ||
      entry.signatureExpirationLedger === null ||
      entry.signatureExpirationLedger <= currentLedger) {
    return refused(SMART_ACCOUNT_REFUSAL_CODES.EXPIRATION,
      "Soroban entry must match expected contract/function/argsDigest and expire after currentLedger", c);
  }

  return mapped(c, [
    {
      name: "CG_SA_SIGNER_SET",
      arguments: {
        network: c.network, accountId: c.accountId, masterWeight: c.masterWeight,
        thresholds: c.thresholds, signers: c.signers,
      },
    },
    {
      name: "CG_SA_THRESHOLD_MET",
      arguments: {
        levels, signers: c.signers.map(({ key, weight }) => ({ key, weight })),
      },
    },
    {
      name: "CG_SA_SOROBAN_ENTRY",
      arguments: { entry, expected, currentLedger },
    },
  ]);
}
