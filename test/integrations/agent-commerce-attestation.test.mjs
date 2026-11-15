/**
 * CGXA/1 — Cross-Chain Execution Attestation contract tests (product 5).
 *
 * The attestation binds a CGCR/1 consent receipt id + the CGEP/1 trace-domain
 * commitment of the executed order + the target chain's COMMITTED binding
 * record (from the frozen adapter registry) into one offline-verifiable
 * record. The exact arc VERIFIES; every attack leg here REFUSES fail-closed
 * with a named code from the frozen vocabulary; the record id re-derives
 * byte-deterministically; the attestation view consumes nothing (a single-use
 * consent is still consumed only by its first verified execution). Node 18-safe.
 *
 * BOUNDARY (standing): no broadcast surface exists in the module; VERIFIED ≠
 * SAFE; an attestation of one environment is never bridge trust or a relay.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  createConsent,
  verifyExecution,
  buildAttestation,
  verifyAttestation,
  CGXA_VERSION,
  CGXA_REJECT_CODES,
  CGXA_ADAPTERS,
} from "../../packages/agent-commerce/index.mjs";
import { canonicalize } from "../../packages/canonical/index.js";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The synthetic approved checkout (pinned; identical shapes to the suite demo)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const APPROVAL_EPOCH = 1794657600; // 2026-11-14T12:00:00Z — pinned, never the wall clock
const ATTEST_EPOCH = 1794657660; // +60s — pinned attestation epoch

const ITEMS = [
  { sku: "SKU-CGXA-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-CGXA-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
];
const TAX_MINOR = "200";
const SHIPPING_MINOR = "100";
const TOTAL_MINOR = "3300";

const intent = {
  version: "CGEP/1",
  chainId: "0", // off-chain checkout ledger (synthetic — no chain broadcast anywhere)
  signer: AGENT,
  nonce: "0",
  validAfter: "0",
  validUntil: "9999999999",
  action: "AGENT_CHECKOUT",
  target: MERCHANT,
  selector: "0xa9059cbb",
  asset: "0x0000000000000000000000000000000000000002",
  amount: TOTAL_MINOR,
  recipient: MERCHANT,
  constraints: [
    { type: "MAX_VALUE", value: TOTAL_MINOR },
    { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
  ],
  merchantName: "synthetic-store.example",
  currency: "USD",
  items: ITEMS,
  taxMinor: TAX_MINOR,
  shippingMinor: SHIPPING_MINOR,
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-cgxa (placeholder — never a PAN)",
  agentRef: "DEMO-AGENT-CGXA-1 (declared, not detected)",
  authorizedAtUtc: "2026-11-14T12:00:00Z",
  expiryUtc: "2026-11-14T12:10:00Z",
  singleUse: true,
};

const policy = {
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Agent Commerce Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: TOTAL_MINOR }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
};

const declaredTrace = {
  txHash: "0x" + "bb".repeat(32),
  blockHash: "0x" + "dd".repeat(32),
  blockNumber: 65338,
  blockTimestamp: "1794657612",
  from: AGENT,
  to: MERCHANT,
  value: TOTAL_MINOR,
  calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + BigInt(TOTAL_MINOR).toString(16).padStart(64, "0"),
  slippageBps: "0",
  gasUsed: "21000",
  merchantName: intent.merchantName,
  currency: intent.currency,
  items: ITEMS,
  paymentCredentialRef: intent.paymentCredentialRef,
  orderRef: "ORDER-CGXA-0001 (simulated checkout order)",
  authorizedAtUtc: intent.authorizedAtUtc,
  singleUse: intent.singleUse,
};

async function makeConsent() {
  return createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
}

test("the CGXA vocabulary is frozen and the adapter registry carries exactly the committed facts", () => {
  assert.equal(CGXA_VERSION, "CGXA/1");
  assert.ok(Object.isFrozen(CGXA_REJECT_CODES));
  assert.deepEqual(
    [...CGXA_REJECT_CODES],
    [
      "MALFORMED_ATTESTATION",
      "ADAPTER_UNKNOWN",
      "CHAIN_BINDING_MISMATCH",
      "LEVEL_MISMATCH",
      "CONSENT_MISMATCH",
      "EXECUTION_MISMATCH",
      "TIME_INVALID",
      "ID_MISMATCH",
      "VERIFIER_ERROR",
    ]
  );
  assert.equal(CGXA_ADAPTERS.length, 2);
  const core = CGXA_ADAPTERS.find((a) => a.id === "core-dao-anchor");
  const stellar = CGXA_ADAPTERS.find((a) => a.id === "stellar-anchor");
  assert.deepEqual({ ...core.binding }, { chainId: "1116", anchor: "0x037dF08F2d43c5D03759279Fe35664f6AFf9EA6E" });
  assert.deepEqual(
    { ...stellar.binding },
    { anchorContract: "CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP" }
  );
  for (const a of CGXA_ADAPTERS) {
    assert.ok(Object.isFrozen(a) && Object.isFrozen(a.binding));
    assert.match(a.note, /owner-authorized only|NOT_BUILT/);
  }
});

test("the exact arc VERIFIES against the committed adapter (offline, no broadcast)", async () => {
  const consent = await makeConsent();
  const execution = await verifyExecution(consent, declaredTrace, { consumedSet: new Set() });
  assert.equal(execution.verdict, "VERIFIED");

  const { spec, attestation, attestationId } = await buildAttestation({
    consent,
    executedTrace: declaredTrace,
    adapterId: "stellar-anchor",
    nowSeconds: ATTEST_EPOCH,
  });
  assert.equal(spec, "CGXA/1");
  assert.equal(attestation.v, "CGXA/1");
  assert.equal(attestation.adapter.id, "stellar-anchor");
  assert.equal(attestation.verificationLevel, "COMMITTED_EVIDENCE");

  const verdict = await verifyAttestation({ attestation, attestationId, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "VERIFIED");
  assert.equal(verdict.code, null);
  assert.equal(verdict.attested.network, "stellar-mainnet");
  assert.match(verdict.boundary, /VERIFIED ≠ SAFE/);
});

test("the Core DAO adapter verifies the same arc against the committed anchor identity", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({
    consent,
    executedTrace: declaredTrace,
    adapterId: "core-dao-anchor",
    nowSeconds: ATTEST_EPOCH,
  });
  const verdict = await verifyAttestation({ attestation, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "VERIFIED");
  assert.equal(verdict.attested.network, "core-dao-mainnet-1116");
});

test("the record id re-derives byte-deterministically (same inputs, same bytes)", async () => {
  const consent = await makeConsent();
  const a = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const b = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  assert.equal(a.attestationId, b.attestationId);
  assert.equal(canonicalize(a.attestation), canonicalize(b.attestation));
  const verdict = await verifyAttestation({ attestation: b.attestation, attestationId: a.attestationId, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "VERIFIED");
});

test("a wrong attestation id REFUSES with ID_MISMATCH", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const verdict = await verifyAttestation({ attestation, attestationId: "0x" + "00".repeat(32), consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "ID_MISMATCH");
});

test("a different consent REFUSES with CONSENT_MISMATCH", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });

  const otherIntent = { ...intent, amount: "9900" };
  const otherConsent = await createConsent({ intent: otherIntent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
  const verdict = await verifyAttestation({ attestation, consent: otherConsent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "CONSENT_MISMATCH");
});

test("a drifted executed trace REFUSES with EXECUTION_MISMATCH", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const drifted = { ...declaredTrace, value: "9999" };
  const verdict = await verifyAttestation({ attestation, consent, executedTrace: drifted });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "EXECUTION_MISMATCH");
});

test("an unknown adapter REFUSES (build throws, verify refuses) with ADAPTER_UNKNOWN", async () => {
  const consent = await makeConsent();
  await assert.rejects(
    buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "not-a-adapter", nowSeconds: ATTEST_EPOCH }),
    (err) => err.code === "ADAPTER_UNKNOWN"
  );
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const forged = { ...attestation, adapter: { ...attestation.adapter, id: "not-a-adapter" } };
  const verdict = await verifyAttestation({ attestation: forged, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "ADAPTER_UNKNOWN");
});

test("a mutated chain binding fact REFUSES with CHAIN_BINDING_MISMATCH", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const forged = { ...attestation, chainBinding: { ...attestation.chainBinding, anchorContract: "CCKA0000000000000000000000000000000000000000000000000000DEADBEEF" } };
  const verdict = await verifyAttestation({ attestation: forged, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "CHAIN_BINDING_MISMATCH");
});

test("a mutated verification level REFUSES with LEVEL_MISMATCH", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const forged = { ...attestation, verificationLevel: "BRIDGE_TRUST" };
  const verdict = await verifyAttestation({ attestation: forged, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "LEVEL_MISMATCH");
});

test("time is pinned: the wall clock is never read (build throws TIME_INVALID, verify refuses TIME_INVALID)", async () => {
  const consent = await makeConsent();
  await assert.rejects(
    buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: 1794657660.5 }),
    (err) => err.code === "TIME_INVALID"
  );
  await assert.rejects(
    buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor" }),
    (err) => err.code === "TIME_INVALID"
  );
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const forged = { ...attestation, issuedAtSeconds: -1 };
  const verdict = await verifyAttestation({ attestation: forged, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "TIME_INVALID");
});

test("an unknown field REFUSES with MALFORMED_ATTESTATION (the field set is closed)", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const forged = { ...attestation, extra: "decoration is a defect" };
  const verdict = await verifyAttestation({ attestation: forged, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "MALFORMED_ATTESTATION");
});

test("an error inside the verifier itself REFUSES with VERIFIER_ERROR, never a leaked pass", async () => {
  const consent = await makeConsent();
  const { attestation } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const hostile = { ...attestation, chainBinding: { get anchorContract() { throw new Error("boom"); } } };
  const verdict = await verifyAttestation({ attestation: hostile, consent, executedTrace: declaredTrace });
  assert.equal(verdict.decision, "REFUSED");
  assert.equal(verdict.code, "VERIFIER_ERROR");
});

test("the attestation view consumes NOTHING: a single-use consent is still first-consumed by its verified execution", async () => {
  const consent = await makeConsent();
  const { attestation, attestationId } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const v1 = await verifyAttestation({ attestation, attestationId, consent, executedTrace: declaredTrace });
  const v2 = await verifyAttestation({ attestation, attestationId, consent, executedTrace: declaredTrace });
  assert.equal(v1.decision, "VERIFIED");
  assert.equal(v2.decision, "VERIFIED");

  const ledger = new Set(); // explicit ledger: the default is process-local module state, and every consent here is byte-identical
  const execution = await verifyExecution(consent, declaredTrace, { consumedSet: ledger });
  assert.equal(execution.verdict, "VERIFIED");
  assert.equal(execution.consumed, true);
  const replay = await verifyExecution(consent, declaredTrace, { consumedSet: ledger });
  assert.equal(replay.verdict, "INVALID");
});

test("every adapter fact literal appears in its cited committed document", () => {
  for (const adapter of CGXA_ADAPTERS) {
    const doc = readFileSync(resolve(here, "../../", adapter.source), "utf8");
    for (const [factKey, factValue] of Object.entries(adapter.binding)) {
      assert.ok(
        doc.includes(factValue),
        `${adapter.id}.${factKey} = ${factValue} is not pinned in ${adapter.source}`
      );
    }
  }
});

test("there is no broadcast surface: no exported name signs, submits or sends", async () => {
  const mod = await import("../../packages/agent-commerce/attest.mjs");
  const names = Object.keys(mod);
  assert.ok(names.includes("buildAttestation") && names.includes("verifyAttestation"));
  for (const n of names) {
    assert.doesNotMatch(n, /broadcast|submit|send|sign/i, `exported name ${n} suggests a broadcast surface`);
  }
});
