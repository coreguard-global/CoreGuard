import test from "node:test";
import assert from "node:assert/strict";
import {
  fromSmartAccountSnapshot,
  SMART_ACCOUNT_ADAPTER_VERSION,
  SMART_ACCOUNT_REFUSAL_CODES,
  SMART_ACCOUNT_SNAPSHOT_FIELDS,
} from "../../packages/agent-commerce/smart-account-adapter.mjs";

const CONTRACT = "CBSVFSFXGMX3Z6OFT4QUQ6YZVIG6QFMFLYG5LFAS6WVHCHUDSCUHK5N2";
const KEY_A = "GAWBHAE7M3GMWR6EZXWP24XTRUZGMXVFYIHKS7EZYJ4CRJUUOUMHZ3W7";
const KEY_B = "GDWGQ6OMMEP3WMURGPIMRXSY4UVX7HVTW4ZEQRKX2HUMVP6OILIGZQ2H";
const KEY_C = "GDYPINPZBTPYRHKAEWF53Q4S2M4ONDUKEXTIHO2XAV5XZGVW2CXAHBJJ";
const DIGEST = "sha256:" + "a".repeat(64);
const clone = (value) => JSON.parse(JSON.stringify(value));

function snapshot() {
  return {
    network: "testnet",
    accountId: CONTRACT,
    masterWeight: 0,
    thresholds: { low: 1, medium: 2, high: 3 },
    signers: [
      { key: KEY_A, kind: "passkey", weight: 2 },
      { key: KEY_B, kind: "session_key", weight: 1 },
    ],
    soroban: {
      entry: {
        contractId: CONTRACT,
        functionName: "transfer",
        argsDigest: DIGEST,
        signatureExpirationLedger: 2000,
        rootInvocation: true,
      },
      expected: { contractId: CONTRACT, functionName: "transfer", argsDigest: DIGEST },
      currentLedger: 1000,
    },
  };
}

const refusal = (mapped) => mapped.refusal?.code;
const digest = (mapped) => mapped.snapshotDigest;

