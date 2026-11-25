import test from "node:test";
import assert from "node:assert/strict";
import {
  WAVE5_VERSION, WAVE5_BOUNDARY, WAVE5_TOOLS, WAVE5_HANDLERS, WAVE5_VALIDATORS,
  canonicalJson, digestOf,
  canonicalizePaymentInstruction, verifyPaymentAuthorizationChain, verifyKycEvidence,
  verifyUboEvidence, verifyTravelRulePacket, verifyAmlAlertDisposition,
  verifySanctionsListVersion, verifyFxRateLock, reconcileMultiLedger,
  verifyCamt054Notification, verifyMt103Fields, verifyBeneficiaryChange,
  verifyStellarPathPayment, verifyEvmPermitEvidence, verifyCoreDaoDelegationEvidence,
  verifyPiAttestationChain, verifyErc4337UserOpEvidence, verifyTokenApprovalRevocation,
  createMachineBudgetLease, verifyMachineBudgetConsumption, verifyRobotHandoffChain,
  verifyAgentAuthorityIntersection, createInferenceReceipt, exportEvidencePack,
} from "../../packages/agent-commerce/wave5.mjs";
import { TOOLS, TOOL_NAMES, selfCheck, createMcpHandler } from "../../packages/agent-commerce/mcp.mjs";

const NOW = "1794657600";
const sha = (n) => "sha256:" + n.repeat(64).slice(0, 64);
const clean = (r) => r.status === "OK" && r.verdict === "PASS";

test("wave 5 has a stable spec id and boundary", () => {
  assert.equal(WAVE5_VERSION, "CG-W5/1");
  assert.match(WAVE5_BOUNDARY, /VERIFIED ≠ SAFE/);
  assert.match(WAVE5_BOUNDARY, /no settlement finality/);
  assert.match(WAVE5_BOUNDARY, /does not contact SWIFT/);
});

test("canonicalJson is key-sorted and digest is stable", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(digestOf({ b: 1, a: 2 }), digestOf({ a: 2, b: 1 }));
});

test("canonicalJson never throws on BigInt or circular SDK-only values", () => {
  assert.equal(canonicalJson({ n: 1n }), '{"n":"bigint:1"}');
  const circular = { id: "x" };
  circular.self = circular;
  assert.match(canonicalJson(circular), /"self":"\[CIRCULAR\]"/);
  assert.match(digestOf(circular), /^sha256:[0-9a-f]{64}$/);
});

test("wave 5 exposes 24 complete tool definitions", () => {
  assert.equal(WAVE5_TOOLS.length, 24);
  for (const t of WAVE5_TOOLS) {
    assert.match(t.name, /^coreguard_/);
    assert.ok(t.description.length >= 40, `${t.name} description too short`);
    assert.ok(t.inputSchema.required.length > 0);
    assert.equal(t.outputSchema.type, "object");
    assert.equal(t.inputSchema.properties.callerContext.type, "object");
    assert.equal(typeof WAVE5_HANDLERS[t.name], "function");
    assert.equal(typeof WAVE5_VALIDATORS[t.name], "function");
  }
});

test("canonicalize payment instruction returns a stable digest", () => {
  const i = { instructionId: "i-1", payerId: "p", payeeId: "q", amountMinor: "1000", currency: "usd", sourceCountry: "us", destinationCountry: "gb" };
  const a = canonicalizePaymentInstruction({ instruction: i });
  const b = canonicalizePaymentInstruction({ instruction: i });
  assert.equal(clean(a), true);
  assert.equal(a.canonical.currency, "USD");
  assert.equal(a.digest, b.digest);
});

test("canonicalize payment instruction reacts to amount drift", () => {
  const base = { instructionId: "i-1", payerId: "p", payeeId: "q", amountMinor: "1000", currency: "USD" };
  const a = canonicalizePaymentInstruction({ instruction: base });
  const b = canonicalizePaymentInstruction({ instruction: { ...base, amountMinor: "1001" } });
  assert.notEqual(a.digest, b.digest);
});

