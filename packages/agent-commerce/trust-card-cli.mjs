#!/usr/bin/env node
/**
 * coreguard-trust-card — one command, one publishable trust card.
 *
 *   coreguard-trust-card --server-json server.json --tools-list tools.json --out trust-card.md
 *   coreguard-trust-card --server-json server.json --stdio "npx -y @scope/server" --out card.md
 *
 * Inputs:
 *   --server-json <file>   an MCP registry record (server.json)
 *   --tools-list <file>    a tools/list result: array, {tools:[...]} or JSON-RPC
 *   --stdio "<command>"    alternatively, run a stdio MCP server and read tools/list
 *   --name <label>         override the name printed on the card
 *   --date <YYYY-MM-DD>    card date; omitted by default so runs stay byte-identical
 *   --url <https://…>      published card URL, embedded in the paste-ready summary
 *   --out <file|->         markdown destination (default: stdout)
 *   --json <file>          also write the machine-readable sidecar
 *   --tools-out <file>     also write the normalised tools/list used for the card
 *   --check                do not write: fail if the existing --out/--json files differ
 *   --fail-on none|medium|high   gate (default none; the GitHub Action defaults to high)
 *   --timeout <ms>         stdio handshake timeout (default 45000)
 *
 * Exit codes:
 *   0  card generated (and the gate, if any, passed)
 *   1  gate tripped, or --check found drift
 *   2  usage or input error — no card is written
 *
 * Offline by construction except for an explicitly requested --stdio command,
 * which runs locally. No wall clock is read; --date is caller-supplied.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { buildTrustCard, parseToolsList, toolsListShape, exitCodeFor, TRUST_CARD_SPEC } from "./trust-card.mjs";

const USAGE = `coreguard-trust-card (${TRUST_CARD_SPEC})

usage:
  coreguard-trust-card --server-json <file> (--tools-list <file> | --stdio "<command>") [options]

required:
  --server-json <file>    MCP registry server record
  one of:
    --tools-list <file>   tools/list JSON (array, {tools} or JSON-RPC response)
    --stdio "<command>"   run a stdio MCP server and request tools/list

options:
  --name <label>          override the server name on the card
  --date <YYYY-MM-DD>     card date (omitted by default: output stays deterministic)
  --url <https://…>       published card URL in the paste-ready summary
  --out <file|->          markdown destination (default stdout)
  --json <file>           machine-readable sidecar
  --tools-out <file>      normalised tools/list used for the card
  --check                 compare with existing --out/--json instead of writing
  --fail-on none|medium|high   exit 1 at this verdict (default none)
  --timeout <ms>          stdio handshake timeout (default 45000)
  -h, --help

exit: 0 card produced · 1 gate tripped or drift · 2 usage/input error`;

function usageError(message) {
  const err = new Error(message);
  err.code = 2;
  return err;
}

function parseArgs(argv) {
  const opts = { out: "-", failOn: "none", timeout: 45000, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw usageError(`${a} needs a value`);
      return v;
    };
    if (a === "--server-json") opts.serverJson = next();
    else if (a === "--tools-list") opts.toolsList = next();
    else if (a === "--stdio") opts.stdio = next();
    else if (a === "--name") opts.name = next();
    else if (a === "--date") opts.date = next();
    else if (a === "--url") opts.url = next();
    else if (a === "--out") opts.out = next();
    else if (a === "--json") opts.jsonOut = next();
    else if (a === "--tools-out") opts.toolsOut = next();
    else if (a === "--fail-on") opts.failOn = next();
    else if (a === "--timeout") opts.timeout = Number(next());
    else if (a === "--check") opts.check = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw usageError(`unknown argument: ${a}`);
  }
  return opts;
}

function readJson(file, label) {
  let text;
  try {
    text = readFileSync(resolve(file), "utf8");
  } catch (err) {
    throw usageError(`${label}: cannot read ${file}: ${err?.message ?? err}`);
  }
  try {
    return { text, value: JSON.parse(text) };
  } catch (err) {
    throw usageError(`${label}: ${file} is not valid JSON: ${err?.message ?? err}`);
  }
}

/**
 * Minimal stdio MCP handshake: initialize, initialized, tools/list.
 * Anything the server writes on stderr is kept for the failure message.
 */
