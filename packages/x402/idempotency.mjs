/**
 * idempotency.mjs — CG-X402-IDEM/1, a caller-owned pre-sign reservation gate.
 *
 * What this is: a deterministic state machine for the "same purchase, two
 * concurrent signer calls" window. It answers exactly two questions — may this
 * caller enter the signer, and what does the duplicate get back? — from a
 * caller-supplied purchase id, an AUTHENTICATED owner, and a digest of the
 * canonical intent.
 *
 * What this is NOT, and never becomes from inside this file:
 *   - it is NOT a signer, a network client, or a durable store of its own;
 *   - it is NOT a facilitator, a settlement, or a receipt of value;
 *   - it makes NO safety, finality, compatibility or endorsement claim.
 *
 * VERIFIED ≠ SAFE: this module verifies the shape of a caller-supplied claim
 * and the identity of the caller that made it. It does not make the purchase
 * safe, and it cannot observe anything that happens after a signature exists.
 *
 * The store is injected. The reference store below is in-memory and atomic
 * only within one process. A cross-process deployment MUST inject a store
 * whose insert-if-absent is atomic (BEGIN IMMEDIATE + UNIQUE, or a
 * single-writer actor). That boundary is stated, not implied.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "../canonical/index.js";

export const IDEMPOTENCY_SPEC = "CG-X402-IDEM/1";
export const IDEMPOTENCY_BOUNDARY =
  "VERIFIED ≠ SAFE — no network, no signing, no settlement; caller-supplied evidence only";

export const RESERVATION_STATES = Object.freeze(["RESERVED", "SIGNED", "SETTLED"]);
export const INTENT_DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** Digest of a caller-supplied canonical intent. No terms are invented here. */
export function intentDigestOf(intent) {
  if (intent === null || typeof intent !== "object" || Array.isArray(intent)) {
    throw new TypeError("intentDigestOf: intent must be an object of caller-supplied terms");
  }
  return "sha256:" + createHash("sha256").update(canonicalize(intent), "utf8").digest("hex");
}

/**
 * Reference in-memory store. Atomic within one event loop only; never
 * presented as cross-process coordination. `insertIfAbsent` is the single
 * primitive every caller relies on — no read-then-write anywhere else.
 */
