/**
 * CG-OUT/1 profile reference — a pointer a protocol can carry, and the three
 * ways it must refuse.
 *
 * The shape is deliberately three fields. `profile` names the rules;
 * `profile_version` is the only part a consumer can actually check. A pointer
 * that names a profile without a version invites a reader to guess which rules
 * produced an outcome — the same defect as a receipt that cannot say what it is
 * certified under.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  makeProfileReference,
  parseProfileReference,
  REFERENCE_FIELDS,
  PROFILE_ID,
  PROFILE_VERSION,
  selfCheck,
} from "../../packages/agent-commerce/profile-ref.mjs";
import { profileReferenceFor } from "../../packages/agent-commerce/outcomes-bridge.mjs";

const RECEIPT = "f".repeat(64);

test("the reference is exactly receipt_id, profile, profile_version", () => {
  const ref = makeProfileReference({ receiptId: RECEIPT });
  assert.deepEqual(Object.keys(ref).sort(), [...REFERENCE_FIELDS].sort());
  assert.equal(ref.profile, PROFILE_ID);
  assert.equal(ref.profile_version, PROFILE_VERSION);
  assert.equal(JSON.parse(JSON.stringify(ref)).receipt_id, RECEIPT);
});

test("must-fail: an outcome must not travel inside the pointer", () => {
  // A reference that also carried the verdict would become a second, unversioned
  // copy of the outcome — and copies disagree.
  const ref = { ...makeProfileReference({ receiptId: RECEIPT }), outcome: "VERIFIED" };
  const parsed = parseProfileReference(ref);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unknown reference fields: outcome/);
});

test("must-fail: a future profile_version is refused by name, never rounded", () => {
  const parsed = parseProfileReference({
    receipt_id: RECEIPT,
    profile: PROFILE_ID,
    profile_version: PROFILE_VERSION + 1,
  });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unsupported profile_version/);
});

test("must-fail: a reference without a version is refused", () => {
  const parsed = parseProfileReference({ receipt_id: RECEIPT, profile: PROFILE_ID });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /missing reference fields: profile_version/);
});

test("must-fail: an unknown profile is refused, and the error names what we speak", () => {
  const parsed = parseProfileReference({ receipt_id: RECEIPT, profile: "CG-OUT/9", profile_version: 1 });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unknown profile/);
  assert.match(parsed.error, /CG-OUT\/1/);
});

test("must-fail: hostile input is refused, never thrown on", () => {
  const throwing = {
    get receipt_id() {
      throw new Error("boom");
    },
    profile: PROFILE_ID,
    profile_version: 1,
  };
  for (const input of [null, undefined, 42, "ref", [], throwing]) {
    const parsed = parseProfileReference(input);
    assert.equal(parsed.ok, false, `expected refusal for ${String(input)}`);
    assert.equal(typeof parsed.error, "string");
  }
});

test("a receipt id with whitespace or the wrong type is refused at build time", () => {
  assert.throws(() => makeProfileReference({ receiptId: "a b" }), /whitespace/);
  assert.throws(() => makeProfileReference({ receiptId: "" }), /non-empty string/);
  assert.throws(() => makeProfileReference({ receiptId: 123 }), /non-empty string/);
});

test("the bridge helper and the module agree on the shape", () => {
  assert.deepEqual(profileReferenceFor(RECEIPT), makeProfileReference({ receiptId: RECEIPT }));
  assert.equal(parseProfileReference(profileReferenceFor(RECEIPT)).ok, true);
});

test("self-check agrees with the fixtures", () => {
  const sc = selfCheck();
  assert.equal(sc.ok, true, JSON.stringify(sc.checks.filter((c) => !c.pass)));
});
