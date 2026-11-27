import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  IDEMPOTENCY_SPEC, IDEMPOTENCY_BOUNDARY, createMemoryStore,
  createPurchaseGate, createFacilitatorDedup, intentDigestOf,
} from "../../packages/x402/idempotency.mjs";

const SOURCE = fileURLToPath(new URL("../../packages/x402/idempotency.mjs", import.meta.url));
const digest = (amount) => intentDigestOf({ resource: "/v1/verify", amountCents: amount });
const ctx = { token: "ok" };

function gate(opts = {}) {
  let now = 1_000;
  const g = createPurchaseGate({
    authenticate: (c) => (c && c.token === "ok" ? { owner: "buyer-A" } : null),
    clock: () => now,
    maxTimeoutSeconds: 60,
    reservationTtlSeconds: 90,
    ...opts,
  });
  return { g, tick: (seconds) => { now += seconds; } };
}

test("CG-X402-IDEM/1 keeps its spec id and its VERIFIED ≠ SAFE boundary", () => {
  assert.equal(IDEMPOTENCY_SPEC, "CG-X402-IDEM/1");
  assert.match(IDEMPOTENCY_BOUNDARY, /VERIFIED ≠ SAFE/);
  assert.match(IDEMPOTENCY_BOUNDARY, /no network/);
  assert.match(IDEMPOTENCY_BOUNDARY, /no signing/);
  const source = readFileSync(SOURCE, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bhttps?\.request\s*\(/);
});

test("one purchase under a shared authenticated owner yields one reservation and pending duplicates", () => {
  const { g } = gate();
  const d = digest(500);
  const first = g.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: d });
  assert.equal(first.code, "RESERVED");
  assert.equal(first.artifact, null);
  const codes = [];
  for (let i = 0; i < 7; i += 1) {
    const slot = g.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: d });
    codes.push(slot.code);
    assert.equal(slot.artifact, null);
    assert.equal(slot.replay, true);
  }
  assert.deepEqual(codes, Array(7).fill("PENDING"));
});

test("a duplicate landing before the artifact exists waits; after signing it gets the original back", () => {
  const { g } = gate();
  const d = digest(500);
  g.reserve({ ctx, purchaseId: "purchase-0002", intentDigest: d });
  assert.equal(g.reserve({ ctx, purchaseId: "purchase-0002", intentDigest: d }).code, "PENDING");
  const attached = g.attachArtifact({ ctx, purchaseId: "purchase-0002", intentDigest: d, artifact: { id: "artifact-7" } });
  assert.equal(attached.code, "SIGNED");
  const replay = g.reserve({ ctx, purchaseId: "purchase-0002", intentDigest: d });
  assert.equal(replay.code, "REPLAY");
  assert.equal(replay.replay, true);
  assert.equal(replay.artifact.id, "artifact-7");
  assert.equal(g.attachArtifact({ ctx, purchaseId: "purchase-0002", intentDigest: d, artifact: { id: "artifact-8" } }).code, "ARTIFACT_ALREADY_ATTACHED");
});

test("owner identity comes from authentication only, never from a caller-asserted field", () => {
  const { g } = gate();
  const d = digest(500);
  const asserted = { token: "ok", owner: "someone-else" };
  assert.equal(g.reserve({ ctx: asserted, purchaseId: "purchase-0003", intentDigest: d }).code, "RESERVED");
  assert.equal(g.reserve({ ctx: { owner: "buyer-A" }, purchaseId: "purchase-0003", intentDigest: d }).code, "UNAUTHENTICATED");
  assert.equal(g.reserve({ ctx: asserted, purchaseId: "purchase-0004", intentDigest: d }).code, "RESERVED");
});

test("same owner plus a changed intent is an explicit mismatch carrying both digests and no artifact", () => {
  const { g } = gate();
  const d = digest(500);
  g.reserve({ ctx, purchaseId: "purchase-0005", intentDigest: d });
  g.attachArtifact({ ctx, purchaseId: "purchase-0005", intentDigest: d, artifact: { id: "artifact-1" } });
  const changed = g.reserve({ ctx, purchaseId: "purchase-0005", intentDigest: digest(501) });
  assert.equal(changed.code, "INTENT_MISMATCH");
  assert.equal(changed.storedIntentDigest, d);
  assert.equal(changed.incomingIntentDigest, digest(501));
  assert.equal(changed.artifact, null);
});

