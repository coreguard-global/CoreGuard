/**
 * CoreGuard Agent Authorization Firewall (AC-FW/1) — product 1 of the
 * agent-commerce family, as ONE composed face over the repo's existing
 * engines. It builds no fifth engine: it composes
 *
 *   - `packages/policy`          (evaluatePolicy — the committed rules),
 *   - the CGCR/1 consent binding (index.mjs verifyConsent + hashTrace),
 *   - the CGEP/1 execution verdict + AGR/1 taxonomy (via verifyExecution),
 *   - the family's shared trace→policy mapping (policy-context.mjs).
 *
 * Two decision points, one verdict vocabulary:
 *
 *   PRE-EXECUTION  `authorizeRequest` — the request-time interception hook an
 *                  application calls BEFORE submitting an agent order. Judges
 *                  the DECLARED request (declaredTrace): committed policy,
 *                  consent binding (when a consent record is supplied, the
 *                  request must be byte-identical to the approved declared
 *                  bytes), the authorization window (only against a
 *                  caller-pinned `nowSeconds` — the wall clock is never read,
 *                  the C40 rule), and single-use replay state. It NEVER
 *                  consumes a single-use consent: the request has not
 *                  executed yet.
 *
 *   POST-EXECUTION `reviewExecution` — the after-the-fact review of the
 *                  executed order: the full verifyExecution record (CGEP/1
 *                  checks + AGR/1 named classes + driftNamed). A single-use
 *                  consent is consumed here, by its first verified execution.
 *
 * Verdicts: ALLOW | DENY — fail-closed end to end. Any unreadable field the
 * gate decides on is a refusal (MALFORMED_REQUEST), never a guess; any
 * tampered consent byte is a refusal; an empty reasons list is the ONLY path
 * to ALLOW. Same inputs → byte-identical decision (the wall-clock timestamp
 * the underlying verifier attaches to its report is deliberately dropped —
 * never copied into the decision record).
 *
 * BOUNDARY (standing, load-bearing): this firewall REFUSES — it never signs,
 * submits, broadcasts or sends anything, and it never decides delivery
 * conformity (DDE/1). VERIFIED ≠ SAFE; the actor is declared, never detected.
 * Distinct older surfaces it does not replace or absorb: `packages/firewall`
 * (the Phase-D EVM decision core for the signed-intent lane, with its own
 * 16-leg attack lab) and `packages/agent-gate` (the Stellar mandate gate,
 * AGENT-GATE/1). Every order in demos is synthetic.
 */

import { hashTrace, canonicalize } from "@coreguard/canonical";
import { evaluatePolicy } from "@coreguard/policy";
import { verifyConsent, verifyExecution } from "./index.mjs";
import { tracePolicyContext } from "./policy-context.mjs";

export const AC_FIREWALL_VERSION = "AC-FW/1";

/**
 * The named refusal codes. Frozen vocabulary: adding a code is additive; a
 * code may never be renamed (decisions cite the code, not the description).
 */
export const FIREWALL_REJECT_CODES = Object.freeze([
  "MALFORMED_REQUEST",
  "POLICY_REFUSED",
  "CONSENT_MISMATCH",
  "CONSENT_INVALID",
  "WINDOW_CLOSED",
  "SINGLE_USE_CONSUMED",
]);

export const FIREWALL_DECISIONS = Object.freeze(["ALLOW", "DENY"]);

export const FIREWALL_BOUNDARY =
  "the composed authorization firewall refuses — it never signs, submits or broadcasts; " +
  "VERIFIED ≠ SAFE; delivery conformity (DDE/1) is never decided; the actor is declared, never detected";

function reject(code, extra = {}) {
  return { code, ...extra };
}

/** UTC seconds for an ISO expiry string; null when absent/invalid. */
function expirySeconds(isoUtc) {
  if (!isoUtc) return null;
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * The authorization window, enforced only against a caller-pinned
 * `nowSeconds`, with the taxonomy's own semantics (validUntil epoch seconds,
 * expiryUtc ISO, "no declared window" fail-closed). No clock is read here.
 */
