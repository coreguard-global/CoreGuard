import test from "node:test";
import assert from "node:assert/strict";
import {
  WAVE6_VERSION, WAVE6_BOUNDARY, WAVE6_TOOLS, WAVE6_HANDLERS, WAVE6_VALIDATORS,
  canonicalJson, digestOf, normalizeAssetCode,
  compileStellarSessionPolicy, evaluateStellarSessionKey, verifyStellarSessionKeyScope,
  verifyStellarSmartAccountSigners, verifyStellarMultisigThresholds, verifyStellarTimeBounds,
  verifyStellarMemoBinding, verifyStellarAssetAllowlist, verifyStellarTrustlinePolicy,
  verifyStellarSorobanAuthEntry, verifyStellarSacAllowance, assessStellarFeeBump,
  verifyStellarClaimableBalance, verifyStellarSponsoredReserve, verifyStellarSequenceGuard,
  verifyStellarOperationSet, verifyStellarDexPath, verifyStellarSep10Challenge,
  verifyStellarSep24AnchorEvidence, issueStellarSessionReceipt,
} from "../../packages/agent-commerce/wave6.mjs";
import { TOOL_NAMES, selfCheck } from "../../packages/agent-commerce/mcp.mjs";

const NOW = "1794657600";
const sha = (n) => "sha256:" + n.repeat(64).slice(0, 64);
const clean = (r) => r.status === "OK" && r.verdict === "PASS";
const HASH = "ab".repeat(32);

const policy = () => ({
  sessionId: "session-1",
  principal: "GPRINCIPAL",
  agent: "GAGENT",
  network: "testnet",
  allowedContracts: ["CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"],
  allowedOperations: ["invoke_host_function", "payment"],
  allowedAssets: [{ code: "native" }, { code: "USDC", issuer: "GISSUER" }],
  maxPerActionMinor: "5000000",
  dailyLimitMinor: "20000000",
  validFromSeconds: String(BigInt(NOW) - 100n),
  expiresAtSeconds: String(BigInt(NOW) + 86400n),
  requireMemo: true,
  memoPrefix: "cg-",
});

test("wave 6 has a stable spec id and boundary", () => {
  assert.equal(WAVE6_VERSION, "CG-W6/1");
  assert.match(WAVE6_BOUNDARY, /VERIFIED ≠ SAFE/);
  assert.match(WAVE6_BOUNDARY, /does not contact Stellar RPC/);
  assert.match(WAVE6_BOUNDARY, /never signs, submits or broadcasts/);
});

test("wave 6 exposes 20 complete tool definitions and registers every handler", () => {
  assert.equal(WAVE6_TOOLS.length, 20);
  for (const t of WAVE6_TOOLS) {
    assert.match(t.name, /^coreguard_/);
    assert.ok(t.description.length >= 40, `${t.name} description too short`);
    assert.ok(t.inputSchema.required.length > 0, `${t.name} needs required inputs`);
    assert.equal(t.outputSchema.type, "object");
    assert.equal(t.inputSchema.properties.callerContext.type, "object");
    assert.equal(typeof WAVE6_HANDLERS[t.name], "function");
    assert.equal(typeof WAVE6_VALIDATORS[t.name], "function");
    assert.ok(TOOL_NAMES.includes(t.name), `${t.name} is not on the MCP surface`);
  }
});

test("wave 6 tools are on the live surface and selfCheck stays green", () => {
  assert.equal(TOOL_NAMES.length, 119);
  assert.equal(TOOL_NAMES[118], "coreguard_issue_stellar_session_receipt");
  assert.ok(selfCheck().every(([, ok]) => ok === true), JSON.stringify(selfCheck()));
});

test("canonicalJson and digestOf are stable and never throw", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(digestOf({ b: 1, a: 2 }), digestOf({ a: 2, b: 1 }));
  assert.equal(canonicalJson({ n: 1n }), '{"n":"bigint:1"}');
});

