/**
 * CoreGuard Agent Commerce Security Suite (offline · synthetic · zero keys)
 *
 * The product face of the agentic-commerce layer, end to end, on the repo's
 * own committed machinery (AC-SDK/1 over CGEP/1 · CGCR/1 consent receipts ·
 * AGR/1 drift taxonomy · MCP server · REST API):
 *
 *   CONSENT      user approval bound to the EXACT approved order bytes
 *   EXECUTE      exact execution -> VERIFIED (all checks PASS)
 *   ATTACK BATTERY (8, each fail-closed with the class named):
 *     1 TOTAL_DRIFT          post-approval surcharge           -> INVALID
 *     2 MERCHANT_SWAP        payee changes after approval      -> INVALID
 *     3 ITEM_MUTATION        injected item (prompt-injection shape) -> INVALID
 *     4 CREDENTIAL_SUB       payment credential substituted    -> INVALID
 *     5 EXPIRED              execution after the window closed -> INVALID
 *     6 SINGLE_USE_REUSE     replay of a consumed authorization -> INVALID
 *     7 RECORD_TAMPER        one byte of the consent record edited -> INVALID
 *     8 MALFORMED            unreadable execution payload refused, not guessed -> INVALID
 *   MCP          a REAL MCP server (stdio JSON-RPC 2.0) is spawned and driven
 *                through authorize -> verify on a drifted order -> INVALID
 *   HTTP         a REAL REST API instance is started on loopback and driven
 *                through authorize -> verify exact -> VERIFIED
 *
 * Every order is SYNTHETIC (credential is a placeholder, never a PAN; the
 * merchant/order identifiers are simulated) and nothing is sent anywhere.
 * Exit contract: 0 ONLY on the exact arc above (VERIFIED + 8/8 blocked +
 * MCP INVALID + HTTP VERIFIED); any other outcome exits 1.
 *
 * BOUNDARY (standing): execution verification never decides delivery
 * conformity (DDE/1); VERIFIED ≠ SAFE; durable single-use anchoring is
 * NOT_BUILT (process-local by design); no contact, integration or endorsement
 * is claimed with OpenAI, American Express, Mastercard, Visa or any provider.
 */

import { writeFile } from "fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createServer } from "node:http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { createConsent, verifyConsent, verifyExecution, assessRisk, AGENT_COMMERCE_VERSION, CONSENT_SPEC } from "../../packages/agent-commerce/index.mjs";
import { AGR_VERSION, RISK_CLASSES } from "../../packages/agent-commerce/risk.mjs";
import { createAgentCommerceApi, AGENT_COMMERCE_API_VERSION } from "../../packages/agent-commerce/http.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The approved checkout (everything pinned — a synthetic order)
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANT = "0x0000000000000000000000000000000000000042";
const AGENT = "0x000000000000000000000000000000000000000d";
const NOW = "1794657600"; // 2026-11-14T12:00:00Z — the pinned approval epoch

const ITEMS = [
  { sku: "SKU-SEC-001", name: "Synthetic item A", qty: 1, unitPriceMinor: "1800" },
  { sku: "SKU-SEC-002", name: "Synthetic item B", qty: 1, unitPriceMinor: "1200" },
];
const TAX_MINOR = "200";
const SHIPPING_MINOR = "100";
const TOTAL_MINOR = "3300"; // 3000 items + 200 tax + 100 shipping — all declared at approval time

const intent = {
  version: "CGEP/1",
  chainId: "0", // off-chain checkout ledger (synthetic — no chain broadcast anywhere)
  signer: AGENT, // the checkout submitter = the declared agent (simulated)
  nonce: "0",
  validAfter: "0",
  validUntil: "9999999999",
  action: "AGENT_CHECKOUT",
  target: MERCHANT,
  selector: "0xa9059cbb", // the checkout "submit order" op (simulated)
  asset: "0x0000000000000000000000000000000000000002",
  amount: TOTAL_MINOR,
  recipient: MERCHANT,
  constraints: [
    { type: "MAX_VALUE", value: TOTAL_MINOR },
    { type: "RECIPIENT_ALLOWLIST", addresses: [MERCHANT] },
  ],
  merchantName: "synthetic-store.example",
  currency: "USD",
  items: ITEMS,
  taxMinor: TAX_MINOR,
  shippingMinor: SHIPPING_MINOR,
  paymentCredentialRef: "TOKENIZED-CREDENTIAL-REF-5e17 (placeholder — never a PAN)",
  agentRef: "DEMO-AGENT-SEC-1 (declared, not detected)",
  authorizedAtUtc: "2026-11-14T12:00:00Z",
  expiryUtc: "2026-11-14T12:10:00Z",
  singleUse: true,
};

