/**
 * CoreGuard Agent Commerce — Stellar Agent Gate (CG-SG/1)
 *
 * Deterministic, offline gate for AI-agent-initiated Stellar actions. The
 * caller supplies the proposed envelope bytes, a projected view of the
 * operation, a policy and (later) submission evidence. This module binds the
 * approved intent to the EXACT envelope bytes and verifies that supplied
 * evidence coheres with that binding.
 *
 * It does NOT call Stellar RPC, Horizon, Friendbot, a wallet, a network or any
 * external service. It does not sign, submit, custody keys, resolve addresses,
 * check balances, clear sanctions or settle money. `VERIFIED` means the saved
 * bytes matched the bound bytes and the supplied evidence fields agreed —
 * VERIFIED ≠ SAFE and ≠ settlement finality.
 */

import { digestOf } from "./wave5.mjs";

export const STELLAR_GATE_VERSION = "CG-SG/1";
export const STELLAR_GATE_BOUNDARY =
  "CG-SG/1 is deterministic and offline. It binds caller-supplied intent bytes to caller-supplied Stellar XDR envelope bytes and verifies caller-supplied submission evidence; it makes no Stellar RPC, Horizon, Friendbot, wallet, network or external call, never signs or submits, and proves no settlement finality, sanctions clearance, KYC/AML approval, balance, asset truth or safety. VERIFIED ≠ SAFE.";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v : "");
const lower = (v) => str(v).toLowerCase();
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const G_ACCOUNT = /^G[A-Z2-7]{55}$/;
const ASSET = /^(native|[A-Z0-9]{1,12}:G[A-Z2-7]{55})$/;
const NETWORKS = Object.freeze(["testnet", "pubnet", "futurenet"]);
const AMPLIFY = 10000000n;

function ok(type, fields) { return { type, spec: STELLAR_GATE_VERSION, status: "OK", ...fields, boundary: STELLAR_GATE_BOUNDARY }; }
function refused(type, code, detail, fields = {}) {
  return { type, spec: STELLAR_GATE_VERSION, status: "REFUSED", refusal: { code, detail }, ...fields, boundary: STELLAR_GATE_BOUNDARY };
}
function check(id, okv, detail, evidence = {}) { return { id, ok: !!okv, detail, evidence }; }
function summarize(checks) {
  const failed = checks.filter((c) => !c.ok).map((c) => ({ id: c.id, detail: c.detail, evidence: c.evidence }));
  return { checks, passed: checks.length - failed.length, failed: failed.length, breaks: failed };
}
function stroops(value) {
  if (typeof value !== "string" || !/^[0-9]+(?:\.[0-9]{1,7})?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole) * AMPLIFY + BigInt(frac.padEnd(7, "0"));
}
function sameProjection(a, b) {
  const fields = ["network", "sourceAccount", "destination", "asset", "amount", "memo", "sequence"];
  return fields.filter((f) => str(a?.[f]) !== str(b?.[f])).map((f) => ({ field: f, approved: str(a?.[f]), observed: str(b?.[f]) }));
}
function projectFromProposal(p) {
  return {
    network: str(p?.network),
    sourceAccount: str(p?.sourceAccount),
    destination: str(p?.destination),
    asset: str(p?.asset),
    amount: str(p?.amount),
    memo: str(p?.memo),
    sequence: str(p?.sequence),
  };
}

