#!/usr/bin/env node
/**
 * CoreGuard Agent Risk Engine (AGR/1) — standalone CLI + assessment persistence.
 *
 * Deterministic authorization-drift assessment over the committed AGR/1 taxonomy.
 * Reads a JSON input (intent, policy, trace, optional consumed flag), produces
 * the risk report, and can persist assessments for later audit.
 *
 * Usage:
 *   node packages/agent-commerce/risk-cli.mjs assess --input <file> [--out <file>] [--ledger <file>]
 *   node packages/agent-commerce/risk-cli.mjs --input <file> [--out <file>] [--ledger <file>]
 *
 * Input JSON shape:
 *   { "intent": {...}, "policy": {...}, "trace": {...}, "consumed": false,
 *     "receiptOutcome": "ABSENT" }
 *   (policy, consumed and receiptOutcome are optional; classes are frozen per AGR/1)
 *
 * receiptOutcome is a CG-OUT/1 outcome (or a CG-OUT/1 result object). When it
 * says ABSENT or NOT_CHECKED the CLI still exits 0 and still prints a report,
 * whose classification is NO_DECISION: there is nothing to assess, and printing
 * CLEAN would assert an authorization that was never presented.
 *
 * Persistence:
 *   --out <file>    write the assessment report as JSON (overwritten/created)
 *   --ledger <file> append one JSONL record per assessment (persisted audit trail)
 *
 * Exit codes:
 *   0  assessment produced (CLEAN or VIOLATIONS — both are valid, fail-closed results)
 *   1  input/usage error (no assessment produced)
 *
 * BOUNDARY (standing): deterministic rule taxonomy — never a probabilistic fraud
 * score; VERIFIED ≠ SAFE; the actor is declared, never detected. This CLI reads
 * no wall clock and performs no network I/O.
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessRisk, AGR_VERSION, RISK_CLASSES } from "./risk.mjs";

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "usage: node packages/agent-commerce/risk-cli.mjs [assess] --input <file> [--out <file>] [--ledger <file>]",
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  if (args[0] === "assess") args.shift();
  const out = { input: null, out: null, ledger: null, help: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--input" || a === "-i") out.input = args[++i];
    else if (a === "--out" || a === "-o") out.out = args[++i];
    else if (a === "--ledger" || a === "-l") out.ledger = args[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else usage(`unknown argument: ${a}`);
  }
  return out;
}

function ensureDir(filePath) {
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

export function runRiskCli(argv = process.argv.slice(2), io = {}) {
  const log = io.log ?? ((s) => process.stdout.write(String(s) + "\n"));
  const err = io.err ?? ((s) => process.stderr.write(String(s) + "\n"));
  const opts = parseArgs(argv);
  if (opts.help) {
    log("CoreGuard Agent Risk Engine CLI (" + AGR_VERSION + ")");
    log("Classes (frozen): " + Object.keys(RISK_CLASSES).join(", "));
    log("Boundary: deterministic rule taxonomy — never a probabilistic fraud score; VERIFIED ≠ SAFE");
    log("Usage: node packages/agent-commerce/risk-cli.mjs [assess] --input <file> [--out <file>] [--ledger <file>]");
    return { code: 0 };
  }
  if (!opts.input) {
    err("risk-cli: --input <file> is required");
    return { code: 1 };
  }

  let input;
  try {
    input = JSON.parse(readFileSync(resolve(opts.input), "utf8"));
  } catch (e) {
    err("risk-cli: failed to read/parse input: " + (e && e.message ? e.message : e));
    return { code: 1 };
  }
  if (!input || typeof input.intent !== "object" || !input.trace) {
    err("risk-cli: input must include intent and trace objects");
    return { code: 1 };
  }

  let report;
  try {
    report = assessRisk({
      intent: input.intent,
      policy: input.policy,
      trace: input.trace,
      consumed: input.consumed === true,
      receiptOutcome: input.receiptOutcome ?? null,
    });
  } catch (e) {
    err("risk-cli: assessment refused: " + (e && e.message ? e.message : e));
    return { code: 1 };
  }

  const json = JSON.stringify(report, null, 2);

  if (opts.out) {
    try {
      ensureDir(opts.out);
      writeFileSync(resolve(opts.out), json + "\n", "utf8");
    } catch (e) {
      err("risk-cli: failed to write --out: " + (e && e.message ? e.message : e));
      return { code: 1 };
    }
  }

  if (opts.ledger) {
    try {
      ensureDir(opts.ledger);
      const record = {
        spec: AGR_VERSION,
        classification: report.classification,
        ...(report.authorization ? { authorization: report.authorization } : {}),
        violations: report.violations.map((v) => v.code),
        report,
      };
      appendFileSync(resolve(opts.ledger), JSON.stringify(record) + "\n", "utf8");
    } catch (e) {
      err("risk-cli: failed to append --ledger: " + (e && e.message ? e.message : e));
      return { code: 1 };
    }
  }

  log(json);
  return { code: 0, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runRiskCli();
  process.exit(result.code);
}
