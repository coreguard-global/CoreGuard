/**
 * A receiving agent's policy over a CG-HANDOVER/1 verdict.
 *
 * This is deliberately small and inspectable: the point is not to simulate
 * reasoning, it is to show that the decision is a function of the verdict, so a
 * reader can re-run the same policy on the same report and get the same answer.
 *
 * Decisions:
 *   proceed   every receipt this policy requires is `verified`
 *   hold      the record verifies, but a required step is declared not checked
 *   reject    the record failed an integrity check
 *   request_more_evidence  the observer could not reach a conclusion
 */

export const RECEIVER_VERSION = "CG-HANDOVER-RECEIVER/1";

export const DEFAULT_POLICY = Object.freeze({
  requireWorkflowReceipt: true,
  requireAllStepsSuccessful: true,
  requireMerkle: true,
});

export function decide(verdict, policy = {}) {
  const p = { ...DEFAULT_POLICY, ...policy };
  const reasons = [];

  if (!verdict || typeof verdict !== "object") {
    return decision("request_more_evidence", ["no verdict was supplied"], p);
  }
  if (verdict.outcome === "unavailable") {
    return decision("request_more_evidence", ["the observer could not read the record"], p);
  }
  if (verdict.outcome === "unsupported" || verdict.outcome === "not_checked") {
    return decision("request_more_evidence", [`observer outcome: ${verdict.outcome}`], p);
  }
  if (verdict.outcome !== "verified") {
    reasons.push(`record outcome: ${verdict.outcome}`);
    for (const c of verdict.checks || []) {
      if (!c.ok) reasons.push(`failed check: ${c.id}`);
    }
    return decision("reject", reasons, p);
  }

  if (p.requireMerkle && !verdict.merkle?.ok) reasons.push("the workflow Merkle root did not recompute");
  if (p.requireWorkflowReceipt && verdict.workflowReceipt?.outcome !== "verified") {
    reasons.push("the workflow-close receipt did not verify");
  }
  const failed = (verdict.steps || []).filter((s) => s.outcome === "verification_failed");
  for (const s of failed) reasons.push(`step ${s.index} (${s.receiptId}) failed its receipt check`);
  if (reasons.length > 0) return decision("reject", reasons, p);

  const unchecked = (verdict.steps || []).filter((s) => s.outcome === "not_checked");
  if (p.requireAllStepsSuccessful) {
    for (const s of unchecked) reasons.push(`step ${s.index} (${s.receiptId}) did not complete: ${s.status}`);
  }
  for (const n of (verdict.notChecked || []).filter((n) => n.reason !== "outside_scope")) {
    reasons.push(`${n.scope}: ${n.detail}`);
  }
  if (reasons.length > 0) return decision("hold", reasons, p);

  return decision("proceed", ["every receipt and every operation this policy requires verified"], p);
}

function decision(decision, reasons, policy) {
  return Object.freeze({
    receiverVersion: RECEIVER_VERSION,
    decision,
    reasons: Object.freeze(reasons),
    policy,
    // A receiver may proceed on a verified record while still carrying the
    // observer's honest limits into its own log.
    carries: Object.freeze(["outcome", "verdictDigest", "notEstablished"]),
  });
}