test("passkey/session-key snapshot maps to three named argument objects", () => {
  const input = snapshot();
  const mapped = fromSmartAccountSnapshot(input);
  assert.equal(mapped.spec, SMART_ACCOUNT_ADAPTER_VERSION);
  assert.equal(mapped.status, "MAPPED");
  assert.equal(mapped.refusal, null);
  assert.match(mapped.snapshotDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(mapped.toolCalls.map((c) => c.name), [
    "CG_SA_SIGNER_SET", "CG_SA_THRESHOLD_MET", "CG_SA_SOROBAN_ENTRY",
  ]);
  assert.deepEqual(mapped.toolCalls[0].arguments, {
    network: input.network, accountId: input.accountId, masterWeight: 0,
    thresholds: input.thresholds, signers: input.signers,
  });
  assert.deepEqual(mapped.toolCalls[1].arguments.levels.map((l) => [l.level, l.required, l.met]), [
    ["low", 1, true], ["medium", 2, true], ["high", 3, true],
  ]);
  assert.deepEqual(mapped.toolCalls[2].arguments, {
    entry: input.soroban.entry, expected: input.soroban.expected, currentLedger: 1000,
  });
  assert.deepEqual([...SMART_ACCOUNT_SNAPSHOT_FIELDS].length, 18);
  assert.equal(Object.keys(SMART_ACCOUNT_REFUSAL_CODES).length, 7);
});

test("classic weighted multisig maps and is invariant to signer order", () => {
  const input = snapshot();
  input.signers = [
    { key: KEY_C, kind: "ed25519", weight: 2 },
    { key: KEY_A, kind: "ed25519", weight: 2 },
    { key: KEY_B, kind: "ed25519", weight: 2 },
  ];
  const first = fromSmartAccountSnapshot(input);
  const reordered = clone(input);
  reordered.signers.reverse();
  const second = fromSmartAccountSnapshot(reordered);
  assert.equal(first.status, "MAPPED");
  assert.equal(second.status, "MAPPED");
  assert.equal(digest(first), digest(second));
  assert.deepEqual(first.canonicalSnapshot.signers.map((s) => s.key), [KEY_A, KEY_B, KEY_C]);
  assert.deepEqual(first.toolCalls[1].arguments.levels.map((l) => l.level), ["low", "medium", "high"]);
  assert.ok(first.toolCalls[1].arguments.levels.every((l) => l.met));
});

test("unreachable threshold refuses by name", () => {
  const input = snapshot();
  input.thresholds = { low: 1, medium: 2, high: 4 };
  const mapped = fromSmartAccountSnapshot(input);
  assert.equal(mapped.status, "REFUSED");
  assert.equal(refusal(mapped), SMART_ACCOUNT_REFUSAL_CODES.THRESHOLD_MET);
  assert.deepEqual(mapped.toolCalls, []);
});

test("tampering with weight changes the digest and refuses by name", () => {
  const original = fromSmartAccountSnapshot(snapshot());
  const input = snapshot();
  input.signers[0].weight = 1;
  const mapped = fromSmartAccountSnapshot(input);
  assert.equal(refusal(mapped), SMART_ACCOUNT_REFUSAL_CODES.THRESHOLD_MET);
  assert.notEqual(digest(mapped), digest(original));
});

test("disallowed signer kind refuses by name and changes the digest", () => {
  const original = fromSmartAccountSnapshot(snapshot());
  const input = snapshot();
  input.signers[1].kind = "admin_key";
  const mapped = fromSmartAccountSnapshot(input);
  assert.equal(refusal(mapped), SMART_ACCOUNT_REFUSAL_CODES.SIGNERS);
  assert.notEqual(digest(mapped), digest(original));
});

test("expired Soroban entry refuses by name and changes the digest", () => {
  const original = fromSmartAccountSnapshot(snapshot());
  const input = snapshot();
  input.soroban.entry.signatureExpirationLedger = 999;
  const mapped = fromSmartAccountSnapshot(input);
  assert.equal(refusal(mapped), SMART_ACCOUNT_REFUSAL_CODES.EXPIRATION);
  assert.notEqual(digest(mapped), digest(original));
  const mismatch = snapshot();
  mismatch.soroban.expected.argsDigest = "sha256:" + "b".repeat(64);
  assert.equal(refusal(fromSmartAccountSnapshot(mismatch)), SMART_ACCOUNT_REFUSAL_CODES.EXPIRATION);
});

test("duplicate keys and an enabled master key refuse by name", () => {
  const duplicate = snapshot();
  duplicate.signers[1].key = KEY_A;
  assert.equal(refusal(fromSmartAccountSnapshot(duplicate)), SMART_ACCOUNT_REFUSAL_CODES.UNIQUE_KEYS);
  const master = snapshot();
  master.masterWeight = 1;
  assert.equal(refusal(fromSmartAccountSnapshot(master)), SMART_ACCOUNT_REFUSAL_CODES.MASTER_DISABLED);
});

test("malformed account, thresholds and root invocation refuse by name", () => {
  const account = snapshot();
  account.accountId = KEY_A;
  assert.equal(refusal(fromSmartAccountSnapshot(account)), SMART_ACCOUNT_REFUSAL_CODES.ACCOUNT_ID);
  const thresholds = snapshot();
  thresholds.thresholds = { low: 3, medium: 2, high: 4 };
  assert.equal(refusal(fromSmartAccountSnapshot(thresholds)), SMART_ACCOUNT_REFUSAL_CODES.THRESHOLDS);
  const root = snapshot();
  root.soroban.entry.rootInvocation = false;
  assert.equal(refusal(fromSmartAccountSnapshot(root)), SMART_ACCOUNT_REFUSAL_CODES.EXPIRATION);
});

test("mapping a valid snapshot cannot reach a throwing fetch stub", () => {
  const hadFetch = Object.prototype.hasOwnProperty.call(globalThis, "fetch");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls += 1; throw new Error("network access attempted"); };
  try {
    const mapped = fromSmartAccountSnapshot(snapshot());
    assert.equal(mapped.status, "MAPPED");
    assert.equal(calls, 0);
  } finally {
    if (hadFetch) globalThis.fetch = originalFetch;
    else delete globalThis.fetch;
  }
});
