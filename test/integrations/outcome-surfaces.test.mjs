/**
 * CG-OUT/1 at the surfaces — the layer where people actually meet it.
 *
 * An outcome vocabulary that only exists inside a library is a vocabulary
 * nobody reads. These tests hold the three seams to the same rule: the existing
 * word stays (nobody's parser breaks), the outcome is added beside it, and a
 * record that was presented but never judged reads NOT_CHECKED rather than as a
 * failed verification.
 *
 * The load-bearing one is the AGR/1 case at the bottom: a risk engine that
 * answers CLEAN when no receipt was ever presented has decided something the
 * facts do not support.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  authorizationDecision,
  outcomeForVerificationReport,
  outcomeForPsarResult,
} from "../../packages/agent-commerce/outcomes-bridge.mjs";
import { assessRisk } from "../../packages/agent-commerce/risk.mjs";
import {
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
} from "../../packages/stellar/presign.mjs";

const issuer = createInMemoryIssuer({ seedHex: "22".repeat(32) });
const xdr = "AAAAAgAAAABkbe0AAAAAAAAAAAAAAAA=";
const policy = { asset: "XLM", maxAmount: "10", destination: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" };
const now = 1700000000;

function report(verdict, extra = {}, present = { evidence: true, intent: true, policy: true, trace: true }) {
  return {
    observed: { receiptId: "c".repeat(64), present },
    verdict: { verdict, code: extra.code ?? null, reason: extra.reason ?? null, requiredMissing: extra.requiredMissing ?? [] },
  };
}

test("verify-run: VERIFIED and INVALID keep their words and gain an outcome", () => {
  assert.equal(outcomeForVerificationReport(report("VERIFIED")).outcome, "VERIFIED");
  const invalid = outcomeForVerificationReport(report("INVALID", { code: "POLICY_MISMATCH" }));
  assert.equal(invalid.outcome, "VERIFICATION_FAILED");
  assert.equal(invalid.code, "POLICY_MISMATCH");
  assert.equal(invalid.blocks, true);
});

test("must-fail: a verdict this build does not know must never become a pass", () => {
  const r = outcomeForVerificationReport(report("PROBABLY_FINE"));
  assert.notEqual(r.outcome, "VERIFIED");
  assert.equal(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.code, "VERIFIER_ERROR");
});

test("must-fail: UNVERIFIED and INCONCLUSIVE read NOT_CHECKED, not as failures", () => {
  const unverified = outcomeForVerificationReport(report("UNVERIFIED", { requiredMissing: ["TRACE_HASH"] }));
  assert.equal(unverified.outcome, "NOT_CHECKED");
  assert.equal(unverified.blocks, false);
  assert.match(unverified.reason, /required bindings not present: TRACE_HASH/);

  const inconclusive = outcomeForVerificationReport(report("INCONCLUSIVE", { reason: "Level L3 is not claimable in v0.1" }));
  assert.equal(inconclusive.outcome, "NOT_CHECKED");
  assert.equal(inconclusive.blocks, false);
});

test("must-fail: no report at all is ABSENT, never a failed verification", () => {
  for (const empty of [null, undefined, {}, { observed: {} }]) {
    const r = outcomeForVerificationReport(empty);
    assert.equal(r.outcome, "ABSENT");
    assert.equal(r.blocks, false);
  }
});

test("PSAR/1: a passing receipt is VERIFIED and a tampered one is VERIFICATION_FAILED, decision unchanged", () => {
  const issued = issueAuthorizationReceipt({ network: "TESTNET", xdr, policy, issuer, nowSeconds: now, ttlSeconds: 600 });
  assert.equal(issued.ok, true);
  const pass = verifyAuthorizationReceipt({
    receipt: issued.receipt,
    xdr,
    network: "TESTNET",
    policy,
    nowSeconds: now + 1,
    issuerPublicKey: issuer.publicKeyHex,
  });
  assert.equal(pass.decision, "PASS");
  assert.equal(pass.outcome.outcome, "VERIFIED");

  const tampered = verifyAuthorizationReceipt({
    receipt: issued.receipt,
    xdr: xdr + " ",
    network: "TESTNET",
    policy,
    nowSeconds: now + 1,
    issuerPublicKey: issuer.publicKeyHex,
  });
  assert.equal(tampered.decision, "BLOCK");
  assert.equal(tampered.outcome.outcome, "VERIFICATION_FAILED");
  assert.equal(tampered.outcome.code, "XDR_BINDING_MISMATCH");
});

test("must-fail: a receipt claiming an unimplemented version reads NOT_CHECKED, while decision stays fail-closed", () => {
  const issued = issueAuthorizationReceipt({ network: "TESTNET", xdr, policy, issuer, nowSeconds: now, ttlSeconds: 600 });
  const future = { ...issued.receipt, v: "PSAR/2" };
  const result = verifyAuthorizationReceipt({
    receipt: future,
    xdr,
    network: "TESTNET",
    policy,
    nowSeconds: now + 1,
    issuerPublicKey: issuer.publicKeyHex,
  });
  // Two fields, two honest answers: this build refuses (BLOCK), and nobody
  // judged that receipt (NOT_CHECKED, version named).
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.outcome.outcome, "NOT_CHECKED");
  assert.equal(result.outcome.blocks, false);
  assert.equal(result.outcome.detail.version, "PSAR/2");
});

test("must-fail: an unknown decision string from a foreign result is a verifier error", () => {
  const r = outcomeForPsarResult({ decision: "MAYBE" });
  assert.equal(r.outcome, "VERIFICATION_FAILED");
  assert.equal(r.code, "VERIFIER_ERROR");
});

test("authorizationDecision: only a verified record passes, and absence decides nothing", () => {
  assert.deepEqual(authorizationDecision("VERIFIED").decision, "PASS");
  assert.equal(authorizationDecision("VERIFICATION_FAILED").decision, "BLOCK");
  assert.equal(authorizationDecision("UNRESOLVABLE_RECORD").decision, "BLOCK");
  assert.equal(authorizationDecision("ABSENT").decision, "NONE");
  assert.equal(authorizationDecision("NOT_CHECKED").decision, "NONE");
  assert.equal(authorizationDecision("SOMETHING_ELSE").decision, "BLOCK");
});

const intent = { amount: "100", validUntil: "9999999999" };
const trace = { value: "100", blockTimestamp: "100" };

test("must-fail: AGR/1 must not answer CLEAN when no receipt was presented", () => {
  const reportAbsent = assessRisk({ intent, trace, receiptOutcome: "ABSENT" });
  assert.equal(reportAbsent.classification, "NO_DECISION");
  assert.equal(reportAbsent.decision, "NONE");
  assert.deepEqual(reportAbsent.violations, []);
  assert.equal(reportAbsent.authorization.outcome, "ABSENT");

  const notChecked = assessRisk({ intent, trace, receiptOutcome: { outcome: "NOT_CHECKED" } });
  assert.equal(notChecked.classification, "NO_DECISION");
  assert.equal(notChecked.decision, "NONE");
});

test("AGR/1: a verified receipt and a failed one are distinguished, not merged", () => {
  const clean = assessRisk({ intent, trace, receiptOutcome: "VERIFIED" });
  assert.equal(clean.classification, "CLEAN");
  assert.equal(clean.decision, "PASS");

  const blocked = assessRisk({ intent, trace, receiptOutcome: "VERIFICATION_FAILED" });
  assert.equal(blocked.classification, "BLOCKED");
  assert.equal(blocked.decision, "BLOCK");
});

test("AGR/1: with no outcome supplied the engine behaves exactly as before", () => {
  const before = assessRisk({ intent, trace });
  assert.equal(before.classification, "CLEAN");
  assert.equal("decision" in before, false);
  assert.equal("authorization" in before, false);
});