/** Canonicalize a proposed Stellar action. Never reads a clock or network. */
export function canonicalStellarIntent(proposal) {
  const p = isObj(proposal) ? proposal : {};
  const checks = [];
  const required = ["network", "sourceAccount", "destination", "asset", "amount", "envelopeXdr", "envelopeProjection"];
  for (const key of required) checks.push(check(`required:${key}`, !!p[key], `${key} is required`));
  checks.push(check("network:allowlist", NETWORKS.includes(lower(p.network)), `network must be one of ${NETWORKS.join(", ")}`));
  checks.push(check("sourceAccount:strkey", G_ACCOUNT.test(str(p.sourceAccount)), "sourceAccount must be a G... account"));
  checks.push(check("destination:strkey", G_ACCOUNT.test(str(p.destination)), "destination must be a G... account"));
  checks.push(check("asset:shape", ASSET.test(str(p.asset)), "asset must be native or CODE:ISSUER"));
  const amount = stroops(p.amount);
  checks.push(check("amount:positive", amount !== null && amount > 0n, "amount must be a positive decimal with at most 7 places"));
  checks.push(check("envelopeXdr:nonempty", typeof p.envelopeXdr === "string" && p.envelopeXdr.length > 0, "envelopeXdr must be a non-empty base64 string"));
  checks.push(check("envelopeProjection:object", isObj(p.envelopeProjection), "envelopeProjection must be an object"));
  if (p.memo !== undefined) checks.push(check("memo:length", str(p.memo).length <= 28, "memo must be at most 28 bytes"));
  if (p.envelopeDigest !== undefined) checks.push(check("envelopeDigest:shape", SHA256.test(str(p.envelopeDigest)), "envelopeDigest must be sha256:<64 hex>"));
  const summary = summarize(checks);
  if (summary.failed) return refused("stellar_intent", "INVALID_PROPOSAL", `${summary.failed} named proposal checks failed`, { summary });
  const canonical = projectFromProposal(p);
  canonical.nonce = str(p.nonce);
  canonical.agentId = str(p.agentId);
  canonical.scopes = Array.isArray(p.scopes) ? [...p.scopes].sort() : [];
  canonical.agentScopes = Array.isArray(p.agentScopes) ? [...p.agentScopes].sort() : [];
  canonical.timeBounds = isObj(p.timeBounds) ? { minTime: str(p.timeBounds.minTime), maxTime: str(p.timeBounds.maxTime) } : null;
  canonical.purpose = str(p.purpose);
  return ok("stellar_intent", { canonical, digest: digestOf(canonical), summary, envelopeDigest: SHA256.test(str(p.envelopeDigest)) ? str(p.envelopeDigest) : digestOf(str(p.envelopeXdr)) });
}

/**
 * Pre-execution decision. FAIL CLOSED: any missing or mismatched named field
 * returns REFUSED/HELD; only a complete, coherent packet returns ALLOW.
 */