test("different authenticated owners with the same purchase id are different purchases", () => {
  const store = createMemoryStore();
  const g = createPurchaseGate({
    store,
    authenticate: (c) => (c && c.owner ? { owner: c.owner } : null),
    clock: () => 1_000,
    maxTimeoutSeconds: 60,
    reservationTtlSeconds: 90,
  });
  const d = digest(500);
  const a = g.reserve({ ctx: { owner: "tenant-A" }, purchaseId: "purchase-0006", intentDigest: d });
  const b = g.reserve({ ctx: { owner: "tenant-B" }, purchaseId: "purchase-0006", intentDigest: d });
  assert.equal(a.code, "RESERVED");
  assert.equal(b.code, "RESERVED");
  assert.equal(store.size(), 2);
  g.attachArtifact({ ctx: { owner: "tenant-A" }, purchaseId: "purchase-0006", intentDigest: d, artifact: { id: "artifact-A" } });
  const aReplay = g.reserve({ ctx: { owner: "tenant-A" }, purchaseId: "purchase-0006", intentDigest: d });
  const bPending = g.reserve({ ctx: { owner: "tenant-B" }, purchaseId: "purchase-0006", intentDigest: d });
  assert.equal(aReplay.artifact.id, "artifact-A");
  assert.equal(bPending.artifact, null);
});

test("an unscoped store cannot turn the owner gate into a cross-tenant oracle", () => {
  const rows = new Map();
  const purchaseOnlyStore = {
    insertIfAbsent(key, makeRow) {
      const purchaseId = key.split("\u0000")[1];
      if (rows.has(purchaseId)) return { inserted: false, row: rows.get(purchaseId) };
      const row = makeRow();
      rows.set(purchaseId, row);
      return { inserted: true, row };
    },
    get(key) {
      return rows.get(key.split("\u0000")[1]) ?? null;
    },
  };
  const g = createPurchaseGate({
    store: purchaseOnlyStore,
    authenticate: (c) => (c && c.owner ? { owner: c.owner } : null),
    clock: () => 1_000,
    maxTimeoutSeconds: 60,
    reservationTtlSeconds: 90,
  });
  const d = digest(500);
  g.reserve({ ctx: { owner: "tenant-A" }, purchaseId: "purchase-0007", intentDigest: d });
  g.attachArtifact({ ctx: { owner: "tenant-A" }, purchaseId: "purchase-0007", intentDigest: d, artifact: { id: "secret-artifact" } });
  const conflict = g.reserve({ ctx: { owner: "tenant-B" }, purchaseId: "purchase-0007", intentDigest: d });
  assert.equal(conflict.code, "OWNER_CONFLICT");
  assert.equal(conflict.artifact, null);
  assert.equal(conflict.state, null);
  assert.equal(conflict.storedIntentDigest, undefined);
  assert.equal(conflict.incomingIntentDigest, undefined);
});

test("reservation TTL cannot be shorter than the scheme timeout", () => {
  assert.throws(() => gate({ maxTimeoutSeconds: 120, reservationTtlSeconds: 60 }), /reservationTtlSeconds must be >= maxTimeoutSeconds/);
  assert.throws(() => gate({ artifactRetentionSeconds: 50, maxTimeoutSeconds: 60, reservationTtlSeconds: 90 }), /artifactRetentionSeconds must be >= reservationTtlSeconds/);
});

test("artifact retention outlives the reservation so a late duplicate does not re-sign", () => {
  const { g, tick } = gate({ maxTimeoutSeconds: 10, reservationTtlSeconds: 10, artifactRetentionSeconds: 30 });
  const d = digest(500);
  g.reserve({ ctx, purchaseId: "purchase-0008", intentDigest: d });
  g.attachArtifact({ ctx, purchaseId: "purchase-0008", intentDigest: d, artifact: { id: "artifact-9" } });
  tick(15);
  const late = g.reserve({ ctx, purchaseId: "purchase-0008", intentDigest: d });
  assert.equal(late.code, "REPLAY");
  assert.equal(late.artifact.id, "artifact-9");
  tick(16);
  const expired = g.reserve({ ctx, purchaseId: "purchase-0008", intentDigest: d });
  assert.equal(expired.code, "EXPIRED");
  assert.equal(expired.artifact, null);

  const fresh = gate({ maxTimeoutSeconds: 10, reservationTtlSeconds: 10, artifactRetentionSeconds: 30 });
  fresh.g.reserve({ ctx, purchaseId: "purchase-0008b", intentDigest: d });
  fresh.tick(11);
  assert.equal(fresh.g.attachArtifact({ ctx, purchaseId: "purchase-0008b", intentDigest: d, artifact: { id: "late" } }).code, "RESERVATION_EXPIRED");
});

