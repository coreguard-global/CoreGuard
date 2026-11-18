/**
 * CoreGuard Payment Decision (CG-DECIDE/1) — the gap between an outcome and an
 * authorisation, written down so nobody has to guess it at 3am.
 *
 * A verifier produces outcomes. A payment system produces authorisations. The
 * mapping between them is a POLICY, and most integrations get it wrong in one of
 * two directions:
 *
 *   false decline   treating `ABSENT` or `NOT_CHECKED` as a failure. The merchant
 *                   that never adopted receipts suddenly loses every sale, which
 *                   is how an opt-in layer acquires an enemy.
 *   false trust     treating `ABSENT` or `NOT_CHECKED` as a pass, because the
 *                   authorisation flow only understands allow/deny. The missing
 *                   evidence disappears into a green result and nobody can tell
 *                   afterwards that nothing was checked.
 *
 * So there are four decisions, not two, and each one carries what it is based on:
 *
 *   ALLOW             evidence was presented and passed
 *   ALLOW_UNVERIFIED  the sale may proceed, and the record says `unverified:
 *                     true` so a risk engine, an auditor or a disputes team can
 *                     see that no evidence was checked
 *   HOLD              do not ship, do not capture; retry resolution or escalate
 *   DECLINE           evidence was presented and failed
 *
 * The rule that makes the table safe is one line: only `VERIFICATION_FAILED` can
 * DECLINE. Everything else that is not a pass is either a hold with a named
 * reason or an allow that is loudly unmarked-green.
 *
 * BOUNDARY (standing, load-bearing):
 *   - This module decides nothing about fraud, credit or delivery. It maps an
 *     evidence outcome to an authorisation posture, and it refuses to invent
 *     evidence that was not presented.
 *   - `ALLOW` never means "safe". It means the receipt's own checks passed.
 *   - No clock, no network, no keys: the caller supplies the outcome and the
 *     policy, and the table is deterministic so it can be replayed in a dispute.
 */

export const DECISION_VERSION = "CG-DECIDE/1";
export const DECISION_SCHEMA = "coreguard.decision/1";

export const DECISIONS = Object.freeze(["ALLOW", "ALLOW_UNVERIFIED", "HOLD", "DECLINE"]);
export const POLICIES = Object.freeze(["strict", "balanced", "availability"]);

/** Outcome → policy → decision. The only table in this module, on purpose. */
const TABLE = Object.freeze({
  VERIFIED: Object.freeze({ strict: "ALLOW", balanced: "ALLOW", availability: "ALLOW" }),
  VERIFICATION_FAILED: Object.freeze({ strict: "DECLINE", balanced: "DECLINE", availability: "DECLINE" }),
  UNRESOLVABLE_RECORD: Object.freeze({ strict: "HOLD", balanced: "HOLD", availability: "ALLOW_UNVERIFIED" }),
  ABSENT: Object.freeze({ strict: "ALLOW_UNVERIFIED", balanced: "ALLOW_UNVERIFIED", availability: "ALLOW_UNVERIFIED" }),
  NOT_CHECKED: Object.freeze({ strict: "ALLOW_UNVERIFIED", balanced: "ALLOW_UNVERIFIED", availability: "ALLOW_UNVERIFIED" }),
});

const CODES = Object.freeze({
  DECLINE: "EVIDENCE_FAILED",
  HOLD: "RESOLUTION_INCOMPLETE",
  ALLOW_UNVERIFIED: "NO_EVIDENCE_CHECKED",
});

const REASONS = Object.freeze({
  VERIFIED: "every presented check passed",
  VERIFICATION_FAILED: "a presented record failed a named check",
  UNRESOLVABLE_RECORD: "a record was presented and could not be resolved",
  ABSENT: "no record was presented",
  NOT_CHECKED: "a record was presented and this verifier has no opinion",
});

