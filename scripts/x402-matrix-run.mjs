#!/usr/bin/env node
/**
 * x402-matrix-run.mjs — the Node leg of the CG-X402-IDEM/1 second harness.
 *
 * Reads the SAME scenario document that implementations/python/x402_idempotency.py
 * reads, executes it against packages/x402/idempotency.mjs and prints one
 * canonical JSON line. No network, no keys, no settlement, no new MCP surface.
 * VERIFIED ≠ SAFE: this compares state-machine behavior on caller-supplied
 * evidence, not the safety or outcome of any purchase.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  IDEMPOTENCY_SPEC, IDEMPOTENCY_BOUNDARY, createMemoryStore,
  createPurchaseGate, createFacilitatorDedup, intentDigestOf,
} from "../packages/x402/idempotency.mjs";

const DEFAULT_MATRIX = fileURLToPath(
  new URL("../test/fixtures/x402/idempotency-matrix.json", import.meta.url)
);

const NORMALIZE_KEYS = [
  "code", "state", "purchaseId", "expiresAt", "retainedUntil", "replay",
  "artifact", "receipt", "storedIntentDigest", "incomingIntentDigest",
  "detail", "result",
];

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) =>
    JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

/** One comparable shape for both harnesses; only ids, never payloads. */
function normalize(result) {
  const out = {};
  for (const key of NORMALIZE_KEYS) {
    let value = result[key] ?? null;
    if ((key === "artifact" || key === "receipt") && value && typeof value === "object") {
      value = value.id ?? null;
    } else if (key === "result" && value && typeof value === "object") {
      value = value.settlement ?? null;
    }
    out[key] = value;
  }
  return out;
}

function authenticator(cfg) {
  const owner = cfg.owner ?? "buyer-A";
  if (cfg.authMode === "ctx-owner") {
    return (ctx) => (ctx && ctx.owner ? { owner: ctx.owner } : null);
  }
  return (ctx) => (ctx && ctx.token === "ok" ? { owner } : null);
}

function storeFor(cfg) {
  if (cfg.storeMode !== "purchase-only") return createMemoryStore();
  const rows = new Map();
  return {
    insertIfAbsent(key, makeRow) {
      const purchaseId = key.split("\u0000")[1];
      if (rows.has(purchaseId)) return { inserted: false, row: rows.get(purchaseId) };
      const row = makeRow();
      rows.set(purchaseId, row);
      return { inserted: true, row };
    },
    get(key) {
      return rows.get(key.split("\u0000")[1]) ?? null;
    },
    size() { return rows.size; },
  };
}

export function runMatrix(doc) {
  if (doc.spec !== IDEMPOTENCY_SPEC) throw new Error("matrix spec mismatch");
  if (!Array.isArray(doc.cases) || doc.cases.length === 0) throw new Error("matrix has no cases");
  const cases = [];
  for (const item of doc.cases) {
    const cfg = item.gate ?? {};
    let now = cfg.clock ?? 1000;
    const clock = () => now;
    const results = [];
    let gate = null;
    let dedup = null;
    try {
      gate = createPurchaseGate({
        store: storeFor(cfg),
        authenticate: authenticator(cfg),
        clock,
        maxTimeoutSeconds: cfg.maxTimeoutSeconds ?? 60,
        reservationTtlSeconds: cfg.reservationTtlSeconds ?? 90,
        artifactRetentionSeconds: cfg.artifactRetentionSeconds,
      });
      results.push({ code: "CONSTRUCTED" });
    } catch {
      results.push({ code: "THROW" });
    }
    if (item.expectThrow && results.at(-1).code !== "THROW") {
      results.push({ code: "MISSING_THROW" });
    }
    for (const step of item.steps ?? []) {
      if (step.at !== undefined) now = step.at;
      if (step.op === "reserve") {
        results.push(normalize(gate.reserve({
          ctx: step.ctx, purchaseId: step.purchaseId, intentDigest: step.intentDigest,
        })));
      } else if (step.op === "attach") {
        results.push(normalize(gate.attachArtifact({
          ctx: step.ctx, purchaseId: step.purchaseId, intentDigest: step.intentDigest,
          artifact: step.artifact,
        })));
      } else if (step.op === "settle") {
        results.push(normalize(gate.markSettled({
          ctx: step.ctx, purchaseId: step.purchaseId, intentDigest: step.intentDigest,
          receipt: step.receipt,
        })));
      } else if (step.op === "dedup") {
        if (dedup === null) {
          dedup = createFacilitatorDedup({ clock, ttlSeconds: step.ttlSeconds ?? 300 });
        }
        results.push(normalize(dedup.claim({
          payloadDigest: intentDigestOf(step.payload),
          payerVerified: step.payerVerified,
          result: step.result,
        })));
      } else {
        throw new Error("unknown op " + String(step.op));
      }
    }
    cases.push({ name: item.name, results });
  }
  return { spec: IDEMPOTENCY_SPEC, boundary: IDEMPOTENCY_BOUNDARY, cases };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const path = args.find((a) => !a.startsWith("--")) ?? DEFAULT_MATRIX;
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const out = runMatrix(doc);
  if (check) {
    const pinned = new Map(doc.cases.map((c) => [c.name, c.expect ?? null]));
    for (const item of out.cases) {
      const expected = pinned.get(item.name);
      if (expected && canonicalJson(item.results) !== canonicalJson(expected)) {
        console.error(IDEMPOTENCY_SPEC + " MATRIX DRIFT: " + item.name);
        process.exitCode = 1;
        return;
      }
    }
  }
  console.log(canonicalJson(out));
}

main();