export function preflightStellarAgentPayment(args = {}) {
  const proposal = args.proposal;
  const policy = args.policy;
  if (!isObj(proposal) || !isObj(policy)) {
    return refused("stellar_authorization", "MISSING_ARGUMENT", "proposal and policy objects are required");
  }
  const intent = canonicalStellarIntent(proposal);
  if (intent.status !== "OK") return refused("stellar_authorization", "INVALID_PROPOSAL", "proposal failed canonicalization", { intent });

  const checks = [];
  const networks = Array.isArray(policy.allowedNetworks) ? policy.allowedNetworks.map(lower) : [];
  const assets = Array.isArray(policy.allowedAssets) ? policy.allowedAssets : [];
  const destinations = Array.isArray(policy.allowedDestinations) ? policy.allowedDestinations : [];
  checks.push(check("policy:networks", networks.length > 0 && networks.includes(lower(intent.canonical.network)), "policy must name allowedNetworks including the proposal network"));
  checks.push(check("policy:assets", assets.length > 0 && assets.includes(intent.canonical.asset), "policy must name allowedAssets including the proposal asset"));
  checks.push(check("policy:destinations", destinations.length > 0 && destinations.includes(intent.canonical.destination), "policy must name allowedDestinations including the proposal destination"));
  const ceiling = stroops(policy.maxAmount);
  const amount = stroops(intent.canonical.amount);
  checks.push(check("policy:maxAmount", ceiling !== null && amount !== null && amount <= ceiling, "policy.maxAmount must be a positive decimal ceiling and cover the proposed amount"));
  checks.push(check("policy:memo", policy.requireMemo !== true || intent.canonical.memo.length > 0, "policy requires a memo"));
  checks.push(check("policy:nonce", policy.requireNonce !== true || intent.canonical.nonce.length > 0, "policy requires a replay nonce"));
  const used = Array.isArray(policy.usedNonces) ? policy.usedNonces.map(str) : [];
  checks.push(check("replay:nonce", !intent.canonical.nonce || !used.includes(intent.canonical.nonce), "replay nonce is already used"));
  const requiredScopes = Array.isArray(policy.requiredScopes) ? policy.requiredScopes : [];
  const agentScopes = intent.canonical.agentScopes;
  const requestedScopes = intent.canonical.scopes;
  const missingScopes = requiredScopes.filter((s) => !agentScopes.includes(s));
  const overreach = requestedScopes.filter((s) => !agentScopes.includes(s));
  checks.push(check("authority:requiredScopes", missingScopes.length === 0, `agent lacks required scopes: ${missingScopes.join(",") || "none"}`, { missingScopes }));
  checks.push(check("authority:overreach", overreach.length === 0, `requested scopes outside agent authority: ${overreach.join(",") || "none"}`, { overreach }));
  if (policy.requireTimeBounds === true) {
    checks.push(check("time:bounds", !!intent.canonical.timeBounds && /^[0-9]+$/.test(intent.canonical.timeBounds.minTime) && /^[0-9]+$/.test(intent.canonical.timeBounds.maxTime), "policy requires pinned timeBounds"));
  }
  if (intent.canonical.timeBounds) {
    const now = typeof args.nowSeconds === "string" && /^[0-9]+$/.test(args.nowSeconds) ? BigInt(args.nowSeconds) : null;
    const min = /^[0-9]+$/.test(intent.canonical.timeBounds.minTime) ? BigInt(intent.canonical.timeBounds.minTime) : null;
    const max = /^[0-9]+$/.test(intent.canonical.timeBounds.maxTime) ? BigInt(intent.canonical.timeBounds.maxTime) : null;
    checks.push(check("time:pinned", now !== null && min !== null && max !== null && now >= min && now <= max, "pinned nowSeconds must fall inside timeBounds"));
  }
  const projectionDrift = sameProjection(projectFromProposal(proposal), proposal.envelopeProjection);
  checks.push(check("envelope:projection", projectionDrift.length === 0, `envelope projection drift: ${projectionDrift.map((d) => d.field).join(",") || "none"}`, { drift: projectionDrift }));
  const xdrDigest = digestOf(str(proposal.envelopeXdr));
  checks.push(check("envelope:digest", !SHA256.test(str(proposal.envelopeDigest)) || proposal.envelopeDigest === xdrDigest, "declared envelopeDigest does not match envelopeXdr bytes"));

  const summary = summarize(checks);
  if (summary.failed) {
    return refused("stellar_authorization", "POLICY_REFUSED", `${summary.failed} named preflight checks failed`, {
      intentDigest: intent.digest,
      envelopeDigest: xdrDigest,
      summary,
    });
  }
  const policyDigest = digestOf(policy);
  const boundDigest = digestOf({
    intentDigest: intent.digest,
    envelopeDigest: xdrDigest,
    policyDigest,
    nonce: intent.canonical.nonce,
  });
  return ok("stellar_authorization", {
    verdict: "ALLOW",
    intentDigest: intent.digest,
    envelopeDigest: xdrDigest,
    policyDigest,
    boundDigest,
    intent: intent.canonical,
    summary,
    pinnedNowSeconds: str(args.nowSeconds),
  });
}

/** Bind an ALLOW decision to the exact envelope bytes and observed projection. */
export function bindStellarAuthorization(args = {}) {
  const authorization = args.authorization;
  if (!isObj(authorization) || authorization.status !== "OK" || authorization.verdict !== "ALLOW") {
    return refused("stellar_binding", "NOT_AUTHORIZED", "only an ALLOW authorization can be bound");
  }
  if (typeof args.envelopeXdr !== "string" || args.envelopeXdr.length === 0) {
    return refused("stellar_binding", "MISSING_ARGUMENT", "envelopeXdr is required");
  }
  if (!isObj(args.observed)) return refused("stellar_binding", "MISSING_ARGUMENT", "observed projection is required");
  const envelopeDigest = digestOf(args.envelopeXdr);
  const checks = [];
  checks.push(check("binding:bytes", envelopeDigest === authorization.envelopeDigest, "envelopeXdr bytes drifted from the authorization"));
  const drift = sameProjection(projectFromProposal(authorization.intent ?? {}), args.observed);
  checks.push(check("binding:projection", drift.length === 0, `observed projection drift: ${drift.map((d) => d.field).join(",") || "none"}`, { drift }));
  checks.push(check("binding:digest", /^sha256:[0-9a-f]{64}$/.test(str(authorization.boundDigest)), "authorization has no valid boundDigest"));
  const summary = summarize(checks);
  if (summary.failed) return refused("stellar_binding", "BINDING_REFUSED", `${summary.failed} named binding checks failed`, { summary, envelopeDigest });
  return ok("stellar_binding", {
    statusValue: "BOUND",
    boundDigest: authorization.boundDigest,
    intentDigest: authorization.intentDigest,
    envelopeDigest,
    observed: args.observed,
    summary,
  });
}

