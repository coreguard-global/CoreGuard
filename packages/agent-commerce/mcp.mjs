/**
 * CoreGuard Agent Commerce MCP Server (stdio · JSON-RPC 2.0 · offline)
 *
 * Exposes the Agent Commerce SDK as MCP tools so an agent platform (or any
 * MCP client) can bind approvals and verify executions through one provider-
 * independent surface. Transport: newline-delimited JSON-RPC 2.0 over stdio
 * (one JSON object per line, both directions) — the same shape MCP clients
 * speak for stdio servers.
 *
 * Tools (all offline, all deterministic, zero keys): 10 core consent/verification tools + 10 Wave 1 Machine Economy tools (x402 parse/authorize/verify/reconcile/meter, machine register/task/telemetry/completion, delegation chain). No custody, no broadcast, no network calls; external settlement/physical truth/signature trust roots NOT proven.
 *
 * BOUNDARIES (standing): synthetic demo data is the caller's; nothing here
 * contacts any platform or payment network (no contact/integration/endorsement
 * claimed with OpenAI, American Express, Mastercard, Visa or any provider);
 * VERIFIED ≠ SAFE; single-use consumption is process-local (durable anchoring
 * NOT_BUILT). nowSeconds is always a caller-supplied pinned epoch — this
 * server never reads the wall clock into any commitment.
 */

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createConsent,
  verifyConsent,
  verifyExecution,
  assessRisk,
  AGENT_COMMERCE_VERSION,
  CONSENT_SPEC,
  splitIdentity,
  compareIdentities,
  anchorFacts,
  buildAttestation,
  verifyAttestation,
  outcomeForVerificationReport,
  authorizationDecision,
  makeProfileReference,
  parseProfileReference,
  createConsumptionStore,
  CONSUMPTION_STORE_BOUNDARY,
  CGXA_VERSION,
  SOROBAN_CONSENT_BINDING_VERSION,
  buildSorobanConsentBinding,
} from "./index.mjs";
import {
  parseX402Challenge,
  authorizeX402Payment,
  verifyX402Settlement,
  reconcilePayment,
  meterAgentUsage,
  registerMachine,
  createMachineTask,
  verifyTelemetry,
  verifyTaskCompletion,
  verifyDelegationChain,
  MACHINE_ECONOMY_VERSION,
  MACHINE_ECONOMY_BOUNDARY,
} from "./machine-economy.mjs";

const PROTOCOL_VERSION = "2025-06-18";

// Single source of truth for the version: the package manifest. The server used
// to hard-code its own string and drifted from npm (1.0.0 vs 0.1.2); the CI test
// test/integrations/agent-commerce-mcp.test.mjs now fails if they differ.
const PACKAGE = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const SERVER_INFO = Object.freeze({ name: "coreguard-agent-commerce", version: PACKAGE.version });
const SERVER_BOUNDARY =
  "offline verification surface — binds approvals and verifies executions on committed machinery; " +
  "no contact with any commerce platform or payment network; VERIFIED ≠ SAFE; " +
  "single-use consumption is process-local by default — pass storePath or set COREGUARD_CONSUMPTION_STORE for an " +
  "AC-CS/1 lock-guarded file ledger (cross-process on this host); cross-host reconciliation is CG-SPEND/1 merge; " +
  "on-chain anchoring NOT_BUILT";

// Optional deployment-wide AC-CS/1 ledger path. Unset keeps the documented
// process-local default; setting it makes single-use durable across processes
// on this host without changing any tool arguments.
const DEFAULT_CONSUMPTION_STORE = process.env.COREGUARD_CONSUMPTION_STORE?.trim() || null;

const TOOL_NAMES = Object.freeze([
  "coreguard_authorize",
  "coreguard_verify_consent",
  "coreguard_verify_execution",
  "coreguard_assess_risk",
  "coreguard_inspect_identity",
  "coreguard_build_attestation",
  "coreguard_verify_attestation",
  "coreguard_decide_outcome",
  "coreguard_profile_reference",
  "coreguard_consumption_status",
  "coreguard_parse_x402_challenge",
  "coreguard_authorize_x402_payment",
  "coreguard_verify_x402_settlement",
  "coreguard_reconcile_payment",
  "coreguard_meter_agent_usage",
  "coreguard_register_machine",
  "coreguard_create_machine_task",
  "coreguard_verify_telemetry",
  "coreguard_verify_task_completion",
  "coreguard_verify_delegation_chain",
]);

