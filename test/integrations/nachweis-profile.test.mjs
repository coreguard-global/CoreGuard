import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  NACHWEIS_PROFILE, NACHWEIS_SPEC, NACHWEIS_BOUNDARY,
  recordHash, intentHash, resolveNachweisExport,
} from "../../packages/agent-commerce/profiles/nachweis-v1.mjs";

const INTENT = {
  items: [{ name: "Widget", quantity: 1, unitAmount: 1299, currency: "USD" }],
  fees: { shipping: 0, tax: 0 },
  amount: 1299,
  total: 1299,
  currency: "USD",
  rail: "card",
  payee: { value: "store.example.com" },
  recipient: { identity: "store.example.com" },
};

function makeExport(overrides = {}) {
  const ih = intentHash(INTENT);
  const pay = {
    id: "pay_1", kind: "pay", prevHash: null, intent: INTENT, intentHash: ih,
    decision: "allow", reasons: ["OK"], createdAt: "2026-11-26T10:00:00.000Z",
  };
  pay.hash = recordHash(pay);
  const execution = {
    id: "ex_1", kind: "execution", prevHash: pay.hash, refId: "pay_1",
    intentHash: ih, decision: null, reasons: null, createdAt: "2026-11-26T10:00:01.000Z",
    amount: 1299, currency: "USD", rail: "card", payee: { value: "store.example.com" },
    railStatus: "succeeded", railRef: "tr_demo",
    ...overrides,
  };
  execution.hash = recordHash(execution);
  return { format: NACHWEIS_PROFILE, records: [pay, execution], execution };
}

test("profile constants and boundary are explicit", () => {
  assert.equal(NACHWEIS_PROFILE, "nachweis/v1");
  assert.equal(NACHWEIS_SPEC, "CG-PROFILE-NACHWEIS/1");
  assert.match(NACHWEIS_BOUNDARY, /no signature/);
  assert.match(NACHWEIS_BOUNDARY, /VERIFIED != SAFE/);
});

test("a well-formed export resolves by recomputed id and links to its decision", () => {
  const { records, execution } = makeExport();
  const res = resolveNachweisExport({ records }, execution.hash);
  assert.equal(res.ok, true, JSON.stringify(res.codes));
  assert.deepEqual(res.codes, []);
  assert.equal(res.checks.receiptId, "MATCH");
  assert.equal(res.checks.intent, "MATCH");
  assert.deepEqual(res.checks.drift, []);
  assert.equal(res.decision.decision, "allow");
  assert.deepEqual(res.decision.reasons, ["OK"]);
});

test("an unknown id is RECORD_NOT_FOUND, never a pass", () => {
  const { records } = makeExport();
  const res = resolveNachweisExport({ records }, "0".repeat(64));
  assert.equal(res.ok, false);
  assert.deepEqual(res.codes, ["RECORD_NOT_FOUND"]);
});

test("a malformed receipt_id is refused before any lookup", () => {
  const { records } = makeExport();
  const res = resolveNachweisExport({ records }, "3cbb6b2c");
  assert.equal(res.ok, false);
  assert.deepEqual(res.codes, ["INVALID_RECEIPT_ID"]);
});

test("editing the amount after the id was computed fails both the hash and the drift check", () => {
  const { records, execution } = makeExport();
  const tampered = { ...execution, amount: 12000 };
  const res = resolveNachweisExport({ records: [records[0], tampered] }, execution.hash);
  assert.equal(res.ok, false);
  assert.ok(res.codes.includes("HASH_MISMATCH"), JSON.stringify(res.codes));
  assert.ok(res.codes.includes("AMOUNT_DRIFT"), JSON.stringify(res.codes));
});

test("a payee swap is named, not smoothed over", () => {
  const { records, execution } = makeExport();
  const tampered = { ...execution, payee: { value: "attacker.example" } };
  tampered.hash = recordHash(tampered);
  const res = resolveNachweisExport({ records: [records[0], tampered] }, tampered.hash);
  assert.equal(res.ok, false);
  assert.deepEqual(res.codes, ["PAYEE_DRIFT"]);
});

