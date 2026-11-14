/**
 * CoreGuard Agent-Commerce Approval-Binding Demo
 * (offline · zero keys · zero network · deterministic)
 *
 * The agentic-commerce moment (ChatGPT Wallet, announced by OpenAI 2026-11-13,
 * built with American Express, Mastercard and Visa) ships per-purchase human
 * approval + tokenized card credentials, and names "delegate purchases
 * entirely to their agent by setting clear parameters ... and pre-approve
 * those purchases with enhanced safeguards" as FUTURE work.
 *
 * Tokenization protects CARD DATA. It does not bind the EXECUTED order to the
 * APPROVED order bytes, and the approval record is held by the platform that
 * issued it. This demo shows the CoreGuard layer for that gap, entirely
 * offline, on the repo's own committed machinery (canonicalize / receipt /
 * verifier):
 *
 *   APPROVE  (intent + policy -> receipt)  ->  EXECUTE exact   -> VERIFIED
 *                                          ->  TOTAL DRIFT     -> INVALID, field named
 *                                          ->  MERCHANT SWAP   -> INVALID, field named
 *   TAMPER the stored approval record      ->                    INVALID (commitment mismatch)
 *
 * Every order below is SYNTHETIC: the payment credential is a placeholder
 * string ("TOKENIZED-...-REF"), the merchant/order identifiers are simulated
 * checkout identifiers, and nothing is sent anywhere. Exit code contract:
 * 0 only on the exact arc above; any other outcome exits 1.
 *
 * Dated context + the full mapping table:
 *   docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md
 */

import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { hashIntent, hashPolicy, hashTrace, computeReceiptId } from "../../packages/canonical/index.js";
import { createEvidenceBundle, createReceipt } from "../../packages/evidence/index.js";
import { verifyReceipt } from "../../packages/verifier/index.js";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The approved checkout (everything fixed and deterministic — a synthetic order)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042"; // merchant payout address (simulated)
const AGENT = "0x000000000000000000000000000000000000000d"; // the checkout submitter (simulated, declared — never detected)