test("compile_stellar_session_policy canonicalizes and digests", () => {
  const r = compileStellarSessionPolicy({ policy: policy() });
  assert.ok(clean(r), JSON.stringify(r.failed));
  assert.match(r.policyDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(r.policy.allowedOperations, ["INVOKE_HOST_FUNCTION", "PAYMENT"]);
  assert.equal(r.policy.maxPerActionMinor, "5000000");
});

test("compile_stellar_session_policy fails closed on an inverted window", () => {
  const r = compileStellarSessionPolicy({ policy: { ...policy(), validFromSeconds: NOW, expiresAtSeconds: NOW } });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.critical.includes("WINDOW"));
});

test("evaluate_stellar_session_key ALLOWs an in-policy action", () => {
  const p = compileStellarSessionPolicy({ policy: policy() }).policy;
  const r = evaluateStellarSessionKey({
    policy: p,
    action: { network: "testnet", contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", operation: "invoke_host_function", assetCode: "native", amountMinor: "1000", destination: "GDEST", memo: "cg-42", atSeconds: NOW },
    nowSeconds: NOW,
    spentTodayMinor: "0",
  });
  assert.equal(r.decision, "ALLOW");
  assert.equal(r.counterfactual, null);
  assert.ok(clean(r));
});

test("evaluate_stellar_session_key DENYs over-cap, expired and wrong-network actions with a counterfactual", () => {
  const p = compileStellarSessionPolicy({ policy: policy() }).policy;
  const base = { network: "testnet", contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", operation: "invoke_host_function", assetCode: "native", amountMinor: "9000000", destination: "GDEST", memo: "cg-42", atSeconds: NOW };
  const over = evaluateStellarSessionKey({ policy: p, action: base, nowSeconds: NOW });
  assert.equal(over.decision, "DENY");
  assert.ok(over.reasons.some((x) => x.code === "PER_ACTION_CAP_EXCEEDED"));
  assert.equal(over.counterfactual.change, "amount");
  const expired = evaluateStellarSessionKey({ policy: p, action: { ...base, amountMinor: "10", atSeconds: String(BigInt(NOW) + 90000n) }, nowSeconds: NOW });
  assert.ok(expired.reasons.some((x) => x.code === "SESSION_EXPIRED"));
  const wrongNet = evaluateStellarSessionKey({ policy: p, action: { ...base, amountMinor: "10", network: "mainnet" }, nowSeconds: NOW });
  assert.ok(wrongNet.reasons.some((x) => x.code === "WRONG_NETWORK"));
});

test("evaluate_stellar_session_key enforces the daily budget with exact integers", () => {
  const p = compileStellarSessionPolicy({ policy: policy() }).policy;
  const r = evaluateStellarSessionKey({
    policy: p,
    action: { network: "testnet", contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", operation: "invoke_host_function", assetCode: "native", amountMinor: "5000000", destination: "GDEST", memo: "cg-42", atSeconds: NOW },
    nowSeconds: NOW,
    spentTodayMinor: "16000000",
  });
  assert.equal(r.decision, "DENY");
  assert.ok(r.reasons.some((x) => x.code === "DAILY_LIMIT_EXCEEDED"));
  assert.equal(r.remainingDailyMinor, "4000000");
});

test("verify_stellar_session_key_scope names overreach on both edges", () => {
  const okScope = verifyStellarSessionKeyScope({ principalScope: ["pay", "read"], sessionScope: ["pay"], requested: ["pay"] });
  assert.ok(clean(okScope));
  const bad = verifyStellarSessionKeyScope({ principalScope: ["pay"], sessionScope: ["pay", "trade"], requested: ["trade", "admin"] });
  assert.equal(bad.verdict, "FAIL");
  assert.deepEqual(bad.sessionOverreach, ["trade"]);
  assert.deepEqual(bad.requestOverreach, ["admin"]);
});

test("verify_stellar_smart_account_signers enforces thresholds and master-weight policy", () => {
  const green = verifyStellarSmartAccountSigners({
    account: { accountId: "CACCOUNT", masterWeight: "0", thresholds: { low: "1", medium: "2", high: "3" }, signers: [{ key: "GSESSION", kind: "ed25519", weight: "3" }] },
    policy: { requireMasterDisabled: true, maxSigners: "4", allowedKinds: ["ed25519", "passkey"] },
  });
  assert.ok(clean(green), JSON.stringify(green.failed));
  const red = verifyStellarSmartAccountSigners({
    account: { accountId: "CACCOUNT", masterWeight: "1", thresholds: { low: "1", medium: "3", high: "2" }, signers: [{ key: "GSESSION", weight: "1" }, { key: "GSESSION", weight: "1" }] },
    policy: { requireMasterDisabled: true },
  });
  assert.equal(red.verdict, "FAIL");
  assert.ok(red.critical.includes("UNIQUE_KEYS"));
  assert.ok(red.critical.includes("THRESHOLDS"));
  assert.ok(red.failed.includes("MASTER_DISABLED"));
});

test("verify_stellar_multisig_thresholds compares exact weight to the declared level", () => {
  const okWeight = verifyStellarMultisigThresholds({ evidence: { presentSigners: [{ key: "A", weight: "2" }, { key: "B", weight: "2" }], thresholds: { low: "1", medium: "2", high: "3" } }, level: "HIGH" });
  assert.ok(clean(okWeight));
  assert.equal(okWeight.presentWeight, "4");
  const short = verifyStellarMultisigThresholds({ evidence: { presentSigners: [{ key: "A", weight: "1" }], thresholds: { low: "1", medium: "2", high: "3" } }, level: "HIGH" });
  assert.equal(short.verdict, "FAIL");
});

test("verify_stellar_time_bounds checks clock, order, duration and ledger window", () => {
  const okBounds = verifyStellarTimeBounds({ timeBounds: { minTime: String(BigInt(NOW) - 10n), maxTime: String(BigInt(NOW) + 600n) }, ledgerBounds: { minLedger: "100", maxLedger: "200" }, nowSeconds: NOW, currentLedger: "150", maxDurationSeconds: "3600" });
  assert.ok(clean(okBounds));
  const expired = verifyStellarTimeBounds({ timeBounds: { minTime: "0", maxTime: "1" }, nowSeconds: NOW });
  assert.equal(expired.verdict, "FAIL");
  assert.ok(expired.critical.includes("NOT_EXPIRED"));
});

test("verify_stellar_memo_binding catches value and type drift", () => {
  const okMemo = verifyStellarMemoBinding({ memo: { type: "text", value: "cg-invoice-42" }, expected: { type: "text", value: "cg-invoice-42", prefix: "cg-" } });
  assert.ok(clean(okMemo));
  const drift = verifyStellarMemoBinding({ memo: { type: "text", value: "cg-invoice-43" }, expected: { type: "hash", value: "cg-invoice-42" } });
  assert.equal(drift.verdict, "FAIL");
  assert.ok(drift.critical.includes("VALUE_MATCH"));
  assert.ok(drift.failed.includes("TYPE_MATCH"));
  const badHash = verifyStellarMemoBinding({ memo: { type: "hash", value: "nothex" }, expected: {} });
  assert.ok(badHash.failed.includes("HASH_SHAPE"));
});

test("verify_stellar_asset_allowlist detects exact matches and confusable codes", () => {
  const exact = verifyStellarAssetAllowlist({ asset: { code: "USDC", issuer: "GISSUER" }, allowlist: [{ code: "USDC", issuer: "GISSUER" }] });
  assert.ok(clean(exact));
  assert.equal(normalizeAssetCode("U5DC"), normalizeAssetCode("USDC"));
  const spoof = verifyStellarAssetAllowlist({ asset: { code: "U5DC", issuer: "GISSUER" }, allowlist: [{ code: "USDC", issuer: "GISSUER" }] });
  assert.equal(spoof.verdict, "FAIL");
  assert.deepEqual(spoof.confusableWith, ["USDC"]);
  assert.ok(spoof.critical.includes("NO_CONFUSABLE"));
});

test("verify_stellar_trustline_policy names missing, short and unauthorized lines", () => {
  const okLines = verifyStellarTrustlinePolicy({
    trustlines: [{ assetCode: "USDC", assetIssuer: "GISSUER", limit: "100.00", authorized: true }],
    plannedSpend: [{ assetCode: "USDC", amount: "40.50" }],
    policy: { requireAuthorized: true },
  });
  assert.ok(clean(okLines));
  const bad = verifyStellarTrustlinePolicy({
    trustlines: [{ assetCode: "USDC", limit: "10", authorized: false }],
    plannedSpend: [{ assetCode: "USDC", amount: "40" }, { assetCode: "EURT", amount: "5" }],
    policy: { requireAuthorized: true },
  });
  assert.equal(bad.verdict, "FAIL");
  const codes = bad.problems.map((p) => p.code).sort();
  assert.deepEqual(codes, ["LIMIT_BELOW_SPEND", "NOT_AUTHORIZED", "TRUSTLINE_MISSING"]);
});

test("verify_stellar_soroban_auth_entry binds contract, function, args and expiration", () => {
  const entry = { contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", functionName: "transfer", argsDigest: sha("a1"), signatureExpirationLedger: "200", rootInvocation: true };
  const okEntry = verifyStellarSorobanAuthEntry({ entry, expected: { contractId: entry.contractId, functionName: "transfer", argsDigest: sha("a1") }, currentLedger: "150", policy: { allowedContracts: [entry.contractId], requireRoot: true } });
  assert.ok(clean(okEntry), JSON.stringify(okEntry.failed));
  const bad = verifyStellarSorobanAuthEntry({ entry: { ...entry, functionName: "approve", argsDigest: sha("b2"), signatureExpirationLedger: "100" }, expected: { contractId: entry.contractId, functionName: "transfer", argsDigest: sha("a1") }, currentLedger: "150" });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("EXPIRATION"));
  assert.ok(bad.critical.includes("ARGS_DIGEST"));
});

test("verify_stellar_sac_allowance enforces spender allowlist, amount and expiration", () => {
  const okAllowance = verifyStellarSacAllowance({
    evidence: { contractId: "CUSDC", from: "GOWNER", spender: "GSPENDER", amount: "500", expirationLedger: "900" },
    expected: { maxAmount: "1000" },
    currentLedger: "800",
    policy: { allowedSpenders: ["GSPENDER"] },
  });
  assert.ok(clean(okAllowance));
  const bad = verifyStellarSacAllowance({
    evidence: { contractId: "CUSDC", from: "GOWNER", spender: "GEVIL", amount: "9000", expirationLedger: "700" },
    expected: { maxAmount: "1000" },
    currentLedger: "800",
    policy: { allowedSpenders: ["GSPENDER"] },
  });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("SPENDER_ALLOWED"));
  assert.ok(bad.critical.includes("AMOUNT"));
  assert.ok(bad.critical.includes("EXPIRATION"));
});

test("assess_stellar_fee_bump binds the inner hash, sponsor and fee cap", () => {
  const okBump = assessStellarFeeBump({ feeBump: { outerSource: "GSPONSOR", innerTxHash: HASH, innerSource: "GAGENT", feeChargedMinor: "1000" }, policy: { allowedFeeSponsors: ["GSPONSOR"], maxFeeMinor: "2000", expectedInnerTxHash: HASH } });
  assert.ok(clean(okBump));
  const bad = assessStellarFeeBump({ feeBump: { outerSource: "GEVIL", innerTxHash: HASH, innerSource: "GAGENT", feeChargedMinor: "9000" }, policy: { allowedFeeSponsors: ["GSPONSOR"], maxFeeMinor: "2000" } });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("SPONSOR_ALLOWED"));
  assert.ok(bad.critical.includes("FEE"));
});

test("verify_stellar_claimable_balance respects claimants, amounts and predicate windows", () => {
  const okBalance = verifyStellarClaimableBalance({
    balance: { balanceId: "BAL1", assetCode: "USDC", amount: "25.00", sponsor: "GSPONSOR", claimants: [{ destination: "GAGENT", predicate: { notBeforeAbsoluteTime: String(BigInt(NOW) - 10n), notAfterAbsoluteTime: String(BigInt(NOW) + 600n) } }] },
    expected: { destination: "GAGENT", amount: "25.00", assetCode: "USDC" },
    nowSeconds: NOW,
  });
  assert.ok(clean(okBalance));
  assert.equal(okBalance.claimable, true);
  const expired = verifyStellarClaimableBalance({
    balance: { balanceId: "BAL1", assetCode: "USDC", amount: "25.00", claimants: [{ destination: "GAGENT", predicate: { notAfterAbsoluteTime: String(BigInt(NOW) - 1n) } }] },
    expected: { destination: "GAGENT" },
    nowSeconds: NOW,
  });
  assert.equal(expired.verdict, "FAIL");
  assert.equal(expired.claimable, false);
});

test("verify_stellar_sponsored_reserve enforces sponsor allowlist and ceilings", () => {
  const okSponsor = verifyStellarSponsoredReserve({ sponsorship: { sponsor: "GSPONSOR", sponsored: "GAGENT", numEntries: "2", reserveXlm: "1.0" }, policy: { allowedSponsors: ["GSPONSOR"], maxSponsoredEntries: "4", maxReserveXlm: "2" } });
  assert.ok(clean(okSponsor));
  const bad = verifyStellarSponsoredReserve({ sponsorship: { sponsor: "GEVIL", sponsored: "GAGENT", numEntries: "9", reserveXlm: "9" }, policy: { allowedSponsors: ["GSPONSOR"], maxSponsoredEntries: "4", maxReserveXlm: "2" } });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("SPONSOR_ALLOWED"));
});