/**
 * Stable error contract. Every failure is a tool result with `isError: true`,
 * a human-readable `content[0].text` of the form "CODE: detail", and a machine
 * readable `structuredContent.error = { code, detail }`. The server never exits
 * or throws on bad input — the process keeps serving the next request.
 */
export const ERROR_CODES = Object.freeze({
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  MISSING_ARGUMENT: "MISSING_ARGUMENT",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  TOOL_ERROR: "TOOL_ERROR",
});

function failure(code, detail) {
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${detail}` }],
    structuredContent: { ok: false, error: { code, detail } },
  };
}

function success(value) {
  const structured = value !== null && typeof value === "object" && !Array.isArray(value) ? value : { ok: true, value };
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: structured };
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function requireObjects(args, keys) {
  for (const key of keys) {
    if (args[key] === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: `${key} is required` };
    if (!isPlainObject(args[key])) return { code: ERROR_CODES.INVALID_ARGUMENT, detail: `${key} must be a JSON object` };
  }
  return null;
}

function optionalObject(args, key) {
  if (args[key] === undefined) return null;
  if (!isPlainObject(args[key])) return { code: ERROR_CODES.INVALID_ARGUMENT, detail: `${key} must be a JSON object when supplied` };
  return null;
}
function requireString(args, key) {
  if (args[key] === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: `${key} is required` };
  if (typeof args[key] !== "string" || args[key].length === 0) {
    return { code: ERROR_CODES.INVALID_ARGUMENT, detail: `${key} must be a non-empty string` };
  }
  return null;
}

/** Per-tool input validation. Returns null when the arguments are usable. */
const VALIDATORS = Object.freeze({
  coreguard_authorize(args) {
    const missing = requireObjects(args, ["intent", "policy", "declaredTrace"]);
    if (missing) return missing;
    if (args.nowSeconds === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "nowSeconds is required" };
    if (typeof args.nowSeconds !== "string" || !/^[0-9]+$/.test(args.nowSeconds)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "nowSeconds must be a pinned unix-seconds string (digits only), not a number and never the wall clock" };
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_verify_consent(args) {
    const missing = requireObjects(args, ["consent"]);
    if (missing) return missing;
    return optionalObject(args, "callerContext");
  },
  coreguard_verify_execution(args) {
    const missing = requireObjects(args, ["consent", "trace"]);
    if (missing) return missing;
    return optionalObject(args, "callerContext");
  },
  coreguard_assess_risk(args) {
    const missing = requireObjects(args, ["intent", "policy", "trace"]);
    if (missing) return missing;
    if (args.consumed !== undefined && typeof args.consumed !== "boolean") {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "consumed must be a boolean when supplied" };
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_inspect_identity(args) {
    const missing = requireString(args, "issuer") || requireString(args, "scope") || requireString(args, "subject") || requireString(args, "contentDigest");
    if (missing) return missing;
    if (args.anchor !== undefined && args.anchor !== null && !isPlainObject(args.anchor)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "anchor must be a JSON object when supplied" };
    }
    const otherErr = optionalObject(args, "other");
    if (otherErr) return otherErr;
    return optionalObject(args, "callerContext");
  },
  coreguard_build_attestation(args) {
    const missing = requireObjects(args, ["consent", "executedTrace"]);
    if (missing) return missing;
    const a = requireString(args, "adapterId");
    if (a) return a;
    if (args.nowSeconds === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "nowSeconds is required" };
    const ns = args.nowSeconds;
    const ok = (typeof ns === "number" && Number.isInteger(ns) && ns >= 0) || (typeof ns === "string" && /^[0-9]+$/.test(ns));
    if (!ok) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "nowSeconds must be a pinned non-negative integer (or digit string)" };
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_verify_attestation(args) {
    const missing = requireObjects(args, ["attestation", "consent", "executedTrace"]);
    if (missing) return missing;
    const id = requireString(args, "attestationId");
    if (id) return id;
    return optionalObject(args, "callerContext");
  },
  coreguard_decide_outcome(args) {
    const missing = requireObjects(args, ["report"]);
    if (missing) return missing;
    if (args.receiptId !== undefined && (typeof args.receiptId !== "string" || args.receiptId.length === 0)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "receiptId must be a non-empty string when supplied" };
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_profile_reference(args) {
    const action = args.action;
    if (action !== "make" && action !== "parse") {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "action must be \"make\" or \"parse\"" };
    }
    if (action === "make") {
      const r = requireString(args, "receiptId");
      if (r) return r;
    }
    if (action === "parse") {
      if (args.reference === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "reference is required for action=parse" };
      if (!isPlainObject(args.reference) && typeof args.reference !== "string") {
        return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "reference must be an object or string for action=parse" };
      }
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_consumption_status(args) {
    const r = requireString(args, "receiptId");
    if (r) return r;
    const action = args.action ?? "check";
    if (!["check", "consume", "release"].includes(action)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "action must be check, consume, or release" };
    }
    if (args.storePath !== undefined && (typeof args.storePath !== "string" || args.storePath.length === 0)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "storePath must be a non-empty string when supplied" };
    }
    return optionalObject(args, "callerContext");
  },
  coreguard_parse_x402_challenge(args) { return requireObjects(args, ["challenge"]) || optionalObject(args, "callerContext"); },
  coreguard_authorize_x402_payment(args) { return requireObjects(args, ["challenge", "policy"]) || optionalObject(args, "callerContext"); },
  coreguard_verify_x402_settlement(args) { return requireObjects(args, ["challenge", "settlement"]) || optionalObject(args, "callerContext"); },
  coreguard_reconcile_payment(args) { return requireObjects(args, ["authorization"]) || optionalObject(args, "callerContext"); },
  coreguard_meter_agent_usage(args) {
    const r = requireString(args, "agentId"); if (r) return r;
    if (args.events === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "events is required" };
    if (!Array.isArray(args.events)) return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "events must be an array" };
    return optionalObject(args, "callerContext");
  },
  coreguard_register_machine(args) {
    const r = requireString(args, "machineId"); if (r) return r;
    return requireObjects(args, ["manifest"]) || optionalObject(args, "callerContext");
  },
  coreguard_create_machine_task(args) {
    const r = requireString(args, "taskId"); if (r) return r;
    const r2 = requireString(args, "machineId"); if (r2) return r2;
    return requireObjects(args, ["terms"]) || optionalObject(args, "callerContext");
  },
  coreguard_verify_telemetry(args) {
    const r = requireString(args, "taskId"); if (r) return r;
    return requireObjects(args, ["telemetry"]) || optionalObject(args, "callerContext");
  },
  coreguard_verify_task_completion(args) { return requireObjects(args, ["task", "completion"]) || optionalObject(args, "callerContext"); },
  coreguard_verify_delegation_chain(args) {
    if (args.chain === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "chain is required" };
    if (!Array.isArray(args.chain)) return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "chain must be an array" };
    return optionalObject(args, "callerContext");
  },
});

function integerStringSchema(description) {
  return { type: "string", description, pattern: "^[0-9]+$" };
}

const CALLER_CONTEXT_PROPERTY = {
  callerContext: {
    type: "object",
    description: "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input.",
  },
};

const TOOLS = Object.freeze([
  {
    name: "coreguard_authorize",
    description:
      "Bind a user's approval as a CoreGuard Consent Receipt (CGCR/1): the exact approved order bytes (intent + policy + declared submit payload) committed as an independently re-derivable receipt. nowSeconds must be a pinned unix-seconds string.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "object", description: "CGEP/1 intent (the approved order, incl. merchant/items/total/credentialRef/window)" },
        policy: { type: "object", description: "CGEP/1 policy (value limit + target/recipient/selector allowlists)" },
        declaredTrace: { type: "object", description: "the exact submit-order payload the approval covers" },
        nowSeconds: integerStringSchema("pinned approval epoch (unix seconds) — never the wall clock"),
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["intent", "policy", "declaredTrace", "nowSeconds"],
    },
    outputSchema: {
      type: "object",
      description: "CGCR/1 consent record with pinned commitments over approved bytes.",
      properties: {
        spec: { type: "string", description: "always CGCR/1" },
        receipt: { type: "object", description: "pinned receipt commitments and timestamp" },
        intent: { type: "object" },
        policy: { type: "object" },
        callerContext: { type: "object", description: "echoed caller context when supplied" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_verify_consent",
    description:
      "Verify a consent record's integrity and binding: recompute every commitment against the record's own approved bytes. Any tampered byte fails closed.",
    inputSchema: {
      type: "object",
      properties: {
        consent: { type: "object", description: "CGCR/1 consent record as returned by coreguard_authorize" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["consent"],
    },
    outputSchema: {
      type: "object",
      description: "Integrity verdict for the record's own bytes; fail-closed on tamper.",
      properties: {
        verdict: { type: "string", description: "VERIFIED or INVALID/UNKNOWN — never SAFE" },
        spec: { type: "string" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_verify_execution",
    description:
      "Verify an executed order against a consent record, fail-closed: exact execution -> VERIFIED; any drift -> INVALID with the drifted field named (AGR/1). Single-use consents are consumed by first verified execution (process-local by default; file-backed host store via AC-CS/1 when supplied by caller integration).",
    inputSchema: {
      type: "object",
      properties: {
        consent: { type: "object", description: "CGCR/1 consent record" },
        trace: { type: "object", description: "the executed order payload as observed" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["consent", "trace"],
    },
    outputSchema: {
      type: "object",
      description: "Fail-closed execution verdict with AGR/1 risk report and consumption boundary.",
      properties: {
        spec: { type: "string", description: "AC-SDK/1" },
        verdict: { type: "string", description: "VERIFIED or INVALID" },
        risk: { type: "object" },
        consumed: { type: "boolean" },
        consumedLedger: { type: "string" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_assess_risk",
    description:
      "Classify one executed order against one approved authorization with the deterministic AGR/1 taxonomy. Not a probabilistic fraud score; VERIFIED ≠ SAFE.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "object", description: "the approved order" },
        policy: { type: "object", description: "the committed policy" },
        trace: { type: "object", description: "the executed order payload" },
        consumed: { type: "boolean", description: "whether this authorization was already consumed", default: false },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["intent", "policy", "trace"],
    },
    outputSchema: {
      type: "object",
      description: "Deterministic AGR/1 risk report with classification, named violations, and taxonomy metadata.",
      properties: {
        classification: { type: "string" },
        violations: { type: "array" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_inspect_identity",
    description:
      "Inspect CG-ID/1 identity split: recordId (who) vs contentDigest (what), with optional anchor facts and optional comparison to another identity. Offline and deterministic.",
    inputSchema: {
      type: "object",
      properties: {
        issuer: { type: "string", description: "identity issuer" },
        scope: { type: "string", description: "identity scope" },
        subject: { type: "string", description: "identity subject" },
        contentDigest: { type: "string", description: "content digest as 64-char lowercase hex (no 0x prefix)" },
        anchor: { type: "object", description: "optional anchor reference" },
        other: { type: "object", description: "optional other identity for comparison" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["issuer", "scope", "subject", "contentDigest"],
    },
    outputSchema: {
      type: "object",
      description: "CG-ID/1 identity view with anchor facts and optional comparison.",
      properties: {
        identity: { type: "object" },
        anchorFacts: { type: "object" },
        comparison: { type: "object" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_build_attestation",
    description:
      "Build a CGXA/1 offline execution attestation from a consent record and executed trace. No broadcast; no chain/network contact. nowSeconds must be pinned.",
    inputSchema: {
      type: "object",
      properties: {
        consent: { type: "object", description: "CGCR/1 consent record" },
        executedTrace: { type: "object", description: "executed trace observed by caller" },
        adapterId: { type: "string", description: "CGXA adapter id" },
        nowSeconds: { description: "pinned approval epoch (unix seconds) as non-negative integer or digit string — never wall clock", oneOf: [{ type: "integer", minimum: 0 }, { type: "string", pattern: "^[0-9]+$" }] },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["consent", "executedTrace", "adapterId", "nowSeconds"],
    },
    outputSchema: {
      type: "object",
      description: "CGXA/1 offline attestation payload with attestation record and deterministic attestationId.",
      properties: {
        attestation: { type: "object" },
        attestationId: { type: "string" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_verify_attestation",
    description:
      "Verify a CGXA/1 attestation against its consent and executed trace. Offline, fail-closed; no chain/network contact.",
    inputSchema: {
      type: "object",
      properties: {
        attestation: { type: "object", description: "CGXA/1 attestation" },
        attestationId: { type: "string", description: "attestation identifier" },
        consent: { type: "object", description: "CGCR/1 consent record" },
        executedTrace: { type: "object", description: "executed trace" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["attestation", "attestationId", "consent", "executedTrace"],
    },
    outputSchema: {
      type: "object",
      description: "CGXA/1 attestation verification result with deterministic verdict and boundary-aware details.",
      properties: {
        verdict: { type: "string" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_decide_outcome",
    description:
      "Map a verification report to CG-OUT/1 outcome and authorization decision. ABSENT/NOT_CHECKED never render as BLOCK; VERIFIED ≠ SAFE.",
    inputSchema: {
      type: "object",
      properties: {
        report: { type: "object", description: "verification report or bridge-compatible report object" },
        receiptId: { type: "string", description: "optional receipt id for profile reference" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["report"],
    },
    outputSchema: {
      type: "object",
      description: "CG-OUT/1 outcome, authorization decision, and optional profile reference.",
      properties: {
        outcome: { type: "object" },
        decision: { type: "object" },
        profileReference: { type: "object" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_profile_reference",
    description:
      "Create or parse a CG-OUT/1 profile reference. action='make' requires receiptId; action='parse' requires reference.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["make", "parse"], description: "make or parse" },
        receiptId: { type: "string", description: "receipt id for action=make" },
        reference: { description: "profile reference object/string for action=parse" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["action"],
    },
    outputSchema: {
      type: "object",
      description: "CG-OUT/1 profile reference result for make or parse actions with explicit action echo.",
      properties: {
        action: { type: "string" },
        profileReference: { type: "object" },
        parsed: { type: "object" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_consumption_status",
    description:
      "Check/consume/release a receiptId in a consumption ledger. Default is process-local (this MCP process only). If storePath is supplied (or COREGUARD_CONSUMPTION_STORE is set), uses the AC-CS/1 lock-guarded file store, which is atomic across processes on the same host. Cross-host reconciliation is CG-SPEND/1 merge; on-chain anchoring is NOT_BUILT.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "receipt/consent identifier key" },
        action: { type: "string", enum: ["check", "consume", "release"], description: "check, consume, or release", default: "check" },
        storePath: { type: "string", description: "optional AC-CS/1 file-backed store path for same-host cross-process consumption (default: COREGUARD_CONSUMPTION_STORE)" },
        ...CALLER_CONTEXT_PROPERTY,
      },
      required: ["receiptId"],
    },
    outputSchema: {
      type: "object",
      description: "Consumption status with explicit ledger boundary.",
      properties: {
        receiptId: { type: "string" },
        action: { type: "string" },
        consumed: { type: "boolean" },
        ledger: { type: "string", description: "process-local or file-backed (AC-CS/1, cross-process on this host)" },
        boundary: { type: "string" },
        callerContext: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_parse_x402_challenge",
    description: "Parse and normalize an x402 payment challenge (HTTP 402 accepts). Offline deterministic validation only; no network contact, no payment execution.",
    inputSchema: { type: "object", properties: { challenge: { type: "object", description: "x402 challenge/402 body with accepts[]" }, ...CALLER_CONTEXT_PROPERTY }, required: ["challenge"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, accepts: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_authorize_x402_payment",
    description: "Evaluate an x402 challenge against a local policy and produce an authorization decision. No custody, no broadcast, no payment execution.",
    inputSchema: { type: "object", properties: { challenge: { type: "object" }, policy: { type: "object", description: "policy: maxAmount, allowedNetworks, allowedAssets, allowedPayTo" }, selectedIndex: { type: "integer", minimum: 0 }, ...CALLER_CONTEXT_PROPERTY }, required: ["challenge", "policy"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, authorizationId: { type: "string" }, issues: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_verify_x402_settlement",
    description: "Verify caller-supplied x402 settlement evidence against a challenge. No network confirmation performed; evidence-only, fail-closed.",
    inputSchema: { type: "object", properties: { challenge: { type: "object" }, settlement: { type: "object", description: "caller-supplied settlement evidence (network, asset, amount, payTo, txRef, status)" }, ...CALLER_CONTEXT_PROPERTY }, required: ["challenge", "settlement"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_reconcile_payment",
    description: "Reconcile authorization, settlement evidence, and receipt. Deterministic evidence check only; no external ledger/custody.",
    inputSchema: { type: "object", properties: { authorization: { type: "object" }, challenge: { type: "object" }, settlement: { type: "object" }, receipt: { type: "object" }, ...CALLER_CONTEXT_PROPERTY }, required: ["authorization"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_meter_agent_usage",
    description: "Deterministically meter agent usage/cost events into an auditable total. No billing custody or external payment.",
    inputSchema: { type: "object", properties: { agentId: { type: "string" }, events: { type: "array", items: { type: "object" } }, currency: { type: "string" }, ...CALLER_CONTEXT_PROPERTY }, required: ["agentId", "events"] },
    outputSchema: { type: "object", properties: { totalAmount: { type: "string" }, eventCount: { type: "integer" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_register_machine",
    description: "Create a local machine registration record from a manifest. No external device attestation/TPM trust root verification performed.",
    inputSchema: { type: "object", properties: { machineId: { type: "string" }, manifest: { type: "object" }, owner: { type: "string" }, ...CALLER_CONTEXT_PROPERTY }, required: ["machineId", "manifest"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, registrationId: { type: "string" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_create_machine_task",
    description: "Create a deterministic machine task record with terms/price/SLA conditions. No payment custody or physical execution guarantee.",
    inputSchema: { type: "object", properties: { taskId: { type: "string" }, machineId: { type: "string" }, terms: { type: "object" }, ...CALLER_CONTEXT_PROPERTY }, required: ["taskId", "machineId", "terms"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, taskDigest: { type: "string" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_verify_telemetry",
    description: "Verify caller-supplied telemetry evidence structure/digest presence. Signature authenticity and physical-world truth are NOT proven without trusted device keys/attestation.",
    inputSchema: { type: "object", properties: { taskId: { type: "string" }, telemetry: { type: "object" }, ...CALLER_CONTEXT_PROPERTY }, required: ["taskId", "telemetry"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_verify_task_completion",
    description: "Verify task completion evidence against task record. Evidence acceptance is not physical-world proof; independent verification required for high-stakes actions.",
    inputSchema: { type: "object", properties: { task: { type: "object" }, completion: { type: "object" }, telemetryVerification: { type: "object" }, ...CALLER_CONTEXT_PROPERTY }, required: ["task", "completion"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
  {
    name: "coreguard_verify_delegation_chain",
    description: "Verify delegation chain structure and continuity. Cryptographic signature verification requires trusted roots; not performed here.",
    inputSchema: { type: "object", properties: { chain: { type: "array", items: { type: "object" } }, ...CALLER_CONTEXT_PROPERTY }, required: ["chain"] },
    outputSchema: { type: "object", properties: { verdict: { type: "string" }, issues: { type: "array" }, depth: { type: "integer" }, boundary: { type: "string" }, callerContext: { type: "object" } }, additionalProperties: true },
  },
]);

function withCallerContext(value, args) {
  if (!args?.callerContext || !isPlainObject(args.callerContext)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...value, callerContext: args.callerContext };
  return { value, callerContext: args.callerContext };
}

async function callTool(name, args, { consumedSet } = {}) {
  if (!TOOL_NAMES.includes(name)) return failure(ERROR_CODES.UNKNOWN_TOOL, `unknown tool: ${String(name)}`);
  const a = args ?? {};
  const problem = VALIDATORS[name]?.(a);
  if (problem) return failure(problem.code, problem.detail);
  try {
    if (name === "coreguard_authorize") return success(withCallerContext(await createConsent(a), a));
    if (name === "coreguard_verify_consent") return success(withCallerContext(await verifyConsent(a.consent), a));
    if (name === "coreguard_verify_execution") return success(withCallerContext(await verifyExecution(a.consent, a.trace, { consumedSet }), a));
    if (name === "coreguard_assess_risk") {
      return success(withCallerContext(assessRisk({ intent: a.intent, policy: a.policy, trace: a.trace, consumed: a.consumed === true }), a));
    }
    if (name === "coreguard_inspect_identity") {
      const identity = splitIdentity({
        issuer: a.issuer, scope: a.scope, subject: a.subject, contentDigest: a.contentDigest, anchor: a.anchor ?? null,
      });
      const facts = anchorFacts(identity);
      const comparison = a.other ? compareIdentities(identity, splitIdentity(a.other)) : undefined;
      return success(withCallerContext({ identity, anchorFacts: facts, ...(comparison ? { comparison } : {}) }, a));
    }
    if (name === "coreguard_build_attestation") {
      const nowSeconds = typeof a.nowSeconds === "string" ? Number(a.nowSeconds) : a.nowSeconds;
      const out = await buildAttestation({ consent: a.consent, executedTrace: a.executedTrace, adapterId: a.adapterId, nowSeconds });
      return success(withCallerContext(out, a));
    }
    if (name === "coreguard_verify_attestation") {
      const out = await verifyAttestation({ attestation: a.attestation, attestationId: a.attestationId, consent: a.consent, executedTrace: a.executedTrace });
      return success(withCallerContext(out, a));
    }
    if (name === "coreguard_decide_outcome") {
      const outcome = outcomeForVerificationReport(a.report);
      const decision = authorizationDecision(outcome);
      const profileReference = a.receiptId ? makeProfileReference({ receiptId: a.receiptId }) : undefined;
      return success(withCallerContext({ outcome, decision, ...(profileReference ? { profileReference } : {}) }, a));
    }
    if (name === "coreguard_profile_reference") {
      if (a.action === "make") return success(withCallerContext({ action: "make", profileReference: makeProfileReference({ receiptId: a.receiptId }) }, a));
      return success(withCallerContext({ action: "parse", parsed: parseProfileReference(a.reference) }, a));
    }
    if (name === "coreguard_consumption_status") {
      const action = a.action ?? "check";
      const key = a.receiptId;
      const storePath = a.storePath ?? DEFAULT_CONSUMPTION_STORE;
      if (storePath) {
        const store = createConsumptionStore(storePath);
        let consumed;
        if (action === "consume") { consumed = store.tryAdd(key) || store.has(key); }
        else if (action === "release") { store.delete(key); consumed = store.has(key); }
        else consumed = store.has(key);
        return success(withCallerContext({
          receiptId: key, action, consumed, ledger: "file-backed (AC-CS/1, lock-guarded across processes on this host)", boundary: CONSUMPTION_STORE_BOUNDARY,
        }, a));
      }
      const set = consumedSet ?? new Set();
      let consumed;
      if (action === "consume") { consumed = set.has(key); set.add(key); consumed = set.has(key); }
      else if (action === "release") { set.delete(key); consumed = set.has(key); }
      else consumed = set.has(key);
      return success(withCallerContext({
        receiptId: key, action, consumed, ledger: "process-local",
        boundary: "process-local only; set storePath or COREGUARD_CONSUMPTION_STORE for the AC-CS/1 file ledger (cross-process on this host); cross-host sync is CG-SPEND/1 merge; on-chain anchoring NOT_BUILT",
      }, a));
    }
    if (name === "coreguard_parse_x402_challenge") return success(withCallerContext(parseX402Challenge(a), a));
    if (name === "coreguard_authorize_x402_payment") return success(withCallerContext(authorizeX402Payment(a), a));
    if (name === "coreguard_verify_x402_settlement") return success(withCallerContext(verifyX402Settlement(a), a));
    if (name === "coreguard_reconcile_payment") return success(withCallerContext(reconcilePayment(a), a));
    if (name === "coreguard_meter_agent_usage") return success(withCallerContext(meterAgentUsage(a), a));
    if (name === "coreguard_register_machine") return success(withCallerContext(registerMachine(a), a));
    if (name === "coreguard_create_machine_task") return success(withCallerContext(createMachineTask(a), a));
    if (name === "coreguard_verify_telemetry") return success(withCallerContext(verifyTelemetry(a), a));
    if (name === "coreguard_verify_task_completion") return success(withCallerContext(verifyTaskCompletion(a), a));
    if (name === "coreguard_verify_delegation_chain") return success(withCallerContext(verifyDelegationChain(a), a));
    return failure(ERROR_CODES.UNKNOWN_TOOL, `unknown tool: ${String(name)}`);
  } catch (err) {
    return failure(ERROR_CODES.TOOL_ERROR, err?.message ?? String(err));
  }
}

export function createMcpHandler({ write } = {}) {
  // The handler returns JSON-RPC response objects; with `write` supplied they
  // are serialized (one per line) to that sink — tests inject a sink, the
  // CLI path defaults to process.stdout.
  const emit = write ?? ((obj) => process.stdout.write(JSON.stringify(obj) + "\n"));
  const consumed = new Set(); // process-local single-use ledger for this server

  return async function handleLine(line) {
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      emit({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return null;
    }
    if (req === null || typeof req !== "object" || Array.isArray(req)) {
      emit({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } });
      return null;
    }
    const { id, method, params } = req;
    const respond = (payload) => {
      if (id !== undefined && id !== null) emit({ jsonrpc: "2.0", id, ...payload });
      return payload;
    };

    if (method === "initialize") {
      return respond({
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: SERVER_BOUNDARY,
        },
      });
    }
    if (method === "notifications/initialized" || typeof method === "string" && method.startsWith("notifications/")) {
      return null; // notifications get no response
    }
    if (method === "ping") {
      return respond({ result: {} });
    }
    if (method === "tools/list") {
      return respond({ result: { tools: TOOLS } });
    }
    if (method === "tools/call") {
      const name = params?.name;
      if (!TOOL_NAMES.includes(name)) {
        return respond({ result: failure(ERROR_CODES.UNKNOWN_TOOL, `unknown tool: ${String(name)}`) });
      }
      const result = await callTool(name, params?.arguments ?? {}, { consumedSet: consumed });
      return respond({ result });
    }
    return respond({ error: { code: -32601, message: `Method not found: ${String(method)}` } });
  };
}

export function selfCheck() {
  return [
    ["tools exposed", TOOL_NAMES.length === 20 && TOOL_NAMES[0] === "coreguard_authorize" && TOOL_NAMES[9] === "coreguard_consumption_status" && TOOL_NAMES[19] === "coreguard_verify_delegation_chain"],
    ["protocol version pinned", PROTOCOL_VERSION === "2025-06-18"],
    ["spec surfaced", CONSENT_SPEC === "CGCR/1" && AGENT_COMMERCE_VERSION === "AC-SDK/1"],
    ["boundary travels", SERVER_BOUNDARY.includes("VERIFIED ≠ SAFE") && SERVER_BOUNDARY.includes("NOT_BUILT")],
    ["version has one source", SERVER_INFO.version === PACKAGE.version],
    ["every tool declares an output schema", TOOLS.every((t) => t.outputSchema?.type === "object")],
    ["every tool declares required inputs", TOOLS.every((t) => Array.isArray(t.inputSchema?.required) && t.inputSchema.required.length > 0)],
    ["error contract is exported", ERROR_CODES.MISSING_ARGUMENT === "MISSING_ARGUMENT"],
    ["caller context supported", TOOLS.every((t) => t.inputSchema?.properties?.callerContext?.type === "object")],
    ["machine economy boundary", MACHINE_ECONOMY_BOUNDARY.includes("VERIFIED != SAFE")],
  ];
}

export { SERVER_INFO, PROTOCOL_VERSION, TOOLS };

export async function main() {
  const handle = createMcpHandler();
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    await handle(line);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
