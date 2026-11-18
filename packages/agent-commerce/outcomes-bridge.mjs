/**
 * CG-OUT/1 bridges — the outcome layer as the surfaces actually print it.
 *
 * An outcome vocabulary that only exists in a library is a vocabulary nobody
 * reads. This file is the seam between the layer (`outcomes.mjs`) and the three
 * places a human or a machine meets it: the `verify-run` CLI, the PSAR/1
 * pre-sign verifier, and the AGR/1 risk taxonomy.
 *
 * The seam exists because those three surfaces already have their own words,
 * and the words are not wrong — they answer narrower questions:
 *
 *   verify-run   VERIFIED / INVALID / UNVERIFIED / INCONCLUSIVE + exit code
 *   PSAR/1       PASS / BLOCK + a named reject code
 *   AGR/1        CLEAN / VIOLATIONS over authorization drift
 *
 * What none of them can say is "nobody handed us a record". The mapping below
 * adds exactly that, without changing any existing field, exit code or verdict:
 * every surface keeps the words its consumers already parse and gains one
 * `outcome` field that says what a reader is allowed to conclude.
 *
 * The mapping rules, deliberately few:
 *
 *   no record at all                    -> ABSENT
 *   evaluated and passed                -> VERIFIED
 *   evaluated and a check failed        -> VERIFICATION_FAILED (code kept)
 *   presented, never evaluated          -> NOT_CHECKED (reason named)
 *   present, anchor unresolvable        -> UNRESOLVABLE_RECORD
 *   a verdict this build does not know  -> VERIFICATION_FAILED / VERIFIER_ERROR
 *
 * That last line is the fail-closed edge: an unrecognised verdict string from
 * somebody's report is never allowed to become a pass.
 *
 * One deliberate asymmetry, stated here so nobody discovers it in production:
 * `verify-run` reports UNVERIFIED when required evidence is missing and
 * INCONCLUSIVE when a level has no runtime pathway. Both are real exit codes
 * and both stay exactly as they are. As outcomes, both are NOT_CHECKED — the
 * run did not reach a judgement, and rendering a missing binding as a failed
 * verification is the defect this layer exists to prevent. A consumer that
 * should refuse either way still refuses: refusal is its policy, and `blocks`
 * is not a permission slip.
 */

import { decideOutcome, OUTCOME_CODES } from "./outcomes.mjs";
import { PROFILE_ID, makeProfileReference } from "./profile-ref.mjs";

export const BRIDGE_VERSION = "CG-OUT-BRIDGE/1";

const VERDICTS_KNOWN = Object.freeze(["VERIFIED", "INVALID", "UNVERIFIED", "INCONCLUSIVE"]);

/**
 * Outcome for a `runVerification` report (the verify-run surface).
 * Returns the CG-OUT/1 result object, or an ABSENT result when no report was
 * produced at all.
 */
export function outcomeForVerificationReport(report) {
  if (!report || typeof report !== "object" || !report.verdict || typeof report.verdict !== "object") {
    return decideOutcome({ presented: false });
  }
  const { verdict, code, reason, requiredMissing } = report.verdict;
  const presented = report.observed?.present ?? {};
  const anyPresent = ["evidence", "intent", "policy", "trace"].some((k) => presented[k] === true);
  if (!anyPresent && !report.observed?.receiptId) {
    return decideOutcome({ presented: false });
  }

  if (!VERDICTS_KNOWN.includes(verdict)) {
    return decideOutcome({
      presented: true,
      record: { evaluated: true, ok: false, code: "VERIFIER_ERROR", reason: `unknown verdict: ${JSON.stringify(verdict)}` },
    });
  }

  if (verdict === "VERIFIED") {
    return decideOutcome({ presented: true, record: { evaluated: true, ok: true } });
  }

  if (verdict === "INVALID") {
    return decideOutcome({
      presented: true,
      record: { evaluated: true, ok: false, code: code ?? "VERIFIER_ERROR", reason: reason ?? null },
    });
  }

  // UNVERIFIED and INCONCLUSIVE: presented and deliberately not judged.
  const why = Array.isArray(requiredMissing) && requiredMissing.length
    ? `required bindings not present: ${requiredMissing.join(", ")}`
    : reason ?? "the verifier did not reach a judgement for this record";
  return decideOutcome({ presented: true, record: { evaluated: false, reason: why } });
}