export function captureToolsList(command, { timeoutMs = 45000, spawnImpl = spawn } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(command, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;
    let initialized = false;
    const timer = setTimeout(() => finish(new Error(`stdio handshake timed out after ${timeoutMs}ms`)), timeoutMs);

    const send = (message) => {
      child.stdin.write(JSON.stringify(message) + "\n");
    };
    function finish(err, value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        child.stdin.end();
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
      if (err) reject(err);
      else resolvePromise(value);
    }

    child.on("error", (err) => finish(new Error(`cannot start stdio command: ${err?.message ?? err}`)));
    child.on("exit", (code) => {
      if (!done) finish(new Error(`stdio server exited (code ${code}) before returning tools/list${stderr ? `: ${stderr.trim().slice(-400)}` : ""}`));
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      let newline;
      while ((newline = stdout.indexOf("\n")) !== -1) {
        const line = stdout.slice(0, newline).trim();
        stdout = stdout.slice(newline + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // servers may log on stdout; only JSON-RPC lines matter
        }
        if (msg.id === 1 && msg.result && !initialized) {
          initialized = true;
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
        } else if (msg.id === 2) {
          if (msg.error) return finish(new Error(`tools/list failed: ${JSON.stringify(msg.error)}`));
          if (!Array.isArray(msg.result?.tools)) return finish(new Error("tools/list result has no tools array"));
          finish(null, msg.result.tools);
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "coreguard-trust-card", version: "1.0.0" } },
    });
  });
}

function ensureDir(file) {
  mkdirSync(dirname(resolve(file)), { recursive: true });
}

function compare(file, expected, label) {
  let actual;
  try {
    actual = readFileSync(resolve(file), "utf8");
  } catch {
    throw usageError(`${label}: ${file} does not exist yet — run the command without --check`);
  }
  if (actual !== expected) {
    const err = new Error(`${label}: ${file} is stale — regenerate it with this command`);
    err.code = 1;
    throw err;
  }
}

export async function runTrustCardCli(argv = process.argv.slice(2), io = {}) {
  const log = io.log ?? ((s) => process.stdout.write(String(s) + "\n"));
  const err = io.err ?? ((s) => process.stderr.write(String(s) + "\n"));
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    err(`trust-card: ${error.message}`);
    err(USAGE);
    return { code: 2 };
  }
  if (opts.help) {
    log(USAGE);
    return { code: 0 };
  }
  if (!opts.serverJson) {
    err("trust-card: --server-json <file> is required");
    return { code: 2 };
  }
  if (Boolean(opts.toolsList) === Boolean(opts.stdio)) {
    err("trust-card: pass exactly one of --tools-list <file> or --stdio \"<command>\" — a card without a scanned tool surface is not issued");
    return { code: 2 };
  }

  try {
    const { value: manifest } = readJson(opts.serverJson, "server.json");
    let tools;
    let toolsShape;
    let toolsLabel;
    if (opts.toolsList) {
      const { value } = readJson(opts.toolsList, "tools/list");
      tools = parseToolsList(value);
      toolsShape = toolsListShape(value);
      toolsLabel = opts.toolsList;
    } else {
      tools = await captureToolsList(opts.stdio, { timeoutMs: opts.timeout });
      toolsShape = "json-rpc";
      toolsLabel = `stdio: ${opts.stdio}`;
    }

    const card = buildTrustCard({
      manifest,
      tools,
      name: opts.name,
      date: opts.date,
      url: opts.url,
      toolsShape,
      sources: { manifest: opts.serverJson, tools: toolsLabel },
    });

    const jsonText = JSON.stringify(card.json, null, 2) + "\n";
    if (opts.check) {
      if (opts.out === "-") throw usageError("--check needs --out <file>");
      compare(opts.out, card.markdown, "trust card");
      if (opts.jsonOut) compare(opts.jsonOut, jsonText, "trust card JSON");
      log(`trust-card: up to date (${card.verdict}, ${card.json.tools.count} tools, ${card.cardDigest.slice(0, 23)}…)`);
      return { code: exitCodeFor(card.verdict, opts.failOn), result: card };
    }

    if (opts.out === "-") {
      log(card.markdown.replace(/\n$/, ""));
    } else {
      ensureDir(opts.out);
      writeFileSync(resolve(opts.out), card.markdown);
      log(`trust-card: wrote ${opts.out} (${card.verdict}, ${card.json.tools.count} tools, ${card.cardDigest})`);
    }
    if (opts.jsonOut) {
      ensureDir(opts.jsonOut);
      writeFileSync(resolve(opts.jsonOut), jsonText);
      if (opts.out !== "-") log(`trust-card: wrote ${opts.jsonOut}`);
    }
    if (opts.toolsOut) {
      ensureDir(opts.toolsOut);
      writeFileSync(resolve(opts.toolsOut), JSON.stringify(tools, null, 2) + "\n");
      log(`trust-card: wrote ${opts.toolsOut} (${tools.length} tools)`);
    }
    const code = exitCodeFor(card.verdict, opts.failOn);
    if (code !== 0) err(`trust-card: gate --fail-on ${opts.failOn} tripped by verdict ${card.verdict}`);
    return { code, result: card };
  } catch (error) {
    err(`trust-card: ${error.message}`);
    return { code: error.code === 1 ? 1 : 2 };
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  runTrustCardCli().then(({ code }) => {
    process.exitCode = code;
  });
}