/** Verify caller-supplied submission evidence against a BOUND authorization. */
export function verifyStellarSubmissionEvidence(args = {}) {
  const binding = args.binding;
  if (!isObj(binding) || binding.status !== "OK" || binding.statusValue !== "BOUND") {
    return { type: "stellar_submission", spec: STELLAR_GATE_VERSION, status: "UNKNOWN", reason: "a BOUND binding is required", boundary: STELLAR_GATE_BOUNDARY };
  }
  const evidence = args.evidence;
  if (!isObj(evidence)) {
    return { type: "stellar_submission", spec: STELLAR_GATE_VERSION, status: "UNKNOWN", reason: "evidence object is required", boundary: STELLAR_GATE_BOUNDARY };
  }
  const checks = [];
  const envelopeDigest = digestOf(str(evidence.envelopeXdr));
  checks.push(check("submission:bytes", envelopeDigest === binding.envelopeDigest, "submitted envelope bytes drifted from the bound envelope"));
  checks.push(check("submission:txHash", HEX64.test(str(evidence.txHash)), "txHash must be 64 lowercase hex characters"));
  checks.push(check("submission:success", evidence.successful === true, "submission evidence does not report success"));
  checks.push(check("submission:ledger", Number.isInteger(evidence.ledger) && evidence.ledger > 0, "ledger must be a positive integer"));
  checks.push(check("submission:network", typeof evidence.network === "string" && evidence.network.length > 0, "network is required"));
  checks.push(check("submission:resultXdr", typeof evidence.resultXdr === "string" && evidence.resultXdr.length > 0, "resultXdr is required"));
  const drift = sameProjection(projectFromProposal(binding.observed ?? {}), evidence.operation ?? evidence);
  checks.push(check("submission:operation", drift.length === 0, `submitted operation drift: ${drift.map((d) => d.field).join(",") || "none"}`, { drift }));
  const summary = summarize(checks);
  const evidenceDigest = digestOf(evidence);
  if (summary.failed) {
    return {
      type: "stellar_submission", spec: STELLAR_GATE_VERSION, status: "INVALID",
      refusal: { code: "EVIDENCE_MISMATCH", detail: `${summary.failed} named submission checks failed` },
      evidenceDigest, summary, boundDigest: binding.boundDigest, boundary: STELLAR_GATE_BOUNDARY,
    };
  }
  return ok("stellar_submission", {
    verdict: "VERIFIED",
    evidenceDigest,
    boundDigest: binding.boundDigest,
    txHash: str(evidence.txHash),
    summary,
  });
}

/** Export a redacted, digest-rooted pack for a human reviewer. */
export function exportStellarEvidencePack(args = {}) {
  const items = Array.isArray(args.items) ? args.items : [];
  if (items.length === 0) return refused("stellar_evidence_pack", "MISSING_ARGUMENT", "items must be a non-empty array");
  const redact = Array.isArray(args.redactFields) ? args.redactFields : ["secretKey", "privateKey", "mnemonic", "callerContext"];
  const scrub = (v, seen = new WeakSet()) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[CIRCULAR]";
    seen.add(v);
    try {
      if (Array.isArray(v)) return v.map((x) => scrub(x, seen));
      const out = {};
      for (const [k, value] of Object.entries(v)) out[k] = redact.includes(k) ? "[REDACTED]" : scrub(value, seen);
      return out;
    } finally { seen.delete(v); }
  };
  const cleaned = scrub(items);
  const root = digestOf(cleaned);
  return ok("stellar_evidence_pack", { itemCount: cleaned.length, root, packDigest: digestOf({ root, redactFields: [...redact].sort() }), items: cleaned });
}