const intent = {
  version: "CGEP/1",
  chainId: "0", // off-chain checkout ledger (synthetic — no chain broadcast anywhere)
  signer: AGENT, // the checkout submitter = the declared agent (simulated; a real deployment binds the user's authorization via signature — see AgentProof)
  nonce: "0",
  validAfter: "0",
  validUntil: "9999999999",
  action: "AGENT_CHECKOUT",
  target: MERCHANT,
  selector: "0xa9059cbb", // the checkout "submit order" op (simulated)
  asset: "0x0000000000000000000000000000000000000002",
  amount: "3000", // order total in minor units (USD cents)
  recipient: MERCHANT,
  constraints: [
    { type: "MAX_VALUE", value: "3000" },
    { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
  ],
  // agent-commerce context — bound by the same canonical intent hash:
  merchantName: "synthetic-goods.example",
  currency: "USD",
  items: [
    { sku: "SKU-DEMO-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
    { sku: "SKU-DEMO-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
  ],
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-0a41 (placeholder — never a PAN)",
  agentRef: "DEMO-AGENT-0001 (declared, not detected)",
  authorizedAtUtc: "2026-11-14T12:00:00Z",
  expiryUtc: "2026-11-14T12:10:00Z",
  singleUse: true,
};

const policy = {
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000cb",
  name: "Agent Checkout Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: "3000" }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
};

function executedOrder({ totalMinor, to, surchargeMinor = null }) {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "aa".repeat(32), // checkout execution id (simulated)
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: "1794657600", // 2026-11-14T12:00:00Z (fixed)
    from: AGENT,
    to,
    value: totalMinor,
    calldata: "0xa9059cbb" + to.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    // agent-commerce context — bound by the same canonical trace hash:
    merchantName: intent.merchantName,
    currency: intent.currency,
    items: intent.items,
    paymentCredentialRef: intent.paymentCredentialRef,
    orderRef: "ORDER-DEMO-0001 (simulated checkout order)",
    authorizedAtUtc: intent.authorizedAtUtc,
    singleUse: intent.singleUse,
    ...(surchargeMinor !== null ? { surchargeMinor } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt building (the repo's own createReceipt path)
// ─────────────────────────────────────────────────────────────────────────────

async function buildApprovalReceipt(intentObj, policyObj, traceObj, result, level) {
  const intentHash = await hashIntent(intentObj);
  const policyHash = await hashPolicy(policyObj);
  const traceHash = await hashTrace(traceObj);

  const evidence = await createEvidenceBundle({
    intentHash,
    policyHash,
    traceHash,
    stateDeltaHash: "0x" + "11".repeat(32),
    result,
    verifications: [{ level, engine: "coreguard-v0.1.0" }],
    simulation: { blockNumber: 65336, blockHash: "0x" + "cd".repeat(32) },
    execution: { blockNumber: traceObj.blockNumber, blockHash: traceObj.blockHash },
  });

  const { receiptId, receipt } = await createReceipt({
    chainId: "0",
    txHash: traceObj.txHash,
    blockHash: traceObj.blockHash,
    blockNumber: traceObj.blockNumber,
    intentHash,
    policyHash,
    executionTraceHash: traceHash,
    stateDeltaHash: evidence.evidence.stateDeltaHash,
    evidenceRoot: evidence.hash,
    simulation: { blockNumber: 65336, blockHash: "0x" + "cd".repeat(32) },
    execution: { blockNumber: traceObj.blockNumber, blockHash: traceObj.blockHash },
    verifierVersion: "0.1.0",
    verificationLevel: level,
    result,
    checks: [],
  });

  // Determinism rule (the C40 lesson): every input to a byte-equality claim must
  // be pinned, INCLUDING time. The shared createReceipt embeds a wall-clock
  // second; this demo pins the receipt timestamp to the fixed approval epoch and
  // recomputes the commitment over the pinned payload — the receipt binds its
  // own pinned time, and re-runs regenerate byte-identical artifacts.
  const pinned = { ...receipt, timestamp: "1794657600" }; // 2026-11-14T12:00:00Z
  const pinnedId = await computeReceiptId(pinned);
  return { ...pinned, receiptId: pinnedId };
}

function printChecks(verification) {
  for (const c of verification.checks) {
    const mark = c.result === "PASS" ? "✓" : c.result === "NOT_RUN" ? "·" : "✗";
    console.log(`  ${mark} ${c.check}${c.result === "FAIL" ? ` — ${c.detail}` : ""}`);
  }
}

// Name the drifted fields between the approved intent and the executed order —
// the human-readable face of the fail-closed verdict.
function nameDrift(approvedIntent, executed) {
  const diffs = [];
  if (String(executed.value) !== String(approvedIntent.amount)) {
    diffs.push(`total: approved ${approvedIntent.amount} -> executed ${executed.value}`);
  }
  if (String(executed.to).toLowerCase() !== String(approvedIntent.target).toLowerCase()) {
    diffs.push(`merchant: approved ${approvedIntent.target} -> executed ${executed.to}`);
  }
  if (executed.surchargeMinor !== null && executed.surchargeMinor !== undefined) {
    diffs.push(`post-approval surcharge appeared: ${executed.surchargeMinor}`);
  }
  return diffs;
}

async function main() {
  console.log("\n── STEP 1: APPROVE — the user reviews and approves the order ──");
  console.log(`Merchant: ${intent.merchantName} (${MERCHANT})`);
  console.log(`Items:    ${intent.items.map((i) => `${i.name} x${i.qty} @ ${i.unitPriceMinor}`).join(" · ")}`);
  console.log(`Total:    ${intent.amount} ${intent.currency} (minor units)`);
  console.log(`Credential: ${intent.paymentCredentialRef}`);
  console.log("The approval becomes a receipt bound to EXACT canonical bytes (intent + policy),");
  console.log("re-derivable by anyone holding the record — not only by the platform that issued it.");
  const approvalReceipt = await buildApprovalReceipt(intent, policy, executedOrder({ totalMinor: intent.amount, to: MERCHANT }), "VALID", "L2");
  console.log(`Receipt ID: ${approvalReceipt.receiptId}`);

  console.log("\n── STEP 2: EXECUTE exact — execution conforms to the approval ─");
  const exact = executedOrder({ totalMinor: intent.amount, to: MERCHANT });
  const exactVerification = await verifyReceipt(approvalReceipt, null, intent, policy, exact);
  printChecks(exactVerification);
  console.log(`Result: ${exactVerification.result}`);

  console.log("\n── STEP 3: TOTAL DRIFT — a fee appears after the approval ────");
  const drifted = executedOrder({ totalMinor: "3199", to: MERCHANT, surchargeMinor: "199" });
  console.log(`Drift: ${nameDrift(intent, drifted).join(" · ")}`);
  const driftedVerification = await verifyReceipt(approvalReceipt, null, intent, policy, drifted);
  printChecks(driftedVerification);
  console.log(`Result: ${driftedVerification.result}`);

  console.log("\n── STEP 4: MERCHANT SWAP — the payee changes after approval ──");
  const swapped = executedOrder({ totalMinor: intent.amount, to: "0x0000000000000000000000000000000000000099" });
  console.log(`Drift: ${nameDrift(intent, swapped).join(" · ")}`);
  const swappedVerification = await verifyReceipt(approvalReceipt, null, intent, policy, swapped);
  printChecks(swappedVerification);
  console.log(`Result: ${swappedVerification.result}`);

  console.log("\n── STEP 5: TAMPER — someone edits the stored approval record ─");
  const tamperedVerification = await verifyReceipt(
    { ...approvalReceipt, result: "INVALID" },
    null,
    intent,
    policy,
    exact
  );
  printChecks(tamperedVerification);
  console.log(`Result: ${tamperedVerification.result}`);

  console.log("\n── BOUNDARY ──────────────────────────────────────────────────");
  console.log("Execution verification does not decide delivery conformity.");
  console.log("(DDE/1: the payout gate opens only on party acceptance records — never on this receipt.)");

  console.log("\n── SUMMARY ───────────────────────────────────────────────────");
  console.log(`  APPROVE + EXECUTE exact -> ${exactVerification.result}`);
  console.log(`  TOTAL DRIFT (+surcharge) -> ${driftedVerification.result} (fail-closed, field named)`);
  console.log(`  MERCHANT SWAP            -> ${swappedVerification.result} (fail-closed, field named)`);
  console.log(`  RECORD TAMPER            -> ${tamperedVerification.result} (commitment mismatch)`);

  const arc =
    exactVerification.result === "VERIFIED" &&
    driftedVerification.result === "INVALID" &&
    swappedVerification.result === "INVALID" &&
    tamperedVerification.result === "INVALID";

  await writeFile(
    resolve(here, "artifacts.json"),
    JSON.stringify(
      {
        demo: "agent-commerce-approval-binding",
        synthetic: true,
        network: "offline",
        keys: "none",
        approved: { intent, policy },
        approvalReceiptId: approvalReceipt.receiptId,
        results: {
          executeExact: exactVerification.result,
          totalDrift: driftedVerification.result,
          merchantSwap: swappedVerification.result,
          recordTamper: tamperedVerification.result,
        },
        driftNamed: {
          totalDrift: nameDrift(intent, drifted),
          merchantSwap: nameDrift(intent, swapped),
        },
        exitContract: arc ? "APPROVED_VERIFIED_DRIFT_INVALID_SWAP_INVALID_TAMPER_INVALID" : "ARC_BROKEN",
      },
      null,
      2
    )
  );

  if (!arc) {
    console.error("\nARC BROKEN — the demo refuses to claim its arc (fail-closed exit).");
    process.exitCode = 1;
    return;
  }
  console.log("\nARC OK — exit 0 (exact arc only).");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