test("verify_stellar_sequence_guard blocks replay and backward sequences", () => {
  const okGuard = verifyStellarSequenceGuard({ submission: { accountId: "GACCOUNT", sequence: "105", txHash: HASH }, seen: [{ sequence: "104", txHash: "cd".repeat(32) }], policy: { maxGap: "2" } });
  assert.ok(clean(okGuard));
  const replay = verifyStellarSequenceGuard({ submission: { accountId: "GACCOUNT", sequence: "104", txHash: HASH }, seen: [{ sequence: "104", txHash: HASH }] });
  assert.equal(replay.verdict, "FAIL");
  assert.ok(replay.critical.includes("NOT_REPLAYED_SEQ"));
  assert.ok(replay.critical.includes("NOT_REPLAYED_HASH"));
});

test("verify_stellar_operation_set names every drift class positionally", () => {
  const op = { type: "payment", destination: "GDEST", asset: "USDC", amount: "10.00", memo: "cg-1" };
  const okSets = verifyStellarOperationSet({ approved: [op], executed: [op] });
  assert.ok(clean(okSets));
  const drift = verifyStellarOperationSet({ approved: [op, { ...op, destination: "GOTHER" }], executed: [{ ...op, amount: "11.00", destination: "GEVIL" }] });
  assert.equal(drift.verdict, "FAIL");
  const codes = drift.drift.map((d) => d.code);
  assert.ok(codes.includes("AMOUNT_DRIFT"));
  assert.ok(codes.includes("DESTINATION_DRIFT"));
  assert.ok(codes.includes("COUNT_DRIFT"));
});