test("a lapsed reservation stops saying PENDING: read and write agree the window is closed", () => {
  const { g, tick } = gate({ maxTimeoutSeconds: 10, reservationTtlSeconds: 10, artifactRetentionSeconds: 30 });
  const d = digest(500);
  const first = g.reserve({ ctx, purchaseId: "purchase-0008c", intentDigest: d });
  assert.equal(first.code, "RESERVED");

  tick(11); // past expiresAt, still inside artifact retention
  const lapsed = g.reserve({ ctx, purchaseId: "purchase-0008c", intentDigest: d });
  assert.equal(lapsed.code, "RESERVATION_LAPSED");
  assert.equal(lapsed.replay, false);
  assert.equal(lapsed.artifact, null);
  assert.equal(lapsed.state, "RESERVED");
  assert.equal(lapsed.expiresAt, first.expiresAt);
  assert.match(lapsed.detail, /new purchase id/);

  const attach = g.attachArtifact({ ctx, purchaseId: "purchase-0008c", intentDigest: d, artifact: { id: "too-late" } });
  assert.equal(attach.code, "RESERVATION_EXPIRED");
});

test("a settled purchase replays the original receipt, not a fresh signing permission", () => {
  const { g } = gate();
  const d = digest(500);
  g.reserve({ ctx, purchaseId: "purchase-0009", intentDigest: d });
  g.attachArtifact({ ctx, purchaseId: "purchase-0009", intentDigest: d, artifact: { id: "artifact-10" } });
  const settled = g.markSettled({ ctx, purchaseId: "purchase-0009", intentDigest: d, receipt: { id: "receipt-1", outcome: "OBSERVED" } });
  assert.equal(settled.code, "SETTLED");
  const replay = g.reserve({ ctx, purchaseId: "purchase-0009", intentDigest: d });
  assert.equal(replay.code, "RECEIPT_REPLAY");
  assert.equal(replay.receipt.id, "receipt-1");
  assert.equal(replay.artifact.id, "artifact-10");
});

test("facilitator dedup replays by payload digest but never across unverified payers", () => {
  let now = 500;
  const dedup = createFacilitatorDedup({ clock: () => now, ttlSeconds: 100 });
  const d = intentDigestOf({ payload: "signed-authorization" });
  assert.equal(dedup.claim({ payloadDigest: d, payerVerified: "", result: { settlement: "r1" } }).code, "PAYER_NOT_VERIFIED");
  const first = dedup.claim({ payloadDigest: d, payerVerified: "payer-A", result: { settlement: "r1" } });
  assert.equal(first.code, "ACCEPTED");
  const replay = dedup.claim({ payloadDigest: d, payerVerified: "payer-A" });
  assert.equal(replay.code, "REPLAY");
  assert.equal(replay.result.settlement, "r1");
  const cross = dedup.claim({ payloadDigest: d, payerVerified: "payer-B" });
  assert.equal(cross.code, "PAYER_CONFLICT");
  assert.equal(cross.result, null);
  now += 101;
  assert.equal(dedup.claim({ payloadDigest: d, payerVerified: "payer-A" }).code, "EXPIRED");
});

test("distinct purchase ids over an identical quote stay independent", () => {
  const { g } = gate();
  const d = digest(500);
  const a = g.reserve({ ctx, purchaseId: "purchase-0010", intentDigest: d });
  const b = g.reserve({ ctx, purchaseId: "purchase-0011", intentDigest: d });
  assert.equal(a.code, "RESERVED");
  assert.equal(b.code, "RESERVED");
});
