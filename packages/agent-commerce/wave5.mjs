/**
 * CoreGuard Agent Commerce — Wave 5 (CG-W5/1)
 *
 * "Financial Operations & Machine-Economy Authority" — deterministic, offline
 * evidence tools for payment authorization, KYC/AML/travel-rule packets,
 * multi-ledger reconciliation, chain-specific settlement evidence, agent
 * authority, robot handoffs, inference receipts, and evidence-pack export.
 *
 * Every input is caller-supplied. No live bank, SWIFT, card, PI, Stellar,
 * Ethereum, Core DAO, DeFi, credit-bureau or regulator call is performed.
 * VERIFIED ≠ SAFE: a verdict describes the supplied evidence only. It is not
 * settlement finality, sanctions clearance, KYC/AML approval, model correctness
 * or a compliance certification.
 */

import { createHash } from "node:crypto";

export const WAVE5_VERSION = "CG-W5/1";
export const WAVE5_BOUNDARY =
  "Wave 5 is deterministic, offline verification over caller-supplied evidence. " +
  "It does not contact SWIFT, banks, card networks, PI Network, Stellar Horizon, Ethereum RPC, Core DAO, DeFi protocols, credit bureaus, regulators, KYC providers or sanctions lists. " +
  "Outputs are evidence/risk signals only; VERIFIED ≠ SAFE; no settlement finality, sanctions clearance, KYC/AML approval, model correctness or compliance certification is claimed.";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arr = (v) => Array.isArray(v) ? v : [];
const str = (v) => typeof v === "string" ? v : "";
const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
const dec = (v) => { if (typeof v === "string" && /^-?[0-9]+(\.[0-9]+)?$/.test(v)) return v; if (Number.isInteger(v)) return String(v); return null; };
const decInt = (v) => { if (typeof v === "string" && /^[0-9]+$/.test(v)) return BigInt(v); if (Number.isInteger(v) && v >= 0) return BigInt(v); return null; };
const lower = (v) => str(v).toLowerCase();
const upper = (v) => str(v).toUpperCase();

const SHA256 = /^sha256:[0-9a-f]{64}$/;

/**
 * Deterministic JSON projection for digest input. JSON-RPC cannot carry
 * BigInt/circular values, but the exported SDK can; a digest must never throw
 * and must never silently drop a value. Unsupported leaves are tagged inline.
 */
export function canonicalJson(value, seen = new WeakSet()) {
  if (typeof value === "bigint") return JSON.stringify(`bigint:${value.toString()}`);
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    if (["string", "boolean", "number"].includes(typeof value)) return JSON.stringify(value);
    return JSON.stringify(`unsupported:${typeof value}`);
  }
  if (seen.has(value)) return JSON.stringify("[CIRCULAR]");
  seen.add(value);
  try {
    if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v, seen)).join(",") + "]";
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k], seen)).join(",") + "}";
  } finally {
    seen.delete(value);
  }
}
export function digestOf(value) { return "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex"); }

/** Deep redaction for exported evidence packs: nested named keys are removed too. */
function deepRedact(value, fields, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((v) => deepRedact(v, fields, seen));
    const redacted = {};
    for (const [k, v] of Object.entries(value)) redacted[k] = fields.includes(k) ? "[REDACTED]" : deepRedact(v, fields, seen);
    return redacted;
  } finally {
    seen.delete(value);
  }
}

function ok(type, fields) { return { type, spec: WAVE5_VERSION, status: "OK", ...fields, boundary: WAVE5_BOUNDARY }; }
function refusal(type, code, detail, fields = {}) { return { type, spec: WAVE5_VERSION, status: "REFUSED", refusal: { code, detail }, ...fields, boundary: WAVE5_BOUNDARY }; }
function check(id, okv, severity, detail, evidence = {}) { return { id, ok: !!okv, severity, detail, evidence }; }
function summarizeChecks(checks) {
  const failed = checks.filter((c) => !c.ok);
  const critical = failed.filter((c) => c.severity === "CRITICAL");
  const high = failed.filter((c) => c.severity === "HIGH");
  return { verdict: critical.length ? "FAIL" : high.length ? "WARN" : failed.length ? "WARN" : "PASS", checks, failed: failed.map((c) => c.id), critical: critical.map((c) => c.id) };
}
function requireObj(args, key, type) {
  if (!isObj(args) || !isObj(args[key])) return refusal(type, "INVALID_ARGUMENT", `${key} must be an object`, { field: key });
  return null;
}
function requireArr(args, key, type) {
  if (!isObj(args) || !Array.isArray(args[key])) return refusal(type, "INVALID_ARGUMENT", `${key} must be an array`, { field: key });
  return null;
}
const allPresent = (values) => values.every((v) => str(v).length > 0);
const sorted = (values) => [...new Set(arr(values).map(str).filter(Boolean))].sort();

// 1 — canonicalize a payment instruction into an approval-ready object.
export function canonicalizePaymentInstruction(args = {}) {
  const bad = requireObj(args, "instruction", "canonicalize_payment_instruction"); if (bad) return bad;
  const i = args.instruction;
  const canonical = {
    instructionId: str(i.instructionId || i.id),
    payerId: str(i.payerId || i.debtorId),
    payeeId: str(i.payeeId || i.creditorId),
    amountMinor: decInt(i.amountMinor)?.toString() ?? null,
    currency: upper(str(i.currency)),
    purpose: str(i.purpose || i.purposeCode),
    corridor: `${upper(str(i.sourceCountry))}->${upper(str(i.destinationCountry))}`,
  };
  const checks = [
    check("INSTRUCTION_ID", !!canonical.instructionId, "HIGH", "instructionId present"),
    check("PAYER", !!canonical.payerId, "HIGH", "payerId present"),
    check("PAYEE", !!canonical.payeeId, "CRITICAL", "payeeId present"),
    check("AMOUNT", canonical.amountMinor !== null, "CRITICAL", "amountMinor is a digit string"),
    check("CURRENCY", !!canonical.currency, "CRITICAL", "currency present"),
  ];
  return ok("canonicalize_payment_instruction", { canonical, digest: digestOf(canonical), ...summarizeChecks(checks) });
}

// 2 — verify a delegation/authorization chain with scope inheritance.
export function verifyPaymentAuthorizationChain(args = {}) {
  const bad = requireArr(args, "chain", "verify_payment_authorization_chain"); if (bad) return bad;
  const chain = args.chain.filter(isObj);
  const now = decInt(args.nowSeconds);
  const edges = chain.map((link) => ({
    delegator: str(link.delegator), delegate: str(link.delegate),
    scope: sorted(link.scope), expiresAtSeconds: decInt(link.expiresAtSeconds)?.toString() ?? null,
    signature: !!str(link.signature),
  }));
  const continuous = edges.length > 1 && edges.slice(1).every((e, idx) => e.delegator === edges[idx].delegate);
  const expired = edges.filter((e) => e.expiresAtSeconds !== null && now !== null && BigInt(e.expiresAtSeconds) < now);
  const scopeIntersection = edges.length ? edges.reduce((acc, e) => acc.filter((s) => e.scope.includes(s)), [...edges[0].scope]) : [];
  const checks = [
    check("LINKS", edges.length > 0, "CRITICAL", `${edges.length} authorization links`),
    check("CONTINUOUS", continuous, "CRITICAL", "each delegate is the next delegator"),
    check("SCOPE_PRESENT", edges.every((e) => e.scope.length > 0), "CRITICAL", "every link carries at least one scope"),
    check("NOT_EXPIRED", now !== null ? expired.length === 0 : true, "HIGH", `expired links: ${expired.length}`),
    check("SIGNATURES", edges.every((e) => e.signature), "HIGH", "every link carries a caller-supplied signature marker"),
  ];
  return ok("verify_payment_authorization_chain", {
    root: edges[0]?.delegator ?? null, terminal: edges.at(-1)?.delegate ?? null,
    scopeIntersection, expiredLinks: expired.map((e) => e.delegate), chainDigest: digestOf(edges), ...summarizeChecks(checks),
  });
}