test("verify_stellar_dex_path computes slippage in basis points", () => {
  const okPath = verifyStellarDexPath({ pathPayment: { mode: "strict_send", sendAsset: "USDC", sendAmount: "100", destAsset: "XLM", destAmount: "99", destination: "GDEST", path: ["XLM"] }, quote: { destAmount: "100" }, policy: { maxSlippageBps: 100 } });
  assert.ok(clean(okPath));
  assert.equal(okPath.slippageBps, 100);
  const bad = verifyStellarDexPath({ pathPayment: { mode: "strict_send", sendAsset: "USDC", sendAmount: "100", destAsset: "XLM", destAmount: "90", destination: "GDEST", path: ["XLM"] }, quote: { destAmount: "100" }, policy: { maxSlippageBps: 100 } });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("SLIPPAGE"));
});

test("verify_stellar_sep10_challenge checks domain, nonce, network and window", () => {
  const challenge = {
    homeDomain: "anchor.example",
    webAuthDomain: "anchor.example",
    serverSigningKey: "GSEP10",
    nonce: "nonce-123",
    networkPassphrase: "testnet",
    clientDomain: "agent.example",
    timeBounds: { minTime: String(BigInt(NOW) - 10n), maxTime: String(BigInt(NOW) + 300n) },
    operations: [{ type: "manage_data", name: "nonce-123" }],
  };
  const okChallenge = verifyStellarSep10Challenge({ challenge, expected: { homeDomain: "anchor.example", webAuthDomain: "anchor.example", serverSigningKey: "GSEP10", networkPassphrase: "testnet", clientDomain: "agent.example", nonce: "nonce-123" }, nowSeconds: NOW });
  assert.ok(clean(okChallenge), JSON.stringify(okChallenge.failed));
  const bad = verifyStellarSep10Challenge({ challenge: { ...challenge, nonce: "other", operations: [] }, expected: { nonce: "nonce-123", serverSigningKey: "GSEP10" }, nowSeconds: NOW });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("NONCE"));
});