/**
 * decidePayment({ outcome, policy })
 *
 *   outcome  one of CG-OUT/1's five. Anything else is a caller defect and
 *            throws, because silently mapping an unknown word to ALLOW is the
 *            false-trust failure this file exists to prevent.
 *   policy   "strict" | "balanced" | "availability" (default "balanced")
 */
export function decidePayment({ outcome, policy = "balanced" } = {}) {
  const row = TABLE[outcome];
  if (!row) throw new TypeError(`unknown outcome: ${String(outcome)} — CG-DECIDE/1 has no decision for it`);
  if (!POLICIES.includes(policy)) throw new TypeError(`unknown policy: ${String(policy)}`);
  const decision = row[policy];
  const unverified = decision === "ALLOW_UNVERIFIED";
  const blocks = decision === "DECLINE" || decision === "HOLD";
  return Object.freeze({
    decisionVersion: DECISION_VERSION,
    schema: DECISION_SCHEMA,
    decision,
    outcome,
    policy,
    code: CODES[decision] ?? null,
    reason: REASONS[outcome] ?? null,
    unverified,
    verified: decision === "ALLOW",
    blocks,
    captureAllowed: decision === "ALLOW" || decision === "ALLOW_UNVERIFIED",
    retry: decision === "HOLD",
    explain: explainDecision({ decision, outcome, policy }),
  });
}

/** One sentence a support agent can paste into a ticket without translating a code. */
export function explainDecision({ decision, outcome, policy }) {
  const base = {
    ALLOW: "Approved: the presented receipt passed its checks.",
    ALLOW_UNVERIFIED: "Approved without verification: no evidence was checked, and the record says so.",
    HOLD: "Held: evidence was presented but could not be resolved; retry or escalate before capture.",
    DECLINE: "Declined: a presented receipt failed a named check.",
  }[decision];
  return `${base} (outcome ${outcome}, policy ${policy})`;
}

/**
 * The negative controls, exported so an integrator can test against them rather
 * than against prose: every cell, plus the invariants that make the table safe.
 */
export function decisionMatrix() {
  const rows = [];
  for (const outcome of Object.keys(TABLE)) {
    for (const policy of POLICIES) rows.push(decidePayment({ outcome, policy }));
  }
  return Object.freeze(rows);
}

/** Invariants a conforming mapper must satisfy. Used by the tests and by partners. */
export function assertDecisionInvariants() {
  const rows = decisionMatrix();
  const violations = [];
  for (const r of rows) {
    if (r.decision === "DECLINE" && r.outcome !== "VERIFICATION_FAILED") {
      violations.push(`DECLINE from ${r.outcome}/${r.policy} — only a failed check may decline`);
    }
    if (r.decision === "ALLOW_UNVERIFIED" && r.unverified !== true) {
      violations.push(`${r.outcome}/${r.policy} allows unverified without the flag`);
    }
    if (r.decision === "DECLINE" && !r.code) violations.push(`DECLINE from ${r.outcome} carries no code`);
    if (r.decision === "ALLOW" && r.outcome !== "VERIFIED") {
      violations.push(`ALLOW from ${r.outcome} — a pass must come from a pass`);
    }
  }
  return Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations), rows: rows.length });
}

export function selfCheck() {
  const checks = [];
  const inv = assertDecisionInvariants();
  checks.push({ name: "the table has no false decline", pass: !inv.violations.some((v) => v.startsWith("DECLINE from")) });
  checks.push({ name: "the table has no false trust", pass: !inv.violations.some((v) => v.startsWith("ALLOW from")) });
  checks.push({ name: "every unverified allow is flagged", pass: !inv.violations.some((v) => v.includes("without the flag")) });
  checks.push({ name: "15 cells, all decided", pass: inv.rows === 15 });
  checks.push({ name: "absent never declines, even under strict", pass: decidePayment({ outcome: "ABSENT", policy: "strict" }).decision !== "DECLINE" });
  checks.push({ name: "unknown outcome throws instead of allowing", pass: (() => { try { decidePayment({ outcome: "PROBABLY_FINE" }); return false; } catch { return true; } })() });
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