test("canonicalize payment instruction fails closed without a payee", () => {
  const r = canonicalizePaymentInstruction({ instruction: { instructionId: "i", amountMinor: "1", currency: "USD" } });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.failed.includes("PAYEE"));
});

test("authorization chain verifies continuity and scope intersection", () => {
  const chain = [
    { delegator: "principal", delegate: "agent-a", scope: ["pay", "read"], expiresAtSeconds: String(BigInt(NOW) + 100n), signature: "s1" },
    { delegator: "agent-a", delegate: "agent-b", scope: ["pay"], expiresAtSeconds: String(BigInt(NOW) + 100n), signature: "s2" },
  ];
  const r = verifyPaymentAuthorizationChain({ chain, nowSeconds: NOW });
  assert.equal(clean(r), true);
  assert.equal(r.root, "principal");
  assert.equal(r.terminal, "agent-b");
  assert.deepEqual(r.scopeIntersection, ["pay"]);
});

test("authorization chain rejects a broken handoff", () => {
  const chain = [
    { delegator: "principal", delegate: "agent-a", scope: ["pay"], signature: "s1" },
    { delegator: "other", delegate: "agent-b", scope: ["pay"], signature: "s2" },
  ];
  const r = verifyPaymentAuthorizationChain({ chain, nowSeconds: NOW });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.failed.includes("CONTINUOUS"));
});

test("authorization chain rejects an expired link", () => {
  const r = verifyPaymentAuthorizationChain({ chain: [{ delegator: "p", delegate: "a", scope: ["pay"], expiresAtSeconds: "1", signature: "s" }], nowSeconds: NOW });
  assert.ok(r.failed.includes("NOT_EXPIRED"));
  assert.deepEqual(r.expiredLinks, ["a"]);
});

test("KYC evidence gate passes a fresh complete packet", () => {
  const r = verifyKycEvidence({ evidence: { subjectId: "s-1", result: "VERIFIED", checkedAtSeconds: String(BigInt(NOW) - 10n), documentDigests: [sha("a"), sha("b")], providerId: "kyc-1" }, policy: { maxAgeSeconds: "3600", requiredDocuments: [sha("a"), sha("b")], allowedProviders: ["kyc-1"] }, nowSeconds: NOW });
  assert.equal(clean(r), true);
  assert.equal(r.fresh, true);
});

test("KYC evidence gate rejects stale evidence", () => {
  const r = verifyKycEvidence({ evidence: { subjectId: "s-1", result: "VERIFIED", checkedAtSeconds: "1", documentDigests: [sha("a")], providerId: "kyc-1" }, policy: { maxAgeSeconds: "60", requiredDocuments: [sha("a")] }, nowSeconds: NOW });
  assert.ok(r.failed.includes("FRESH"));
});

test("KYC evidence names missing documents", () => {
  const r = verifyKycEvidence({ evidence: { subjectId: "s", result: "CLEAR", checkedAtSeconds: NOW, documentDigests: [] }, policy: { maxAgeSeconds: "3600", requiredDocuments: [sha("a")] }, nowSeconds: NOW });
  assert.deepEqual(r.missingDocuments, [sha("a")]);
});

test("KYC evidence boundary denies KYC approval claims", () => {
  const r = verifyKycEvidence({ evidence: { subjectId: "s", result: "CLEAR" }, policy: {}, nowSeconds: NOW });
  assert.match(r.boundary, /KYC\/AML approval/);
});

test("UBO packet computes ownership sum", () => {
  const r = verifyUboEvidence({ entity: { entityId: "e-1", owners: [{ ownerId: "o1", pct: 60 }, { ownerId: "o2", pct: 40 }] }, policy: { minDisclosurePct: 25 } });
  assert.equal(clean(r), true);
  assert.equal(r.ownershipSumPct, 100);
});