function windowReason(intent, nowSeconds) {
  let now = null;
  try {
    now = BigInt(String(nowSeconds));
  } catch {
    return reject("MALFORMED_REQUEST", { field: "nowSeconds", detail: "pinned time unreadable — must be an integer" });
  }
  let until = null;
  try {
    until = BigInt(String(intent.validUntil ?? "0"));
  } catch {
    until = null;
  }
  const expiry = expirySeconds(intent.expiryUtc);
  if (until === null && expiry === null) {
    return reject("MALFORMED_REQUEST", { field: "intent.validUntil", detail: "no authorization window to enforce" });
  }
  if (until !== null && now > until) {
    return reject("WINDOW_CLOSED", {
      field: "nowSeconds",
      expected: `validUntil ${intent.validUntil ?? "0"}`,
      observed: String(now),
    });
  }
  if (expiry !== null && now > expiry) {
    return reject("WINDOW_CLOSED", {
      field: "nowSeconds",
      expected: `expiryUtc ${intent.expiryUtc}`,
      observed: String(now),
    });
  }
  return null;
}

/**
 * PRE-EXECUTION gate: judge the request the agent is about to submit.
 *
 * `declaredTrace` is the exact submit-order payload (the platform's declared
 * execution shape). `policy` carries the committed rules. When `consent` is
 * supplied the gate additionally proves the request IS the approved one: the
 * consent record must verify (every commitment re-derived against its own
 * bytes) and the request's declared bytes — plus any intent/policy the caller
 * claims — must be canonical-equal to the consent's own (an omitted intent or
 * policy defaults to the consent's).
 *
 * `nowSeconds` (optional, caller-pinned) enables the window check — the wall
 * clock is never read. `consumedSet` (optional) injects the consumption
 * ledger consulted for a single-use replay; this gate never ADDS to it.
 */
export async function authorizeRequest({ consent = null, intent = null, policy = null, declaredTrace, nowSeconds = null, consumedSet = null }) {
  const reasons = [];

  if (!declaredTrace || typeof declaredTrace !== "object") {
    return deny([reject("MALFORMED_REQUEST", { field: "declaredTrace", detail: "the declared request payload is required" })], false, null);
  }

  const effectiveIntent = consent ? consent.intent : intent;
  const effectivePolicy = consent ? (policy ?? consent.policy) : policy;

  if (!effectivePolicy || !Array.isArray(effectivePolicy.rules)) {
    return deny([reject("MALFORMED_REQUEST", { field: "policy", detail: "the committed policy is required (rules array)" })], Boolean(consent), null);
  }

  // 1. Consent legs — the request must be the approved one.
  if (consent) {
    if (consent.spec !== "CGCR/1" || !consent.receipt || !consent.declaredTrace) {
      return deny([reject("MALFORMED_REQUEST", { field: "consent", detail: "not a CGCR/1 consent record" })], true, null);
    }
    let integrity = null;
    try {
      integrity = await verifyConsent(consent);
    } catch (err) {
      return deny([reject("CONSENT_INVALID", { field: "consent.receipt", detail: `consent verification refused: ${err?.message ?? err}` })], true, null);
    }
    if (!integrity || integrity.result !== "VERIFIED" || integrity.checks.some((c) => c.result === "FAIL")) {
      return deny([reject("CONSENT_INVALID", { field: "consent.receipt", detail: "the consent record does not re-derive — a tampered byte is a refusal" })], true, null);
    }

    try {
      const requestHash = await hashTrace(declaredTrace);
      const approvedHash = await hashTrace(consent.declaredTrace);
      if (requestHash !== approvedHash) {
        reasons.push(reject("CONSENT_MISMATCH", { field: "declaredTrace", detail: "the request's declared bytes differ from the approved declared bytes" }));
      }
      if (intent !== null && canonicalize(intent) !== canonicalize(consent.intent)) {
        reasons.push(reject("CONSENT_MISMATCH", { field: "intent", detail: "the request claims a different intent than the approved one" }));
      }
      if (policy !== null && canonicalize(policy) !== canonicalize(consent.policy)) {
        reasons.push(reject("CONSENT_MISMATCH", { field: "policy", detail: "the request claims a different policy than the approved one" }));
      }
    } catch (err) {
      return deny(
        [...reasons, reject("MALFORMED_REQUEST", { field: "consent", detail: `the request could not be canonicalized for binding: ${err?.message ?? err}` })],
        true,
        null
      );
    }

    // Single-use replay state at request time — consulted, never consumed.
    const ledger = consent.intent.singleUse ? (consumedSet ?? null) : null;
    if (ledger && consent.receiptId && (await ledger.has(consent.receiptId))) {
      reasons.push(reject("SINGLE_USE_CONSUMED", { field: "consent.receiptId", detail: "this single-use authorization was already consumed by a verified execution" }));
    }
  }

  // 2. Authorization window — only against a caller-pinned time.
  if (effectiveIntent && nowSeconds !== null && nowSeconds !== undefined) {
    const win = windowReason(effectiveIntent, nowSeconds);
    if (win) reasons.push(win);
  }

  // 3. Committed policy rules — always, against the DECLARED request.
  let evaluation = null;
  try {
    evaluation = evaluatePolicy(effectivePolicy, tracePolicyContext(declaredTrace));
  } catch (err) {
    return deny(
      [...reasons, reject("MALFORMED_REQUEST", { field: "declaredTrace", detail: `policy evaluation refused the request as unreadable: ${err?.message ?? err}` })],
      Boolean(consent),
      null
    );
  }
  for (const rule of evaluation.rules.filter((r) => r.result === "FAIL")) {
    reasons.push(reject("POLICY_REFUSED", { field: `policy.${rule.ruleId}`, expected: rule.expected, observed: rule.observed }));
  }

  return deny(reasons, Boolean(consent), {
    policyId: evaluation.policyId,
    policyResult: evaluation.result,
    policyRules: evaluation.rules,
  });
}

