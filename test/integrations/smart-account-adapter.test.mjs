import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_SPEC, ADAPTER_BOUNDARY, fromSmartAccountSnapshot,
} from "../../packages/agent-commerce/smart-account-adapter.mjs";
import {
  verifyStellarSmartAccountSigners, verifyStellarMultisigThresholds, verifyStellarSorobanAuthEntry,
} from "../../packages/agent-commerce/wave6.mjs";

const SOURCE_PATH = fileURLToPath(new URL("../../packages/agent-commerce/smart-account-adapter.mjs", import.meta.url));
const ARGS_DIGEST = "sha256:" + "ab".repeat(32);
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const passkeySnapshot = () => ({
  network: "testnet",
  accountId: "CACCOUNT",
  masterWeight: 0,
  thresholds: { low: 1, medium: 2, high: 3 },
  signers: [
    { key: "GBSESSION", kind: "session_key", weight: 1 },
    { key: "GAPASSKEY", kind: "passkey", weight: 2 },
  ],
  soroban: {
    entry: {
      contractId: CONTRACT, functionName: "transfer", argsDigest: ARGS_DIGEST,
      signatureExpirationLedger: "2000", rootInvocation: true, subInvocations: [],
    },
    expected: { contractId: CONTRACT, functionName: "transfer", argsDigest: ARGS_DIGEST },
    currentLedger: "1000",
    allowedContracts: [CONTRACT],
  },
});

const run = (adapter) => adapter.toolCalls.map((c) => {
  const fn = {
    coreguard_verify_stellar_smart_account_signers: verifyStellarSmartAccountSigners,
    coreguard_verify_stellar_multisig_thresholds: verifyStellarMultisigThresholds,
    coreguard_verify_stellar_soroban_auth_entry: verifyStellarSorobanAuthEntry,
  }[c.name];
  assert.ok(fn, `unknown tool ${c.name}`);
  return { name: c.name, result: fn(c.arguments) };
});

test("adapter has a stable spec id and a no-network boundary", () => {
  assert.equal(ADAPTER_SPEC, "CG-W6/1-ADAPTER");
  assert.match(ADAPTER_BOUNDARY, /no network/);
  assert.match(ADAPTER_BOUNDARY, /no signing/);
  assert.match(ADAPTER_BOUNDARY, /VERIFIED ≠ SAFE/);
});

test("a passkey/session-key snapshot emits exactly three tool calls that all pass", () => {
  const adapter = fromSmartAccountSnapshot(passkeySnapshot());
  assert.equal(adapter.ok, true, JSON.stringify(adapter.error));
  assert.deepEqual(adapter.toolCalls.map((c) => c.name), [
    "coreguard_verify_stellar_smart_account_signers",
    "coreguard_verify_stellar_multisig_thresholds",
    "coreguard_verify_stellar_soroban_auth_entry",
  ]);
  for (const { name, result } of run(adapter)) {
    assert.equal(result.status, "OK", `${name}: ${JSON.stringify(result.failed)}`);
    assert.equal(result.verdict, "PASS", `${name}: ${JSON.stringify(result.failed)}`);
  }
  assert.equal(adapter.inputs.signers.account.masterWeight, "0");
  assert.deepEqual(adapter.inputs.signers.account.signers.map((s) => s.key), ["GAPASSKEY", "GBSESSION"]);
});

test("a classic weighted multisig snapshot passes thresholds at the high level", () => {
  const snapshot = {
    network: "mainnet", accountId: "GCLASSIC", masterWeight: 1,
    thresholds: { low: "1", medium: "2", high: "2" },
    signers: [{ key: "GA", weight: 1 }, { key: "GB", weight: 1 }],
  };
  const adapter = fromSmartAccountSnapshot(snapshot);
  assert.equal(adapter.ok, true, JSON.stringify(adapter.error));
  assert.equal(adapter.toolCalls.length, 2);
  const [, thresholds] = run(adapter);
  assert.equal(thresholds.result.verdict, "PASS", JSON.stringify(thresholds.result.failed));
  assert.equal(thresholds.result.requiredWeight, "2");
  assert.equal(thresholds.result.presentWeight, "2");
});