test("UBO packet rejects a percentage sum that does not reach 100", () => {
  const r = verifyUboEvidence({ entity: { entityId: "e", owners: [{ ownerId: "o1", pct: 60 }] }, policy: {} });
  assert.ok(r.failed.includes("PCT_SUM"));
});

test("travel rule packet reports missing required fields", () => {
  const r = verifyTravelRulePacket({ packet: { originatorName: "A", originatorAccount: "1", beneficiaryName: "B" }, policy: {} });
  assert.ok(r.missingFields.includes("beneficiaryAccount"));
  assert.equal(r.verdict, "FAIL");
});

test("travel rule packet enforces an allowlist", () => {
  const packet = { originatorName: "A", originatorAccount: "1", beneficiaryName: "B", beneficiaryAccount: "2", originatorVasp: "vasp-a", beneficiaryVasp: "vasp-b", amountMinor: "1000", currency: "USD" };
  assert.equal(clean(verifyTravelRulePacket({ packet, policy: { allowedVasps: ["vasp-a", "vasp-b"] } })), true);
  assert.ok(verifyTravelRulePacket({ packet, policy: { allowedVasps: ["vasp-a"] } }).failed.includes("VASPS"));
});

test("AML disposition accepts a complete reviewed alert", () => {
  const r = verifyAmlAlertDisposition({ alert: { alertId: "al-1", type: "VELOCITY", detectedAtSeconds: "100", disposition: "ESCALATED", reviewer: "ops@example", reviewedAtSeconds: "200", rationale: "Reviewed caller-supplied velocity evidence.", caseId: "case-1" } });
  assert.equal(clean(r), true);
});

test("AML disposition rejects review before detection", () => {
  const r = verifyAmlAlertDisposition({ alert: { alertId: "al", disposition: "CLEARED", reviewer: "ops", rationale: "A sufficiently long rationale.", detectedAtSeconds: "200", reviewedAtSeconds: "100", caseId: "c" } });
  assert.ok(r.failed.includes("SEQUENCE"));
});

test("sanctions list version gate compares numeric versions", () => {
  const okR = verifySanctionsListVersion({ evidence: { listName: "sdn", listVersion: "20261120", publishedAtSeconds: String(BigInt(NOW) - 10n), digest: sha("a") }, policy: { requiredListName: "sdn", minVersion: "20261101", maxAgeSeconds: "3600" }, nowSeconds: NOW });
  assert.equal(clean(okR), true);
  const old = verifySanctionsListVersion({ evidence: { listName: "sdn", listVersion: "20261001", publishedAtSeconds: NOW, digest: sha("a") }, policy: { minVersion: "20261101" }, nowSeconds: NOW });
  assert.ok(old.failed.includes("VERSION"));
});

test("sanctions list version gate denies live screening claims", () => {
  const r = verifySanctionsListVersion({ evidence: { listName: "sdn", listVersion: "20261120", digest: sha("a") }, policy: {}, nowSeconds: NOW });
  assert.match(r.boundary, /No sanctions list is downloaded or screened/);
});

test("FX rate lock rejects an expired quote", () => {
  const r = verifyFxRateLock({ lock: { lockId: "fx-1", baseCurrency: "USD", quoteCurrency: "EUR", rate: "0.92", amountMinor: "1000", quoteMinor: "920", expiresAtSeconds: "1", digest: sha("a") }, nowSeconds: NOW });
  assert.ok(r.failed.includes("NOT_EXPIRED"));
  assert.equal(r.expired, true);
});

test("FX rate lock rejects a quote mismatch", () => {
  const r = verifyFxRateLock({ lock: { lockId: "fx-1", baseCurrency: "USD", quoteCurrency: "EUR", rate: "0.92", amountMinor: "1000", quoteMinor: "920", expiresAtSeconds: String(BigInt(NOW) + 100n) }, expected: { quoteMinor: "921" }, nowSeconds: NOW });
  assert.ok(r.failed.includes("QUOTE"));
});