/**
 * Outcome for a PSAR/1 `verifyAuthorizationReceipt` result.
 *
 *   result        the verifier's own { decision, code, ... }
 *   receipt       optional, only to read the version a receipt claims
 *
 * A receipt claiming a version this build does not implement is NOT_CHECKED
 * with the version named, even though PSAR/1's own `decision` stays BLOCK: the
 * decision is what this build does under its fail-closed policy, the outcome is
 * what a reader may conclude. They differ here, and the difference is the point.
 */
export function outcomeForPsarResult(result, { receipt } = {}) {
  if (!result || typeof result !== "object") return decideOutcome({ presented: false });
  const claimed = receipt && typeof receipt === "object" && typeof receipt.v === "string" ? receipt.v : null;
  if (claimed && claimed !== "PSAR/1") {
    return decideOutcome({ presented: true, record: { evaluated: false, version: claimed } });
  }
  if (result.decision === "PASS") {
    return decideOutcome({ presented: true, record: { evaluated: true, ok: true } });
  }
  if (result.decision === "BLOCK") {
    const code = typeof result.code === "string" ? result.code : "VERIFIER_ERROR";
    return decideOutcome({
      presented: true,
      record: { evaluated: true, ok: false, code, reason: Array.isArray(result.reasons) ? result.reasons[0] ?? null : null },
    });
  }
  return decideOutcome({
    presented: true,
    record: {
      evaluated: true,
      ok: false,
      code: "VERIFIER_ERROR",
      reason: `unknown decision: ${JSON.stringify(result.decision)}`,
    },
  });
}

/**
 * What an authorization-dependent system may DO with an outcome.
 *
 * This is the function that turns a vocabulary into behaviour, and the two
 * lines that matter are the first two: an absent record and a record nobody
 * evaluated both yield `NONE`, never `PASS` and never `BLOCK`. A risk engine
 * that treats "no receipt" as "no objection" is the failure this prevents, and
 * so is one that treats it as an objection: both are decisions the facts do not
 * support.
 *
 *   VERIFIED                                  -> PASS
 *   VERIFICATION_FAILED / UNRESOLVABLE_RECORD -> BLOCK
 *   ABSENT / NOT_CHECKED                      -> NONE (no decision, ever)
 */
export function authorizationDecision(outcome) {
  const name = outcome && typeof outcome === "object" ? outcome.outcome : outcome;
  if (name === "VERIFIED") return Object.freeze({ decision: "PASS", reason: null });
  if (name === "VERIFICATION_FAILED") {
    return Object.freeze({ decision: "BLOCK", reason: outcome?.code ?? "VERIFICATION_FAILED" });
  }
  if (name === "UNRESOLVABLE_RECORD") {
    return Object.freeze({ decision: "BLOCK", reason: OUTCOME_CODES.UNRESOLVABLE_RECORD });
  }
  if (name === "ABSENT") {
    return Object.freeze({ decision: "NONE", reason: "no record was presented — nothing to decide on" });
  }
  if (name === "NOT_CHECKED") {
    return Object.freeze({ decision: "NONE", reason: "the record was presented and evaluated by nobody" });
  }
  return Object.freeze({ decision: "BLOCK", reason: "VERIFIER_ERROR: unknown outcome" });
}

/**
 * The pointer a protocol would carry alongside a receipt: which receipt, which
 * profile, which version. Nothing about the verdict travels with it.
 */
export function profileReferenceFor(receiptId) {
  return makeProfileReference({ receiptId });
}

export { PROFILE_ID };
