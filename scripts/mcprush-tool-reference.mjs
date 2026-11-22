#!/usr/bin/env node
/**
 * Generate docs/mcprush/tool-reference.md from the real MCP server.
 *
 * The page is built from `initialize` + `tools/list` (schemas and descriptions)
 * and every example argument set is EXECUTED against a spawned stdio server.
 * If any example fails, the generator exits non-zero and writes nothing.
 *
 *   node scripts/mcprush-tool-reference.mjs            # write the page
 *   node scripts/mcprush-tool-reference.mjs --check    # fail if the page is stale
 *
 * Offline · deterministic · zero keys.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const MCP_PATH = resolve(ROOT, "packages/agent-commerce/mcp.mjs");
const OUT_PATH = resolve(ROOT, "docs/mcprush/tool-reference.md");
const CHECK = process.argv.includes("--check");

const pkg = JSON.parse(readFileSync(resolve(ROOT, "packages/agent-commerce/package.json"), "utf8"));
const server = JSON.parse(readFileSync(resolve(ROOT, "packages/agent-commerce/server.json"), "utf8"));

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600";
const AMOUNT = "47000";
const DRIFTED = "57000";

function intent(amount = AMOUNT) {
  return {
    version: "CGEP/1",
    chainId: "0",
    signer: AGENT,
    nonce: "0",
    validAfter: "0",
    validUntil: "9999999999",
    action: "AGENT_CHECKOUT",
    target: MERCHANT,
    selector: "0xa9059cbb",
    asset: "0x0000000000000000000000000000000000000002",
    amount,
    recipient: MERCHANT,
    constraints: [
      { type: "MAX_VALUE", value: amount },
      { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
    ],
    merchantName: "synthetic-store.example",
    currency: "USD",
    items: [{ sku: "SKU-MCP-T", name: "Synthetic item M", qty: 1, unitPriceMinor: amount }],
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
    authorizedAtUtc: "2026-11-14T12:00:00Z",
    expiryUtc: "2026-11-14T12:10:00Z",
    singleUse: true,
  };
}

const policy = () => ({
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Agent Commerce Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: AMOUNT }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
});

function trace(totalMinor = AMOUNT) {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "bb".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: NOW,
    from: AGENT,
    to: MERCHANT,
    value: totalMinor,
    calldata: "0xa9059cbb" + MERCHANT.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed: "21000",
    items: intent().items,
    paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
  };
}

/** Spawn the shipped MCP server and expose a bounded JSON-RPC call. */
async function withServer(fn) {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ["pipe", "pipe", "pipe"] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  let nextId = 1;
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const waiter = pending.get(msg.id);
    if (!waiter) return; // notifications are ignored here
    pending.delete(msg.id);
    msg.error ? waiter.reject(new Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result);
  });
  const rpc = (method, params) =>
    new Promise((resolveP, rejectP) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectP(new Error(`timeout on ${method}`));
      }, 20000);
      pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolveP(v)),
        reject: (e) => (clearTimeout(timer), rejectP(e)),
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  try {
    await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "mcprush-reference-generator", version: "1" },
    });
    return await fn(rpc);
  } finally {
    child.stdin.end();
    child.kill();
  }
}

const unwrap = (result) => result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? "null");

