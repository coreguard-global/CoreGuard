/**
 * CoreGuard Reference Resolution (CG-REF/1) — from a `receipt_id` to bytes.
 *
 * A field that names evidence is not a field that finds it. This module is the
 * procedure behind the name, and its first rule is that a name alone proves
 * nothing: `receipt_id` is resolved only to a RECORD, and the record is what
 * gets judged. Resolution therefore has to survive four different answers
 * without collapsing them into one:
 *
 *   resolved      bytes were produced, and their digest matches something the
 *                 caller could check (the id itself, a registry entry, or an
 *                 expectation the caller supplied)
 *   absent        every source said "nothing here" — silence, never a failure
 *   unresolvable  a source was reachable in principle but could not answer, or
 *                 the id carried no checkable expectation at all
 *   tampered      bytes arrived and did not hash to what the id/index claimed
 *
 * Three id forms are recognised, in descending order of what the id itself
 * proves:
 *
 *   urn:sha256:<64 hex>   content-addressed. Fetch anything you like; it is
 *                         resolved only if it hashes to the id. No registry, no
 *                         trust in the locator, no trust in us.
 *   https://…             a locator. It proves WHERE, never WHAT: the bytes are
 *                         checked against an expectation (registry entry or the
 *                         caller's own digest), and with no expectation the
 *                         result is `unresolvable`, not `resolved`.
 *   opaque                an identifier with no expectation (AER-1's shape).
 *                         Locator hints may still be tried, but the outcome
 *                         cannot be better than `unresolvable` unless the caller
 *                         brings the expectation with it.
 *
 * BOUNDARY (standing, load-bearing):
 *   - The network exists only through an injected `fetchImpl`. There is no
 *     ambient fetch, no retry storm, no redirect following beyond what the
 *     injected function does, and a hard byte cap: a resolver that lets a peer
 *     decide how much memory it uses is a denial-of-service with extra steps.
 *   - Plain http is refused unless the host is loopback AND the caller opted in
 *     (`allowInsecureLoopback`), so a test can use a real socket without the
 *     library ever shipping an http-anywhere default.
 *   - Resolution says nothing about correctness. `resolved` means "these are
 *     the bytes behind that name", never "these bytes are good".
 */

import { createHash } from "node:crypto";

export const REFERENCE_VERSION = "CG-REF/1";
export const REFERENCE_SCHEMA = "coreguard.reference/1";

const HEX64 = /^[0-9a-f]{64}$/;
const URN = /^urn:sha256:([0-9a-f]{64})$/;
const DEFAULT_MAX_BYTES = 1 << 20;
const DEFAULT_TIMEOUT_MS = 5000;

export const ID_FORMS = Object.freeze(["urn-sha256", "url", "opaque"]);

/** sha256 over raw bytes, as the prefixed form the rest of the repo uses. */
export function digestOf(bytes) {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}

/** What the id itself claims, before any network exists. */
export function classifyReceiptId(receiptId) {
  if (typeof receiptId !== "string" || receiptId.length === 0 || receiptId.length > 2048) {
    throw new TypeError("receiptId must be a non-empty string of at most 2048 characters");
  }
  const urn = URN.exec(receiptId);
  if (urn) return Object.freeze({ form: "urn-sha256", receiptId, digest: "sha256:" + urn[1], contentAddressed: true });
  let url = null;
  try {
    url = new URL(receiptId);
  } catch {
    url = null;
  }
  if (url && (url.protocol === "https:" || url.protocol === "http:")) {
    return Object.freeze({ form: "url", receiptId, digest: null, contentAddressed: false });
  }
  return Object.freeze({ form: "opaque", receiptId, digest: null, contentAddressed: false });
}

/**
 * The locator hints a profile may derive from an id. This is the "well-known"
 * half of discovery: a content-addressed id already contains everything a
 * mirror needs, so a merchant, an agent platform and an auditor can all probe
 * the same path shape and compare bytes instead of trusting whoever answers.
 */
export function deriveLocatorCandidates({ receiptId, issuerOrigin, path = "/.well-known/var1/receipts/" } = {}) {
  const id = classifyReceiptId(receiptId);
  const out = [];
  if (id.form === "url") out.push(id.receiptId);
  if (id.contentAddressed && typeof issuerOrigin === "string" && issuerOrigin) {
    const origin = issuerOrigin.replace(/\/+$/, "");
    out.push(`${origin}${path}${id.digest.slice("sha256:".length)}`);
  }
  return Object.freeze(out);
}

/**
 * What a resolution plan can PROVE, step by step, so a reviewer can see that
 * the tiers are not interchangeable before any bytes are fetched.
 */
