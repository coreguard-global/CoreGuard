/**
 * L1 identity binding — the must-fail vectors for a borrowed receipt label.
 *
 * The defect these close, reported against the SEP draft on issue #56: a
 * verdict function that re-derives a receipt's evidence but never checks that
 * the receipt IS the receipt it claims to be will report VERIFIED for a
 * genuine txHash/blockHash pair that has been relabeled with another receipt's
 * identity. The evidence is real, the label is borrowed, and a pass is
 * laundered onto the wrong artifact.
 *
 * Every case below is written so that the failure is NAMED and so that a
 * regression to VERIFIED is a hard failure, not a warning. The control case
 * fails if the positive path ever stops verifying.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { commit, verifyReceipt } from "../../scripts/ladder/verification-levels.mjs";

const RULES = [{ id: "VALUE_001" }];
const TX = "0x" + "ab".repeat(32);
const BLOCK = "0x" + "cd".repeat(32);
const OTHER_BLOCK = "0x" + "ff".repeat(32);

const chainOk = { getReceipt: (tx) => (tx === TX ? { txHash: TX, blockHash: BLOCK } : null) };

const alice = commit({ subject: "alice", chainId: "1116", policy: RULES });
const mallory = commit({ subject: "mallory", chainId: "1116", policy: RULES });

// A receipt that is byte-for-byte the one Alice's evidence describes.
const aliceReceipt = {
  status: "VERIFIED",
  blockHash: BLOCK,
  txHash: TX,
  chainId: "1116",
  commitmentId: alice.commitmentId,
};

test("control: bound identity + confirmed chain evidence is VERIFIED", () => {
  const v = verifyReceipt(aliceReceipt, alice, chainOk);
  assert.equal(v.verdict, "VERIFIED");
  assert.equal(v.verdictCode, "RECEIPT_INTEGRITY");
});

test("must-fail: the id-binding swap — genuine evidence, relabeled with another receipt's identity", () => {
  // Alice's receipt, presented as Mallory's. Every other check passes: the tx
  // exists, the block matches, the fields are consistent.
  const swapped = { ...aliceReceipt, commitmentId: mallory.commitmentId };
  const v = verifyReceipt(swapped, alice, chainOk);
  assert.equal(v.verdict, "MISMATCH", "a borrowed label must never verify");
  assert.equal(v.verdictCode, "RECEIPT_ID_MISMATCH");
  assert.match(v.reason, /may be genuine and belong to a different receipt/);
});

test("must-fail: relabeling is detected in both directions (no symmetric hole)", () => {
  const swapped = { ...aliceReceipt, commitmentId: alice.commitmentId };
  const v = verifyReceipt(swapped, mallory, chainOk);
  assert.equal(v.verdict, "MISMATCH");
  assert.equal(v.verdictCode, "RECEIPT_ID_MISMATCH");
});

test("must-fail: absent identity is UNKNOWN/RECEIPT_ID_UNBOUND — never a pass", () => {
  const anonymous = { status: "VERIFIED", blockHash: BLOCK, txHash: TX, chainId: "1116" };
  const v = verifyReceipt(anonymous, alice, chainOk);
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, "RECEIPT_ID_UNBOUND");
  // The distinction the draft needs: this is an absence of evidence about the
  // label, so it must not be reported as a detected contradiction.
  assert.notEqual(v.verdict, "MISMATCH");
});

test("must-fail: a receipt that names an identity but no commitment was presented is UNBOUND", () => {
  const v = verifyReceipt(aliceReceipt, { chainId: "1116" }, chainOk);
  assert.equal(v.verdict, "UNKNOWN");
  assert.equal(v.verdictCode, "RECEIPT_ID_UNBOUND");
});

test("precedence is documented, not accidental: an unknown tx is reported before an unbound label", () => {
  const anonymousUnknownTx = { status: "VERIFIED", blockHash: BLOCK, txHash: "0x" + "ee".repeat(32), chainId: "1116" };
  const v = verifyReceipt(anonymousUnknownTx, alice, chainOk);
  assert.equal(v.verdict, "MISMATCH");
  assert.equal(v.verdictCode, "TX_NOT_FOUND", "the authority was asked and did not know the hash");
});

test("VERIFIED is unreachable without a bound identity, by construction", () => {
  // Exhaustive over the identity axis: only the exact match may pass.
  const identities = [undefined, null, "", alice.commitmentId, mallory.commitmentId, "0xnot-an-id"];
  const commitments = [alice, mallory, { chainId: "1116" }, { chainId: "1116", commitmentId: alice.commitmentId }];
  for (const id of identities) {
    for (const c of commitments) {
      const receipt = { ...aliceReceipt };
      if (id === undefined) delete receipt.commitmentId;
      else receipt.commitmentId = id;
      const v = verifyReceipt(receipt, c, chainOk);
      const bound = id === c.commitmentId && typeof id === "string" && id.length > 0;
      if (bound) assert.equal(v.verdict, "VERIFIED", `bound identity ${id} must verify`);
      else assert.notEqual(v.verdict, "VERIFIED", `identity ${JSON.stringify(id)} must not verify`);
    }
  }
});

test("the borrowed-label verdict is distinguishable from every other MISMATCH", () => {
  const swapped = verifyReceipt({ ...aliceReceipt, commitmentId: mallory.commitmentId }, alice, chainOk);
  const unknownTx = verifyReceipt({ ...aliceReceipt, txHash: "0x" + "ee".repeat(32) }, alice, chainOk);
  const wrongBlock = verifyReceipt({ ...aliceReceipt, blockHash: OTHER_BLOCK }, alice, chainOk);
  assert.equal(swapped.verdictCode, "RECEIPT_ID_MISMATCH");
  assert.equal(unknownTx.verdictCode, "TX_NOT_FOUND");
  assert.equal(wrongBlock.verdictCode, "BLOCK_HASH_MISMATCH");
  assert.equal(new Set([swapped.verdictCode, unknownTx.verdictCode, wrongBlock.verdictCode]).size, 3);
});