/** Every example below is executed; failures abort the build. */
async function buildExamples(rpc) {
  const call = async (name, args) => {
    const res = await rpc("tools/call", { name, arguments: args });
    if (res?.isError) throw new Error(`${name} returned isError: ${JSON.stringify(res).slice(0, 400)}`);
    return unwrap(res);
  };

  const int = intent();
  const pol = policy();

  const consent = await call("coreguard_authorize", { intent: int, policy: pol, declaredTrace: trace(), nowSeconds: NOW });
  const consentRecord = consent.consent ?? consent;

  const verifiedConsent = await call("coreguard_verify_consent", { consent: consentRecord });
  const drifted = await call("coreguard_verify_execution", { consent: consentRecord, trace: trace(DRIFTED) });
  const verifiedExec = await call("coreguard_verify_execution", { consent: consentRecord, trace: trace(AMOUNT) });
  const risk = await call("coreguard_assess_risk", { intent: int, policy: pol, trace: trace(), consumed: false });
  const identity = await call("coreguard_inspect_identity", {
    issuer: "did:example:issuer",
    scope: "agent-commerce",
    subject: "did:example:agent-0001",
    contentDigest: "ab".repeat(32),
    anchor: { kind: "chain", locator: "eip155:0:block:65337" },
  });
  const attestation = await call("coreguard_build_attestation", {
    consent: consentRecord,
    executedTrace: trace(),
    adapterId: "stellar-anchor",
    nowSeconds: NOW,
  });
  const attestationVerified = await call("coreguard_verify_attestation", {
    attestation: attestation.attestation,
    attestationId: attestation.attestationId,
    consent: consentRecord,
    executedTrace: trace(),
  });
  const outcome = await call("coreguard_decide_outcome", { report: verifiedExec });
  const profileRef = await call("coreguard_profile_reference", {
    action: "make",
    receiptId: consentRecord.receipt?.receiptId ?? consentRecord.receiptId ?? "rcpt-example-0001",
  });
  const consumption = await call("coreguard_consumption_status", {
    receiptId: consentRecord.receipt?.receiptId ?? consentRecord.receiptId ?? "rcpt-example-0001",
    action: "check",
  });

  const use = (what) => ({ $ref: what });

  return {
    coreguard_authorize: { args: { intent: int, policy: pol, declaredTrace: trace(), nowSeconds: NOW }, out: consent },
    coreguard_verify_consent: {
      args: { consent: consentRecord },
      display: { consent: use("CGCR/1 consent object returned by coreguard_authorize") },
      out: verifiedConsent,
    },
    coreguard_verify_execution: {
      args: { consent: consentRecord, trace: trace(AMOUNT) },
      display: { consent: use("CGCR/1 consent object returned by coreguard_authorize"), trace: trace(AMOUNT) },
      out: verifiedExec,
      extra: { drifted },
    },
    coreguard_assess_risk: { args: { intent: int, policy: pol, trace: trace(), consumed: false }, out: risk },
    coreguard_inspect_identity: {
      args: {
        issuer: "did:example:issuer",
        scope: "agent-commerce",
        subject: "did:example:agent-0001",
        contentDigest: "ab".repeat(32),
        anchor: { kind: "chain", locator: "eip155:0:block:65337" },
      },
      out: identity,
    },
    coreguard_build_attestation: {
      args: { consent: consentRecord, executedTrace: trace(), adapterId: "stellar-anchor", nowSeconds: NOW },
      display: {
        consent: use("CGCR/1 consent object returned by coreguard_authorize"),
        executedTrace: trace(),
        adapterId: "stellar-anchor",
        nowSeconds: NOW,
      },
      out: attestation,
    },
    coreguard_verify_attestation: {
      args: {
        attestation: attestation.attestation,
        attestationId: attestation.attestationId,
        consent: consentRecord,
        executedTrace: trace(),
      },
      display: {
        attestation: use("CGXA/1 attestation object returned by coreguard_build_attestation"),
        attestationId: attestation.attestationId,
        consent: use("CGCR/1 consent object returned by coreguard_authorize"),
        executedTrace: trace(),
      },
      out: attestationVerified,
    },
    coreguard_decide_outcome: {
      args: { report: verifiedExec },
      display: { report: use("verification report returned by coreguard_verify_execution") },
      out: outcome,
    },
    coreguard_profile_reference: {
      args: { action: "make", receiptId: consentRecord.receipt?.receiptId ?? consentRecord.receiptId ?? "rcpt-example-0001" },
      out: profileRef,
    },
    coreguard_consumption_status: {
      args: { receiptId: consentRecord.receipt?.receiptId ?? consentRecord.receiptId ?? "rcpt-example-0001", action: "check" },
      out: consumption,
    },
  };
}

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

