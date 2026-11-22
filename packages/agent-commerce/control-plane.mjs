/**
 * CoreGuard Policy & Evidence Control Plane (CGCP/1) — self-hosted, BUILT.
 *
 * One file-backed plane for the questions an operator asks about agent
 * commerce: which agents exist, which policy each one is bound to, what that
 * policy allows, what was approved, what was executed, what was verified, what
 * has been spent, and what was revoked — with an append-only, hash-chained
 * audit trail over every mutation.
 *
 * BUILT_NOW (this module, no external services, no dependencies):
 *   - agents: registry, status, one bound policy, metadata, revocation;
 *   - policies: immutable VERSION history per policy id (upsert appends a
 *     version; the active version is what evaluates), per-transaction limit,
 *     rolling-24h limit, lifetime limit, currency, merchant and address
 *     allow/deny lists, approval threshold;
 *   - approvals: request → approve/reject, expiry, amount/merchant/address
 *     binding (an approval for one order cannot authorise another);
 *   - decisions: deterministic allow/deny with named reasons and a per-check
 *     record;
 *   - executions: append-only ledger that re-evaluates at commit time (an agent
 *     revoked between authorise and commit is refused), records the spend, and
 *     refuses duplicate execution ids;
 *   - verifications: receipt/consent verdict records attached to executions;
 *   - revocation: agents and policies, with reason and audit entry;
 *   - audit: append-only hash-chained log + `verifyAuditChain()` that names the
 *     first broken sequence;
 *   - report: counts, active policy specs, spend totals, chain status, and a
 *     body hash over the canonical report.
 *
 * CONCURRENCY (honest): every mutation takes an exclusive lock file
 * (`<store>.lock`, O_EXCL) and RELOADS the store under the lock, so two
 * processes on one host cannot clobber each other. A stale lock (holder died)
 * is broken after `staleLockMs`. This is a single-host guarantee.
 *
 * NOT_BUILT (explicit, and the reason this is not sold as enterprise SaaS):
 * multi-tenant isolation, multi-user RBAC/ABAC/SSO/SCIM, distributed storage or
 * consensus/HA, cross-region replication, KMS/HSM-backed secrets, managed
 * hosting with an SLA, payment processing or custody. VERIFIED ≠ SAFE; this
 * plane records decisions, it does not make an unsafe order safe.
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  statSync,
  unlinkSync,
  fsyncSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID, createHash, createHmac } from "node:crypto";

export const CONTROL_PLANE_VERSION = "CGCP/1";
export const CONTROL_PLANE_SCHEMA = "coreguard.control-plane/1";
export const CONTROL_PLANE_BOUNDARY =
  "self-hosted single-host control plane (file-backed, lock-guarded, hash-chained audit); " +
  "NOT_BUILT: multi-tenant RBAC/SSO/SCIM, distributed HA/consensus, KMS/HSM, managed SLA, payment custody; " +
  "VERIFIED ≠ SAFE";

export const CONTROL_PLANE_DECISION_REASONS = Object.freeze([
  "UNKNOWN_AGENT",
  "AGENT_REVOKED_OR_INACTIVE",
  "UNKNOWN_POLICY",
  "POLICY_INACTIVE",
  "POLICY_UNREADABLE",
  "AMOUNT_REQUIRED",
  "MERCHANT_DENIED",
  "MERCHANT_NOT_ALLOWED",
  "MERCHANT_MISSING",
  "ADDRESS_DENIED",
  "ADDRESS_NOT_ALLOWED",
  "ADDRESS_MISSING",
  "CURRENCY_MISMATCH",
  "CURRENCY_MISSING",
  "SPEND_LIMIT_EXCEEDED",
  "DAILY_LIMIT_EXCEEDED",
  "TOTAL_LIMIT_EXCEEDED",
  "APPROVAL_REQUIRED",
  "APPROVAL_NOT_APPROVED",
  "APPROVAL_MISMATCH",
  "APPROVAL_EXPIRED",
  "APPROVAL_EXPIRES_AT_INVALID",
]);

const ZERO_HASH = "sha256:" + "0".repeat(64);
const DECIMAL = /^[0-9]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Canonical JSON + hashing (one representation, used for every commitment)
// ---------------------------------------------------------------------------

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

const sha256 = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const digestOf = (value) => "sha256:" + sha256(canonicalJson(value));

// ---------------------------------------------------------------------------
// Input validation — malformed developer input throws; malformed BUSINESS data
// (an unreadable policy version) refuses with a named reason instead of guessing.
// ---------------------------------------------------------------------------

function optionalDecimal(value, field) {
  if (value === undefined || value === null) return null;
  const s = typeof value === "bigint" ? value.toString() : String(value);
  if (!DECIMAL.test(s)) throw new TypeError(`${field} must be a non-negative integer string (minor units)`);
  return BigInt(s).toString();
}

const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

function requiredId(value, field) {
  const id = requiredString(value, field);
  if (RESERVED_IDS.has(id) || !SAFE_ID.test(id)) {
    throw new TypeError(`${field} must match ${SAFE_ID} and not be a reserved key`);
  }
  return id;
}

function stringArray(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array of strings`);
  for (const v of value) if (typeof v !== "string" || v.length === 0) throw new TypeError(`${field} must contain non-empty strings`);
  return [...new Set(value)];
}

function normalizePolicySpec(policy = {}) {
  return {
    spendLimitMinor: optionalDecimal(policy.spendLimitMinor, "spendLimitMinor"),
    dailyLimitMinor: optionalDecimal(policy.dailyLimitMinor, "dailyLimitMinor"),
    totalLimitMinor: optionalDecimal(policy.totalLimitMinor, "totalLimitMinor"),
    requireApprovalAboveMinor: optionalDecimal(policy.requireApprovalAboveMinor, "requireApprovalAboveMinor"),
    currency: policy.currency == null ? null : String(policy.currency),
    allowMerchants: stringArray(policy.allowMerchants, "allowMerchants"),
    denyMerchants: stringArray(policy.denyMerchants, "denyMerchants"),
    allowAddresses: stringArray(policy.allowAddresses, "allowAddresses"),
    denyAddresses: stringArray(policy.denyAddresses, "denyAddresses"),
    rules: Array.isArray(policy.rules) ? policy.rules : [],
  };
}

// ---------------------------------------------------------------------------
// Store I/O
// ---------------------------------------------------------------------------

const sleep = (() => {
  const cell = new Int32Array(new SharedArrayBuffer(4));
  return (ms) => Atomics.wait(cell, 0, 0, ms);
})();

function nullMap(obj) {
  const out = Object.create(null);
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) out[k] = v;
  }
  return out;
}

function defaultState() {
  return {
    version: CONTROL_PLANE_VERSION,
    schema: CONTROL_PLANE_SCHEMA,
    boundary: CONTROL_PLANE_BOUNDARY,
    createdAt: null,
    updatedAt: null,
    agents: Object.create(null),
    policies: Object.create(null),
    approvals: Object.create(null),
    executions: [],
    verifications: [],
    revocations: Object.create(null),
    audit: [],
  };
}

function normalizeState(data) {
  if (!data || typeof data !== "object") throw new Error("not a CGCP/1 control-plane store");
  if (data.schema !== CONTROL_PLANE_SCHEMA) throw new Error("not a CGCP/1 control-plane store");
  data.agents = nullMap(data.agents);
  data.policies = nullMap(data.policies);
  data.approvals = nullMap(data.approvals);
  data.revocations = nullMap(data.revocations);
  if (!Array.isArray(data.executions)) data.executions = [];
  if (!Array.isArray(data.verifications)) data.verifications = [];
  if (!Array.isArray(data.audit)) data.audit = [];
  return data;
}

function loadState(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return normalizeState(data);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

function saveState(path, state, { fsync = false } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp-" + process.pid + "-" + Math.random().toString(16).slice(2);
  const fd = openSync(tmp, "w");
  try {
    writeFileSync(fd, JSON.stringify(state, null, 2) + "\n", "utf8");
    if (fsync) fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
  if (fsync) {
    try {
      const dirFd = openSync(dirname(path), "r");
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    } catch {
      // Best-effort directory fsync; not supported on all platforms/filesystems.
    }
  }
}

function appendAudit(state, type, detail, at, meta = null) {
  const prevHash = state.audit.length ? state.audit[state.audit.length - 1].hash : ZERO_HASH;
  const body = { seq: state.audit.length + 1, type, at, detail, prevHash };
  const m = meta && typeof meta === "object" ? meta : (state?._auditMeta && typeof state._auditMeta === "object" ? state._auditMeta : null);
  if (m) {
    if (m.actor != null) body.actor = String(m.actor);
    if (m.requestId != null) body.requestId = String(m.requestId);
    if (m.source != null) body.source = String(m.source);
  }
  const entry = { ...body, hash: digestOf(body) };
  state.audit.push(entry);
  return entry;
}

/**
 * Re-derive the whole audit chain from the stored entries. Pure over the state:
 * a rewritten entry, a removed entry, a reordered entry or a broken prevHash
 * names the first sequence that does not recompute.
 */
