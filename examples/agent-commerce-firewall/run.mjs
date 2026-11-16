/**
 * Agent Authorization Firewall demo (AC-FW/1 · offline · synthetic · zero keys)
 *
 * Product 1 of the agent-commerce family, end to end, on the repo's own
 * committed machinery:
 *
 *   APPROVE     user approval bound to the EXACT approved order bytes (CGCR/1)
 *   PRE GATE    the exact declared request -> ALLOW (the request-time hook)
 *   EXECUTE     the exact execution        -> VERIFIED (POST review, ALLOW)
 *   ATTACKS (5, each fail-closed with the code named):
 *     CONSENT_MISMATCH       the submitted payee differs from the approved one
 *     POLICY_REFUSED         a post-approval surcharge exceeds the committed cap
 *     CONSENT_INVALID        a tampered consent record is refused
 *     WINDOW_CLOSED          the request arrives after the pinned window closed
 *     SINGLE_USE_CONSUMED    the request re-submits an already-consumed authorization
 *   DETERMINISM the same inputs regenerate the decision byte-identically
 *
 * Every order is SYNTHETIC (the credential is a placeholder, never a PAN; the
 * merchant/order identifiers are simulated) and nothing is sent anywhere.
 * Exit contract: 0 ONLY on the exact arc above (PRE ALLOW + POST VERIFIED +
 * 5/5 DENY with the named codes + determinism); any other outcome exits 1.
 *
 * BOUNDARY (standing): the firewall REFUSES — it never signs, submits or
 * broadcasts; VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never decided;
 * no contact, integration or endorsement is claimed with OpenAI, American
 * Express, Mastercard, Visa or any provider.
 */

import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { createConsent } from "../../packages/agent-commerce/index.mjs";
import {
  authorizeRequest,
  reviewExecution,
  createFirewall,
  AC_FIREWALL_VERSION,
} from "../../packages/agent-commerce/firewall.mjs";
import { canonicalize } from "../../packages/canonical/index.js";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The approved checkout (everything pinned — a synthetic order)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const APPROVAL_EPOCH = 1794657600; // 2026-11-14T12:00:00Z — the pinned approval epoch
const REQUEST_EPOCH = 1794657612; // +12s — the pinned request epoch
const LATE_EPOCH = 1794658560; // +16m — after the window closed

