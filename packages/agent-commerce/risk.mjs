/**
 * CoreGuard Agent Risk Engine (AGR/1)
 *
 * Deterministic authorization-drift taxonomy for agent commerce. Given the
 * approved intent + policy and the executed order payload, classifies every
 * deviation by a named class, a severity, and the exact field that drifted.
 *
 * BOUNDARY (standing, load-bearing): this is a deterministic RULE taxonomy —
 * it is NEVER a probabilistic fraud score, never a risk "rating", and never a
 * substitute for a payment network's fraud systems. It answers exactly one
 * question: "did the executed order drift from what was authorized, and
 * where?" VERIFIED ≠ SAFE.
 *
 * Every comparison is canonical and deterministic; nothing here reads the
 * wall clock (expiry is measured against the trace's own blockTimestamp, so
 * two assessments of the same inputs are byte-identical).
 */

import { evaluatePolicy } from "@coreguard/policy";
import { tracePolicyContext } from "./policy-context.mjs";

export const AGR_VERSION = "AGR/1";

/**
 * The named drift classes. Adding a class is an additive schema change; a
 * class may never be renamed (reports cite the code, not the description).
 */
export const RISK_CLASSES = Object.freeze({
  RECIPIENT_SUBSTITUTION: {
    severity: "CRITICAL",
    description: "The payee in the executed order differs from the approved merchant/recipient.",
    fields: ["trace.to", "intent.target", "intent.recipient"],
  },
  VALUE_ESCALATION: {
    severity: "CRITICAL",
    severityNote: "any executed total above the approved amount — includes post-approval surcharges, fees, taxes or shipping that were not part of the approved total",
    description: "The executed total exceeds the approved amount.",
    fields: ["trace.value", "intent.amount"],
  },
  ITEM_MUTATION: {
    severity: "HIGH",
    description: "The executed cart items differ from the approved items (injected item, quantity or unit-price change).",
    fields: ["trace.items", "intent.items"],
  },
  CREDENTIAL_SUBSTITUTION: {
    severity: "CRITICAL",
    description: "The executed order references a different payment credential than the approved one.",
    fields: ["trace.paymentCredentialRef", "intent.paymentCredentialRef"],
  },
  EXPIRED_AUTHORIZATION: {
    severity: "CRITICAL",
    description: "The execution happened after the authorization window closed (validUntil / expiryUtc).",
    fields: ["trace.blockTimestamp", "intent.validUntil", "intent.expiryUtc"],
  },
  POLICY_VIOLATION: {
    severity: "CRITICAL",
    description: "The executed order violates a committed policy rule (value limit, target/recipient/selector allowlist).",
    fields: ["policy", "trace"],
  },
  SINGLE_USE_REUSE: {
    severity: "HIGH",
    description: "A single-use authorization was already consumed by a verified execution.",
    fields: ["consent.singleUse"],
  },
  MALFORMED_EXECUTION: {
    severity: "CRITICAL",
    description: "The executed payload is malformed for the fields the taxonomy reads — fail-closed, never guessed.",
    fields: ["trace"],
  },
});

/** Canonical JSON: sorted keys, no whitespace — stable comparison for objects. */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function sameRef(a, b) {
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}