/** Named deterministic adversarial cases for reviewers and clients. */
export function stellarAdversarialVectors(args = {}) {
  if (str(args.family) !== "stellar-agent-gate") {
    return refused("stellar_vectors", "INVALID_ARGUMENT", "family must be 'stellar-agent-gate'");
  }
  const vectors = [
    ["AMOUNT_ESCALATION", "proposal.amount exceeds policy.maxAmount", "PREFLIGHT_REFUSED"],
    ["DESTINATION_SUBSTITUTION", "envelope projection destination differs from approved destination", "PREFLIGHT_REFUSED"],
    ["ASSET_SUBSTITUTION", "proposal asset is outside allowedAssets", "PREFLIGHT_REFUSED"],
    ["NETWORK_SUBSTITUTION", "proposal network is outside allowedNetworks", "PREFLIGHT_REFUSED"],
    ["MEMO_DROP", "policy requires a memo but proposal omits it", "PREFLIGHT_REFUSED"],
    ["REPLAY_NONCE", "nonce already appears in policy.usedNonces", "PREFLIGHT_REFUSED"],
    ["SCOPE_OVERREACH", "requested scope is outside agentScopes", "PREFLIGHT_REFUSED"],
    ["TIMEBOUND_EXPIRY", "pinned nowSeconds falls outside timeBounds", "PREFLIGHT_REFUSED"],
    ["ENVELOPE_BYTE_DRIFT", "bound envelopeXdr bytes are changed by one character", "BINDING_REFUSED"],
    ["PROJECTED_FIELD_DRIFT", "observed amount differs from the approved projection", "BINDING_REFUSED"],
    ["TX_HASH_MISMATCH", "submitted txHash does not match the evidence digest shape", "EVIDENCE_INVALID"],
    ["FAILED_RESULT", "successful is false", "EVIDENCE_INVALID"],
    ["LEDGER_MISSING", "ledger is absent or non-positive", "EVIDENCE_INVALID"],
    ["OPERATION_DRIFT", "submitted operation destination differs from the bound projection", "EVIDENCE_INVALID"],
    ["MISSING_EVIDENCE", "evidence object is absent", "EVIDENCE_UNKNOWN"],
    ["UNPINNED_AUTHORIZATION", "binding is not BOUND", "EVIDENCE_UNKNOWN"],
  ].map(([id, mutation, expectedStatus]) => ({ id, mutation, expectedStatus }));
  return ok("stellar_vectors", { family: "stellar-agent-gate", count: vectors.length, vectors });
}

const CALLER_CONTEXT_PROPERTY = { type: "object", description: "Optional caller-supplied metadata echoed back; never used as a cryptographic input." };
const schema = (properties, required, description) => ({
  type: "object",
  properties: { ...properties, callerContext: CALLER_CONTEXT_PROPERTY },
  required,
  description,
});
const out = (description) => ({ type: "object", description, properties: { type: { type: "string" }, spec: { type: "string" }, status: { type: "string" }, boundary: { type: "string" } }, additionalProperties: true });