function renderType(schema) {
  if (schema.enum) return schema.enum.map((v) => `\`${v}\``).join(" \\| ");
  if (schema.oneOf) return schema.oneOf.map(renderType).filter(Boolean).join(" \\| ");
  if (schema.type === "array") return `array of ${renderType(schema.items ?? {}) || "any"}`;
  return schema.type ? `\`${schema.type}\`` : "any";
}

function stripForDocs(value, depth = 0) {
  // Consent records and traces are long; keep them but trim runaway nesting.
  if (depth > 6) return "…";
  if (Array.isArray(value)) return value.map((v) => stripForDocs(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripForDocs(v, depth + 1);
    return out;
  }
  return value;
}

const VOLATILE_KEYS = new Set(["timestamp", "issuedAt", "createdAt", "issuedAtUtc"]);

/** Replace call-time clock fields so the page is reproducible; the note says so. */
function normalizeVolatile(value, hits = { n: 0 }) {
  if (Array.isArray(value)) return value.map((v) => normalizeVolatile(v, hits));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (VOLATILE_KEYS.has(k) && (typeof v === "number" || /^\d{9,13}$/.test(String(v)))) {
        hits.n += 1;
        out[k] = "<unix-seconds at call time>";
      } else {
        out[k] = normalizeVolatile(v, hits);
      }
    }
    return out;
  }
  return value;
}

function abbreviated(value, max = 30) {
  if (Array.isArray(value)) return value.length > max ? [...value.slice(0, max), "…"] : value;
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = abbreviated(v, max);
    return out;
  }
  return value;
}

function section(tool, example) {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const names = Object.keys(props);
  const requiredNames = names.filter((n) => required.has(n));
  const optionalNames = names.filter((n) => !required.has(n));

  const rows = [];
  for (const name of names) {
    const p = props[name];
    const dflt = p.default !== undefined ? `\`${JSON.stringify(p.default)}\`` : "—";
    rows.push(`| \`${name}\` | ${renderType(p)} | ${required.has(name) ? "**required**" : "optional"} | ${dflt} | ${esc(p.description)} |`);
  }

  const body = JSON.stringify(example.display ?? example.args, null, 2);
  const volatileHits = { n: 0 };
  const outBody = JSON.stringify(normalizeVolatile(stripForDocs(example.out), volatileHits), null, 2);
  const schemaBody = JSON.stringify(tool.inputSchema, null, 2);

  const lines = [];
  lines.push(`### \`${tool.name}\``);
  lines.push("");
  lines.push(tool.description);
  lines.push("");
  lines.push(`**Required:** ${requiredNames.length ? requiredNames.map((n) => `\`${n}\``).join(", ") : "none"} · **Optional:** ${optionalNames.length ? optionalNames.map((n) => `\`${n}\``).join(", ") : "none"}`);
  lines.push("");
  lines.push("| Parameter | Type | Required | Default | Description |");
  lines.push("|---|---|---|---|---|");
  lines.push(...rows);
  lines.push("");
  lines.push("<details><summary>Input schema (from tools/list)</summary>");
  lines.push("");
  lines.push("```json");
  lines.push(schemaBody);
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(
    example.display
      ? "**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):"
      : "**Example arguments** (executed against the shipped server, paste as-is):",
  );
  lines.push("");
  lines.push("```json");
  lines.push(body);
  lines.push("```");
  lines.push("");
  lines.push("**Result of that exact call:**");
  lines.push("");
  lines.push("```json");
  lines.push(outBody.length > 1800 ? outBody.slice(0, 1800) + "\n… (abridged — full object is returned by the server)" : outBody);
  lines.push("```");
  if (volatileHits.n > 0) {
    lines.push("");
    lines.push(`<sub>Call-time clock fields (${volatileHits.n}) are shown as placeholders; they are read by the tool, not committed by it.</sub>`);
  }
  if (example.extra?.drifted) {
    lines.push("");
    lines.push(`**Drift variant** — same consent, executed total \`${DRIFTED}\` instead of \`${AMOUNT}\`: verdict \`${example.extra.drifted.verdict}\`, classification \`${esc(example.extra.drifted.risk?.classification ?? "n/a")}\`.`);
  }
  lines.push("");
  return lines.join("\n");
}

