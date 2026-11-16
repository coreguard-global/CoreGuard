/**
 * AC-FW/1 — Agent Authorization Firewall contract tests (product 1).
 *
 * The composed firewall face over the repo's existing engines: policy +
 * consent binding + the CGEP/1 verdict + the AGR/1 taxonomy. The exact arc
 * (PRE ALLOW → POST VERIFIED) holds; every attack leg here is DENIED
 * fail-closed with the named code from the frozen vocabulary; decisions are
 * byte-deterministic; the pre-execution gate never consumes a single-use
 * consent (consumption belongs to the first verified execution). Node 18-safe.
 *
 * BOUNDARY (standing): the firewall refuses — it never signs, submits or
 * broadcasts; VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never decided.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { canonicalize } from "../../packages/canonical/index.js";

import {
  authorizeRequest,
  reviewExecution,
  createFirewall,
  AC_FIREWALL_VERSION,
  FIREWALL_REJECT_CODES,
  FIREWALL_DECISIONS,
  FIREWALL_BOUNDARY,
} from "../../packages/agent-commerce/firewall.mjs";
import { createConsent } from "../../packages/agent-commerce/index.mjs";
import { tracePolicyContext } from "../../packages/agent-commerce/policy-context.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The synthetic approved checkout (pinned; identical shapes to the family's
// other contract fixtures)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const APPROVAL_EPOCH = 1794657600; // 2026-11-14T12:00:00Z — pinned, never the wall clock
const REQUEST_EPOCH = 1794657612; // +12s — pinned request epoch
const LATE_EPOCH = 1794658560; // +16m — after the window closed

const ITEMS = [
  { sku: "SKU-ACFW-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-ACFW-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
];
const TAX_MINOR = "200";
const SHIPPING_MINOR = "100";
const TOTAL_MINOR = "3300";

const intent = {
  version: "CGEP/1",
  chainId: "0",
  signer: AGENT,
  nonce: "0",
  validAfter: "0",
  validUntil: "1794658500", // window closes 2026-11-14T12:15:00Z
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
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-acfw (placeholder — never a PAN)",
  agentRef: "DEMO-AGENT-ACFW-1 (declared, not detected)",
  authorizedAtUtc: "2026-11-14T12:00:00Z",
  expiryUtc: "2026-11-14T12:15:00Z",
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
  taxMinor: TAX_MINOR,
  shippingMinor: SHIPPING_MINOR,
  paymentCredentialRef: intent.paymentCredentialRef,
  orderRef: "ORDER-ACFW-0001 (simulated checkout order)",
  authorizedAtUtc: intent.authorizedAtUtc,
  singleUse: intent.singleUse,
};

const SWAPPED_PAYEE = "0x000000000000000000000000000000000000beef";
const ESCALATED_TOTAL = "9999";

async function makeConsent() {
  return createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
}

const swappedTrace = {
  ...declaredTrace,
  to: SWAPPED_PAYEE,
  calldata: "0xa9059cbb" + SWAPPED_PAYEE.slice(2).padStart(64, "0") + BigInt(TOTAL_MINOR).toString(16).padStart(64, "0"),
};
const escalatedTrace = {
  ...declaredTrace,
  value: ESCALATED_TOTAL,
  calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + BigInt(ESCALATED_TOTAL).toString(16).padStart(64, "0"),
};

// ─────────────────────────────────────────────────────────────────────────────
// The exact arc
// ─────────────────────────────────────────────────────────────────────────────

test("the exact arc: PRE gate ALLOWs the approved request and the POST review VERIFIES the exact execution", async () => {
  const consent = await makeConsent();
  const firewall = createFirewall({});
  const pre = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(pre.spec, "AC-FW/1");
  assert.equal(pre.decision, "ALLOW");
  assert.deepEqual(pre.reasons, []);
  assert.equal(pre.consentChecked, true);
  assert.equal(pre.policy.policyResult, "SATISFIED");

  const post = await firewall.reviewExecution({ consent, trace: declaredTrace });
  assert.equal(post.spec, "AC-FW/1");
  assert.equal(post.decision, "ALLOW");
  assert.equal(post.execution.verdict, "VERIFIED");
  assert.equal(post.execution.risk.classification, "CLEAN");
});

test("mode A (no consent record): the pure policy gate still judges the declared request", async () => {
  const clean = await authorizeRequest({ intent, policy, declaredTrace });
  assert.equal(clean.decision, "ALLOW");
  assert.equal(clean.consentChecked, false);
  assert.equal(clean.policy.policyId, policy.policyId);

  const dirty = await authorizeRequest({ intent, policy, declaredTrace: escalatedTrace });
  assert.equal(dirty.decision, "DENY");
  assert.deepEqual(dirty.reasons.map((r) => r.code), ["POLICY_REFUSED"]);
  assert.equal(dirty.reasons[0].field, "policy.VALUE_001");
});

test("an empty reasons list is the ONLY path to ALLOW: every reason carries a frozen code", async () => {
  const consent = await makeConsent();
  for (const req of [
    { consent, declaredTrace, nowSeconds: REQUEST_EPOCH },
    { consent, declaredTrace: swappedTrace, nowSeconds: REQUEST_EPOCH },
    { consent, declaredTrace: escalatedTrace, nowSeconds: REQUEST_EPOCH },
  ]) {
    const d = await authorizeRequest(req);
    assert.ok(FIREWALL_DECISIONS.includes(d.decision));
    if (d.decision === "ALLOW") assert.equal(d.reasons.length, 0);
    else {
      assert.ok(d.reasons.length > 0);
      for (const r of d.reasons) assert.ok(FIREWALL_REJECT_CODES.includes(r.code), `code ${r.code} is not in the frozen vocabulary`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Attack legs — each DENIED fail-closed with the code named
// ─────────────────────────────────────────────────────────────────────────────

test("RECIPIENT_SWAP at request time: DENIED with CONSENT_MISMATCH plus the allowlist rules", async () => {
  const consent = await makeConsent();
  const d = await createFirewall({}).authorizeRequest({ consent, declaredTrace: swappedTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(d.decision, "DENY");
  assert.deepEqual(d.reasons.map((r) => r.code), ["CONSENT_MISMATCH", "POLICY_REFUSED", "POLICY_REFUSED"]);
  assert.equal(d.reasons[0].field, "declaredTrace");
});

test("VALUE_ESCALATION at request time: the post-approval surcharge is refused by the committed cap", async () => {
  const consent = await makeConsent();
  const d = await createFirewall({}).authorizeRequest({ consent, declaredTrace: escalatedTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(d.decision, "DENY");
  assert.deepEqual(d.reasons.map((r) => r.code), ["CONSENT_MISMATCH", "POLICY_REFUSED"]);
});

test("a request claiming a different intent or policy than the approved one: CONSENT_MISMATCH on the claimed field", async () => {
  const consent = await makeConsent();
  const differentIntent = await authorizeRequest({ consent, intent: { ...intent, amount: "1" }, policy, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(differentIntent.decision, "DENY");
  assert.deepEqual(differentIntent.reasons.map((r) => r.code), ["CONSENT_MISMATCH"]);
  assert.equal(differentIntent.reasons[0].field, "intent");

  const differentPolicy = await authorizeRequest({ consent, intent, policy: { ...policy, name: "Tampered name" }, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(differentPolicy.decision, "DENY");
  assert.deepEqual(differentPolicy.reasons.map((r) => r.code), ["CONSENT_MISMATCH"]);
  assert.equal(differentPolicy.reasons[0].field, "policy");
});

test("RECORD_TAMPER: any tampered consent byte is CONSENT_INVALID, never a pass", async () => {
  const consent = await makeConsent();
  const tampered = { ...consent, intent: { ...consent.intent, amount: "1" } };
  const d = await authorizeRequest({ consent: tampered, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(d.decision, "DENY");
  assert.deepEqual(d.reasons.map((r) => r.code), ["CONSENT_INVALID"]);
  assert.equal(d.reasons[0].field, "consent.receipt");

  const notARecord = await authorizeRequest({ consent: { spec: "OTHER" }, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(notARecord.decision, "DENY");
  assert.deepEqual(notARecord.reasons.map((r) => r.code), ["MALFORMED_REQUEST"]);
});

test("WINDOW_CLOSED: the request after the pinned window is refused; inside it is allowed (same bytes)", async () => {
  const consent = await makeConsent();
  const inside = await authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(inside.decision, "ALLOW");

  const late = await authorizeRequest({ consent, declaredTrace, nowSeconds: LATE_EPOCH });
  assert.equal(late.decision, "DENY");
  assert.deepEqual(late.reasons.map((r) => r.code), ["WINDOW_CLOSED"]);
  assert.equal(late.reasons[0].expected, "validUntil 1794658500");
  assert.equal(late.reasons[0].observed, String(LATE_EPOCH));
});

test("MALFORMED_REQUEST: unreadable fields are refusals, never guesses", async () => {
  const consent = await makeConsent();
  const fractional = await authorizeRequest({ consent, declaredTrace: { ...declaredTrace, value: "12.5" }, nowSeconds: REQUEST_EPOCH });
  assert.equal(fractional.decision, "DENY");
  assert.ok(fractional.reasons.some((r) => r.code === "MALFORMED_REQUEST"));

  const unreadableTime = await authorizeRequest({ consent, declaredTrace, nowSeconds: "not-a-number" });
  assert.equal(unreadableTime.decision, "DENY");
  assert.deepEqual(unreadableTime.reasons.map((r) => r.code), ["MALFORMED_REQUEST"]);
  assert.equal(unreadableTime.reasons[0].field, "nowSeconds");

  const missing = await authorizeRequest({});
  assert.equal(missing.decision, "DENY");
  assert.deepEqual(missing.reasons.map((r) => r.code), ["MALFORMED_REQUEST"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Consumption semantics — the pre-gate consults, the post-review consumes
// ─────────────────────────────────────────────────────────────────────────────

test("the PRE gate never consumes: two authorized requests in a row both ALLOW", async () => {
  const consent = await makeConsent();
  const firewall = createFirewall({});
  const first = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const second = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(first.decision, "ALLOW");
  assert.equal(second.decision, "ALLOW");
});

test("SINGLE_USE_CONSUMED: after the verified execution consumes the consent, the request-time gate refuses the replay", async () => {
  const consent = await makeConsent();
  const firewall = createFirewall({});
  const pre = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const post = await firewall.reviewExecution({ consent, trace: declaredTrace });
  assert.equal(pre.decision, "ALLOW");
  assert.equal(post.execution.verdict, "VERIFIED");
  assert.equal(post.execution.consumed, true);

  const replayPre = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(replayPre.decision, "DENY");
  assert.deepEqual(replayPre.reasons.map((r) => r.code), ["SINGLE_USE_CONSUMED"]);

  const replayPost = await firewall.reviewExecution({ consent, trace: declaredTrace });
  assert.equal(replayPost.decision, "DENY");
  assert.equal(replayPost.execution.verdict, "INVALID");
  assert.equal(replayPost.execution.risk.classification, "VIOLATIONS");
  assert.ok(replayPost.reasons.some((r) => r.code === "SINGLE_USE_REUSE"));
});

test("an injected ledger is honored and shared by both decision points", async () => {
  const consent = await makeConsent();
  const ledger = new Set([consent.receiptId]);
  const firewall = createFirewall({ consumedSet: ledger });
  const pre = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(pre.decision, "DENY");
  assert.deepEqual(pre.reasons.map((r) => r.code), ["SINGLE_USE_CONSUMED"]);
  // the injected ledger was only consulted, never mutated
  assert.equal(ledger.size, 1);
});

test("reviewExecution without its inputs is a named refusal, not a throw", async () => {
  const noTrace = await reviewExecution({ consent: await makeConsent() });
  assert.equal(noTrace.decision, "DENY");
  assert.deepEqual(noTrace.reasons.map((r) => r.code), ["MALFORMED_REQUEST"]);
  const nothing = await reviewExecution({});
  assert.equal(nothing.decision, "DENY");
  assert.deepEqual(nothing.reasons.map((r) => r.code), ["MALFORMED_REQUEST"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Determinism + frozen vocabulary + no wall clock
// ─────────────────────────────────────────────────────────────────────────────

test("decisions are byte-deterministic: same inputs regenerate the record identically", async () => {
  const consent = await makeConsent();
  const a = await authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const b = await authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  assert.equal(canonicalize(a), canonicalize(b));

  const drifted = await authorizeRequest({ consent, declaredTrace: swappedTrace, nowSeconds: REQUEST_EPOCH });
  assert.notEqual(canonicalize(drifted), canonicalize(a));
});

test("the frozen vocabularies are frozen and exact (additive-only; renaming is forbidden)", () => {
  assert.deepEqual([...FIREWALL_REJECT_CODES], [
    "MALFORMED_REQUEST",
    "POLICY_REFUSED",
    "CONSENT_MISMATCH",
    "CONSENT_INVALID",
    "WINDOW_CLOSED",
    "SINGLE_USE_CONSUMED",
  ]);
  assert.ok(Object.isFrozen(FIREWALL_REJECT_CODES));
  assert.deepEqual([...FIREWALL_DECISIONS], ["ALLOW", "DENY"]);
  assert.ok(Object.isFrozen(FIREWALL_DECISIONS));
  assert.equal(AC_FIREWALL_VERSION, "AC-FW/1");
});

test("the boundary travels inside every decision and names the ceiling", async () => {
  const consent = await makeConsent();
  for (const d of [
    await authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH }),
    await authorizeRequest({ consent, declaredTrace: swappedTrace, nowSeconds: REQUEST_EPOCH }),
    await reviewExecution({ consent, trace: declaredTrace }),
    await reviewExecution({}),
  ]) {
    assert.equal(d.boundary, FIREWALL_BOUNDARY);
  }
});

test("there is no broadcast surface: no exported name signs, submits, sends or broadcasts", async () => {
  const mod = await import("../../packages/agent-commerce/firewall.mjs");
  const names = Object.keys(mod);
  assert.ok(names.includes("authorizeRequest") && names.includes("reviewExecution") && names.includes("createFirewall"));
  for (const n of names) {
    assert.doesNotMatch(n, /broadcast|submit|send|sign/i, `exported name ${n} suggests a broadcast surface`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The shared trace→policy context (one mapping for the firewall and AGR/1)
// ─────────────────────────────────────────────────────────────────────────────

test("tracePolicyContext decodes the EVM recipient from transfer/transferFrom calldata, not trace.to", () => {
  const recipient = "0x" + "ab".repeat(20);
  const ctx = tracePolicyContext({ ...declaredTrace, calldata: "0xa9059cbb" + recipient.slice(2).padStart(64, "0") + BigInt(TOTAL_MINOR).toString(16).padStart(64, "0") });
  assert.equal(ctx.recipient, recipient);
  assert.equal(ctx.value, TOTAL_MINOR);

  const ctxFrom = tracePolicyContext({
    ...declaredTrace,
    calldata: "0x23b872dd" + "11".repeat(32) + recipient.slice(2).padStart(64, "0") + BigInt(TOTAL_MINOR).toString(16).padStart(64, "0"),
  });
  assert.equal(ctxFrom.recipient, recipient);

  const fallback = tracePolicyContext({ to: MERCHANT });
  assert.equal(fallback.recipient, MERCHANT);
  assert.equal(fallback.value, "0");
  assert.equal(fallback.target, MERCHANT);
  assert.equal(fallback.blockTimestamp, "0");
});

test("the firewall and the risk engine judge the SAME rule context (one mapping, no drift)", async () => {
  const consent = await makeConsent();
  const d = await authorizeRequest({ consent, declaredTrace: escalatedTrace, nowSeconds: REQUEST_EPOCH });
  const ruleFail = d.policy.policyRules.filter((r) => r.result === "FAIL").map((r) => r.ruleId);
  assert.deepEqual(ruleFail, ["VALUE_001"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// The committed demo + the registry alignment (product-1 mapping)
// ─────────────────────────────────────────────────────────────────────────────

test("the committed demo artifacts record the exact arc honestly (offline, synthetic)", () => {
  const artifacts = JSON.parse(readFileSync(resolve(here, "../../examples/agent-commerce-firewall/artifacts.json"), "utf8"));
  assert.equal(artifacts.spec, "AC-FW/1");
  assert.equal(artifacts.ok, true);
  assert.equal(artifacts.arcs[0].leg, "PRE_GATE");
  assert.equal(artifacts.arcs[0].outcome, "ALLOW");
  assert.equal(artifacts.arcs[1].verdict, "VERIFIED");
  assert.equal(artifacts.determinism.decisionBytesStable, true);
  for (const leg of artifacts.attackLegs) assert.equal(leg.outcome, "DENY");
  assert.ok(artifacts.boundary.includes("VERIFIED ≠ SAFE"));
});

test("the registry's product-1 entry is the composed firewall face, not the Stellar mandate gate", () => {
  const registry = JSON.parse(readFileSync(resolve(here, "../../docs/surface-status.json"), "utf8"));
  const entry = registry.surfaces.find((s) => s.id === "agent-authorization-firewall");
  assert.ok(entry, "the agent-authorization-firewall surface is registered");
  assert.equal(entry.path, "packages/agent-commerce/firewall.mjs");
  assert.equal(entry.code, "BUILT");
  assert.equal(entry.execution, "TEST_EXECUTED");
  assert.equal(entry.integration, "NOT_BUILT");
  assert.ok(entry.evidence.includes("test/integrations/agent-commerce-firewall.test.mjs"));
  assert.ok(
    entry.note.includes("does not absorb"),
    "the product-1 entry must state that the older engines are composed, not absorbed"
  );
});