test("multi-ledger reconcile passes aligned sources", () => {
  const sources = [
    { sourceId: "bank", amountMinor: "1000", currency: "USD", reference: "r1", digest: sha("a") },
    { sourceId: "ledger", amountMinor: "1000", currency: "USD", reference: "r2", digest: sha("b") },
  ];
  assert.equal(clean(reconcileMultiLedger({ sources, expected: { amountMinor: "1000", currency: "USD" } })), true);
});

test("multi-ledger reconcile names breaks", () => {
  const sources = [{ sourceId: "bank", amountMinor: "900", currency: "USD", reference: "r1", digest: sha("a") }];
  const r = reconcileMultiLedger({ sources, expected: { amountMinor: "1000", currency: "USD" } });
  assert.equal(r.verdict, "FAIL");
  assert.deepEqual(r.breaks[0].reasons, ["AMOUNT"]);
});

test("camt.054 notification validates entries", () => {
  const notification = { messageId: "camt-1", accountId: "acc-1", statementId: "st-1", balanceMinor: "2000", entries: [{ amountMinor: "1000", currency: "USD", reference: "r1", creditDebit: "CRDT", bookingDate: "2026-11-25" }] };
  assert.equal(clean(verifyCamt054Notification({ notification, expected: { amountMinor: "1000" } })), true);
});

test("camt.054 notification rejects a broken entry", () => {
  const notification = { messageId: "camt-1", accountId: "acc-1", balanceMinor: "0", entries: [{ amountMinor: "x", currency: "USD" }] };
  const r = verifyCamt054Notification({ notification });
  assert.ok(r.failed.some((f) => f.startsWith("ENTRY_0")));
});

test("MT103 field map requires mandatory tags", () => {
  const r = verifyMt103Fields({ fields: { ":20:": "ref", ":23B:": "CRED" } });
  assert.ok(r.missing.includes(":32A:"));
  assert.equal(r.verdict, "FAIL");
});

test("MT103 field map parses 32A", () => {
  const r = verifyMt103Fields({ fields: { ":20:": "ref", ":23B:": "CRED", ":32A:": "261125USD1000,00", ":50K:": "Alice", ":59:": "Bob", ":70:": "invoice", uetr: "u-1" } });
  assert.equal(clean(r), true);
  assert.deepEqual(r.parsed32A, { date: "261125", currency: "USD", amount: "1000,00" });
});

test("beneficiary change detects account drift", () => {
  const r = verifyBeneficiaryChange({ approved: { beneficiaryId: "b", account: "old", bank: "bank-a" }, executed: { beneficiaryId: "b", account: "new", bank: "bank-a" } });
  assert.deepEqual(r.changedFields, ["account"]);
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.reapprovalRequired, true);
});

test("beneficiary change cannot be waived by a caller-supplied policy flag", () => {
  const r = verifyBeneficiaryChange({ approved: { beneficiaryId: "b", account: "old", bank: "bank-a" }, executed: { beneficiaryId: "b", account: "new", bank: "bank-a" }, policy: { requireReapproval: false } });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.failed.includes("ACCOUNT"));
  assert.equal(r.reapprovalGateRequested, false);
  assert.match(r.boundary, /VERIFIED ≠ SAFE/);
});

test("Stellar path payment evidence rejects a failed status", () => {
  const r = verifyStellarPathPayment({ evidence: { txHash: "tx1", status: "FAILED", sourceAsset: "USDC", destAsset: "XLM", sendAmount: "100", destAmount: "99", destination: "GDEST", pathDigest: sha("a") } });
  assert.ok(r.failed.includes("STATUS"));
});

test("Stellar path payment evidence passes a complete packet", () => {
  const r = verifyStellarPathPayment({ evidence: { txHash: "tx1", status: "SUCCESS", sourceAsset: "USDC", destAsset: "XLM", sendAmount: "100", destAmount: "99", destination: "GDEST", path: ["USDC", "XLM"] } });
  assert.equal(clean(r), true);
});