// 3 — KYC evidence freshness/completeness gate (no live KYC provider).
export function verifyKycEvidence(args = {}) {
  const badE = requireObj(args, "evidence", "verify_kyc_evidence"); if (badE) return badE;
  const badP = requireObj(args, "policy", "verify_kyc_evidence"); if (badP) return badP;
  const e = args.evidence, p = args.policy;
  const now = decInt(args.nowSeconds), at = decInt(e.checkedAtSeconds), maxAge = decInt(p.maxAgeSeconds);
  const fresh = now !== null && at !== null && maxAge !== null ? (now >= at && now - at <= maxAge) : false;
  const requiredDocuments = sorted(p.requiredDocuments);
  const held = sorted(e.documentDigests);
  const missing = requiredDocuments.filter((d) => !held.includes(d));
  const providers = sorted(p.allowedProviders);
  const checks = [
    check("SUBJECT", !!str(e.subjectId), "CRITICAL", "subjectId present"),
    check("RESULT", ["CLEAR", "VERIFIED", "PASS"].includes(upper(str(e.result))), "CRITICAL", `result=${str(e.result)}`),
    check("FRESH", fresh, "HIGH", "KYC evidence is fresh at pinned nowSeconds"),
    check("DOCUMENTS", missing.length === 0, "HIGH", `missing document digests: ${missing.join(", ") || "none"}`),
    check("PROVIDER", !providers.length || providers.includes(str(e.providerId)), "MEDIUM", "provider allowed when an allowlist is supplied"),
  ];
  const out = ok("verify_kyc_evidence", { subjectId: str(e.subjectId), fresh, missingDocuments: missing, ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " KYC evidence is caller-supplied; no identity provider, document registry or regulator decision is contacted.";
  return out;
}

// 4 — beneficial-ownership packet consistency.
export function verifyUboEvidence(args = {}) {
  const badE = requireObj(args, "entity", "verify_ubo_evidence"); if (badE) return badE;
  const e = args.entity, p = isObj(args.policy) ? args.policy : {};
  const owners = arr(e.owners).filter(isObj).map((o) => ({ ownerId: str(o.ownerId), pct: num(o.pct) ?? num(o.percent) }));
  const sum = owners.reduce((a, o) => a + (o.pct ?? 0), 0);
  const threshold = num(p.minDisclosurePct) ?? 25;
  const disclosed = owners.filter((o) => (o.pct ?? 0) >= threshold);
  const checks = [
    check("ENTITY_ID", !!str(e.entityId), "CRITICAL", "entityId present"),
    check("OWNERS", owners.length > 0, "CRITICAL", "at least one owner is disclosed"),
    check("OWNER_IDS", owners.every((o) => !!o.ownerId), "HIGH", "every owner has an ownerId"),
    check("PCT_SUM", Math.abs(sum - 100) <= 0.01, "HIGH", `ownership percentages sum to ${sum}`),
    check("DISCLOSURE", disclosed.length > 0, "HIGH", `at least one owner at or above ${threshold}%`),
  ];
  const out = ok("verify_ubo_evidence", { entityId: str(e.entityId), ownershipSumPct: sum, disclosedOwners: disclosed.map((o) => o.ownerId), digest: digestOf(e), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " Ownership is a caller-supplied packet; no company registry or beneficial-ownership database is queried.";
  return out;
}

// 5 — travel-rule packet completeness (no live VASP network).
export function verifyTravelRulePacket(args = {}) {
  const bad = requireObj(args, "packet", "verify_travel_rule_packet"); if (bad) return bad;
  const p = args.packet, policy = isObj(args.policy) ? args.policy : {};
  const fields = ["originatorName", "originatorAccount", "beneficiaryName", "beneficiaryAccount", "originatorVasp", "beneficiaryVasp"];
  const missing = fields.filter((f) => !str(p[f]));
  const allowed = sorted(policy.allowedVasps);
  const checks = [
    check("FIELDS", missing.length === 0, "CRITICAL", `missing fields: ${missing.join(", ") || "none"}`),
    check("AMOUNT", dec(p.amountMinor) !== null, "CRITICAL", "amountMinor parseable"),
    check("CURRENCY", !!str(p.currency), "HIGH", "currency present"),
    check("VASPS", !allowed.length || (allowed.includes(str(p.originatorVasp)) && allowed.includes(str(p.beneficiaryVasp))), "HIGH", "VASPs allowed when an allowlist is supplied"),
  ];
  const out = ok("verify_travel_rule_packet", { packetId: str(p.packetId || p.transferId), missingFields: missing, digest: digestOf(p), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " This is packet completeness evidence only; no travel-rule message is sent and no VASP is contacted.";
  return out;
}

// 6 — AML alert disposition evidence (no live monitoring system).
export function verifyAmlAlertDisposition(args = {}) {
  const bad = requireObj(args, "alert", "verify_aml_alert_disposition"); if (bad) return bad;
  const a = args.alert;
  const detected = decInt(a.detectedAtSeconds), reviewed = decInt(a.reviewedAtSeconds);
  const rationale = str(a.rationale);
  const checks = [
    check("ALERT_ID", !!str(a.alertId), "CRITICAL", "alertId present"),
    check("DISPOSITION", ["CLEARED", "ESCALATED", "FILED_SAR", "CLOSED"].includes(upper(str(a.disposition))), "CRITICAL", `disposition=${str(a.disposition)}`),
    check("REVIEWER", !!str(a.reviewer), "HIGH", "reviewer present"),
    check("RATIONALE", rationale.length >= 10, "HIGH", `rationale length ${rationale.length}`),
    check("SEQUENCE", detected !== null && reviewed !== null ? reviewed >= detected : false, "CRITICAL", "review is not before detection"),
    check("CASE_ID", !!str(a.caseId), "MEDIUM", "caseId present"),
  ];
  const out = ok("verify_aml_alert_disposition", { alertId: str(a.alertId), disposition: upper(str(a.disposition)), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " Disposition is caller-supplied evidence; no alert is generated, closed or reported to any authority.";
  return out;
}

// 7 — sanctions list version alignment (no list download).
export function verifySanctionsListVersion(args = {}) {
  const badE = requireObj(args, "evidence", "verify_sanctions_list_version"); if (badE) return badE;
  const badP = requireObj(args, "policy", "verify_sanctions_list_version"); if (badP) return badP;
  const e = args.evidence, p = args.policy;
  const now = decInt(args.nowSeconds), published = decInt(e.publishedAtSeconds), maxAge = decInt(p.maxAgeSeconds);
  const ver = decInt(e.listVersion), min = decInt(p.minVersion);
  const fresh = now !== null && published !== null && maxAge !== null ? (now >= published && now - published <= maxAge) : false;
  const checks = [
    check("LIST_NAME", !str(p.requiredListName) || str(e.listName) === str(p.requiredListName), "HIGH", "list name matches policy"),
    check("VERSION", ver !== null && min !== null ? ver >= min : false, "CRITICAL", `listVersion ${e.listVersion} >= ${p.minVersion}`),
    check("FRESH", fresh, "HIGH", "list snapshot is fresh at pinned nowSeconds"),
    check("DIGEST", /^sha256:[0-9a-f]{64}$/.test(str(e.digest)), "HIGH", "list digest is a sha256 digest string"),
  ];
  const out = ok("verify_sanctions_list_version", { listName: str(e.listName), listVersion: str(e.listVersion), fresh, ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " No sanctions list is downloaded or screened; this checks a caller-supplied version stamp only.";
  return out;
}

// 8 — FX rate lock evidence bound to an intent amount and expiry.
export function verifyFxRateLock(args = {}) {
  const bad = requireObj(args, "lock", "verify_fx_rate_lock"); if (bad) return bad;
  const l = args.lock, x = isObj(args.expected) ? args.expected : {};
  const now = decInt(args.nowSeconds), expires = decInt(l.expiresAtSeconds);
  const rate = dec(l.rate), amount = decInt(l.amountMinor), quote = decInt(l.quoteMinor);
  const checks = [
    check("LOCK_ID", !!str(l.lockId), "HIGH", "lockId present"),
    check("PAIR", !!str(l.baseCurrency) && !!str(l.quoteCurrency), "HIGH", "currency pair present"),
    check("RATE", rate !== null && Number(rate) > 0, "CRITICAL", `rate=${l.rate}`),
    check("AMOUNT", !dec(x.amountMinor) || dec(l.amountMinor) === dec(x.amountMinor), "CRITICAL", "locked amount matches expected amount"),
    check("QUOTE", quote !== null && (!dec(x.quoteMinor) || quote.toString() === dec(x.quoteMinor)), "CRITICAL", "locked quote matches expected quote"),
    check("NOT_EXPIRED", now !== null && expires !== null ? expires >= now : false, "CRITICAL", "rate lock not expired at pinned nowSeconds"),
  ];
  return ok("verify_fx_rate_lock", { lockId: str(l.lockId), expired: now !== null && expires !== null ? expires < now : null, digest: digestOf(l), ...summarizeChecks(checks) });
}

// 9 — multi-ledger reconciliation with explicit breaks.
export function reconcileMultiLedger(args = {}) {
  const bad = requireArr(args, "sources", "reconcile_multi_ledger"); if (bad) return bad;
  const sources = args.sources.filter(isObj);
  const x = isObj(args.expected) ? args.expected : {};
  const expectedAmount = dec(x.amountMinor), expectedCurrency = upper(str(x.currency));
  const breaks = [];
  for (const s of sources) {
    const reasons = [];
    if (expectedAmount !== null && dec(s.amountMinor) !== expectedAmount) reasons.push("AMOUNT");
    if (expectedCurrency && upper(str(s.currency)) !== expectedCurrency) reasons.push("CURRENCY");
    if (!str(s.reference)) reasons.push("REFERENCE");
    if (!/^sha256:[0-9a-f]{64}$/.test(str(s.digest))) reasons.push("DIGEST");
    if (reasons.length) breaks.push({ sourceId: str(s.sourceId || s.id || `source-${sources.indexOf(s)}`), reasons });
  }
  const checks = [
    check("SOURCES", sources.length > 0, "CRITICAL", `${sources.length} sources supplied`),
    check("BREAKS", breaks.length === 0, "CRITICAL", `${breaks.length} ledger break(s)`),
  ];
  return ok("reconcile_multi_ledger", { sourceCount: sources.length, breaks, digest: digestOf(sources), ...summarizeChecks(checks) });
}

// 10 — caller-supplied camt.054-like credit notification.
export function verifyCamt054Notification(args = {}) {
  const bad = requireObj(args, "notification", "verify_camt054_notification"); if (bad) return bad;
  const n = args.notification, x = isObj(args.expected) ? args.expected : {};
  const entries = arr(n.entries).filter(isObj);
  const entryChecks = entries.flatMap((e, idx) => [
    check(`ENTRY_${idx}_AMOUNT`, dec(e.amountMinor) !== null, "CRITICAL", `entry ${idx} amount parseable`),
    check(`ENTRY_${idx}_CURRENCY`, !!str(e.currency), "HIGH", `entry ${idx} currency present`),
    check(`ENTRY_${idx}_REFERENCE`, !!str(e.reference), "MEDIUM", `entry ${idx} reference present`),
  ]);
  const checks = [
    check("MESSAGE_ID", !!str(n.messageId), "HIGH", "messageId present"),
    check("ACCOUNT", !!str(n.accountId), "HIGH", "accountId present"),
    check("ENTRIES", entries.length > 0, "CRITICAL", "at least one notification entry"),
    ...entryChecks,
    check("BALANCE", dec(n.balanceMinor) !== null, "HIGH", "balanceMinor parseable"),
    check("EXPECTED_AMOUNT", !dec(x.amountMinor) || entries.some((e) => dec(e.amountMinor) === dec(x.amountMinor)), "CRITICAL", "an entry matches the expected amount"),
  ];
  return ok("verify_camt054_notification", { messageId: str(n.messageId), entryCount: entries.length, digest: digestOf(n), ...summarizeChecks(checks) });
}

// 11 — MT103-like field map validation.
export function verifyMt103Fields(args = {}) {
  const bad = requireObj(args, "fields", "verify_mt103_fields"); if (bad) return bad;
  const f = args.fields;
  const requiredTags = [":20:", ":23B:", ":32A:", ":50K:", ":59:", ":70:"];
  const present = requiredTags.filter((tag) => isObj(f) ? !!str(f[tag]) : false);
  const missing = requiredTags.filter((tag) => !present.includes(tag));
  const dateAmount = str(isObj(f) ? f[":32A:"] : "");
  const format = /^(\d{6})([A-Z]{3})([0-9.,]+)$/.exec(dateAmount);
  const checks = [
    check("MANDATORY_FIELDS", missing.length === 0, "CRITICAL", `missing tags: ${missing.join(" ") || "none"}`),
    check("32A_FORMAT", !!format, "HIGH", "field 32A is YYMMDDCCCamount"),
    check("UETR", !!str(f.uetr), "MEDIUM", "uetr present when supplied"),
  ];
  return ok("verify_mt103_fields", { present, missing, parsed32A: format ? { date: format[1], currency: format[2], amount: format[3] } : null, digest: digestOf(f), ...summarizeChecks(checks) });
}

// 12 — last-moment beneficiary/account change defense.
export function verifyBeneficiaryChange(args = {}) {
  const badA = requireObj(args, "approved", "verify_beneficiary_change"); if (badA) return badA;
  const badE = requireObj(args, "executed", "verify_beneficiary_change"); if (badE) return badE;
  const a = args.approved, e = args.executed, p = isObj(args.policy) ? args.policy : {};
  const fields = ["beneficiaryId", "account", "bank"];
  const changed = fields.filter((f) => str(a[f]) !== str(e[f]));
  const reapprovalWaived = p.requireReapproval === false;
  const checks = [
    check("BENEFICIARY_ID", str(a.beneficiaryId) === str(e.beneficiaryId), "CRITICAL", `approved=${str(a.beneficiaryId)} executed=${str(e.beneficiaryId)}`),
    check("ACCOUNT", str(a.account) === str(e.account), "CRITICAL", `approved=${str(a.account)} executed=${str(e.account)}`),
    check("BANK", str(a.bank) === str(e.bank), "HIGH", "bank matches approved instruction"),
    // A caller-supplied policy flag cannot waiver executed-vs-approved drift:
    // the drift checks above stay CRITICAL. It only records the gate request.
    check("REAPPROVAL", !reapprovalWaived, "HIGH", reapprovalWaived ? "caller requested no re-approval gate; drift checks still apply" : "re-approval gate active"),
  ];
  return ok("verify_beneficiary_change", {
    changedFields: changed, reapprovalRequired: changed.length > 0,
    reapprovalGateRequested: !reapprovalWaived,
    digest: digestOf({ approved: a, executed: e }), ...summarizeChecks(checks),
  });
}

// 13 — Stellar path payment evidence (no Horizon call).
export function verifyStellarPathPayment(args = {}) {
  const bad = requireObj(args, "evidence", "verify_stellar_path_payment"); if (bad) return bad;
  const e = args.evidence, x = isObj(args.expected) ? args.expected : {};
  const checks = [
    check("TX_HASH", !!str(e.txHash), "CRITICAL", "txHash present"),
    check("STATUS", ["SUCCESS", "CONFIRMED"].includes(upper(str(e.status))), "CRITICAL", `status=${str(e.status)}`),
    check("SOURCE_ASSET", !str(x.sourceAsset) || str(e.sourceAsset) === str(x.sourceAsset), "HIGH", "source asset matches"),
    check("DEST_ASSET", !str(x.destAsset) || str(e.destAsset) === str(x.destAsset), "HIGH", "destination asset matches"),
    check("AMOUNTS", dec(e.sendAmount) !== null && dec(e.destAmount) !== null, "CRITICAL", "send and destination amounts parseable"),
    check("DESTINATION", !str(x.destination) || str(e.destination) === str(x.destination), "HIGH", "destination account matches"),
    check("PATH_DIGEST", !!str(e.pathDigest) || arr(e.path).length > 0, "MEDIUM", "path digest or path assets present"),
  ];
  const out = ok("verify_stellar_path_payment", { txHash: str(e.txHash), pathLength: arr(e.path).length, ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " No Stellar Horizon or network call is made; the path is a caller-supplied packet.";
  return out;
}

// 14 — EVM permit/allowance evidence (no RPC, no signature recovery).
export function verifyEvmPermitEvidence(args = {}) {
  const bad = requireObj(args, "evidence", "verify_evm_permit_evidence"); if (bad) return bad;
  const e = args.evidence, p = isObj(args.policy) ? args.policy : {};
  const now = decInt(args.nowSeconds), deadline = decInt(e.deadline), value = decInt(e.value), max = decInt(p.maxValue);
  const spenders = sorted(p.allowedSpenders).map(lower);
  const checks = [
    check("TOKEN", /^0x[0-9a-fA-F]{40}$/.test(str(e.token)), "HIGH", "token address format"),
    check("OWNER", !!str(e.owner), "HIGH", "owner present"),
    check("SPENDER", !spenders.length || spenders.includes(lower(str(e.spender))), "CRITICAL", "spender allowed when an allowlist is supplied"),
    check("VALUE", value !== null && (max === null || value <= max), "CRITICAL", "permit value within policy"),
    check("DEADLINE", now !== null && deadline !== null ? deadline >= now : false, "CRITICAL", "permit not expired at pinned nowSeconds"),
    check("SIGNATURE", !!str(e.signature), "CRITICAL", "caller-supplied signature marker present"),
    check("NONCE", decInt(e.nonce) !== null, "MEDIUM", "nonce parseable"),
  ];
  const out = ok("verify_evm_permit_evidence", { token: str(e.token), spender: str(e.spender), digest: digestOf(e), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " Signature validity and on-chain allowance are not verified; the caller supplies all fields.";
  return out;
}

// 15 — Core DAO delegation/staking evidence (no RPC).
export function verifyCoreDaoDelegationEvidence(args = {}) {
  const bad = requireObj(args, "evidence", "verify_coredao_delegation_evidence"); if (bad) return bad;
  const e = args.evidence, p = isObj(args.policy) ? args.policy : {};
  const validators = sorted(p.allowedValidators);
  const amount = decInt(e.amount), min = decInt(p.minAmount);
  const checks = [
    check("CHAIN_ID", decInt(e.chainId) === 1116n, "CRITICAL", "caller-supplied chainId is explicitly 1116"),
    check("DELEGATOR", !!str(e.delegator), "HIGH", "delegator present"),
    check("VALIDATOR", !validators.length || validators.includes(str(e.validator)), "CRITICAL", "validator allowed when an allowlist is supplied"),
    check("AMOUNT", amount !== null && (min === null || amount >= min), "CRITICAL", "delegated amount meets policy minimum"),
    check("STATUS", ["ACTIVE", "BONDED", "DELEGATED"].includes(upper(str(e.status))), "HIGH", `status=${str(e.status)}`),
    check("UNBONDING", decInt(p.maxUnbondingSeconds) === null || decInt(e.unbondingSeconds) === null || decInt(e.unbondingSeconds) <= decInt(p.maxUnbondingSeconds), "HIGH", "unbonding period within policy"),
  ];
  const out = ok("verify_coredao_delegation_evidence", { validator: str(e.validator), amount: amount?.toString() ?? null, ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " No Core DAO RPC or staking contract call is made; evidence is caller-supplied.";
  return out;
}

// 16 — Pi payment attestation chain integrity.
export function verifyPiAttestationChain(args = {}) {
  const bad = requireArr(args, "chain", "verify_pi_attestation_chain"); if (bad) return bad;
  const chain = args.chain.filter(isObj);
  const expected = isObj(args.expected) ? args.expected : {};
  const digestsValid = chain.length > 0 && chain.every((l) => SHA256.test(str(l.digest)));
  const linked = digestsValid && chain.length > 1 && chain.slice(1).every((link, idx) => SHA256.test(str(link.previousDigest)) && str(link.previousDigest) === str(chain[idx].digest));
  const root = chain.at(-1)?.digest ?? null;
  const checks = [
    check("LINKS", chain.length > 0, "CRITICAL", `${chain.length} attestation links`),
    check("DIGESTS", digestsValid, "CRITICAL", "every link carries a sha256 digest"),
    check("LINKED", linked, "CRITICAL", "each link cites a valid previous sha256 digest"),
    check("ROOT", !str(expected.rootDigest) || root === str(expected.rootDigest), "HIGH", "attestation root matches expected root"),
    check("PAYMENT_ID", chain.length > 0 && (!str(expected.paymentId) || str(chain[0]?.paymentId) === str(expected.paymentId)), "CRITICAL", "paymentId matches expected"),
    check("ATTESTORS", chain.length > 0 && chain.every((l) => !!str(l.attestor)), "HIGH", "every link names an attestor"),
  ];
  const out = ok("verify_pi_attestation_chain", { rootDigest: root, paymentId: str(chain[0]?.paymentId), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " Pi attestation evidence is caller-supplied; no Pi Network API or mainnet settlement check is performed.";
  return out;
}

// 17 — ERC-4337 UserOperation evidence packet.
export function verifyErc4337UserOpEvidence(args = {}) {
  const bad = requireObj(args, "userOp", "verify_erc4337_userop_evidence"); if (bad) return bad;
  const u = args.userOp, p = isObj(args.policy) ? args.policy : {};
  const senders = sorted(p.allowedSenders).map(lower), paymasters = sorted(p.allowedPaymasters).map(lower);
  const gas = decInt(u.gasLimit), maxGas = decInt(p.maxGasLimit);
  const checks = [
    check("SENDER", !senders.length || senders.includes(lower(str(u.sender))), "CRITICAL", "sender allowed when an allowlist is supplied"),
    check("NONCE", decInt(u.nonce) !== null, "CRITICAL", "nonce parseable"),
    check("CALLDATA_DIGEST", /^sha256:[0-9a-f]{64}$/.test(str(u.callDataDigest)), "HIGH", "callDataDigest format"),
    check("SIGNATURE", !!str(u.signature), "CRITICAL", "caller-supplied signature marker present"),
    check("GAS_LIMIT", gas !== null && (maxGas === null || gas <= maxGas), "HIGH", "gas limit within policy"),
    check("PAYMASTER", !paymasters.length || !str(u.paymaster) || paymasters.includes(lower(str(u.paymaster))), "HIGH", "paymaster allowed when supplied"),
  ];
  const out = ok("verify_erc4337_userop_evidence", { sender: str(u.sender), digest: digestOf(u), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " No bundler, paymaster or chain call is made; signature validity is not recovered.";
  return out;
}

// 18 — token approval revocation evidence.
export function verifyTokenApprovalRevocation(args = {}) {
  const bad = requireObj(args, "evidence", "verify_token_approval_revocation"); if (bad) return bad;
  const e = args.evidence;
  const before = decInt(e.allowanceBefore), after = decInt(e.allowanceAfter);
  const checks = [
    check("TOKEN", /^0x[0-9a-fA-F]{40}$/.test(str(e.token)), "HIGH", "token address format"),
    check("OWNER", !!str(e.owner), "HIGH", "owner present"),
    check("SPENDER", !!str(e.spender), "HIGH", "spender present"),
    check("BEFORE", before !== null && before > 0n, "CRITICAL", "there was an allowance to revoke"),
    check("AFTER_ZERO", after === 0n, "CRITICAL", `allowanceAfter=${e.allowanceAfter}`),
    check("TX_HASH", /^0x[0-9a-fA-F]{64}$/.test(str(e.txHash)), "HIGH", "txHash format"),
  ];
  const out = ok("verify_token_approval_revocation", { token: str(e.token), spender: str(e.spender), digest: digestOf(e), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " No transaction is broadcast and no chain state is read; this checks a caller-supplied receipt.";
  return out;
}

// 19 — deterministic budget lease for a machine or robot.
export function createMachineBudgetLease(args = {}) {
  const badL = requireObj(args, "lease", "create_machine_budget_lease"); if (badL) return badL;
  const l = args.lease, p = isObj(args.policy) ? args.policy : {};
  const amount = decInt(l.amountMinor), max = decInt(p.maxAmountMinor);
  const start = decInt(l.startAtSeconds), end = decInt(l.endAtSeconds);
  const allowedScopes = sorted(p.allowedScopes), scopes = sorted(l.scope);
  const checks = [
    check("LEASE_ID", !!str(l.leaseId), "CRITICAL", "leaseId present"),
    check("MACHINE", !!str(l.machineId), "CRITICAL", "machineId present"),
    check("WINDOW", start !== null && end !== null && end >= start, "CRITICAL", "valid time window"),
    check("AMOUNT", amount !== null && (max === null || amount <= max), "CRITICAL", "lease amount within policy"),
    check("SCOPES", scopes.length > 0 && (!allowedScopes.length || scopes.every((s) => allowedScopes.includes(s))), "HIGH", "scopes are non-empty and allowed"),
  ];
  const lease = { spec: WAVE5_VERSION, type: "machine_budget_lease", ...l, policyDigest: digestOf(p), createdAtSeconds: decInt(args.nowSeconds)?.toString() ?? null };
  return ok("create_machine_budget_lease", { lease, leaseDigest: digestOf(lease), ...summarizeChecks(checks) });
}

// 20 — verify spend events against a lease.
export function verifyMachineBudgetConsumption(args = {}) {
  const badL = requireObj(args, "lease", "verify_machine_budget_consumption"); if (badL) return badL;
  const badE = requireArr(args, "events", "verify_machine_budget_consumption"); if (badE) return badE;
  const l = args.lease, events = args.events.filter(isObj);
  const limit = decInt(l.amountMinor);
  const start = decInt(l.startAtSeconds), end = decInt(l.endAtSeconds);
  const scopes = sorted(l.scope);
  let spent = 0n;
  const breaks = [];
  const seenReferences = new Set();
  for (const e of events) {
    const reasons = [];
    const at = decInt(e.atSeconds), amount = decInt(e.amountMinor);
    const reference = str(e.reference);
    if (!reference) reasons.push("REFERENCE");
    const duplicate = !!reference && seenReferences.has(reference);
    if (reference) seenReferences.add(reference);
    if (duplicate) reasons.push("DUPLICATE_REFERENCE");
    // A replayed reference is a break and must not consume budget twice.
    if (amount !== null && !duplicate) spent += amount; else if (amount === null) reasons.push("AMOUNT");
    if (start !== null && at !== null && (at < start || at > end)) reasons.push("WINDOW");
    if (scopes.length && !scopes.includes(str(e.scope))) reasons.push("SCOPE");
    if (reasons.length) breaks.push({ reference: reference || "unreferenced", reasons });
  }
  const checks = [
    check("EVENTS", events.length > 0, "MEDIUM", `${events.length} consumption events`),
    check("BREAKS", breaks.length === 0, "CRITICAL", `${breaks.length} policy break(s)`),
    check("BUDGET", limit !== null ? spent <= limit : false, "CRITICAL", `spent ${spent} <= lease ${limit}`),
  ];
  return ok("verify_machine_budget_consumption", { leaseId: str(l.leaseId), spentMinor: spent.toString(), remainingMinor: limit !== null ? (limit - spent).toString() : null, breaks, ...summarizeChecks(checks) });
}

// 21 — robot task handoff chain integrity.
export function verifyRobotHandoffChain(args = {}) {
  const bad = requireArr(args, "chain", "verify_robot_handoff_chain"); if (bad) return bad;
  const chain = args.chain.filter(isObj);
  const expected = isObj(args.expected) ? args.expected : {};
  const taskIds = [...new Set(chain.map((l) => str(l.taskId)))];
  const digestsValid = chain.length > 0 && chain.every((l) => SHA256.test(str(l.digest)));
  const continuous = chain.length > 1 && chain.slice(1).every((l, idx) => !!str(l.fromRobot) && str(l.fromRobot) === str(chain[idx].toRobot));
  const ordered = chain.length > 0 && chain.every((l, idx) => decInt(l.atSeconds) !== null && (idx === 0 || decInt(l.atSeconds) >= decInt(chain[idx - 1].atSeconds)));
  const linked = digestsValid && chain.length > 1 && chain.slice(1).every((l, idx) => SHA256.test(str(l.previousDigest)) && str(l.previousDigest) === str(chain[idx].digest));
  const checks = [
    check("LINKS", chain.length > 0, "CRITICAL", `${chain.length} handoff links`),
    check("TASK_ID", taskIds.length === 1 && !!taskIds[0] && (!str(expected.taskId) || taskIds[0] === str(expected.taskId)), "CRITICAL", `task ids: ${taskIds.join(", ") || "none"}`),
    check("CONTINUOUS", continuous, "CRITICAL", "each toRobot becomes the next fromRobot"),
    check("TIME_ORDER", ordered, "HIGH", "handoffs are time-ordered with parseable atSeconds"),
    check("DIGESTS", digestsValid, "CRITICAL", "every link carries a sha256 digest"),
    check("DIGEST_CHAIN", linked, "HIGH", "each link cites a valid previous sha256 digest"),
  ];
  return ok("verify_robot_handoff_chain", { taskId: taskIds[0] ?? null, handoffs: chain.length, digest: digestOf(chain), ...summarizeChecks(checks) });
}

// 22 — authority scope intersection and overreach detection.
export function verifyAgentAuthorityIntersection(args = {}) {
  const badP = requireArr(args, "principalScope", "verify_agent_authority_intersection"); if (badP) return badP;
  const badA = requireArr(args, "agentScope", "verify_agent_authority_intersection"); if (badA) return badA;
  const principal = sorted(args.principalScope), agent = sorted(args.agentScope), requested = sorted(args.requested ?? []);
  const agentOverreach = agent.filter((s) => !principal.includes(s));
  const requestOverreach = requested.filter((s) => !agent.includes(s));
  const intersection = principal.filter((s) => agent.includes(s));
  const checks = [
    check("PRINCIPAL_SCOPE", principal.length > 0, "CRITICAL", "principal scope is non-empty"),
    check("AGENT_SCOPE", agent.length > 0, "CRITICAL", "agent scope is non-empty"),
    check("AGENT_WITHIN_PRINCIPAL", agentOverreach.length === 0, "CRITICAL", `agent-only scopes: ${agentOverreach.join(", ") || "none"}`),
    check("REQUEST_WITHIN_AGENT", requestOverreach.length === 0, "CRITICAL", `requested scopes outside agent authority: ${requestOverreach.join(", ") || "none"}`),
  ];
  return ok("verify_agent_authority_intersection", { intersection, agentOverreach, requestOverreach, digest: digestOf({ principal, agent, requested }), ...summarizeChecks(checks) });
}

// 23 — deterministic inference receipt (binds digests, not truth).
export function createInferenceReceipt(args = {}) {
  const bad = requireObj(args, "evidence", "create_inference_receipt"); if (bad) return bad;
  const e = args.evidence;
  const checks = [
    check("MODEL", !!str(e.modelId), "HIGH", "modelId present"),
    check("PROMPT_DIGEST", /^sha256:[0-9a-f]{64}$/.test(str(e.promptDigest)), "CRITICAL", "promptDigest format"),
    check("OUTPUT_DIGEST", /^sha256:[0-9a-f]{64}$/.test(str(e.outputDigest)), "CRITICAL", "outputDigest format"),
    check("POLICY_DIGEST", !!str(e.policyDigest), "HIGH", "policyDigest present"),
    check("COST", dec(e.costMinor) !== null, "HIGH", "costMinor parseable"),
    check("LATENCY", num(e.latencyMs) !== null && num(e.latencyMs) >= 0, "MEDIUM", "latencyMs non-negative"),
  ];
  const receipt = { spec: WAVE5_VERSION, type: "inference_receipt", ...e, createdAtSeconds: decInt(args.nowSeconds)?.toString() ?? null };
  const out = ok("create_inference_receipt", { receipt, receiptDigest: digestOf(receipt), ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " It does not attest correctness, safety or permission; a receipt binds supplied digests only.";
  return out;
}

// 24 — export a redacted, merkle-rooted evidence pack for human review.
export function exportEvidencePack(args = {}) {
  const bad = requireArr(args, "items", "export_evidence_pack"); if (bad) return bad;
  const items = args.items.filter(isObj);
  const p = isObj(args.policy) ? args.policy : {};
  const maxItems = decInt(p.maxItems);
  const redactFields = sorted(p.redactFields);
  const entries = items.map((item) => {
    const source = item.body ?? item;
    const body = redactFields.length ? deepRedact(source, redactFields) : source;
    const computed = digestOf(source);
    return { id: str(item.id), body, providedDigest: str(item.digest || ""), computedDigest: computed, intact: !str(item.digest) || str(item.digest) === computed };
  });
  const root = digestOf(entries.map((e) => e.computedDigest).sort());
  const checks = [
    check("ITEMS", items.length > 0, "CRITICAL", `${items.length} evidence items`),
    check("MAX_ITEMS", maxItems === null || BigInt(items.length) <= maxItems, "HIGH", "item count within policy"),
    check("INTEGRITY", entries.every((e) => e.intact), "CRITICAL", "every provided digest matches its body"),
    check("IDS", entries.every((e) => !!e.id), "HIGH", "every item has an id"),
  ];
  const pack = { spec: WAVE5_VERSION, type: "evidence_pack", root, redactedFields: redactFields, items: entries, createdAtSeconds: decInt(args.nowSeconds)?.toString() ?? null };
  const out = ok("export_evidence_pack", { pack, packDigest: digestOf(pack), root, ...summarizeChecks(checks) });
  out.boundary = WAVE5_BOUNDARY + " The pack is for export/review only; nothing is submitted to a regulator, court or counterparty by this tool.";
  return out;
}

// ---------------------------------------------------------------------------
// MCP tool definitions / handlers / validators
// ---------------------------------------------------------------------------

const CALLER_CONTEXT = { type: "object", description: "Optional caller context echoed back in response (never a cryptographic input).", additionalProperties: true };
const schema = (properties, required, description) => ({
  type: "object", description, additionalProperties: true,
  properties: { ...properties, callerContext: CALLER_CONTEXT },
  ...(required ? { required } : {}),
});
// Every Wave 5 result shares an envelope. Declaring it makes the outputSchema
// testable instead of merely asserting `type: object` with open properties.
const out = (description) => ({
  type: "object",
  description: description.length > 40 ? description : description + " (deterministic, caller-supplied evidence).",
  additionalProperties: true,
  properties: {
    type: { type: "string" },
    spec: { type: "string" },
    status: { type: "string", enum: ["OK", "REFUSED"] },
    refusal: { type: "object", description: "Present only when status is REFUSED." },
    verdict: { type: "string", enum: ["PASS", "WARN", "FAIL"] },
    checks: { type: "array", items: { type: "object" } },
    failed: { type: "array", items: { type: "string" } },
    critical: { type: "array", items: { type: "string" } },
    boundary: { type: "string" },
  },
});

export const WAVE5_TOOLS = Object.freeze([
  { name: "coreguard_canonicalize_payment_instruction", description: "Normalize a caller-supplied payment instruction into a canonical, digest-bound object ready for approval. Offline; no bank or rail contact.", inputSchema: schema({ instruction: { type: "object" } }, ["instruction"], "Payment instruction to canonicalize."), outputSchema: out("Canonical instruction, digest and checks.") },
  { name: "coreguard_verify_payment_authorization_chain", description: "Verify a caller-supplied delegation chain for continuity, scoped authority, expiry and signature markers at a pinned time. No IdP call.", inputSchema: schema({ chain: { type: "array", items: { type: "object" } }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["chain"], "Delegation links and pinned time."), outputSchema: out("Authorization chain verdict with scope intersection.") },
  { name: "coreguard_verify_kyc_evidence", description: "Check a caller-supplied KYC evidence packet for freshness, required documents and provider allowlist. No live KYC or identity-provider call.", inputSchema: schema({ evidence: { type: "object" }, policy: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["evidence", "policy", "nowSeconds"], "KYC evidence, policy, pinned time."), outputSchema: out("KYC evidence verdict with explicit boundary.") },
  { name: "coreguard_verify_ubo_evidence", description: "Verify a caller-supplied beneficial-ownership packet for owner identifiers, percentage sum and disclosure threshold. No registry call.", inputSchema: schema({ entity: { type: "object" }, policy: { type: "object" } }, ["entity"], "Entity ownership packet and optional policy."), outputSchema: out("Ownership packet verdict and digest.") },
  { name: "coreguard_verify_travel_rule_packet", description: "Check a caller-supplied travel-rule packet for required originator, beneficiary, VASP and amount fields. No VASP network is contacted.", inputSchema: schema({ packet: { type: "object" }, policy: { type: "object" } }, ["packet"], "Travel-rule packet and optional policy."), outputSchema: out("Travel-rule packet completeness verdict.") },
  { name: "coreguard_verify_aml_alert_disposition", description: "Verify a caller-supplied AML alert disposition for reviewer, rationale, sequence and case id. No alert is generated or reported.", inputSchema: schema({ alert: { type: "object" } }, ["alert"], "AML alert disposition packet."), outputSchema: out("AML disposition verdict with explicit boundary.") },
  { name: "coreguard_verify_sanctions_list_version", description: "Check a caller-supplied sanctions-list version stamp against a pinned policy minimum and freshness window. No list is downloaded.", inputSchema: schema({ evidence: { type: "object" }, policy: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["evidence", "policy", "nowSeconds"], "List stamp, policy, pinned time."), outputSchema: out("List-version assessment and checks.") },
  { name: "coreguard_verify_fx_rate_lock", description: "Verify a caller-supplied FX rate lock against an expected intent amount and a pinned expiry. No market-data feed is used.", inputSchema: schema({ lock: { type: "object" }, expected: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["lock", "nowSeconds"], "Rate lock, optional expected values, pinned time."), outputSchema: out("Rate-lock verdict with expiry state.") },
  { name: "coreguard_reconcile_multi_ledger", description: "Reconcile caller-supplied ledger sources against an expected amount/currency and emit named breaks. No ledger API is contacted.", inputSchema: schema({ sources: { type: "array", items: { type: "object" } }, expected: { type: "object" } }, ["sources"], "Ledger sources and expected values."), outputSchema: out("Reconciliation verdict with explicit breaks.") },
  { name: "coreguard_verify_camt054_notification", description: "Parse and validate a caller-supplied camt.054-like credit notification with entries and balance. No bank statement API is contacted.", inputSchema: schema({ notification: { type: "object" }, expected: { type: "object" } }, ["notification"], "Camt.054-like notification and optional expectations."), outputSchema: out("Notification verdict, entry count and digest.") },
  { name: "coreguard_verify_mt103_fields", description: "Validate mandatory fields and the 32A date/currency/amount shape in a caller-supplied MT103-like field map. No SWIFT access.", inputSchema: schema({ fields: { type: "object" } }, ["fields"], "MT103-like field map."), outputSchema: out("Present/missing tags and parsed 32A field.") },
  { name: "coreguard_verify_beneficiary_change", description: "Detect beneficiary, account or bank drift between an approved instruction and an executed packet, with an explicit re-approval gate. Offline.", inputSchema: schema({ approved: { type: "object" }, executed: { type: "object" }, policy: { type: "object" } }, ["approved", "executed"], "Approved and executed beneficiary packets."), outputSchema: out("Change verdict with re-approval requirement.") },
  { name: "coreguard_verify_stellar_path_payment", description: "Verify caller-supplied Stellar path-payment evidence for status, assets, amounts, destination and path digest. No Horizon call.", inputSchema: schema({ evidence: { type: "object" }, expected: { type: "object" } }, ["evidence"], "Path-payment evidence and optional expectations."), outputSchema: out("Path-payment evidence verdict.") },
  { name: "coreguard_verify_evm_permit_evidence", description: "Verify caller-supplied EVM permit evidence for token, spender, value, deadline, nonce and signature marker. No RPC or signature recovery.", inputSchema: schema({ evidence: { type: "object" }, policy: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["evidence", "nowSeconds"], "Permit evidence, policy, pinned time."), outputSchema: out("Permit evidence verdict and digest.") },
  { name: "coreguard_verify_coredao_delegation_evidence", description: "Verify caller-supplied Core DAO delegation evidence for chain 1116, validator allowlist, amount and unbonding policy. No RPC call.", inputSchema: schema({ evidence: { type: "object" }, policy: { type: "object" } }, ["evidence"], "Delegation evidence and optional policy."), outputSchema: out("Delegation evidence verdict.") },
  { name: "coreguard_verify_pi_attestation_chain", description: "Verify the digest linkage and root of a caller-supplied Pi payment attestation chain. No Pi API or mainnet settlement check.", inputSchema: schema({ chain: { type: "array", items: { type: "object" } }, expected: { type: "object" } }, ["chain"], "Attestation links and optional expectations."), outputSchema: out("Attestation chain verdict and root digest.") },
  { name: "coreguard_verify_erc4337_userop_evidence", description: "Verify a caller-supplied ERC-4337 UserOperation packet for sender, nonce, calldata digest, signature marker and gas policy. No bundler call.", inputSchema: schema({ userOp: { type: "object" }, policy: { type: "object" } }, ["userOp"], "UserOperation packet and optional policy."), outputSchema: out("UserOperation evidence verdict and digest.") },
  { name: "coreguard_verify_token_approval_revocation", description: "Verify caller-supplied token approval revocation evidence shows a positive previous allowance and a zero current allowance. No broadcast.", inputSchema: schema({ evidence: { type: "object" } }, ["evidence"], "Allowance revocation evidence packet."), outputSchema: out("Revocation verdict with digest.") },
  { name: "coreguard_create_machine_budget_lease", description: "Create a deterministic, digest-bound budget lease for a machine or robot with scope, time window and amount ceiling. No control of any device.", inputSchema: schema({ lease: { type: "object" }, policy: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["lease"], "Lease terms and optional policy."), outputSchema: out("Lease record, digest and checks.") },
  { name: "coreguard_verify_machine_budget_consumption", description: "Verify machine spend events against a budget lease for amount, window, scope and reference, with named breaks. Offline arithmetic only.", inputSchema: schema({ lease: { type: "object" }, events: { type: "array", items: { type: "object" } } }, ["lease", "events"], "Lease and consumption events."), outputSchema: out("Spend total, remaining budget and breaks.") },
  { name: "coreguard_verify_robot_handoff_chain", description: "Verify a robot task handoff chain for a single task id, continuity, time order and digest linkage. No robot telemetry source is contacted.", inputSchema: schema({ chain: { type: "array", items: { type: "object" } }, expected: { type: "object" } }, ["chain"], "Handoff links and optional expectations."), outputSchema: out("Handoff chain verdict and digest.") },
  { name: "coreguard_verify_agent_authority_intersection", description: "Intersect principal, agent and requested authority scopes and name any overreach. Deterministic set arithmetic; no policy service call.", inputSchema: schema({ principalScope: { type: "array", items: { type: "string" } }, agentScope: { type: "array", items: { type: "string" } }, requested: { type: "array", items: { type: "string" } } }, ["principalScope", "agentScope"], "Principal, agent and requested scopes."), outputSchema: out("Authority intersection and overreach lists.") },
  { name: "coreguard_create_inference_receipt", description: "Create a deterministic receipt binding caller-supplied model, prompt, output and policy digests with cost and latency. It does not attest correctness.", inputSchema: schema({ evidence: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["evidence"], "Inference evidence to bind."), outputSchema: out("Inference receipt and digest with boundary.") },
  { name: "coreguard_export_evidence_pack", description: "Export a redacted, digest-rooted evidence pack from caller-supplied items for human review. Nothing is submitted to any external party.", inputSchema: schema({ items: { type: "array", items: { type: "object" } }, policy: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["items"], "Evidence items and optional export policy."), outputSchema: out("Evidence pack, merkle-style root and digest.") },
]);

export const WAVE5_HANDLERS = Object.freeze({
  coreguard_canonicalize_payment_instruction: (a) => canonicalizePaymentInstruction(a),
  coreguard_verify_payment_authorization_chain: (a) => verifyPaymentAuthorizationChain(a),
  coreguard_verify_kyc_evidence: (a) => verifyKycEvidence(a),
  coreguard_verify_ubo_evidence: (a) => verifyUboEvidence(a),
  coreguard_verify_travel_rule_packet: (a) => verifyTravelRulePacket(a),
  coreguard_verify_aml_alert_disposition: (a) => verifyAmlAlertDisposition(a),
  coreguard_verify_sanctions_list_version: (a) => verifySanctionsListVersion(a),
  coreguard_verify_fx_rate_lock: (a) => verifyFxRateLock(a),
  coreguard_reconcile_multi_ledger: (a) => reconcileMultiLedger(a),
  coreguard_verify_camt054_notification: (a) => verifyCamt054Notification(a),
  coreguard_verify_mt103_fields: (a) => verifyMt103Fields(a),
  coreguard_verify_beneficiary_change: (a) => verifyBeneficiaryChange(a),
  coreguard_verify_stellar_path_payment: (a) => verifyStellarPathPayment(a),
  coreguard_verify_evm_permit_evidence: (a) => verifyEvmPermitEvidence(a),
  coreguard_verify_coredao_delegation_evidence: (a) => verifyCoreDaoDelegationEvidence(a),
  coreguard_verify_pi_attestation_chain: (a) => verifyPiAttestationChain(a),
  coreguard_verify_erc4337_userop_evidence: (a) => verifyErc4337UserOpEvidence(a),
  coreguard_verify_token_approval_revocation: (a) => verifyTokenApprovalRevocation(a),
  coreguard_create_machine_budget_lease: (a) => createMachineBudgetLease(a),
  coreguard_verify_machine_budget_consumption: (a) => verifyMachineBudgetConsumption(a),
  coreguard_verify_robot_handoff_chain: (a) => verifyRobotHandoffChain(a),
  coreguard_verify_agent_authority_intersection: (a) => verifyAgentAuthorityIntersection(a),
  coreguard_create_inference_receipt: (a) => createInferenceReceipt(a),
  coreguard_export_evidence_pack: (a) => exportEvidencePack(a),
});

export const WAVE5_VALIDATORS = Object.freeze({
  coreguard_canonicalize_payment_instruction: (a) => (isObj(a?.instruction) ? null : { code: "MISSING_ARGUMENT", detail: "instruction is required and must be an object" }),
  coreguard_verify_payment_authorization_chain: (a) => (Array.isArray(a?.chain) ? null : { code: "MISSING_ARGUMENT", detail: "chain is required and must be an array" }),
  coreguard_verify_kyc_evidence: (a) => (isObj(a?.evidence) && isObj(a?.policy) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence, policy, nowSeconds required" }),
  coreguard_verify_ubo_evidence: (a) => (isObj(a?.entity) ? null : { code: "MISSING_ARGUMENT", detail: "entity is required and must be an object" }),
  coreguard_verify_travel_rule_packet: (a) => (isObj(a?.packet) ? null : { code: "MISSING_ARGUMENT", detail: "packet is required and must be an object" }),
  coreguard_verify_aml_alert_disposition: (a) => (isObj(a?.alert) ? null : { code: "MISSING_ARGUMENT", detail: "alert is required and must be an object" }),
  coreguard_verify_sanctions_list_version: (a) => (isObj(a?.evidence) && isObj(a?.policy) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence, policy, nowSeconds required" }),
  coreguard_verify_fx_rate_lock: (a) => (isObj(a?.lock) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "lock and nowSeconds required" }),
  coreguard_reconcile_multi_ledger: (a) => (Array.isArray(a?.sources) ? null : { code: "MISSING_ARGUMENT", detail: "sources is required and must be an array" }),
  coreguard_verify_camt054_notification: (a) => (isObj(a?.notification) ? null : { code: "MISSING_ARGUMENT", detail: "notification is required and must be an object" }),
  coreguard_verify_mt103_fields: (a) => (isObj(a?.fields) ? null : { code: "MISSING_ARGUMENT", detail: "fields is required and must be an object" }),
  coreguard_verify_beneficiary_change: (a) => (isObj(a?.approved) && isObj(a?.executed) ? null : { code: "MISSING_ARGUMENT", detail: "approved and executed are required objects" }),
  coreguard_verify_stellar_path_payment: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_verify_evm_permit_evidence: (a) => (isObj(a?.evidence) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence and nowSeconds required" }),
  coreguard_verify_coredao_delegation_evidence: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_verify_pi_attestation_chain: (a) => (Array.isArray(a?.chain) ? null : { code: "MISSING_ARGUMENT", detail: "chain is required and must be an array" }),
  coreguard_verify_erc4337_userop_evidence: (a) => (isObj(a?.userOp) ? null : { code: "MISSING_ARGUMENT", detail: "userOp is required and must be an object" }),
  coreguard_verify_token_approval_revocation: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_create_machine_budget_lease: (a) => (isObj(a?.lease) ? null : { code: "MISSING_ARGUMENT", detail: "lease is required and must be an object" }),
  coreguard_verify_machine_budget_consumption: (a) => (isObj(a?.lease) && Array.isArray(a?.events) ? null : { code: "MISSING_ARGUMENT", detail: "lease and events required" }),
  coreguard_verify_robot_handoff_chain: (a) => (Array.isArray(a?.chain) ? null : { code: "MISSING_ARGUMENT", detail: "chain is required and must be an array" }),
  coreguard_verify_agent_authority_intersection: (a) => (Array.isArray(a?.principalScope) && Array.isArray(a?.agentScope) ? null : { code: "MISSING_ARGUMENT", detail: "principalScope and agentScope required" }),
  coreguard_create_inference_receipt: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_export_evidence_pack: (a) => (Array.isArray(a?.items) ? null : { code: "MISSING_ARGUMENT", detail: "items is required and must be an array" }),
});