const policy = {
  version: "CGEP/1",
  policyId: "0x00000000000000000000000000000000000000ac",
  name: "Agent Commerce Policy",
  rules: [
    { ruleId: "VALUE_001", type: "VALUE_LIMIT", params: { max: TOTAL_MINOR }, severity: "CRITICAL" },
    { ruleId: "TARGET_001", type: "TARGET_ALLOWLIST", params: { targets: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "RECIPIENT_001", type: "RECIPIENT_ALLOWLIST", params: { addresses: [MERCHANT] }, severity: "CRITICAL" },
    { ruleId: "SELECTOR_001", type: "SELECTOR_ALLOWLIST", params: { selectors: ["0xa9059cbb"] }, severity: "CRITICAL" },
  ],
};

function executedOrder({ totalMinor = TOTAL_MINOR, to = MERCHANT, items = ITEMS, credential = intent.paymentCredentialRef, timestamp = NOW, gasUsed = "21000" } = {}) {
  const amountHex = BigInt(totalMinor).toString(16).padStart(64, "0");
  return {
    txHash: "0x" + "aa".repeat(32),
    blockHash: "0x" + "cc".repeat(32),
    blockNumber: 65337,
    blockTimestamp: timestamp,
    from: AGENT,
    to,
    value: totalMinor,
    calldata: "0xa9059cbb" + to.slice(2).padStart(64, "0") + amountHex,
    slippageBps: "0",
    gasUsed,
    merchantName: intent.merchantName,
    currency: intent.currency,
    items,
    paymentCredentialRef: credential,
    orderRef: "ORDER-SEC-0001 (simulated checkout order)",
    authorizedAtUtc: intent.authorizedAtUtc,
    singleUse: intent.singleUse,
  };
}

const newLedger = () => new Set(); // the battery isolates ledgers per case so each class is named precisely

// ─────────────────────────────────────────────────────────────────────────────
// MCP client helper (drives the REAL stdio JSON-RPC server child)
// ─────────────────────────────────────────────────────────────────────────────

async function withMcpServer(fn) {
  const child = spawn(process.execPath, [resolve(here, "../../packages/agent-commerce/mcp.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) pending.get(msg.id)(msg);
    } catch { /* ignore non-JSON lines */ }
  });
  let nextId = 0;
  const request = (method, params) =>
    new Promise((res, rej) => {
      const id = ++nextId;
      const timer = setTimeout(() => rej(new Error(`MCP timeout on ${method}`)), 15000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        pending.delete(id);
        res(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  try {
    return await fn({ request });
  } finally {
    child.kill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main arc
// ─────────────────────────────────────────────────────────────────────────────

function classesOf(report) {
  return report.risk.violations.map((v) => v.code).join("+") || "none";
}

async function main() {
  const results = {};

  console.log("\n── CONSENT: the user approves the order (CGCR/1) ─────────────");
  const consent = await createConsent({ intent, policy, declaredTrace: executedOrder(), nowSeconds: NOW });
  console.log(`Merchant:   ${intent.merchantName} (${MERCHANT})`);
  console.log(`Items:      ${intent.items.map((i) => `${i.name} x${i.qty} @ ${i.unitPriceMinor}`).join(" · ")} · tax ${TAX_MINOR} · shipping ${SHIPPING_MINOR}`);
  console.log(`Total:      ${TOTAL_MINOR} ${intent.currency} (minor units — every component approved)`);
  console.log(`Credential: ${intent.paymentCredentialRef}`);
  console.log(`Spec:       ${CONSENT_SPEC} · SDK ${AGENT_COMMERCE_VERSION} · receipt pinned at ${NOW}`);
  console.log(`Receipt ID: ${consent.receiptId}`);
  const integrity = await verifyConsent(consent);
  console.log(`Integrity:  ${integrity.result} (binding re-derivable by anyone holding the record)`);
  results.consent = { spec: CONSENT_SPEC, receiptId: consent.receiptId, integrity: integrity.result };

  console.log("\n── EXECUTE exact: the store runs the approved order ──────────");
  const exactLedger = newLedger(); // held: attack 6 replays against THIS consumed ledger
  const exact = await verifyExecution(consent, executedOrder(), { consumedSet: exactLedger });
  printReport(exact);
  results.executeExact = { verdict: exact.verdict, engineVerdict: exact.engineVerdict, risk: exact.risk.classification };

  console.log("\n── ATTACK BATTERY (8 · fail-closed · class named) ────────────");
  const attacks = [];

  async function attack(label, fn) {
    const report = await fn();
    attacks.push({ label, verdict: report.verdict, classes: classesOf(report) });
    console.log(`\n  · ${label}`);
    console.log(`    verdict: ${report.verdict}  ·  AGR/1: ${report.risk.classification}  ·  classes: ${classesOf(report)}`);
    if (report.driftNamed.length) console.log(`    drift:   ${report.driftNamed.join(" · ")}`);
    return report;
  }

  const runVerify = (trace, ledger = newLedger()) => verifyExecution(consent, trace, { consumedSet: ledger });

  await attack("1 TOTAL_DRIFT — surcharge appears after approval", () => runVerify(executedOrder({ totalMinor: "3499" })));
  await attack("2 MERCHANT_SWAP — the payee changes after approval", () => runVerify(executedOrder({ to: "0x0000000000000000000000000000000000000099" })));
  await attack("3 ITEM_MUTATION — an injected item (prompt-injection shape)", () =>
    runVerify(executedOrder({ totalMinor: "3800", items: [...ITEMS, { sku: "SKU-INJECTED", name: "Injected item C", qty: 1, unitPriceMinor: "500" }] }))
  );
  await attack("4 CREDENTIAL_SUBSTITUTION — the payment credential is swapped", () =>
    runVerify(executedOrder({ credential: "TOKENIZED-CREDENTIAL-REF-9999 (substituted after approval)" }))
  );
  await attack("5 EXPIRED — execution after the authorization window closed", () => runVerify(executedOrder({ timestamp: "1794658300" })));
  await attack("6 SINGLE_USE_REUSE — the consumed authorization is replayed", () => runVerify(executedOrder(), exactLedger));
  await attack("7 RECORD_TAMPER — one byte of the consent record is edited", async () => {
    const tampered = { ...consent, receipt: { ...consent.receipt, result: "INVALID" } };
    return verifyExecution(tampered, executedOrder(), { consumedSet: newLedger() });
  });
  await attack("8 MALFORMED — an unreadable execution payload is refused, not guessed", () => {
    const t = executedOrder();
    delete t.blockTimestamp;
    return runVerify(t);
  });

  results.attacks = attacks;

  console.log("\n── MCP: a REAL stdio server drives the same surface ──────────");
  const mcp = await withMcpServer(async ({ request }) => {
    const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "agent-commerce-suite-demo", version: "1.0.0" } });
    console.log(`  initialize -> ${init.result?.serverInfo?.name} v${init.result?.serverInfo?.version} (protocol ${init.result?.protocolVersion})`);
    const list = await request("tools/list", {});
    const toolNames = list.result.tools.map((t) => t.name).join(", ");
    console.log(`  tools/list -> ${list.result.tools.length} tools: ${toolNames}`);
    const miniIntent = {
      ...intent,
      amount: "1200",
      items: [{ sku: "SKU-MCP-001", name: "Synthetic item M", qty: 1, unitPriceMinor: "1200" }],
      taxMinor: "0",
      shippingMinor: "0",
    };
    const miniTrace = { ...executedOrder({ totalMinor: "1200" }), items: miniIntent.items };
    const authz = await request("tools/call", { name: "coreguard_authorize", arguments: { intent: miniIntent, policy, declaredTrace: miniTrace, nowSeconds: NOW } });
    const consentObj = JSON.parse(authz.result.content[0].text);
    console.log(`  authorize  -> ${consentObj.spec} receipt ${consentObj.receiptId.slice(0, 18)}…`);
    const drifted = { ...miniTrace, value: "1450" };
    const verdict = await request("tools/call", { name: "coreguard_verify_execution", arguments: { consent: consentObj, trace: drifted } });
    const report = JSON.parse(verdict.result.content[0].text);
    console.log(`  verify     -> ${report.verdict} · classes: ${report.risk.violations.map((v) => v.code).join("+")}`);
    return { server: init.result?.serverInfo?.name, tools: list.result.tools.length, verdict: report.verdict };
  });
  results.mcp = mcp;

  console.log("\n── HTTP: a REAL REST API instance on loopback ────────────────");
  const httpVerdict = await withHttpServer(async (base) => {
    const health = await fetch(`${base}/health`);
    console.log(`  GET  /health        -> ${health.status} ${await health.text()}`);
    const singleItemIntent = {
      ...intent,
      amount: "1200",
      items: [{ sku: "SKU-HTTP-001", name: "Synthetic item H", qty: 1, unitPriceMinor: "1200" }],
      taxMinor: "0",
      shippingMinor: "0",
    };
    const httpTrace = executedOrder({ totalMinor: "1200", items: singleItemIntent.items });
    const res1 = await fetch(`${base}/v1/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: singleItemIntent, policy, declaredTrace: httpTrace, nowSeconds: NOW }),
    });
    const consentObj = await res1.json();
    console.log(`  POST /v1/authorize  -> ${res1.status} ${consentObj.spec} ${String(consentObj.receiptId).slice(0, 18)}…`);
    const res2 = await fetch(`${base}/v1/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: consentObj, trace: httpTrace }),
    });
    const report = await res2.json();
    console.log(`  POST /v1/verify     -> ${res2.status} ${report.verdict} (exact execution)`);
    return report.verdict;
  });
  results.http = { version: AGENT_COMMERCE_API_VERSION, verdict: httpVerdict };

  console.log("\n── BOUNDARY (standing) ──────────────────────────────────────");
  console.log("  Execution verification does not decide delivery conformity (DDE/1).");
  console.log("  VERIFIED ≠ SAFE. Deterministic taxonomy (AGR/1), never a fraud score.");
  console.log("  Durable single-use anchoring: NOT_BUILT (consumption is process-local).");
  console.log("  No contact, integration or endorsement claimed with any named provider.");

  console.log("\n── SUMMARY ──────────────────────────────────────────────────");
  console.log(`  CONSENT (CGCR/1)          -> ${results.consent.integrity}`);
  console.log(`  EXECUTE exact             -> ${results.executeExact.verdict}`);
  const blocked = attacks.filter((a) => a.verdict === "INVALID").length;
  console.log(`  ATTACKS blocked           -> ${blocked}/${attacks.length}`);
  for (const a of attacks) console.log(`    ${a.label.padEnd(52)} ${a.verdict} (${a.classes})`);
  console.log(`  MCP server                -> ${mcp.verdict} (drifted order rejected)`);
  console.log(`  HTTP API (loopback)       -> ${httpVerdict} (exact execution)`);

  const arc =
    results.consent.integrity === "VERIFIED" &&
    results.executeExact.verdict === "VERIFIED" &&
    blocked === attacks.length &&
    attacks.length === 8 && // the eight named attack classes above
    mcp.verdict === "INVALID" &&
    httpVerdict === "VERIFIED";

  await writeFile(
    resolve(here, "artifacts.json"),
    JSON.stringify(
      {
        suite: "agent-commerce-security-suite",
        sdk: AGENT_COMMERCE_VERSION,
        specs: { consent: CONSENT_SPEC, risk: AGR_VERSION, api: AGENT_COMMERCE_API_VERSION },
        synthetic: true,
        network: "offline (loopback MCP + HTTP only)",
        keys: "none",
        pinnedEpoch: NOW,
        approved: { intent, policy },
        consentReceiptId: consent.receiptId,
        results: {
          consentIntegrity: results.consent.integrity,
          executeExact: results.executeExact.verdict,
          attacks: attacks.map(({ label, verdict, classes }) => ({ label, verdict, classes })),
          attacksBlocked: `${blocked}/${attacks.length}`,
          mcp: results.mcp,
          http: results.http,
        },
        exitContract: arc ? "CONSENT_VERIFIED_EXACT_VERIFIED_ATTACKS_9_OF_9_INVALID_MCP_INVALID_HTTP_VERIFIED" : "ARC_BROKEN",
        boundary:
          "execution verification never decides delivery conformity (DDE/1); VERIFIED ≠ SAFE; deterministic taxonomy, never a fraud score; durable single-use anchoring NOT_BUILT; no contact/integration/endorsement claimed with OpenAI, American Express, Mastercard, Visa or any named provider",
      },
      null,
      2
    )
  );

  if (!arc) {
    console.error("\nARC BROKEN — the suite refuses to claim its arc (fail-closed exit).");
    process.exitCode = 1;
    return;
  }
  console.log("\nARC OK — exit 0 (exact arc only).");
}

function printReport(report) {
  for (const c of report.checks) {
    const mark = c.result === "PASS" ? "✓" : c.result === "NOT_RUN" ? "·" : "✗";
    console.log(`  ${mark} ${c.check}${c.result === "FAIL" ? ` — ${c.detail}` : ""}`);
  }
  console.log(`  AGR/1: ${report.risk.classification}${report.risk.violations.length ? ` · ${report.risk.violations.map((v) => v.code).join(" + ")}` : ""}`);
  console.log(`  verdict: ${report.verdict}`);
}

async function withHttpServer(fn) {
  const handler = createAgentCommerceApi();
  const server = createServer((req, res) => handler(req, res));
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((res) => server.close(res));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