/** UTC seconds for an ISO expiry string; null when absent/invalid (fail-closed by caller). */
function expirySeconds(isoUtc) {
  if (!isoUtc) return null;
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function traceTimestampSeconds(trace) {
  const raw = trace?.blockTimestamp;
  if (raw === undefined || raw === null || raw === "") return null;
  try {
    return Number(BigInt(String(raw)));
  } catch {
    return null;
  }
}

function amountBig(value) {
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

/**
 * Assess one executed order against one approved authorization.
 * Returns a deterministic report; `boundary` travels inside every report so a
 * reader of the committed file can see the taxonomy's ceiling, not just its verdict.
 */
export function assessRisk({ intent, policy, trace, consumed = false }) {
  const violations = [];

  const push = (code, extra) => {
    const cls = RISK_CLASSES[code];
    violations.push({ code, severity: cls.severity, ...extra });
  };

  if (!intent || !trace) {
    return {
      spec: AGR_VERSION,
      classification: "VIOLATIONS",
      violations: [
        {
          code: "MALFORMED_EXECUTION",
          severity: RISK_CLASSES.MALFORMED_EXECUTION.severity,
          field: intent ? "trace" : "intent",
          detail: "assessRisk requires both the approved intent and the executed trace",
        },
      ],
      boundary:
        "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE",
    };
  }

  // 1. Recipient / payee substitution (the merchant-swap class).
  const approvedPayee = intent.recipient ?? intent.target;
  if (approvedPayee && trace.to !== undefined) {
    if (!sameRef(approvedPayee, trace.to)) {
      push("RECIPIENT_SUBSTITUTION", {
        field: "trace.to",
        expected: approvedPayee,
        observed: trace.to,
      });
    }
  }

  // 2. Value escalation (the post-approval surcharge / fee / tax / shipping class).
  const approvedAmount = amountBig(intent.amount);
  const executedValue = amountBig(trace.value);
  if (approvedAmount !== null && executedValue !== null && executedValue > approvedAmount) {
    push("VALUE_ESCALATION", {
      field: "trace.value",
      expected: String(intent.amount),
      observed: String(trace.value),
    });
  } else if (approvedAmount === null || executedValue === null) {
    push("MALFORMED_EXECUTION", {
      field: approvedAmount === null ? "intent.amount" : "trace.value",
      detail: "value fields must be integer strings for the taxonomy to decide",
    });
  }

  // 3. Item mutation (the injected-item class).
  if (intent.items !== undefined && trace.items !== undefined) {
    if (canonicalJson(intent.items) !== canonicalJson(trace.items)) {
      push("ITEM_MUTATION", {
        field: "trace.items",
        expected: canonicalJson(intent.items),
        observed: canonicalJson(trace.items),
      });
    }
  }

  // 4. Payment-credential substitution.
  if (
    intent.paymentCredentialRef !== undefined &&
    trace.paymentCredentialRef !== undefined &&
    String(intent.paymentCredentialRef) !== String(trace.paymentCredentialRef)
  ) {
    push("CREDENTIAL_SUBSTITUTION", {
      field: "trace.paymentCredentialRef",
      expected: String(intent.paymentCredentialRef),
      observed: String(trace.paymentCredentialRef),
    });
  }

  // 5. Authorization window (measured against the trace's own pinned time).
  const executedAt = traceTimestampSeconds(trace);
  let expiredBy = null;
  if (executedAt !== null) {
    const until = (() => {
      try {
        return BigInt(String(intent.validUntil ?? "0"));
      } catch {
        return null;
      }
    })();
    const expiry = expirySeconds(intent.expiryUtc);
    if (until !== null && BigInt(executedAt) > until) expiredBy = `validUntil ${intent.validUntil}`;
    if (expiry !== null && executedAt > expiry) expiredBy = `expiryUtc ${intent.expiryUtc}`;
    if (until === null && expiry === null) {
      push("MALFORMED_EXECUTION", { field: "intent.validUntil", detail: "no authorization window to enforce" });
    }
  }
  if (expiredBy !== null) {
    push("EXPIRED_AUTHORIZATION", {
      field: "trace.blockTimestamp",
      expected: expiredBy,
      observed: String(trace.blockTimestamp),
    });
  } else if (executedAt === null) {
    push("MALFORMED_EXECUTION", { field: "trace.blockTimestamp", detail: "execution time unreadable — cannot enforce the window" });
  }

  // 6. Committed policy rules, evaluated against the executed order
  //    (the family's shared trace→policy context — policy-context.mjs).
  if (policy?.rules?.length) {
    const context = tracePolicyContext(trace);
    let evaluation;
    try {
      evaluation = evaluatePolicy(policy, context);
    } catch (err) {
      push("MALFORMED_EXECUTION", { field: "policy", detail: `policy evaluation refused: ${err?.message ?? err}` });
      evaluation = null;
    }
    if (evaluation) {
      for (const rule of evaluation.rules.filter((r) => r.result === "FAIL")) {
        push("POLICY_VIOLATION", { field: `policy.${rule.ruleId}`, detail: rule.detail ?? "rule violated by the executed order" });
      }
    }
  }

  // 7. Single-use reuse (consumption state supplied by the caller/SDK).
  if (consumed) {
    push("SINGLE_USE_REUSE", {
      field: "consent.singleUse",
      detail: "this authorization was already consumed by a verified execution",
    });
  }

  violations.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  return {
    spec: AGR_VERSION,
    classification: violations.length === 0 ? "CLEAN" : "VIOLATIONS",
    violations,
    boundary:
      "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE",
  };
}