test("EVM permit evidence enforces spender allowlist", () => {
  const evidence = { token: "0x" + "11".repeat(20), owner: "0xowner", spender: "0x" + "22".repeat(20).toLowerCase(), value: "1000", nonce: "1", deadline: String(BigInt(NOW) + 100n), signature: "0xsig", chainId: 1 };
  assert.equal(clean(verifyEvmPermitEvidence({ evidence, policy: { allowedSpenders: ["0x" + "22".repeat(20).toLowerCase()] }, nowSeconds: NOW })), true);
  assert.ok(verifyEvmPermitEvidence({ evidence, policy: { allowedSpenders: ["0xdead"] }, nowSeconds: NOW }).failed.includes("SPENDER"));
});

test("Core DAO delegation evidence pins chain 1116 explicitly", () => {
  const good = verifyCoreDaoDelegationEvidence({ evidence: { chainId: 1116, delegator: "d", validator: "v", amount: "100", status: "BONDED", unbondingSeconds: "100" }, policy: { allowedValidators: ["v"], minAmount: "50", maxUnbondingSeconds: "200" } });
  assert.equal(clean(good), true);
  for (const chainId of [1, undefined]) {
    const evidence = { delegator: "d", validator: "v", amount: "100", status: "BONDED" };
    if (chainId !== undefined) evidence.chainId = chainId;
    const bad = verifyCoreDaoDelegationEvidence({ evidence, policy: {} });
    assert.ok(bad.failed.includes("CHAIN_ID"), `chainId=${chainId} must fail closed`);
  }
});

test("Pi attestation chain rejects a broken digest link", () => {
  const chain = [{ paymentId: "pi-1", attestor: "a", digest: sha("a") }, { paymentId: "pi-1", attestor: "b", previousDigest: sha("z"), digest: sha("b") }];
  const r = verifyPiAttestationChain({ chain, expected: { paymentId: "pi-1" } });
  assert.ok(r.failed.includes("LINKED"));
});

test("Pi attestation chain verifies a linked root", () => {
  const chain = [{ paymentId: "pi-1", attestor: "a", digest: sha("a") }, { paymentId: "pi-1", attestor: "b", previousDigest: sha("a"), digest: sha("b") }];
  const r = verifyPiAttestationChain({ chain, expected: { paymentId: "pi-1", rootDigest: sha("b") } });
  assert.equal(clean(r), true);
  assert.equal(r.rootDigest, sha("b"));
});

test("Pi attestation chain rejects links without digests", () => {
  const r = verifyPiAttestationChain({ chain: [{ attestor: "a" }, { attestor: "b" }] });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.failed.includes("DIGESTS"));
  assert.ok(r.failed.includes("LINKED"));
});

test("ERC-4337 user operation evidence enforces gas policy", () => {
  const userOp = { sender: "0xsender", nonce: "1", callDataDigest: sha("a"), signature: "0xsig", paymaster: "0xpm", gasLimit: "1000", maxFeePerGas: "2" };
  assert.equal(clean(verifyErc4337UserOpEvidence({ userOp, policy: { maxGasLimit: "2000" } })), true);
  assert.ok(verifyErc4337UserOpEvidence({ userOp, policy: { maxGasLimit: "500" } }).failed.includes("GAS_LIMIT"));
});

test("token approval revocation requires a zero final allowance", () => {
  const evidence = { token: "0x" + "11".repeat(20), owner: "0xowner", spender: "0xspender", allowanceBefore: "1000", allowanceAfter: "1", txHash: "0x" + "ab".repeat(32) };
  assert.ok(verifyTokenApprovalRevocation({ evidence }).failed.includes("AFTER_ZERO"));
  assert.equal(clean(verifyTokenApprovalRevocation({ evidence: { ...evidence, allowanceAfter: "0" } })), true);
});