export function verifyAuditChain(state) {
  const audit = Array.isArray(state?.audit) ? state.audit : [];
  let prev = ZERO_HASH;
  for (let i = 0; i < audit.length; i += 1) {
    const entry = audit[i];
    const expectedSeq = i + 1;
    if (!entry || typeof entry !== "object") {
      return { ok: false, length: audit.length, brokenAt: expectedSeq, reason: "entry is not an object", headHash: prev };
    }
    if (entry.seq !== expectedSeq) {
      return { ok: false, length: audit.length, brokenAt: expectedSeq, reason: "sequence gap or reorder", headHash: prev };
    }
    if (entry.prevHash !== prev) {
      return { ok: false, length: audit.length, brokenAt: expectedSeq, reason: "previous hash does not chain", headHash: prev };
    }
    const body = { seq: entry.seq, type: entry.type, at: entry.at, detail: entry.detail, prevHash: entry.prevHash };
    if (entry.actor != null) body.actor = entry.actor;
    if (entry.requestId != null) body.requestId = entry.requestId;
    if (entry.source != null) body.source = entry.source;
    const recomputed = digestOf(body);
    if (entry.hash !== recomputed) {
      return { ok: false, length: audit.length, brokenAt: expectedSeq, reason: "entry hash does not recompute", headHash: prev };
    }
    prev = entry.hash;
  }
  return { ok: true, length: audit.length, brokenAt: null, reason: null, headHash: prev };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function activeVersion(policy) {
  if (!policy || !Array.isArray(policy.versions) || policy.versions.length === 0) return null;
  return policy.versions.find((v) => v.version === policy.currentVersion) ?? null;
}

function spendTotals(executions, { agentId, policyId, nowMs }) {
  let rolling24h = 0n;
  let total = 0n;
  for (const e of executions) {
    if (agentId != null && e.agentId !== agentId) continue;
    if (policyId != null && e.policyId !== policyId) continue;
    if (e.amountMinor == null) continue;
    let amount;
    try {
      amount = BigInt(e.amountMinor);
    } catch {
      continue;
    }
    total += amount;
    const at = Date.parse(e.at);
    if (Number.isFinite(at) && nowMs - at <= DAY_MS) rolling24h += amount;
  }
  return { rolling24hMinor: rolling24h, totalMinor: total };
}

function approvalProblem({ state, approvalId, agentId, policyId, merchant, address, amountMinor, nowMs }) {
  if (approvalId == null) return "APPROVAL_REQUIRED";
  const approval = state.approvals[approvalId];
  if (!approval) return "APPROVAL_REQUIRED";
  if (approval.status !== "approved") return "APPROVAL_NOT_APPROVED";
  if (approval.expiresAt) {
    const exp = Date.parse(approval.expiresAt);
    if (!Number.isFinite(exp)) return "APPROVAL_EXPIRES_AT_INVALID";
    if (exp < nowMs) return "APPROVAL_EXPIRED";
  }
  const same = (a, b) => (a == null ? b == null : String(a) === String(b));
  if (!same(approval.agentId, agentId)) return "APPROVAL_MISMATCH";
  if (approval.policyId != null && !same(approval.policyId, policyId)) return "APPROVAL_MISMATCH";
  if (!same(approval.merchant, merchant)) return "APPROVAL_MISMATCH";
  if (!same(approval.address, address)) return "APPROVAL_MISMATCH";
  if (!same(approval.amountMinor, amountMinor)) return "APPROVAL_MISMATCH";
  return null;
}

function evaluateRequest({ state, agentId, policyId, merchant, address, amountMinor, currency, approvalId, nowMs, nowIso }) {
  const reasons = [];
  const checks = {};

  const agent = agentId != null ? state.agents[agentId] : null;
  checks.agent = { ok: false, status: agent ? agent.status : null, boundPolicyId: agent?.policyId ?? null };
  if (!agent) {
    reasons.push("UNKNOWN_AGENT");
  } else if (agent.status !== "active") {
    reasons.push("AGENT_REVOKED_OR_INACTIVE");
  } else {
    checks.agent.ok = true;
  }

  const resolvedPolicyId = policyId ?? agent?.policyId ?? null;
  const policy = resolvedPolicyId != null ? state.policies[resolvedPolicyId] : null;
  const version = activeVersion(policy);
  checks.policy = { ok: false, policyId: resolvedPolicyId, version: version?.version ?? null, status: policy?.status ?? null };

  if (!policy) {
    reasons.push("UNKNOWN_POLICY");
  } else if (policy.status !== "active") {
    reasons.push("POLICY_INACTIVE");
  } else if (!version || !version.spec) {
    reasons.push("POLICY_UNREADABLE");
  } else {
    checks.policy.ok = true;
  }

  const spec = version?.spec ?? null;
  if (spec) {
    const amount = amountMinor == null ? null : BigInt(amountMinor);
    const monetaryPolicy = spec.spendLimitMinor != null || spec.dailyLimitMinor != null || spec.totalLimitMinor != null || spec.requireApprovalAboveMinor != null;

    checks.merchant = { ok: true, merchant: merchant ?? null, denied: false, notOnAllowlist: false, missing: false };
    if (merchant == null && (spec.denyMerchants.length > 0 || spec.allowMerchants.length > 0)) {
      reasons.push("MERCHANT_MISSING");
      checks.merchant.missing = true;
      checks.merchant.ok = false;
    }
    if (merchant != null && spec.denyMerchants.includes(merchant)) {
      reasons.push("MERCHANT_DENIED");
      checks.merchant.denied = true;
      checks.merchant.ok = false;
    }
    if (merchant != null && spec.allowMerchants.length > 0 && !spec.allowMerchants.includes(merchant)) {
      reasons.push("MERCHANT_NOT_ALLOWED");
      checks.merchant.notOnAllowlist = true;
      checks.merchant.ok = false;
    }

    checks.address = { ok: true, address: address ?? null, denied: false, notOnAllowlist: false, missing: false };
    if (address == null && (spec.denyAddresses.length > 0 || spec.allowAddresses.length > 0)) {
      reasons.push("ADDRESS_MISSING");
      checks.address.missing = true;
      checks.address.ok = false;
    }
    if (address != null && spec.denyAddresses.includes(address)) {
      reasons.push("ADDRESS_DENIED");
      checks.address.denied = true;
      checks.address.ok = false;
    }
    if (address != null && spec.allowAddresses.length > 0 && !spec.allowAddresses.includes(address)) {
      reasons.push("ADDRESS_NOT_ALLOWED");
      checks.address.notOnAllowlist = true;
      checks.address.ok = false;
    }

    checks.currency = { ok: true, expected: spec.currency, observed: currency ?? null, missing: false };
    if (spec.currency != null && currency == null) {
      reasons.push("CURRENCY_MISSING");
      checks.currency.missing = true;
      checks.currency.ok = false;
    }
    if (spec.currency != null && currency != null && String(spec.currency) !== String(currency)) {
      reasons.push("CURRENCY_MISMATCH");
      checks.currency.ok = false;
    }

    const totals = spendTotals(state.executions, {
      agentId,
      policyId: resolvedPolicyId,
      nowMs,
    });
    const projected24h = totals.rolling24hMinor + (amount ?? 0n);
    const projectedTotal = totals.totalMinor + (amount ?? 0n);

    checks.amount = {
      ok: true,
      amountMinor: amountMinor ?? null,
      perTransactionLimitMinor: spec.spendLimitMinor,
      projected24hMinor: projected24h.toString(),
      dailyLimitMinor: spec.dailyLimitMinor,
      projectedTotalMinor: projectedTotal.toString(),
      totalLimitMinor: spec.totalLimitMinor,
      missing: false,
    };
    if (amount == null && monetaryPolicy) {
      reasons.push("AMOUNT_REQUIRED");
      checks.amount.missing = true;
      checks.amount.ok = false;
    }
    if (amount != null && spec.spendLimitMinor != null && amount > BigInt(spec.spendLimitMinor)) {
      reasons.push("SPEND_LIMIT_EXCEEDED");
      checks.amount.ok = false;
    }
    if (amount != null && spec.dailyLimitMinor != null && projected24h > BigInt(spec.dailyLimitMinor)) {
      reasons.push("DAILY_LIMIT_EXCEEDED");
      checks.amount.ok = false;
    }
    if (amount != null && spec.totalLimitMinor != null && projectedTotal > BigInt(spec.totalLimitMinor)) {
      reasons.push("TOTAL_LIMIT_EXCEEDED");
      checks.amount.ok = false;
    }

    const needsApproval =
      spec.requireApprovalAboveMinor != null && amount != null && amount > BigInt(spec.requireApprovalAboveMinor);
    checks.approval = { ok: true, required: needsApproval, approvalId: approvalId ?? null, problem: null };
    if (needsApproval) {
      const problem = approvalProblem({ state, approvalId, agentId, policyId: resolvedPolicyId, merchant, address, amountMinor, nowMs });
      if (problem) {
        reasons.push(problem);
        checks.approval.ok = false;
        checks.approval.problem = problem;
      }
    }
  }

  return {
    version: CONTROL_PLANE_VERSION,
    allowed: reasons.length === 0,
    reasons,
    checks,
    agentId: agentId ?? null,
    policyId: resolvedPolicyId,
    policyVersion: version?.version ?? null,
    merchant: merchant ?? null,
    address: address ?? null,
    amountMinor: amountMinor ?? null,
    currency: currency ?? null,
    approvalId: approvalId ?? null,
    at: nowIso,
    boundary: CONTROL_PLANE_BOUNDARY,
  };
}

// ---------------------------------------------------------------------------
// The plane
// ---------------------------------------------------------------------------

/**
 * Open (or create) a control plane at `storePath`.
 *
 * Options:
 *   now          — () => Date, injectable clock (tests pin it)
 *   lockTimeoutMs— how long a mutation waits for the file lock (default 5000)
 *   staleLockMs  — age after which an abandoned lock is broken (default 30000)
 */
export function createControlPlane({
  storePath,
  now = () => new Date(),
  lockTimeoutMs = 5000,
  staleLockMs = 30000,
  create = false,
  fsync = false,
} = {}) {
  if (typeof storePath !== "string" || storePath.length === 0) throw new TypeError("CGCP/1: storePath is required");
  const lockPath = storePath + ".lock";
  const nowIso = () => now().toISOString();
  const nowMs = () => now().getTime();
  let storeInitialized = existsSync(storePath);
  if (!create && !storeInitialized) {
    const missing = new Error("CGCP/1: store missing (pass create: true to initialize a new plane)");
    missing.code = "STORE_MISSING";
    missing.statusCode = 503;
    throw missing;
  }

  function readLock() {
    try {
      const raw = JSON.parse(readFileSync(lockPath, "utf8"));
      return raw && typeof raw === "object" ? raw : null;
    } catch {
      return null;
    }
  }

  function pidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      // EPERM means process exists but we lack permission to signal it.
      return err?.code === "EPERM";
    }
  }

  function tryBreakStaleLock() {
    let lock;
    let st;
    try {
      lock = readLock();
      st = statSync(lockPath);
    } catch {
      return false; // released or unreadable; caller retries
    }
    const ageMs = Date.now() - (Number(lock?.at) || st.mtimeMs);
    if (ageMs <= staleLockMs) return false;
    // CP-05: never break by age alone when holder pid is still alive.
    if (lock && pidAlive(lock.pid)) return false;
    try {
      // Best-effort ownership-safe break: only remove if same inode/file still looks like this lock.
      const st2 = statSync(lockPath);
      if (st2.ino !== st.ino || st2.mtimeMs !== st.mtimeMs) return false;
      unlinkSync(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  function acquireLock() {
    const deadline = Date.now() + lockTimeoutMs;
    const ownerToken = randomUUID();
    for (;;) {
      try {
        const fd = openSync(lockPath, "wx");
        try {
          writeFileSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), ownerToken }));
        } finally {
          closeSync(fd);
        }
        return ownerToken;
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        tryBreakStaleLock();
        if (Date.now() > deadline) {
          const lockErr = new Error("CGCP/1: store is locked by another process");
          lockErr.code = "STORE_LOCKED";
          lockErr.statusCode = 503;
          throw lockErr;
        }
        sleep(3 + Math.floor(Math.random() * 5));
      }
    }
  }

  function releaseLock(ownerToken) {
    try {
      const lock = readLock();
      // CP-04: only the owner may remove its lock.
      if (lock && lock.ownerToken && lock.ownerToken !== ownerToken) return;
      unlinkSync(lockPath);
    } catch {
      // Nothing to release or already removed.
    }
  }

  function read() {
    const state = loadState(storePath);
    if (state) {
      storeInitialized = true;
      return state;
    }
    if (!create && !storeInitialized) {
      const missing = new Error("CGCP/1: store missing (pass create: true to initialize a new plane)");
      missing.code = "STORE_MISSING";
      missing.statusCode = 503;
      throw missing;
    }
    return defaultState();
  }

  let pendingAuditMeta = null;
  function withAuditMeta(meta, fn) {
    const prev = pendingAuditMeta;
    pendingAuditMeta = meta && typeof meta === "object" ? meta : null;
    let out;
    try {
      out = fn();
    } catch (err) {
      pendingAuditMeta = prev;
      throw err;
    }
    if (out && typeof out.then === "function") {
      return Promise.resolve(out).finally(() => { pendingAuditMeta = prev; });
    }
    pendingAuditMeta = prev;
    return out;
  }

  /** Every mutation: exclusive lock → reload → mutate → atomic save → unlock. */
  function mutate(fn, meta = null) {
    const ownerToken = acquireLock();
    try {
      const state = read();
      if (!state.createdAt) state.createdAt = nowIso();
      const m = meta || pendingAuditMeta;
      if (m && typeof m === "object") {
        Object.defineProperty(state, "_auditMeta", { value: m, enumerable: false, configurable: true, writable: true });
      }
      const result = fn(state);
      state.updatedAt = nowIso();
      saveState(storePath, state, { fsync });
      return result;
    } finally {
      releaseLock(ownerToken);
    }
  }

  function view(fn) {
    return fn(read());
  }

  // -- agents --------------------------------------------------------------

  function upsertAgent(agent = {}) {
    const id = requiredId(agent.id, "agent.id");
    return mutate((state) => {
      const prev = state.agents[id] ?? null;
      const status = agent.status ?? prev?.status ?? "active";
      if (!["active", "inactive", "revoked"].includes(status)) throw new TypeError("agent.status must be active, inactive or revoked");
      if (prev?.status === "revoked" && status !== "revoked") {
        throw new Error("CGCP/1: a revoked agent cannot be reactivated (create a new agent id)");
      }
      const record = {
        ...(prev ?? {}),
        ...agent,
        id,
        status,
        policyId: agent.policyId ?? prev?.policyId ?? null,
        metadata: agent.metadata ?? prev?.metadata ?? {},
        createdAt: prev?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      state.agents[id] = record;
      appendAudit(state, prev ? "agent.updated" : "agent.created", { agentId: id, status, policyId: record.policyId }, nowIso());
      return record;
    });
  }

  function getAgent(agentId) {
    return view((state) => state.agents[agentId] ?? null);
  }

  function listAgents() {
    return view((state) => Object.values(state.agents));
  }

  function bindPolicy(agentId, policyId) {
    return mutate((state) => {
      const agent = state.agents[agentId];
      if (!agent) throw new Error("CGCP/1: unknown agent");
      if (!state.policies[policyId]) throw new Error("CGCP/1: unknown policy");
      agent.policyId = policyId;
      agent.updatedAt = nowIso();
      appendAudit(state, "agent.policy.bound", { agentId, policyId }, nowIso());
      return agent;
    });
  }

  function revokeAgent(agentId, reason = "") {
    return mutate((state) => {
      const agent = state.agents[agentId];
      if (!agent) throw new Error("CGCP/1: unknown agent");
      agent.status = "revoked";
      agent.updatedAt = nowIso();
      const record = { agentId, reason: String(reason ?? ""), at: nowIso() };
      state.revocations[agentId] = record;
      appendAudit(state, "agent.revoked", record, nowIso());
      return agent;
    });
  }

  // -- policies (immutable versions; upsert appends) -----------------------

  function upsertPolicy(policy = {}) {
    const id = requiredId(policy.id, "policy.id");
    return mutate((state) => {
      const prev = state.policies[id] ?? null;
      const spec = normalizePolicySpec(policy);
      const versionNumber = prev ? prev.currentVersion + 1 : 1;
      const version = {
        version: versionNumber,
        hash: digestOf(spec),
        at: nowIso(),
        note: policy.note == null ? null : String(policy.note),
        spec,
      };
      const record = {
        id,
        name: policy.name ?? prev?.name ?? id,
        status: policy.status ?? prev?.status ?? "active",
        currentVersion: versionNumber,
        versions: [...(prev?.versions ?? []), version],
        createdAt: prev?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      if (!["active", "inactive", "revoked"].includes(record.status)) {
        throw new TypeError("policy.status must be active, inactive or revoked");
      }
      if (prev?.status === "revoked" && record.status !== "revoked") {
        throw new Error("CGCP/1: a revoked policy cannot be reactivated (create a new policy id)");
      }
      state.policies[id] = record;
      appendAudit(
        state,
        prev ? "policy.version.appended" : "policy.created",
        { policyId: id, version: versionNumber, hash: version.hash, status: record.status },
        nowIso(),
      );
      return record;
    });
  }

  function getPolicy(policyId) {
    return view((state) => state.policies[policyId] ?? null);
  }

  function listPolicies() {
    return view((state) => Object.values(state.policies));
  }

  function revokePolicy(policyId, reason = "") {
    return mutate((state) => {
      const policy = state.policies[policyId];
      if (!policy) throw new Error("CGCP/1: unknown policy");
      policy.status = "revoked";
      policy.updatedAt = nowIso();
      appendAudit(state, "policy.revoked", { policyId, reason: String(reason ?? "") }, nowIso());
      return policy;
    });
  }

  // -- approvals -----------------------------------------------------------

  function requestApproval(request = {}) {
    const approvalId = requiredId(request.id ?? "ap_" + randomUUID(), "approval.id");
    const agentId = requiredId(request.agentId, "approval.agentId");
    return mutate((state) => {
      if (!state.agents[agentId]) throw new Error("CGCP/1: unknown agent");
      const record = {
        id: approvalId,
        agentId,
        policyId: request.policyId == null ? (state.agents[agentId].policyId ?? null) : requiredId(request.policyId, "approval.policyId"),
        merchant: request.merchant ?? null,
        address: request.address ?? null,
        amountMinor: optionalDecimal(request.amountMinor, "approval.amountMinor"),
        currency: request.currency ?? null,
        status: "pending",
        requestedAt: nowIso(),
        requestedBy: request.requestedBy ?? null,
        expiresAt: (() => {
          const v = request.expiresAt ?? new Date(nowMs() + 15 * 60 * 1000).toISOString();
          const t = Date.parse(v);
          if (!Number.isFinite(t)) throw new TypeError("approval.expiresAt must be a valid ISO-8601 datetime");
          return new Date(t).toISOString();
        })(),
        decidedAt: null,
        decidedBy: null,
        reason: null,
        hash: null,
      };
      record.hash = digestOf(record);
      state.approvals[approvalId] = record;
      appendAudit(state, "approval.requested", { approvalId, agentId, amountMinor: record.amountMinor }, nowIso());
      return record;
    });
  }

  function decideApproval(approvalId, { decision, decidedBy = null, reason = null } = {}) {
    if (!["approved", "rejected"].includes(decision)) throw new TypeError("decision must be approved or rejected");
    return mutate((state) => {
      const approval = state.approvals[approvalId];
      if (!approval) throw new Error("CGCP/1: unknown approval");
      if (approval.status !== "pending") throw new Error(`CGCP/1: approval is already ${approval.status}`);
      approval.status = decision;
      approval.decidedAt = nowIso();
      approval.decidedBy = decidedBy;
      approval.reason = reason;
      approval.hash = digestOf({ ...approval, hash: null });
      appendAudit(state, `approval.${decision}`, { approvalId, decidedBy, reason }, nowIso());
      return approval;
    });
  }

  function getApproval(approvalId) {
    return view((state) => state.approvals[approvalId] ?? null);
  }

  // -- decisions / executions / verifications ------------------------------

  function evaluate(request = {}) {
    return view((state) =>
      evaluateRequest({
        state,
        agentId: request.agentId ?? null,
        policyId: request.policyId ?? null,
        merchant: request.merchant ?? null,
        address: request.address ?? null,
        amountMinor: request.amountMinor == null ? null : optionalDecimal(request.amountMinor, "amountMinor"),
        currency: request.currency ?? null,
        approvalId: request.approvalId ?? null,
        nowMs: nowMs(),
        nowIso: nowIso(),
      }),
    );
  }

  /**
   * Dry-run authorisation that ALSO records the decision in the audit chain,
   * so an operator can see what was authorised even when nothing was committed.
   */
  function authorize(request = {}) {
    return mutate((state) => {
      const decision = evaluateRequest({
        state,
        agentId: request.agentId ?? null,
        policyId: request.policyId ?? null,
        merchant: request.merchant ?? null,
        address: request.address ?? null,
        amountMinor: request.amountMinor == null ? null : optionalDecimal(request.amountMinor, "amountMinor"),
        currency: request.currency ?? null,
        approvalId: request.approvalId ?? null,
        nowMs: nowMs(),
        nowIso: nowIso(),
      });
      const decisionId = "dec_" + randomUUID();
      appendAudit(
        state,
        "decision.authorized",
        { decisionId, allowed: decision.allowed, reasons: decision.reasons, agentId: decision.agentId, amountMinor: decision.amountMinor },
        nowIso(),
      );
      return { ...decision, decisionId };
    });
  }

  /**
   * Commit an execution. Re-evaluates at commit time (so a revocation or a
   * limit breach between authorize and commit is caught), then appends the
   * execution and its spend atomically under the lock.
   */
  function commitExecution(execution = {}) {
    const executionId = execution.id ?? "ex_" + randomUUID();
    return mutate((state) => {
      if (state.executions.some((e) => e.id === executionId)) {
        return {
          committed: false,
          duplicate: true,
          reasons: ["DUPLICATE_EXECUTION"],
          executionId,
          boundary: CONTROL_PLANE_BOUNDARY,
        };
      }
      const amountMinor = optionalDecimal(execution.amountMinor, "execution.amountMinor");
      if (amountMinor == null) {
        appendAudit(state, "execution.refused", { executionId, reasons: ["AMOUNT_REQUIRED"], agentId: execution.agentId ?? null }, nowIso());
        return {
          committed: false,
          duplicate: false,
          reasons: ["AMOUNT_REQUIRED"],
          executionId,
          boundary: CONTROL_PLANE_BOUNDARY,
        };
      }
      const decision = evaluateRequest({
        state,
        agentId: execution.agentId ?? null,
        policyId: execution.policyId ?? null,
        merchant: execution.merchant ?? null,
        address: execution.address ?? null,
        amountMinor,
        currency: execution.currency ?? null,
        approvalId: execution.approvalId ?? null,
        nowMs: nowMs(),
        nowIso: nowIso(),
      });
      if (!decision.allowed) {
        const refused = { executionId, decision, at: nowIso() };
        appendAudit(state, "execution.refused", { executionId, reasons: decision.reasons, agentId: decision.agentId }, nowIso());
        return {
          committed: false,
          duplicate: false,
          reasons: decision.reasons,
          executionId,
          decision,
          boundary: CONTROL_PLANE_BOUNDARY,
        };
      }
      const record = {
        id: executionId,
        agentId: decision.agentId,
        policyId: decision.policyId,
        policyVersion: decision.policyVersion,
        merchant: decision.merchant,
        address: decision.address,
        amountMinor: decision.amountMinor,
        currency: decision.currency,
        approvalId: decision.approvalId,
        receiptId: execution.receiptId ?? null,
        verdict: execution.verdict ?? null,
        orderRef: execution.orderRef ?? null,
        at: nowIso(),
        decisionHash: digestOf(decision),
      };
      record.hash = digestOf({ ...record, hash: null });
      state.executions.push(record);
      appendAudit(
        state,
        "execution.committed",
        { executionId, agentId: record.agentId, policyId: record.policyId, amountMinor: record.amountMinor, verdict: record.verdict },
        nowIso(),
      );
      const totals = spendTotals(state.executions, { agentId: record.agentId, policyId: record.policyId, nowMs: nowMs() });
      return {
        committed: true,
        duplicate: false,
        execution: record,
        decision,
        spend: {
          agentId: record.agentId,
          policyId: record.policyId,
          rolling24hMinor: totals.rolling24hMinor.toString(),
          totalMinor: totals.totalMinor.toString(),
        },
        boundary: CONTROL_PLANE_BOUNDARY,
      };
    });
  }

  /** Kept for the v0 contract: record a pre-computed execution without gating. */
  function recordExecution(execution = {}) {
    const id = requiredId(execution.id, "execution.id");
    return mutate((state) => {
      const record = { ...execution, id, at: execution.at ?? nowIso() };
      record.hash = digestOf({ ...record, hash: null });
      state.executions.push(record);
      appendAudit(state, "execution.recorded", { executionId: id, agentId: execution.agentId ?? null }, nowIso());
      return record;
    });
  }

  /** Kept for the v0 contract: record a pre-computed approval. */
  function recordApproval(approval = {}) {
    const id = requiredId(approval.id, "approval.id");
    requiredId(approval.agentId, "approval.agentId");
    return mutate((state) => {
      const record = { ...approval, id, at: approval.at ?? nowIso() };
      record.hash = digestOf({ ...record, hash: null });
      state.approvals[id] = record;
      appendAudit(state, "approval.recorded", { approvalId: id, agentId: approval.agentId }, nowIso());
      return record;
    });
  }

  function recordVerification(verification = {}) {
    return mutate((state) => {
      const record = {
        id: verification.id ?? "vf_" + randomUUID(),
        executionId: verification.executionId ?? null,
        receiptId: verification.receiptId ?? null,
        verdict: verification.verdict ?? null,
        checks: verification.checks ?? [],
        source: verification.source ?? null,
        at: verification.at ?? nowIso(),
      };
      record.hash = digestOf(record);
      state.verifications.push(record);
      appendAudit(state, "verification.recorded", { verificationId: record.id, executionId: record.executionId, verdict: record.verdict }, nowIso());
      return record;
    });
  }

  // -- reads / reports -----------------------------------------------------

  function listExecutions({ limit = 100 } = {}) {
    return view((state) => state.executions.slice(-limit));
  }

  function listVerifications({ limit = 100 } = {}) {
    return view((state) => state.verifications.slice(-limit));
  }

  function spend({ agentId = null, policyId = null } = {}) {
    return view((state) => {
      const totals = spendTotals(state.executions, { agentId, policyId, nowMs: nowMs() });
      const executions = state.executions.filter(
        (e) => (agentId == null || e.agentId === agentId) && (policyId == null || e.policyId === policyId),
      );
      return {
        agentId,
        policyId,
        executions: executions.length,
        rolling24hMinor: totals.rolling24hMinor.toString(),
        totalMinor: totals.totalMinor.toString(),
        boundary: CONTROL_PLANE_BOUNDARY,
      };
    });
  }

  function auditReport({ limit = 200 } = {}) {
    return view((state) => {
      const chain = verifyAuditChain(state);
      const body = {
        version: CONTROL_PLANE_VERSION,
        schema: CONTROL_PLANE_SCHEMA,
        boundary: CONTROL_PLANE_BOUNDARY,
        generatedAt: nowIso(),
        counts: {
          agents: Object.keys(state.agents).length,
          policies: Object.keys(state.policies).length,
          policyVersions: Object.values(state.policies).reduce((n, p) => n + (p.versions?.length ?? 0), 0),
          approvals: Object.keys(state.approvals).length,
          executions: state.executions.length,
          verifications: state.verifications.length,
          revocations: Object.keys(state.revocations).length,
          audit: state.audit.length,
        },
        chain,
        agents: Object.values(state.agents),
        policies: Object.values(state.policies).map((p) => ({ ...p, active: activeVersion(p) })),
        revocations: Object.values(state.revocations),
        recentExecutions: state.executions.slice(-limit),
        recentVerifications: state.verifications.slice(-limit),
        recentAudit: state.audit.slice(-limit),
      };
      return { ...body, reportHash: digestOf(body) };
    });
  }

  function auditAnchor(options = {}) {
    return view((state) => {
      const chain = verifyAuditChain(state);
      const anchor = {
        ok: chain.ok,
        headHash: chain.headHash,
        length: chain.length,
        at: nowIso(),
      };
      const hmacKey = options.hmacKey ?? process.env.COREGUARD_CONTROL_PLANE_ANCHOR_HMAC_KEY ?? null;
      if (hmacKey) {
        anchor.hmacSha256 = createHmac("sha256", String(hmacKey)).update(canonicalJson({ headHash: anchor.headHash, length: anchor.length })).digest("hex");
        anchor.hmac = "hmac-sha256";
      }
      anchor.boundary = "Local audit head anchor. Optional HMAC is local shared-key integrity only. NOT_BUILT: external witness/anchoring service, KMS/HSM signatures, or on-chain anchoring.";
      return anchor;
    });
  }

  function verifyAnchor(expected = {}) {
    return view((state) => {
      const chain = verifyAuditChain(state);
      const expectedHead = expected.headHash ?? null;
      const expectedLength = expected.length ?? null;
      const headOk = expectedHead == null ? true : chain.headHash === expectedHead;
      const lengthOk = expectedLength == null ? true : chain.length === expectedLength;
      let hmacOk = true;
      const hmacKey = expected.hmacKey ?? process.env.COREGUARD_CONTROL_PLANE_ANCHOR_HMAC_KEY ?? null;
      if (expected.hmacSha256) {
        if (!hmacKey) hmacOk = false;
        else {
          const actual = createHmac("sha256", String(hmacKey)).update(canonicalJson({ headHash: chain.headHash, length: chain.length })).digest("hex");
          hmacOk = actual === String(expected.hmacSha256);
        }
      }
      return {
        ok: chain.ok && headOk && lengthOk && hmacOk,
        chainOk: chain.ok,
        headOk,
        lengthOk,
        hmacOk,
        expectedHead,
        expectedLength,
        actualHead: chain.headHash,
        actualLength: chain.length,
        boundary: "Local anchor comparison only. Optional HMAC is local shared-key integrity only. NOT_BUILT: external witness/anchoring service.",
      };
    });
  }

  function verifyLedger() {
    return view((state) => {
      const chain = verifyAuditChain(state);
      const executionHashesOk = state.executions.every((e) => {
        const { hash, ...rest } = e;
        return hash === digestOf({ ...rest, hash: null });
      });
      const approvalHashesOk = Object.values(state.approvals).every((a) => {
        const { hash, ...rest } = a;
        return hash == null || hash === digestOf({ ...rest, hash: null });
      });
      return {
        ok: chain.ok && executionHashesOk && approvalHashesOk,
        chain,
        executions: state.executions.length,
        executionHashesOk,
        approvals: Object.keys(state.approvals).length,
        approvalHashesOk,
        anchor: {
          headHash: chain.headHash,
          length: chain.length,
          boundary: "Local anchor only; external witness NOT_BUILT.",
        },
        boundary: CONTROL_PLANE_BOUNDARY,
      };
    });
  }

  function getState() {
    return view((state) => JSON.parse(JSON.stringify(state)));
  }

  return {
    version: CONTROL_PLANE_VERSION,
    schema: CONTROL_PLANE_SCHEMA,
    boundary: CONTROL_PLANE_BOUNDARY,
    storePath,
    upsertAgent,
    getAgent,
    listAgents,
    bindPolicy,
    revokeAgent,
    upsertPolicy,
    getPolicy,
    listPolicies,
    revokePolicy,
    requestApproval,
    decideApproval,
    getApproval,
    recordApproval,
    evaluate,
    authorize,
    commitExecution,
    recordExecution,
    recordVerification,
    listExecutions,
    listVerifications,
    spend,
    auditReport,
    verifyLedger,
    auditAnchor,
    verifyAnchor,
    getState,
    withAuditMeta,
  };
}
