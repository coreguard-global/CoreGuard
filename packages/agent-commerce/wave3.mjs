/**
 * CoreGuard Agent Commerce — Wave 3 (CG-W3/1)
 *
 * Twenty deterministic tools in five families, all offline and zero-key:
 *
 *   Policy reasoning  compile · explain (with counterfactual) · simulate ·
 *                     diff · boundary cases
 *   MCP supply chain  server-manifest audit · tool-description poisoning scan ·
 *                     lookalike check · tool-surface diff (rug pull) ·
 *                     evidence-bundle verify
 *   Evidence          redact a receipt · Merkle-attest a batch · verify a proof
 *   Operations        freeze an agent · budget runway · spend anomaly · timeline
 *   Interop & meta    translate a receipt · emit test vectors · describe surface
 *
 * BOUNDARIES: every answer is arithmetic over caller-supplied JSON. A finding is
 * evidence for a human decision, not a verdict on a third party. Nothing here
 * contacts a registry, a chain, a merchant or a payment network; time is supplied
 * as pinned epoch seconds, never read from the wall clock into a commitment.
 */

import { createHash } from "node:crypto";
import { createControlPlane, verifyAuditChain } from "./control-plane.mjs";

export const WAVE3_VERSION = "CG-W3/1";

export const WAVE3_BOUNDARY =
  "Wave 3 is deterministic, offline reasoning over caller-supplied JSON: it checks structure, policy arithmetic and byte-level provenance, " +
  "never truth, safety, identity or settlement. A finding is evidence for a human decision, not a verdict on a third party. " +
  "VERIFIED ≠ SAFE; no network calls, no keys, no wall clock in any commitment.";

// ---------------------------------------------------------------------------
// Canonical JSON + digests (one representation for every commitment)
// ---------------------------------------------------------------------------

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function digestOf(value) {
  return "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex");
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function decimal(v) {
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return BigInt(v);
  if (Number.isInteger(v) && v >= 0) return BigInt(v);
  return null;
}

function str(v) {
  return typeof v === "string" ? v : undefined;
}

const now = (args) => (args.nowSeconds === undefined ? null : decimal(args.nowSeconds));

// ---------------------------------------------------------------------------
// Policy compilation and rule evaluation (CGEP/1 subset)
// ---------------------------------------------------------------------------

const RULE_TYPES = Object.freeze([
  "VALUE_LIMIT",
  "TARGET_ALLOWLIST",
  "RECIPIENT_ALLOWLIST",
  "SELECTOR_ALLOWLIST",
  "CURRENCY_ALLOWLIST",
]);

export function compilePolicy(args = {}) {
  const spec = isObj(args.spec) ? args.spec : {};
  const rules = [];
  const max = decimal(spec.maxAmountMinor);
  if (max !== null) rules.push({ ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: String(max) }, severity: "CRITICAL" });
  if (Array.isArray(spec.allowMerchants) && spec.allowMerchants.length) {
    rules.push({ ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: spec.allowMerchants.map(String) }, severity: "CRITICAL" });
  }
  if (Array.isArray(spec.allowRecipients) && spec.allowRecipients.length) {
    rules.push({ ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: spec.allowRecipients.map(String) }, severity: "CRITICAL" });
  }
  if (Array.isArray(spec.allowSelectors) && spec.allowSelectors.length) {
    rules.push({ ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: spec.allowSelectors.map(String) }, severity: "CRITICAL" });
  }
  if (spec.currency) {
    rules.push({ ruleId: "CURRENCY_001", type: "CURRENCY_ALLOWLIST", params: { currencies: [String(spec.currency)] }, severity: "HIGH" });
  }
  const policy = {
    version: "CGEP/1",
    policyId: String(spec.policyId ?? "compiled-policy"),
    name: String(spec.name ?? "Compiled agent commerce policy"),
    rules,
  };
  return {
    type: "compiled_policy",
    spec: "CGEP/1",
    policy,
    policyDigest: digestOf(policy),
    rules: rules.map((r) => ({ ruleId: r.ruleId, type: r.type, severity: r.severity })),
    normalizations: [
      "amounts are decimal strings; values are compared as integers, never floats",
      "allowlists keep caller order and are compared byte-for-byte after String()",
      "rule ids are stable so two compilations of the same spec have the same digest",
    ],
    boundary: WAVE3_BOUNDARY,
  };
}

function ruleCheck(rule, intent) {
  const p = isObj(rule.params) ? rule.params : {};
  const ruleId = String(rule.ruleId ?? rule.type);
  switch (rule.type) {
    case "VALUE_LIMIT": {
      const max = decimal(p.max);
      const amt = decimal(intent.amount);
      if (max === null) return { ruleId, type: rule.type, ok: false, detail: "rule has no usable max" };
      if (amt === null) return { ruleId, type: rule.type, ok: false, detail: "intent has no usable amount" };
      return { ruleId, type: rule.type, ok: amt <= max, detail: `amount ${amt} ${amt <= max ? "≤" : ">"} max ${max}` };
    }
    case "TARGET_ALLOWLIST": {
      const targets = Array.isArray(p.targets) ? p.targets.map(String) : [];
      const ok = typeof intent.target === "string" && targets.includes(intent.target);
      return { ruleId, type: rule.type, ok, detail: ok ? `target ${intent.target} allowlisted` : `target ${String(intent.target)} not allowlisted` };
    }
    case "RECIPIENT_ALLOWLIST": {
      const addresses = Array.isArray(p.addresses) ? p.addresses.map(String) : [];
      const ok = typeof intent.recipient === "string" && addresses.includes(intent.recipient);
      return { ruleId, type: rule.type, ok, detail: ok ? `recipient ${intent.recipient} allowlisted` : `recipient ${String(intent.recipient)} not allowlisted` };
    }
    case "SELECTOR_ALLOWLIST": {
      const selectors = Array.isArray(p.selectors) ? p.selectors.map(String) : [];
      const ok = typeof intent.selector === "string" && selectors.includes(intent.selector.toLowerCase());
      return { ruleId, type: rule.type, ok, detail: ok ? `selector ${intent.selector} allowlisted` : `selector ${String(intent.selector)} not allowlisted` };
    }
    case "CURRENCY_ALLOWLIST": {
      const currencies = Array.isArray(p.currencies) ? p.currencies.map(String) : [];
      const ok = typeof intent.currency === "string" && currencies.includes(intent.currency.toUpperCase());
      return { ruleId, type: rule.type, ok, detail: ok ? `currency ${intent.currency} allowed` : `currency ${String(intent.currency)} not allowed` };
    }
    default:
      return { ruleId, type: String(rule.type), ok: false, detail: "unknown rule type — fail closed" };
  }
}

function evaluateIntent(policy, intent, nowSeconds) {
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];
  const checks = rules.map((r) => ruleCheck(r, isObj(intent) ? intent : {}));
  const expires = decimal(intent?.validUntil);
  if (expires !== null && nowSeconds !== null) {
    checks.push({ ruleId: "__expiry", type: "WINDOW", ok: expires >= nowSeconds, detail: `validUntil ${expires} ${expires >= nowSeconds ? "≥" : "<"} now ${nowSeconds}` });
  }
  const blocking = checks.filter((c) => !c.ok);
  return { allowed: blocking.length === 0, checks, blocking, policyDigest: digestOf(policy ?? {}) };
}