test("machine budget lease binds scope, amount and window", () => {
  const lease = { leaseId: "lease-1", machineId: "robot-1", scope: ["deliver"], amountMinor: "1000", startAtSeconds: NOW, endAtSeconds: String(BigInt(NOW) + 100n) };
  const r = createMachineBudgetLease({ lease, policy: { allowedScopes: ["deliver", "scan"], maxAmountMinor: "2000" }, nowSeconds: NOW });
  assert.equal(clean(r), true);
  assert.ok(r.leaseDigest.startsWith("sha256:"));
});

test("machine budget lease rejects an unapproved scope", () => {
  const lease = { leaseId: "l", machineId: "m", scope: ["withdraw"], amountMinor: "1000", startAtSeconds: NOW, endAtSeconds: NOW };
  const r = createMachineBudgetLease({ lease, policy: { allowedScopes: ["deliver"] } });
  assert.ok(r.failed.includes("SCOPES"));
});

test("machine budget consumption rejects spend above the lease", () => {
  const lease = { leaseId: "l", machineId: "m", scope: ["deliver"], amountMinor: "100", startAtSeconds: NOW, endAtSeconds: String(BigInt(NOW) + 100n) };
  const events = [{ atSeconds: NOW, amountMinor: "150", scope: "deliver", reference: "e1" }];
  const r = verifyMachineBudgetConsumption({ lease, events });
  assert.ok(r.failed.includes("BUDGET"));
  assert.equal(r.spentMinor, "150");
});

test("machine budget consumption names out-of-scope events", () => {
  const lease = { leaseId: "l", machineId: "m", scope: ["deliver"], amountMinor: "1000", startAtSeconds: NOW, endAtSeconds: String(BigInt(NOW) + 100n) };
  const r = verifyMachineBudgetConsumption({ lease, events: [{ atSeconds: NOW, amountMinor: "10", scope: "withdraw", reference: "e1" }] });
  assert.deepEqual(r.breaks[0].reasons, ["SCOPE"]);
});

test("machine budget consumption rejects a replayed reference without double counting", () => {
  const lease = { leaseId: "l", machineId: "m", scope: ["deliver"], amountMinor: "1000", startAtSeconds: NOW, endAtSeconds: String(BigInt(NOW) + 100n) };
  const events = [
    { atSeconds: NOW, amountMinor: "100", scope: "deliver", reference: "e1" },
    { atSeconds: NOW, amountMinor: "100", scope: "deliver", reference: "e1" },
  ];
  const r = verifyMachineBudgetConsumption({ lease, events });
  assert.equal(r.spentMinor, "100");
  assert.deepEqual(r.breaks[0].reasons, ["DUPLICATE_REFERENCE"]);
  assert.equal(r.verdict, "FAIL");
});

test("robot handoff chain verifies continuity", () => {
  const chain = [
    { taskId: "t-1", fromRobot: "r1", toRobot: "r2", atSeconds: NOW, digest: sha("a") },
    { taskId: "t-1", fromRobot: "r2", toRobot: "r3", atSeconds: String(BigInt(NOW) + 1n), previousDigest: sha("a"), digest: sha("b") },
  ];
  const r = verifyRobotHandoffChain({ chain, expected: { taskId: "t-1" } });
  assert.equal(clean(r), true);
  assert.equal(r.handoffs, 2);
});

test("robot handoff chain rejects a task-id mix", () => {
  const chain = [{ taskId: "t-1", fromRobot: "r1", toRobot: "r2", atSeconds: NOW, digest: sha("a") }, { taskId: "t-2", fromRobot: "r2", toRobot: "r3", atSeconds: NOW, previousDigest: sha("a"), digest: sha("b") }];
  assert.ok(verifyRobotHandoffChain({ chain }).failed.includes("TASK_ID"));
});

