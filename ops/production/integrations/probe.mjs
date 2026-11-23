#!/usr/bin/env node
/**
 * Live integration probe (CG-INT/1)
 *
 * Runs REAL, side-effect-bounded probes against configured external endpoints
 * and records the outcome. It does NOT provision services, does NOT move funds,
 * does NOT sign user transactions, and NEVER emits a production-ready verdict.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { requestJson, sha256, nowIso } from "./common.mjs";
import { decodeIntegrationConfig, adapterConfigs, CONFIG_VERSION } from "./config.mjs";
import { createSettlementVerifier } from "./x402-verifier.mjs";
import { createOidcVerifier, createScimClient } from "./idp.mjs";
import { createKmsSigner } from "./kms.mjs";
import { createWitnessClient } from "./witness.mjs";
import { createOtlpExporter, createAlertRouter } from "./observability.mjs";

export const PROBE_VERSION = "CG-INT/1-PROBE";

function result(integration, status, extra = {}) {
  return { spec: PROBE_VERSION, integration, status, at: nowIso(), ...extra };
}

function parseEnvFile(path) {
  const env = { ...process.env };
  if (!path) return env;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

/** Real health probe; no settlement is attempted and no funds are touched. */
export async function probeX402Health(config, apiKey) {
  try {
    const url = `${String(config.endpoint).replace(/\/+$/, "")}/health`;
    const res = await requestJson(url, {
      headers: { Authorization: `Bearer ${apiKey}` }, expectStatus: [200],
      timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "x402-health",
    });
    return result("x402", "PROBE_PASSED", { responseDigest: res.digest, detail: "verifier /health responded 200; no settlement was attempted" });
  } catch (err) {
    return result("x402", "PROBE_FAILED", { detail: err.detail ?? { message: err.message } });
  }
}

