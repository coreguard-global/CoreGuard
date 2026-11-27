/**
 * Decision trace for a handover verdict (CG-HANDOVER-TRACE/1).
 *
 * The trace answers the question the verdict alone cannot: did the independent
 * read change what a receiver would do, and which check moved it?
 *
 * Two decisions are recorded, each with its basis:
 *
 *   decision_before  the issuer's summary only: status and receipt_checks as
 *                    published, with no recomputation and no reading of the
 *                    not_checked list. This is the "trust the record" baseline.
 *   decision_after   the same policy applied to the observer's verdict.
 *
 * The receiver here is a published policy, not an independent agent. The trace
 * says so in `receiver` and `limits`; it demonstrates that the decision is a
 * function of the verdict, not that a third party acted on it.
 */

export const TRACE_VERSION = "CG-HANDOVER-TRACE/1";

const successStatuses = new Set(["accepted", "complete", "completed", "success", "verified"]);

/**
 * buildDecisionTrace(verdict, decision, { receiver, baselinePolicy })
 *
 * `verdict` is a CG-HANDOVER/1 verdict, `decision` the receiver policy result
 * for it. Pure: every field comes from those two objects.
 */
export function buildDecisionTrace(verdict, decision, { receiver = "policy-simulation:receiver.mjs", baselinePolicy = "issuer_summary" } = {}) {
  if (!verdict || typeof verdict !== "object") throw new TypeError("buildDecisionTrace requires a verdict");
  if (!decision || typeof decision !== "object") throw new TypeError("buildDecisionTrace requires a decision");

  const claims = verdict.issuerClaims?.receiptChecks ?? null;
  const status = verdict.handover?.status ?? null;
  const checked = Number.isFinite(claims?.checked) ? claims.checked : null;
  const issuerNotChecked = Number.isFinite(claims?.not_checked) ? claims.not_checked : null;

  const before =
    checked !== null && checked > 0 && successStatuses.has(String(status))
      ? {
          decision: "proceed",
          basis:
            `issuer summary only: status=${status}, receipt_checks.checked=${checked}` +
            (issuerNotChecked === null ? "" : `, not_checked=${issuerNotChecked} (listed but not interpreted)`),
        }
      : {
          decision: "request_more_evidence",
          basis: `issuer summary only: no successful check block (status=${status}, checked=${checked ?? "absent"})`,
        };

  const after = { decision: decision.decision, reasons: decision.reasons ?? [] };
  const changed = before.decision !== after.decision;

  return Object.freeze({
    trace_version: TRACE_VERSION,
    handover_id: verdict.handover?.id ?? null,
    verdict_digest: verdict.verdictDigest ?? null,
    verdict_outcome: verdict.outcome ?? null,
    observer: verdict.observer ?? null,
    read_at: verdict.readAt ?? null,
    receiver,
    policy: {
      baseline: baselinePolicy,
      after: decision.policy ?? null,
    },
    decision_before: before,
    decision_after: after,
    changed,
    reason: changed ? after.reasons[0] ?? "decision changed with no named reason" : null,
    action_taken: after.decision,
    simulated: true,
    limits: Object.freeze([
      "the receiver is a published policy, not an independent agent",
      "decision_before reads the issuer summary and does not recompute the record",
      "a changed decision is evidence about this policy, not about a third party's behaviour",
      ...(verdict.notEstablished ?? []),
    ]),
  });
}
