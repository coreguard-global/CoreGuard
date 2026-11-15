/**
 * CoreGuard Agent Commerce Verification API (HTTP · offline · loopback-first)
 *
 * A provider-independent REST face for the Agent Commerce SDK: bind approvals,
 * verify executions, verify consent records, and classify drift — from any
 * commerce platform, wallet, or agent runtime that can speak HTTP+JSON.
 *
 * Postures (the honest defaults, measured in tests):
 *  - allowlist guard 0: a rejected address is refused before anything else
 *    (no limiter budget consumed, nothing else learned);
 *  - with NO allowlist configured the endpoint is OPEN — that absence is the
 *    documented default posture, not a failure;
 *  - /health is exempt from the rate limiter (liveness floods must never lock
 *    out probes) but NOT from the allowlist (an unlisted address learns
 *    nothing, not even liveness).
 *
 * Endpoints (all JSON; verification results embed no wall-clock time —
 * approval epochs are caller-pinned `nowSeconds`):
 *   GET  /health           -> 200 "OK" (limiter-exempt; allowlist still applies)
 *   POST /v1/authorize     {intent, policy, declaredTrace, nowSeconds} -> CGCR/1 consent
 *   POST /v1/verify        {consent, trace} -> fail-closed verdict + AGR/1 + named drift
 *   POST /v1/consent-verify {consent} -> integrity verdict
 *   POST /v1/risk-assess   {intent, policy, trace, consumed?} -> AGR/1 report
 *
 * BOUNDARY (standing): single-use consumption is process-local (durable
 * anchoring NOT_BUILT); execution verification never decides delivery
 * conformity (DDE/1); VERIFIED ≠ SAFE; no contact with any commerce platform
 * or payment network is made or implied.
 */

import { createConsent, verifyConsent, verifyExecution, assessRisk, AGENT_COMMERCE_VERSION } from "./index.mjs";

export const AGENT_COMMERCE_API_VERSION = "AC-API/1";
export const MAX_BODY_BYTES = 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

/** Token-bucket-per-peer limiter with the /health exemption split documented above. */
function createLimiter({ windowMs, max }) {
  const buckets = new Map();
  return function check(key, isHealth) {
    if (isHealth) return { ok: true, remaining: max }; // liveness is never throttled
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return { ok: true, remaining: max - 1 };
    }
    if (bucket.count >= max) return { ok: false, remaining: 0 };
    bucket.count += 1;
    return { ok: true, remaining: max - bucket.count };
  };
}

async function route({ method, path, body, consumed }) {
  if (method === "GET" && path === "/health") return { status: 200, body: "OK", raw: true };
  if (method !== "POST") return { status: method === "GET" ? 404 : 405, body: { error: "not found or method not allowed", api: AGENT_COMMERCE_API_VERSION } };

  let args;
  try {
    args = JSON.parse(body || "{}");
  } catch {
    return { status: 400, body: { error: "invalid JSON body", api: AGENT_COMMERCE_API_VERSION } };
  }

  try {
    if (path === "/v1/authorize") {
      const consent = await createConsent(args);
      return { status: 200, body: consent };
    }
    if (path === "/v1/verify") {
      const report = await verifyExecution(args.consent, args.trace, { consumedSet: consumed });
      return { status: 200, body: report };
    }
    if (path === "/v1/consent-verify") {
      const verification = await verifyConsent(args.consent);
      return { status: 200, body: verification };
    }
    if (path === "/v1/risk-assess") {
      const report = assessRisk({
        intent: args.intent,
        policy: args.policy,
        trace: args.trace,
        consumed: args.consumed === true,
      });
      return { status: 200, body: report };
    }
    return { status: 404, body: { error: "unknown endpoint", api: AGENT_COMMERCE_API_VERSION } };
  } catch (err) {
    return { status: 400, body: { error: `request refused: ${err?.message ?? String(err)}`, api: AGENT_COMMERCE_API_VERSION } };
  }
}

/**
 * Create the API handler. `allowAddresses` (optional) is an exact socket-
 * address gate checked BEFORE everything else; `limiter` sizes the per-peer
 * token bucket (default 60 requests / 60s, /health exempt).
 */
export function createAgentCommerceApi({ allowAddresses = null, limiter = { windowMs: 60000, max: 60 } } = {}) {
  const check = createLimiter(limiter);
  const consumed = new Set(); // process-local single-use ledger for this instance

  return async function handler(req, res) {
    // Guard 0: exact socket-address gate (identity is the socket, never a header).
    if (allowAddresses && !allowAddresses.includes(req.socket?.remoteAddress ?? "")) {
      sendJson(res, 403, { error: "forbidden", api: AGENT_COMMERCE_API_VERSION });
      return;
    }
    const url = new URL(req.url ?? "/", "http://loopback.invalid");
    const path = url.pathname;
    const isHealth = path === "/health";
    const limit = check(req.socket?.remoteAddress ?? "unknown", isHealth);
    if (!limit.ok) {
      sendJson(res, 429, { error: "rate limited", api: AGENT_COMMERCE_API_VERSION });
      return;
    }
    let body = "";
    if (req.method === "POST") {
      try {
        body = await readBody(req);
      } catch (err) {
        sendJson(res, 413, { error: err?.message ?? "body unreadable", api: AGENT_COMMERCE_API_VERSION });
        return;
      }
    }
    const outcome = await route({ method: req.method, path, body, consumed });
    if (outcome.raw) {
      res.writeHead(outcome.status, { "content-type": "text/plain" });
      res.end(outcome.body);
      return;
    }
    sendJson(res, outcome.status, outcome.body);
  };
}

export function selfCheck() {
  return [
    ["api version pinned", AGENT_COMMERCE_API_VERSION === "AC-API/1"],
    ["body limit is 1 MiB", MAX_BODY_BYTES === 1024 * 1024],
    ["sdk surface bound", AGENT_COMMERCE_VERSION === "AC-SDK/1"],
  ];
}