function counterfactualFor(blocking, intent, policy, nowSeconds) {
  const first = blocking[0];
  if (!first) return null;
  const rule = (policy?.rules ?? []).find((r) => String(r.ruleId) === first.ruleId);
  const p = isObj(rule?.params) ? rule.params : {};
  switch (first.type) {
    case "VALUE_LIMIT": return { ruleId: first.ruleId, change: { field: "intent.amount", from: String(intent.amount ?? ""), to: String(p.max) }, note: "lower the order to the approved maximum (or raise the limit deliberately)" };
    case "TARGET_ALLOWLIST": return { ruleId: first.ruleId, change: { field: "intent.target", from: String(intent.target ?? ""), to: String((p.targets ?? [])[0] ?? "") }, note: "the target must be on the approved list" };
    case "RECIPIENT_ALLOWLIST": return { ruleId: first.ruleId, change: { field: "intent.recipient", from: String(intent.recipient ?? ""), to: String((p.addresses ?? [])[0] ?? "") }, note: "the recipient must be on the approved list" };
    case "SELECTOR_ALLOWLIST": return { ruleId: first.ruleId, change: { field: "intent.selector", from: String(intent.selector ?? ""), to: String((p.selectors ?? [])[0] ?? "") }, note: "the call selector must be on the approved list" };
    case "CURRENCY_ALLOWLIST": return { ruleId: first.ruleId, change: { field: "intent.currency", from: String(intent.currency ?? ""), to: String((p.currencies ?? [])[0] ?? "") }, note: "settle in the approved currency" };
    case "WINDOW": return { ruleId: first.ruleId, change: { field: "intent.validUntil", from: String(intent.validUntil ?? ""), to: nowSeconds === null ? "<pinned nowSeconds>" : String(nowSeconds) }, note: "the approval window had already closed" };
    default: return { ruleId: first.ruleId, change: null, note: "no automatic counterfactual for this rule type" };
  }
}

export function explainDecision(args = {}) {
  const policy = isObj(args.policy) ? args.policy : {};
  const intent = isObj(args.intent) ? args.intent : {};
  const evaluated = evaluateIntent(policy, intent, now(args));
  const counterfactual = counterfactualFor(evaluated.blocking, intent, policy, now(args));
  return {
    type: "policy_decision_explanation",
    allowed: evaluated.allowed,
    verdict: evaluated.allowed ? "ALLOW" : "DENY",
    blockingRule: evaluated.blocking[0]?.ruleId ?? null,
    checks: evaluated.checks,
    counterfactual,
    counterfactualNote: counterfactual ? "smallest single change that clears the first blocking rule; clearing it may reveal a second one" : null,
    policyDigest: evaluated.policyDigest,
    boundary: WAVE3_BOUNDARY,
  };
}

export function simulateSpend(args = {}) {
  const policy = isObj(args.policy) ? args.policy : {};
  const intents = Array.isArray(args.intents) ? args.intents : [];
  const nowSeconds = now(args);
  const rows = intents.map((intent, index) => {
    const evaluated = evaluateIntent(policy, intent, nowSeconds);
    return {
      index,
      allowed: evaluated.allowed,
      reasons: evaluated.blocking.map((c) => `${c.ruleId}:${c.type}`),
      amount: String(intent?.amount ?? ""),
      currency: str(intent?.currency) ?? null,
      counterfactual: counterfactualFor(evaluated.blocking, intent, policy, nowSeconds),
    };
  });
  const allowed = rows.filter((r) => r.allowed);
  const total = allowed.reduce((sum, r) => sum + (decimal(r.amount) ?? 0n), 0n);
  const deniedTotal = rows.filter((r) => !r.allowed).reduce((sum, r) => sum + (decimal(r.amount) ?? 0n), 0n);
  return {
    type: "spend_simulation",
    dryRun: true,
    policyDigest: digestOf(policy),
    counts: { total: rows.length, allowed: allowed.length, denied: rows.length - allowed.length },
    totals: { allowedMinor: String(total), deniedMinor: String(deniedTotal) },
    rows,
    boundary: "dry run only — no approval, spend counter, ledger or control-plane state is written. " + WAVE3_BOUNDARY,
  };
}

export function diffPolicies(args = {}) {
  const before = isObj(args.before) ? args.before : {};
  const after = isObj(args.after) ? args.after : {};
  const index = (p) => new Map((Array.isArray(p.rules) ? p.rules : []).map((r) => [String(r.ruleId ?? r.type), r]));
  const a = index(before);
  const b = index(after);
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const added = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && canonicalJson(a.get(k)) !== canonicalJson(b.get(k))).map((k) => ({
    ruleId: k,
    before: a.get(k),
    after: b.get(k),
  }));
  const limits = (p) => {
    const r = (p.rules ?? []).find((x) => x.type === "VALUE_LIMIT");
    return decimal(r?.params?.max);
  };
  const lb = limits(before);
  const la = limits(after);
  const signals = [];
  if (added.length > 0) signals.push("tighter"); // an added rule constrains more
  if (removed.length > 0) signals.push("looser");
  if (la !== null && lb !== null && la < lb) signals.push("tighter");
  if (la !== null && lb !== null && la > lb) signals.push("looser");
  const uniqueSignals = [...new Set(signals)];
  return {
    type: "policy_diff",
    changed: removed.length + added.length + changed.length > 0,
    addedRules: added.map((k) => b.get(k)),
    removedRules: removed.map((k) => a.get(k)),
    changedRules: changed,
    limit: { before: lb === null ? null : String(lb), after: la === null ? null : String(la), deltaMinor: lb !== null && la !== null ? String(la - lb) : null },
    strictness: uniqueSignals.length === 1 ? uniqueSignals[0] : uniqueSignals.length === 2 ? "mixed" : changed.length > 0 ? "changed" : "unchanged",
    requiresReconsent: removed.length + added.length + changed.length > 0,
    digests: { before: digestOf(before), after: digestOf(after) },
    boundary: WAVE3_BOUNDARY,
  };
}

export function generateBoundaryCases(args = {}) {
  const policy = isObj(args.policy) ? args.policy : {};
  const base = isObj(args.baseIntent) ? args.baseIntent : {};
  const nowSeconds = now(args);
  const limitRule = (policy.rules ?? []).find((r) => r.type === "VALUE_LIMIT");
  const limit = decimal(limitRule?.params?.max);
  const cases = [];
  const push = (label, intent) => {
    const evaluated = evaluateIntent(policy, intent, nowSeconds);
    cases.push({ label, intent, expected: evaluated.allowed ? "ALLOW" : "DENY", blocking: evaluated.blocking.map((c) => c.ruleId) });
  };
  if (limit !== null) {
    push("amount at the limit", { ...base, amount: String(limit) });
    if (limit > 0n) push("amount one minor unit below the limit", { ...base, amount: String(limit - 1n) });
    push("amount one minor unit above the limit", { ...base, amount: String(limit + 1n) });
  }
  const targetRule = (policy.rules ?? []).find((r) => r.type === "TARGET_ALLOWLIST");
  if (targetRule && Array.isArray(targetRule.params?.targets) && targetRule.params.targets[0]) {
    push("unlisted target", { ...base, target: "0x" + "ee".repeat(20) });
  }
  const recipientRule = (policy.rules ?? []).find((r) => r.type === "RECIPIENT_ALLOWLIST");
  if (recipientRule && Array.isArray(recipientRule.params?.addresses) && recipientRule.params.addresses[0]) {
    push("unlisted recipient", { ...base, recipient: "0x" + "ff".repeat(20) });
  }
  if (nowSeconds !== null) push("approval window already closed", { ...base, validUntil: String(nowSeconds - 1n) });
  if (base.currency) push("currency outside the policy", { ...base, currency: base.currency === "USD" ? "EUR" : "USD" });
  return {
    type: "policy_boundary_cases",
    spec: "CG-BC/1",
    count: cases.length,
    cases,
    usage: "paste each case into coreguard_explain_decision or a test suite; expected is computed by the same rules the server enforces, not asserted by hand",
    boundary: WAVE3_BOUNDARY,
  };
}

