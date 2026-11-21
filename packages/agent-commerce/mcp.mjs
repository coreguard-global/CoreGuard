/**
 * CoreGuard Agent Commerce MCP Server (stdio · JSON-RPC 2.0 · offline)
 *
 * Exposes the Agent Commerce SDK as MCP tools so an agent platform (or any
 * MCP client) can bind approvals and verify executions through one provider-
 * independent surface. Transport: newline-delimited JSON-RPC 2.0 over stdio
 * (one JSON object per line, both directions) — the same shape MCP clients
 * speak for stdio servers.
 *
 * Tools (all offline, all deterministic, zero keys):
 *   coreguard_authorize         intent + policy + declaredTrace + nowSeconds
 *                               -> CGCR/1 consent record (pinned receipt)
 *   coreguard_verify_consent    consent record -> integrity verdict
 *   coreguard_verify_execution  consent + executed trace -> fail-closed
 *                               verdict + AGR/1 taxonomy + named drift
 *   coreguard_assess_risk       intent + policy + trace -> AGR/1 report
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
} from "./index.mjs";

const PROTOCOL_VERSION = "2025-06-18";

// Single source of truth for the version: the package manifest. The server used
// to hard-code its own string and drifted from npm (1.0.0 vs 0.1.2); the CI test
// test/integrations/agent-commerce-mcp.test.mjs now fails if they differ.
const PACKAGE = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const SERVER_INFO = Object.freeze({ name: "coreguard-agent-commerce", version: PACKAGE.version });
const SERVER_BOUNDARY =
  "offline verification surface — binds approvals and verifies executions on committed machinery; " +
  "no contact with any commerce platform or payment network; VERIFIED ≠ SAFE; " +
  "single-use consumption is process-local (durable anchoring NOT_BUILT)";

const TOOL_NAMES = Object.freeze([
  "coreguard_authorize",
  "coreguard_verify_consent",
  "coreguard_verify_execution",
  "coreguard_assess_risk",
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

/** Per-tool input validation. Returns null when the arguments are usable. */
const VALIDATORS = Object.freeze({
  coreguard_authorize(args) {
    const missing = requireObjects(args, ["intent", "policy", "declaredTrace"]);
    if (missing) return missing;
    if (args.nowSeconds === undefined) return { code: ERROR_CODES.MISSING_ARGUMENT, detail: "nowSeconds is required" };
    if (typeof args.nowSeconds !== "string" || !/^[0-9]+$/.test(args.nowSeconds)) {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "nowSeconds must be a pinned unix-seconds string (digits only), not a number and never the wall clock" };
    }
    return null;
  },
  coreguard_verify_consent(args) {
    return requireObjects(args, ["consent"]);
  },
  coreguard_verify_execution(args) {
    return requireObjects(args, ["consent", "trace"]);
  },
  coreguard_assess_risk(args) {
    const missing = requireObjects(args, ["intent", "policy", "trace"]);
    if (missing) return missing;
    if (args.consumed !== undefined && typeof args.consumed !== "boolean") {
      return { code: ERROR_CODES.INVALID_ARGUMENT, detail: "consumed must be a boolean when supplied" };
    }
    return null;
  },
});

