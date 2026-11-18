/**
 * CG-ID/1 — identity split, pinned by must-fail tests.
 *
 * The claim under test is narrow and easy to get wrong: a record's NAME must
 * not be a function of its BYTES. If it is, two things quietly become
 * impossible — carrying an anchor (a place is not a property of content), and
 * seeing drift as drift (changed bytes read as a different record).
 *
 * Each test below names the failure it would catch.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  splitIdentity,
  recordIdFor,
  compareIdentities,
  anchorFacts,
  normalizeAnchor,
  selfCheck,
  ANCHOR_KINDS,
  IDENTITY_SCHEMA,
} from "../../packages/agent-commerce/identity.mjs";

const A = "a".repeat(64);
const B = "b".repeat(64);
const base = { issuer: "coreguard-global", scope: "execution-receipt", subject: "order-42" };

test("the split is three fields answering three questions", () => {
  const id = splitIdentity({ ...base, contentDigest: A });
  assert.equal(id.identityVersion, "CG-ID/1");
  assert.equal(id.schema, IDENTITY_SCHEMA);
  assert.match(id.recordId, /^[0-9a-f]{64}$/);
  assert.equal(id.contentDigest, A);
  assert.equal(id.anchorRef, null);
  assert.equal(Object.isFrozen(id), true);
});

test("must-fail: identity must not change when the content does (drift stays visible)", () => {
  const before = splitIdentity({ ...base, contentDigest: A });
  const after = splitIdentity({ ...base, contentDigest: B });
  // If recordId moved with the bytes, an edited receipt would look like a
  // different record and no consumer could report "this one changed".
  assert.equal(before.recordId, after.recordId);
  assert.notEqual(before.contentDigest, after.contentDigest);
  assert.equal(compareIdentities(before, after).drifted, true);
  assert.equal(compareIdentities(before, after).sameRecord, true);
});

test("must-fail: identity must not change when an anchor is added", () => {
  const plain = splitIdentity({ ...base, contentDigest: A });
  const anchored = splitIdentity({
    ...base,
    contentDigest: A,
    anchor: { kind: "chain", locator: "core-testnet2:4123:0xabc" },
  });
  // If anchoring renamed the record, a mirror and its original would be two
  // records and reconciliation would have nothing to reconcile.
  assert.equal(plain.recordId, anchored.recordId);
  assert.deepEqual(anchored.anchorRef, { kind: "chain", locator: "core-testnet2:4123:0xabc" });
  assert.equal(Object.isFrozen(anchored.anchorRef), true);
});

test("different subjects are different records, and the digest cannot fake sameness", () => {
  const one = splitIdentity({ ...base, subject: "order-1", contentDigest: A });
  const two = splitIdentity({ ...base, subject: "order-2", contentDigest: A });
  assert.notEqual(one.recordId, two.recordId);
  assert.equal(compareIdentities(one, two).sameRecord, false);
});

test("must-fail: a malformed digest is refused, never hashed into a name", () => {
  assert.throws(() => splitIdentity({ ...base, contentDigest: "not-a-digest" }), /32 bytes of lowercase hex/);
  assert.throws(() => splitIdentity({ ...base, contentDigest: A.toUpperCase() }), /lowercase hex/);
  assert.throws(() => splitIdentity({ ...base, contentDigest: undefined }), /non-empty string/);
  assert.throws(() => recordIdFor({ issuer: "", scope: "x", subject: "y" }), /non-empty string/);
});

test("must-fail: an unknown anchor kind is refused, not passed through", () => {
  assert.throws(() => normalizeAnchor({ kind: "carrier-pigeon", locator: "x" }), /unknown anchor kind/);
  assert.throws(() => normalizeAnchor({ kind: ANCHOR_KINDS[0], locator: "x", extra: 1 }), /unknown anchor fields/);
  assert.throws(() => normalizeAnchor({ kind: ANCHOR_KINDS[0], locator: "" }), /non-empty string/);
});

test("anchor facts: absent, not checked, unresolvable and verified are four different answers", () => {
  const plain = splitIdentity({ ...base, contentDigest: A });
  const anchored = splitIdentity({ ...base, contentDigest: A, anchor: { kind: "chain", locator: "core:1:0x1" } });
  assert.deepEqual(anchorFacts(plain), { present: false, evaluated: false, outcome: "absent" });
  assert.deepEqual(anchorFacts(anchored), { present: true, evaluated: false, outcome: "not_checked" });
  assert.equal(anchorFacts(anchored, { resolved: false }).outcome, "unresolvable");
  assert.equal(anchorFacts(anchored, { resolved: true }).outcome, "verified");
});

test("must-fail: an unresolvable anchor must never read as an absence", () => {
  // The defect this catches: "we could not reach the ledger" collapsing into
  // "there was nothing there", which is a stronger claim than the facts allow.
  const anchored = splitIdentity({ ...base, contentDigest: A, anchor: { kind: "notary", locator: "notary:99" } });
  const facts = anchorFacts(anchored, { resolved: false });
  assert.notEqual(facts.outcome, "absent");
  assert.equal(facts.present, true);
  assert.equal(facts.evaluated, true);
});

test("self-check agrees with the fixtures", () => {
  const sc = selfCheck();
  assert.equal(sc.ok, true, JSON.stringify(sc.checks.filter((c) => !c.pass)));
});