const ITEMS = [
  { sku: "SKU-ACFW-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-ACFW-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
];
const TAX_MINOR = "200";
const SHIPPING_MINOR = "100";
const TOTAL_MINOR = "3300"; // 3000 items + 200 tax + 100 shipping — all declared at approval time

const intent = {
  version: "CGEP/1",
  chainId: "0", // off-chain checkout ledger (synthetic — no chain broadcast anywhere)
  signer: AGENT,
  nonce: "0",
  validAfter: "0",
  validUntil: "1794658500", // the window closes 2026-11-14T12:15:00Z
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
const ESCALATED_TOTAL = "9999"; // a post-approval surcharge the user never approved

// ─────────────────────────────────────────────────────────────────────────────
// The arc
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const artifacts = {
    spec: AC_FIREWALL_VERSION,
    demo: "agent-commerce-firewall (offline · synthetic · zero keys · the firewall only refuses)",
    boundary:
      "the composed authorization firewall refuses — it never signs, submits or broadcasts; VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never decided; the actor is declared, never detected",
    arcs: [],
  };

  let ok = true;

  // 0) APPROVE — bind the approval to the exact approved bytes
  const consent = await createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });

  // One bound firewall: the SAME guard decides before and after submit, over
  // one shared consumption ledger.
  const firewall = createFirewall({});

  // 1) PRE GATE — the exact declared request is ALLOWed (nothing consumed)
  const pre = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const preOk = pre.decision === "ALLOW" && pre.reasons.length === 0 && pre.consentChecked;
  ok = ok && preOk;
  artifacts.arcs.push({ leg: "PRE_GATE", outcome: pre.decision, reasons: pre.reasons, consentChecked: pre.consentChecked });

  // 2) EXECUTE — the exact execution VERIFIES and consumes the single-use consent
  const post = await firewall.reviewExecution({ consent, trace: declaredTrace });
  const postOk = post.decision === "ALLOW" && post.execution.verdict === "VERIFIED";
  ok = ok && postOk;
  artifacts.arcs.push({
    leg: "EXECUTE+REVIEW",
    outcome: post.decision,
    verdict: post.execution.verdict,
    engineVerdict: post.execution.engineVerdict,
    riskClassification: post.execution.risk.classification,
    consumed: post.execution.consumed,
    consumedLedger: post.execution.consumedLedger,
  });

  // 3) ATTACKS — five named legs, each DENIED fail-closed by the gate.
  //    Each attack runs on its OWN fresh gate so every refusal names its own
  //    code (the replay legs alone reuse the arc's consumed guard — that is
  //    the point of the replay leg).
  const attacks = [];
  const freshGate = () => createFirewall({});

  // 3a. the submitted payee differs from the approved merchant
  const swap = await freshGate().authorizeRequest({
    consent,
    declaredTrace: { ...declaredTrace, to: SWAPPED_PAYEE, calldata: "0xa9059cbb" + SWAPPED_PAYEE.slice(2).padStart(64, "0") + BigInt(TOTAL_MINOR).toString(16).padStart(64, "0") },
    nowSeconds: REQUEST_EPOCH,
  });
  attacks.push({ attack: "RECIPIENT_SWAP (pre)", outcome: swap.decision, codes: swap.reasons.map((r) => r.code) });

  // 3b. a post-approval surcharge exceeds the committed cap
  const escalation = await freshGate().authorizeRequest({
    consent,
    declaredTrace: { ...declaredTrace, value: ESCALATED_TOTAL, calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + BigInt(ESCALATED_TOTAL).toString(16).padStart(64, "0") },
    nowSeconds: REQUEST_EPOCH,
  });
  attacks.push({ attack: "VALUE_ESCALATION (pre)", outcome: escalation.decision, codes: escalation.reasons.map((r) => r.code) });

  // 3c. a tampered consent record cannot authorize anything
  const tampered = { ...consent, intent: { ...consent.intent, amount: "1" } };
  const tamper = await freshGate().authorizeRequest({ consent: tampered, declaredTrace, nowSeconds: REQUEST_EPOCH });
  attacks.push({ attack: "RECORD_TAMPER (pre)", outcome: tamper.decision, codes: tamper.reasons.map((r) => r.code) });

  // 3d. the window closed before the request arrived (caller-pinned time only)
  const late = await freshGate().authorizeRequest({ consent, declaredTrace, nowSeconds: LATE_EPOCH });
  attacks.push({ attack: "WINDOW_CLOSED (pre)", outcome: late.decision, codes: late.reasons.map((r) => r.code) });

  // 3e. re-submitting an already-consumed authorization — the arc's own guard
  //     (which consumed it in leg 2) refuses at request time …
  const replay = await firewall.authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  attacks.push({ attack: "SINGLE_USE_REUSE (pre)", outcome: replay.decision, codes: replay.reasons.map((r) => r.code) });
  //     … and the post-execution review refuses the replayed execution too.
  const replayPost = await firewall.reviewExecution({ consent, trace: declaredTrace });
  attacks.push({
    attack: "SINGLE_USE_REUSE (post)",
    outcome: replayPost.decision,
    verdict: replayPost.execution.verdict,
    riskClassification: replayPost.execution.risk.classification,
    codes: replayPost.reasons.map((r) => r.code),
  });

  const expected = [
    { outcome: "DENY", codes: ["CONSENT_MISMATCH", "POLICY_REFUSED", "POLICY_REFUSED"] },
    { outcome: "DENY", codes: ["CONSENT_MISMATCH", "POLICY_REFUSED"] },
    { outcome: "DENY", codes: ["CONSENT_INVALID"] },
    { outcome: "DENY", codes: ["WINDOW_CLOSED"] },
    { outcome: "DENY", codes: ["SINGLE_USE_CONSUMED"] },
  ];
  const attacksOk =
    attacks.slice(0, 5).every((a, i) => a.outcome === expected[i].outcome && arraysEqual(a.codes, expected[i].codes)) &&
    replayPost.decision === "DENY" &&
    replayPost.execution.verdict === "INVALID" &&
    replayPost.execution.risk.classification === "VIOLATIONS";
  ok = ok && attacksOk;
  artifacts.attackLegs = attacks;

  // 4) DETERMINISM — the same inputs regenerate the decision byte-identically
  //    (a fresh gate per call, so consumption state cannot leak into the
  //    comparison — determinism is about inputs, not ledger state).
  const again = await freshGate().authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const baseline = await freshGate().authorizeRequest({ consent, declaredTrace, nowSeconds: REQUEST_EPOCH });
  const determinismOk = canonicalize(again) === canonicalize(baseline) && canonicalize(again) === canonicalize(pre);
  ok = ok && determinismOk;
  artifacts.determinism = { decisionBytesStable: determinismOk };

  artifacts.ok = ok;

  const lines = [];
  lines.push(`PRE GATE       ${pre.decision} (consentChecked=${pre.consentChecked}, reasons=${pre.reasons.length})`);
  lines.push(`EXECUTE+REVIEW ${post.decision} — verdict ${post.execution.verdict} · risk ${post.execution.risk.classification}`);
  for (const a of attacks) {
    lines.push(`ATTACK         ${a.attack.padEnd(26)} ${a.outcome} (${(a.codes ?? []).join(", ") || a.verdict})`);
  }
  lines.push(`DETERMINISM    decision bytes stable=${artifacts.determinism.decisionBytesStable}`);
  lines.push(ok ? "RESULT: EXACT ARC — exit 0" : "RESULT: NOT THE EXACT ARC — exit 1");
  console.log(lines.join("\n"));

  await writeFile(resolve(here, "artifacts.json"), JSON.stringify(artifacts, null, 2) + "\n", "utf8");

  process.exitCode = ok ? 0 : 1;
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

main().catch((err) => {
  console.error(`agent-commerce-firewall demo failed: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
});
