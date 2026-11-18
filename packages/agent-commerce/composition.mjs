/**
 * CoreGuard Composition Policy (CG-COMPOSE/1) — one rule, two defensible answers.
 *
 * The record layer and the anchor layer answer different questions, and a
 * consumer sometimes needs them merged and sometimes needs them apart. AER-1
 * keeps them apart; our default merges them. Neither is a disagreement about
 * the receipt, and pretending one of them is wrong costs a review round every
 * time the topic comes up. So the choice is a value, not an argument:
 *
 *   mode: "composed"  the anchor outcome participates in the headline. A
 *                     well-formed record whose anchor cannot be resolved reads
 *                     UNRESOLVABLE_RECORD and may be presented as a refusal.
 *                     Best for a commerce consumer that needs ONE answer now.
 *
 *   mode: "layered"   the record outcome never moves. The anchor layer reports
 *                     its own fact, including `rejected: "unresolvable record"`,
 *                     and the headline describes the record alone. Best for a
 *                     record that must outlive any single anchor.
 *
 * The property worth writing down, because it is the whole difference:
 *
 *   In "layered" mode, a second anchor that resolves LATER changes the anchor
 *   block and never the record outcome. In "composed" mode, the same event
 *   legitimately flips the headline — the composed answer was about the pair,
 *   not about the bytes.
 *
 * BOUNDARY (standing, load-bearing):
 *   - Neither mode may turn ABSENT into a refusal. Silence is not a failure in
 *     both, and that invariant is asserted rather than described.
 *   - Composition never upgrades a record: a failed record layer stays failed
 *     in both modes. The anchor layer can only make the pair weaker, never the
 *     record stronger.
 *   - No clock, no network, no keys. Facts in, decision out.
 */

import { decideOutcome, OUTCOMES } from "./outcomes.mjs";

export const COMPOSITION_VERSION = "CG-COMPOSE/1";

/** The two policies. Adding a third is a schema change, not a preference. */
export const COMPOSITION_MODES = Object.freeze(["composed", "layered"]);

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * composeOutcome({ presented, record, anchor, mode })
 *
 *   presented  true only if a record was actually handed over
 *   record     { evaluated, ok, code?, reason?, version? }
 *   anchor     { present, evaluated, outcome? } in CG-OUT/1's vocabulary
 *   mode       "composed" (default) | "layered"
 */
export function composeOutcome({ presented, record, anchor, mode = "composed" } = {}) {
  if (!COMPOSITION_MODES.includes(mode)) {
    throw new Error(`unknown composition mode: ${JSON.stringify(mode)} (use one of ${COMPOSITION_MODES.join(", ")})`);
  }

  if (mode === "composed") {
    const composed = decideOutcome({ presented, record, anchor });
    return Object.freeze({
      compositionVersion: COMPOSITION_VERSION,
      mode,
      headline: composed.outcome,
      record: Object.freeze({ outcome: recordHeadline({ presented, record }), moved: false }),
      anchor: anchorBlock(anchor),
      blocks: composed.blocks,
      resolutionSensitive: anchorContributed(anchor, composed.outcome),
      code: composed.code,
      reason: composed.reason,
      layers: composed.layers,
    });
  }

  // Layered: the headline is the record's own answer, computed without the
  // anchor facts at all. That is what makes it stable under later resolution.
  const recordOnly = decideOutcome({ presented, record });
  const anchorFacts = anchorBlock(anchor);
  return Object.freeze({
    compositionVersion: COMPOSITION_VERSION,
    mode,
    headline: recordOnly.outcome,
    record: Object.freeze({ outcome: recordOnly.outcome, moved: false }),
    anchor: Object.freeze({ ...anchorFacts, rejected: anchorFacts.outcome === "unresolvable" ? "unresolvable record" : null }),
    blocks: recordOnly.blocks,
    resolutionSensitive: false,
    code: recordOnly.code,
    reason: recordOnly.reason,
    layers: Object.freeze({
      record: recordOnly.layers.record,
      anchor: Object.freeze({ present: anchorFacts.present, evaluated: anchorFacts.evaluated, outcome: anchorFacts.outcome }),
    }),
  });
}

function recordHeadline({ presented, record }) {
  return decideOutcome({ presented, record }).outcome;
}

function anchorBlock(anchor) {
  const stated = isObject(anchor);
  const outcome = stated && typeof anchor.outcome === "string" ? anchor.outcome : "not_checked";
  return Object.freeze({
    present: stated ? anchor.present === true : false,
    evaluated: stated ? anchor.evaluated === true : false,
    outcome,
    rejected: outcome === "unresolvable" ? "unresolvable record" : null,
  });
}

function anchorContributed(anchor, headline) {
  return isObject(anchor) && anchor.evaluated === true && anchor.outcome === "unresolvable" && headline === "UNRESOLVABLE_RECORD";
}

/** A picture of the two modes over the same facts — used by the CLI and docs. */
export function compareModes(input) {
  const composed = composeOutcome({ ...input, mode: "composed" });
  const layered = composeOutcome({ ...input, mode: "layered" });
  return Object.freeze({
    compositionVersion: COMPOSITION_VERSION,
    composed,
    layered,
    diverges: composed.headline !== layered.headline,
    recordStable: composed.record.outcome === layered.record.outcome,
  });
}

/** Self-check: the policy's own invariants, for callers that cannot run tests. */
export function selfCheck() {
  const ok = { evaluated: true, ok: true };
  const facts = { presented: true, record: ok };
  const unresolvable = { present: true, evaluated: true, outcome: "unresolvable" };
  const resolved = { present: true, evaluated: true, outcome: "verified" };

  const c1 = compareModes({ ...facts, anchor: unresolvable });
  const c2 = compareModes({ ...facts, anchor: resolved });
  const silence = compareModes({ presented: false, anchor: unresolvable });
  const failedRecord = compareModes({ presented: true, record: { evaluated: true, ok: false }, anchor: resolved });

  const checks = [
    { name: "the modes diverge only when the anchor is unresolvable", pass: c1.diverges === true && c2.diverges === false },
    { name: "the record outcome is identical in both modes", pass: c1.recordStable && c2.recordStable },
    { name: "composed mode blocks on an unresolvable anchor", pass: c1.composed.blocks === true },
    { name: "layered mode never blocks on an unresolvable anchor", pass: c1.layered.blocks === false },
    { name: "layered mode carries the rejection on the anchor layer", pass: c1.layered.anchor.rejected === "unresolvable record" },
    { name: "silence is not a refusal in either mode", pass: silence.composed.headline === "ABSENT" && silence.layered.headline === "ABSENT" && !silence.layered.blocks },
    { name: "a failed record stays failed in both modes", pass: failedRecord.composed.headline === "VERIFICATION_FAILED" && failedRecord.layered.headline === "VERIFICATION_FAILED" },
    { name: "every headline is one of the five outcomes", pass: OUTCOMES.includes(c1.composed.headline) && OUTCOMES.includes(c1.layered.headline) },
  ];
  return Object.freeze({ ok: checks.every((c) => c.pass), checks });
}