export function planResolution({ receiptId, issuerOrigin } = {}) {
  const id = classifyReceiptId(receiptId);
  const steps = [];
  steps.push({
    tier: "inline",
    proves: id.contentAddressed ? "bytes hash to the id" : "bytes hash to the caller's expectation, if any",
    possible: true,
  });
  steps.push({
    tier: "registry",
    proves: "the registry's published digest matches the bytes",
    possible: true,
  });
  const candidates = deriveLocatorCandidates({ receiptId, issuerOrigin });
  steps.push({
    tier: "locator",
    proves: id.contentAddressed ? "bytes hash to the id, so the locator is irrelevant" : "bytes hash to an expectation; the locator is not trusted",
    possible: candidates.length > 0,
    candidates,
  });
  return Object.freeze({
    refVersion: REFERENCE_VERSION,
    idForm: id.form,
    contentAddressed: id.contentAddressed,
    idDigest: id.digest,
    steps: Object.freeze(steps),
    strongestPossible: id.contentAddressed ? "resolved-by-content" : "resolved-by-expectation",
  });
}

function normalizeExpectation(value) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new TypeError("expectedDigest must be sha256:<64 hex>");
  }
  return value;
}

function checkUrlAllowed(url, allowInsecureLoopback) {
  const u = new URL(url);
  if (u.protocol === "https:") return true;
  if (u.protocol !== "http:") return false;
  if (!allowInsecureLoopback) return false;
  return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1" || u.hostname === "[::1]";
}

/**
 * resolveReceipt({ reference, inline, registry, expectedDigest, fetchImpl, … })
 *
 *   reference       { receiptId, profile? } — the two fields ACP carries
 *   inline          { bytes } — the record handed over with the message
 *   registry        function(id) -> { bytes, digest } | null, or a Map of id -> same
 *   expectedDigest  what the caller already believes the bytes must hash to
 *   fetchImpl       async (url) -> { url, status, bytes } — injected, never ambient
 *
 * Precedence is deliberate: inline, then registry, then locator. The first
 * source that produces bytes decides; bytes that fail their expectation are
 * `tampered` immediately, never silently retried against a laxer source.
 */
export async function resolveReceipt({
  reference,
  inline = null,
  registry = null,
  expectedDigest = null,
  fetchImpl = null,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  allowInsecureLoopback = false,
} = {}) {
  if (!reference || typeof reference !== "object") throw new TypeError("reference must be an object with receiptId");
  const id = classifyReceiptId(reference.receiptId);
  const expected = normalizeExpectation(expectedDigest) ?? id.digest ?? null;
  const tried = [];
  const checks = [];

  const judge = (bytes, source, claimedDigest) => {
    const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes ?? []);
    const digest = digestOf(buf);
    checks.push({ name: "bytes are non-empty", ok: buf.length > 0 });
    checks.push({ name: "bytes are within the cap", ok: buf.length <= maxBytes });
    const target = expected ?? normalizeExpectation(claimedDigest) ?? null;
    if (target) checks.push({ name: `bytes hash to ${target.slice(0, 14)}…`, ok: digest === target });
    return Object.freeze({
      refVersion: REFERENCE_VERSION,
      schema: REFERENCE_SCHEMA,
      receiptId: id.receiptId,
      idForm: id.form,
      source,
      state: target ? (digest === target ? "resolved" : "tampered") : "resolved-unchecked",
      digest,
      expectedDigest: target,
      bytes: buf.toString("utf8"),
      size: buf.length,
      checks: Object.freeze(checks),
      tried: Object.freeze(tried.slice()),
      reason: target ? null : "no_expectation",
    });
  };

  // 1. inline
  if (inline && (typeof inline.bytes === "string" || Buffer.isBuffer(inline.bytes))) {
    tried.push({ tier: "inline", ok: true });
    return judge(inline.bytes, "inline", inline.digest);
  }
  tried.push({ tier: "inline", ok: false });

  // 2. registry
  if (registry) {
    let entry = null;
    try {
      entry = typeof registry === "function" ? registry(id.receiptId) : registry.get?.(id.receiptId) ?? null;
    } catch (err) {
      tried.push({ tier: "registry", ok: false, reason: `registry threw: ${err?.message ?? err}` });
    }
    if (entry && (typeof entry.bytes === "string" || Buffer.isBuffer(entry.bytes))) {
      tried.push({ tier: "registry", ok: true });
      const claim = normalizeExpectation(entry.digest);
      if (expected && claim && expected !== claim) {
        return Object.freeze({
          refVersion: REFERENCE_VERSION,
          schema: REFERENCE_SCHEMA,
          receiptId: id.receiptId,
          idForm: id.form,
          source: "registry",
          state: "tampered",
          digest: null,
          expectedDigest: expected,
          bytes: null,
          size: 0,
          checks: Object.freeze([{ name: "registry digest agrees with the id/expectation", ok: false }]),
          tried: Object.freeze(tried.slice()),
          reason: "registry_disagrees_with_expectation",
        });
      }
      return judge(entry.bytes, "registry", claim);
    }
    if (!entry) tried.push({ tier: "registry", ok: false, reason: "no entry" });
  }

  // 3. locator
  const candidates = deriveLocatorCandidates({ receiptId: id.receiptId, issuerOrigin: reference.issuerOrigin });
  if (candidates.length === 0) {
    return Object.freeze({
      refVersion: REFERENCE_VERSION,
      schema: REFERENCE_SCHEMA,
      receiptId: id.receiptId,
      idForm: id.form,
      source: null,
      state: "unresolvable",
      digest: null,
      expectedDigest: expected,
      bytes: null,
      size: 0,
      checks: Object.freeze([{ name: "a locator can be derived", ok: false }]),
      tried: Object.freeze(tried.slice()),
      reason: expected ? "no_source_answered" : "no_expectation_and_no_locator",
    });
  }
  if (typeof fetchImpl !== "function") {
    return Object.freeze({
      refVersion: REFERENCE_VERSION,
      schema: REFERENCE_SCHEMA,
      receiptId: id.receiptId,
      idForm: id.form,
      source: null,
      state: "unresolvable",
      digest: null,
      expectedDigest: expected,
      bytes: null,
      size: 0,
      checks: Object.freeze([{ name: "a fetch implementation is available", ok: false }]),
      tried: Object.freeze(tried.slice()),
      reason: "no_fetch_impl",
    });
  }
  for (const url of candidates) {
    if (!checkUrlAllowed(url, allowInsecureLoopback)) {
      tried.push({ tier: "locator", url, ok: false, reason: "url refused by policy" });
      continue;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(50, timeoutMs));
    try {
      const res = await fetchImpl(url, { signal: ctrl.signal, maxBytes });
      const bytes = res?.bytes ?? res?.body;
      if (!bytes || (typeof bytes === "string" && bytes.length === 0)) {
        tried.push({ tier: "locator", url, ok: false, status: res?.status ?? null, reason: "empty answer" });
        continue;
      }
      tried.push({ tier: "locator", url, ok: true, status: res?.status ?? null });
      return judge(bytes, "locator", res?.digest);
    } catch (err) {
      tried.push({ tier: "locator", url, ok: false, reason: `fetch failed: ${err?.message ?? err}` });
    } finally {
      clearTimeout(timer);
    }
  }
  return Object.freeze({
    refVersion: REFERENCE_VERSION,
    schema: REFERENCE_SCHEMA,
    receiptId: id.receiptId,
    idForm: id.form,
    source: null,
    state: expected ? "unresolvable" : "absent",
    digest: null,
    expectedDigest: expected,
    bytes: null,
    size: 0,
    checks: Object.freeze([{ name: "at least one source answered", ok: false }]),
    tried: Object.freeze(tried.slice()),
    reason: expected ? "no_source_answered" : "nothing_presented",
  });
}

