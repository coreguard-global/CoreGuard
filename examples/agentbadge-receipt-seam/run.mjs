#!/usr/bin/env node
/**
 * AgentBadge × CoreGuard — authorization-evidence seam (synthetic demo)
 *
 * Shows how an agent payment accept gate can consume { receipt_id, profile }
 * as verifiable authorization evidence:
 *   1. resolve the named record (content-addressed id proves the bytes),
 *   2. verify signature, key trust, intent binding and execution match,
 *   3. map the outcome to a payment decision (ALLOW / ALLOW_UNVERIFIED / HOLD / DECLINE).
 *
 * Synthetic, offline, deterministic in structure (fresh keys per run unless
 * you treat it as a demo). No network, no chain, no PSP, no real funds.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { generateIssuerKey, signAttestation, verifyAttestation } from "../../packages/agent-commerce/anchor.mjs";
import { createKeyring, pinKey, verifyWithTrust } from "../../packages/agent-commerce/trust.mjs";
import { resolveReceipt, resolutionOutcome } from "../../packages/agent-commerce/reference.mjs";
import { decidePayment } from "../../packages/agent-commerce/decision.mjs";
import { canonicalize } from "../../packages/canonical/index.js";

const RECEIPT_SCHEMA = "coreguard.var1.receipt/1";
const RECEIPT_PROFILE = "VAR/1";

function sha256Hex(buf) { return createHash("sha256").update(buf).digest("hex"); }
function digestOf(value) { return "sha256:" + sha256Hex(Buffer.from(canonicalize(value), "utf8")); }
function canonicalBytes(value) { return canonicalize(value); }
function lineTotal(items) { let sum = 0; for (const it of items ?? []) sum += (it.qty ?? 0) * (it.unit_minor ?? 0); return sum; }

const APPROVED_FIELDS = Object.freeze(["merchant_id", "payee", "total_minor", "currency"]);
const LINE_FIELDS = Object.freeze(["name", "qty", "unit_minor"]);
function fieldDrift(approved, executed) {
  const diffs = [];
  for (const f of APPROVED_FIELDS) {
    if (canonicalize(approved?.[f] ?? null) !== canonicalize(executed?.[f] ?? null)) {
      diffs.push({ field: f, approved: approved?.[f] ?? null, executed: executed?.[f] ?? null });
    }
  }
  const a = new Map((approved?.items ?? []).map((i) => [i.sku, i]));
  const e = new Map((executed?.items ?? []).map((i) => [i.sku, i]));
  for (const sku of new Set([...a.keys(), ...e.keys()])) {
    const ai = a.get(sku), ei = e.get(sku);
    if (!ai) { diffs.push({ field: `items[${sku}]`, approved: null, executed: ei }); continue; }
    if (!ei) { diffs.push({ field: `items[${sku}]`, approved: ai, executed: null }); continue; }
    for (const f of LINE_FIELDS) {
      if (canonicalize(ai[f] ?? null) !== canonicalize(ei[f] ?? null)) {
        diffs.push({ field: `items[${sku}].${f}`, approved: ai[f] ?? null, executed: ei[f] ?? null });
      }
    }
  }
  return diffs;
}

function buildReceipt({ merchant, approved, approvalNonce, executed, at, privateKeyPem }) {
  const body = {
    schema: RECEIPT_SCHEMA,
    profile: RECEIPT_PROFILE,
    issued_at: at,
    merchant: { id: merchant.id, name: merchant.name ?? merchant.id },
    approval: { intent: approved, intent_digest: digestOf(approved), approval_nonce: approvalNonce },
    execution: executed,
  };
  const attestation = signAttestation({ subject: { kind: "var1-receipt", digest: digestOf(body) }, issuedAt: at, privateKeyPem });
  const bytes = canonicalBytes({ body, attestation });
  return { body, attestation, bytes, receiptId: "urn:sha256:" + sha256Hex(Buffer.from(bytes, "utf8")) };
}

function inspectReceipt({ bytes, expectedIntent, keyring }) {
  const checks = [];
  const add = (name, ok, detail = null) => checks.push(detail === null ? { name, ok } : { name, ok, detail });
  let parsed;
  try { parsed = JSON.parse(bytes); add("bytes parse as JSON", true); }
  catch (e) { add("bytes parse as JSON", false, e?.message); return { outcome: "VERIFICATION_FAILED", checks, drift: [] }; }
  const body = parsed?.body, attestation = parsed?.attestation;
  add(`schema is ${RECEIPT_SCHEMA}`, body?.schema === RECEIPT_SCHEMA);
  add("profile is VAR/1", body?.profile === RECEIPT_PROFILE);
  let bodyDigest = null;
  try { bodyDigest = digestOf(body); add("body has canonical bytes", true); }
  catch (e) { add("body has canonical bytes", false, e?.message); }
  add("attestation subject is the body", bodyDigest !== null && attestation?.subject?.digest === bodyDigest);
  const sig = verifyAttestation(attestation);
  add("attestation signature verifies", sig.ok);
  let internalIntentOk = false;
  try { internalIntentOk = digestOf(body?.approval?.intent) === body?.approval?.intent_digest; } catch {}
  add("receipt intent matches its digest", internalIntentOk);
  add("issued_at equals attestation time", body?.issued_at === attestation?.issuedAt);
  let trust = null;
  if (keyring) {
    trust = verifyWithTrust(attestation, keyring);
    add(`issuer key trusted at issuedAt (${trust.keyStatus})`, trust.ok, { keyStatus: trust.keyStatus });
  } else {
    add("keyring supplied", false);
  }
  const expectedDigest = expectedIntent ? digestOf(expectedIntent) : null;
  const namedDigest = body?.approval?.intent_digest ?? null;
  add("receipt names the intent the verifier holds", expectedDigest !== null && namedDigest === expectedDigest);
  const drift = expectedIntent ? fieldDrift(expectedIntent, body?.execution) : [];
  add("executed fields equal approved fields", drift.length === 0, drift.length > 0 ? drift : null);
  const sum = lineTotal(body?.execution?.items);
  add("executed total equals sum of lines", body?.execution?.total_minor === sum, { total_minor: body?.execution?.total_minor ?? null, line_sum: sum });

  let outcome;
  if (!body || body?.schema !== RECEIPT_SCHEMA || attestation?.subject?.digest !== bodyDigest || !sig.ok || !internalIntentOk || body?.issued_at !== attestation?.issuedAt) {
    outcome = "VERIFICATION_FAILED";
  } else if (!trust || !trust.ok) {
    outcome = trust?.outcome ?? "NOT_CHECKED";
  } else if (namedDigest !== expectedDigest || drift.length > 0 || body?.execution?.total_minor !== sum) {
    outcome = "VERIFICATION_FAILED";
  } else {
    outcome = "VERIFIED";
  }
  return { outcome, checks, drift, keyStatus: trust?.keyStatus ?? "unknown", signatureOk: sig.ok };
}

function parseArgs(argv) {
  const opts = { out: null, policy: "balanced" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") opts.out = argv[++i];
    else if (argv[i] === "--policy") opts.policy = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") { opts.help = true; }
  }
  return opts;
}

async function gateEvaluate({ reference, bytes, expectedIntent, keyring, policy, label }) {
  // 1) resolve by name (inline bytes are one possible source; omit when absent)
  const resolveOpts = { reference };
  if (bytes != null) resolveOpts.inline = { bytes };
  const resolution = await resolveReceipt(resolveOpts);
  let evidenceOutcome, detail = {};
  if (resolution.state === "resolved") {
    const inspection = inspectReceipt({ bytes: resolution.bytes, expectedIntent, keyring });
    evidenceOutcome = inspection.outcome;
    detail = { resolutionState: resolution.state, source: resolution.source, keyStatus: inspection.keyStatus, drift: inspection.drift, failedChecks: inspection.checks.filter(c => !c.ok).map(c => c.name) };
  } else {
    const mapped = resolutionOutcome(resolution);
    evidenceOutcome = mapped.outcome; // e.g. tampered->VERIFICATION_FAILED, unresolvable->UNRESOLVABLE_RECORD
    detail = { resolutionState: resolution.state, reason: resolution.reason, mappedOutcome: mapped.outcome, checks: resolution.checks };
  }
  const decision = decidePayment({ outcome: evidenceOutcome, policy });
  return { label, reference, evidenceOutcome, decision, detail };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write("Usage: node examples/agentbadge-receipt-seam/run.mjs [--policy strict|balanced|availability] [--out <dir>]\n");
    return;
  }
  const policy = opts.policy;
  const at = "2026-11-19T12:00:00Z";

  const issuer = generateIssuerKey();
  const other = generateIssuerKey();
  const trustedRing = pinKey(createKeyring({ id: "gate-verifier" }), { publicKeyPem: issuer.publicKeyPem, issuer: "merchant-startup" });
  const emptyRing = createKeyring({ id: "unpinned" });

  const intent = {
    merchant_id: "merchant-sandbox-books",
    payee: "acct_sandbox_books",
    currency: "USD",
    total_minor: 12900,
    items: [
      { sku: "BOOK-001", name: "The Honest Ledger", qty: 1, unit_minor: 8900 },
      { sku: "BOOK-002", name: "Proof of Work", qty: 1, unit_minor: 4000 },
    ],
  };
  const approvalNonce = "nonce-agentbadge-seam-demo";
  const executedOk = { ...intent, order_ref: "order-1", executed_at: at };
  const good = buildReceipt({ merchant: { id: intent.merchant_id, name: "Sandbox Books" }, approved: intent, approvalNonce, executed: executedOk, at, privateKeyPem: issuer.privateKeyPem });

  const driftedExec = { ...intent, total_minor: intent.total_minor + 500, order_ref: "order-2", executed_at: at };
  const drifted = buildReceipt({ merchant: { id: intent.merchant_id, name: "Sandbox Books" }, approved: intent, approvalNonce, executed: driftedExec, at, privateKeyPem: issuer.privateKeyPem });

  const scenarios = [];
  scenarios.push(await gateEvaluate({ reference: { receiptId: good.receiptId, profile: "VAR/1" }, bytes: good.bytes, expectedIntent: intent, keyring: trustedRing, policy, label: "verified receipt, pinned key" }));
  scenarios.push(await gateEvaluate({ reference: { receiptId: good.receiptId, profile: "VAR/1" }, bytes: good.bytes, expectedIntent: intent, keyring: emptyRing, policy, label: "valid signature, unpinned key" }));
  const tamperedBytes = good.bytes.replace('"total_minor":12900', '"total_minor":12901');
  scenarios.push(await gateEvaluate({ reference: { receiptId: good.receiptId, profile: "VAR/1" }, bytes: tamperedBytes, expectedIntent: intent, keyring: trustedRing, policy, label: "tampered bytes for content-addressed id" }));
  const deadId = "urn:sha256:" + "0".repeat(64);
  scenarios.push(await gateEvaluate({ reference: { receiptId: deadId, profile: "VAR/1" }, bytes: null, expectedIntent: intent, keyring: trustedRing, policy, label: "unresolvable receipt_id (no source answered)" }));
  scenarios.push(await gateEvaluate({ reference: { receiptId: drifted.receiptId, profile: "VAR/1" }, bytes: drifted.bytes, expectedIntent: intent, keyring: trustedRing, policy, label: "valid signature, execution drift" }));

  const expected = [
    { label: "verified receipt, pinned key", evidence: "VERIFIED", decision: "ALLOW" },
    { label: "valid signature, unpinned key", evidence: "NOT_CHECKED", decision: "ALLOW_UNVERIFIED" },
    { label: "tampered bytes for content-addressed id", evidence: "VERIFICATION_FAILED", decision: "DECLINE" },
    { label: "unresolvable receipt_id (no source answered)", evidence: "UNRESOLVABLE_RECORD", decision: "HOLD" },
    { label: "valid signature, execution drift", evidence: "VERIFICATION_FAILED", decision: "DECLINE" },
  ];

  const rows = scenarios.map((s, i) => {
    const exp = expected[i];
    const pass = s.evidenceOutcome === exp.evidence && s.decision.decision === exp.decision;
    return { ...s, expected: exp, pass };
  });

  const out = {
    demo: "agentbadge-receipt-seam",
    schema: "coreguard.demo.agentbadge-seam/1",
    profile: "VAR/1",
    policy,
    receipt_id_example: good.receiptId,
    scenarios: rows.map(r => ({ label: r.label, reference: r.reference, evidenceOutcome: r.evidenceOutcome, decision: r.decision.decision, code: r.decision.code, unverified: r.decision.unverified, reason: r.decision.reason, detail: r.detail, pass: r.pass })),
    allPass: rows.every(r => r.pass),
    boundary: [
      "Synthetic local demo: no third-party merchant, PSP, customer, auditor, or endorsement.",
      "No network fetch and no chain/wallet/settlement broadcast.",
      "ALLOW means presented checks passed; it is not a safety, delivery, or fraud guarantee.",
      "ALLOW_UNVERIFIED must remain visible to downstream systems (never a silent pass).",
    ],
  };

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`AgentBadge × CoreGuard authorization-evidence seam (synthetic, policy=${policy})`);
  console.log(`receipt_id + profile -> resolve -> verify -> decide\n`);
  console.log(`${pad("scenario", 42)} ${pad("evidence", 22)} ${pad("decision", 18)} pass`);
  console.log("-".repeat(92));
  for (const r of rows) {
    console.log(`${pad(r.label, 42)} ${pad(r.evidenceOutcome, 22)} ${pad(r.decision.decision, 18)} ${r.pass ? "PASS" : "FAIL"}`);
  }
  console.log("-".repeat(92));
  console.log(`overall: ${out.allPass ? "PASS" : "FAIL"}`);
  console.log(`example receipt_id: ${good.receiptId}`);

  if (opts.out) {
    const dir = resolve(opts.out);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "report.json"), JSON.stringify(out, null, 2) + "\n");
    const md = [
      `# AgentBadge × CoreGuard seam demo report`,
      ``,
      `- policy: \`${policy}\``,
      `- overall: **${out.allPass ? "PASS" : "FAIL"}**`,
      `- example receipt_id: \`${good.receiptId}\``,
      ``,
      `| Scenario | Evidence | Decision | Pass |`,
      `|---|---|---|---|`,
      ...rows.map(r => `| ${r.label} | ${r.evidenceOutcome} | ${r.decision.decision} | ${r.pass ? "PASS" : "FAIL"} |`),
      ``,
      `## Boundary`,
      ...out.boundary.map(b => `- ${b}`),
      ``,
    ].join("\n");
    writeFileSync(resolve(dir, "REPORT.md"), md);
    console.log(`wrote ${resolve(dir, "report.json")} and REPORT.md`);
  }

  process.exit(out.allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
