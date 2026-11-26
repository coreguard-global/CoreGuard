/**
 * CoreGuard Agent Commerce — Wave 6 (CG-W6/1)
 *
 * "Stellar Smart Accounts & Session Keys" — deterministic, offline decision,
 * binding and evidence tools for agentic payments on Stellar: session-key
 * policy compilation and evaluation, smart-account signer/threshold policy,
 * envelope time and ledger bounds, memo binding, asset allowlists with
 * confusable-code detection, trustline policy, Soroban authorization entries,
 * Stellar Asset Contract allowances, fee-bump sponsorship, claimable balances,
 * sponsored reserves, sequence/replay guards, exact operation-set drift, DEX
 * path slippage, SEP-10 challenge and SEP-24 anchor evidence, and a
 * session-scoped receipt that binds policy + action + cumulative spend.
 *
 * Every input is caller-supplied. No Stellar RPC, Horizon, Soroban, wallet,
 * anchor, DEX, Friendbot or network call is performed, and nothing is signed,
 * submitted or broadcast. VERIFIED means the supplied evidence matched the
 * supplied policy and approved bytes; it is not settlement finality, asset
 * truth, counterparty honesty, KYC/AML clearance or a safety claim.
 */

import { createHash } from "node:crypto";

export const WAVE6_VERSION = "CG-W6/1";
export const WAVE6_BOUNDARY =
  "Wave 6 is deterministic, offline reasoning over caller-supplied Stellar evidence. " +
  "It does not contact Stellar RPC, Horizon, Soroban, anchors, DEXs, wallets or any network, and it never signs, submits or broadcasts. " +
  "Outputs are decision and evidence signals only; VERIFIED ≠ SAFE; no settlement finality, asset truth, counterparty honesty, KYC/AML clearance or compliance certification is claimed.";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === "string" ? v : "");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const lower = (v) => str(v).toLowerCase();
const upper = (v) => str(v).toUpperCase();
const decInt = (v) => {
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return BigInt(v);
  if (Number.isInteger(v) && v >= 0) return BigInt(v);
  return null;
};
const dec = (v) => {
  if (typeof v === "string" && /^-?[0-9]+(\.[0-9]+)?$/.test(v)) return v;
  if (Number.isInteger(v)) return String(v);
  return null;
};
/** Exact decimal comparison via scaled BigInt (no float rounding). */
function cmpDec(a, b) {
  const pa = dec(a);
  const pb = dec(b);
  if (pa === null || pb === null) return null;
  const scale = (s) => (s.split(".")[1] ?? "").length;
  const digits = (s) => BigInt(s.replace(".", ""));
  const k = Math.max(scale(pa), scale(pb));
  const scaleTo = (s) => digits(s) * 10n ** BigInt(k - scale(s));
  const x = scaleTo(pa);
  const y = scaleTo(pb);
  return x === y ? 0 : x > y ? 1 : -1;
}
const SHA256 = /^sha256:[0-9a-f]{64}$/;