test("robot handoff chain rejects missing task ids and digests", () => {
  const r = verifyRobotHandoffChain({ chain: [{ fromRobot: "r1", toRobot: "r2", atSeconds: NOW }, { fromRobot: "r2", toRobot: "r3", atSeconds: NOW }] });
  assert.equal(r.verdict, "FAIL");
  assert.ok(r.failed.includes("TASK_ID"));
  assert.ok(r.failed.includes("DIGESTS"));
});

test("agent authority intersection names overreach", () => {
  const r = verifyAgentAuthorityIntersection({ principalScope: ["pay", "read"], agentScope: ["pay", "trade"], requested: ["pay", "trade", "refund"] });
  assert.equal(r.verdict, "FAIL");
  assert.deepEqual(r.agentOverreach, ["trade"]);
  assert.deepEqual(r.requestOverreach, ["refund"]);
  assert.deepEqual(r.intersection, ["pay"]);
});

test("inference receipt binds prompt and output digests", () => {
  const evidence = { modelId: "model-x", promptDigest: sha("a"), outputDigest: sha("b"), policyDigest: sha("c"), costMinor: "10", latencyMs: 42 };
  const a = createInferenceReceipt({ evidence, nowSeconds: NOW });
  const b = createInferenceReceipt({ evidence: { ...evidence, outputDigest: sha("d") }, nowSeconds: NOW });
  assert.equal(clean(a), true);
  assert.notEqual(a.receiptDigest, b.receiptDigest);
});

test("inference receipt denies correctness claims", () => {
  const r = createInferenceReceipt({ evidence: { modelId: "m", promptDigest: sha("a"), outputDigest: sha("b"), policyDigest: sha("c") } });
  assert.match(r.boundary, /does not attest correctness/);
});

test("evidence pack redacts named fields", () => {
  const r = exportEvidencePack({ items: [{ id: "i1", body: { amount: "100", email: "buyer@example.test" }, digest: digestOf({ amount: "100", email: "buyer@example.test" }) }], policy: { redactFields: ["email"] }, nowSeconds: NOW });
  assert.equal(clean(r), true);
  assert.equal(r.pack.items[0].body.email, "[REDACTED]");
  assert.equal(r.pack.items[0].body.amount, "100");
});

test("evidence pack redacts nested named fields", () => {
  const body = { amount: "100", user: { email: "buyer@example.test", profile: { phone: "+100" } } };
  const r = exportEvidencePack({ items: [{ id: "i1", body, digest: digestOf(body) }], policy: { redactFields: ["email", "phone"] } });
  assert.equal(clean(r), true);
  assert.equal(r.pack.items[0].body.user.email, "[REDACTED]");
  assert.equal(r.pack.items[0].body.user.profile.phone, "[REDACTED]");
  assert.equal(r.pack.items[0].body.amount, "100");
});

test("evidence pack rejects a tampered item digest", () => {
  const r = exportEvidencePack({ items: [{ id: "i1", body: { amount: "100" }, digest: sha("a") }] });
  assert.ok(r.failed.includes("INTEGRITY"));
});

test("MCP exposes the 94-tool surface with wave 5 included", () => {
  assert.equal(TOOL_NAMES.length, 94);
  assert.equal(TOOLS.length, 94);
  for (const t of WAVE5_TOOLS) assert.ok(TOOL_NAMES.includes(t.name));
  assert.equal(TOOL_NAMES[93], "coreguard_export_evidence_pack");
});

test("selfCheck accepts the wave 5 surface", () => {
  const failed = selfCheck().filter(([, okv]) => !okv).map(([name]) => name);
  assert.deepEqual(failed, []);
});

test("every wave 5 validator rejects an empty argument object with a named code", () => {
  for (const [name, validate] of Object.entries(WAVE5_VALIDATORS)) {
    const problem = validate({});
    assert.ok(problem, `${name} accepted empty arguments`);
    assert.equal(problem.code, "MISSING_ARGUMENT", `${name} returned an unnamed error`);
  }
});

