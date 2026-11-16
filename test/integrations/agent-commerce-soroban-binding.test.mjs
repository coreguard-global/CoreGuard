/**
 * CGXA-SOROBAN/1 — Soroban consent-binding integration (preparation, no broadcast).
 *
 * Carries a consent↔execution attestation into the Soroban authorized anchor lane
 * as an offline commit_authorized invocation payload. The authorized anchor id is
 * derived byte-for-byte as the contract does:
 *   sha256( utf8("coreguard-anchor-auth/1") ++ utf8(strkey(owner)) ++ hash_bytes )
 * NO broadcast, NO signing, NO network — owner-authorized only, NOT_PERFORMED.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createConsent,
  buildAttestation,
  buildSorobanConsentBinding,
  deriveSorobanAuthorizedAnchorId,
  SOROBAN_AUTH_DOMAIN,
  SOROBAN_CONSENT_BINDING_VERSION,
  CGXA_ADAPTERS,
} from "../../packages/agent-commerce/index.mjs";

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const OWNER = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const APPROVAL_EPOCH = 1794657600;
const ATTEST_EPOCH = 1794657660;

const intent = {
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
  items: [{ sku: "SKU-SB-1", name: "Synthetic item", qty: 1, unitPriceMinor: "3300" }],
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-SB (placeholder)",
  singleUse: true,
};
const policy = {
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
const declaredTrace = {
  txHash: "0x" + "bb".repeat(32),
  blockHash: "0x" + "dd".repeat(32),
  blockNumber: 65338,
  blockTimestamp: "1794657612",
  from: AGENT,
  to: MERCHANT,
  value: "3300",
  calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + BigInt("3300").toString(16).padStart(64, "0"),
  items: intent.items,
  paymentCredentialRef: intent.paymentCredentialRef,
};

test("Soroban binding constants and no-broadcast boundary", () => {
  assert.equal(SOROBAN_AUTH_DOMAIN, "coreguard-anchor-auth/1");
  assert.equal(SOROBAN_CONSENT_BINDING_VERSION, "CGXA-SOROBAN/1");
});

test("deriveSorobanAuthorizedAnchorId mirrors contract derivation byte-for-byte", () => {
  const hash = "0x" + "ab".repeat(32);
  const id = deriveSorobanAuthorizedAnchorId(OWNER, hash);
  const expected = "0x" + createHash("sha256")
    .update(Buffer.concat([
      Buffer.from(SOROBAN_AUTH_DOMAIN, "utf8"),
      Buffer.from(OWNER, "utf8"),
      Buffer.from(hash.slice(2), "hex"),
    ]))
    .digest("hex");
  assert.equal(id, expected);
  // Different owner or hash -> different id (identity is bound).
  assert.notEqual(id, deriveSorobanAuthorizedAnchorId("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", hash));
  assert.notEqual(id, deriveSorobanAuthorizedAnchorId(OWNER, "0x" + "cd".repeat(32)));
});

test("buildSorobanConsentBinding produces offline commit_authorized payload (no broadcast)", async () => {
  const consent = await createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
  const binding = await buildSorobanConsentBinding({ consent, executedTrace: declaredTrace, owner: OWNER, nowSeconds: ATTEST_EPOCH });
  assert.equal(binding.spec, SOROBAN_CONSENT_BINDING_VERSION);
  assert.equal(binding.broadcast, "OWNER-GATED / NOT_PERFORMED");
  assert.equal(binding.owner, OWNER);
  assert.equal(binding.consentReceiptId, consent.receiptId);
  assert.equal(binding.adapterId, "stellar-anchor");
  assert.equal(binding.network, "stellar-mainnet");
  assert.equal(binding.invocation.method, "commit_authorized");
  assert.equal(binding.invocation.args.owner, OWNER);
  assert.equal(binding.invocation.args.hash, binding.commitHash);
  assert.equal(binding.commitHash, binding.attestationId);
  assert.equal(binding.authorizedAnchorId, deriveSorobanAuthorizedAnchorId(OWNER, binding.commitHash));
  assert.match(binding.boundary, /NO broadcast/);
  assert.match(binding.boundary, /NOT_PERFORMED/);
  assert.match(binding.boundary, /owner-authorized only/);
  const stellar = CGXA_ADAPTERS.find((a) => a.id === "stellar-anchor");
  assert.equal(binding.chainBinding.anchorContract, stellar.binding.anchorContract);
});

test("buildSorobanConsentBinding is deterministic for the same inputs", async () => {
  const consent = await createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
  const a = await buildSorobanConsentBinding({ consent, executedTrace: declaredTrace, owner: OWNER, nowSeconds: ATTEST_EPOCH });
  const b = await buildSorobanConsentBinding({ consent, executedTrace: declaredTrace, owner: OWNER, nowSeconds: ATTEST_EPOCH });
  assert.equal(a.attestationId, b.attestationId);
  assert.equal(a.authorizedAnchorId, b.authorizedAnchorId);
  assert.equal(a.commitHash, b.commitHash);
});

test("buildSorobanConsentBinding refuses to carry an unverified attestation", async () => {
  const consent = await createConsent({ intent, policy, declaredTrace, nowSeconds: APPROVAL_EPOCH });
  const { attestation, attestationId } = await buildAttestation({ consent, executedTrace: declaredTrace, adapterId: "stellar-anchor", nowSeconds: ATTEST_EPOCH });
  const drifted = { ...declaredTrace, value: "9999" };
  await assert.rejects(
    buildSorobanConsentBinding({ consent, executedTrace: drifted, owner: OWNER, attestation, attestationId }),
    (err) => err && /EXECUTION_MISMATCH/.test(err.message)
  );
});
