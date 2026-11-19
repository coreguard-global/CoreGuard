#!/usr/bin/env node
/**
 * VAR/1 pilot kit — one command, fifteen rows, one report.
 *
 * What it runs, against a real HTTP merchant on loopback:
 *
 *   APPROVE      the merchant commits the approval by digest
 *   EXECUTE      it executes and signs a VAR/1 receipt
 *   RESOLVE      the receipt is fetched by its content-addressed id
 *   VERIFY       signature, pin, intent binding and field-by-field execution
 *   PIN          a valid receipt from an unpinned key is NOT_CHECKED, not forged
 *   CONSUME      the approval is spent once, and only once
 *   REPLAY       the same log refuses the second claim
 *   CONFLICT     a second system with a different nonce produces `conflict`
 *   RACE         four real processes, one approval, exactly one winner
 *   IDEMPOTENT   the same HTTP order returns the same receipt, not a second one
 *   TAMPER       a mirror on the right path serves wrong bytes -> refused by id
 *   DRIFT        a valid signature over a surcharged execution -> refused by field
 *   DEAD NAME    a content-addressed name nobody can produce -> HOLD
 *   ABSENT       a locator that answers nothing -> ALLOW_UNVERIFIED, labelled
 *   DECISIONS    the four outcomes map to the four decisions, asserted
 *
 * Exit 0 only when every row is the row it should be. Any other result exits 1,
 * because a pilot that passes by accident is worse than no pilot.
 *
 * BOUNDARY: local reference merchant, synthetic order, no account, no chain,
 * no broadcast. This is a harness, not a customer reference. See README.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { generateIssuerKey, keyIdFor } from "../../packages/agent-commerce/anchor.mjs";
import {
  planResolution,
  resolutionOutcome,
  resolveReceipt,
} from "../../packages/agent-commerce/reference.mjs";
import { createKeyring, pinKey } from "../../packages/agent-commerce/trust.mjs";
import { checkSpent, claimSpend, mergeLogs, readSpendLog } from "../../packages/agent-commerce/spend.mjs";
import { decidePayment } from "../../packages/agent-commerce/decision.mjs";

import { PILOT_VERSION, digestOf, fetchBytes, fieldDrift, lineTotal, seededKey } from "./lib.mjs";
import { buildReceipt, inspectReceipt } from "./receipt.mjs";
import { startHostileMirror, startMerchantSandbox } from "./merchant-sandbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const HELP = `VAR/1 pilot kit — a local merchant, a signed receipt, a stranger's check.

  node examples/var1-pilot-kit/run.mjs [options]

  --out <dir>      where report.json, REPORT.md and the logs are written
  --seed <hex>     reproduce the merchant key and receipt bytes (64 hex chars)
  --at <iso>       fix the clock, e.g. 2026-06-01T00:00:00Z (default: now)
  --policy <name>  strict | balanced | availability (default: balanced)
  --quiet          write the report, print only the summary
  --help           this text

Exit 0 only when every step lands exactly where the report says it should.
`;

function parseArgs(argv) {
  const opts = { out: null, seed: null, at: null, policy: "balanced", quiet: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") opts.out = argv[++i];
    else if (arg === "--seed") opts.seed = argv[++i];
    else if (arg === "--at") opts.at = argv[++i];
    else if (arg === "--policy") opts.policy = argv[++i];
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (opts.seed !== null && !/^[0-9a-f]{64}$/i.test(opts.seed)) throw new Error("--seed needs exactly 64 hex characters");
  if (opts.at !== null && Number.isNaN(Date.parse(opts.at))) throw new Error("--at needs an ISO-8601 timestamp");
  if (!["strict", "balanced", "availability"].includes(opts.policy)) throw new Error(`unknown policy: ${opts.policy}`);
  return opts;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${json?.error ?? "request_failed"}: ${json?.detail ?? ""}`);
  return json;
}

function runRaceWorker(payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [join(HERE, "race-worker.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("race worker timed out"));
    }, 15000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`race worker exited ${code}: ${err.trim()}`));
      try {
        const lines = out.trim().split("\n");
        resolvePromise(JSON.parse(lines[lines.length - 1]));
      } catch (e) {
        reject(e);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

const stable = (value) => JSON.parse(JSON.stringify(value));

function markdownReport(report) {
  const rows = report.steps
    .map((s) => `| ${s.id} | ${s.title} | ${s.expect} | ${s.actual} | ${s.result} |`)
    .join("\n");
  const decisions = report.decisions
    .map((d) => `| ${d.outcome} | ${d.source} | ${d.decision.decision} | ${d.decision.code ?? "—"} |`)
    .join("\n");
  const limits = report.limits.map((l) => `- ${l}`).join("\n");
  const checks = report.verification.checks
    .map((c) => `- ${c.ok ? "PASS" : "FAIL"} — ${c.name}`)
    .join("\n");
  const drift = report.verification.drift.length === 0
    ? "- none: the executed order equals the approved order field for field"
    : report.verification.drift.map((d) => `- ${d.field}: approved ${JSON.stringify(d.approved)}, executed ${JSON.stringify(d.executed)}`).join("\n");

  return `# VAR/1 pilot report — ${report.verdict}

Run \`${report.runId}\` at ${report.at}, policy \`${report.policy}\`, against a local
reference merchant on ${report.sandbox.origin.replace(/^http:\/\//, "")}.

**${report.steps.filter((s) => s.result === "PASS").length}/${report.steps.length} rows landed where the report said they would.** The receipt is
\`${report.receipt.receipt_id}\`, its bytes hash to
\`${report.receipt.bytes_sha256}\`, and it verifies offline against the key pinned at
\`${report.receipt.key_id}\`.

## The arc

| # | Step | Expected | Actual | Result |
|---|---|---|---|---|
${rows}

## The receipt

- id: \`${report.receipt.receipt_id}\`
- bytes: \`${report.receipt.bytes_sha256}\`
- body digest (the attestation's subject): \`${report.receipt.body_digest}\`
- issuer key id: \`${report.receipt.key_id}\`
- signature: \`${report.receipt.signature_prefix}…\`
- source: ${report.resolution.source} (${report.resolution.state}), ${report.resolution.bytes} bytes

Every check the verifier ran on those bytes:

${checks}

Field-by-field comparison of the executed order against the order the verifier
approved before execution:

${drift}

## The four decisions

| Outcome | Where it came from | Decision | Code |
|---|---|---|---|
${decisions}

Only a failed check declines. A dead name holds. An empty locator allows without
verification and carries \`unverified: true\`. The table is CG-DECIDE/1, not a
reading of the run.

## What this run proves

- A content-addressed receipt can be fetched, verified and consumed with no
  account, no vendor call and no key handed to the verifier beyond one pin.
- A valid signature over a surcharged execution is still refused, and the field
  is named (\`total_minor\`), because the binding check is between the receipt and
  the order the verifier already held — not between the receipt and itself.
- Wrong bytes on the right path are refused by the id before the signature is
  consulted. A locator proves where, never what.
- Two systems that both thought they were first produce \`conflict\`, not a
  second charge. Four real processes produce exactly one winner.
- A dead name, an empty locator and an unpinned key are three different rows,
  and none of them is printed as a pass.

## What this run does not prove

${limits}

## Reproduce

The same seed and clock reproduce these receipt bytes:

\`node examples/var1-pilot-kit/run.mjs --seed ${report.seedHex ?? "<64 hex>"} --at ${report.at} --out ${report.outDir}-repro\`

Receipt bytes are deterministic for a given seed and clock. Consumption rows are stateful (spend logs live in the output directory), so rerunning into the same \`--out\` reuses that ledger and will refuse already-spent rows by design; use a fresh \`--out\` to reproduce the full run.

The exit code is the verdict: 0 only if every row above is PASS.
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  const at = opts.at ?? new Date().toISOString();
  const seedHex = opts.seed ?? randomBytes(32).toString("hex");
  const runId = `var1-${at.replace(/[:.]/g, "-").replace(/Z$/, "")}-${seedHex.slice(0, 8)}`;
  const outDir = resolve(opts.out ?? join(HERE, "artifacts", runId));
  mkdirSync(outDir, { recursive: true });

  const print = (line) => {
    if (!opts.quiet) process.stdout.write(line + "\n");
  };

  const steps = [];
  const record = ({ id, title, expect, actual, ok, detail = null, ms = null }) => {
    steps.push({ id, title, expect, actual, result: ok ? "PASS" : "FAIL", detail, ms });
    print(`  ${String(id).padStart(2, " ")}  ${ok ? "PASS" : "FAIL"}  ${title}  [${actual}]`);
    return ok;
  };

  print("");
  print("VAR/1 pilot — one command, a local merchant, and the checks that refuse");
  print(`  at ${at} · policy ${opts.policy} · ${opts.seed ? "reproducible seed" : "fresh key"}`);
  print("");

  // The merchant holds the private key. The verifier receives the public key
  // out of band, exactly as it would from a key directory or a signed email.
  const merchantKey = opts.seed ? { ...seededKey(seedHex), keyId: null } : { ...generateIssuerKey(), keyId: null };
  merchantKey.keyId = keyIdFor(merchantKey.publicKeyPem);
  const verifierKey = generateIssuerKey();

  const sandbox = await startMerchantSandbox({
    key: merchantKey,
    merchant: { id: "merchant-sandbox-books", name: "Sandbox Books" },
    at,
  });
  const keyring = pinKey(createKeyring({ id: "pilot-verifier" }), {
    publicKeyPem: merchantKey.publicKeyPem,
    issuer: "merchant startup console",
  });

  print(`  merchant  ${sandbox.origin}  (${sandbox.merchant.name})`);
  print(`  pinned    ${merchantKey.keyId.slice(0, 16)}…  out of band, not from /keys`);
  print("");

  const mirrors = [];
  try {
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
    if (lineTotal(intent.items) !== intent.total_minor) throw new Error("fixture total does not match its lines");

    // 1 — approval -----------------------------------------------------------
    let t = Date.now();
    const approvalNonce = "nonce-" + digestOf({ seed: seedHex, at, intent }).slice("sha256:".length, "sha256:".length + 32);
    const approval = await postJson(`${sandbox.origin}/approvals`, { intent, approval_nonce: approvalNonce });
    const intentDigest = digestOf(intent);
    record({
      id: 1,
      title: "Merchant commits the approval by digest",
      expect: intentDigest.slice(0, 20) + "…",
      actual: String(approval.intent_digest).slice(0, 20) + "…",
      ok: approval.intent_digest === intentDigest,
      detail: { intent_digest: approval.intent_digest, approval_nonce: approval.approval_nonce },
      ms: Date.now() - t,
    });

    // 2 — execution ----------------------------------------------------------
    t = Date.now();
    const order = { ...intent, order_ref: "order-1", executed_at: at };
    const execution = await postJson(`${sandbox.origin}/orders`, {
      intent_digest: intentDigest,
      approval_nonce: approval.approval_nonce,
      order,
      idempotency_key: "order-1",
    });
    const receiptId = execution.receipt_id;
    record({
      id: 2,
      title: "Merchant executes and signs a VAR/1 receipt",
      expect: "urn:sha256:<64 hex>",
      actual: receiptId,
      ok: /^urn:sha256:[0-9a-f]{64}$/.test(receiptId),
      detail: { receipt_url: execution.receipt_url, order_ref: execution.order_ref },
      ms: Date.now() - t,
    });

    // 3 — resolution ---------------------------------------------------------
    t = Date.now();
    const plan = planResolution({ receiptId, issuerOrigin: sandbox.origin });
    const resolution = await resolveReceipt({
      reference: { receiptId, issuerOrigin: sandbox.origin, profile: "VAR/1" },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    record({
      id: 3,
      title: "Receipt is fetched by its content-addressed id",
      expect: "resolved · bytes hash to the id",
      actual: `${resolution.state} · ${resolution.source ?? "no source"}`,
      ok: resolution.state === "resolved" && resolution.digest === "sha256:" + receiptId.slice("urn:sha256:".length),
      detail: { plan, state: resolution.state, source: resolution.source, digest: resolution.digest, tried: resolution.tried, checks: resolution.checks },
      ms: Date.now() - t,
    });

    // 4 — verification -------------------------------------------------------
    t = Date.now();
    const verification = inspectReceipt({ bytes: resolution.bytes, expectedIntent: intent, keyring });
    record({
      id: 4,
      title: "Signature, pin, intent binding and execution all agree",
      expect: "VERIFIED",
      actual: verification.outcome,
      ok: verification.outcome === "VERIFIED",
      detail: { checks: verification.checks, drift: verification.drift, keyStatus: verification.keyStatus },
      ms: Date.now() - t,
    });

    // 5 — unpinned key -------------------------------------------------------
    t = Date.now();
    const attackerKey = generateIssuerKey();
    const forged = buildReceipt({
      merchant: { id: intent.merchant_id, name: "Sandbox Books" },
      approved: intent,
      approvalNonce: approval.approval_nonce,
      executed: order,
      at,
      privateKeyPem: attackerKey.privateKeyPem,
    });
    const forgedMirror = await startHostileMirror({ bytes: forged.bytes, label: "forged-issuer" });
    mirrors.push(forgedMirror);
    const forgedResolution = await resolveReceipt({
      reference: { receiptId: forged.receiptId, issuerOrigin: forgedMirror.origin },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    const forgedInspection = inspectReceipt({ bytes: forgedResolution.bytes, expectedIntent: intent, keyring });
    const forgedOutcome = forgedResolution.state === "resolved"
      ? forgedInspection.outcome
      : resolutionOutcome(forgedResolution).outcome;
    record({
      id: 5,
      title: "A valid receipt from an unpinned key is NOT_CHECKED, not forged",
      expect: "resolved · signature ok · key unknown · NOT_CHECKED",
      actual: `${forgedResolution.state} · signature ${forgedInspection.signatureOk ? "ok" : "bad"} · key ${forgedInspection.keyStatus} · ${forgedOutcome}`,
      ok:
        forgedResolution.state === "resolved" &&
        forgedInspection.signatureOk === true &&
        forgedInspection.keyStatus === "unknown" &&
        forgedOutcome === "NOT_CHECKED",
      detail: {
        receipt_id: forged.receiptId,
        key_id: forgedInspection.parsed?.attestation?.issuer?.keyId ?? null,
        checks: forgedInspection.checks,
      },
      ms: Date.now() - t,
    });

    // 6 — first consumption --------------------------------------------------
    t = Date.now();
    const spendA = join(outDir, "spend-agent-a.log");
    const claim1 = claimSpend({
      path: spendA,
      receiptDigest: resolution.digest,
      approvalNonce: approval.approval_nonce,
      at,
      orderRef: "order-1",
      privateKeyPem: verifierKey.privateKeyPem,
    });
    record({
      id: 6,
      title: "The approval is spent exactly once",
      expect: "ok · spent",
      actual: `${claim1.ok ? "ok" : "refused"} · ${claim1.state}`,
      ok: claim1.ok === true && claim1.state === "spent",
      detail: { spend_key: claim1.entry?.spendKey ?? null },
      ms: Date.now() - t,
    });

    // 7 — same log, second claim --------------------------------------------
    t = Date.now();
    const claim2 = claimSpend({
      path: spendA,
      receiptDigest: resolution.digest,
      approvalNonce: approval.approval_nonce,
      at,
      orderRef: "order-1",
      privateKeyPem: verifierKey.privateKeyPem,
    });
    record({
      id: 7,
      title: "The same log refuses the second claim",
      expect: "refused · spent",
      actual: `${claim2.ok ? "ok" : "refused"} · ${claim2.state}`,
      ok: claim2.ok === false && claim2.state === "spent",
      detail: { reason: claim2.reason, entries: claim2.entries?.length ?? 0 },
      ms: Date.now() - t,
    });

    // 8 — second system, different nonce ------------------------------------
    t = Date.now();
    const spendB = join(outDir, "spend-agent-b.log");
    const claimB = claimSpend({
      path: spendB,
      receiptDigest: resolution.digest,
      approvalNonce: approval.approval_nonce + "-replay",
      at,
      orderRef: "order-1-replay",
      privateKeyPem: verifierKey.privateKeyPem,
    });
    const conflict = checkSpent([readSpendLog(spendA), readSpendLog(spendB)], {
      receiptDigest: resolution.digest,
      approvalNonce: approval.approval_nonce,
    });
    const merged = mergeLogs([readSpendLog(spendA), readSpendLog(spendB)]);
    record({
      id: 8,
      title: "A second system with a different nonce produces conflict",
      expect: "conflict",
      actual: conflict.state,
      ok: claimB.ok === true && conflict.state === "conflict",
      detail: {
        second_system_claim: claimB.state,
        merged_spends: merged.uniqueSpends,
        conflicts: merged.conflicts.length,
        reason: conflict.reason,
      },
      ms: Date.now() - t,
    });

    // 9 — four processes, one approval --------------------------------------
    t = Date.now();
    const racePath = join(outDir, "spend-race.log");
    const raceDigest = digestOf({ race: runId });
    const contenders = await Promise.all(
      [0, 1, 2, 3].map(() =>
        runRaceWorker({
          path: racePath,
          receiptDigest: raceDigest,
          approvalNonce: "race-" + runId,
          at,
          orderRef: "race",
          privateKeyPem: verifierKey.privateKeyPem,
        }),
      ),
    );
    const winners = contenders.filter((c) => c.ok).length;
    const losers = contenders.filter((c) => !c.ok && c.state === "spent").length;
    record({
      id: 9,
      title: "Four real processes racing one approval produce one winner",
      expect: "1 winner · 3 spent",
      actual: `${winners} winner · ${losers} spent`,
      ok: winners === 1 && losers === 3,
      detail: { contenders },
      ms: Date.now() - t,
    });

    // 10 — idempotent HTTP replay -------------------------------------------
    t = Date.now();
    const replay = await postJson(`${sandbox.origin}/orders`, {
      intent_digest: intentDigest,
      approval_nonce: approval.approval_nonce,
      order,
      idempotency_key: "order-1",
    });
    record({
      id: 10,
      title: "The same HTTP order returns the same receipt, not a second one",
      expect: "replayed · identical receipt id",
      actual: `${replay.replayed ? "replayed" : "new"} · ${replay.receipt_id === receiptId ? "identical" : "different"}`,
      ok: replay.replayed === true && replay.receipt_id === receiptId,
      detail: { receipt_id: replay.receipt_id },
      ms: Date.now() - t,
    });

    // 11 — wrong bytes on the right path ------------------------------------
    t = Date.now();
    const tamperedBytes = resolution.bytes.replace('"total_minor":12900', '"total_minor":13900');
    if (tamperedBytes === resolution.bytes) throw new Error("tamper fixture did not change a byte");
    const tamperMirror = await startHostileMirror({ bytes: tamperedBytes, label: "tampered-bytes" });
    mirrors.push(tamperMirror);
    const tamperResolution = await resolveReceipt({
      reference: { receiptId, issuerOrigin: tamperMirror.origin, profile: "VAR/1" },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    const tamperOutcome = resolutionOutcome(tamperResolution).outcome;
    const tamperDecision = decidePayment({ outcome: tamperOutcome, policy: opts.policy });
    record({
      id: 11,
      title: "A mirror on the right path serves wrong bytes, and the id refuses them",
      expect: "tampered · VERIFICATION_FAILED · DECLINE",
      actual: `${tamperResolution.state} · ${tamperOutcome} · ${tamperDecision.decision}`,
      ok:
        tamperResolution.state === "tampered" &&
        tamperOutcome === "VERIFICATION_FAILED" &&
        tamperDecision.decision === "DECLINE",
      detail: {
        served_by: tamperMirror.origin,
        reason: tamperResolution.reason,
        checks: tamperResolution.checks,
        expected: tamperResolution.expectedDigest,
        got: tamperResolution.digest,
        decision: tamperDecision,
      },
      ms: Date.now() - t,
    });

    // 12 — valid signature, drifted execution -------------------------------
    t = Date.now();
    const driftedOrder = { ...order, total_minor: order.total_minor + 500 };
    const driftedExecution = await postJson(`${sandbox.origin}/orders`, {
      intent_digest: intentDigest,
      approval_nonce: approval.approval_nonce,
      execute_as: driftedOrder,
      idempotency_key: "order-1-drift",
    });
    const driftResolution = await resolveReceipt({
      reference: { receiptId: driftedExecution.receipt_id, issuerOrigin: sandbox.origin, profile: "VAR/1" },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    const driftInspection = inspectReceipt({ bytes: driftResolution.bytes, expectedIntent: intent, keyring });
    const driftDecision = decidePayment({ outcome: driftInspection.outcome, policy: opts.policy });
    const namedFields = driftInspection.drift.map((d) => d.field);
    record({
      id: 12,
      title: "A valid signature over a surcharged execution is refused by name",
      expect: "total_minor named · VERIFICATION_FAILED · DECLINE",
      actual: `${namedFields.join(",") || "no drift"} · ${driftInspection.outcome} · ${driftDecision.decision}`,
      ok:
        driftResolution.state === "resolved" &&
        driftInspection.signatureOk === true &&
        driftInspection.keyStatus === "trusted" &&
        driftInspection.drift.some((d) => d.field === "total_minor") &&
        driftInspection.outcome === "VERIFICATION_FAILED" &&
        driftDecision.decision === "DECLINE",
      detail: {
        drift: driftInspection.drift,
        expected_vs_executed: fieldDrift(intent, driftedOrder),
        signature_ok: driftInspection.signatureOk,
        key_status: driftInspection.keyStatus,
        decision: driftDecision,
      },
      ms: Date.now() - t,
    });

    // 13 — a name nobody can produce ---------------------------------------
    t = Date.now();
    const deadId = "urn:sha256:" + "0".repeat(63) + "1";
    const deadResolution = await resolveReceipt({
      reference: { receiptId: deadId, issuerOrigin: sandbox.origin, profile: "VAR/1" },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    const deadOutcome = resolutionOutcome(deadResolution).outcome;
    const deadDecision = decidePayment({ outcome: deadOutcome, policy: opts.policy });
    const deadHolds = deadDecision.decision === "HOLD";
    record({
      id: 13,
      title: deadHolds
        ? "A content-addressed name nobody can produce holds, not declines"
        : "A content-addressed name nobody can produce is allowed unverified under availability",
      expect: `unresolvable · UNRESOLVABLE_RECORD · ${deadDecision.decision}`,
      actual: `${deadResolution.state} · ${deadOutcome} · ${deadDecision.decision}`,
      ok:
        deadResolution.state === "unresolvable" &&
        deadOutcome === "UNRESOLVABLE_RECORD" &&
        (deadDecision.decision === "HOLD" || (opts.policy === "availability" && deadDecision.decision === "ALLOW_UNVERIFIED")),
      detail: { reason: deadResolution.reason, decision: deadDecision },
      ms: Date.now() - t,
    });

    // 14 — a locator that answers nothing ----------------------------------
    t = Date.now();
    const absentId = `${sandbox.origin}/missing/${runId}.json`;
    const absentResolution = await resolveReceipt({
      reference: { receiptId: absentId },
      fetchImpl: fetchBytes,
      allowInsecureLoopback: true,
      timeoutMs: 2000,
    });
    const absentOutcome = resolutionOutcome(absentResolution).outcome;
    const absentDecision = decidePayment({ outcome: absentOutcome, policy: opts.policy });
    record({
      id: 14,
      title: "A locator that answers nothing allows without verification, labelled",
      expect: "absent · ABSENT · ALLOW_UNVERIFIED · unverified true",
      actual: `${absentResolution.state} · ${absentOutcome} · ${absentDecision.decision} · unverified ${absentDecision.unverified}`,
      ok:
        absentResolution.state === "absent" &&
        absentOutcome === "ABSENT" &&
        absentDecision.decision === "ALLOW_UNVERIFIED" &&
        absentDecision.unverified === true,
      detail: { reason: absentResolution.reason, decision: absentDecision },
      ms: Date.now() - t,
    });

    // 15 — the table --------------------------------------------------------
    t = Date.now();
    const exactOutcome = resolution.state === "resolved" ? verification.outcome : resolutionOutcome(resolution).outcome;
    const decisions = [
      { outcome: exactOutcome, source: "the exact execution", decision: decidePayment({ outcome: exactOutcome, policy: opts.policy }) },
      { outcome: tamperOutcome, source: "wrong bytes on the right path", decision: tamperDecision },
      { outcome: driftInspection.outcome, source: "valid signature, drifted execution", decision: driftDecision },
      { outcome: deadOutcome, source: "a content-addressed name with no answer", decision: deadDecision },
      { outcome: absentOutcome, source: "a locator with nothing behind it", decision: absentDecision },
      { outcome: forgedOutcome, source: "a valid receipt from an unpinned key", decision: decidePayment({ outcome: forgedOutcome, policy: opts.policy }) },
    ];
    const expectations = [
      "ALLOW",
      "DECLINE",
      "DECLINE",
      deadDecision.decision,
      "ALLOW_UNVERIFIED",
      "ALLOW_UNVERIFIED",
    ];
    record({
      id: 15,
      title: "Outcome to decision is a table, and every row is asserted",
      expect: expectations.join(" · "),
      actual: decisions.map((d) => d.decision.decision).join(" · "),
      ok: decisions.every((d, i) => d.decision.decision === expectations[i]),
      detail: { decisions },
      ms: Date.now() - t,
    });

    const allOk = steps.every((s) => s.result === "PASS");
    const report = {
      pilotVersion: PILOT_VERSION,
      generatedAt: new Date().toISOString(),
      runId,
      at,
      seedHex: opts.seed ?? null,
      policy: opts.policy,
      node: process.version,
      outDir,
      sandbox: {
        origin: sandbox.origin,
        merchant_id: sandbox.merchant.id,
        merchant_name: sandbox.merchant.name,
        note: "local reference merchant written for this kit; not a third-party pilot",
      },
      steps: stable(steps),
      receipt: {
        receipt_id: receiptId,
        body_digest: digestOf(verification.parsed?.body ?? {}),
        bytes_sha256: resolution.digest,
        key_id: verification.parsed?.attestation?.issuer?.keyId ?? null,
        signature_prefix: String(verification.parsed?.attestation?.signature ?? "").slice(0, 24),
      },
      resolution: {
        state: resolution.state,
        source: resolution.source,
        bytes: resolution.size,
        digest: resolution.digest,
        tried: resolution.tried,
      },
      verification: {
        outcome: verification.outcome,
        checks: stable(verification.checks),
        drift: stable(verification.drift),
        key_status: verification.keyStatus,
      },
      decisions: decisions.map((d) => ({
        outcome: d.outcome,
        source: d.source,
        decision: stable(d.decision),
      })),
      limits: [
        "The merchant is a local reference server in this repository. No third-party merchant, PSP, auditor or customer has run this kit here, and none is claimed.",
        "The order is synthetic. A receipt proves what the merchant signed, not that goods were delivered or a card was charged; delivery conformity is a separate gate (DDE/1).",
        "The spend ledger is only as global as the logs a verifier can see. Publishing the log head is how a merchant tightens that; this kit shows the primitive, not a public ledger.",
        "The pin arrives out of band from the merchant's startup output. A production deployment needs a key directory or an allowlist, with rotation and revocation on the profile's clock.",
        "ALLOW_UNVERIFIED is a decision to proceed without evidence, not a verification result. A deployment that requires evidence must refuse it at its own policy layer; the label exists so that choice is visible instead of implicit.",
        "No chain, no broadcast, no mainnet. prepareChainAnchor exists elsewhere in the repository and refuses mainnet by name; this kit does not call it.",
        "Receipt bytes are deterministic for a given seed and clock. Consumption rows are stateful: spend logs live in the output directory, so rerunning into the same --out reuses that ledger and refuses already-spent rows by design. Use a fresh --out to reproduce the full run.",
        "Reproducing the receipt bytes does not turn the sandbox into a second party.",
      ],
      verdict: allOk ? "PASS" : "FAIL",
      outDir,
    };

    writeFileSync(join(outDir, "receipt.json"), resolution.bytes + "\n");
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(outDir, "REPORT.md"), markdownReport(report), "utf8");

    print("");
    print("  outcome → decision");
    for (const d of decisions) {
      print(`    ${d.outcome.padEnd(20)} ${d.source.padEnd(42)} ${d.decision.decision}`);
    }
    print("");
    if (!opts.quiet) {
      print(`  receipt  ${receiptId}`);
      print(`  bytes    ${resolution.digest}`);
      print(`  report   ${join(outDir, "report.json")}`);
      print(`  human    ${join(outDir, "REPORT.md")}`);
      print("");
    }
    process.stdout.write(
      `VAR/1 PILOT — ${report.verdict} (${steps.filter((s) => s.result === "PASS").length}/${steps.length} rows) in ${steps.reduce((a, s) => a + (s.ms ?? 0), 0)}ms\n`,
    );
    process.exitCode = allOk ? 0 : 1;
  } finally {
    for (const m of mirrors) await m.close().catch(() => {});
    await sandbox.close().catch(() => {});
  }
}

main().catch((err) => {
  process.stderr.write(`VAR/1 pilot harness error: ${err?.stack ?? err}\n`);
  process.exitCode = 1;
});
