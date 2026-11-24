#!/usr/bin/env node
/**
 * mcp-surface.mjs — one generator for every surface that quotes the MCP tool count.
 *
 * Everything below is derived from the shipped server, never typed by hand:
 *
 *   tools/list                    → count, names, tools digest
 *   coreguard_describe_surface    → the capability card (card + badge string)
 *   skills/STAR/SKILL.md          → the Skills page, skills.json, the inverse tool index
 *
 * Outputs:
 *   docs/assets/badges/mcp-tools.svg        live "MCP tools | N" badge
 *   docs/mcprush/capability-card.json       exact call result + provenance
 *   docs/mcprush/CAPABILITY-CARD.md         quoted card for listings/reviews
 *   docs/SKILLS.html                        the public skills page
 *   docs/skills.json                        machine-readable skills index (with digests)
 *   docs/MCPRUSH-LISTING.md                 generated blocks between markers
 *
 *   node scripts/mcp-surface.mjs            # write
 *   node scripts/mcp-surface.mjs --check    # fail if any output is stale
 *
 * Offline · deterministic · zero keys. No timestamps in any artifact.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const CHECK = process.argv.includes("--check");

const MCP_PATH = resolve(ROOT, "packages/agent-commerce/mcp.mjs");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "packages/agent-commerce/package.json"), "utf8"));

const OUT = {
  badge: resolve(ROOT, "docs/assets/badges/mcp-tools.svg"),
  cardJson: resolve(ROOT, "docs/mcprush/capability-card.json"),
  cardMd: resolve(ROOT, "docs/mcprush/CAPABILITY-CARD.md"),
  skillsHtml: resolve(ROOT, "docs/SKILLS.html"),
  skillsJson: resolve(ROOT, "docs/skills.json"),
  listing: resolve(ROOT, "docs/MCPRUSH-LISTING.md"),
};

// Tool families, in the order the surface is presented. A tool that is not
// listed here still appears (fail closed): the generator appends an
// "Other" group rather than silently dropping it from the page.
const FAMILIES = [
  { key: "consent", label: "Consent + execution", tools: ["coreguard_authorize", "coreguard_verify_consent", "coreguard_verify_execution", "coreguard_assess_risk", "coreguard_inspect_identity", "coreguard_build_attestation", "coreguard_verify_attestation", "coreguard_decide_outcome", "coreguard_profile_reference", "coreguard_consumption_status"] },
  { key: "machine", label: "x402 + machine economy", tools: ["coreguard_parse_x402_challenge", "coreguard_authorize_x402_payment", "coreguard_verify_x402_settlement", "coreguard_reconcile_payment", "coreguard_meter_agent_usage", "coreguard_register_machine", "coreguard_create_machine_task", "coreguard_verify_telemetry", "coreguard_verify_task_completion", "coreguard_verify_delegation_chain"] },
  { key: "cgcp", label: "CGCP/1 control plane", tools: ["coreguard_create_intent", "coreguard_issue_receipt", "coreguard_verify_receipt", "coreguard_check_limits", "coreguard_revoke_consent", "coreguard_audit_transaction"] },
  { key: "reasoning", label: "Wave 3 · policy reasoning + MCP supply chain", tools: ["coreguard_compile_policy", "coreguard_explain_decision", "coreguard_simulate_spend", "coreguard_diff_policies", "coreguard_generate_boundary_cases", "coreguard_audit_server_manifest", "coreguard_scan_tool_descriptions", "coreguard_check_lookalike", "coreguard_diff_tool_surface", "coreguard_verify_evidence_bundle"] },
  { key: "evidence", label: "Wave 3 · evidence + operations + interop", tools: ["coreguard_redact_receipt", "coreguard_attest_batch", "coreguard_verify_batch_proof", "coreguard_freeze_agent", "coreguard_budget_runway", "coreguard_detect_spend_anomaly", "coreguard_incident_timeline", "coreguard_translate_receipt", "coreguard_emit_test_vectors", "coreguard_describe_surface"] },
];

const sha256 = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// Live surface (stdio JSON-RPC, same server a client runs)
// ---------------------------------------------------------------------------

async function readSurface() {
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
    if (!waiter) return;
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
      pending.set(id, { resolve: (v) => (clearTimeout(timer), resolveP(v)), reject: (e) => (clearTimeout(timer), rejectP(e)) });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  try {
    const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-surface-generator", version: "1" } });
    const list = await rpc("tools/list", {});
    const unwrap = (r) => r?.structuredContent ?? JSON.parse(r?.content?.[0]?.text ?? "null");
    const card = unwrap(await rpc("tools/call", { name: "coreguard_describe_surface", arguments: { format: "card" } }));
    const badge = unwrap(await rpc("tools/call", { name: "coreguard_describe_surface", arguments: { format: "badge" } }));
    return {
      protocolVersion: init?.protocolVersion ?? "2025-06-18",
      serverInfo: init?.serverInfo ?? { name: "coreguard-agent-commerce", version: pkg.version },
      tools: (list?.tools ?? []).map((t) => ({ name: t.name, description: t.description })),
      card,
      badge,
    };
  } finally {
    child.stdin.end();
    child.kill();
  }
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function parseSkill(dir) {
  const file = join(ROOT, "skills", dir, "SKILL.md");
  const raw = readFileSync(file, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${dir}: SKILL.md is missing its YAML frontmatter`);
  const field = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m")) ?? [])[1]?.trim();
  const name = field("name");
  const description = field("description");
  if (!name || !description) throw new Error(`${dir}: frontmatter must carry name and description`);
  const body = raw.slice(fm[0].length);
  const intro = (body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "").trim();
  const whenToUse = [...body.matchAll(/^## When to use\n([\s\S]*?)(?=^## |\s*$)/gm)]
    .flatMap((m) => [...m[1].matchAll(/^- (.+)$/gm)].map((x) => x[1].trim()));
  const tools = [...new Set([...body.matchAll(/`(coreguard_[a-z0-9_]+)`/g)].map((m) => m[1]))];
  const boundaries = [...body.matchAll(/^## Boundaries\n([\s\S]*?)$/gm)].map((m) => m[1].trim()).join(" ").trim();
  return {
    dir,
    name,
    description,
    intro,
    whenToUse,
    tools,
    boundaries,
    path: `skills/${dir}/SKILL.md`,
    digest: sha256(raw),
    bytes: Buffer.byteLength(raw),
  };
}

function loadSkills() {
  const dirs = readdirSync(join(ROOT, "skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const skills = dirs.map(parseSkill).sort((a, b) => a.name.localeCompare(b.name));
  for (const s of skills) {
    const unknown = s.tools.filter((t) => !surfaceToolNames.has(t));
    if (unknown.length) throw new Error(`${s.name}: references tools the server does not expose: ${unknown.join(", ")}`);
  }
  return skills;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderBadge(count) {
  const label = "MCP tools";
  const value = String(count);
  const left = 8 + label.length * 6.6 + 10;
  const right = 10 + value.length * 8 + 12;
  const w = Math.round(left + right);
  const lw = Math.round(left);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 20" width="${w}" height="20" role="img" aria-label="${label}: ${value}">
<title>${label}: ${value}</title>
<rect width="${w}" height="20" rx="3" fill="#0B0F14"/>
<rect x="${lw}" width="${w - lw}" height="20" rx="3" fill="#FF8A00"/>
<rect x="${lw}" width="1" height="20" fill="#FFFFFF" fill-opacity="0.35"/>
<text x="${Math.round(lw / 2)}" y="14" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" fill="#C7D2DE">${label}</text>
<text x="${Math.round(lw + (w - lw) / 2)}" y="14" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="700" fill="#0B0F14">${value}</text>
</svg>
`;
}

function renderSkillCard(s, toolIndex) {
  const chips = s.tools.length
    ? s.tools.map((t) => `<a class="chip" href="https://github.com/coreguard-global/CoreGuard/blob/main/docs/mcprush/tool-reference.md#${t}">${esc(t.replace(/^coreguard_/, ""))}</a>`).join("")
    : `<span class="chip">no tools referenced</span>`;
  const bullets = s.whenToUse.length ? `<ul>${s.whenToUse.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  return `<article class="skill" id="${esc(s.name)}">
  <div class="skill-h"><h3>${esc(s.name)}</h3><a class="src" href="https://github.com/coreguard-global/CoreGuard/blob/main/${esc(s.path)}">SKILL.md</a></div>
  <p class="desc">${esc(s.description)}</p>
  ${bullets}
  <div class="chips">${chips}</div>
  <div class="meta">${s.tools.length} tool${s.tools.length === 1 ? "" : "s"} · ${s.bytes} bytes · <code>${esc(s.digest.slice(0, 23))}…</code></div>
</article>`;
}

function renderSkillsPage(surface, skills) {
  const count = surface.tools.length;
  const toolIndex = new Map();
  for (const s of skills) for (const t of s.tools) toolIndex.set(t, [...(toolIndex.get(t) ?? []), s.name]);
  const covered = [...toolIndex.keys()].sort();
  const rows = covered
    .map((t) => `<tr><td><a href="https://github.com/coreguard-global/CoreGuard/blob/main/docs/mcprush/tool-reference.md#${t}"><code>${esc(t)}</code></a></td><td>${toolIndex.get(t).map((n) => `<a href="#${esc(n)}">${esc(n)}</a>`).join(", ")}</td></tr>`)
    .join("\n");
  const cards = skills.map((s) => renderSkillCard(s, toolIndex)).join("\n");
  return `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CoreGuard Agent Skills — ${skills.length} procedures for a ${count}-tool MCP server</title>
<meta name="description" content="Ready-to-load agent skills for CoreGuard Agent Commerce: purchase guard, MCP server due diligence, tool-poisoning triage, spend control, receipt forensics, impersonation checks, surface drift, freeze drills, x402 and ACP interop.">
<meta name="theme-color" content="#0B0F14"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="canonical" href="https://coreguard-global.github.io/CoreGuard/SKILLS.html">
<style>
:root{--bg:#0B0F14;--l:#26323f;--ink:#F5F7FA;--mu:#9aabbd;--o:#FF8A00;--o2:#FFB347;--g:#22c55e}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 600px at 80% -10%,rgba(255,138,0,.14),transparent 60%),var(--bg);color:var(--ink);font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}.w{max-width:1120px;margin:0 auto;padding:0 22px}
header{padding:64px 0 34px;border-bottom:1px solid var(--l)}
.k{display:inline-flex;gap:8px;align-items:center;font:600 11px/1.3 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--o);border:1px solid rgba(255,138,0,.35);border-radius:99px;padding:6px 12px}
h1{font-size:clamp(32px,5vw,54px);line-height:1.06;margin:20px 0 14px;letter-spacing:-.02em}
h1 em{font-style:normal;background:linear-gradient(90deg,var(--o),var(--o2));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--mu);max-width:760px;font-size:17px}
.badges{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:22px}
.badges img{display:block;height:20px}
.pill{font:700 11px ui-monospace,monospace;padding:5px 10px;border-radius:99px;border:1px solid var(--l);color:var(--mu)}
section{padding:52px 0;border-top:1px solid var(--l)}
h2{font-size:clamp(24px,3.4vw,34px);margin:10px 0 8px}h2 em{font-style:normal;color:var(--o)}
.sub{color:var(--mu);max-width:760px}
.grid{display:grid;gap:16px;margin-top:26px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.skill{border:1px solid var(--l);border-radius:20px;padding:22px;background:linear-gradient(180deg,rgba(18,25,34,.92),rgba(11,15,20,.92))}
.skill-h{display:flex;gap:12px;align-items:baseline;justify-content:space-between}
.skill h3{margin:0;font-size:18px;color:var(--ink)}
.src{font:600 11px ui-monospace,monospace;color:var(--o);text-decoration:none}
.desc{color:#c7d2de;margin:10px 0}.skill ul{margin:8px 0 0;padding-inline-start:18px;color:var(--mu);font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.chip{font:600 11px ui-monospace,monospace;padding:4px 9px;border-radius:99px;border:1px solid rgba(255,138,0,.35);background:rgba(255,138,0,.07);color:var(--o2);text-decoration:none}
.meta{margin-top:12px;color:#7f8fa1;font:500 11px ui-monospace,monospace}
pre{white-space:pre-wrap;word-break:break-word;background:#0B0F14;border:1px solid var(--l);border-radius:16px;padding:16px;font-size:12.5px;color:#cbd5e1}
table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}th,td{border:1px solid var(--l);padding:9px 11px;text-align:start;vertical-align:top}th{color:var(--o2);background:#121922}td code{color:#e0b64c}
.note{border-left:3px solid var(--o);padding:6px 14px;color:var(--mu);margin-top:22px}
footer{padding:40px 0 70px;color:#7f8fa1;font-size:13px}
@media(max-width:720px){header{padding:44px 0 26px}}
</style></head><body>
<header><div class="w">
  <span class="k">CoreGuard · Agent skills</span>
  <h1>Procedures an agent can <em>load, not improvise.</em></h1>
  <p class="lead">${skills.length} skills that turn the ${count}-tool Agent Commerce MCP server into repeatable, auditable procedures: bind an approval, vet a server before install, triage poisoned metadata, freeze an agent, prove a receipt later. Every skill is a folder with a <code>SKILL.md</code>; every tool it names is one the server actually exposes.</p>
  <div class="badges">
    <img src="assets/badges/mcp-tools.svg" alt="MCP tools: ${count}">
    <span class="pill">offline · deterministic</span>
    <span class="pill">zero keys</span>
    <span class="pill">VERIFIED ≠ SAFE</span>
    <a class="pill" href="https://github.com/coreguard-global/CoreGuard/blob/main/docs/mcprush/tool-reference.md">tool reference</a>
    <a class="pill" href="DOCS.html">docs</a>
  </div>
</div></header>
<section><div class="w">
  <h2>Install in <em>one copy.</em></h2>
  <p class="sub">Skills are plain folders. Copy the set into your runtime's skills directory, or point the runtime at this folder. The server is registered once.</p>
  <pre>mkdir -p .claude/skills &amp;&amp; cp -r skills/* .claude/skills/
# mcp client config
{"mcpServers":{"coreguard":{"command":"npx","args":["-y","@coreguard/agent-commerce@${esc(surface.serverInfo.version)}"]}}}</pre>
  <div class="note">No skill here claims a tool is safe, a merchant honest or a payment settled. Each one ends with the boundary it cannot cross.</div>
</div></section>
<section><div class="w">
  <h2>The ${skills.length} <em>skills.</em></h2>
  <p class="sub">Each card links to its <code>SKILL.md</code> and to the tools it calls. The chips are generated from the file's own text, so a skill that names a missing tool fails the build instead of shipping.</p>
  <div class="grid">
${cards}
  </div>
</div></section>
<section><div class="w">
  <h2>Tool → skill <em>index.</em></h2>
  <p class="sub">The inverse view: for each tool the skills reference, which procedure to load. ${covered.length} of ${count} tools are referenced by at least one skill; the rest are documented in the <a href="https://github.com/coreguard-global/CoreGuard/blob/main/docs/mcprush/tool-reference.md">tool reference</a>.</p>
  <table><thead><tr><th>Tool</th><th>Skills</th></tr></thead><tbody>
${rows}
  </tbody></table>
</div></section>
<footer><div class="w">Generated from <code>tools/list</code> and <code>skills/*/SKILL.md</code> by <code>scripts/mcp-surface.mjs</code> — do not edit by hand. Server <code>${esc(surface.serverInfo.name)}@${esc(surface.serverInfo.version)}</code>, protocol <code>${esc(surface.protocolVersion)}</code>.</div></footer>
</body></html>
`;
}

function renderCardJson(surface, skills) {
  return {
    schema: "CG-CC/1",
    generatedFrom: ["initialize", "tools/list", "coreguard_describe_surface"],
    server: surface.serverInfo,
    protocolVersion: surface.protocolVersion,
    toolCount: surface.tools.length,
    toolsDigest: sha256(JSON.stringify(surface.tools.map((t) => t.name))),
    capabilities: surface.card,
    badge: surface.badge.badge,
    skills: { count: skills.length, names: skills.map((s) => s.name), digest: sha256(JSON.stringify(skills.map((s) => [s.name, s.digest]))) },
    boundary: surface.card.boundary,
  };
}

function renderCardMd(card, surface) {
  const listed = JSON.stringify({ ...card, capabilities: { ...card.capabilities, tools: card.toolCount } }, null, 2);
  return `# Capability card — quoted from the server