test("a mismatched intentHash stops the field comparison instead of guessing", () => {
  const { records, execution } = makeExport({ intentHash: "sha256:" + "ab".repeat(32) });
  const res = resolveNachweisExport({ records }, execution.hash);
  assert.equal(res.ok, false);
  assert.ok(res.codes.includes("INTENT_HASH_MISMATCH"));
  assert.deepEqual(res.checks.drift, []);
});

test("a dangling refId is REF_MISSING", () => {
  const { records, execution } = makeExport({ refId: "pay_missing" });
  const res = resolveNachweisExport({ records }, execution.hash);
  assert.equal(res.ok, false);
  assert.ok(res.codes.includes("REF_MISSING"));
});

test("an id that names a non-execution record is UNEXPECTED_KIND", () => {
  const { records } = makeExport();
  const pay = records[0];
  const res = resolveNachweisExport({ records }, pay.hash);
  assert.equal(res.ok, false);
  assert.ok(res.codes.includes("UNEXPECTED_KIND"));
});

test("the resolver is pure: same input, same output, no files or network", () => {
  const { records, execution } = makeExport();
  const a = resolveNachweisExport({ records }, execution.hash);
  const b = resolveNachweisExport(JSON.parse(JSON.stringify({ records })), execution.hash);
  assert.equal(a.checks.receiptId, b.checks.receiptId);
  assert.equal(a.record.hash, b.record.hash);
});

// Pinned against the upstream public demo fixture. The file is a reduction of
// prokura-network/prokura-verify fixtures/nachweis-demo-allow.json (Apache-2.0)
// to the fields the record hash covers; values are unchanged. If this test
// fails, either the hashing layout changed or the fixture was edited.
const PINNED_DEMO = JSON.parse(
  readFileSync(new URL("../fixtures/nachweis/demo-allow-reduced.json", import.meta.url), "utf8"),
);

const PINNED_IDS = [
  "d7aa1c8e3720bae0071e505da1bdfa31e0a6582035775b96d27e2fa8d9785824",
  "5ae6174ee39ae4724a54554d8986bd4de88ccb32a1c637441ce539be9d0769b6",
  "3cbb6b2c1031230eb49f3f7169812d2cc9ffd9123ec140287739334bb4136e6b",
  "d87faf507d9b4ad80c4631b060239edd1fb3420e44fb9dcd6724b079627a1be8",
  "d57c5f03fdc4f23776b20103ea3bf6e08d3c559283ecc745a5aa20c9f002af32",
  "84fb5a48e1716316ffdfb771e696cd45279afa5e68a0dad0c619965031ca921f",
  "1898f13c068b66ed5111da30f5913f14cea37e85e5955adfbc00f293d9f23d90",
];

test("the pinned demo fixture reproduces all seven record ids", () => {
  assert.equal(PINNED_DEMO.license, "Apache-2.0");
  assert.equal(PINNED_DEMO.source, "prokura-network/prokura-verify");
  assert.equal(PINNED_DEMO.records.length, 7);
  assert.deepEqual(PINNED_DEMO.records.map((r) => recordHash(r)), PINNED_IDS);
  assert.deepEqual(PINNED_DEMO.records.map((r) => r.hash), PINNED_IDS);
});

test("the pinned demo receipt resolves to the allow decision it follows", () => {
  const res = resolveNachweisExport(PINNED_DEMO, "3cbb6b2c1031230eb49f3f7169812d2cc9ffd9123ec140287739334bb4136e6b");
  assert.equal(res.ok, true, JSON.stringify(res.codes));
  assert.deepEqual(res.codes, []);
  assert.equal(res.checks.receiptId, "MATCH");
  assert.equal(res.checks.intent, "MATCH");
  assert.deepEqual(res.checks.drift, []);
  assert.equal(res.decision.decision, "allow");
  assert.deepEqual(res.decision.reasons, ["OK"]);
});