export function createMemoryStore() {
  const rows = new Map();
  return Object.freeze({
    insertIfAbsent(key, makeRow) {
      if (rows.has(key)) return { inserted: false, row: rows.get(key) };
      const row = makeRow();
      rows.set(key, row);
      return { inserted: true, row };
    },
    get(key) {
      return rows.has(key) ? rows.get(key) : null;
    },
    size() {
      return rows.size;
    },
  });
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function keyFor(owner, purchaseId) {
  return `${owner}\u0000${purchaseId}`;
}

/**
 * createPurchaseGate — the caller-side reservation boundary.
 *
 * @param {object} opts
 * @param {object} [opts.store]              injected store with insertIfAbsent/get
 * @param {function} opts.authenticate        (ctx) => ({ owner })|null. THE ONLY
 *                                            source of owner identity. A value
 *                                            asserted in ctx is never trusted.
 * @param {function} [opts.clock]             () => epoch seconds (injected)
 * @param {number} opts.maxTimeoutSeconds     scheme timeout the intent may use
 * @param {number} opts.reservationTtlSeconds MUST be >= maxTimeoutSeconds; a
 *                                            shorter TTL reopens the window
 *                                            while a valid authorization is live.
 * @param {number} [opts.artifactRetentionSeconds] MUST be >= reservationTtlSeconds.
 *                                            The artifact stays replayable until
 *                                            the authorization can no longer settle.
 */
export function createPurchaseGate({
  store = createMemoryStore(),
  authenticate,
  clock = () => Math.floor(Date.now() / 1000),
  maxTimeoutSeconds,
  reservationTtlSeconds,
  artifactRetentionSeconds,
} = {}) {
  if (typeof authenticate !== "function") {
    throw new TypeError("createPurchaseGate: authenticate(ctx) is required — owner identity cannot be asserted");
  }
  if (!store || typeof store.insertIfAbsent !== "function" || typeof store.get !== "function") {
    throw new TypeError("createPurchaseGate: store must provide insertIfAbsent(key, makeRow) and get(key)");
  }
  if (!isPositiveInt(maxTimeoutSeconds) || !isPositiveInt(reservationTtlSeconds)) {
    throw new TypeError("createPurchaseGate: maxTimeoutSeconds and reservationTtlSeconds must be positive integers");
  }
  if (reservationTtlSeconds < maxTimeoutSeconds) {
    throw new RangeError("createPurchaseGate: reservationTtlSeconds must be >= maxTimeoutSeconds — a slow but valid authorization must not fall out of the table");
  }
  const retainFor = artifactRetentionSeconds === undefined ? reservationTtlSeconds + maxTimeoutSeconds : artifactRetentionSeconds;
  if (!isPositiveInt(retainFor) || retainFor < reservationTtlSeconds) {
    throw new RangeError("createPurchaseGate: artifactRetentionSeconds must be >= reservationTtlSeconds");
  }

  function ownerFrom(ctx) {
    const auth = authenticate(ctx);
    if (!auth || typeof auth.owner !== "string" || auth.owner.length === 0) return null;
    return auth.owner;
  }

  function validPurchaseId(purchaseId) {
    return typeof purchaseId === "string" && purchaseId.length >= 8 && purchaseId.length <= 256;
  }

  /** Public view. Never leaks another owner's row: callers only ever pass ctx. */
  function view(row, code, extra = {}) {
    const base = {
      code,
      state: row ? row.state : null,
      purchaseId: row ? row.purchaseId : null,
      expiresAt: row ? row.expiresAt : null,
      retainedUntil: row ? row.retainedUntil : null,
      replay: code === "PENDING" || code === "REPLAY" || code === "RECEIPT_REPLAY",
      artifact: null,
      receipt: null,
    };
    return Object.freeze({ ...base, ...extra });
  }

  /**
   * reserve — the single entry point for a caller about to sign.
   *
   * RESERVED    first caller; no artifact exists yet. Enter the signer.
   * PENDING     same authenticated owner + same digest, winner still signing.
   *             Wait on the row, do not error and do not sign.
   * RESERVATION_LAPSED same owner + digest, but the winner's signing window
   *             closed with no artifact. attachArtifact can no longer succeed;
   *             waiting would be a lie. Start a new purchase id.
   * REPLAY      same owner + same digest; original artifact returned.
   * RECEIPT_REPLAY same owner + same digest; original receipt returned.
   * INTENT_MISMATCH same owner, different digest; both digests returned.
   * OWNER_CONFLICT  asserted owner is not the row's owner — opaque. No digest,
   *             no state, no artifact, no timing hint: the gate itself must not
   *             become a cross-tenant oracle. Note this case can only arise if
   *             an integrator looks up by purchase id without the authenticated
   *             owner; the primary key here is (owner, purchaseId), so a
   *             different owner is ordinarily a DIFFERENT purchase and
   *             reserves independently.
   */
  function reserve({ ctx, purchaseId, intentDigest } = {}) {
    const owner = ownerFrom(ctx);
    if (owner === null) return Object.freeze({ code: "UNAUTHENTICATED", state: null, artifact: null });
    if (!validPurchaseId(purchaseId)) return Object.freeze({ code: "INVALID_PURCHASE_ID", state: null, artifact: null });
    if (typeof intentDigest !== "string" || !INTENT_DIGEST_RE.test(intentDigest)) {
      return Object.freeze({ code: "INVALID_INTENT_DIGEST", state: null, artifact: null });
    }

    const now = Number(clock());
    if (!Number.isFinite(now)) return Object.freeze({ code: "INVALID_CLOCK", state: null, artifact: null });
    const key = keyFor(owner, purchaseId);

    // Mutable by the gate only; every object handed to a caller is frozen.
    // Freezing the row here would make the RESERVED → SIGNED → SETTLED
    // transitions silently impossible in strict mode.
    const claim = store.insertIfAbsent(key, () => ({
      owner,
      purchaseId,
      intentDigest,
      state: "RESERVED",
      artifact: null,
      receipt: null,
      reservedAt: now,
      expiresAt: now + reservationTtlSeconds,
      retainedUntil: now + retainFor,
    }));

    if (claim.inserted) {
      return view(claim.row, "RESERVED", { expiresAt: claim.row.expiresAt });
    }

    const row = claim.row;
    // Structural owner gate: the row is only ever visible through ctx. An
    // asserted owner cannot read it, and a mismatch reveals nothing.
    if (row.owner !== owner) {
      return Object.freeze({
        code: "OWNER_CONFLICT", state: null, purchaseId: null,
        expiresAt: null, retainedUntil: null, replay: false,
        artifact: null, receipt: null,
      });
    }
    if (row.intentDigest !== intentDigest) {
      return view(row, "INTENT_MISMATCH", {
        storedIntentDigest: row.intentDigest,
        incomingIntentDigest: intentDigest,
      });
    }
    if (now >= row.retainedUntil) {
      return view(row, "EXPIRED", { detail: "artifact retention ended; choose a new purchase id" });
    }
    if (row.state === "RESERVED" && now >= row.expiresAt) {
      // The write side refuses attachArtifact at exactly this point. Telling
      // the duplicate to wait here would describe an artifact that can never
      // arrive, so the two paths must agree on one boundary.
      return view(row, "RESERVATION_LAPSED", {
        detail: "winner's signing window closed without an artifact; choose a new purchase id",
      });
    }
    if (row.state === "RESERVED") {
      return view(row, "PENDING", { detail: "winner has not produced the artifact yet" });
    }
    if (row.state === "SETTLED") {
      return view(row, "RECEIPT_REPLAY", { artifact: row.artifact, receipt: row.receipt });
    }
    return view(row, "REPLAY", { artifact: row.artifact });
  }

  /** Attach the artifact at the producer, once. This is the SIGNED transition. */
  function attachArtifact({ ctx, purchaseId, intentDigest, artifact } = {}) {
    const owner = ownerFrom(ctx);
    if (owner === null) return Object.freeze({ code: "UNAUTHENTICATED" });
    const row = store.get(keyFor(owner, purchaseId));
    if (!row || row.owner !== owner) return Object.freeze({ code: "NOT_RESERVED" });
    if (row.intentDigest !== intentDigest) return Object.freeze({ code: "INTENT_MISMATCH" });
    const attachedAt = Number(clock());
    if (!Number.isFinite(attachedAt) || attachedAt >= row.expiresAt) {
      return Object.freeze({ code: "RESERVATION_EXPIRED" });
    }
    if (row.state !== "RESERVED") return Object.freeze({ code: "ARTIFACT_ALREADY_ATTACHED" });
    if (artifact === null || typeof artifact !== "object") {
      return Object.freeze({ code: "NO_ARTIFACT" });
    }
    row.artifact = Object.freeze({ ...artifact });
    row.state = "SIGNED";
    return Object.freeze({ code: "SIGNED", artifact: row.artifact });
  }

  /** Record the observed outcome. Caller supplies it; this module observes nothing. */
  function markSettled({ ctx, purchaseId, intentDigest, receipt } = {}) {
    const owner = ownerFrom(ctx);
    if (owner === null) return Object.freeze({ code: "UNAUTHENTICATED" });
    const row = store.get(keyFor(owner, purchaseId));
    if (!row || row.owner !== owner) return Object.freeze({ code: "NOT_RESERVED" });
    if (row.intentDigest !== intentDigest) return Object.freeze({ code: "INTENT_MISMATCH" });
    if (row.state !== "SIGNED") return Object.freeze({ code: "NOT_SIGNED" });
    if (receipt === null || typeof receipt !== "object") return Object.freeze({ code: "NO_RECEIPT" });
    row.receipt = Object.freeze({ ...receipt });
    row.state = "SETTLED";
    return Object.freeze({ code: "SETTLED", receipt: row.receipt });
  }

  return Object.freeze({
    version: IDEMPOTENCY_SPEC,
    boundary: IDEMPOTENCY_BOUNDARY,
    reserve,
    attachArtifact,
    markSettled,
    store,
  });
}

/**
 * createFacilitatorDedup — the second, complementary boundary.
 *
 * The facilitator never sees purchase_id; it sees a signed payload. Dedup on
 * the payload digest only, and gate the replay on the signature-VERIFIED payer
 * supplied by the integrator. A different payer gets an opaque conflict, so
 * the dedup surface cannot be used to read another account's result.
 */
export function createFacilitatorDedup({ store = createMemoryStore(), clock = () => Math.floor(Date.now() / 1000), ttlSeconds = 300 } = {}) {
  if (!isPositiveInt(ttlSeconds)) throw new TypeError("createFacilitatorDedup: ttlSeconds must be a positive integer");
  function claim({ payloadDigest, payerVerified, result = null } = {}) {
    if (typeof payloadDigest !== "string" || !INTENT_DIGEST_RE.test(payloadDigest)) {
      return Object.freeze({ code: "INVALID_PAYLOAD_DIGEST" });
    }
    if (typeof payerVerified !== "string" || payerVerified.length === 0) {
      return Object.freeze({ code: "PAYER_NOT_VERIFIED" });
    }
    const now = Number(clock());
    const hit = store.insertIfAbsent(payloadDigest, () => Object.freeze({
      payerVerified, result, expiresAt: now + ttlSeconds,
    }));
    if (hit.inserted) return Object.freeze({ code: "ACCEPTED", replay: false, result });
    if (hit.row.payerVerified !== payerVerified) {
      return Object.freeze({ code: "PAYER_CONFLICT", replay: false, result: null });
    }
    if (now >= hit.row.expiresAt) return Object.freeze({ code: "EXPIRED", replay: false, result: null });
    return Object.freeze({ code: "REPLAY", replay: true, result: hit.row.result });
  }
  return Object.freeze({ version: IDEMPOTENCY_SPEC, claim, store });
}

export function selfCheck() {
  const cases = [];
  const gate = createPurchaseGate({
    authenticate: (ctx) => (ctx && ctx.token === "ok" ? { owner: "buyer-A" } : null),
    maxTimeoutSeconds: 60,
    reservationTtlSeconds: 90,
  });
  const digest = intentDigestOf({ resource: "/v1/verify", amount: 500 });
  const ctx = { token: "ok" };
  const first = gate.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: digest });
  cases.push(["first caller reserves without an artifact", first.code === "RESERVED" && first.artifact === null]);
  const second = gate.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: digest });
  cases.push(["duplicate is pending, not denied", second.code === "PENDING" && second.replay === true]);
  const anon = gate.reserve({ ctx: { token: "bad" }, purchaseId: "purchase-0001", intentDigest: digest });
  cases.push(["an asserted/unauthenticated caller cannot enter", anon.code === "UNAUTHENTICATED"]);
  gate.attachArtifact({ ctx, purchaseId: "purchase-0001", intentDigest: digest, artifact: { id: "artifact-1" } });
  const replay = gate.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: digest });
  cases.push(["after signing, the duplicate returns the original", replay.code === "REPLAY" && replay.artifact.id === "artifact-1"]);
  const mismatch = gate.reserve({ ctx, purchaseId: "purchase-0001", intentDigest: intentDigestOf({ resource: "/v1/verify", amount: 501 }) });
  cases.push(["changed intent is an explicit mismatch with both digests", mismatch.code === "INTENT_MISMATCH" && typeof mismatch.storedIntentDigest === "string" && typeof mismatch.incomingIntentDigest === "string"]);
  const dedup = createFacilitatorDedup();
  const d = intentDigestOf({ payload: "signed" });
  const a1 = dedup.claim({ payloadDigest: d, payerVerified: "payer-A", result: { settlement: "r1" } });
  const a2 = dedup.claim({ payloadDigest: d, payerVerified: "payer-A" });
  const a3 = dedup.claim({ payloadDigest: d, payerVerified: "payer-B" });
  cases.push(["facilitator replays by payload digest for the verified payer", a1.code === "ACCEPTED" && a2.code === "REPLAY" && a2.result.settlement === "r1"]);
  cases.push(["facilitator conflict is opaque across payers", a3.code === "PAYER_CONFLICT" && a3.result === null]);
  let lateClock = 1000;
  const lateGate = createPurchaseGate({
    authenticate: () => ({ owner: "buyer-L" }),
    clock: () => lateClock,
    maxTimeoutSeconds: 10,
    reservationTtlSeconds: 10,
    artifactRetentionSeconds: 30,
  });
  const lateDigest = intentDigestOf({ resource: "/v1/lapse", amount: 1 });
  const lateCtx = {};
  const lateFirst = lateGate.reserve({ ctx: lateCtx, purchaseId: "purchase-lapse", intentDigest: lateDigest });
  lateClock += 11;
  const lateDup = lateGate.reserve({ ctx: lateCtx, purchaseId: "purchase-lapse", intentDigest: lateDigest });
  const lateAttach = lateGate.attachArtifact({ ctx: lateCtx, purchaseId: "purchase-lapse", intentDigest: lateDigest, artifact: { id: "late" } });
  cases.push(["a lapsed read is not PENDING and agrees with the closed write window", lateFirst.code === "RESERVED" && lateDup.code === "RESERVATION_LAPSED" && lateDup.replay === false && lateAttach.code === "RESERVATION_EXPIRED"]);

  const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) {
    console.error(IDEMPOTENCY_SPEC + " SELF-CHECK FAIL\n" + failed.map((f) => "  - " + f).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(IDEMPOTENCY_SPEC + " SELF-CHECK OK " + cases.length + "/" + cases.length + " — " + IDEMPOTENCY_BOUNDARY);
  }
  return failed.length === 0;
}

if (process.argv[1] && process.argv[1].endsWith("idempotency.mjs") && process.argv.includes("--self-check")) {
  selfCheck();
}