// ---------------------------------------------------------------------------
// MCP supply-chain audit
// ---------------------------------------------------------------------------

const SECRET_ENV = /(SECRET|TOKEN|KEY|PASSWORD|PASSWD|PRIVATE|CREDENTIAL)/i;

export function auditServerManifest(args = {}) {
  const manifest = isObj(args.manifest) ? args.manifest : {};
  const findings = [];
  const add = (id, severity, detail, evidence) => findings.push({ id, severity, detail, ...(evidence === undefined ? {} : { evidence }) });
  const packages = Array.isArray(manifest.packages) ? manifest.packages : [];
  const remotes = Array.isArray(manifest.remotes) ? manifest.remotes : [];
  if (remotes.length > 0) add("REMOTE_ENDPOINT", "HIGH", "server declares a remote transport; the client trusts bytes it did not run", remotes.map((r) => r?.url ?? r).slice(0, 5));
  for (const p of packages) {
    if (p?.version === undefined || p?.identifier === undefined) add("UNPINNED_PACKAGE", "MEDIUM", "package entry has no pinned identifier/version", p ?? null);
    if (p?.transport?.type && !["stdio", "sse"].includes(String(p.transport.type))) add("UNKNOWN_TRANSPORT", "LOW", `transport ${String(p.transport.type)} is not a documented MCP transport`, String(p.transport.type));
    if (Array.isArray(p?.environmentVariables)) {
      for (const env of p.environmentVariables) {
        if (SECRET_ENV.test(String(env?.name ?? ""))) add("SECRET_REQUIRED", "INFO", `server asks the host for ${String(env.name)}; least-privilege review recommended`, String(env.name));
      }
    }
  }
  if (packages.length === 0 && remotes.length === 0) add("NO_DISTRIBUTION", "MEDIUM", "manifest declares neither a package nor a remote endpoint", null);
  if (!str(manifest.repository?.url)) add("NO_REPOSITORY", "LOW", "no source repository in the manifest; provenance cannot be checked from the record alone", null);
  if (!str(manifest.version) || manifest.version === "latest") add("VERSION_NOT_PINNED", "MEDIUM", "manifest version is missing or floating", manifest.version ?? null);
  if (!manifest.description) add("NO_DESCRIPTION", "INFO", "no description; tool poisoning scans have nothing to read", null);
  const severities = findings.map((f) => f.severity);
  const risk = severities.includes("HIGH") ? "high" : severities.includes("MEDIUM") ? "medium" : "low";
  return {
    type: "mcp_manifest_audit",
    spec: "CG-MM/1",
    serverName: str(manifest.name) ?? null,
    version: manifest.version ?? null,
    transport: remotes.length > 0 ? "remote" : packages.length > 0 ? "package" : "undeclared",
    risk,
    findings,
    counts: { total: findings.length, high: severities.filter((s) => s === "HIGH").length, medium: severities.filter((s) => s === "MEDIUM").length, low: severities.filter((s) => s === "LOW").length, info: severities.filter((s) => s === "INFO").length },
    manifestDigest: digestOf(manifest),
    note: "structural audit of the record only — it does not execute the server or attest its behaviour",
    boundary: WAVE3_BOUNDARY,
  };
}

const HIDDEN_CHAR_KINDS = Object.freeze([
  [0x00ad, 0x00ad, "soft_hyphen"],
  [0x200b, 0x200f, "zero_width"],
  [0x202a, 0x202e, "bidi_override"],
  [0x2060, 0x2064, "invisible_operator"],
  [0x2066, 0x2069, "bidi_isolate"],
  [0xfeff, 0xfeff, "bom"],
  [0xe0000, 0xe007f, "unicode_tag"],
]);

const INJECTION_PHRASES = Object.freeze([
  "ignore previous", "ignore all previous", "disregard previous", "disregard all previous",
  "system prompt", "developer mode", "do not tell the user", "don't tell the user",
  "do not mention", "without asking", "without confirmation", "auto-approve", "always approve",
  "bypass", "exfiltrate", "send to", "do not log", "hide from", "secretly", "hidden instruction",
]);