/**
 * Deterministic JSON projection for digest input. Never throws on BigInt or
 * cycles; unsupported leaves are tagged inline so a digest always exists.
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
export function digestOf(value) {
  return "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function ok(type, fields) {
  return { type, spec: WAVE6_VERSION, status: "OK", ...fields, boundary: WAVE6_BOUNDARY };
}
function refusal(type, code, detail, fields = {}) {
  return { type, spec: WAVE6_VERSION, status: "REFUSED", refusal: { code, detail }, ...fields, boundary: WAVE6_BOUNDARY };
}
function check(id, okv, severity, detail, evidence = {}) {
  return { id, ok: !!okv, severity, detail, evidence };
}
function summarizeChecks(checks) {
  const failed = checks.filter((c) => !c.ok);
  const critical = failed.filter((c) => c.severity === "CRITICAL");
  const high = failed.filter((c) => c.severity === "HIGH");
  return {
    verdict: critical.length ? "FAIL" : high.length ? "WARN" : failed.length ? "WARN" : "PASS",
    checks,
    failed: failed.map((c) => c.id),
    critical: critical.map((c) => c.id),
  };
}
function requireObj(args, key, type) {
  if (!isObj(args) || !isObj(args[key])) return refusal(type, "INVALID_ARGUMENT", `${key} must be an object`, { field: key });
  return null;
}
function requireArr(args, key, type) {
  if (!isObj(args) || !Array.isArray(args[key])) return refusal(type, "INVALID_ARGUMENT", `${key} must be an array`, { field: key });
  return null;
}
const sorted = (values) => [...new Set(arr(values).map(str).filter(Boolean))].sort();
const hashes = (values) => arr(values).filter((v) => SHA256.test(str(v)));

/** Confusable-code normalization: lowercase, strip separators, fold common lookalikes. */
export function normalizeAssetCode(code) {
  return lower(str(code))
    .replace(/[^a-z0-9]/g, "")
    .replace(/0/g, "o")
    .replace(/[1l|]/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

// 1 — compile a session-key policy into a canonical, digest-bound object.
export function compileStellarSessionPolicy(args = {}) {
  const bad = requireObj(args, "policy", "compile_stellar_session_policy");
  if (bad) return bad;
  const p = args.policy;
  const policy = {
    spec: WAVE6_VERSION,
    sessionId: str(p.sessionId),
    principal: str(p.principal),
    agent: str(p.agent),
    network: lower(str(p.network)),
    allowedContracts: sorted(p.allowedContracts).map(lower),
    allowedOperations: sorted(p.allowedOperations).map(upper),
    allowedAssets: arr(p.allowedAssets).filter(isObj).map((a) => ({
      code: str(a.code),
      issuer: str(a.issuer) || null,
    })),
    maxPerActionMinor: decInt(p.maxPerActionMinor)?.toString() ?? null,
    dailyLimitMinor: decInt(p.dailyLimitMinor)?.toString() ?? null,
    validFromSeconds: decInt(p.validFromSeconds)?.toString() ?? null,
    expiresAtSeconds: decInt(p.expiresAtSeconds)?.toString() ?? null,
    requireMemo: p.requireMemo === true,
    memoPrefix: str(p.memoPrefix) || null,
    requireSorobanAuth: p.requireSorobanAuth === true,
  };
  const perAction = decInt(policy.maxPerActionMinor);
  const daily = decInt(policy.dailyLimitMinor);
  const from = decInt(policy.validFromSeconds);
  const expires = decInt(policy.expiresAtSeconds);
  const checks = [
    check("SESSION_ID", !!policy.sessionId, "CRITICAL", "sessionId present"),
    check("PRINCIPAL", !!policy.principal, "CRITICAL", "principal present"),
    check("AGENT", !!policy.agent, "CRITICAL", "agent present"),
    check("NETWORK", ["testnet", "mainnet", "futurenet"].includes(policy.network), "CRITICAL", `network=${policy.network}`),
    check("SCOPES", policy.allowedOperations.length > 0, "CRITICAL", `${policy.allowedOperations.length} allowed operation(s)`),
    check("CAPS", perAction !== null && daily !== null && perAction > 0n && daily >= perAction, "CRITICAL", "per-action cap > 0 and <= daily limit"),
    check("WINDOW", from !== null && expires !== null && expires > from, "CRITICAL", "valid-from is before expiry"),
    check("ASSETS", policy.allowedAssets.length > 0 && policy.allowedAssets.every((a) => !!a.code), "HIGH", "at least one asset, each with a code"),
  ];
  return ok("compile_stellar_session_policy", {
    policy,
    policyDigest: digestOf(policy),
    ...summarizeChecks(checks),
  });
}

// 2 — evaluate one proposed agent action against a session policy (fail closed).
export function evaluateStellarSessionKey(args = {}) {
  const badP = requireObj(args, "policy", "evaluate_stellar_session_key");
  if (badP) return badP;
  const badA = requireObj(args, "action", "evaluate_stellar_session_key");
  if (badA) return badA;
  const p = args.policy;
  const a = args.action;
  const now = decInt(args.nowSeconds);
  const spent = decInt(args.spentTodayMinor) ?? 0n;
  const reasons = [];
  const action = {
    network: lower(str(a.network)),
    contract: lower(str(a.contract)),
    operation: upper(str(a.operation)),
    assetCode: str(a.assetCode ?? a.asset),
    assetIssuer: str(a.assetIssuer) || null,
    amountMinor: decInt(a.amountMinor),
    destination: str(a.destination),
    memo: str(a.memo),
    atSeconds: decInt(a.atSeconds ?? args.nowSeconds),
  };

  if (action.network !== lower(str(p.network))) reasons.push({ code: "WRONG_NETWORK", detail: `action=${action.network} policy=${lower(str(p.network))}` });
  const ops = sorted(p.allowedOperations).map(upper);
  if (ops.length && !ops.includes(action.operation)) reasons.push({ code: "OPERATION_NOT_ALLOWED", detail: action.operation });
  const contracts = arr(p.allowedContracts).map(lower);
  if (contracts.length && !contracts.includes(action.contract)) reasons.push({ code: "CONTRACT_NOT_ALLOWED", detail: action.contract });

  const assets = arr(p.allowedAssets).filter(isObj);
  const assetOk = assets.some(
    (x) => (str(x.code) === "native" && ["native", "xlm"].includes(lower(action.assetCode))) || (lower(str(x.code)) === lower(action.assetCode) && (str(x.issuer) ? str(x.issuer) === action.assetIssuer || !action.assetIssuer : true)),
  );
  if (!assets.length || !assetOk) reasons.push({ code: "ASSET_NOT_ALLOWED", detail: `${action.assetCode}:${action.assetIssuer ?? "-"}` });

  const perAction = decInt(p.maxPerActionMinor);
  if (action.amountMinor === null) reasons.push({ code: "AMOUNT_UNPARSEABLE", detail: String(a.amountMinor) });
  else if (perAction === null || action.amountMinor > perAction) {
    reasons.push({ code: "PER_ACTION_CAP_EXCEEDED", detail: `${action.amountMinor} > ${perAction ?? "unset"}` });
  }
  const daily = decInt(p.dailyLimitMinor);
  if (daily !== null && action.amountMinor !== null && spent + action.amountMinor > daily) {
    reasons.push({ code: "DAILY_LIMIT_EXCEEDED", detail: `${spent + action.amountMinor} > ${daily}` });
  }

  const from = decInt(p.validFromSeconds);
  const expires = decInt(p.expiresAtSeconds);
  const at = action.atSeconds;
  if (now === null || at === null) reasons.push({ code: "TIME_UNPINNED", detail: "nowSeconds and action time must be pinned digits" });
  else {
    if (from !== null && at < from) reasons.push({ code: "NOT_YET_VALID", detail: `${at} < ${from}` });
    if (expires !== null && at >= expires) reasons.push({ code: "SESSION_EXPIRED", detail: `${at} >= ${expires}` });
  }

  if (p.requireMemo === true) {
    const prefix = str(p.memoPrefix);
    if (!action.memo) reasons.push({ code: "MEMO_REQUIRED", detail: "policy requires a memo" });
    else if (prefix && !action.memo.startsWith(prefix)) reasons.push({ code: "MEMO_PREFIX_MISMATCH", detail: `expected prefix ${prefix}` });
  }
  if (!action.destination) reasons.push({ code: "DESTINATION_MISSING", detail: "destination is required" });

  const allowed = reasons.length === 0;
  const first = reasons[0] ?? null;
  // Counterfactual names ONE change that would clear the first blocking rule;
  // it is advice for a human, never an automatic rewrite of the action.
  const counterfactual = !first
    ? null
    : first.code === "PER_ACTION_CAP_EXCEEDED"
      ? { change: "amount", to: String(perAction ?? "0"), note: "reducing the amount to the per-action cap still requires the caller's approval" }
      : first.code === "DAILY_LIMIT_EXCEEDED"
        ? { change: "amount", to: String(daily !== null && daily > spent ? daily - spent : 0n), note: "remaining daily budget, not an approval" }
        : first.code === "SESSION_EXPIRED"
          ? { change: "policy.expiresAtSeconds", to: "a later owner-approved expiry", note: "requires a new signed owner policy" }
          : { change: "caller input", to: `satisfy ${first.code}`, note: "no automatic fix is applied" };

  return ok("evaluate_stellar_session_key", {
    decision: allowed ? "ALLOW" : "DENY",
    sessionId: str(p.sessionId),
    actionDigest: digestOf(action),
    policyDigest: digestOf(p),
    reasons,
    counterfactual,
    spentTodayMinor: spent.toString(),
    remainingDailyMinor: daily !== null ? (daily > spent ? (daily - spent).toString() : "0") : null,
    ...summarizeChecks([
      check("DECISION", allowed, "CRITICAL", allowed ? "action satisfies the session policy" : `${reasons.length} blocking reason(s)`),
      check("SCOPE", ops.length > 0, "HIGH", "policy declares at least one operation"),
    ]),
  });
}

// 3 — intersect principal, session-key and requested scopes; name overreach.
export function verifyStellarSessionKeyScope(args = {}) {
  const badP = requireArr(args, "principalScope", "verify_stellar_session_key_scope");
  if (badP) return badP;
  const badS = requireArr(args, "sessionScope", "verify_stellar_session_key_scope");
  if (badS) return badS;
  const principal = sorted(args.principalScope);
  const session = sorted(args.sessionScope);
  const requested = sorted(args.requested ?? []);
  const sessionOverreach = session.filter((s) => !principal.includes(s));
  const requestOverreach = requested.filter((s) => !session.includes(s));
  const intersection = principal.filter((s) => session.includes(s));
  const checks = [
    check("PRINCIPAL_SCOPE", principal.length > 0, "CRITICAL", "principal scope is non-empty"),
    check("SESSION_SCOPE", session.length > 0, "CRITICAL", "session scope is non-empty"),
    check("SESSION_WITHIN_PRINCIPAL", sessionOverreach.length === 0, "CRITICAL", `session-only scopes: ${sessionOverreach.join(", ") || "none"}`),
    check("REQUEST_WITHIN_SESSION", requestOverreach.length === 0, "CRITICAL", `requested outside session: ${requestOverreach.join(", ") || "none"}`),
  ];
  return ok("verify_stellar_session_key_scope", {
    intersection,
    sessionOverreach,
    requestOverreach,
    scopeDigest: digestOf({ principal, session, requested }),
    ...summarizeChecks(checks),
  });
}

// 4 — smart-account signer set against an owner policy.
export function verifyStellarSmartAccountSigners(args = {}) {
  const bad = requireObj(args, "account", "verify_stellar_smart_account_signers");
  if (bad) return bad;
  const a = args.account;
  const p = isObj(args.policy) ? args.policy : {};
  const signers = arr(a.signers).filter(isObj).map((s) => ({
    key: str(s.key),
    kind: upper(str(s.kind || "ed25519")),
    weight: decInt(s.weight) ?? 0n,
  }));
  const thresholds = isObj(a.thresholds) ? a.thresholds : {};
  const low = decInt(thresholds.low) ?? 0n;
  const medium = decInt(thresholds.medium) ?? 0n;
  const high = decInt(thresholds.high) ?? 0n;
  const masterWeight = decInt(a.masterWeight);
  const allowedKinds = sorted(p.allowedKinds).map(upper);
  const maxSigners = decInt(p.maxSigners);
  const kindsOk = !allowedKinds.length || signers.every((s) => allowedKinds.includes(s.kind));
  const keysUnique = new Set(signers.map((s) => s.key)).size === signers.length;
  const kinds = [
    check("ACCOUNT_ID", !!str(a.accountId), "CRITICAL", "accountId present"),
    check("SIGNERS", signers.length > 0 && signers.every((s) => !!s.key), "CRITICAL", `${signers.length} signer(s), each with a key`),
    check("UNIQUE_KEYS", keysUnique, "CRITICAL", "signer keys are unique"),
    check("THRESHOLDS", low >= 0n && medium >= low && high >= medium && high > 0n, "CRITICAL", `low=${low} medium=${medium} high=${high}`),
    check("MAX_SIGNERS", maxSigners === null || BigInt(signers.length) <= maxSigners, "HIGH", "signer count within policy"),
    check("SIGNER_KINDS", kindsOk, "HIGH", `allowed kinds: ${allowedKinds.join(", ") || "any"}`),
    check("MASTER", masterWeight !== null, "HIGH", "masterWeight supplied"),
    check("MASTER_DISABLED", p.requireMasterDisabled !== true || masterWeight === 0n, "HIGH", "master key disabled when the policy requires it"),
  ];
  return ok("verify_stellar_smart_account_signers", {
    accountId: str(a.accountId),
    signerCount: signers.length,
    thresholds: { low: low.toString(), medium: medium.toString(), high: high.toString() },
    masterWeight: masterWeight?.toString() ?? null,
    signersDigest: digestOf(signers),
    ...summarizeChecks(kinds),
  });
}

// 5 — can the supplied signer weights actually reach a threshold?
export function verifyStellarMultisigThresholds(args = {}) {
  const bad = requireObj(args, "evidence", "verify_stellar_multisig_thresholds");
  if (bad) return bad;
  const e = args.evidence;
  const present = arr(e.presentSigners).filter(isObj).map((s) => ({ key: str(s.key), weight: decInt(s.weight) ?? 0n }));
  const t = isObj(e.thresholds) ? e.thresholds : {};
  const level = upper(str(args.level || e.level || "HIGH"));
  const required = decInt(t[level.toLowerCase()] ?? t[level]);
  const total = present.reduce((sum, s) => sum + s.weight, 0n);
  const checks = [
    check("SIGNERS", present.length > 0, "CRITICAL", `${present.length} present signer(s)`),
    check("WEIGHTS", present.every((s) => s.weight > 0n), "HIGH", "every present signer has a positive weight"),
    check("THRESHOLD_DECLARED", required !== null && required > 0n, "CRITICAL", `${level} threshold declared`),
    check("THRESHOLD_MET", required !== null && total >= required, "CRITICAL", `weight ${total} >= threshold ${required ?? "unset"}`),
  ];
  return ok("verify_stellar_multisig_thresholds", {
    level,
    requiredWeight: required?.toString() ?? null,
    presentWeight: total.toString(),
    presentSigners: present.map((s) => s.key),
    ...summarizeChecks(checks),
  });
}

// 6 — envelope time bounds and ledger bounds against a pinned clock/ledger.
export function verifyStellarTimeBounds(args = {}) {
  const bad = requireObj(args, "timeBounds", "verify_stellar_time_bounds");
  if (bad) return bad;
  const tb = args.timeBounds;
  const lb = isObj(args.ledgerBounds) ? args.ledgerBounds : null;
  const now = decInt(args.nowSeconds);
  const ledger = decInt(args.currentLedger);
  const maxDuration = decInt(args.maxDurationSeconds);
  const minTime = decInt(tb.minTime);
  const maxTime = decInt(tb.maxTime);
  const checks = [
    check("MIN_TIME", minTime !== null, "CRITICAL", "minTime parseable"),
    check("MAX_TIME", maxTime !== null, "CRITICAL", "maxTime parseable"),
    check("ORDERED", minTime !== null && maxTime !== null && maxTime > minTime, "CRITICAL", `maxTime ${maxTime} > minTime ${minTime}`),
    check("NOT_EXPIRED", now !== null && maxTime !== null ? maxTime > now : false, "CRITICAL", "maxTime is in the future at the pinned nowSeconds"),
    check("NOT_BEFORE", now !== null && minTime !== null ? minTime <= now : false, "HIGH", "minTime has been reached at the pinned nowSeconds"),
    check("DURATION", maxDuration === null || (minTime !== null && maxTime !== null && maxTime - minTime <= maxDuration), "HIGH", `duration within ${maxDuration ?? "unbounded"}s`),
  ];
  if (lb) {
    const minLedger = decInt(lb.minLedger);
    const maxLedger = decInt(lb.maxLedger);
    checks.push(check("LEDGER_ORDERED", minLedger !== null && maxLedger !== null && maxLedger > minLedger, "CRITICAL", "maxLedger > minLedger"));
    checks.push(check("LEDGER_WINDOW", ledger !== null && minLedger !== null && maxLedger !== null ? ledger >= minLedger && ledger < maxLedger : false, "CRITICAL", "pinned ledger is inside the declared ledger bounds"));
  }
  return ok("verify_stellar_time_bounds", {
    timeBounds: { minTime: minTime?.toString() ?? null, maxTime: maxTime?.toString() ?? null },
    ledgerBounds: lb ? { minLedger: str(lb.minLedger), maxLedger: str(lb.maxLedger) } : null,
    ...summarizeChecks(checks),
  });
}

// 7 — bind the envelope memo to the invoice/receipt digest it must carry.
export function verifyStellarMemoBinding(args = {}) {
  const badM = requireObj(args, "memo", "verify_stellar_memo_binding");
  if (badM) return badM;
  const badE = requireObj(args, "expected", "verify_stellar_memo_binding");
  if (badE) return badE;
  const m = args.memo;
  const x = args.expected;
  const type = upper(str(m.type || "text"));
  const value = str(m.value ?? m.text ?? m.hash);
  const expectedType = upper(str(x.type || "text"));
  const expectedValue = str(x.value ?? x.digest ?? x.invoiceId);
  const kinds = ["TEXT", "ID", "HASH", "RETURN"];
  const checks = [
    check("MEMO_PRESENT", !!value, "CRITICAL", "memo value present"),
    check("TYPE_VALID", kinds.includes(type), "CRITICAL", `type=${type}`),
    check("TYPE_MATCH", !expectedType || type === expectedType, "HIGH", `expected type ${expectedType}`),
    check("VALUE_MATCH", !expectedValue || value === expectedValue, "CRITICAL", "memo value matches the approved binding"),
    check("PREFIX", !str(x.prefix) || value.startsWith(str(x.prefix)), "MEDIUM", `prefix ${str(x.prefix) || "(none)"}`),
    check("HASH_SHAPE", type !== "HASH" || /^[0-9a-fA-F]{64}$/.test(value), "HIGH", "HASH memo is 64 hex characters"),
    check("ID_RANGE", type !== "ID" || (decInt(value) !== null && decInt(value) <= 18446744073709551615n), "HIGH", "ID memo is an unsigned 64-bit integer"),
  ];
  return ok("verify_stellar_memo_binding", {
    memo: { type, valueDigest: digestOf(value) },
    memoDigest: digestOf({ type, value }),
    ...summarizeChecks(checks),
  });
}

// 8 — asset allowlist with confusable-code (homoglyph) detection.
export function verifyStellarAssetAllowlist(args = {}) {
  const badA = requireObj(args, "asset", "verify_stellar_asset_allowlist");
  if (badA) return badA;
  const badL = requireArr(args, "allowlist", "verify_stellar_asset_allowlist");
  if (badL) return badL;
  const a = args.asset;
  const p = isObj(args.policy) ? args.policy : {};
  const code = str(a.code);
  const issuer = str(a.issuer);
  const allow = arr(args.allowlist).filter(isObj).map((x) => ({ code: str(x.code), issuer: str(x.issuer) }));
  const native = lower(code) === "native" || lower(code) === "xlm";
  const exact = allow.some((x) => lower(x.code) === lower(code) && (native || (x.issuer ? x.issuer === issuer : true)));
  const confusable = !exact
    ? allow.filter((x) => normalizeAssetCode(x.code) === normalizeAssetCode(code)).map((x) => x.code)
    : [];
  const checks = [
    check("CODE", !!code && code.length <= 12, "CRITICAL", `code=${code}`),
    check("ISSUER", native || !!issuer, "CRITICAL", "non-native asset carries an issuer"),
    check("ALLOWLIST", allow.length > 0, "CRITICAL", `${allow.length} allowed asset(s)`),
    check("EXACT_MATCH", exact, "CRITICAL", "asset code and issuer match an allowlist entry exactly"),
    check("NATIVE_POLICY", native !== true || p.allowNative !== false, "HIGH", "native asset allowed when the policy permits it"),
    check("ISSUER_ALLOWLIST", native || !p.requireIssuerAllowlist || allow.some((x) => x.issuer === issuer), "HIGH", "issuer is explicitly allowed"),
    check("NO_CONFUSABLE", confusable.length === 0, "CRITICAL", `confusable with allowed codes: ${confusable.join(", ") || "none"}`),
  ];
  return ok("verify_stellar_asset_allowlist", {
    asset: { code, issuer: issuer || null },
    matched: exact,
    confusableWith: confusable,
    assetDigest: digestOf({ code, issuer: issuer || null }),
    ...summarizeChecks(checks),
  });
}

// 9 — trustlines must be able to carry the planned spend.
export function verifyStellarTrustlinePolicy(args = {}) {
  const bad = requireArr(args, "trustlines", "verify_stellar_trustline_policy");
  if (bad) return bad;
  const lines = arr(args.trustlines).filter(isObj).map((l) => ({
    assetCode: str(l.assetCode || l.code),
    assetIssuer: str(l.assetIssuer || l.issuer) || null,
    limit: dec(l.limit ?? l.limitMinor) ?? "0",
    authorized: l.authorized === true,
    authorizedToMaintainLiabilities: l.authorizedToMaintainLiabilities === true,
  }));
  const plans = arr(args.plannedSpend).filter(isObj).map((s) => ({ assetCode: str(s.assetCode || s.code), amount: dec(s.amount ?? s.amountMinor) ?? "0" }));
  const p = isObj(args.policy) ? args.policy : {};
  const problems = [];
  for (const s of plans) {
    const line = lines.find((l) => lower(l.assetCode) === lower(s.assetCode));
    if (!line) problems.push({ assetCode: s.assetCode, code: "TRUSTLINE_MISSING" });
    else {
      const c = cmpDec(line.limit, s.amount);
      if (c === null || c < 0) problems.push({ assetCode: s.assetCode, code: "LIMIT_BELOW_SPEND" });
      if (p.requireAuthorized === true && !(line.authorized || line.authorizedToMaintainLiabilities)) problems.push({ assetCode: s.assetCode, code: "NOT_AUTHORIZED" });
    }
  }
  const checks = [
    check("TRUSTLINES", lines.length > 0, "CRITICAL", `${lines.length} trustline(s)`),
    check("LIMITS", lines.every((l) => dec(l.limit) !== null), "CRITICAL", "every trustline carries a parseable limit"),
    check("PLANNED_SPEND", plans.length > 0, "HIGH", `${plans.length} planned spend(s)`),
    check("COVERAGE", problems.length === 0, "CRITICAL", `${problems.length} trustline problem(s)`),
  ];
  return ok("verify_stellar_trustline_policy", {
    trustlineCount: lines.length,
    problems,
    trustlinesDigest: digestOf(lines),
    ...summarizeChecks(checks),
  });
}

// 10 — Soroban authorization entry matches the approved invocation.
export function verifyStellarSorobanAuthEntry(args = {}) {
  const badE = requireObj(args, "entry", "verify_stellar_soroban_auth_entry");
  if (badE) return badE;
  const badX = requireObj(args, "expected", "verify_stellar_soroban_auth_entry");
  if (badX) return badX;
  const e = args.entry;
  const x = args.expected;
  const p = isObj(args.policy) ? args.policy : {};
  const currentLedger = decInt(args.currentLedger);
  const expiration = decInt(e.signatureExpirationLedger);
  const allowedContracts = sorted(p.allowedContracts).map(lower);
  const sub = arr(e.subInvocations).filter(isObj);
  const checks = [
    check("CONTRACT", !!str(e.contractId), "CRITICAL", "contractId present"),
    check("CONTRACT_MATCH", lower(str(e.contractId)) === lower(str(x.contractId)), "CRITICAL", "contract matches the approved invocation"),
    check("CONTRACT_ALLOWED", !allowedContracts.length || allowedContracts.includes(lower(str(e.contractId))), "HIGH", "contract is on the policy allowlist"),
    check("FUNCTION", str(e.functionName) === str(x.functionName), "CRITICAL", `function=${str(e.functionName)}`),
    check("ARGS_DIGEST", !!str(e.argsDigest) && str(e.argsDigest) === str(x.argsDigest), "CRITICAL", "argument digest matches the approved bytes"),
    check("ROOT", p.requireRoot !== true || e.rootInvocation === true, "HIGH", "entry is the root invocation when required"),
    check("EXPIRATION", currentLedger !== null && expiration !== null ? expiration > currentLedger : false, "CRITICAL", "signature expiration ledger is in the future"),
    check("SUB_INVOCATIONS", !sub.length || sub.every((s) => !!str(s.contractId) && !!str(s.functionName)), "HIGH", "every sub-invocation is named"),
  ];
  return ok("verify_stellar_soroban_auth_entry", {
    contractId: str(e.contractId),
    functionName: str(e.functionName),
    subInvocations: sub.length,
    entryDigest: digestOf(e),
    ...summarizeChecks(checks),
  });
}

// 11 — Stellar Asset Contract allowance evidence (approve / transfer_from).
export function verifyStellarSacAllowance(args = {}) {
  const badE = requireObj(args, "evidence", "verify_stellar_sac_allowance");
  if (badE) return badE;
  const e = args.evidence;
  const x = isObj(args.expected) ? args.expected : {};
  const p = isObj(args.policy) ? args.policy : {};
  const amount = decInt(e.amount);
  const max = decInt(x.maxAmount ?? p.maxAmount);
  const currentLedger = decInt(args.currentLedger);
  const expiration = decInt(e.expirationLedger);
  const spenders = sorted(p.allowedSpenders).map(lower);
  const checks = [
    check("CONTRACT", !!str(e.contractId), "CRITICAL", "SAC contractId present"),
    check("FROM", !!str(e.from), "CRITICAL", "owner account present"),
    check("SPENDER", !!str(e.spender), "CRITICAL", "spender present"),
    check("SPENDER_ALLOWED", !spenders.length || spenders.includes(lower(str(e.spender))), "CRITICAL", "spender is on the policy allowlist"),
    check("AMOUNT", amount !== null && amount > 0n && (max === null || amount <= max), "CRITICAL", `amount=${e.amount} max=${x.maxAmount ?? p.maxAmount ?? "unset"}`),
    check("EXPIRATION", currentLedger !== null && expiration !== null ? expiration > currentLedger : false, "CRITICAL", "allowance has not expired at the pinned ledger"),
  ];
  return ok("verify_stellar_sac_allowance", {
    contractId: str(e.contractId),
    spender: str(e.spender),
    allowanceDigest: digestOf(e),
    ...summarizeChecks(checks),
  });
}

// 12 — fee-bump envelope binds the approved inner transaction and stays in budget.
export function assessStellarFeeBump(args = {}) {
  const bad = requireObj(args, "feeBump", "assess_stellar_fee_bump");
  if (bad) return bad;
  const f = args.feeBump;
  const p = isObj(args.policy) ? args.policy : {};
  const maxFee = decInt(p.maxFeeMinor);
  const fee = decInt(f.feeChargedMinor ?? f.maxFeeMinor);
  const sponsors = sorted(p.allowedFeeSponsors);
  const checks = [
    check("OUTER_SOURCE", !!str(f.outerSource), "CRITICAL", "fee-bump source present"),
    check("INNER_HASH", /^[0-9a-fA-F]{64}$/.test(str(f.innerTxHash)), "CRITICAL", "inner transaction hash is 32-byte hex"),
    check("HASH_MATCH", !str(p.expectedInnerTxHash) || lower(str(f.innerTxHash)) === lower(str(p.expectedInnerTxHash)), "CRITICAL", "inner hash matches the approved transaction"),
    check("INNER_SOURCE", !!str(f.innerSource), "HIGH", "inner source present"),
    check("SPONSOR_ALLOWED", !sponsors.length || sponsors.includes(str(f.outerSource)), "CRITICAL", "fee sponsor is on the policy allowlist"),
    check("FEE", fee !== null && (maxFee === null || fee <= maxFee), "CRITICAL", `fee ${f.feeChargedMinor ?? f.maxFeeMinor} <= cap ${p.maxFeeMinor ?? "unset"}`),
    check("SEPARATION", str(f.outerSource) !== str(f.innerSource), "MEDIUM", "fee sponsor differs from the inner source (sponsorship is explicit)"),
  ];
  return ok("assess_stellar_fee_bump", {
    innerTxHash: str(f.innerTxHash),
    outerSource: str(f.outerSource),
    feeBumpDigest: digestOf(f),
    ...summarizeChecks(checks),
  });
}

// 13 — claimable balance terms match what the agent is allowed to claim.
export function verifyStellarClaimableBalance(args = {}) {
  const bad = requireObj(args, "balance", "verify_stellar_claimable_balance");
  if (bad) return bad;
  const b = args.balance;
  const x = isObj(args.expected) ? args.expected : {};
  const now = decInt(args.nowSeconds);
  const claimants = arr(b.claimants).filter(isObj).map((c) => ({
    destination: str(c.destination),
    predicate: isObj(c.predicate) ? c.predicate : null,
  }));
  const match = claimants.find((c) => !str(x.destination) || c.destination === str(x.destination));
  const predicate = match?.predicate ?? null;
  const notBefore = predicate ? decInt(predicate.notBeforeAbsoluteTime) : null;
  const notAfter = predicate ? decInt(predicate.notAfterAbsoluteTime) : null;
  const amountOk = !str(x.amount) || cmpDec(b.amount, x.amount) === 0;
  const assetOk = !str(x.assetCode) || lower(str(b.assetCode)) === lower(str(x.assetCode));
  const checks = [
    check("BALANCE_ID", !!str(b.balanceId), "CRITICAL", "balanceId present"),
    check("AMOUNT", dec(b.amount) !== null && amountOk, "CRITICAL", `amount=${b.amount}`),
    check("ASSET", !!str(b.assetCode) && assetOk, "CRITICAL", `asset=${b.assetCode}`),
    check("CLAIMANT", claimants.length > 0 && !!match, "CRITICAL", "expected claimant is present"),
    check("PREDICATE_FROM", now !== null && notBefore !== null ? now >= notBefore : true, "HIGH", "absolute not-before has been reached"),
    check("PREDICATE_TO", now !== null && notAfter !== null ? now < notAfter : true, "CRITICAL", "absolute not-after has not passed at the pinned nowSeconds"),
    check("SPONSOR", !str(x.sponsor) || str(b.sponsor) === str(x.sponsor), "MEDIUM", "sponsor matches when expected"),
  ];
  return ok("verify_stellar_claimable_balance", {
    balanceId: str(b.balanceId),
    claimants: claimants.map((c) => c.destination),
    claimable: !!match && (notBefore === null || (now !== null && now >= notBefore)) && (notAfter === null || (now !== null && now < notAfter)),
    balanceDigest: digestOf(b),
    ...summarizeChecks(checks),
  });
}

// 14 — sponsored reserves stay inside the sponsor policy.
export function verifyStellarSponsoredReserve(args = {}) {
  const bad = requireObj(args, "sponsorship", "verify_stellar_sponsored_reserve");
  if (bad) return bad;
  const s = args.sponsorship;
  const p = isObj(args.policy) ? args.policy : {};
  const sponsors = sorted(p.allowedSponsors);
  const entries = decInt(s.numEntries);
  const maxEntries = decInt(p.maxSponsoredEntries);
  const reserve = dec(s.reserveXlm ?? s.reserveMinor);
  const maxReserve = dec(p.maxReserveXlm);
  const checks = [
    check("SPONSOR", !!str(s.sponsor), "CRITICAL", "sponsor present"),
    check("SPONSORED", !!str(s.sponsored), "CRITICAL", "sponsored account present"),
    check("SEPARATION", str(s.sponsor) !== str(s.sponsored), "HIGH", "sponsor and sponsored account differ"),
    check("SPONSOR_ALLOWED", !sponsors.length || sponsors.includes(str(s.sponsor)), "CRITICAL", "sponsor is on the policy allowlist"),
    check("ENTRIES", entries !== null && entries > 0n && (maxEntries === null || entries <= maxEntries), "HIGH", `${s.numEntries} entry(ies) within ${p.maxSponsoredEntries ?? "unbounded"}`),
    check("RESERVE", reserve !== null && (maxReserve === null || (cmpDec(reserve, maxReserve) ?? 1) <= 0), "HIGH", `reserve ${s.reserveXlm ?? s.reserveMinor} within ${p.maxReserveXlm ?? "unbounded"}`),
  ];
  return ok("verify_stellar_sponsored_reserve", {
    sponsor: str(s.sponsor),
    sponsored: str(s.sponsored),
    sponsorshipDigest: digestOf(s),
    ...summarizeChecks(checks),
  });
}

// 15 — sequence/replay guard across a batch of submissions.
export function verifyStellarSequenceGuard(args = {}) {
  const badE = requireObj(args, "submission", "verify_stellar_sequence_guard");
  if (badE) return badE;
  const s = args.submission;
  const seen = arr(args.seen).filter(isObj).map((x) => ({ sequence: str(x.sequence), txHash: str(x.txHash) }));
  const p = isObj(args.policy) ? args.policy : {};
  const maxGap = decInt(p.maxGap);
  const seq = decInt(s.sequence);
  const duplicateSeq = seen.some((x) => x.sequence === str(s.sequence));
  const duplicateHash = !!str(s.txHash) && seen.some((x) => lower(x.txHash) === lower(str(s.txHash)));
  const highest = seen.reduce((max, x) => {
    const n = decInt(x.sequence);
    return n !== null && (max === null || n > max) ? n : max;
  }, null);
  const gap = highest !== null && seq !== null ? seq - highest : null;
  const checks = [
    check("ACCOUNT", !!str(s.accountId), "CRITICAL", "accountId present"),
    check("SEQUENCE", seq !== null, "CRITICAL", "sequence is a digit string"),
    check("TX_HASH", /^[0-9a-fA-F]{64}$/.test(str(s.txHash)), "HIGH", "txHash is 32-byte hex"),
    check("NOT_REPLAYED_SEQ", !duplicateSeq, "CRITICAL", "sequence has not been submitted before"),
    check("NOT_REPLAYED_HASH", !duplicateHash, "CRITICAL", "tx hash has not been submitted before"),
    check("FORWARD_ONLY", highest === null || (seq !== null && seq > highest), "CRITICAL", "sequence is strictly ahead of the observed maximum"),
    check("GAP", maxGap === null || (gap !== null && gap <= maxGap), "HIGH", `gap ${gap ?? "n/a"} within ${maxGap ?? "unbounded"}`),
  ];
  return ok("verify_stellar_sequence_guard", {
    accountId: str(s.accountId),
    sequence: str(s.sequence),
    duplicate: duplicateSeq || duplicateHash,
    gap: gap?.toString() ?? null,
    ...summarizeChecks(checks),
  });
}

// 16 — exact operation set: count, order, type and argument drift.
export function verifyStellarOperationSet(args = {}) {
  const badA = requireArr(args, "approved", "verify_stellar_operation_set");
  if (badA) return badA;
  const badE = requireArr(args, "executed", "verify_stellar_operation_set");
  if (badE) return badE;
  const norm = (o) => ({
    type: upper(str(o.type)),
    destination: str(o.destination),
    asset: str(o.asset ?? o.assetCode),
    amount: dec(o.amount ?? o.amountMinor),
    memo: str(o.memo),
  });
  const approved = arr(args.approved).map(norm);
  const executed = arr(args.executed).map(norm);
  const drift = [];
  if (approved.length !== executed.length) drift.push({ code: "COUNT_DRIFT", detail: `approved=${approved.length} executed=${executed.length}` });
  const n = Math.min(approved.length, executed.length);
  for (let i = 0; i < n; i += 1) {
    const a = approved[i];
    const e = executed[i];
    if (a.type !== e.type) drift.push({ code: "TYPE_DRIFT", index: i, detail: `${a.type} -> ${e.type}` });
    if (a.destination !== e.destination) drift.push({ code: "DESTINATION_DRIFT", index: i, detail: `${a.destination} -> ${e.destination}` });
    if (a.asset !== e.asset) drift.push({ code: "ASSET_DRIFT", index: i, detail: `${a.asset} -> ${e.asset}` });
    if (cmpDec(a.amount, e.amount) !== 0) drift.push({ code: "AMOUNT_DRIFT", index: i, detail: `${a.amount} -> ${e.amount}` });
    if (a.memo !== e.memo) drift.push({ code: "MEMO_DRIFT", index: i, detail: `${a.memo} -> ${e.memo}` });
  }
  const checks = [
    check("APPROVED", approved.length > 0, "CRITICAL", `${approved.length} approved operation(s)`),
    check("EXECUTED", executed.length > 0, "CRITICAL", `${executed.length} executed operation(s)`),
    check("NO_DRIFT", drift.length === 0, "CRITICAL", `${drift.length} drift(s)`),
    check("ORDER", approved.every((a, i) => !executed[i] || a.type === executed[i].type) || drift.some((d) => d.code === "TYPE_DRIFT"), "HIGH", "operation order is compared positionally"),
  ];
  return ok("verify_stellar_operation_set", {
    drift,
    approvedDigest: digestOf(approved),
    executedDigest: digestOf(executed),
    ...summarizeChecks(checks),
  });
}

// 17 — DEX path payment slippage against a quote and a policy bound.
export function verifyStellarDexPath(args = {}) {
  const bad = requireObj(args, "pathPayment", "verify_stellar_dex_path");
  if (bad) return bad;
  const p = args.pathPayment;
  const q = isObj(args.quote) ? args.quote : {};
  const pol = isObj(args.policy) ? args.policy : {};
  const mode = lower(str(p.mode || p.type || "strict_send"));
  const maxSlippage = num(pol.maxSlippageBps) ?? 50;
  const sendAmount = dec(p.sendAmount ?? p.sendMax);
  const destAmount = dec(p.destAmount);
  const quoted = dec(q.destAmount ?? q.expectedDestAmount);
  const slippageBps = quoted !== null && destAmount !== null ? (() => {
    const c = cmpDec(destAmount, quoted);
    if (c === null) return null;
    const d = Number(destAmount);
    const e = Number(quoted);
    if (!Number.isFinite(d) || !Number.isFinite(e) || e <= 0) return null;
    return Math.round(((e - d) / e) * 10000);
  })() : null;
  const checks = [
    check("MODE", ["strict_send", "strict_receive"].includes(mode), "CRITICAL", `mode=${mode}`),
    check("SEND_ASSET", !!str(p.sendAsset), "CRITICAL", "send asset present"),
    check("DEST_ASSET", !!str(p.destAsset), "CRITICAL", "destination asset present"),
    check("DESTINATION", !!str(p.destination), "CRITICAL", "destination account present"),
    check("PATH", arr(p.path).length > 0, "HIGH", `${arr(p.path).length} hop(s)`),
    check("AMOUNTS", sendAmount !== null && destAmount !== null, "CRITICAL", "send and destination amounts parseable"),
    check("SLIPPAGE", slippageBps !== null && slippageBps >= 0 && slippageBps <= maxSlippage, "CRITICAL", `slippage ${slippageBps ?? "n/a"}bps within ${maxSlippage}bps`),
    check("SEND_MAX", mode !== "strict_send" || !str(p.sendMax) || (cmpDec(p.sendMax, p.sendAmount ?? p.sendMax) ?? 0) >= 0, "HIGH", "sendMax is not below the send amount"),
  ];
  return ok("verify_stellar_dex_path", {
    mode,
    slippageBps,
    pathLength: arr(p.path).length,
    pathDigest: digestOf(p),
    ...summarizeChecks(checks),
  });
}

// 18 — SEP-10 challenge transaction evidence.
export function verifyStellarSep10Challenge(args = {}) {
  const bad = requireObj(args, "challenge", "verify_stellar_sep10_challenge");
  if (bad) return bad;
  const c = args.challenge;
  const x = isObj(args.expected) ? args.expected : {};
  const now = decInt(args.nowSeconds);
  const tb = isObj(c.timeBounds) ? c.timeBounds : {};
  const minTime = decInt(tb.minTime);
  const maxTime = decInt(tb.maxTime);
  const ops = arr(c.operations).filter(isObj);
  const manageData = ops.filter((o) => upper(str(o.type)) === "MANAGE_DATA");
  const hasNonce = manageData.some((o) => str(o.name) === str(x.nonce || c.nonce));
  const checks = [
    check("HOME_DOMAIN", !!str(c.homeDomain) && (!str(x.homeDomain) || str(c.homeDomain) === str(x.homeDomain)), "CRITICAL", `homeDomain=${str(c.homeDomain)}`),
    check("WEB_AUTH_DOMAIN", !str(x.webAuthDomain) || str(c.webAuthDomain) === str(x.webAuthDomain), "HIGH", "webAuthDomain matches the expected anchor domain"),
    check("SERVER_KEY", !!str(c.serverSigningKey) && (!str(x.serverSigningKey) || str(c.serverSigningKey) === str(x.serverSigningKey)), "CRITICAL", "server signing key matches"),
    check("NETWORK", lower(str(c.networkPassphrase)) === lower(str(x.networkPassphrase || "testnet")), "CRITICAL", "network passphrase matches the expected network"),
    check("NONCE", hasNonce, "CRITICAL", "challenge carries the expected nonce"),
    check("TIME_BOUNDS", minTime !== null && maxTime !== null && maxTime > minTime && now !== null && maxTime > now && minTime <= now, "CRITICAL", "challenge window is valid at the pinned nowSeconds"),
    check("CLIENT_DOMAIN", !str(x.clientDomain) || str(c.clientDomain) === str(x.clientDomain), "HIGH", "client domain matches when expected"),
    check("OPERATIONS", ops.length > 0 && manageData.length > 0, "HIGH", "challenge includes manage-data operations"),
  ];
  return ok("verify_stellar_sep10_challenge", {
    homeDomain: str(c.homeDomain),
    noncePresent: hasNonce,
    challengeDigest: digestOf(c),
    ...summarizeChecks(checks),
  });
}

// 19 — SEP-24 / SEP-31 anchor transaction evidence.
export function verifyStellarSep24AnchorEvidence(args = {}) {
  const bad = requireObj(args, "evidence", "verify_stellar_sep24_anchor_evidence");
  if (bad) return bad;
  const e = args.evidence;
  const x = isObj(args.expected) ? args.expected : {};
  const now = decInt(args.nowSeconds);
  const expires = decInt(e.expiresAtSeconds);
  const status = upper(str(e.status));
  const kind = lower(str(e.kind));
  const fee = dec(e.fee);
  const feeOk = fee !== null && (cmpDec(fee, "0") ?? -1) >= 0;
  const amountOutOk = !str(x.minAmountOut) || (cmpDec(e.amountOut, x.minAmountOut) ?? -1) >= 0;
  const checks = [
    check("TRANSACTION_ID", !!str(e.transactionId), "CRITICAL", "anchor transactionId present"),
    check("KIND", ["deposit", "withdraw"].includes(kind), "CRITICAL", `kind=${kind}`),
    check("STATUS", ["COMPLETED", "PENDING_USER", "PENDING_ANCHOR", "PENDING_STELLAR", "PENDING_EXTERNAL"].includes(status), "CRITICAL", `status=${status}`),
    check("FINAL", status !== "COMPLETED" || !!str(e.stellarTransactionId), "CRITICAL", "a completed anchor transaction names its Stellar transaction"),
    check("ASSET", !!str(e.assetCode) && (!str(x.assetCode) || lower(str(e.assetCode)) === lower(str(x.assetCode))), "HIGH", `asset=${str(e.assetCode)}`),
    check("AMOUNTS", dec(e.amountIn) !== null && dec(e.amountOut) !== null, "CRITICAL", "amountIn and amountOut parseable"),
    check("MIN_OUT", amountOutOk, "CRITICAL", `amountOut ${str(e.amountOut)} >= ${str(x.minAmountOut) || "(no floor)"}`),
    check("FEE", feeOk, "HIGH", `fee ${str(e.fee)}`),
    check("QUOTE", !str(e.quoteId) || e.quoteId === str(x.quoteId || e.quoteId), "MEDIUM", "quote id matches when expected"),
    check("EXPIRY", expires === null || now === null ? true : now < expires, "HIGH", "quote/transaction has not expired at the pinned nowSeconds"),
  ];
  return ok("verify_stellar_sep24_anchor_evidence", {
    transactionId: str(e.transactionId),
    kind,
    anchorStatus: status,
    stellarTransactionId: str(e.stellarTransactionId) || null,
    evidenceDigest: digestOf(e),
    ...summarizeChecks(checks),
  });
}

// 20 — issue a session-scoped receipt binding policy, action and cumulative spend.
export function issueStellarSessionReceipt(args = {}) {
  const bad = requireObj(args, "evidence", "issue_stellar_session_receipt");
  if (bad) return bad;
  const e = args.evidence;
  const previous = decInt(e.spentMinorBefore);
  const after = decInt(e.spentMinorAfter);
  const receipt = {
    spec: WAVE6_VERSION,
    type: "stellar_session_receipt",
    sessionId: str(e.sessionId),
    network: lower(str(e.network)),
    policyDigest: str(e.policyDigest),
    actionDigest: str(e.actionDigest),
    decision: upper(str(e.decision || "ALLOW")),
    spentMinorBefore: previous?.toString() ?? null,
    spentMinorAfter: after?.toString() ?? null,
    previousReceiptDigest: str(e.previousReceiptDigest) || null,
    atSeconds: decInt(e.atSeconds ?? args.nowSeconds)?.toString() ?? null,
    stellarTxHash: str(e.stellarTxHash) || null,
  };
  const checks = [
    check("SESSION", !!receipt.sessionId, "CRITICAL", "sessionId present"),
    check("POLICY_DIGEST", SHA256.test(receipt.policyDigest), "CRITICAL", "policyDigest is a sha256 digest"),
    check("ACTION_DIGEST", SHA256.test(receipt.actionDigest), "CRITICAL", "actionDigest is a sha256 digest"),
    check("NETWORK", ["testnet", "mainnet", "futurenet"].includes(receipt.network), "CRITICAL", `network=${receipt.network}`),
    check("DECISION", ["ALLOW", "DENY"].includes(receipt.decision), "HIGH", `decision=${receipt.decision}`),
    check("SPEND_MONOTONIC", previous !== null && after !== null && after >= previous, "CRITICAL", `after ${after} >= before ${previous}`),
    check("TIME_PINNED", receipt.atSeconds !== null, "HIGH", "receipt time is pinned"),
    check("CHAIN", !receipt.previousReceiptDigest || SHA256.test(receipt.previousReceiptDigest), "HIGH", "previous receipt digest is a sha256 digest when chained"),
    check("TX", receipt.decision !== "ALLOW" || !receipt.stellarTxHash || /^[0-9a-fA-F]{64}$/.test(receipt.stellarTxHash), "MEDIUM", "Stellar tx hash is 32-byte hex when present"),
  ];
  return ok("issue_stellar_session_receipt", {
    receipt,
    receiptDigest: digestOf(receipt),
    ...summarizeChecks(checks),
  });
}

// ---------------------------------------------------------------------------
// MCP tool definitions / handlers / validators
// ---------------------------------------------------------------------------

const CALLER_CONTEXT = {
  type: "object",
  description: "Optional caller context echoed back in response (never a cryptographic input).",
  additionalProperties: true,
};
const schema = (properties, required, description) => ({
  type: "object",
  description,
  additionalProperties: true,
  properties: { ...properties, callerContext: CALLER_CONTEXT },
  ...(required ? { required } : {}),
});
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
const DEC = { type: "string", pattern: "^[0-9]+$" };
const DECIMAL = { type: "string", pattern: "^-?[0-9]+(\\.[0-9]+)?$" };
const ASSET = {
  type: "object",
  description: "Asset reference: native XLM, or a code plus issuer.",
  properties: { code: { type: "string" }, issuer: { type: "string" } },
};

export const WAVE6_TOOLS = Object.freeze([
  {
    name: "coreguard_compile_stellar_session_policy",
    description: "Compile a Stellar agent session-key policy (scopes, assets, per-action and daily caps, validity window) into a canonical digest-bound policy. Offline; no RPC.",
    inputSchema: schema({ policy: { type: "object" } }, ["policy"], "Session policy to canonicalize."),
    outputSchema: out("Canonical session policy, digest and checks."),
  },
  {
    name: "coreguard_evaluate_stellar_session_key",
    description: "Evaluate one proposed Stellar action against a session policy at a pinned time and cumulative spend, failing closed with named reasons and one counterfactual. No RPC, no signing.",
    inputSchema: schema({ policy: { type: "object" }, action: { type: "object" }, nowSeconds: DEC, spentTodayMinor: DEC }, ["policy", "action", "nowSeconds"], "Session policy, proposed action, pinned time and spend."),
    outputSchema: out("ALLOW/DENY decision, blocking reasons and counterfactual."),
  },
  {
    name: "coreguard_verify_stellar_session_key_scope",
    description: "Intersect principal, session-key and requested Stellar scopes and name any overreach before an agent action is authorized. Deterministic set arithmetic.",
    inputSchema: schema({ principalScope: { type: "array", items: { type: "string" } }, sessionScope: { type: "array", items: { type: "string" } }, requested: { type: "array", items: { type: "string" } } }, ["principalScope", "sessionScope"], "Principal, session and requested scopes."),
    outputSchema: out("Scope intersection and overreach lists."),
  },
  {
    name: "coreguard_verify_stellar_smart_account_signers",
    description: "Verify a caller-supplied Stellar smart-account signer set (weights, thresholds, signer kinds, master weight) against an owner policy. No account state is read.",
    inputSchema: schema({ account: { type: "object" }, policy: { type: "object" } }, ["account"], "Account signer configuration and optional policy."),
    outputSchema: out("Signer-set verdict, thresholds and digest."),
  },
  {
    name: "coreguard_verify_stellar_multisig_thresholds",
    description: "Check whether the supplied signer weights can reach the declared low/medium/high Stellar multisig threshold. Offline arithmetic; no network.",
    inputSchema: schema({ evidence: { type: "object" }, level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "low", "medium", "high"] } }, ["evidence"], "Present signers, weights and thresholds."),
    outputSchema: out("Threshold verdict with present and required weights."),
  },
  {
    name: "coreguard_verify_stellar_time_bounds",
    description: "Verify Stellar envelope time bounds and optional ledger bounds against a pinned clock and ledger, including a maximum duration policy. Offline.",
    inputSchema: schema({ timeBounds: { type: "object" }, ledgerBounds: { type: "object" }, nowSeconds: DEC, currentLedger: DEC, maxDurationSeconds: DEC }, ["timeBounds", "nowSeconds"], "Time/ledger bounds and pinned values."),
    outputSchema: out("Time-bounds and ledger-window verdict."),
  },
  {
    name: "coreguard_verify_stellar_memo_binding",
    description: "Bind a Stellar envelope memo (text/id/hash/return) to the approved invoice or receipt value, detecting type confusion and prefix drift. No chain call.",
    inputSchema: schema({ memo: { type: "object" }, expected: { type: "object" } }, ["memo", "expected"], "Memo and the approved binding."),
    outputSchema: out("Memo binding verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_asset_allowlist",
    description: "Check a Stellar asset (code + issuer) against an allowlist and flag confusable/homoglyph codes that imitate an allowed asset. Offline.",
    inputSchema: schema({ asset: ASSET, allowlist: { type: "array", items: ASSET }, policy: { type: "object" } }, ["asset", "allowlist"], "Asset, allowlist and optional policy."),
    outputSchema: out("Asset allowlist verdict and confusable matches."),
  },
  {
    name: "coreguard_verify_stellar_trustline_policy",
    description: "Verify caller-supplied Stellar trustlines can carry the planned spend (limit, authorization, missing lines) before an agent pays. No Horizon call.",
    inputSchema: schema({ trustlines: { type: "array", items: { type: "object" } }, plannedSpend: { type: "array", items: { type: "object" } }, policy: { type: "object" } }, ["trustlines", "plannedSpend"], "Trustlines, planned spend and optional policy."),
    outputSchema: out("Trustline coverage verdict and named problems."),
  },
  {
    name: "coreguard_verify_stellar_soroban_auth_entry",
    description: "Verify a caller-supplied Soroban authorization entry (contract, function, args digest, root flag, signature expiration ledger) matches the approved invocation. No Soroban RPC.",
    inputSchema: schema({ entry: { type: "object" }, expected: { type: "object" }, currentLedger: DEC, policy: { type: "object" } }, ["entry", "expected", "currentLedger"], "Auth entry, approved invocation and pinned ledger."),
    outputSchema: out("Soroban auth-entry verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_sac_allowance",
    description: "Verify Stellar Asset Contract allowance evidence (owner, spender, amount, expiration ledger) against policy. No contract call; no allowance is created.",
    inputSchema: schema({ evidence: { type: "object" }, expected: { type: "object" }, currentLedger: DEC, policy: { type: "object" } }, ["evidence", "currentLedger"], "SAC allowance evidence and pinned ledger."),
    outputSchema: out("SAC allowance verdict and digest."),
  },
  {
    name: "coreguard_assess_stellar_fee_bump",
    description: "Assess a Stellar fee-bump envelope for inner-transaction binding, sponsor allowlist and fee ceiling. Offline; nothing is signed or submitted.",
    inputSchema: schema({ feeBump: { type: "object" }, policy: { type: "object" } }, ["feeBump"], "Fee-bump evidence and optional policy."),
    outputSchema: out("Fee-bump verdict, binding and digest."),
  },
  {
    name: "coreguard_verify_stellar_claimable_balance",
    description: "Verify caller-supplied Stellar claimable-balance terms (claimants, predicate window, amount, asset, sponsor) against expectations at a pinned time. No Horizon call.",
    inputSchema: schema({ balance: { type: "object" }, expected: { type: "object" }, nowSeconds: DEC }, ["balance", "nowSeconds"], "Claimable balance and expectations."),
    outputSchema: out("Claimability verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_sponsored_reserve",
    description: "Verify Stellar sponsored-reserve evidence (sponsor allowlist, sponsored account, entry count, reserve ceiling). No account is created or funded.",
    inputSchema: schema({ sponsorship: { type: "object" }, policy: { type: "object" } }, ["sponsorship"], "Sponsorship evidence and optional policy."),
    outputSchema: out("Sponsored-reserve verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_sequence_guard",
    description: "Guard against Stellar replay: verify a submission sequence and transaction hash are unseen, strictly forward and within a policy gap. Offline.",
    inputSchema: schema({ submission: { type: "object" }, seen: { type: "array", items: { type: "object" } }, policy: { type: "object" } }, ["submission"], "Submission and previously seen sequences."),
    outputSchema: out("Sequence-guard verdict with replay and gap state."),
  },
  {
    name: "coreguard_verify_stellar_operation_set",
    description: "Compare an approved Stellar operation set with the executed one and name count, order, type, destination, asset, amount and memo drift. No chain call.",
    inputSchema: schema({ approved: { type: "array", items: { type: "object" } }, executed: { type: "array", items: { type: "object" } } }, ["approved", "executed"], "Approved and executed operation lists."),
    outputSchema: out("Exact operation-set drift report."),
  },
  {
    name: "coreguard_verify_stellar_dex_path",
    description: "Verify a caller-supplied Stellar DEX path payment against a quote and a slippage bound, naming hop count and effective basis points. No DEX call.",
    inputSchema: schema({ pathPayment: { type: "object" }, quote: { type: "object" }, policy: { type: "object" } }, ["pathPayment"], "Path payment, quote and optional policy."),
    outputSchema: out("Path-payment slippage verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_sep10_challenge",
    description: "Verify SEP-10 challenge evidence (home domain, web-auth domain, server key, nonce, network passphrase, time bounds) at a pinned time. No anchor call.",
    inputSchema: schema({ challenge: { type: "object" }, expected: { type: "object" }, nowSeconds: DEC }, ["challenge", "nowSeconds"], "Challenge evidence and expectations."),
    outputSchema: out("SEP-10 challenge verdict and digest."),
  },
  {
    name: "coreguard_verify_stellar_sep24_anchor_evidence",
    description: "Verify SEP-24/SEP-31 anchor transaction evidence (kind, status, amounts, fee, quote expiry, Stellar transaction id) against expectations. No anchor call.",
    inputSchema: schema({ evidence: { type: "object" }, expected: { type: "object" }, nowSeconds: DEC }, ["evidence"], "Anchor transaction evidence and expectations."),
    outputSchema: out("Anchor evidence verdict and digest."),
  },
  {
    name: "coreguard_issue_stellar_session_receipt",
    description: "Issue a digest-bound Stellar session receipt chaining policy digest, action digest, decision and cumulative spend for later owner review. Nothing is broadcast.",
    inputSchema: schema({ evidence: { type: "object" }, nowSeconds: DEC }, ["evidence"], "Session receipt evidence."),
    outputSchema: out("Session receipt record and digest."),
  },
]);

export const WAVE6_HANDLERS = Object.freeze({
  coreguard_compile_stellar_session_policy: (a) => compileStellarSessionPolicy(a),
  coreguard_evaluate_stellar_session_key: (a) => evaluateStellarSessionKey(a),
  coreguard_verify_stellar_session_key_scope: (a) => verifyStellarSessionKeyScope(a),
  coreguard_verify_stellar_smart_account_signers: (a) => verifyStellarSmartAccountSigners(a),
  coreguard_verify_stellar_multisig_thresholds: (a) => verifyStellarMultisigThresholds(a),
  coreguard_verify_stellar_time_bounds: (a) => verifyStellarTimeBounds(a),
  coreguard_verify_stellar_memo_binding: (a) => verifyStellarMemoBinding(a),
  coreguard_verify_stellar_asset_allowlist: (a) => verifyStellarAssetAllowlist(a),
  coreguard_verify_stellar_trustline_policy: (a) => verifyStellarTrustlinePolicy(a),
  coreguard_verify_stellar_soroban_auth_entry: (a) => verifyStellarSorobanAuthEntry(a),
  coreguard_verify_stellar_sac_allowance: (a) => verifyStellarSacAllowance(a),
  coreguard_assess_stellar_fee_bump: (a) => assessStellarFeeBump(a),
  coreguard_verify_stellar_claimable_balance: (a) => verifyStellarClaimableBalance(a),
  coreguard_verify_stellar_sponsored_reserve: (a) => verifyStellarSponsoredReserve(a),
  coreguard_verify_stellar_sequence_guard: (a) => verifyStellarSequenceGuard(a),
  coreguard_verify_stellar_operation_set: (a) => verifyStellarOperationSet(a),
  coreguard_verify_stellar_dex_path: (a) => verifyStellarDexPath(a),
  coreguard_verify_stellar_sep10_challenge: (a) => verifyStellarSep10Challenge(a),
  coreguard_verify_stellar_sep24_anchor_evidence: (a) => verifyStellarSep24AnchorEvidence(a),
  coreguard_issue_stellar_session_receipt: (a) => issueStellarSessionReceipt(a),
});

export const WAVE6_VALIDATORS = Object.freeze({
  coreguard_compile_stellar_session_policy: (a) => (isObj(a?.policy) ? null : { code: "MISSING_ARGUMENT", detail: "policy is required and must be an object" }),
  coreguard_evaluate_stellar_session_key: (a) => (isObj(a?.policy) && isObj(a?.action) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "policy, action and nowSeconds are required" }),
  coreguard_verify_stellar_session_key_scope: (a) => (Array.isArray(a?.principalScope) && Array.isArray(a?.sessionScope) ? null : { code: "MISSING_ARGUMENT", detail: "principalScope and sessionScope are required arrays" }),
  coreguard_verify_stellar_smart_account_signers: (a) => (isObj(a?.account) ? null : { code: "MISSING_ARGUMENT", detail: "account is required and must be an object" }),
  coreguard_verify_stellar_multisig_thresholds: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_verify_stellar_time_bounds: (a) => (isObj(a?.timeBounds) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "timeBounds and nowSeconds are required" }),
  coreguard_verify_stellar_memo_binding: (a) => (isObj(a?.memo) && isObj(a?.expected) ? null : { code: "MISSING_ARGUMENT", detail: "memo and expected are required objects" }),
  coreguard_verify_stellar_asset_allowlist: (a) => (isObj(a?.asset) && Array.isArray(a?.allowlist) ? null : { code: "MISSING_ARGUMENT", detail: "asset and allowlist are required" }),
  coreguard_verify_stellar_trustline_policy: (a) => (Array.isArray(a?.trustlines) && Array.isArray(a?.plannedSpend) ? null : { code: "MISSING_ARGUMENT", detail: "trustlines and plannedSpend are required arrays" }),
  coreguard_verify_stellar_soroban_auth_entry: (a) => (isObj(a?.entry) && isObj(a?.expected) && typeof a?.currentLedger === "string" ? null : { code: "MISSING_ARGUMENT", detail: "entry, expected and currentLedger are required" }),
  coreguard_verify_stellar_sac_allowance: (a) => (isObj(a?.evidence) && typeof a?.currentLedger === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence and currentLedger are required" }),
  coreguard_assess_stellar_fee_bump: (a) => (isObj(a?.feeBump) ? null : { code: "MISSING_ARGUMENT", detail: "feeBump is required and must be an object" }),
  coreguard_verify_stellar_claimable_balance: (a) => (isObj(a?.balance) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "balance and nowSeconds are required" }),
  coreguard_verify_stellar_sponsored_reserve: (a) => (isObj(a?.sponsorship) ? null : { code: "MISSING_ARGUMENT", detail: "sponsorship is required and must be an object" }),
  coreguard_verify_stellar_sequence_guard: (a) => (isObj(a?.submission) ? null : { code: "MISSING_ARGUMENT", detail: "submission is required and must be an object" }),
  coreguard_verify_stellar_operation_set: (a) => (Array.isArray(a?.approved) && Array.isArray(a?.executed) ? null : { code: "MISSING_ARGUMENT", detail: "approved and executed are required arrays" }),
  coreguard_verify_stellar_dex_path: (a) => (isObj(a?.pathPayment) ? null : { code: "MISSING_ARGUMENT", detail: "pathPayment is required and must be an object" }),
  coreguard_verify_stellar_sep10_challenge: (a) => (isObj(a?.challenge) && typeof a?.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "challenge and nowSeconds are required" }),
  coreguard_verify_stellar_sep24_anchor_evidence: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_issue_stellar_session_receipt: (a) => (isObj(a?.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
});