export const STELLAR_GATE_TOOLS = Object.freeze([
  { name: "coreguard_preflight_stellar_agent_payment", description: "Pre-execution gate for an agent-proposed Stellar action. Checks policy, replay, authority scopes, time bounds and exact envelope-byte binding. Makes no Stellar RPC, Horizon, wallet or network call; fail closed with named refusals.", inputSchema: schema({ proposal: { type: "object", description: "Caller-supplied proposal including XDR envelope bytes and projected operation fields." }, policy: { type: "object", description: "Caller-supplied allowlists, ceiling, scopes and replay policy." }, nowSeconds: { type: "string", pattern: "^[0-9]+$", description: "Pinned unix-seconds string; never the wall clock." } }, ["proposal", "policy"], "Preflight a Stellar agent payment against a named policy."), outputSchema: out("Stellar authorization verdict, bound digest and named checks, with boundary.") },
  { name: "coreguard_bind_stellar_authorization", description: "Bind an ALLOW decision to the exact XDR envelope bytes and the observed operation projection. Refuses on byte drift or named field drift; never signs, submits or contacts Stellar.", inputSchema: schema({ authorization: { type: "object", description: "ALLOW authorization from coreguard_preflight_stellar_agent_payment." }, envelopeXdr: { type: "string", description: "Exact base64 envelope bytes to bind." }, observed: { type: "object", description: "Caller-supplied projected operation fields observed before signing." } }, ["authorization", "envelopeXdr", "observed"], "Bind authorization to exact Stellar envelope bytes."), outputSchema: out("Binding verdict with bound digest and named drift fields.") },
  { name: "coreguard_verify_stellar_submission_evidence", description: "Verify caller-supplied Stellar submission evidence against a BOUND authorization: envelope bytes, tx hash shape, success, ledger and projected operation. No RPC lookup; VERIFIED means supplied bytes agreed, not settlement finality.", inputSchema: schema({ binding: { type: "object", description: "BOUND binding from coreguard_bind_stellar_authorization." }, evidence: { type: "object", description: "Caller-supplied submission evidence packet." } }, ["binding", "evidence"], "Verify a Stellar submission evidence packet against a binding."), outputSchema: out("Submission verdict with named breaks and evidence digest.") },
  { name: "coreguard_export_stellar_evidence_pack", description: "Export a redacted, digest-rooted evidence pack from caller-supplied Stellar gate artifacts for human review. Nothing is submitted to any external party.", inputSchema: schema({ items: { type: "array", items: { type: "object" }, description: "Authorization, binding and verification artifacts to package." }, redactFields: { type: "array", items: { type: "string" }, description: "Additional nested field names to redact." } }, ["items"], "Export a redacted Stellar gate evidence pack."), outputSchema: out("Evidence pack, root digest and redaction boundary.") },
  { name: "coreguard_stellar_adversarial_vectors", description: "List the named deterministic adversarial cases covered by the Stellar agent gate: amount escalation, destination/asset/network substitution, replay, overreach, byte drift, failed result and missing evidence. Cases are metadata, not live exploits.", inputSchema: schema({ family: { type: "string", enum: ["stellar-agent-gate"], description: "Vector family selector." } }, ["family"], "List named Stellar gate adversarial vectors."), outputSchema: out("Vector list with mutations and expected refusal statuses.") },
]);

export const STELLAR_GATE_HANDLERS = Object.freeze({
  coreguard_preflight_stellar_agent_payment: (a) => preflightStellarAgentPayment(a),
  coreguard_bind_stellar_authorization: (a) => bindStellarAuthorization(a),
  coreguard_verify_stellar_submission_evidence: (a) => verifyStellarSubmissionEvidence(a),
  coreguard_export_stellar_evidence_pack: (a) => exportStellarEvidencePack(a),
  coreguard_stellar_adversarial_vectors: (a) => stellarAdversarialVectors(a),
});

export const STELLAR_GATE_VALIDATORS = Object.freeze({
  coreguard_preflight_stellar_agent_payment: (a) => (isObj(a?.proposal) && isObj(a?.policy) ? null : { code: "MISSING_ARGUMENT", detail: "proposal and policy objects are required" }),
  coreguard_bind_stellar_authorization: (a) => (isObj(a?.authorization) && typeof a?.envelopeXdr === "string" && isObj(a?.observed) ? null : { code: "MISSING_ARGUMENT", detail: "authorization, envelopeXdr and observed are required" }),
  coreguard_verify_stellar_submission_evidence: (a) => (isObj(a?.binding) && isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "binding and evidence objects are required" }),
  coreguard_export_stellar_evidence_pack: (a) => (Array.isArray(a?.items) && a.items.length > 0 ? null : { code: "MISSING_ARGUMENT", detail: "items must be a non-empty array" }),
  coreguard_stellar_adversarial_vectors: (a) => (str(a?.family) === "stellar-agent-gate" ? null : { code: "INVALID_ARGUMENT", detail: "family must be 'stellar-agent-gate'" }),
});