test("verify_stellar_sep24_anchor_evidence requires a tx id on completion and honors the floor", () => {
  const evidence = { transactionId: "anchor-tx-1", kind: "deposit", status: "completed", assetCode: "USDC", amountIn: "100", amountOut: "99.5", fee: "0.5", expiresAtSeconds: String(BigInt(NOW) + 60n), stellarTransactionId: HASH };
  const okAnchor = verifyStellarSep24AnchorEvidence({ evidence, expected: { assetCode: "USDC", minAmountOut: "99" }, nowSeconds: NOW });
  assert.equal(okAnchor.status, "OK");
  assert.equal(okAnchor.anchorStatus, "COMPLETED");
  assert.ok(clean(okAnchor));
  const bad = verifyStellarSep24AnchorEvidence({ evidence: { ...evidence, amountOut: "90", fee: "-1", stellarTransactionId: "" }, expected: { minAmountOut: "99" }, nowSeconds: NOW });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("MIN_OUT"));
  assert.ok(bad.critical.includes("FINAL"));
});

test("issue_stellar_session_receipt binds policy, action and monotonic spend", () => {
  const okReceipt = issueStellarSessionReceipt({ evidence: { sessionId: "session-1", network: "testnet", policyDigest: sha("a1"), actionDigest: sha("b2"), decision: "ALLOW", spentMinorBefore: "100", spentMinorAfter: "200", atSeconds: NOW, stellarTxHash: HASH } });
  assert.ok(clean(okReceipt), JSON.stringify(okReceipt.failed));
  assert.match(okReceipt.receiptDigest, /^sha256:[0-9a-f]{64}$/);
  const bad = issueStellarSessionReceipt({ evidence: { sessionId: "session-1", network: "testnet", policyDigest: "nope", actionDigest: sha("b2"), spentMinorBefore: "200", spentMinorAfter: "100", atSeconds: NOW } });
  assert.equal(bad.verdict, "FAIL");
  assert.ok(bad.critical.includes("POLICY_DIGEST"));
  assert.ok(bad.critical.includes("SPEND_MONOTONIC"));
});

test("every wave 6 validator rejects a missing required argument without throwing", () => {
  for (const t of WAVE6_TOOLS) {
    const problem = WAVE6_VALIDATORS[t.name]({});
    assert.equal(problem?.code, "MISSING_ARGUMENT", `${t.name} should reject empty arguments`);
  }
});
