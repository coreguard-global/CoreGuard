#!/usr/bin/env node
/**
 * handover-observer — read an AER-1 handover, recompute it, publish a verdict.
 *
 *   node packages/handover-observer/cli.mjs \
 *     --url https://zambo.dev/handover/<id>.json \
 *     --out evidence/handover-observer/<id>.json \
 *     --html evidence/handover-observer/<id>.html
 *
 *   --file <path>          read a local bundle instead of fetching
 *   --expected-id <uuid>   bind the bundle to an id the caller already holds
 *   --observer <name>      observer identity recorded in the verdict
 *   --read-at <rfc3339>    fix the read time for a reproducible run
 *
 * Exit: 0 = verified, 1 = verification_failed, 2 = unreachable/unreadable,
 * 3 = usage error. A non-zero exit is the point: a gate that always returns 0
 * is a report, not a gate.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyHandover } from "./observer.mjs";
import { decide } from "./receiver.mjs";
import { buildDecisionTrace } from "./trace.mjs";
import { renderReport } from "./render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_MS = 15000;

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}

async function readSource({ url, file }) {
  if (file) {
    const text = readFileSync(resolve(process.cwd(), file), "utf8");
    if (Buffer.byteLength(text) > MAX_BYTES) throw Object.assign(new Error("bundle exceeds 4 MiB"), { code: "TOO_LARGE" });
    return { text, sourceUrl: null };
  }
  if (!url) throw Object.assign(new Error("--url or --file is required"), { code: "USAGE" });
  if (!/^https:\/\//.test(url)) throw Object.assign(new Error("only https sources are accepted"), { code: "USAGE" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "CoreGuard-CG-HANDOVER/1" },
    });
    if (!res.ok) throw Object.assign(new Error(`source answered ${res.status}`), { code: "UNREACHABLE" });
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw Object.assign(new Error("bundle exceeds 4 MiB"), { code: "TOO_LARGE" });
    const text = await res.text();
    if (Buffer.byteLength(text) > MAX_BYTES) throw Object.assign(new Error("bundle exceeds 4 MiB"), { code: "TOO_LARGE" });
    return { text, sourceUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.help) {
    console.log("usage: handover-observer --url <https> | --file <path> [--expected-id <id>] [--observer <name>] [--out <json>] [--html <page>] [--trace <json>] [--read-at <rfc3339>]");
    return 0;
  }

  let source;
  try {
    source = await readSource({ url: a.url, file: a.file });
  } catch (error) {
    const code = error?.code === "USAGE" ? 3 : 2;
    console.error(`handover-observer: ${error?.message ?? error}`);
    return code;
  }

  const readAt = typeof a["read-at"] === "string" ? a["read-at"] : new Date().toISOString();
  const observer = typeof a.observer === "string" ? a.observer : "coreguard-observer:cli";
  const verdict = verifyHandover(source.text, {
    observer,
    readAt,
    expectedId: a["expected-id"],
    sourceUrl: source.sourceUrl,
  });
  const decision = decide(verdict);
  const trace = buildDecisionTrace(verdict, decision);

  const record = {
    observerVersion: verdict.observerVersion,
    readAt,
    source: { url: source.sourceUrl, file: a.file ?? null, bytes: Buffer.byteLength(source.text) },
    verdict,
    decision,
  };
  const json = `${JSON.stringify(record, null, 2)}\n`;

  if (typeof a.out === "string") {
    mkdirSync(dirname(resolve(process.cwd(), a.out)), { recursive: true });
    writeFileSync(resolve(process.cwd(), a.out), json);
    console.log(`verdict: ${a.out}`);
  } else {
    process.stdout.write(json);
  }

  if (typeof a.trace === "string") {
    mkdirSync(dirname(resolve(process.cwd(), a.trace)), { recursive: true });
    writeFileSync(resolve(process.cwd(), a.trace), `${JSON.stringify(trace, null, 2)}\n`);
    console.log(`trace:   ${a.trace}`);
  }

  if (typeof a.html === "string") {
    const html = renderReport(verdict, decision, { generatedAt: readAt });
    mkdirSync(dirname(resolve(process.cwd(), a.html)), { recursive: true });
    writeFileSync(resolve(process.cwd(), a.html), html);
    console.log(`report:  ${a.html}`);
  }

  console.log(`outcome: ${verdict.outcome} · decision: ${decision.decision} · receipts ${verdict.coverage?.receiptsVerified ?? 0}/${verdict.coverage?.steps ?? 0} · digest ${verdict.verdictDigest}`);
  return verdict.outcome === "verified" ? 0 : 1;
}

process.exitCode = await main();
