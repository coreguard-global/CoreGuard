/**
 * CoreGuard Outcome Layer (CG-OUT/1) — the words above the reject codes.
 *
 * A reject code describes a record that was PRESENTED and CHECKED. It has no
 * way to say "nobody handed us one", and rendering that silence as a failure
 * is how an opt-in layer dies: every party that never adopted is scored as
 * having failed a verification it never took part in.
 *
 * So this layer sits above the codes and answers a different question — what is
 * a consumer allowed to conclude — with five outcomes and no sixth:
 *
 *   VERIFIED             the record was evaluated and its checks passed
 *   VERIFICATION_FAILED  the record was evaluated and a check failed, named
 *   ABSENT               no record was presented; never a failure of a record
 *   NOT_CHECKED          a layer was presented and not evaluated; claims nothing
 *   UNRESOLVABLE_RECORD  a present, well-formed record whose anchor cannot be
 *                        resolved; not a failure of the record, not an absence
 *
 * Three layers, three answers. A run can be VERIFIED at the record layer,
 * `matched` at the identity layer and `absent` at the anchor layer at once, and
 * the composite outcome names the weakest layer instead of a single PASS/BLOCK
 * hiding the only interesting fact in the run.
 *
 * BOUNDARY (standing, load-bearing):
 *   - ABSENT and NOT_CHECKED NEVER travel as BLOCK. A caller that maps them to
 *     a refusal is reporting a decision it did not make.
 *   - This layer decides nothing about quality, safety or delivery: VERIFIED
 *     means the receipt's own checks passed, never that the result was right.
 *   - It is deterministic and pure: no clock, no network, no keys. The caller
 *     supplies measured facts, not opinions, and nothing here trusts a string
 *     it did not check against a frozen set.
 */

export const OUTCOME_VERSION = "CG-OUT/1";

/** The five outcomes. Adding one is a schema change; none may be renamed. */
export const OUTCOMES = Object.freeze([
  "VERIFIED",
  "VERIFICATION_FAILED",
  "ABSENT",
  "NOT_CHECKED",
  "UNRESOLVABLE_RECORD",
]);

/**
 * The codes this layer owns. They appear ONLY beside their own outcome and are
 * never used as a BLOCK reason: collapsing them into the reject vocabulary is
 * the defect this file exists to prevent.
 */
export const OUTCOME_CODES = Object.freeze({
  ABSENT: "ABSENT",
  NOT_CHECKED: "NOT_CHECKED",
  UNRESOLVABLE_RECORD: "UNRESOLVABLE_RECORD",
});

/**
 * Outcomes that must never be rendered as a refusal, by anybody, anywhere.
 * VERIFIED is on the list for the same reason ABSENT is: a pass is not a
 * refusal either, and a caller that renders it as one is reporting a decision
 * nobody made. Only VERIFICATION_FAILED and UNRESOLVABLE_RECORD may block.
 */
export const NON_BLOCKING_OUTCOMES = Object.freeze(["VERIFIED", "ABSENT", "NOT_CHECKED"]);

/** The only two outcomes that may be presented as a refusal. */
export const BLOCKING_OUTCOMES = Object.freeze(["VERIFICATION_FAILED", "UNRESOLVABLE_RECORD"]);

/** Facts a caller may supply. Anything else is ignored, never inferred. */
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

const layerVerdict = (layer) => {
  if (!isObject(layer)) return { evaluated: false, stated: false };
  return {
    evaluated: layer.evaluated === true,
    stated: true,
    ok: layer.ok === true,
    code: typeof layer.code === "string" ? layer.code : null,
    reason: typeof layer.reason === "string" ? layer.reason : null,
    outcome: typeof layer.outcome === "string" ? layer.outcome : null,
    present: layer.present === true,
    version: typeof layer.version === "string" ? layer.version : null,
  };
};

const result = (outcome, code, reason, layers, detail) => {
  if (!OUTCOMES.includes(outcome)) throw new Error(`unknown outcome: ${outcome}`);
  return Object.freeze({
    outcome,
    code: code ?? null,
    reason,
    layers,
    blocks: BLOCKING_OUTCOMES.includes(outcome),
    outcomeVersion: OUTCOME_VERSION,
    detail: detail ?? null,
  });
};

/**
 * decideOutcome({ presented, record, anchor })
 *
 *   presented  true only if a record was actually handed to the verifier
 *   record     { evaluated, ok, code?, reason?, version? }
 *   anchor     { present, evaluated, outcome? } where outcome is one of
 *              "verified" | "absent" | "not_checked" | "unresolvable"
 *
 * Precedence is deliberate and documented, because the order IS the policy:
 *   1. absent            — nothing was presented
 *   2. not checked       — the record layer never evaluated it
 *   3. failed            — the record layer evaluated it and a check failed
 *   4. not checked       — the record is fine but the anchor layer never ran
 *   5. unresolvable      — the anchor layer ran and could not resolve
 *   6. verified
 */