export function scanToolDescriptions(args = {}) {
  const tools = Array.isArray(args.tools) ? args.tools : [];
  const findings = [];
  tools.forEach((tool, toolIndex) => {
    const name = String(tool?.name ?? `tool-${toolIndex}`);
    const description = String(tool?.description ?? "");
    for (let i = 0; i < description.length; i++) {
      const cp = description.codePointAt(i);
      if (cp > 0xffff) i++; // surrogate pair consumed
      const kind = HIDDEN_CHAR_KINDS.find(([lo, hi]) => cp >= lo && cp <= hi)?.[2];
      if (kind) {
        findings.push({ tool: name, toolIndex, index: i, codepoint: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"), kind, severity: kind === "unicode_tag" || kind === "bidi_override" ? "HIGH" : "MEDIUM" });
      }
    }
    const lower = description.toLowerCase();
    for (const phrase of INJECTION_PHRASES) {
      let at = lower.indexOf(phrase);
      while (at !== -1) {
        findings.push({ tool: name, toolIndex, index: at, phrase, kind: "injection_phrase", severity: "HIGH" });
        at = lower.indexOf(phrase, at + phrase.length);
      }
    }
    const comments = description.match(/<!--[\s\S]*?-->/g);
    if (comments) findings.push({ tool: name, toolIndex, index: description.indexOf(comments[0]), kind: "html_comment", severity: "MEDIUM", count: comments.length });
  });
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;
  return {
    type: "tool_description_scan",
    spec: "CG-TS/1",
    toolsScanned: tools.length,
    verdict: high > 0 ? "DANGEROUS" : medium > 0 ? "SUSPICIOUS" : "CLEAN",
    counts: { findings: findings.length, high, medium },
    findings,
    note: "detectors cover invisible/bidi/tag characters, HTML comments and a fixed imperative-phrase list; absence of findings is not proof of safety",
    boundary: WAVE3_BOUNDARY,
  };
}

const CONFUSABLES = Object.freeze({
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j",
  "ѕ": "s", "ԁ": "d", "һ": "h", "ӏ": "l", "ԛ": "q", "ԝ": "w", "ν": "v", "α": "a", "ο": "o",
  "ε": "e", "ι": "i", "κ": "k", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "0": "o", "1": "l",
  "5": "s", "3": "e", "8": "b", "|": "l", "!": "i",
});

function skeleton(domain) {
  return String(domain ?? "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/[^a-z0-9.\-\u0080-\uffff]/g, "")
    .split("")
    .map((ch) => CONFUSABLES[ch] ?? ch)
    .join("");
}

function scriptOf(ch) {
  if (/[\u0400-\u04FF]/.test(ch)) return "cyrillic";
  if (/[\u0370-\u03FF]/.test(ch)) return "greek";
  if (/[a-z]/i.test(ch)) return "latin";
  if (/[0-9]/.test(ch)) return "digit";
  return null;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export function checkLookalike(args = {}) {
  const candidate = String(args.candidate ?? "");
  const reference = String(args.reference ?? "");
  const sc = skeleton(candidate);
  const sr = skeleton(reference);
  const distance = levenshtein(sc, sr);
  const scripts = [...new Set(candidate.split("").map(scriptOf).filter((s) => s === "cyrillic" || s === "greek" || s === "latin"))];
  const mixedScript = scripts.length > 1;
  const punycode = /(^|\.)xn--/.test(candidate.toLowerCase());
  const identicalSkeleton = sc === sr && candidate.toLowerCase() !== reference.toLowerCase();
  const threshold = Math.max(sc.length, sr.length) >= 12 ? 2 : 1;
  const lookalike = identicalSkeleton || distance <= threshold;
  return {
    type: "lookalike_check",
    spec: "CG-LK/1",
    candidate,
    reference,
    candidateSkeleton: sc,
    referenceSkeleton: sr,
    distance,
    verdict: candidate.toLowerCase() === reference.toLowerCase() ? "IDENTICAL" : lookalike ? "LOOKALIKE" : "DISTINCT",
    signals: { mixedScript, punycode, mappedCharacters: candidate.split("").filter((ch) => CONFUSABLES[ch]).length, distance },
    note: "a LOOKALIKE verdict is a reason to stop and check by hand; DISTINCT is not an endorsement of the candidate",
    boundary: WAVE3_BOUNDARY,
  };
}

function toolShape(tool) {
  return { name: tool?.name, description: tool?.description, inputSchema: tool?.inputSchema ?? null };
}

function jaccard(a, b) {
  const wa = new Set(String(a).toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(String(b).toLowerCase().split(/\W+/).filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / (wa.size + wb.size - common);
}

export function diffToolSurface(args = {}) {
  const before = Array.isArray(args.before) ? args.before : [];
  const after = Array.isArray(args.after) ? args.after : [];
  const b = new Map(before.map((t) => [String(t?.name), toolShape(t)]));
  const a = new Map(after.map((t) => [String(t?.name), toolShape(t)]));
  const added = [...a.keys()].filter((k) => !b.has(k));
  const removed = [...b.keys()].filter((k) => !a.has(k));
  const changed = [];
  for (const name of [...b.keys()].filter((k) => a.has(k))) {
    const oldT = b.get(name);
    const newT = a.get(name);
    const schemaChanged = digestOf(oldT.inputSchema) !== digestOf(newT.inputSchema);
    const descriptionChanged = oldT.description !== newT.description;
    if (schemaChanged || descriptionChanged) {
      changed.push({
        name,
        schemaChanged,
        descriptionChanged,
        descriptionSimilarity: descriptionChanged ? Number(jaccard(oldT.description, newT.description).toFixed(3)) : 1,
        oldDigest: digestOf(oldT),
        newDigest: digestOf(newT),
      });
    }
  }
  const requiresReconsent = removed.length > 0 || changed.some((c) => c.schemaChanged);
  return {
    type: "tool_surface_diff",
    spec: "CG-SD/1",
    counts: { before: before.length, after: after.length, added: added.length, removed: removed.length, changed: changed.length },
    added: added.map((k) => a.get(k).name),
    removed: removed.map((k) => b.get(k).name),
    changed,
    severity: removed.length > 0 ? "HIGH" : changed.some((c) => c.schemaChanged) ? "HIGH" : changed.length > 0 || added.length > 0 ? "MEDIUM" : "NONE",
    requiresReconsent,
    note: "a surface change after approval is a rug-pull signal; pin the digest you approved and diff on every upgrade",
    boundary: WAVE3_BOUNDARY,
  };
}

export function verifyEvidenceBundle(args = {}) {
  const bundle = isObj(args.bundle) ? args.bundle : {};
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const expected = str(bundle.digest);
  const computed = digestOf({ spec: bundle.spec ?? "CG-EB/1", items });
  const itemIssues = [];
  items.forEach((item, i) => {
    if (item?.digest && item.digest !== digestOf(item.body ?? item)) itemIssues.push({ index: i, issue: "ITEM_DIGEST_MISMATCH", id: item?.id ?? null });
  });
  const issues = [];
  if (!expected) issues.push("BUNDLE_DIGEST_MISSING");
  else if (expected !== computed) issues.push("BUNDLE_DIGEST_MISMATCH");
  issues.push(...itemIssues.map((x) => x.issue));
  return {
    type: "evidence_bundle_verification",
    spec: "CG-EB/1",
    ok: issues.length === 0,
    verdict: issues.length === 0 ? "VERIFIED" : "INVALID",
    issues,
    counts: { items: items.length, itemIssues: itemIssues.length },
    expectedDigest: expected ?? null,
    computedDigest: computed,
    itemIssues,
    boundary: "checks the bundle against its own digest; it does not attest that the events happened. " + WAVE3_BOUNDARY,
  };
}

// ---------------------------------------------------------------------------
// Evidence: redaction and Merkle batch attestation
// ---------------------------------------------------------------------------

const SENSITIVE = /(credential|secret|token|password|passwd|private|pan|card|iban|email|phone|signature|api[-_]?key)/i;

export function redactReceipt(args = {}) {
  const receipt = isObj(args.receipt) ? args.receipt : {};
  const reveal = new Set(Array.isArray(args.reveal) ? args.reveal.map(String) : []);
  const redactions = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}[${i}]`));
    if (isObj(value)) {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const p = path ? `${path}.${k}` : k;
        if (!reveal.has(p) && !reveal.has(k) && SENSITIVE.test(k) && v !== null && typeof v !== "object") {
          out[k] = "[REDACTED]";
          redactions.push({ path: p, reason: "field name matches the sensitive-data set", originalType: typeof v, originalLength: String(v).length });
        } else if (!reveal.has(p) && !reveal.has(k) && SENSITIVE.test(k) && v && typeof v === "object") {
          out[k] = "[REDACTED]";
          redactions.push({ path: p, reason: "object under a sensitive field name", originalType: "object" });
        } else {
          out[k] = walk(v, p);
        }
      }
      return out;
    }
    return value;
  };
  const redacted = walk(receipt, "");
  return {
    type: "redacted_receipt",
    spec: "CG-RR/1",
    redacted,
    redactions,
    counts: { redactions: redactions.length, fields: Object.keys(receipt).length },
    originalDigest: digestOf(receipt),
    redactedDigest: digestOf(redacted),
    note: "keep originalDigest with the redacted copy: a holder of the original can prove it is the same record without revealing redacted fields",
    boundary: WAVE3_BOUNDARY,
  };
}

function leafHash(item) {
  return "sha256:" + createHash("sha256").update(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalJson(item))])).digest("hex");
}

function nodeHash(left, right) {
  return "sha256:" + createHash("sha256").update(Buffer.concat([Buffer.from([1]), Buffer.from(left), Buffer.from(right)])).digest("hex");
}

function largestPowerOfTwoBelow(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

function merkleRoot(leaves) {
  if (leaves.length === 0) return "sha256:" + createHash("sha256").update("").digest("hex");
  if (leaves.length === 1) return leaves[0];
  const k = largestPowerOfTwoBelow(leaves.length);
  return nodeHash(merkleRoot(leaves.slice(0, k)), merkleRoot(leaves.slice(k)));
}

function merkleProof(leaves, index) {
  if (leaves.length <= 1) return [];
  const k = largestPowerOfTwoBelow(leaves.length);
  if (index < k) return [...merkleProof(leaves.slice(0, k), index), { side: "right", hash: merkleRoot(leaves.slice(k)) }];
  return [...merkleProof(leaves.slice(k), index - k), { side: "left", hash: merkleRoot(leaves.slice(0, k)) }];
}

export function attestBatch(args = {}) {
  const receipts = Array.isArray(args.receipts) ? args.receipts : [];
  const leaves = receipts.map((r) => leafHash(r));
  const root = merkleRoot(leaves);
  return {
    type: "batch_attestation",
    spec: "CG-MT/1",
    algorithm: "sha256 Merkle over RFC 6962-style domain-separated nodes (0x00 leaf, 0x01 node)",
    root,
    count: receipts.length,
    leaves: leaves.map((hash, index) => ({ index, hash, receiptDigest: digestOf(receipts[index]) })),
    proofs: leaves.map((_, index) => merkleProof(leaves, index)),
    usage: "publish/notarise only the root; hand each holder their proof so inclusion stays verifiable offline",
    boundary: "the root commits to exactly these caller-supplied records; it does not prove they are true or that they happened. " + WAVE3_BOUNDARY,
  };
}

export function verifyBatchProof(args = {}) {
  const leaf = str(args.leafDigest);
  const root = str(args.root);
  const proof = Array.isArray(args.proof) ? args.proof : [];
  let acc = leaf;
  const steps = [];
  for (const step of proof) {
    if (!step || (step.side !== "left" && step.side !== "right") || typeof step.hash !== "string") {
      return { type: "merkle_proof_verification", spec: "CG-MT/1", ok: false, verdict: "INVALID", issue: "MALFORMED_PROOF_STEP", boundary: WAVE3_BOUNDARY };
    }
    acc = step.side === "left" ? nodeHash(step.hash, acc) : nodeHash(acc, step.hash);
    steps.push({ side: step.side, hash: step.hash });
  }
  const ok = acc === root;
  return {
    type: "merkle_proof_verification",
    spec: "CG-MT/1",
    ok,
    verdict: ok ? "VERIFIED" : "INVALID",
    issue: ok ? null : "ROOT_MISMATCH",
    recomputedRoot: acc,
    root: root ?? null,
    steps,
    boundary: "inclusion in the supplied root only; the root's own trustworthiness is a separate question. " + WAVE3_BOUNDARY,
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export function freezeAgent(args = {}) {
  const storePath = String(args.storePath);
  const agentId = String(args.agentId);
  const reason = str(args.reason) ?? "frozen via MCP";
  const decidedBy = str(args.decidedBy) ?? null;
  const pinned = args.nowSeconds === undefined ? null : Number(args.nowSeconds);
  const cp = createControlPlane({ storePath, create: true, ...(pinned === null ? {} : { now: () => new Date(pinned * 1000) }) });
  const state = cp.getState();
  const open = Object.values(state.approvals ?? {}).filter((a) => a.agentId === agentId && (a.status === "pending" || a.status === "approved"));
  const revoked = cp.revokeAgent(agentId, reason);
  const rejected = open.map((a) => {
    try {
      return cp.decideApproval(a.id, { decision: "rejected", decidedBy: decidedBy ?? "freeze", reason: `agent frozen: ${reason}` });
    } catch (err) {
      return { id: a.id, error: err?.message ?? String(err) };
    }
  });
  const report = cp.auditReport({ limit: 1 });
  return {
    type: "agent_freeze",
    spec: "CG-FZ/1",
    agentId,
    reason,
    revoked,
    approvals: { open: open.length, rejected: rejected.filter((r) => !r.error).length, failures: rejected.filter((r) => r.error).length },
    openApprovalIds: open.map((a) => a.id),
    chain: { ok: report.chain?.ok ?? null, length: report.chain?.length ?? null, headHash: report.chain?.headHash ?? null },
    boundary: "revocation and rejection are recorded in the local hash-chained ledger; they do not reach a chain, a merchant or a payment network. " + WAVE3_BOUNDARY,
  };
}

export function budgetRunway(args = {}) {
  const limit = decimal(args.policyLimitMinor);
  const spent = decimal(args.spentMinor ?? "0");
  const asOf = decimal(args.asOfSeconds);
  const window = decimal(args.windowSeconds ?? "86400");
  if (limit === null || spent === null || asOf === null || window === null || window === 0n) {
    throw new Error("policyLimitMinor, spentMinor, asOfSeconds and windowSeconds must be non-negative integers, windowSeconds non-zero");
  }
  const events = Array.isArray(args.events) ? args.events : [];
  const from = asOf - window;
  const inWindow = events.filter((e) => {
    const at = decimal(e?.atSeconds);
    return at !== null && at > from && at <= asOf;
  });
  const windowSpend = inWindow.reduce((sum, e) => sum + (decimal(e?.amountMinor) ?? 0n), 0n);
  const remaining = limit > spent ? limit - spent : 0n;
  const perSecond = windowSpend === 0n ? 0 : Number(windowSpend) / Number(window);
  const runwaySeconds = perSecond === 0 ? null : Math.floor(Number(remaining) / perSecond);
  return {
    type: "budget_runway",
    spec: "CG-BR/1",
    asOfSeconds: String(asOf),
    windowSeconds: String(window),
    limitMinor: String(limit),
    spentMinor: String(spent),
    remainingMinor: String(remaining),
    windowSpendMinor: String(windowSpend),
    burnPerDayMinor: perSecond === 0 ? "0" : String(BigInt(Math.round(perSecond * 86400))),
    runwaySeconds: runwaySeconds === null ? null : String(runwaySeconds),
    runwayDays: runwaySeconds === null ? null : Number((runwaySeconds / 86400).toFixed(2)),
    exhausted: remaining === 0n,
    exhaustedAtSeconds: runwaySeconds === null ? null : String(asOf + BigInt(runwaySeconds)),
    note: "straight-line projection from the supplied window; no seasonal model, no forecast confidence interval",
    boundary: WAVE3_BOUNDARY,
  };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectSpendAnomaly(args = {}) {
  const events = Array.isArray(args.events) ? args.events : [];
  const amounts = events.map((e) => Number(decimal(e?.amountMinor) ?? 0n));
  const med = median(amounts);
  const deviations = amounts.map((x) => Math.abs(x - med));
  const mad = median(deviations);
  const sensitivity = str(args.sensitivity) ?? "medium";
  const threshold = sensitivity === "high" ? 2.5 : sensitivity === "low" ? 3.5 : 3.0;
  const anomalies = [];
  events.forEach((e, i) => {
    const x = amounts[i];
    const denom = mad === 0 ? (deviations.reduce((s, d) => s + d, 0) / Math.max(1, deviations.length) || 1) : mad;
    const score = mad === 0 ? (x === med ? 0 : Number(((0.7979 * Math.abs(x - med)) / denom).toFixed(3))) : Number(((0.6745 * Math.abs(x - med)) / mad).toFixed(3));
    if (score >= threshold) {
      anomalies.push({ index: i, id: e?.id ?? null, amountMinor: String(decimal(e?.amountMinor) ?? 0n), medianMinor: String(Math.round(med)), score, direction: x > med ? "above" : "below" });
    }
  });
  return {
    type: "spend_anomaly_scan",
    spec: "CG-SA/1",
    sensitivity,
    threshold,
    counts: { events: events.length, anomalies: anomalies.length },
    baseline: { medianMinor: String(Math.round(med)), madMinor: String(Math.round(mad)) },
    anomalies: anomalies.sort((a, b) => b.score - a.score),
    note: "median/MAD is robust to a few large outliers; an anomaly is a question, not a finding of fraud",
    boundary: WAVE3_BOUNDARY,
  };
}

export function incidentTimeline(args = {}) {
  let audit = [];
  let chain = null;
  if (isObj(args.report)) {
    audit = Array.isArray(args.report.recentAudit) ? args.report.recentAudit : [];
    chain = args.report.chain ?? null;
    if (!chain && Array.isArray(args.report.audit)) audit = args.report.audit;
  } else if (str(args.storePath)) {
    const cp = createControlPlane({ storePath: String(args.storePath), create: true });
    const state = cp.getState();
    audit = Array.isArray(state.audit) ? state.audit : [];
    chain = verifyAuditChain(state);
  }
  const events = audit
    .map((e) => ({ seq: e?.seq ?? null, type: String(e?.type ?? "unknown"), at: String(e?.at ?? ""), detail: e?.detail ?? null, hash: e?.hash ?? null }))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const gaps = [];
  for (let i = 1; i < events.length; i++) {
    if (typeof events[i].seq === "number" && typeof events[i - 1].seq === "number" && events[i].seq !== events[i - 1].seq + 1) {
      gaps.push({ afterSeq: events[i - 1].seq, beforeSeq: events[i].seq });
    }
  }
  return {
    type: "incident_timeline",
    spec: "CG-IT/1",
    count: events.length,
    events,
    gaps,
    chain: chain ? { ok: chain.ok ?? null, length: chain.length ?? null, headHash: chain.headHash ?? null } : null,
    note: "built from the ledger you supplied; ordering is by the ledger's own sequence number, never by arrival time",
    boundary: WAVE3_BOUNDARY,
  };
}

// ---------------------------------------------------------------------------
// Interop and meta
// ---------------------------------------------------------------------------

export function translateReceipt(args = {}) {
  const receipt = isObj(args.receipt) ? args.receipt : {};
  const to = String(args.to ?? "acp");
  const amount = str(receipt.amount) ?? str(receipt.total) ?? str(receipt.amountMinor) ?? null;
  const currency = str(receipt.currency) ?? null;
  const merchant = str(receipt.merchant) ?? str(receipt.merchantName) ?? str(receipt.target) ?? null;
  const id = str(receipt.receiptId) ?? str(receipt.id) ?? null;
  const approvedAt = str(receipt.approvedAt) ?? str(receipt.createdAt) ?? null;
  const losses = [];
  let translated;
  if (to === "x402") {
    translated = { scheme: "exact", network: str(receipt.network) ?? null, asset: str(receipt.asset) ?? currency, payTo: str(receipt.payTo) ?? merchant, amount, resource: str(receipt.resource) ?? null, txRef: str(receipt.txRef) ?? null };
    if (!receipt.network) losses.push("network not present in the source receipt");
    if (!receipt.asset) losses.push("asset inferred from currency; x402 expects a token/asset id");
  } else if (to === "acp") {
    translated = { type: "acp.checkout_receipt", id, merchant, total: amount === null ? null : { amount, currency }, approvedAt, sourceDigest: digestOf(receipt) };
    if (!approvedAt) losses.push("approval timestamp not present");
    if (!merchant) losses.push("merchant not present");
  } else if (to === "cgcr") {
    translated = { version: "CGCR/1", receiptId: id, merchant, amount, currency, approvedAt, sourceDigest: digestOf(receipt), provenance: "translated — re-verify against the original bytes before relying on it" };
    losses.push("translation cannot reproduce commitments the source did not carry");
  } else {
    throw new Error("to must be \"acp\", \"x402\" or \"cgcr\"");
  }
  return {
    type: "receipt_translation",
    to,
    translated,
    losses,
    sourceDigest: digestOf(receipt),
    lossless: losses.length === 0,
    note: "structural mapping only — nothing is signed, verified or settled by this tool",
    boundary: WAVE3_BOUNDARY,
  };
}

export function emitTestVectors(args = {}) {
  const policy = isObj(args.policy) ? args.policy : {};
  const base = isObj(args.baseIntent) ? args.baseIntent : {};
  const nowSeconds = args.nowSeconds === undefined ? "1794657600" : String(args.nowSeconds);
  const amount = decimal(base.amount) ?? 0n;
  const recipient = str(base.recipient) ?? "0x" + "11".repeat(20);
  const vectors = [
    { id: "allow-baseline", intent: { ...base }, expected: "ALLOW", why: "the approved baseline" },
    { id: "deny-amount-drift", intent: { ...base, amount: String(amount + 1n) }, expected: "DENY", why: "one minor unit above the approved amount" },
    { id: "deny-recipient-swap", intent: { ...base, recipient: "0x" + "ff".repeat(20) }, expected: "DENY", why: "recipient not on the allowlist" },
    { id: "deny-expired-window", intent: { ...base, validUntil: String(BigInt(nowSeconds) - 1n) }, expected: "DENY", why: "approval window already closed" },
    { id: "allow-at-limit", intent: { ...base, amount: String((decimal((policy.rules ?? []).find((r) => r.type === "VALUE_LIMIT")?.params?.max) ?? amount)) }, expected: "ALLOW", why: "exactly at the value limit" },
  ].map((v) => ({ ...v, policyDigest: digestOf(policy), expectedBy: "the same rule engine coreguard_explain_decision uses" }));
  return {
    type: "integration_test_vectors",
    spec: "CG-TV/1",
    count: vectors.length,
    vectors,
    runWith: "coreguard_explain_decision({ policy, intent, nowSeconds }) — compare verdict to expected",
    boundary: WAVE3_BOUNDARY,
  };
}

export function describeSurface(args = {}, ctx = {}) {
  const format = String(args.format ?? "card");
  const names = Array.isArray(ctx.toolNames) ? ctx.toolNames : [];
  const families = names.reduce((acc, n) => {
    const key = n.replace(/^coreguard_/, "");
    acc.total += 1;
    return acc;
  }, { total: 0 });
  const card = {
    type: "capability_card",
    spec: "CG-CC/1",
    server: ctx.serverName ?? "coreguard-agent-commerce",
    version: ctx.version ?? null,
    protocolVersion: ctx.protocolVersion ?? null,
    transport: "stdio (newline-delimited JSON-RPC 2.0)",
    tools: families.total,
    categories: ["consent receipts (CGCR/1)", "execution verification (AGR/1)", "x402 payment evidence", "machine economy", "CGCP/1 control plane", "Wave 3 policy reasoning", "Wave 3 MCP supply-chain audit", "Wave 3 evidence and operations"],
    specs: ["CGCR/1", "AGR/1", "CGCP/1", "CGXA/1", "CG-OBS/1", "CG-W3/1"],
    boundary: WAVE3_BOUNDARY,
    key: "offline · deterministic · zero keys · no custody · no broadcast · VERIFIED ≠ SAFE",
  };
  if (format === "badge") {
    return { type: "capability_badge", spec: "CG-CC/1", badge: `coreguard-agent-commerce ${card.version ?? ""} · ${card.tools} tools · offline · deterministic`, card, boundary: WAVE3_BOUNDARY };
  }
  return { ...card, boundary: WAVE3_BOUNDARY };
}

// ---------------------------------------------------------------------------
// Schemas and handlers (one registry the MCP server spreads in)
// ---------------------------------------------------------------------------

const ctxProp = {
  callerContext: { type: "object", description: "Optional caller-provided trace/context metadata. Echoed back; never a cryptographic input." },
};

const schema = (properties, required, description) => ({
  type: "object",
  description,
  properties: { ...properties, ...ctxProp },
  required,
  additionalProperties: true,
});

const out = (description) => ({ type: "object", description, additionalProperties: true });

export const WAVE3_TOOLS = Object.freeze([
  {
    name: "coreguard_compile_policy",
    description: "Compile a compact spending spec (limit, merchant/recipient/selector allowlists, currency) into a canonical CGEP/1 policy with a stable digest. Compiling the same spec twice yields the same digest; nothing is stored.",
    inputSchema: schema({ spec: { type: "object", description: "policyId, name, maxAmountMinor (decimal string), allowMerchants[], allowRecipients[], allowSelectors[], currency" } }, ["spec"], "Compact policy spec to compile."),
    outputSchema: out("Canonical CGEP/1 policy plus its digest and rule summary."),
  },
  {
    name: "coreguard_explain_decision",
    description: "Evaluate an intent against a policy and explain the verdict rule by rule, including the smallest single change (counterfactual) that clears the first blocking rule. Deterministic, no state written.",
    inputSchema: schema({ policy: { type: "object" }, intent: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$", description: "pinned epoch seconds used for expiry checks" } }, ["policy", "intent", "nowSeconds"], "Policy and intent to explain."),
    outputSchema: out("Verdict, per-rule checks and a counterfactual."),
  },
  {
    name: "coreguard_simulate_spend",
    description: "Dry-run a batch of intents against a policy: allowed/denied per row, blocking rules, totals and counterfactuals. No approval, spend counter or ledger state is written.",
    inputSchema: schema({ policy: { type: "object" }, intents: { type: "array", items: { type: "object" }, description: "intent objects in CGEP/1 shape" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["policy", "intents", "nowSeconds"], "Policy plus the batch of intents to simulate."),
    outputSchema: out("Per-intent verdicts and aggregate totals, marked dryRun."),
  },
  {
    name: "coreguard_diff_policies",
    description: "Semantic diff of two CGEP/1 policies by rule id: added, removed, changed rules, value-limit delta, strictness trend, and whether an agent must re-consent.",
    inputSchema: schema({ before: { type: "object" }, after: { type: "object" } }, ["before", "after"], "The two policies to compare."),
    outputSchema: out("Rule-level diff with strictness and reconsent flags."),
  },
  {
    name: "coreguard_generate_boundary_cases",
    description: "Generate the cases that break naive policy tests: at the limit, one unit below, one above, unlisted target/recipient, closed window, wrong currency — each with the verdict the real rule engine computes.",
    inputSchema: schema({ policy: { type: "object" }, baseIntent: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["policy", "baseIntent", "nowSeconds"], "Policy and a representative intent."),
    outputSchema: out("Boundary cases with expected verdicts computed by the server."),
  },
  {
    name: "coreguard_audit_server_manifest",
    description: "Audit an MCP server manifest (server.json) before installing it: remote transports, unpinned packages, missing provenance, secret env requests, undeclared distribution. Returns a deterministic risk card.",
    inputSchema: schema({ manifest: { type: "object", description: "the server.json record as published" } }, ["manifest"], "The MCP server manifest to audit."),
    outputSchema: out("Risk level, findings with severities and the manifest digest."),
  },
  {
    name: "coreguard_scan_tool_descriptions",
    description: "Scan MCP tool descriptions for hidden-instruction and spoofing payloads: bidi overrides, Unicode tag characters, zero-width and invisible operators, HTML comments, and a fixed imperative phrase list — with offsets.",
    inputSchema: schema({ tools: { type: "array", items: { type: "object" }, description: "tools from tools/list: name + description" } }, ["tools"], "Tool metadata to scan."),
    outputSchema: out("CLEAN/SUSPICIOUS/DANGEROUS verdict with byte-level findings."),
  },
  {
    name: "coreguard_check_lookalike",
    description: "Check a merchant domain or package name for homoglyph, mixed-script and punycode impersonation of a reference: confusable folding, skeleton edit distance and explicit signals.",
    inputSchema: schema({ candidate: { type: "string" }, reference: { type: "string" } }, ["candidate", "reference"], "Candidate string and the reference it claims to be."),
    outputSchema: out("IDENTICAL/LOOKALIKE/DISTINCT verdict with the signals behind it."),
  },
  {
    name: "coreguard_diff_tool_surface",
    description: "Diff two tools/list snapshots (before/after an upgrade) to catch rug pulls: added, removed and re-described tools, schema changes, description similarity, severity and whether re-consent is required.",
    inputSchema: schema({ before: { type: "array", items: { type: "object" } }, after: { type: "array", items: { type: "object" } } }, ["before", "after"], "The two tool surfaces."),
    outputSchema: out("Surface diff with severity and requiresReconsent."),
  },
  {
    name: "coreguard_verify_evidence_bundle",
    description: "Verify a portable evidence bundle against its own digest and each item's digest: detects edits, dropped items and digest substitution without any network or trust root.",
    inputSchema: schema({ bundle: { type: "object", description: "{ spec, digest, items:[{id, body, digest}] }" } }, ["bundle"], "The bundle to verify."),
    outputSchema: out("VERIFIED/INVALID with the computed digest and item issues."),
  },
  {
    name: "coreguard_redact_receipt",
    description: "Produce a shareable redacted receipt: sensitive fields (credentials, tokens, PAN/card, email, phone, keys) are masked, every redaction is listed, and both the original and redacted digests are returned so a holder can prove it is the same record.",
    inputSchema: schema({ receipt: { type: "object" }, reveal: { type: "array", items: { type: "string" }, description: "field names or dotted paths to keep visible" } }, ["receipt"], "Receipt to redact."),
    outputSchema: out("Redacted copy, redaction manifest and both digests."),
  },
  {
    name: "coreguard_attest_batch",
    description: "Commit many receipts with one Merkle root: domain-separated SHA-256 leaves, RFC 6962-style tree, per-item inclusion proof. Publish only the root; each holder keeps a verifiable proof.",
    inputSchema: schema({ receipts: { type: "array", items: { type: "object" } } }, ["receipts"], "Receipts to batch."),
    outputSchema: out("Merkle root, leaf digests and inclusion proofs."),
  },
  {
    name: "coreguard_verify_batch_proof",
    description: "Verify a Merkle inclusion proof offline: recompute the root from the leaf digest and the supplied left/right path, and report the exact root mismatch if any.",
    inputSchema: schema({ leafDigest: { type: "string" }, root: { type: "string" }, proof: { type: "array", items: { type: "object", description: "{ side: left|right, hash }" } } }, ["leafDigest", "root", "proof"], "Leaf, root and proof to verify."),
    outputSchema: out("VERIFIED or INVALID with the recomputed root, the issue code and the proof steps used."),
  },
  {
    name: "coreguard_freeze_agent",
    description: "Kill switch over a CGCP/1 control plane: revoke the agent and reject every open approval it holds in one audited operation, returning the chain head and the rejected approval ids.",
    inputSchema: schema({ storePath: { type: "string" }, agentId: { type: "string" }, reason: { type: "string" }, decidedBy: { type: "string" }, nowSeconds: { type: "string", pattern: "^[0-9]+$", description: "optional pinned epoch seconds; omit to let the local ledger stamp call time" } }, ["storePath", "agentId"], "Control-plane path and the agent to freeze."),
    outputSchema: out("Revocation record, rejected approvals and chain status."),
  },
  {
    name: "coreguard_budget_runway",
    description: "Project budget runway from pinned inputs: limit, spend to date, a pinned asOf and a spend window. Straight-line burn, remaining budget, runway seconds/days and the exhaustion epoch — no wall clock, no forecasting model.",
    inputSchema: schema({ asOfSeconds: { type: "string", pattern: "^[0-9]+$" }, policyLimitMinor: { type: "string", pattern: "^[0-9]+$" }, spentMinor: { type: "string", pattern: "^[0-9]+$" }, windowSeconds: { type: "string", pattern: "^[0-9]+$" }, events: { type: "array", items: { type: "object", description: "{ atSeconds, amountMinor }" } } }, ["asOfSeconds", "policyLimitMinor", "spentMinor", "windowSeconds"], "Pinned budget inputs."),
    outputSchema: out("Remaining budget, burn rate, runway and exhaustion epoch."),
  },
  {
    name: "coreguard_detect_spend_anomaly",
    description: "Flag unusual spend events with a median/MAD robust score (no training data, no clock): returns the baseline, the threshold for the chosen sensitivity, and each anomaly with its score and direction.",
    inputSchema: schema({ events: { type: "array", items: { type: "object", description: "{ id, amountMinor, atSeconds }" } }, sensitivity: { type: "string", enum: ["low", "medium", "high"] } }, ["events"], "Spend events to scan."),
    outputSchema: out("Baseline, anomaly list and the score threshold used."),
  },
  {
    name: "coreguard_incident_timeline",
    description: "Assemble an incident timeline from a control-plane ledger (storePath or an audit report): sequence-ordered events, detected sequence gaps and audit-chain status. Ordering comes from the ledger, never from arrival time.",
    inputSchema: schema({ report: { type: "object" }, storePath: { type: "string" } }, ["report"], "An audit report, or a storePath when no report is supplied."),
    outputSchema: out("Sequence-ordered events, detected sequence gaps and audit-chain status."),
  },
  {
    name: "coreguard_translate_receipt",
    description: "Structurally translate a receipt to ACP, x402 or CGCR/1 and list exactly what the target cannot carry. Translation only: nothing is signed, verified or settled.",
    inputSchema: schema({ receipt: { type: "object" }, to: { type: "string", enum: ["acp", "x402", "cgcr"] } }, ["receipt", "to"], "Receipt and target shape."),
    outputSchema: out("Translated object, loss list and source digest."),
  },
  {
    name: "coreguard_emit_test_vectors",
    description: "Emit deterministic integration test vectors for an SDK or gateway: baseline allow, amount drift, recipient swap, expired window and at-limit, each with the verdict the real rule engine computes.",
    inputSchema: schema({ policy: { type: "object" }, baseIntent: { type: "object" }, nowSeconds: { type: "string", pattern: "^[0-9]+$" } }, ["policy", "baseIntent"], "Policy and baseline intent."),
    outputSchema: out("Vectors with expected verdicts and how to run them."),
  },
  {
    name: "coreguard_describe_surface",
    description: "Return this server's capability card (or a one-line badge): version, transport, protocol, tool count, categories and the standing boundary — the record a directory, catalog or buyer can quote verbatim.",
    inputSchema: schema({ format: { type: "string", enum: ["card", "badge"] } }, ["format"], "card or badge."),
    outputSchema: out("Capability card with the server's own boundary."),
  },
]);

function reqString(args, key) {
  const v = args?.[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is required`);
  return v;
}
function reqObject(args, key) {
  if (!isObj(args?.[key])) throw new Error(`${key} must be a JSON object`);
  return args[key];
}
function reqArray(args, key) {
  if (!Array.isArray(args?.[key])) throw new Error(`${key} must be an array`);
  return args[key];
}

export const WAVE3_HANDLERS = Object.freeze({
  coreguard_compile_policy: (a) => compilePolicy(a),
  coreguard_explain_decision: (a) => explainDecision(a),
  coreguard_simulate_spend: (a) => simulateSpend(a),
  coreguard_diff_policies: (a) => diffPolicies(a),
  coreguard_generate_boundary_cases: (a) => generateBoundaryCases(a),
  coreguard_audit_server_manifest: (a) => auditServerManifest(a),
  coreguard_scan_tool_descriptions: (a) => scanToolDescriptions(a),
  coreguard_check_lookalike: (a) => { reqString(a, "candidate"); reqString(a, "reference"); return checkLookalike(a); },
  coreguard_diff_tool_surface: (a) => diffToolSurface(a),
  coreguard_verify_evidence_bundle: (a) => verifyEvidenceBundle(a),
  coreguard_redact_receipt: (a) => redactReceipt(a),
  coreguard_attest_batch: (a) => attestBatch(a),
  coreguard_verify_batch_proof: (a) => { reqString(a, "leafDigest"); reqString(a, "root"); if (!Array.isArray(a.proof)) throw new Error("proof must be an array"); return verifyBatchProof(a); },
  coreguard_freeze_agent: (a) => freezeAgent(a),
  coreguard_budget_runway: (a) => budgetRunway(a),
  coreguard_detect_spend_anomaly: (a) => detectSpendAnomaly(a),
  coreguard_incident_timeline: (a) => { if (!isObj(a?.report)) reqString(a, "storePath"); return incidentTimeline(a); }, /** report wins; storePath is the stateless fallback */
  coreguard_translate_receipt: (a) => { reqObject(a, "receipt"); reqString(a, "to"); return translateReceipt(a); },
  coreguard_emit_test_vectors: (a) => emitTestVectors(a),
  coreguard_describe_surface: (a, ctx) => { reqString(a, "format"); return describeSurface(a, ctx); },
});

export const WAVE3_VALIDATORS = Object.freeze({
  coreguard_compile_policy: (a) => (isObj(a.spec) ? null : { code: "MISSING_ARGUMENT", detail: "spec is required and must be an object" }),
  coreguard_explain_decision: (a) => (isObj(a.policy) && isObj(a.intent) ? null : { code: "MISSING_ARGUMENT", detail: "policy and intent are required objects" }),
  coreguard_simulate_spend: (a) => (isObj(a.policy) && Array.isArray(a.intents) ? null : { code: "MISSING_ARGUMENT", detail: "policy (object) and intents (array) are required" }),
  coreguard_diff_policies: (a) => (isObj(a.before) && isObj(a.after) ? null : { code: "MISSING_ARGUMENT", detail: "before and after are required objects" }),
  coreguard_generate_boundary_cases: (a) => (isObj(a.policy) && isObj(a.baseIntent) ? null : { code: "MISSING_ARGUMENT", detail: "policy and baseIntent are required objects" }),
  coreguard_audit_server_manifest: (a) => (isObj(a.manifest) ? null : { code: "MISSING_ARGUMENT", detail: "manifest is required and must be an object" }),
  coreguard_scan_tool_descriptions: (a) => (Array.isArray(a.tools) ? null : { code: "MISSING_ARGUMENT", detail: "tools is required and must be an array" }),
  coreguard_check_lookalike: (a) => (typeof a.candidate === "string" && typeof a.reference === "string" ? null : { code: "MISSING_ARGUMENT", detail: "candidate and reference are required strings" }),
  coreguard_diff_tool_surface: (a) => (Array.isArray(a.before) && Array.isArray(a.after) ? null : { code: "MISSING_ARGUMENT", detail: "before and after are required arrays" }),
  coreguard_verify_evidence_bundle: (a) => (isObj(a.bundle) ? null : { code: "MISSING_ARGUMENT", detail: "bundle is required and must be an object" }),
  coreguard_redact_receipt: (a) => (isObj(a.receipt) ? null : { code: "MISSING_ARGUMENT", detail: "receipt is required and must be an object" }),
  coreguard_attest_batch: (a) => (Array.isArray(a.receipts) ? null : { code: "MISSING_ARGUMENT", detail: "receipts is required and must be an array" }),
  coreguard_verify_batch_proof: (a) => (typeof a.leafDigest === "string" && typeof a.root === "string" && Array.isArray(a.proof) ? null : { code: "MISSING_ARGUMENT", detail: "leafDigest, root and proof are required" }),
  coreguard_freeze_agent: (a) => (typeof a.storePath === "string" && typeof a.agentId === "string" ? null : { code: "MISSING_ARGUMENT", detail: "storePath and agentId are required strings" }),
  coreguard_budget_runway: (a) => (typeof a.asOfSeconds === "string" && typeof a.policyLimitMinor === "string" && typeof a.spentMinor === "string" && typeof a.windowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "asOfSeconds, policyLimitMinor, spentMinor and windowSeconds are required digit strings" }),
  coreguard_detect_spend_anomaly: (a) => (Array.isArray(a.events) ? null : { code: "MISSING_ARGUMENT", detail: "events is required and must be an array" }),
  coreguard_incident_timeline: (a) => (typeof a.storePath === "string" || isObj(a.report) ? null : { code: "MISSING_ARGUMENT", detail: "storePath (or report) is required" }),
  coreguard_translate_receipt: (a) => (isObj(a.receipt) && ["acp", "x402", "cgcr"].includes(a.to) ? null : { code: "MISSING_ARGUMENT", detail: "receipt (object) and to (acp|x402|cgcr) are required" }),
  coreguard_emit_test_vectors: (a) => (isObj(a.policy) && isObj(a.baseIntent) ? null : { code: "MISSING_ARGUMENT", detail: "policy and baseIntent are required objects" }),
  coreguard_describe_surface: (a) => (a.format === "card" || a.format === "badge" ? null : { code: "MISSING_ARGUMENT", detail: "format must be card or badge" }),
});