test("an unreachable threshold fails by name, not by a generic error", () => {
  const snapshot = { ...passkeySnapshot(), presentedSigners: [{ key: "GBSESSION", weight: 1 }] };
  const adapter = fromSmartAccountSnapshot(snapshot);
  assert.equal(adapter.ok, true);
  const [, thresholds] = run(adapter);
  assert.equal(thresholds.result.verdict, "FAIL");
  assert.ok(thresholds.result.failed.includes("THRESHOLD_MET"), JSON.stringify(thresholds.result.failed));
});

test("a weight tamper is visible in the snapshot digest and fails the threshold check", () => {
  const base = fromSmartAccountSnapshot(passkeySnapshot());
  const tampered = fromSmartAccountSnapshot({
    ...passkeySnapshot(),
    presentedSigners: [{ key: "GBSESSION", weight: 1 }, { key: "GAPASSKEY", weight: 1 }],
  });
  assert.notEqual(base.snapshotDigest, tampered.snapshotDigest);
  const [, thresholds] = run(tampered);
  assert.equal(thresholds.result.verdict, "FAIL");
  assert.ok(thresholds.result.failed.includes("THRESHOLD_MET"));
});

test("a signer-kind tamper fails SIGNER_KINDS when the policy restricts kinds", () => {
  const adapter = fromSmartAccountSnapshot(passkeySnapshot());
  assert.equal(adapter.ok, true);
  const args = { ...adapter.inputs.signers, policy: { allowedKinds: ["ed25519"] } };
  const result = verifyStellarSmartAccountSigners(args);
  assert.equal(result.verdict, "WARN");
  assert.ok(result.failed.includes("SIGNER_KINDS"), JSON.stringify(result.failed));
});

test("an expiration-ledger tamper fails EXPIRATION", () => {
  const snapshot = passkeySnapshot();
  snapshot.soroban.currentLedger = "2000";
  const adapter = fromSmartAccountSnapshot(snapshot);
  assert.equal(adapter.ok, true);
  const [, , soroban] = run(adapter);
  assert.equal(soroban.result.verdict, "FAIL");
  assert.ok(soroban.result.failed.includes("EXPIRATION"), JSON.stringify(soroban.result.failed));
});

test("adapter refusals are named and never produce tool calls", () => {
  const duplicate = fromSmartAccountSnapshot({
    ...passkeySnapshot(),
    signers: [{ key: "GA", weight: 1 }, { key: "GA", weight: 1 }],
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "DUPLICATE_SIGNER");

  const wrongNetwork = fromSmartAccountSnapshot({ ...passkeySnapshot(), network: "devnet" });
  assert.equal(wrongNetwork.error.code, "UNSUPPORTED_NETWORK");

  const badOrder = fromSmartAccountSnapshot({ ...passkeySnapshot(), thresholds: { low: 3, medium: 2, high: 1 } });
  assert.equal(badOrder.error.code, "THRESHOLD_ORDER");

  const unknownPresented = fromSmartAccountSnapshot({ ...passkeySnapshot(), presentedSigners: [{ key: "GX", weight: 1 }] });
  assert.equal(unknownPresented.error.code, "UNKNOWN_PRESENTED_SIGNER");

  const noLedger = fromSmartAccountSnapshot({ ...passkeySnapshot(), soroban: { entry: {}, expected: {} } });
  assert.equal(noLedger.error.code, "CURRENT_LEDGER_MISSING");

  for (const r of [duplicate, wrongNetwork, badOrder, unknownPresented, noLedger]) {
    assert.equal(r.toolCalls, undefined);
  }
});

test("the adapter runs with fetch disabled and its source contains no network client", () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network is forbidden in this test"); };
  try {
    const adapter = fromSmartAccountSnapshot(passkeySnapshot());
    assert.equal(adapter.ok, true);
  } finally {
    globalThis.fetch = realFetch;
  }
  const source = readFileSync(SOURCE_PATH, "utf8");
  assert.doesNotMatch(source, /node:(http|https|net|dns|tls)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket/);
});
