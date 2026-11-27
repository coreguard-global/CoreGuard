import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fromSmartAccountSnapshot } from "../../packages/agent-commerce/smart-account-adapter.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE = readFileSync(ROOT + "packages/agent-commerce/smart-account-adapter.mjs", "utf8");
const DOC = readFileSync(ROOT + "docs/stellar-snapshot-composition.md", "utf8");
const HASH = "sha256:" + "ab".repeat(32);
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

test("the snapshot boundary stays on the consumer side of the kit", () => {
  assert.ok(!SOURCE.includes("fetch("), "adapter must not fetch");
  assert.ok(!SOURCE.includes("simulateTransaction"), "adapter must not read ledger state");
  assert.ok(!SOURCE.includes("kit.rules.get"), "adapter must not call the kit");
  assert.ok(DOC.includes("kit.rules.get(ruleId)") && DOC.includes("kit.policyClients"));
  assert.ok(DOC.includes("policy contract addresses only"));
  assert.ok(DOC.includes("separate `simulateTransaction` calls"));
});

test("a caller-composed snapshot maps to three tool calls and a tamper-visible digest", () => {
  const snapshot = {
    network: "testnet",
    accountId: "CACCOUNT",
    masterWeight: 0,
    thresholds: { low: 1, medium: 2, high: 3 },
    signers: [
      { key: "GSESSION", kind: "session_key", weight: 1 },
      { key: "GPASSKEY", kind: "passkey", weight: 2 },
    ],
    soroban: {
      entry: {
        contractId: CONTRACT, functionName: "transfer", argsDigest: HASH,
        signatureExpirationLedger: "2000", rootInvocation: true, subInvocations: [],
      },
      expected: { contractId: CONTRACT, functionName: "transfer", argsDigest: HASH },
      currentLedger: 1990,
    },
  };
  const a = fromSmartAccountSnapshot(snapshot);
  assert.equal(a.ok, true, JSON.stringify(a.error));
  assert.equal(a.toolCalls.length, 3);
  const changed = structuredClone(snapshot);
  changed.signers[1].weight = 3;
  assert.notEqual(fromSmartAccountSnapshot(changed).snapshotDigest, a.snapshotDigest);
});