function integerStringSchema(description) {
  return { type: "string", description, pattern: "^[0-9]+$" };
}

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
      },
      required: ["intent", "policy", "declaredTrace", "nowSeconds"],
    },
    outputSchema: {
      type: "object",
      description:
        "CGCR/1 consent record: spec (always CGCR/1) plus receipt — the pinned commitments over the approved intent, policy and declared submit payload, with the caller-supplied timestamp. Every commitment is re-derivable from the record's own approved bytes.",
      properties: {
        spec: { type: "string", description: "always CGCR/1" },
        receipt: { type: "object", description: "pinned receipt: commitment digests, approved bytes' digests, timestamp, single-use flag" },
        intent: { type: "object", description: "the approved order as committed" },
        policy: { type: "object", description: "the committed policy as approved" },
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
      properties: { consent: { type: "object", description: "CGCR/1 consent record as returned by coreguard_authorize" } },
      required: ["consent"],
    },
    outputSchema: {
      type: "object",
      description:
        "Integrity verdict for the record's own bytes: the commitments are recomputed and compared. A tampered or truncated record yields a non-VERIFIED result (fail-closed) rather than an exception.",
      properties: {
        verdict: { type: "string", description: "VERIFIED or INVALID/UNKNOWN — never SAFE" },
        spec: { type: "string", description: "the schema the record was verified against (CGCR/1)" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_verify_execution",
    description:
      "Verify an executed order against a consent record, fail-closed: exact execution -> VERIFIED; any drift -> INVALID with the drifted field named (AGR/1). Single-use consents are consumed by their first verified execution (process-local).",
    inputSchema: {
      type: "object",
      properties: {
        consent: { type: "object", description: "CGCR/1 consent record" },
        trace: { type: "object", description: "the executed order payload as observed" },
      },
      required: ["consent", "trace"],
    },
    outputSchema: {
      type: "object",
      description:
        "Fail-closed execution verdict: verdict is VERIFIED only when the executed trace re-derives the approved commitments exactly and no drift class fired; otherwise INVALID with the drifted fields named under risk. Also reports whether the single-use consent was consumed (process-local).",
      properties: {
        spec: { type: "string", description: "AC-SDK/1" },
        verdict: { type: "string", description: "VERIFIED or INVALID" },
        risk: { type: "object", description: "AGR/1 report: classification, named violations with code and severity" },
        consumed: { type: "boolean", description: "true once this consent has been consumed by a verified execution" },
        consumedLedger: { type: "string", description: "states the process-local boundary of the consumed ledger" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "coreguard_assess_risk",
    description:
      "Classify one executed order against one approved authorization with the deterministic AGR/1 taxonomy (named classes + severities). Not a probabilistic fraud score; VERIFIED ≠ SAFE.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "object", description: "the approved order" },
        policy: { type: "object", description: "the committed policy" },
        trace: { type: "object", description: "the executed order payload" },
        consumed: { type: "boolean", description: "whether this authorization was already consumed", default: false },
      },
      required: ["intent", "policy", "trace"],
    },
    outputSchema: {
      type: "object",
      description:
        "Deterministic AGR/1 risk report over one executed order: classification (CLEAN or the fired classes), named violations with severity, and the taxonomy version. This is a rule-based conformance classification, not a probabilistic fraud score.",
      properties: {
        classification: { type: "string", description: "CLEAN when no drift class fired" },
        violations: { type: "array", description: "named drift classes with code and severity" },
      },
      additionalProperties: true,
    },
  },
]);

async function callTool(name, args, { consumedSet } = {}) {
  if (!TOOL_NAMES.includes(name)) return failure(ERROR_CODES.UNKNOWN_TOOL, `unknown tool: ${String(name)}`);
  const problem = VALIDATORS[name]?.(args ?? {});
  if (problem) return failure(problem.code, problem.detail);
  try {
    if (name === "coreguard_authorize") return success(await createConsent(args));
    if (name === "coreguard_verify_consent") return success(await verifyConsent(args.consent));
    if (name === "coreguard_verify_execution") return success(await verifyExecution(args.consent, args.trace, { consumedSet }));
    if (name === "coreguard_assess_risk") {
      return success(assessRisk({ intent: args.intent, policy: args.policy, trace: args.trace, consumed: args.consumed === true }));
    }
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
    ["tools exposed", TOOL_NAMES.join(",") === "coreguard_authorize,coreguard_verify_consent,coreguard_verify_execution,coreguard_assess_risk"],
    ["protocol version pinned", PROTOCOL_VERSION === "2025-06-18"],
    ["spec surfaced", CONSENT_SPEC === "CGCR/1" && AGENT_COMMERCE_VERSION === "AC-SDK/1"],
    ["boundary travels", SERVER_BOUNDARY.includes("VERIFIED ≠ SAFE") && SERVER_BOUNDARY.includes("NOT_BUILT")],
    ["version has one source", SERVER_INFO.version === PACKAGE.version],
    ["every tool declares an output schema", TOOLS.every((t) => t.outputSchema?.type === "object")],
    ["every tool declares required inputs", TOOLS.every((t) => Array.isArray(t.inputSchema?.required) && t.inputSchema.required.length > 0)],
    ["error contract is exported", ERROR_CODES.MISSING_ARGUMENT === "MISSING_ARGUMENT"],
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
