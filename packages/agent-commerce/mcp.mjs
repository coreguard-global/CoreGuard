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
const SERVER_INFO = { name: "coreguard-agent-commerce", version: "1.0.0" };
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
  },
]);

async function callTool(name, args, { consumedSet } = {}) {
  try {
    if (name === "coreguard_authorize") {
      const consent = await createConsent(args);
      return { content: [{ type: "text", text: JSON.stringify(consent, null, 2) }] };
    }
    if (name === "coreguard_verify_consent") {
      const verification = await verifyConsent(args.consent);
      return { content: [{ type: "text", text: JSON.stringify(verification, null, 2) }] };
    }
    if (name === "coreguard_verify_execution") {
      const report = await verifyExecution(args.consent, args.trace, { consumedSet });
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
    if (name === "coreguard_assess_risk") {
      const report = assessRisk({ intent: args.intent, policy: args.policy, trace: args.trace, consumed: args.consumed === true });
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
    return { isError: true, content: [{ type: "text", text: `unknown tool: ${name}` }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `tool error: ${err?.message ?? String(err)}` }] };
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
        return respond({ result: { isError: true, content: [{ type: "text", text: `unknown tool: ${String(name)}` }] } });
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
  ];
}

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