export function decideOutcome({ presented, record, anchor } = {}) {
  const recordLayer = layerVerdict(record);
  const anchorLayer = layerVerdict(anchor);
  const layers = Object.freeze({
    record: recordLayer.stated
      ? { evaluated: recordLayer.evaluated, ok: recordLayer.evaluated && recordLayer.ok, code: recordLayer.code }
      : { evaluated: false, ok: null, code: null },
    anchor: {
      present: anchorLayer.present,
      evaluated: anchorLayer.evaluated,
      outcome: anchorLayer.outcome,
    },
  });

  if (presented !== true) {
    return result(
      "ABSENT",
      OUTCOME_CODES.ABSENT,
      "no record was presented — silence is not a failed verification",
      layers,
    );
  }

  if (!recordLayer.evaluated) {
    // A caller that knows WHY a layer was skipped says so; otherwise the layer
    // names the version it did not implement, and only then falls back to the
    // generic sentence. The reason is never dropped on the floor: "not checked"
    // without a why is the vague answer this layer exists to replace.
    const why = recordLayer.version
      ? `the record layer did not evaluate version ${recordLayer.version}`
      : recordLayer.reason
        ? recordLayer.reason
        : "the record layer was not evaluated";
    return result("NOT_CHECKED", OUTCOME_CODES.NOT_CHECKED, why, layers, {
      version: recordLayer.version,
    });
  }

  if (!recordLayer.ok) {
    return result(
      "VERIFICATION_FAILED",
      recordLayer.code ?? "VERIFIER_ERROR",
      recordLayer.reason ?? "a record-layer check failed",
      layers,
    );
  }

  if (anchorLayer.present && !anchorLayer.evaluated) {
    return result(
      "NOT_CHECKED",
      OUTCOME_CODES.NOT_CHECKED,
      "the anchor layer was present and deliberately not evaluated",
      layers,
    );
  }

  if (anchorLayer.evaluated && anchorLayer.outcome === "unresolvable") {
    return result(
      "UNRESOLVABLE_RECORD",
      OUTCOME_CODES.UNRESOLVABLE_RECORD,
      "the record is well formed and its anchor cannot be resolved",
      layers,
    );
  }

  return result("VERIFIED", null, "the record layer evaluated the record and it passed", layers);
}

/**
 * A caller-side guard for the one mistake that would quietly break opt-in:
 * turning an absence into a refusal. Returns the outcome unchanged when it is
 * safe to render, and throws when a non-blocking outcome is about to be
 * presented as a block.
 */
export function assertNotRenderedAsBlock(outcome) {
  if (!OUTCOMES.includes(outcome)) throw new Error(`unknown outcome: ${outcome}`);
  if (NON_BLOCKING_OUTCOMES.includes(outcome)) {
    throw new Error(`${outcome} must never travel as BLOCK — it is not a decision`);
  }
  return outcome;
}

/** Self-check: the layer's own invariants, for callers that cannot run tests. */
export function selfCheck() {
  const absent = decideOutcome({ presented: false });
  const unchecked = decideOutcome({ presented: true, record: { evaluated: false } });
  const failed = decideOutcome({
    presented: true,
    record: { evaluated: true, ok: false, code: "BAD_DIGEST" },
  });
  const verified = decideOutcome({ presented: true, record: { evaluated: true, ok: true } });
  const checks = [
    { name: "absent is ABSENT", pass: absent.outcome === "ABSENT" },
    { name: "absent never blocks", pass: absent.blocks === false },
    { name: "unevaluated is NOT_CHECKED", pass: unchecked.outcome === "NOT_CHECKED" },
    { name: "unevaluated never blocks", pass: unchecked.blocks === false },
    { name: "failed keeps its code", pass: failed.outcome === "VERIFICATION_FAILED" && failed.code === "BAD_DIGEST" },
    { name: "failed blocks", pass: failed.blocks === true },
    { name: "verified is VERIFIED", pass: verified.outcome === "VERIFIED" },
    { name: "every outcome reachable", pass: new Set([absent, unchecked, failed, verified].map((r) => r.outcome)).size >= 4 },
  ];
  return Object.freeze({
    outcomeVersion: OUTCOME_VERSION,
    outcomes: OUTCOMES,
    checks,
    ok: checks.every((c) => c.pass),
  });
}