function deny(reasons, consentChecked, policySummary) {
  const decision = reasons.length === 0 ? "ALLOW" : "DENY";
  return {
    spec: AC_FIREWALL_VERSION,
    phase: "PRE_EXECUTION",
    decision,
    reasons,
    policy: policySummary,
    consentChecked,
    boundary: FIREWALL_BOUNDARY,
  };
}

/**
 * POST-EXECUTION review: the executed order against the consent — the full
 * CGEP/1 check list, the AGR/1 named classes and the human-readable drift.
 * A single-use consent is consumed by its first verified execution (the
 * family's own semantics; a shared ledger can be injected).
 */
export async function reviewExecution({ consent, trace, consumedSet = null }) {
  if (!consent || !trace) {
    return {
      spec: AC_FIREWALL_VERSION,
      phase: "POST_EXECUTION",
      decision: "DENY",
      reasons: [reject("MALFORMED_REQUEST", { field: consent ? "trace" : "consent", detail: "reviewExecution requires the consent record and the executed trace" })],
      execution: null,
      boundary: FIREWALL_BOUNDARY,
    };
  }
  const execution = await verifyExecution(consent, trace, consumedSet ? { consumedSet } : {});
  return {
    spec: AC_FIREWALL_VERSION,
    phase: "POST_EXECUTION",
    decision: execution.verdict === "VERIFIED" ? "ALLOW" : "DENY",
    reasons:
      execution.verdict === "VERIFIED"
        ? []
        : (execution.risk?.violations ?? []).map((v) => reject(v.code, { field: v.field, expected: v.expected, observed: v.observed, detail: v.detail })),
    execution,
    boundary: FIREWALL_BOUNDARY,
  };
}

/**
 * A bound firewall instance: one consumption ledger shared by both decision
 * points, so an application wires the SAME guard before and after submit.
 */
export function createFirewall({ consumedSet = null } = {}) {
  const ledger = consumedSet ?? new Set();
  return {
    spec: AC_FIREWALL_VERSION,
    ledger,
    authorizeRequest: (req) => authorizeRequest({ ...req, consumedSet: req.consumedSet ?? ledger }),
    reviewExecution: (req) => reviewExecution({ ...req, consumedSet: req.consumedSet ?? ledger }),
  };
}
