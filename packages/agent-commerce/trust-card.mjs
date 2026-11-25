/**
 * CoreGuard trust cards (CG-TC/1) — turn a server record and a tools/list into
 * one publishable page.
 *
 * This module is the product surface behind `coreguard_audit_server_manifest`
 * and `coreguard_scan_tool_descriptions`: a deterministic composition of both
 * checks plus the inventory, digests and the honesty boundary a listing needs.
 *
 * It performs no I/O, reads no wall clock and calls no network. The CLI wraps
 * it; the MCP tools stay available for agents that want the raw structures.
 */

import { auditServerManifest, scanToolDescriptions, digestOf } from "./wave3.mjs";

export const TRUST_CARD_SPEC = "CG-TC/1";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Accept an array, {tools}, a JSON-RPC tools/list response, or {result:{tools}}. */
export function parseToolsList(text) {
  let parsed;
  try {
    parsed = typeof text === "string" ? JSON.parse(text) : text;
  } catch (err) {
    throw new Error(`tools/list is not valid JSON: ${err?.message ?? err}`);
  }
  const tools = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.tools)
      ? parsed.tools
      : Array.isArray(parsed?.result?.tools)
        ? parsed.result.tools
        : null;
  if (!tools) throw new Error("tools/list must be an array, {tools:[...]} or a JSON-RPC tools/list response");
  if (tools.some((t) => !t || typeof t !== "object" || !str(t.name))) {
    throw new Error("every tool needs a non-empty name");
  }
  return tools;
}

/** Detect the JSON-RPC envelope so the card can state what the bytes were. */
export function toolsListShape(text) {
  let parsed;
  try {
    parsed = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return "unknown";
  }
  if (Array.isArray(parsed)) return "array";
  if (Array.isArray(parsed?.tools)) return "object";
  if (Array.isArray(parsed?.result?.tools)) return "json-rpc";
  return "unknown";
}

/**
 * Structural verdict. Deliberately conservative:
 *   BLOCKED — a HIGH manifest finding or a DANGEROUS description scan.
 *   REVIEW  — anything medium/suspicious, plus any manifest-only card.
 *   PASS    — no structural finding at all. PASS is not SAFE.
 */