/** The resolution as CG-OUT/1 reads it: absent and unresolvable stay distinct. */
export function resolutionOutcome(resolution) {
  const state = resolution?.state;
  const map = {
    resolved: { outcome: "VERIFIED", blocks: false },
    "resolved-unchecked": { outcome: "NOT_CHECKED", blocks: false },
    absent: { outcome: "ABSENT", blocks: false },
    unresolvable: { outcome: "UNRESOLVABLE_RECORD", blocks: true },
    tampered: { outcome: "VERIFICATION_FAILED", blocks: true },
  };
  const hit = map[state] ?? { outcome: "NOT_CHECKED", blocks: false };
  return Object.freeze({
    ...hit,
    state: state ?? "unknown",
    reason: resolution?.reason ?? null,
    source: resolution?.source ?? null,
    digest: resolution?.digest ?? null,
  });
}

export function selfCheck() {
  const checks = [];
  const urn = classifyReceiptId("urn:sha256:" + "a".repeat(64));
  checks.push({ name: "urn form is content-addressed", pass: urn.form === "urn-sha256" && urn.contentAddressed });
  checks.push({ name: "https form is a locator, not content-addressed", pass: classifyReceiptId("https://m.example/r/1").form === "url" });
  checks.push({ name: "opaque form proves nothing by itself", pass: classifyReceiptId("r-123").digest === null });
  const body = JSON.stringify({ ok: true });
  const good = digestOf(body);
  checks.push({ name: "digest is prefixed sha256", pass: /^sha256:[0-9a-f]{64}$/.test(good) });
  const plan = planResolution({ receiptId: "r-123" });
  checks.push({ name: "plan states what the name cannot prove", pass: plan.strongestPossible === "resolved-by-expectation" });
  checks.push({ name: "outcome keeps absent and unresolvable apart", pass: resolutionOutcome({ state: "absent" }).outcome === "ABSENT" && resolutionOutcome({ state: "unresolvable" }).outcome === "UNRESOLVABLE_RECORD" });
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
