/**
 * CGCP/1 — the self-hosted Policy & Evidence Control Plane contract.
 *
 * Pins the behaviours an operator relies on, and the honesty boundaries:
 * versioned policies, bound agents, allow/deny lists, rolling spend windows,
 * approvals bound to one order, re-evaluation at commit, revocation, duplicate
 * refusal, the hash-chained audit trail (including tamper detection), the
 * cross-process lock, and the NOT_BUILT list that keeps this from being sold as
 * enterprise SaaS.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, openSync, writeSync, closeSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createControlPlane,
  verifyAuditChain,
  CONTROL_PLANE_VERSION,
  CONTROL_PLANE_SCHEMA,
  CONTROL_PLANE_BOUNDARY,
  CONTROL_PLANE_DECISION_REASONS,
} from "../../packages/agent-commerce/control-plane.mjs";

const PINNED_NOW = "2026-11-22T10:00:00.000Z";
const pinnedClock = () => new Date(PINNED_NOW);

function planeIn(dir, extra = {}) {
  return createControlPlane({
    storePath: join(dir, "cp.json"),
    now: pinnedClock,
    lockTimeoutMs: 500,
    staleLockMs: 60000,
    create: true,
    ...extra,
  });
}

test("CGCP/1 constants and the NOT_BUILT boundary are stated, not implied", () => {
  assert.equal(CONTROL_PLANE_VERSION, "CGCP/1");
  assert.equal(CONTROL_PLANE_SCHEMA, "coreguard.control-plane/1");
  assert.match(CONTROL_PLANE_BOUNDARY, /NOT_BUILT/);
  assert.match(CONTROL_PLANE_BOUNDARY, /multi-tenant RBAC\/SSO\/SCIM/);
  assert.match(CONTROL_PLANE_BOUNDARY, /distributed HA\/consensus/);
  assert.match(CONTROL_PLANE_BOUNDARY, /VERIFIED ≠ SAFE/);
  assert.ok(CONTROL_PLANE_DECISION_REASONS.includes("APPROVAL_MISMATCH"));
});

test("agents bind to a policy; evaluation uses the bound policy when none is passed", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertPolicy({ id: "p1", name: "Default", spendLimitMinor: "1000", allowMerchants: ["m1"] });
    cp.upsertAgent({ id: "a1", name: "Agent One" });
    cp.bindPolicy("a1", "p1");

    const ok = cp.evaluate({ agentId: "a1", merchant: "m1", amountMinor: "900" });
    assert.equal(ok.allowed, true, JSON.stringify(ok.reasons));
    assert.equal(ok.policyId, "p1");
    assert.equal(ok.policyVersion, 1);
    assert.equal(ok.checks.agent.ok, true);

    const unknown = cp.evaluate({ agentId: "nope", merchant: "m1", amountMinor: "1" });
    assert.equal(unknown.allowed, false);
    assert.ok(unknown.reasons.includes("UNKNOWN_AGENT"));
    assert.ok(unknown.reasons.includes("UNKNOWN_POLICY"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("policies are immutable version history: an upsert appends, it does not rewrite", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "1000" });
    cp.upsertAgent({ id: "a1", policyId: "p1" });

    const refused = cp.evaluate({ agentId: "a1", amountMinor: "1500" });
    assert.equal(refused.allowed, false);
    assert.ok(refused.reasons.includes("SPEND_LIMIT_EXCEEDED"));

    const v2 = cp.upsertPolicy({ id: "p1", spendLimitMinor: "2000", note: "raise cap" });
    assert.equal(v2.currentVersion, 2);
    assert.equal(v2.versions.length, 2);
    assert.notEqual(v2.versions[0].hash, v2.versions[1].hash);

    const allowed = cp.evaluate({ agentId: "a1", amountMinor: "1500" });
    assert.equal(allowed.allowed, true, JSON.stringify(allowed.reasons));
    assert.equal(allowed.policyVersion, 2);

    const oldVersion = cp.getPolicy("p1").versions[0];
    assert.equal(oldVersion.spec.spendLimitMinor, "1000", "history keeps the old spec");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("merchant/address allow and deny lists refuse with named reasons", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({
      id: "p1",
      allowMerchants: ["m1"],
      denyMerchants: ["m-bad"],
      allowAddresses: ["0xgood"],
      denyAddresses: ["0xbad"],
    });

    const denied = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m-bad", address: "0xbad", amountMinor: "1" });
    assert.equal(denied.allowed, false);
    assert.ok(denied.reasons.includes("MERCHANT_DENIED"));
    assert.ok(denied.reasons.includes("ADDRESS_DENIED"));

    const offList = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m2", address: "0xother", amountMinor: "1" });
    assert.equal(offList.allowed, false);
    assert.ok(offList.reasons.includes("MERCHANT_NOT_ALLOWED"));
    assert.ok(offList.reasons.includes("ADDRESS_NOT_ALLOWED"));

    const good = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1", address: "0xgood", amountMinor: "1" });
    assert.equal(good.allowed, true, JSON.stringify(good.reasons));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rolling 24h and lifetime limits are enforced from committed executions", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "1000", dailyLimitMinor: "1500", totalLimitMinor: "1800" });

    const first = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "1000" });
    assert.equal(first.committed, true, JSON.stringify(first.reasons));
    assert.equal(first.spend.rolling24hMinor, "1000");
    assert.equal(first.spend.totalMinor, "1000");

    const second = cp.commitExecution({ id: "e2", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "600" });
    assert.equal(second.committed, false);
    assert.ok(second.reasons.includes("DAILY_LIMIT_EXCEEDED"));

    const withinDaily = cp.commitExecution({ id: "e3", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500" });
    assert.equal(withinDaily.committed, true, JSON.stringify(withinDaily.reasons));

    const pastTotal = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "400" });
    assert.equal(pastTotal.allowed, false);
    assert.ok(pastTotal.reasons.includes("TOTAL_LIMIT_EXCEEDED"));

    const summary = cp.spend({ agentId: "a1" });
    assert.equal(summary.totalMinor, "1500");
    assert.equal(summary.executions, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an approval authorises exactly one order (amount/merchant/agent bound)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "10000", requireApprovalAboveMinor: "1000" });

    const needs = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "2000" });
    assert.equal(needs.allowed, false);
    assert.ok(needs.reasons.includes("APPROVAL_REQUIRED"));

    const approval = cp.requestApproval({ id: "ap1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "2000" });
    assert.equal(approval.status, "pending");

    const stillPending = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "2000", approvalId: "ap1" });
    assert.equal(stillPending.allowed, false);
    assert.ok(stillPending.reasons.includes("APPROVAL_NOT_APPROVED"));

    cp.decideApproval("ap1", { decision: "approved", decidedBy: "ops@example" });

    const wrongAmount = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "3000", approvalId: "ap1" });
    assert.equal(wrongAmount.committed, false);
    assert.ok(wrongAmount.reasons.includes("APPROVAL_MISMATCH"));

    const wrongMerchant = cp.commitExecution({ id: "e2", agentId: "a1", policyId: "p1", merchant: "m2", amountMinor: "2000", approvalId: "ap1" });
    assert.equal(wrongMerchant.committed, false);
    assert.ok(wrongMerchant.reasons.includes("APPROVAL_MISMATCH"));

    const exact = cp.commitExecution({ id: "e3", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "2000", approvalId: "ap1" });
    assert.equal(exact.committed, true, JSON.stringify(exact.reasons));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an expired approval cannot authorise a commit", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", requireApprovalAboveMinor: "100" });
    cp.requestApproval({ id: "ap-old", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500", expiresAt: "2026-11-22T09:00:00.000Z" });
    cp.decideApproval("ap-old", { decision: "approved" });

    const result = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500", approvalId: "ap-old" });
    assert.equal(result.committed, false);
    assert.ok(result.reasons.includes("APPROVAL_EXPIRED"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a commit re-evaluates: revocation between authorise and commit is caught", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "5000" });

    const authorisation = cp.authorize({ agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "100" });
    assert.equal(authorisation.allowed, true);
    assert.ok(authorisation.decisionId.startsWith("dec_"));

    cp.revokeAgent("a1", "operator kill switch");
    const commit = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "100" });
    assert.equal(commit.committed, false);
    assert.ok(commit.reasons.includes("AGENT_REVOKED_OR_INACTIVE"));

    assert.throws(() => cp.upsertAgent({ id: "a1", status: "active" }), /revoked agent cannot be reactivated/);
    assert.throws(() => cp.revokeAgent("ghost"), /unknown agent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("duplicate execution ids are refused, not double-counted", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "10000" });

    const first = cp.commitExecution({ id: "same", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "100" });
    assert.equal(first.committed, true);
    const second = cp.commitExecution({ id: "same", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "100" });
    assert.equal(second.committed, false);
    assert.equal(second.duplicate, true);
    assert.deepEqual(second.reasons, ["DUPLICATE_EXECUTION"]);
    assert.equal(cp.spend({ agentId: "a1" }).totalMinor, "100");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the audit trail is hash-chained, verifies clean, and names the first tampered entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const storePath = join(dir, "cp.json");
    const cp = createControlPlane({ storePath, now: pinnedClock, lockTimeoutMs: 500, create: true });
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "100" });
    cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "100" });
    cp.revokePolicy("p1", "retire");

    const clean = cp.verifyLedger();
    assert.equal(clean.ok, true, JSON.stringify(clean));
    assert.equal(clean.chain.ok, true);
    assert.ok(clean.chain.length >= 4);
    assert.match(clean.chain.headHash, /^sha256:[0-9a-f]{64}$/);

    const state = JSON.parse(readFileSync(storePath, "utf8"));
    state.audit[1].detail.agentId = "forged";
    assert.equal(verifyAuditChain(state).ok, false);
    assert.equal(verifyAuditChain(state).brokenAt, 2);
    writeFileSync(storePath, JSON.stringify(state, null, 2));

    const tampered = cp.verifyLedger();
    assert.equal(tampered.ok, false);
    assert.equal(tampered.chain.brokenAt, 2);
    assert.match(tampered.chain.reason, /hash does not recompute/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale lock from a dead process is broken instead of wedging the plane", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const storePath = join(dir, "cp.json");
    const cp = createControlPlane({ storePath, now: pinnedClock, lockTimeoutMs: 200, staleLockMs: 50, create: true });
    const lockPath = storePath + ".lock";
    const fd = openSync(lockPath, "wx");
    writeSync(fd, "dead-holder");
    closeSync(fd);
    const old = (Date.now() - 60_000) / 1000;
    utimesSync(lockPath, old, old);

    const agent = cp.upsertAgent({ id: "a1" });
    assert.equal(agent.id, "a1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the report carries counts, the active spec, chain status and a body hash", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "500", currency: "USD" });
    cp.requestApproval({ id: "ap1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "50" });
    cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "50", currency: "USD" });
    cp.recordVerification({ executionId: "e1", verdict: "VERIFIED", checks: [{ name: "binding", ok: true }] });

    const report = cp.auditReport();
    assert.equal(report.counts.agents, 1);
    assert.equal(report.counts.policies, 1);
    assert.equal(report.counts.policyVersions, 1);
    assert.equal(report.counts.approvals, 1);
    assert.equal(report.counts.executions, 1);
    assert.equal(report.counts.verifications, 1);
    assert.equal(report.chain.ok, true);
    assert.equal(report.policies[0].active.spec.currency, "USD");
    assert.match(report.reportHash, /^sha256:[0-9a-f]{64}$/);
    assert.ok(report.boundary.includes("NOT_BUILT"));
    assert.equal(report.recentAudit.length, report.counts.audit);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-01: missing amountMinor is refused when monetary policy applies and cannot be committed", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "1000", dailyLimitMinor: "1000", requireApprovalAboveMinor: "500" });

    const evalMissing = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1" });
    assert.equal(evalMissing.allowed, false);
    assert.ok(evalMissing.reasons.includes("AMOUNT_REQUIRED"));

    const committed = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1" });
    assert.equal(committed.committed, false);
    assert.ok(committed.reasons.includes("AMOUNT_REQUIRED"));
    assert.equal(cp.spend({ agentId: "a1" }).totalMinor, "0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-02: missing merchant/address/currency are refused when policy declares those constraints", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({
      id: "p1",
      allowMerchants: ["m-good"],
      allowAddresses: ["0xgood"],
      currency: "USD",
      spendLimitMinor: "1000",
    });

    const missing = cp.evaluate({ agentId: "a1", policyId: "p1", amountMinor: "400" });
    assert.equal(missing.allowed, false);
    assert.ok(missing.reasons.includes("MERCHANT_MISSING"));
    assert.ok(missing.reasons.includes("ADDRESS_MISSING"));
    assert.ok(missing.reasons.includes("CURRENCY_MISSING"));

    const commit = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", amountMinor: "400" });
    assert.equal(commit.committed, false);
    assert.ok(commit.reasons.includes("MERCHANT_MISSING"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-03: malformed approval expiresAt is rejected at creation and never treated as valid", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", spendLimitMinor: "10000", requireApprovalAboveMinor: "100" });

    assert.throws(
      () => cp.requestApproval({ id: "ap-bad", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500", expiresAt: "not-a-date" }),
      /expiresAt/,
    );

    // Simulate legacy/corrupted state: an unparseable expiresAt must not authorise.
    const storePath = join(dir, "cp.json");
    const state = JSON.parse(readFileSync(storePath, "utf8"));
    state.approvals["ap-legacy"] = {
      id: "ap-legacy",
      agentId: "a1",
      policyId: "p1",
      merchant: "m1",
      address: null,
      amountMinor: "500",
      currency: null,
      status: "approved",
      requestedAt: PINNED_NOW,
      requestedBy: null,
      expiresAt: "not-a-date",
      decidedAt: PINNED_NOW,
      decidedBy: "ops",
      reason: null,
      hash: "sha256:legacy",
    };
    writeFileSync(storePath, JSON.stringify(state, null, 2));

    const evalLegacy = cp.evaluate({ agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500", approvalId: "ap-legacy" });
    assert.equal(evalLegacy.allowed, false);
    assert.ok(evalLegacy.reasons.includes("APPROVAL_EXPIRES_AT_INVALID"));

    const commit = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m1", amountMinor: "500", approvalId: "ap-legacy" });
    assert.equal(commit.committed, false);
    assert.ok(commit.reasons.includes("APPROVAL_EXPIRES_AT_INVALID"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("CP-06: missing store refuses to open without create:true", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    assert.throws(
      () => createControlPlane({ storePath: join(dir, "missing.json"), now: pinnedClock }),
      /STORE_MISSING|store missing/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-07: reserved/prototype ids are rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    assert.throws(() => cp.upsertAgent({ id: "__proto__" }), /reserved key|must match/);
    assert.throws(() => cp.upsertPolicy({ id: "constructor", spendLimitMinor: "1" }), /reserved key|must match/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-12 boundary improvement: auditAnchor reports local head and verifyAnchor detects tail mismatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    const anchor = cp.auditAnchor();
    assert.equal(anchor.ok, true);
    assert.match(anchor.headHash, /^sha256:/);
    assert.equal(cp.verifyAnchor({ headHash: anchor.headHash, length: anchor.length }).ok, true);
    cp.upsertPolicy({ id: "p1" });
    const mismatch = cp.verifyAnchor({ headHash: anchor.headHash, length: anchor.length });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.headOk, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-12 bounded improvement: optional local HMAC anchor verifies with same key and fails with wrong key", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    const anchor = cp.auditAnchor({ hmacKey: "secret-key-123" });
    assert.equal(anchor.hmac, "hmac-sha256");
    assert.match(anchor.hmacSha256, /^[0-9a-f]{64}$/);
    assert.equal(cp.verifyAnchor({ ...anchor, hmacKey: "secret-key-123" }).ok, true);
    assert.equal(cp.verifyAnchor({ ...anchor, hmacKey: "wrong-key" }).hmacOk, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CP-02 asked for one regression per field: the combined test above proves the
// three refusals together, these pin each field alone so a change that reopens
// one of them cannot hide behind the other two.

test("CP-02 (merchant alone): a policy that lists merchants refuses a missing merchant", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", allowMerchants: ["m-good"] });

    const missing = cp.evaluate({ agentId: "a1", policyId: "p1", amountMinor: "400" });
    assert.equal(missing.allowed, false);
    assert.ok(missing.reasons.includes("MERCHANT_MISSING"), JSON.stringify(missing.reasons));

    const committed = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", merchant: "m-good", amountMinor: "400" });
    assert.equal(committed.committed, true, JSON.stringify(committed.reasons));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-02 (address alone): a policy that lists addresses refuses a missing address", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", allowAddresses: ["0xgood"] });

    const missing = cp.evaluate({ agentId: "a1", policyId: "p1", amountMinor: "400" });
    assert.equal(missing.allowed, false);
    assert.ok(missing.reasons.includes("ADDRESS_MISSING"), JSON.stringify(missing.reasons));

    const committed = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", address: "0xgood", amountMinor: "400" });
    assert.equal(committed.committed, true, JSON.stringify(committed.reasons));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-02 (currency alone): a policy that pins a currency refuses a missing one", () => {
  const dir = mkdtempSync(join(tmpdir(), "cgcp-"));
  try {
    const cp = planeIn(dir);
    cp.upsertAgent({ id: "a1" });
    cp.upsertPolicy({ id: "p1", currency: "USD" });

    const missing = cp.evaluate({ agentId: "a1", policyId: "p1", amountMinor: "400" });
    assert.equal(missing.allowed, false);
    assert.ok(missing.reasons.includes("CURRENCY_MISSING"), JSON.stringify(missing.reasons));

    const mismatch = cp.commitExecution({ id: "e1", agentId: "a1", policyId: "p1", amountMinor: "400", currency: "EUR" });
    assert.equal(mismatch.committed, false);
    assert.ok(mismatch.reasons.includes("CURRENCY_MISMATCH"));

    const committed = cp.commitExecution({ id: "e2", agentId: "a1", policyId: "p1", amountMinor: "400", currency: "USD" });
    assert.equal(committed.committed, true, JSON.stringify(committed.reasons));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