function render({ serverInfo, tools, examples }) {
  const list = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  const out = [];
  out.push("# CoreGuard Agent Commerce — MCP tool reference");
  out.push("");
  out.push(`Paste-ready reference for the MCP directory listing. Package \`${pkg.name}@${pkg.version}\`, server \`${server.name ?? "io.github.EslaM-X/coreguard-agent-commerce"}\`, transport **stdio**, protocol \`${serverInfo?.protocolVersion ?? "2025-06-18"}\`.`);
  out.push("");
  out.push(`Generated from \`initialize\` + \`tools/list\` against \`packages/agent-commerce/mcp.mjs\`. Every example arguments block below was executed against that server when this page was built; the shown result is the real response (long consent payloads abridged where marked).`);
  out.push("");
  out.push("**Boundary:** this is an offline, deterministic verification engine. `VERIFIED` means the executed bytes matched the approved bytes — it is not a safety, fraud or settlement guarantee, and no payment, chain or provider is contacted.");
  out.push("");
  out.push(`## Tools (${list.length})`);
  out.push("");
  out.push("| Tool | Required | Optional | Purpose |");
  out.push("|---|---|---|---|");
  for (const t of list) {
    const props = Object.keys(t.inputSchema?.properties ?? {});
    const req = new Set(t.inputSchema?.required ?? []);
    const r = props.filter((p) => req.has(p));
    const o = props.filter((p) => !req.has(p));
    const purpose = esc(t.description);
    const short = purpose.length > 120 ? purpose.slice(0, 117).replace(/\s+\S*$/, "") + "…" : purpose;
    out.push(`| [\`${t.name}\`](#${t.name}) | ${r.length ? r.map((x) => `\`${x}\``).join(", ") : "—"} | ${o.length ? o.map((x) => `\`${x}\``).join(", ") : "—"} | ${short} |`);
  }
  out.push("");
  out.push("---");
  out.push("");
  for (const t of list) {
    const ex = examples[t.name];
    if (!ex) throw new Error(`no executed example for ${t.name}`);
    out.push(section(t, ex));
  }
  out.push("---");
  out.push("");
  out.push("## Calling conventions");
  out.push("");
  out.push("- One JSON-RPC 2.0 object per line over stdio; start with `initialize`, then `tools/list`, then `tools/call`.");
  out.push(`- Every tool accepts an optional \`callerContext\` object echoed back in \`structuredContent.callerContext\`; it is never used as a cryptographic input.`);
  out.push("- Time is never read from the wall clock inside a commitment: pass a pinned `nowSeconds` digit string.");
  out.push("- Errors use a stable contract (`code` + `detail`) and never crash the server; unknown tools, missing arguments and wrong types are rejected before execution.");
  out.push("");
  return out.join("\n");
}

const main = async () => {
  const { content } = await withServer(async (rpc) => {
    const listed = await rpc("tools/list", {});
    const examples = await buildExamples(rpc);
    return {
      content: render({
        serverInfo: { protocolVersion: "2025-06-18", version: pkg.version },
        tools: listed.tools ?? [],
        examples,
      }),
    };
  });

  if (CHECK) {
    if (!existsSync(OUT_PATH)) {
      console.error("missing docs/mcprush/tool-reference.md — run: npm run docs:mcprush");
      process.exit(1);
    }
    const current = readFileSync(OUT_PATH, "utf8");
    if (current !== content) {
      console.error("docs/mcprush/tool-reference.md is stale — run: npm run docs:mcprush");
      process.exit(1);
    }
    console.log("mcprush tool reference: up to date");
    return;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, content);
  const tools = (content.match(/^### `/gm) ?? []).length;
  console.log(`wrote docs/mcprush/tool-reference.md (${tools} tools, every example executed)`);
};

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
