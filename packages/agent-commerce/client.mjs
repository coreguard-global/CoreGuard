/**
 * CoreGuard Agent Commerce Verification API client (AC-API/1) — REST wrapper.
 *
 * The HTTP face of the Agent Commerce SDK: a fetch-shaped client over the
 * committed `createAgentCommerceApi` handler surface. Every call is honest
 * about what it proves:
 *  - health()        -> liveness only (the server still applies the allowlist).
 *  - authorize()     -> POST /v1/authorize  -> a CGCR/1 consent record.
 *  - verify()        -> POST /v1/verify     -> fail-closed execution verdict + AGR/1 drift.
 *  - consentVerify() -> POST /v1/consent-verify -> the record's own integrity.
 *  - riskAssess()   -> POST /v1/risk-assess -> deterministic AGR/1 drift report.
 *
 * BOUNDARY (standing): a client is a transport, never a trust root — the
 * verdicts are still the engine's; VERIFIED ≠ SAFE; single-use consumption is
 * tracked by the caller-supplied ledger (default: the client's own), while the
 * authoritative replay refusal remains the engine's. The client never decides
 * delivery conformity (DDE/1); no commerce platform or payment network is
 * contacted or implied.
 */

import { AGENT_COMMERCE_API_VERSION } from "./http.mjs";
import { AGR_VERSION } from "./risk.mjs";

const REPLAY_BOUNDARY =
  "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE";

/**
 * Fetch-shaped client over the committed AC-API/1 handler.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl="http://127.0.0.1:8787"] - base URL of the AC-API/1 surface.
 * @param {Function} [options.fetchImpl] - injectable transport (tests inject fakes; default: global fetch).
 * @param {Set<string>} [options.consumedSet] - caller ledger for single-use consumption (default: client-owned).
 * @returns {{
 *   health: () => Promise<{status: number; ok: boolean; body: unknown}>,
 *   authorize: (input: object) => Promise<unknown>,
 *   verify: (input: {consent?: unknown; trace?: unknown}) => Promise<unknown>,
 *   consentVerify: (input: {consent?: unknown}) => Promise<unknown>,
 *   riskAssess: (input: {intent?: unknown; policy?: unknown; trace?: unknown; consumed?: boolean}) => Promise<unknown>,
 * }}
 */
export function createAgentCommerceClient({ baseUrl, fetchImpl, consumedSet } = {}) {
  const ledger = consumedSet ?? new Set();
  const doFetch = fetchImpl ?? fetch;
  const base = String(baseUrl ?? "http://127.0.0.1:8787").replace(/\/+$/, "");

  async function parse(res, method, path) {
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(
        `CoreGuard Agent Commerce API ${AGENT_COMMERCE_API_VERSION} ${method} ${path} refused: ${res.status} ${json?.error ?? "request failed"}`
      );
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async function health() {
    const res = await doFetch(base + "/health", { method: "GET" });
    const text = await res.text();
    let ok = res.ok;
    if (ok) {
      try {
        const json = JSON.parse(text);
        ok = json === "OK";
      } catch {
        ok = text === "OK";
      }
    }
    if (!ok) {
      const err = new Error(`CoreGuard Agent Commerce API ${AGENT_COMMERCE_API_VERSION} GET /health refused: ${res.status} ${text}`);
      err.status = res.status;
      throw err;
    }
    return { status: res.status, ok, body: text };
  }

  async function authorize(input) {
    const payload = input ?? {};
    const json = await parse(
      await doFetch(base + "/v1/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
      "POST",
      "/v1/authorize"
    );
    return json;
  }

  async function verify(input) {
    const { consent, trace } = input ?? {};
    if (consent?.receiptId && ledger.has(String(consent.receiptId))) {
      // Client-side single-use mirror of the engine's authoritative replay refusal.
      return {
        spec: "AC-SDK/1",
        verdict: "INVALID",
        checks: [],
        risk: {
          spec: AGR_VERSION,
          classification: "VIOLATIONS",
          violations: [
            {
              code: "SINGLE_USE_REUSE",
              severity: "HIGH",
              field: "consent.singleUse",
              detail: "this single-use authorization was already consumed by a verified execution",
            },
          ],
          boundary: REPLAY_BOUNDARY,
        },
        driftNamed: [],
        consumed: true,
        consumedLedger: String(consent.receiptId),
        boundary: REPLAY_BOUNDARY,
      };
    }
    const report = await parse(
      await doFetch(base + "/v1/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent, trace }) }),
      "POST",
      "/v1/verify"
    );
    if (report?.verdict === "VERIFIED" && consent?.receiptId) ledger.add(String(consent.receiptId));
    return report;
  }

  async function consentVerify(input) {
    const { consent } = input ?? {};
    const json = await parse(
      await doFetch(base + "/v1/consent-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent }) }),
      "POST",
      "/v1/consent-verify"
    );
    return json;
  }

  async function riskAssess(input) {
    const { intent, policy, trace, consumed } = input ?? {};
    const json = await parse(
      await doFetch(base + "/v1/risk-assess", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent, policy, trace, consumed: consumed === true }) }),
      "POST",
      "/v1/risk-assess"
    );
    return json;
  }

  return { health, authorize, verify, consentVerify, riskAssess };
}
