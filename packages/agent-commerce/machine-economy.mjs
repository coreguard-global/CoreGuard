/**
 * CoreGuard Machine Economy (Wave 1) - deterministic, offline, fail-closed.
 *
 * BOUNDARIES: no payment network contact, no custody, no broadcast, no signing
 * on behalf of users. x402 settlement is verified only from caller-supplied
 * evidence. Telemetry/machine identity/task completion are verified only against
 * provided evidence; physical-world truth is NOT proven. VERIFIED != SAFE.
 */
import crypto from "node:crypto";

export const MACHINE_ECONOMY_VERSION = "CG-ME/1";
export const MACHINE_ECONOMY_BOUNDARY =
  "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; " +
  "x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE.";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const canon = (v) => JSON.stringify(v, Object.keys(v instanceof Object ? v : {}).sort?.() ? undefined : undefined);
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map(k => JSON.stringify(k)+":"+stable(v[k])).join(",")}}`;
  return JSON.stringify(v);
}
function digest(obj) { return sha256(stable(obj)); }
function nowPin(nowSeconds) {
  if (nowSeconds === undefined || nowSeconds === null) return null;
  const n = typeof nowSeconds === "string" ? Number(nowSeconds) : nowSeconds;
  if (!Number.isInteger(n) || n < 0) throw new Error("nowSeconds must be a non-negative integer or digit string");
  return n;
}
function req(obj, key, type = "string") {
  if (!isObj(obj) || obj[key] === undefined) throw new Error(`${key} is required`);
  const v = obj[key];
  if (type === "object") { if (!isObj(v)) throw new Error(`${key} must be an object`); return v; }
  if (type === "array") { if (!Array.isArray(v)) throw new Error(`${key} must be an array`); return v; }
  if (type === "string") { if (typeof v !== "string" || v.length === 0) throw new Error(`${key} must be a non-empty string`); return v; }
  if (type === "boolean") { if (typeof v !== "boolean") throw new Error(`${key} must be a boolean`); return v; }
  return v;
}
function optStr(obj, key) { const v = obj?.[key]; if (v === undefined) return undefined; if (typeof v !== "string") throw new Error(`${key} must be a string`); return v; }

export function parseX402Challenge(input = {}) {
  const challenge = req(input, "challenge", "object");
  const accepts = Array.isArray(challenge.accepts) ? challenge.accepts : [];
  const normalizedAccepts = accepts.map((a, i) => {
    if (!isObj(a)) throw new Error(`challenge.accepts[${i}] must be an object`);
    return {
      scheme: optStr(a, "scheme") ?? "exact",
      network: optStr(a, "network") ?? null,
      asset: optStr(a, "asset") ?? null,
      amount: optStr(a, "amount") ?? optStr(a, "maxAmountRequired") ?? null,
      payTo: optStr(a, "payTo") ?? null,
      resource: optStr(a, "resource") ?? optStr(challenge, "resource") ?? null,
      extra: isObj(a.extra) ? a.extra : undefined,
    };
  });
  const issues = [];
  if (normalizedAccepts.length === 0) issues.push("NO_ACCEPTS");
  for (const [i,a] of normalizedAccepts.entries()) {
    if (!a.network) issues.push(`ACCEPT_${i}_MISSING_NETWORK`);
    if (!a.asset) issues.push(`ACCEPT_${i}_MISSING_ASSET`);
    if (!a.amount) issues.push(`ACCEPT_${i}_MISSING_AMOUNT`);
    if (!a.payTo) issues.push(`ACCEPT_${i}_MISSING_PAY_TO`);
  }
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "x402_challenge",
    verdict: issues.length === 0 ? "PARSED" : "INVALID",
    issues, accepts: normalizedAccepts,
    challengeDigest: digest(challenge),
    boundary: MACHINE_ECONOMY_BOUNDARY,
  };
}

export function authorizeX402Payment(input = {}) {
  const challenge = req(input, "challenge", "object");
  const policy = req(input, "policy", "object");
  const parsed = parseX402Challenge({ challenge });
  const selectedIndex = input.selectedIndex ?? 0;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= parsed.accepts.length) {
    return { spec: MACHINE_ECONOMY_VERSION, type: "x402_authorization", verdict: "DENIED", reason: "INVALID_SELECTED_INDEX", parsed, boundary: MACHINE_ECONOMY_BOUNDARY };
  }
  const selected = parsed.accepts[selectedIndex];
  const issues = [...parsed.issues];
  const maxAmount = optStr(policy, "maxAmount");
  if (maxAmount && selected.amount && BigInt(selected.amount) > BigInt(maxAmount)) issues.push("AMOUNT_EXCEEDS_POLICY");
  const allowedNetworks = Array.isArray(policy.allowedNetworks) ? policy.allowedNetworks : null;
  if (allowedNetworks && selected.network && !allowedNetworks.includes(selected.network)) issues.push("NETWORK_NOT_ALLOWED");
  const allowedAssets = Array.isArray(policy.allowedAssets) ? policy.allowedAssets : null;
  if (allowedAssets && selected.asset && !allowedAssets.includes(selected.asset)) issues.push("ASSET_NOT_ALLOWED");
  const allowedPayTo = Array.isArray(policy.allowedPayTo) ? policy.allowedPayTo : null;
  if (allowedPayTo && selected.payTo && !allowedPayTo.includes(selected.payTo)) issues.push("PAY_TO_NOT_ALLOWED");
  const verdict = issues.length === 0 ? "AUTHORIZED" : "DENIED";
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "x402_authorization", verdict, issues, selectedIndex, selected,
    challengeDigest: parsed.challengeDigest, policyDigest: digest(policy),
    authorizationId: digest({ challengeDigest: parsed.challengeDigest, policyDigest: digest(policy), selectedIndex, verdict }),
    boundary: MACHINE_ECONOMY_BOUNDARY + " No payment executed; authorization is a policy decision only.",
  };
}

export function verifyX402Settlement(input = {}) {
  const challenge = req(input, "challenge", "object");
  const settlement = req(input, "settlement", "object");
  const parsed = parseX402Challenge({ challenge });
  const issues = [];
  if (parsed.verdict !== "PARSED") issues.push("INVALID_CHALLENGE");
  const network = optStr(settlement, "network");
  const asset = optStr(settlement, "asset");
  const amount = optStr(settlement, "amount");
  const payTo = optStr(settlement, "payTo");
  const txRef = optStr(settlement, "txRef") ?? optStr(settlement, "transaction") ?? optStr(settlement, "proofRef");
  const status = optStr(settlement, "status") ?? "unknown";
  if (!txRef) issues.push("MISSING_SETTLEMENT_PROOF_REF");
  const match = parsed.accepts.some(a => (!network || a.network===network) && (!asset || a.asset===asset) && (!amount || a.amount===amount) && (!payTo || a.payTo===payTo));
  if (!match) issues.push("SETTLEMENT_DOES_NOT_MATCH_ACCEPTS");
  if (!["settled","confirmed","success","finalized"].includes(status.toLowerCase())) issues.push("SETTLEMENT_STATUS_NOT_CONFIRMED");
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "x402_settlement_verification",
    verdict: issues.length === 0 ? "VERIFIED" : "UNVERIFIED",
    issues, challengeDigest: parsed.challengeDigest, settlementDigest: digest(settlement),
    boundary: MACHINE_ECONOMY_BOUNDARY + " Settlement verified only from caller-supplied evidence; no network confirmation performed.",
  };
}

export function reconcilePayment(input = {}) {
  const authorization = req(input, "authorization", "object");
  const settlement = isObj(input.settlement) ? input.settlement : null;
  const receipt = isObj(input.receipt) ? input.receipt : null;
  const issues = [];
  if (authorization.verdict !== "AUTHORIZED") issues.push("AUTHORIZATION_NOT_AUTHORIZED");
  if (!settlement) issues.push("MISSING_SETTLEMENT");
  if (!receipt) issues.push("MISSING_RECEIPT");
  if (settlement) {
    const sv = verifyX402Settlement({ challenge: input.challenge ?? { accepts: [authorization.selected].filter(Boolean) }, settlement });
    if (sv.verdict !== "VERIFIED") issues.push(...sv.issues.map(i => `SETTLEMENT_${i}`));
  }
  if (receipt && authorization.authorizationId && receipt.authorizationId && receipt.authorizationId !== authorization.authorizationId) issues.push("RECEIPT_AUTHORIZATION_MISMATCH");
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "payment_reconciliation",
    verdict: issues.length === 0 ? "RECONCILED" : "NOT_RECONCILED",
    issues,
    authorizationId: authorization.authorizationId ?? null,
    boundary: MACHINE_ECONOMY_BOUNDARY,
  };
}

export function meterAgentUsage(input = {}) {
  const agentId = req(input, "agentId");
  const events = req(input, "events", "array");
  let total = 0n;
  const normalized = events.map((e, i) => {
    if (!isObj(e)) throw new Error(`events[${i}] must be an object`);
    const amount = String(e.amount ?? "0");
    let a; try { a = BigInt(amount); } catch { throw new Error(`events[${i}].amount must be integer string`); }
    if (a < 0n) throw new Error(`events[${i}].amount must be non-negative`);
    total += a;
    return { eventId: optStr(e, "eventId") ?? `event-${i+1}`, amount: a.toString(), unit: optStr(e, "unit") ?? "minor", resource: optStr(e, "resource") ?? null };
  });
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "agent_usage_meter",
    agentId, eventCount: normalized.length, totalAmount: total.toString(),
    currency: optStr(input, "currency") ?? null,
    eventsDigest: digest(normalized),
    boundary: MACHINE_ECONOMY_BOUNDARY,
  };
}

export function registerMachine(input = {}) {
  const machineId = req(input, "machineId");
  const manifest = req(input, "manifest", "object");
  const owner = optStr(input, "owner") ?? null;
  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities.filter(x => typeof x === "string") : [];
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "machine_registration",
    verdict: "REGISTERED_LOCAL",
    machineId, owner, capabilities,
    manifestDigest: digest(manifest),
    registrationId: digest({ machineId, owner, manifestDigest: digest(manifest) }),
    boundary: MACHINE_ECONOMY_BOUNDARY + " Local registration record only; no external identity attestation performed.",
  };
}

export function createMachineTask(input = {}) {
  const taskId = req(input, "taskId");
  const machineId = req(input, "machineId");
  const terms = req(input, "terms", "object");
  const price = optStr(terms, "price") ?? req(terms, "price");
  const currency = optStr(terms, "currency") ?? "UNKNOWN";
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "machine_task",
    verdict: "CREATED",
    taskId, machineId, termsDigest: digest(terms),
    price: String(price), currency,
    taskDigest: digest({ taskId, machineId, terms }),
    boundary: MACHINE_ECONOMY_BOUNDARY,
  };
}

export function verifyTelemetry(input = {}) {
  const taskId = req(input, "taskId");
  const telemetry = req(input, "telemetry", "object");
  const issues = [];
  const machineId = optStr(telemetry, "machineId");
  const timestamp = telemetry.timestamp;
  const readings = Array.isArray(telemetry.readings) ? telemetry.readings : null;
  if (!machineId) issues.push("MISSING_MACHINE_ID");
  if (timestamp === undefined) issues.push("MISSING_TIMESTAMP");
  if (!readings) issues.push("MISSING_READINGS_ARRAY");
  const signature = optStr(telemetry, "signature");
  const contentDigest = optStr(telemetry, "contentDigest");
  const computedDigest = digest({ ...telemetry, signature: undefined });
  if (contentDigest && contentDigest !== computedDigest) issues.push("CONTENT_DIGEST_MISMATCH");
  if (!signature) issues.push("MISSING_SIGNATURE_EVIDENCE");
  // Signature is not cryptographically verified here without a trust root; fail-closed to UNVERIFIED.
  const verdict = issues.length === 0 ? "EVIDENCE_PRESENT_UNVERIFIED_TRUST" : "INVALID";
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "telemetry_verification",
    verdict, issues, taskId, machineId: machineId ?? null,
    telemetryDigest: digest(telemetry), computedDigest,
    boundary: MACHINE_ECONOMY_BOUNDARY + " Telemetry authenticity requires trusted device keys/attestation; not proven here. Physical-world truth NOT proven.",
  };
}

export function verifyTaskCompletion(input = {}) {
  const task = req(input, "task", "object");
  const completion = req(input, "completion", "object");
  const issues = [];
  if (task.taskId && completion.taskId && task.taskId !== completion.taskId) issues.push("TASK_ID_MISMATCH");
  if (task.machineId && completion.machineId && task.machineId !== completion.machineId) issues.push("MACHINE_ID_MISMATCH");
  const evidence = Array.isArray(completion.evidence) ? completion.evidence : [];
  if (evidence.length === 0) issues.push("MISSING_COMPLETION_EVIDENCE");
  const status = optStr(completion, "status") ?? "unknown";
  if (!["completed","success","done"].includes(status.toLowerCase())) issues.push("STATUS_NOT_COMPLETED");
  const telemetryResult = isObj(input.telemetryVerification) ? input.telemetryVerification : null;
  if (telemetryResult && telemetryResult.verdict !== "EVIDENCE_PRESENT_UNVERIFIED_TRUST" && telemetryResult.verdict !== "VERIFIED") issues.push("TELEMETRY_NOT_ACCEPTED");
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "task_completion_verification",
    verdict: issues.length === 0 ? "EVIDENCE_ACCEPTED" : "NOT_ACCEPTED",
    issues,
    taskDigest: task.taskDigest ?? digest(task),
    completionDigest: digest(completion),
    boundary: MACHINE_ECONOMY_BOUNDARY + " Evidence acceptance is not physical-world proof. Independent verification/oracle required for high-stakes actions.",
  };
}

export function verifyDelegationChain(input = {}) {
  const chain = req(input, "chain", "array");
  const issues = [];
  if (chain.length === 0) issues.push("EMPTY_CHAIN");
  const normalized = chain.map((d, i) => {
    if (!isObj(d)) { issues.push(`DELEGATION_${i}_INVALID`); return null; }
    const delegator = optStr(d, "delegator");
    const delegate = optStr(d, "delegate");
    const scope = Array.isArray(d.scope) ? d.scope.filter(x=>typeof x==="string") : [];
    const expiresAt = d.expiresAt;
    if (!delegator) issues.push(`DELEGATION_${i}_MISSING_DELEGATOR`);
    if (!delegate) issues.push(`DELEGATION_${i}_MISSING_DELEGATE`);
    if (scope.length === 0) issues.push(`DELEGATION_${i}_MISSING_SCOPE`);
    return { delegator, delegate, scope, expiresAt: expiresAt ?? null, sig: optStr(d, "signature") ?? null };
  }).filter(Boolean);
  for (let i=1; i<normalized.length; i++) {
    if (normalized[i].delegator && normalized[i-1].delegate && normalized[i].delegator !== normalized[i-1].delegate) {
      issues.push(`CHAIN_BREAK_AT_${i}`);
    }
  }
  for (const [i,d] of normalized.entries()) if (!d.sig) issues.push(`DELEGATION_${i}_MISSING_SIGNATURE`);
  const verdict = issues.length === 0 ? "CHAIN_STRUCTURALLY_VALID_UNVERIFIED_SIGNATURES" : "INVALID";
  return {
    spec: MACHINE_ECONOMY_VERSION, type: "delegation_chain_verification",
    verdict, issues, depth: normalized.length,
    chainDigest: digest(chain),
    boundary: MACHINE_ECONOMY_BOUNDARY + " Structural check only; signatures not cryptographically verified without trust roots.",
  };
}

export function machineEconomySelfCheck() {
  return [
    ["version", MACHINE_ECONOMY_VERSION === "CG-ME/1"],
    ["boundary", MACHINE_ECONOMY_BOUNDARY.includes("VERIFIED != SAFE")],
    ["parse rejects empty", parseX402Challenge({ challenge: { accepts: [] } }).verdict === "INVALID"],
    ["delegation empty invalid", verifyDelegationChain({ chain: [] }).verdict === "INVALID"],
  ];
}