export function verdictFor(manifestAudit, scan, coverage) {
  const reasons = [];
  if (!coverage.tools) reasons.push("TOOLS_LIST_MISSING: descriptions were not scanned, so the surface is not covered");
  if (manifestAudit.risk === "high") reasons.push("MANIFEST_HIGH: at least one HIGH-severity manifest finding");
  if (scan.verdict === "DANGEROUS") reasons.push("TOOLS_DANGEROUS: at least one HIGH-severity description finding");
  if (reasons.length > 0) return { verdict: "BLOCKED", reasons };
  if (manifestAudit.risk === "medium" || scan.verdict === "SUSPICIOUS" || !coverage.manifest) reasons.push("REVIEW_REQUIRED: medium-severity findings or missing manifest");
  if (manifestAudit.findings.length > 0) reasons.push(`${manifestAudit.findings.length} informational/low manifest finding(s)`);
  return { verdict: reasons.length > 0 ? "REVIEW" : "PASS", reasons };
}

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const short = (s, n = 96) => {
  const v = String(s ?? "");
  return v.length <= n ? v : v.slice(0, n - 1) + "…";
};
const code = (v) => "`" + String(v).replace(/`/g, "'") + "`";

function findingsTable(findings) {
  if (findings.length === 0) return "_No manifest findings._";
  const rows = findings.map(
    (f) => `| ${code(f.id)} | ${f.severity} | ${esc(f.detail)}${f.evidence === undefined || f.evidence === null ? "" : ` — ${code(short(JSON.stringify(f.evidence), 120))}`} |`,
  );
  return ["| Finding | Severity | Detail |", "|---|---|---|", ...rows].join("\n");
}

/**
 * Build the card.
 *
 * @param {object} input
 * @param {object} input.manifest            server.json record
 * @param {Array}  [input.tools]             tools/list entries
 * @param {object} [input.sources]           { manifest: label, tools: label }
 * @param {string} [input.date]              YYYY-MM-DD, caller-supplied (no wall clock here)
 * @param {string} [input.url]               published URL, if any
 * @param {string} [input.toolsShape]        array | object | json-rpc
 */
export function buildTrustCard(input = {}) {
  const manifest = input.manifest;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("server.json must be a JSON object");
  }
  const tools = Array.isArray(input.tools) ? input.tools : null;
  if (!tools) throw new Error("tools/list is required: a card that has not scanned the tool surface is not a trust card");
  if (input.date !== undefined && input.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.date))) {
    throw new Error("--date must be YYYY-MM-DD");
  }

  const coverage = { manifest: true, tools: true };
  const manifestAudit = auditServerManifest({ manifest });
  const scan = scanToolDescriptions({ tools });
  const { verdict, reasons } = verdictFor(manifestAudit, scan, coverage);

  const serverName = str(input.name) ?? manifestAudit.serverName ?? str(manifest.name) ?? "unnamed server";
  const version = manifest.version ?? "unpinned";
  const toolsDigest = digestOf(tools);
  const sources = { manifest: input.sources?.manifest ?? "server.json", tools: input.sources?.tools ?? "tools/list" };
  const cardDigest = digestOf({
    spec: TRUST_CARD_SPEC,
    server: serverName,
    version,
    verdict,
    manifestDigest: manifestAudit.manifestDigest,
    toolsDigest,
    toolsCount: tools.length,
    date: input.date ?? null,
  });

  const byTool = new Map();
  for (const f of scan.findings) {
    const list = byTool.get(f.tool) ?? [];
    list.push(f);
    byTool.set(f.tool, list);
  }
  const inventory = tools
    .map((t, i) => {
      const hits = byTool.get(String(t.name)) ?? [];
      const status = hits.length === 0 ? "clean" : hits.some((h) => h.severity === "HIGH") ? "**FLAGGED**" : "review";
      return `| ${i + 1} | ${code(short(t.name, 48))} | ${short(t.description, 80) || "—"} | ${status} |`;
    })
    .join("\n");

  const flagged = scan.findings.length === 0
    ? "_No hidden characters, HTML comments or imperative phrases were found in any tool description._"
    : scan.findings
        .map((f) => `- ${code(f.tool)} — ${f.kind}${f.codepoint ? ` ${f.codepoint}` : f.phrase ? ` "${esc(f.phrase)}"` : ""} at offset ${f.index} (${f.severity})`)
        .join("\n");

  const lines = [
    `# Trust card — ${serverName} ${version}`,
    "",
    `> **Verdict: ${verdict}** · manifest risk \`${manifestAudit.risk}\` · tool descriptions \`${scan.verdict}\` · ${tools.length} tools`,
    ">",
    "> Generated by CoreGuard (`CG-TC/1`) from the published server record and a live `tools/list`. Structural audit only: it executes nothing and contacts no network. **PASS ≠ SAFE; absence of findings is not proof of safety.**",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Server | ${esc(serverName)} |`,
    `| Version | ${code(version)} |`,
    `| Transport | ${manifestAudit.transport} |`,
    `| Tools | ${tools.length} — ${code(toolsDigest)} |`,
    `| Manifest digest | ${code(manifestAudit.manifestDigest)} |`,
    `| Card digest | ${code(cardDigest)} |`,
    `| Sources | record: ${code(sources.manifest)} · tools: ${code(sources.tools)} |`,
    ...(input.date ? [`| Card date | ${code(input.date)} |`] : []),
    "",
    "## Why this verdict",
    "",
    ...(reasons.length === 0 ? ["_No structural finding was raised. That is all this card can say._"] : reasons.map((r) => `- ${r}`)),
    "",
    "## Server-record findings",
    "",
    findingsTable(manifestAudit.findings),
    "",
    "## Tool-description scan",
    "",
    `Scanned ${tools.length} descriptions. Findings: ${scan.counts.findings} (${scan.counts.high} high, ${scan.counts.medium} medium).`,
    "",
    flagged,
    "",
    "## Tool inventory",
    "",
    "| # | Tool | Description (truncated) | Scan |",
    "|---|---|---|---|",
    inventory,
    "",
    "## What was checked",
    "",
    "- Server record: pinned version and package, declared distribution, transport, repository provenance, secret-shaped environment variables.",
    "- Tool descriptions: bidi overrides, Unicode tag/smuggling characters, zero-width and soft-hyphen characters, HTML comments, and a fixed imperative-phrase list.",
    "- Binding: both digests are embedded above, so a changed record or a single changed description changes the card digest.",
    "",
    "## What this does not prove",
    "",
    "- It does not execute the server, its package, or its remote endpoint.",
    "- It does not review source code, permissions, data handling, licensing, or the payment behaviour of any tool.",
    "- It does not detect every poisoning technique; the phrase list is fixed and the scanner is intentionally narrow.",
    "- A clean card is a starting point for review, not an approval.",
    "",
    "## Reproduce",
    "",
    "```bash",
    `coreguard-trust-card \\`,
    `  --server-json ${sources.manifest === "server.json" ? "server.json" : sources.manifest} \\`,
    `  --tools-list ${sources.tools === "tools/list" ? "tools.json" : sources.tools} \\`,
    `  --out trust-card.md`,
    "```",
    "",
    "Same inputs and same `--date` produce the same card digest. Verify it by re-running and comparing the digest line.",
    "",
    "<!-- paste-ready summary for a listing page -->",
    "",
    `> **Trust card:** ${verdict} · manifest risk \`${manifestAudit.risk}\` · tool descriptions \`${scan.verdict}\` · ${tools.length} tools · card \`${cardDigest}\``,
    `> Structural audit by CoreGuard (CG-TC/1) from the server record and a live \`tools/list\`. PASS ≠ SAFE.${input.url ? ` Full card: ${input.url}` : ""}`,
    "",
  ];

  const json = {
    spec: TRUST_CARD_SPEC,
    server: { name: serverName, version, transport: manifestAudit.transport },
    verdict,
    reasons,
    coverage,
    manifest: {
      digest: manifestAudit.manifestDigest,
      risk: manifestAudit.risk,
      findings: manifestAudit.findings,
      counts: manifestAudit.counts,
    },
    tools: {
      count: tools.length,
      digest: toolsDigest,
      shape: input.toolsShape ?? "unknown",
      scan: { verdict: scan.verdict, counts: scan.counts, findings: scan.findings },
    },
    sources,
    cardDigest,
    ...(input.date ? { date: input.date } : {}),
    ...(input.url ? { url: input.url } : {}),
    boundary: "structural audit only; executes nothing; PASS ≠ SAFE",
  };

  return { markdown: lines.join("\n"), json, verdict, cardDigest, manifestAudit, scan };
}

/** Exit status for the gate: 0 below the threshold, 1 at/above it. */
export function exitCodeFor(verdict, failOn = "high") {
  const rank = { PASS: 0, REVIEW: 1, BLOCKED: 2 };
  const threshold = { none: 99, high: 2, medium: 1 }[failOn];
  if (threshold === undefined) throw new Error("--fail-on must be none, medium or high");
  return rank[verdict] >= threshold ? 1 : 0;
}