Generated by \`scripts/mcp-surface.mjs\`. \`docs/mcprush/capability-card.json\` is the
machine-readable form of this exact call result; paste the block below into a
listing, review or buyer package instead of typing a version or a tool count.

**Call:** \`tools/call coreguard_describe_surface { "format": "card" }\` against
\`${surface.serverInfo.name}@${surface.serverInfo.version}\`.

**One-line quote:**

> ${card.capabilities.server} ${surface.serverInfo.version} — ${card.toolCount} MCP tools, stdio, protocol ${surface.protocolVersion}. Offline · deterministic · zero keys · no custody · no broadcast · \`VERIFIED ≠ SAFE\`.

**Badge markdown:**

\`\`\`markdown
![MCP tools: ${card.toolCount}](https://coreguard-global.github.io/CoreGuard/assets/badges/mcp-tools.svg)
\`\`\`

**Verbatim call result (as returned by the server):**

\`\`\`json
${listed}
\`\`\`

**What the card does not say:** it is a capability declaration, not a security
audit. It never claims a merchant, chain, provider or settlement is safe.
`;
}

function renderListingBlock(surface, card) {
  const rows = FAMILIES.map((f) => `| ${f.label} (${f.tools.length}) | ${f.tools.map((t) => `\`${t}\``).join(", ")} |`).join("\n");
  return `<!-- generated: mcp-surface — run \u0060npm run docs:surface\u0060, do not edit -->
