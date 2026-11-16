/**
 * AC-CS/1 — durable single-use consumption store contract tests.
 *
 * The file-backed store is a Set-compatible adapter over the existing
 * `consumedSet` injection: `has`/`add` semantics identical to a Set, durable
 * across process restarts on the same host. It is NOT a distributed ledger and
 * NOT an on-chain marker (on-chain anchoring OWNER-GATED / NOT_BUILT).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConsent,
  verifyExecution,
  createConsumptionStore,
  openConsumptionStore,
  CONSUMPTION_STORE_VERSION,
  CONSUMPTION_STORE_BOUNDARY,
} from "../../packages/agent-commerce/index.mjs";

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600";

function intent() {
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
    items: [{ sku: "SKU-CS-1", name: "Synthetic item", qty: 1, unitPriceMinor: "3300" }],
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-CS (placeholder)",
    singleUse: true,
  };
}

const policy = () => ({
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Agent Commerce Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "3300" }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
});

function trace() {
  const amountHex = BigInt("3300").toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "aa".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: NOW,
    from: AGENT,
    to: MERCHANT,
    value: "3300",
    calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    items: intent().items,
    paymentCredentialRef: intent().paymentCredentialRef,
  };
}

test("AC-CS/1 constants and boundary are honest", () => {
  assert.equal(CONSUMPTION_STORE_VERSION, "AC-CS/1");
  assert.match(CONSUMPTION_STORE_BOUNDARY, /NOT a distributed ledger/);
  assert.match(CONSUMPTION_STORE_BOUNDARY, /NOT an on-chain marker/);
  assert.match(CONSUMPTION_STORE_BOUNDARY, /OWNER-GATED \/ NOT_BUILT/);
  assert.match(CONSUMPTION_STORE_BOUNDARY, /VERIFIED ≠ SAFE/);
});

test("createConsumptionStore is Set-compatible and persists across reopen", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-cs-"));
  try {
    const file = join(dir, "ledger.json");
    const store = createConsumptionStore(file);
    assert.equal(store.spec, CONSUMPTION_STORE_VERSION);
    assert.equal(store.size, 0);
    assert.equal(store.has("r1"), false);
    store.add("r1");
    assert.equal(store.has("r1"), true);
    assert.equal(store.size, 1);
    assert.deepEqual(store.ids(), ["r1"]);

    const reopened = createConsumptionStore(file);
    assert.equal(reopened.has("r1"), true);
    assert.equal(reopened.size, 1);

    const ro = openConsumptionStore(file);
    assert.equal(ro.has("r1"), true);
    assert.equal(ro.size, 1);
    assert.deepEqual(ro.ids(), ["r1"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("file-backed store prevents single-use replay across process-style reopen (shared ledger injection)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-cs-"));
  try {
    const file = join(dir, "ledger.json");
    const consent = await createConsent({ intent: intent(), policy: policy(), declaredTrace: trace(), nowSeconds: NOW });

    const ledger1 = createConsumptionStore(file);
    const first = await verifyExecution(consent, trace(), { consumedSet: ledger1 });
    assert.equal(first.verdict, "VERIFIED");

    // Simulate a fresh process: reopen the same durable ledger file.
    const ledger2 = createConsumptionStore(file);
    const replay = await verifyExecution(consent, trace(), { consumedSet: ledger2 });
    assert.equal(replay.verdict, "INVALID");
    assert.ok(replay.risk.violations.some((v) => v.code === "SINGLE_USE_REUSE"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
