/**
 * CGCP Integration Common (CG-INT/1)
 *
 * Shared primitives for the real external-integration adapters. Everything here
 * is deterministic, dependency-free (node:crypto + global fetch), and fail-closed.
 * No adapter in this directory may report success from placeholder configuration,
 * an unverified response, or a network error.
 */

import { createHash } from "node:crypto";

export const INTEGRATIONS_VERSION = "CG-INT/1";
export const INTEGRATIONS_BOUNDARY =
  "real protocol adapters; verification is only as strong as the supplied trust roots and live endpoints; " +
  "no adapter here provisions cloud accounts, holds funds, signs user transactions, or proves physical-world truth; " +
  "VERIFIED != SAFE.";

/** Placeholder tokens that must never be mistaken for provisioned configuration. */
const PLACEHOLDER_PATTERNS = [
  /example\.(com|org|net|io|internal|local)/i,
  /REPLACE/i,
  /YOUR[_-]?(KEY|ID|TOKEN|SECRET|ORG|TENANT)/i,
  /<[^>]+>/,
  /\bTODO\b/i,
  /changeme/i,
  /localhost/i,
  /127\.0\.0\.1/,
];

export function isPlaceholder(value) {
  if (typeof value !== "string" || value.trim() === "") return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

export function requireProvisioned(config, keys, { allowLocal = false } = {}) {
  const missing = [];
  const placeholders = [];
  for (const key of keys) {
    const value = config?.[key];
    if (value === undefined || value === null || value === "") missing.push(key);
    else if (isPlaceholder(String(value)) && !(allowLocal && /^(http:\/\/|https:\/\/)?(localhost|127\.0\.0\.1)/i.test(String(value)))) placeholders.push(key);
  }
  if (missing.length || placeholders.length) {
    const err = new Error(`CG-INT/1: NOT_PROVISIONED (missing: ${missing.join(",") || "none"}; placeholder: ${placeholders.join(",") || "none"})`);
    err.code = "NOT_PROVISIONED";
    err.missing = missing;
    err.placeholders = placeholders;
    throw err;
  }
  return true;
}

/** RFC 8785-ish canonical JSON for the bounded, flat records used by these adapters. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function sha256(value) {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return createHash("sha256").update(bytes).digest("hex");
}

export function domainDigest(domain, value) {
  return sha256(canonicalJson({ __domain: domain, value }));
}

export function nowIso() { return new Date().toISOString(); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Real HTTP JSON request with timeout, bounded exponential backoff, and no
 * implicit trust. `expectStatus` must include the status or the call fails.
 */
export async function requestJson(url, {
  method = "GET",
  headers = {},
  body = null,
  expectStatus = [200],
  timeoutMs = 8000,
  retries = 0,
  backoffMs = 150,
  label = "http",
} = {}) {
  const attempts = retries + 1;
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { Accept: "application/json", ...headers },
        body: body === null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
        signal: controller.signal,
        redirect: "error",
      });
      clearTimeout(timer);
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { __raw: text }; }
      if (expectStatus.includes(res.status)) {
        return {
          ok: true,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: parsed,
          raw: text,
          digest: sha256(text),
          attempted: i + 1,
        };
      }
      lastError = { status: res.status, body: parsed, digest: sha256(text) };
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || i === attempts - 1) break;
      await sleep(backoffMs * (2 ** i));
    } catch (err) {
      clearTimeout(timer);
      lastError = { message: err instanceof Error ? err.message : String(err) };
      if (i === attempts - 1) break;
      await sleep(backoffMs * (2 ** i));
    }
  }
  const error = new Error(`${label}: request failed after ${attempts} attempt(s)`);
  error.code = "UPSTREAM_ERROR";
  error.detail = lastError;
  throw error;
}

export function verdict(reason, extra = {}) {
  return Object.freeze({
    spec: INTEGRATIONS_VERSION,
    verdict: reason === "OK" ? "VERIFIED" : "REFUSED",
    reason,
    boundary: INTEGRATIONS_BOUNDARY,
    at: nowIso(),
    ...extra,
  });
}

/** Constant-time-ish equality for digests/tokens; never early-exit on prefix. */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) {
    // compare against a same-length zero buffer to keep work proportional
    let diff = aa.length ^ bb.length;
    const n = Math.max(aa.length, bb.length);
    for (let i = 0; i < n; i += 1) diff |= (bb[i % bb.length] || 0) ^ (aa[i % aa.length] || 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  push("placeholder detection", isPlaceholder("https://x.example.com") && !isPlaceholder("https://idp.corp.internal"));
  push("canonical json", canonicalJson({ b: 2, a: 1 }) === '{"a":1,"b":2}');
  push("safe equal", safeEqual("abc", "abc") && !safeEqual("abc", "abd"));
  push("verdict fail-closed", verdict("BAD").verdict === "REFUSED" && verdict("OK").verdict === "VERIFIED");
  push("boundary names no custody", /holds funds/.test(INTEGRATIONS_BOUNDARY));
  return { ok: checks.every(c => c.ok), checks };
}