test("wave 5 validators accept minimal well-shaped arguments", () => {
  const good = {
    coreguard_canonicalize_payment_instruction: { instruction: { beneficiaryId: "b" } },
    coreguard_verify_payment_authorization_chain: { chain: [] },
    coreguard_verify_kyc_evidence: { evidence: {}, policy: {}, nowSeconds: NOW },
    coreguard_verify_ubo_evidence: { entity: {} },
    coreguard_verify_travel_rule_packet: { packet: {} },
    coreguard_verify_aml_alert_disposition: { alert: {} },
    coreguard_verify_sanctions_list_version: { evidence: {}, policy: {}, nowSeconds: NOW },
    coreguard_verify_fx_rate_lock: { lock: {}, nowSeconds: NOW },
    coreguard_reconcile_multi_ledger: { sources: [] },
    coreguard_verify_camt054_notification: { notification: {} },
    coreguard_verify_mt103_fields: { fields: {} },
    coreguard_verify_beneficiary_change: { approved: {}, executed: {} },
    coreguard_verify_stellar_path_payment: { evidence: {} },
    coreguard_verify_evm_permit_evidence: { evidence: {}, nowSeconds: NOW },
    coreguard_verify_coredao_delegation_evidence: { evidence: {} },
    coreguard_verify_pi_attestation_chain: { chain: [] },
    coreguard_verify_erc4337_userop_evidence: { userOp: {} },
    coreguard_verify_token_approval_revocation: { evidence: {} },
    coreguard_create_machine_budget_lease: { lease: {} },
    coreguard_verify_machine_budget_consumption: { lease: {}, events: [] },
    coreguard_verify_robot_handoff_chain: { chain: [] },
    coreguard_verify_agent_authority_intersection: { principalScope: [], agentScope: [] },
    coreguard_create_inference_receipt: { evidence: {} },
    coreguard_export_evidence_pack: { items: [] },
  };
  for (const [name, args] of Object.entries(good)) {
    assert.equal(WAVE5_VALIDATORS[name](args), null, `${name} rejected valid arguments`);
  }
});

test("wave 5 output schemas declare the shared result envelope", () => {
  for (const tool of WAVE5_TOOLS) {
    const props = tool.outputSchema?.properties ?? {};
    for (const field of ["type", "spec", "status", "verdict", "checks", "failed", "boundary"]) {
      assert.ok(props[field], `${tool.name} outputSchema omits ${field}`);
    }
  }
});

test("wave 5 functions never throw on null arguments", () => {
  for (const handler of Object.values(WAVE5_HANDLERS)) {
    const r = handler(null);
    assert.equal(r.status, "REFUSED");
    assert.match(r.boundary, /VERIFIED ≠ SAFE/);
  }
});

test("MCP tools/call executes a wave 5 validator and handler end to end", async () => {
  const written = [];
  const handle = createMcpHandler({ write: (obj) => written.push(obj) });
  const valid = await handle(JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "coreguard_canonicalize_payment_instruction", arguments: { instruction: { instructionId: "i-1", payerId: "p", payeeId: "b", amountMinor: "100", currency: "USD" }, callerContext: { note: "echo only" } } },
  }));
  assert.equal(written[0].id, 1);
  assert.equal(valid.result.isError, undefined);
  assert.equal(valid.result.structuredContent.status, "OK");
  assert.equal(valid.result.structuredContent.verdict, "PASS");
  assert.deepEqual(valid.result.structuredContent.callerContext, { note: "echo only" });
  assert.equal(written.length, 1);

  const invalid = await handle(JSON.stringify({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "coreguard_canonicalize_payment_instruction", arguments: {} },
  }));
  assert.equal(written[1].id, 2);
  assert.equal(invalid.result.isError, true);
  assert.equal(invalid.result.structuredContent.error.code, "MISSING_ARGUMENT");
});