**Generated from \u0060tools/list\u0060** — server \u0060${surface.serverInfo.name}@${surface.serverInfo.version}\u0060, protocol \u0060${surface.protocolVersion}\u0060, **${surface.tools.length} tools**, tools digest \u0060${sha256(JSON.stringify(surface.tools.map((t) => t.name)))}\u0060.

| Group | Tools |
|---|---|
${rows}

**Quoted capability card** (from \u0060coreguard_describe_surface\u0060; full JSON in [\`docs/mcprush/CAPABILITY-CARD.md\`](./mcprush/CAPABILITY-CARD.md)):

> ${card.capabilities.server} ${surface.serverInfo.version} — ${surface.tools.length} MCP tools, stdio, protocol ${surface.protocolVersion}. Offline · deterministic · zero keys · no custody · no broadcast · \`VERIFIED ≠ SAFE\`.

**Badge:** ![MCP tools: ${surface.tools.length}](./assets/badges/mcp-tools.svg)
<!-- /generated: mcp-surface -->`;
}

function renderShortDescription(surface) {
  const line = `Fail-closed consent receipts and execution verification for agentic purchases. ${surface.tools.length} offline MCP tools, zero keys, no network.`;
  const limit = 200;
  return `<!-- generated: listing-short — run \u0060npm run docs:surface\u0060, do not edit -->
\`\`\`
${line}
\`\`\`

<sub>${line.length}/${limit} characters · tool count read from \u0060tools/list\u0060 at generation time.</sub>
<!-- /generated: listing-short -->`;
}

const BLOCK = {
  short: { begin: "<!-- generated: listing-short", end: "<!-- /generated: listing-short -->" },
  surface: { begin: "<!-- generated: mcp-surface", end: "<!-- /generated: mcp-surface -->" },
};

function replaceBlock(markdown, block, content) {
  const start = markdown.indexOf(block.begin);
  if (start === -1) throw new Error(`docs/MCPRUSH-LISTING.md is missing the ${block.begin} marker`);
  const end = markdown.indexOf(block.end, start);
  if (end === -1) throw new Error(`docs/MCPRUSH-LISTING.md is missing the ${block.end} closing marker`);
  return markdown.slice(0, start) + content + markdown.slice(end + block.end.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let surfaceToolNames = new Set();

const main = async () => {
  const surface = await readSurface();
  surfaceToolNames = new Set(surface.tools.map((t) => t.name));
  if (surface.tools.length !== surface.card.tools) {
    throw new Error(`tools/list says ${surface.tools.length} tools but the capability card says ${surface.card.tools}`);
  }
  const skills = loadSkills();
  const card = renderCardJson(surface, skills);

  const outputs = new Map([
    [OUT.badge, renderBadge(surface.tools.length)],
    [OUT.cardJson, JSON.stringify(card, null, 2) + "\n"],
    [OUT.cardMd, renderCardMd(card, surface)],
    [OUT.skillsJson, JSON.stringify({ schema: "CG-SK/1", server: surface.serverInfo, toolCount: surface.tools.length, skills, boundary: card.boundary }, null, 2) + "\n"],
    [OUT.skillsHtml, renderSkillsPage(surface, skills)],
  ]);

  let listing = readFileSync(OUT.listing, "utf8");
  listing = replaceBlock(listing, BLOCK.short, renderShortDescription(surface));
  listing = replaceBlock(listing, BLOCK.surface, renderListingBlock(surface, card));
  outputs.set(OUT.listing, listing);

  if (CHECK) {
    const stale = [...outputs.entries()].filter(([path, content]) => !existsSync(path) || readFileSync(path, "utf8") !== content).map(([path]) => path.replace(ROOT + "/", ""));
    if (stale.length) {
      console.error(`stale generated surface: ${stale.join(", ")}`);
      console.error("run: npm run docs:surface");
      process.exit(1);
    }
    console.log(`mcp surface: up to date (${surface.tools.length} tools, ${skills.length} skills)`);
    return;
  }

  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(`wrote ${outputs.size} artifacts · ${surface.tools.length} tools · ${skills.length} skills · ${surface.serverInfo.name}@${surface.serverInfo.version}`);
};

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