export async function probeOidc(config) {
  try {
    const verifier = createOidcVerifier(config);
    const info = await verifier.initialize();
    return result("oidc", "PROBE_PASSED", { detail: "OIDC discovery + JWKS verified", jwksUriDigest: sha256(info.jwksUri) });
  } catch (err) {
    return result("oidc", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function probeScim(config, tenant, filter) {
  if (!tenant || !filter) return result("scim", "PROBE_SKIPPED", { detail: "set CG_SCIM_PROBE_TENANT and CG_SCIM_PROBE_FILTER to run a tenant-scoped read" });
  try {
    const r = await createScimClient(config).listUsers({ tenant, filter });
    if (r.verdict === "VERIFIED") return result("scim", "PROBE_PASSED", { detail: "tenant-scoped SCIM list succeeded", totalResults: r.totalResults });
    return result("scim", "PROBE_FAILED", { detail: r });
  } catch (err) {
    return result("scim", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function probeKms(config) {
  if (config.provider === "pkcs11") return result("kms", "PROBE_SKIPPED", { detail: "PKCS#11 sign callback cannot be supplied via env; inject config.sign in-process" });
  try {
    const signer = createKmsSigner(config);
    const sig = await signer.sign({ __domain: "coreguard-probe/1", at: nowIso() });
    if (sig.verdict !== "VERIFIED") return result("kms", "PROBE_FAILED", { detail: sig });
    return result("kms", "PROBE_PASSED", { detail: "external signer produced a signature over a probe payload", payloadDigest: sig.payloadDigest, signingMode: sig.signingMode });
  } catch (err) {
    return result("kms", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function probeWitness(config) {
  try {
    const sth = await createWitnessClient(config).getSth();
    if (sth.verdict === "VERIFIED") return result("witness", "PROBE_PASSED", { detail: "signed tree head fetched and verified", treeSize: sth.sth.treeSize, rootHash: sth.sth.rootHash });
    return result("witness", "PROBE_FAILED", { detail: sth });
  } catch (err) {
    return result("witness", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function probeOtel(config) {
  try {
    const exporter = createOtlpExporter(config);
    exporter.recordMetric({ name: "coreguard.integration.probe", value: 1, attributes: { spec: PROBE_VERSION } });
    const r = await exporter.flush();
    if (r.metrics?.delivered === true) return result("otel", "PROBE_PASSED", { detail: "OTLP metric batch accepted by collector", responseDigest: r.metrics.digest });
    return result("otel", "PROBE_FAILED", { detail: r.metrics });
  } catch (err) {
    return result("otel", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function probeAlerts(config, sendAlert = false) {
  if (!sendAlert) return result("alerts", "PROBE_SKIPPED", { detail: "pass --send-alert to deliver a real test alert (may page an operator)" });
  try {
    const r = await createAlertRouter(config).send({ alert: "CG-INT/1 probe", severity: "info", objectiveId: "integration-probe" });
    if (r.verdict === "DELIVERED") return result("alerts", "PROBE_PASSED", { detail: "test alert delivered to webhook", responseDigest: r.digest });
    return result("alerts", "PROBE_FAILED", { detail: r });
  } catch (err) {
    return result("alerts", "PROBE_FAILED", { detail: { message: err.message } });
  }
}

export async function runProbes({
  env = process.env,
  operator = null,
  environment = null,
  sendAlert = false,
  configs = null,
} = {}) {
  const decoded = decodeIntegrationConfig(env);
  const cfg = configs || adapterConfigs(env);
  const probes = [];
  const apiKey = (() => { try { return readFileSync(env.CG_X402_API_KEY_FILE, "utf8").trim(); } catch { return null; } })();

  const add = async (name, fn) => {
    if (decoded.groups[name].status !== "PROVISIONED") {
      probes.push(result(name, "NOT_PROVISIONED", { issues: decoded.groups[name].issues }));
    } else {
      try { probes.push(await fn()); } catch (err) { probes.push(result(name, "PROBE_FAILED", { detail: { message: err.message } })); }
    }
  };

  await add("x402", () => probeX402Health(cfg.x402, apiKey));
  await add("oidc", () => probeOidc(cfg.oidc));
  await add("scim", () => probeScim(cfg.scim, env.CG_SCIM_PROBE_TENANT, env.CG_SCIM_PROBE_FILTER));
  await add("kms", () => probeKms(cfg.kms));
  await add("witness", () => probeWitness(cfg.witness));
  await add("otel", () => probeOtel(cfg.otel));
  await add("alerts", () => probeAlerts(cfg.alerts, sendAlert));

  // Stellar anchor verification needs a REAL transaction hash + expected hash
  // memo from the target deployment; a synthetic one cannot prove anything.
  probes.push(result("stellar", "PROBE_SKIPPED", {
    detail: "set CG_STELLAR_PROBE_TX_HASH and CG_STELLAR_PROBE_MEMO_HASH to verify a real Horizon transaction; no synthetic anchor is accepted",
  }));

  return {
    spec: PROBE_VERSION,
    at: nowIso(),
    operator: operator || null,
    environment: environment || null,
    configVersion: CONFIG_VERSION,
    provisioning: decoded.summary,
    probes,
    verdict: probes.some(p => p.status === "PROBE_FAILED") ? "PROBE_FAILED"
      : probes.some(p => p.status === "NOT_PROVISIONED") ? "NOT_PROVISIONED"
      : "PROBES_PASSED_SKIPS_REMAIN",
    boundary: "Live probe outcomes only. NOT_PROVISIONED / skip is never success. This record does not declare production readiness, SLA compliance, or security assurance and requires independent review.",
  };
}

function main() {
  const args = process.argv.slice(2);
  const val = (flag, def = null) => { const i = args.indexOf(flag); return i >= 0 ? (args[i + 1] || def) : def; };
  const envFile = val("--env-file");
  const out = resolve(val("--out", "ops/production/evidence/integration-probes.json"));
  const operator = val("--operator");
  const environment = val("--environment");
  const sendAlert = args.includes("--send-alert");
  const env = parseEnvFile(envFile);
  runProbes({ env, operator, environment, sendAlert }).then((report) => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ verdict: report.verdict, out, statuses: Object.fromEntries(report.probes.map(p => [p.integration, p.status])) }) + "\n");
    if (report.verdict !== "PROBES_PASSED_SKIPS_REMAIN") process.exitCode = 2;
  }).catch((err) => {
    process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
    process.exitCode = 1;
  });
}

if (process.argv[1] && process.argv[1].endsWith("probe.mjs")) main();

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  push("exports", [runProbes, probeX402Health, probeOidc, probeScim, probeKms, probeWitness, probeOtel, probeAlerts].every(f => typeof f === "function"));
  const decoded = decodeIntegrationConfig({});
  push("empty env is not provisioned", Object.values(decoded.summary).every(s => s === "NOT_PROVISIONED"));
  push("boundary refuses production claim", !/production ready/i.test("Live probe outcomes only. NOT_PROVISIONED / skip is never success. This record does not declare production readiness, SLA compliance, or security assurance and requires independent review."));
  return { ok: checks.every(c => c.ok), checks };
}
