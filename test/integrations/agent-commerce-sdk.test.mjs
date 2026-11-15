/**
 * Agent Commerce SDK (AC-SDK/1) contract tests — CGCR/1 consent receipts,
 * execution verification (fail-closed), and the AGR/1 risk taxonomy.
 * Offline · deterministic · zero keys. Node 18-safe (fileURLToPath idiom).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createConsent, verifyConsent, verifyExecution, assessRisk, nameDrift, AGENT_COMMERCE_VERSION, CONSENT_SPEC } from "../../packages/agent-commerce/index.mjs";
import { AGR_VERSION, RISK_CLASSES } from "../../packages/agent-commerce/risk.mjs";

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600"; // 2026-11-14T12:00:00Z

const ITEMS = [
  { sku: "SKU-T-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-T-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
];

function testIntent(overrides = {}) {
  return {
    version: "CGEP/1",
    chainId: "0",
    signer: AGENT,
    nonce: "0",
    validAfter: "0",
    validUntil: "9999999999",
    action: "AGENT_CHECKOUT",
    target: MERCHANT,
    selector: "0xa9059cbb",
    asset: "0x0000000000000000000000000000000000000002",
    amount: "3300",
    recipient: MERCHANT,
    constraints: [
      { type: "MAX_VALUE", value: "3300" },
      { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
    ],
    merchantName: "synthetic-store.example",
    currency: "USD",
    items: ITEMS,
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder — never a PAN)",
    authorizedAtUtc: "2026-11-14T12:00:00Z",
    expiryUtc: "2026-11-14T12:10:00Z",
    singleUse: true,
    ...overrides,
  };
}

function testPolicy() {
  return {
    version: "CGEP/1",
    policyId: "0x00000000000000000000000000000000000000ac",
    name: "Agent Commerce Policy",
    rules: [
      { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "3300" }, severity: "CRITICAL" },
      { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
      { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
      { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
    ],
  };
}

function executed({ totalMinor = "3300", to = MERCHANT, items = ITEMS, credential, timestamp = NOW, dropTimestamp = false } = {}) {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, "0");
  const trace = {
    txHash: "0x" + "aa".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: timestamp,
    from: AGENT,
    to,
    value: totalMinor,
    calldata: "0xa9059cbb" + to.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    items,
    paymentCredentialRef: credential ?? testIntent().paymentCredentialRef,
  };
  if (dropTimestamp) delete trace.blockTimestamp;
  return trace;
}

const newLedger = () => new Set();

test("consent creation is deterministic (same inputs, same receipt id, pinned clock)", async () => {
  const a = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const b = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  assert.equal(a.receiptId, b.receiptId);
  assert.equal(a.spec, CONSENT_SPEC);
  assert.equal(a.sdkVersion, AGENT_COMMERCE_VERSION);
  assert.equal(a.receipt.timestamp, NOW);
});

test("createConsent refuses to run without a pinned clock (C40 rule, fail-closed)", async () => {
  await assert.rejects(() => createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed() }), /pinned nowSeconds/);
});

test("consent integrity verifies against its own approved bytes", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const v = await verifyConsent(consent);
  assert.equal(v.result, "VERIFIED");
  assert.ok(v.checks.every((c) => c.result !== "FAIL"));
});

test("any byte of the consent record tampered -> commitment mismatch, INVALID", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const tampered = { ...consent, receipt: { ...consent.receipt, result: "INVALID" } };
  const report = await verifyExecution(tampered, executed(), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  const commitment = report.checks.find((c) => c.check === "RECEIPT_COMMITMENT");
  assert.equal(commitment.result, "FAIL");
});

test("exact execution -> VERIFIED with every check PASS and CLEAN taxonomy", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed(), { consumedSet: newLedger() });
  assert.equal(report.verdict, "VERIFIED");
  assert.equal(report.risk.classification, "CLEAN");
  assert.ok(report.checks.every((c) => c.result === "PASS"));
  assert.ok(report.boundary.includes("VERIFIED ≠ SAFE"));
});

test("TOTAL_DRIFT -> INVALID with VALUE_ESCALATION named", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed({ totalMinor: "3499" }), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  const codes = report.risk.violations.map((v) => v.code);
  assert.ok(codes.includes("VALUE_ESCALATION"));
  assert.ok(report.driftNamed.some((d) => d.includes("3499")));
});

test("MERCHANT_SWAP -> INVALID with RECIPIENT_SUBSTITUTION named", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed({ to: "0x0000000000000000000000000000000000000099" }), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  assert.ok(report.risk.violations.some((v) => v.code === "RECIPIENT_SUBSTITUTION"));
});

test("ITEM_MUTATION (injected item) -> INVALID with the item class named", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const injected = [...ITEMS, { sku: "SKU-INJECTED", name: "Injected item C", qty: 1, unitPriceMinor: "500" }];
  const report = await verifyExecution(consent, executed({ totalMinor: "3800", items: injected }), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  assert.ok(report.risk.violations.some((v) => v.code === "ITEM_MUTATION"));
});

test("CREDENTIAL_SUBSTITUTION -> INVALID with the credential class named", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed({ credential: "TOKENIZED-CREDENTIAL-REF-OTHER" }), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  assert.ok(report.risk.violations.some((v) => v.code === "CREDENTIAL_SUBSTITUTION"));
});

test("EXPIRED_AUTHORIZATION: execution after expiryUtc -> INVALID", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed({ timestamp: "1794658300" }), { consumedSet: newLedger() }); // 12:11:40Z > 12:10:00Z
  assert.equal(report.verdict, "INVALID");
  assert.ok(report.risk.violations.some((v) => v.code === "EXPIRED_AUTHORIZATION"));
});

test("single-use consent consumed by its first VERIFIED execution; replay -> SINGLE_USE_REUSE", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const ledger = newLedger();
  const first = await verifyExecution(consent, executed(), { consumedSet: ledger });
  assert.equal(first.verdict, "VERIFIED");
  assert.ok(ledger.has(consent.receiptId));
  const replay = await verifyExecution(consent, executed(), { consumedSet: ledger });
  assert.equal(replay.verdict, "INVALID");
  assert.ok(replay.risk.violations.some((v) => v.code === "SINGLE_USE_REUSE"));
});

test("a multi-use consent (singleUse absent) may execute repeatedly", async () => {
  const consent = await createConsent({ intent: testIntent({ singleUse: undefined }), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const ledger = newLedger();
  const a = await verifyExecution(consent, executed(), { consumedSet: ledger });
  const b = await verifyExecution(consent, executed(), { consumedSet: ledger });
  assert.equal(a.verdict, "VERIFIED");
  assert.equal(b.verdict, "VERIFIED");
  assert.equal(ledger.size, 0); // nothing to consume
});

test("malformed execution payload -> refused with MALFORMED_EXECUTION, never guessed", async () => {
  const consent = await createConsent({ intent: testIntent(), policy: testPolicy(), declaredTrace: executed(), nowSeconds: NOW });
  const report = await verifyExecution(consent, executed({ dropTimestamp: true }), { consumedSet: newLedger() });
  assert.equal(report.verdict, "INVALID");
  assert.ok(report.risk.violations.some((v) => v.code === "MALFORMED_EXECUTION"));
});

test("assessRisk is deterministic and carries its boundary in every report", () => {
  const intent = testIntent();
  const a = assessRisk({ intent, policy: testPolicy(), trace: executed() });
  const b = assessRisk({ intent, policy: testPolicy(), trace: executed() });
  assert.deepEqual(a, b);
  assert.equal(a.classification, "CLEAN");
  assert.equal(a.spec, AGR_VERSION);
  assert.ok(a.boundary.includes("never a probabilistic fraud score"));
});

test("the AGR/1 taxonomy carries the eight named classes with severities", () => {
  const expected = {
    RECIPIENT_SUBSTITUTION: "CRITICAL",
    VALUE_ESCALATION: "CRITICAL",
    ITEM_MUTATION: "HIGH",
    CREDENTIAL_SUBSTITUTION: "CRITICAL",
    EXPIRED_AUTHORIZATION: "CRITICAL",
    POLICY_VIOLATION: "CRITICAL",
    SINGLE_USE_REUSE: "HIGH",
    MALFORMED_EXECUTION: "CRITICAL",
  };
  assert.deepEqual(Object.keys(RISK_CLASSES), Object.keys(expected));
  for (const [code, severity] of Object.entries(expected)) {
    assert.equal(RISK_CLASSES[code].severity, severity, code);
    assert.ok(typeof RISK_CLASSES[code].description === "string" && RISK_CLASSES[code].description.length > 10);
  }
});

test("nameDrift names the human-readable drift for the drifted fields", () => {
  const drift = nameDrift(testIntent(), executed({ totalMinor: "3499", to: "0x0000000000000000000000000000000000000099" }));
  assert.ok(drift.some((d) => d.includes("total: approved 3300 -> executed 3499")));
  assert.ok(drift.some((d) => d.includes("payee: approved")));
  assert.equal(nameDrift(testIntent(), executed()).length, 0);
});
