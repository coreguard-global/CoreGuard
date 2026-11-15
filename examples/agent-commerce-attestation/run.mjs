/**
 * Cross-Chain Execution Attestation demo (CGXA/1 · offline · synthetic · zero keys)
 *
 * The product-5 arc, end to end, on the repo's own committed machinery:
 *
 *   CONSENT      user approval bound to the EXACT approved order bytes (CGCR/1)
 *   EXECUTE      exact execution -> VERIFIED (the family's own verifier)
 *   ATTEST       one CGXA/1 record binding the consent receipt id + the
 *                executed-order commitment + the target chain's COMMITTED
 *                binding record (stellar-anchor adapter) + verification level
 *   VERIFY       the attestation re-derives offline -> VERIFIED
 *   ATTACKS (3, each fail-closed with the code named):
 *     EXECUTION_MISMATCH      the attested order drifts -> REFUSED
 *     CHAIN_BINDING_MISMATCH  a chain fact is altered     -> REFUSED
 *     CONSENT_MISMATCH        a different consent is handed in -> REFUSED
 *   DETERMINISM  the same inputs regenerate the record byte-identically
 *
 * Every order is SYNTHETIC (credential is a placeholder, never a PAN; the
 * merchant/order identifiers are simulated) and nothing is sent anywhere.
 * Exit contract: 0 ONLY on the exact arc above (VERIFIED + 3/3 REFUSED with
 * the named codes + determinism); any other outcome exits 1.
 *
 * BOUNDARY (standing): the adapter VERIFIES committed chain facts — it never
 * broadcasts (a new anchor commit or Soroban call is owner-authorized only
 * and is not code here); an attestation of one environment is never bridge
 * trust or a relay; VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never
 * decided; no contact, integration or endorsement is claimed with OpenAI,
 * American Express, Mastercard, Visa or any provider.
 */

import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  createConsent,
  verifyExecution,
  buildAttestation,
  verifyAttestation,
  CGXA_VERSION,
  CGXA_ADAPTERS,
} from "../../packages/agent-commerce/index.mjs";
import { canonicalize } from "../../packages/canonical/index.js";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The approved checkout (everything pinned — a synthetic order)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const APPROVAL_EPOCH = 1794657600; // 2026-11-14T12:00:00Z — the pinned approval epoch
const ATTEST_EPOCH = 1794657660; // +60s — the pinned attestation epoch

const ITEMS = [
  { sku: "SKU-CGXA-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-CGXA-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
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

// ─────────────────────────────────────────────────────────────────────────────
// The arc
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const artifacts = {
    spec: CGXA_VERSION,
    demo: "agent-commerce-attestation (offline · synthetic · zero keys · no broadcast surface)",
    boundary:
      "the adapter verifies committed chain facts and never broadcasts; an attestation of one environment is never bridge trust or a relay; VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never decided",
    adapters: CGXA_ADAPTERS.map((a) => ({ id: a.id, network: a.network, binding: { ...a.binding }, source: a.source, note: a.note })),
    arcs: [],
  };

  let ok = true;

  // 1) CONSENT — bind the approval to the exact approved bytes
  const consent = await createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
  const consentCheck = await verifyExecution(consent, declaredTrace);
  const consentOk = consentCheck.verdict === "VERIFIED";
  ok = ok && consentOk;
  artifacts.arcs.push({ leg: "CONSENT", outcome: consentOk ? "VERIFIED" : consentCheck.verdict });

  // 2) ATTEST — mint the CGXA/1 record against the committed Stellar adapter
  const { attestation, attestationId } = await buildAttestation({
    consent,
    executedTrace: declaredTrace,
    adapterId: "stellar-anchor",
    nowSeconds: ATTEST_EPOCH,
  });

  // 3) VERIFY — the attestation re-derives offline
  const verdict = await verifyAttestation({ attestation, attestationId, consent, executedTrace: declaredTrace });
  const attestOk = verdict.decision === "VERIFIED" && verdict.code === null;
  ok = ok && attestOk;
  artifacts.arcs.push({
    leg: "ATTEST+VERIFY",
    outcome: verdict.decision,
    code: verdict.code,
    attested: verdict.attested ?? null,
    attestationId,
    attestation,
  });

  // 4) ATTACKS — three named legs, each fail-closed
  const attacks = [];

  const driftedTrace = { ...declaredTrace, value: "9999" };
  const driftVerdict = await verifyAttestation({ attestation, consent, executedTrace: driftedTrace });
  attacks.push({ attack: "EXECUTION_MISMATCH", outcome: driftVerdict.decision, code: driftVerdict.code });

  const forgedBinding = { ...attestation, chainBinding: { ...attestation.chainBinding, anchorContract: "CCKA0000000000000000000000000000000000000000000000000000DEADBEEF" } };
  const bindingVerdict = await verifyAttestation({ attestation: forgedBinding, consent, executedTrace: declaredTrace });
  attacks.push({ attack: "CHAIN_BINDING_MISMATCH", outcome: bindingVerdict.decision, code: bindingVerdict.code });

  const otherConsent = await createConsent({
    intent: { ...intent, amount: "9900" },
    policy,
    declaredTrace,
    nowSeconds: APPROVAL_EPOCH,
  });
  const consentVerdict = await verifyAttestation({ attestation, consent: otherConsent, executedTrace: declaredTrace });
  attacks.push({ attack: "CONSENT_MISMATCH", outcome: consentVerdict.decision, code: consentVerdict.code });

  const expectedCodes = ["EXECUTION_MISMATCH", "CHAIN_BINDING_MISMATCH", "CONSENT_MISMATCH"];
  const attacksOk = attacks.every((a, i) => a.outcome === "REFUSED" && a.code === expectedCodes[i]);
  ok = ok && attacksOk;
  artifacts.attackLegs = attacks;

  // 5) DETERMINISM — same inputs regenerate the record byte-identically
  const again = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const determinismOk = again.attestationId === attestationId && canonicalize(again.attestation) === canonicalize(attestation);
  ok = ok && determinismOk;
  artifacts.determinism = {
    attestationIdStable: again.attestationId === attestationId,
    canonicalBytesStable: canonicalize(again.attestation) === canonicalize(attestation),
  };

  artifacts.ok = ok;

  const lines = [];
  lines.push(`CONSENT        ${consentOk ? "VERIFIED" : consentCheck.verdict}`);
  lines.push(`ATTEST+VERIFY  ${verdict.decision}${verdict.code ? " (" + verdict.code + ")" : ""} — ${verdict.attested ? verdict.attested.network + " · " + verdict.attested.verificationLevel : ""}`);
  for (const a of attacks) {
    lines.push(`ATTACK         ${a.attack.padEnd(24)} ${a.outcome} (${a.code})`);
  }
  lines.push(`DETERMINISM    id stable=${artifacts.determinism.attestationIdStable} bytes stable=${artifacts.determinism.canonicalBytesStable}`);
  lines.push(ok ? "RESULT: EXACT ARC — exit 0" : "RESULT: NOT THE EXACT ARC — exit 1");
  console.log(lines.join("\n"));

  await writeFile(resolve(here, "artifacts.json"), JSON.stringify(artifacts, null, 2) + "\n", "utf8");

  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(`agent-commerce-attestation demo failed: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
});
