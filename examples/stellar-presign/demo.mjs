/**
 * examples/stellar-presign/demo.mjs
 *
 * The PSAR/1 offline arc, end to end, in one command:
 *
 *   1. build a REAL unsigned Stellar payment envelope (AGENT-XDR/1, offline)
 *   2. issue a pre-sign authorization receipt bound to its EXACT XDR bytes
 *   3. verify the envelope it was issued for                -> PASS
 *   4. build the tampered envelope (amount "500") and verify -> BLOCK (XDR_BINDING_MISMATCH)
 *   5. advance the injected clock past the receipt window    -> BLOCK (RECEIPT_EXPIRED)
 *
 * What this demo is NOT:
 *   - it does not sign, broadcast, or touch a wallet. The issuer here is a
 *     deterministic DEMO/DEV stand-in (packages/stellar/presign.mjs
 *     createInMemoryIssuer); no Stellar key material exists anywhere in it.
 *   - it is offline. Building an envelope is pure CPU; nothing calls Horizon.
 *   - the DECISIONS are deterministic; the receipt digest and txHash vary
 *     run to run because a Stellar envelope carries timeBounds derived from
 *     the wall clock. The binding property is what does not vary: change one
 *     byte of the XDR and the receipt stops verifying for it.
 *
 * Run: npm run stellar:presign   (documented in
 * docs/freighter-presign-integration-proposal-2026-11-12.md)
 */

import { buildPaymentEnvelope } from "../../packages/agent-gate/adapters/stellar-xdr.mjs";
import {
  PSAR_VERSION,
  RECEIPT_SCOPE,
  EXECUTION_PROOF_FIELD,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
} from "../../packages/stellar/presign.mjs";

const SOURCE = "GDJ3CRNLNDZ4AVWGPUG7DBC5BIAGMIONOONZGB5FSYAY44ZHOIPRKY7U";
const DESTINATION = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

/** DEMO/DEV-only deterministic issuer seed. Never a wallet key; never shipped as one. */
const DEMO_ISSUER_SEED = "42".repeat(32);

/** Injected clock origin (seconds). The module never reads Date; neither does the demo arc. */
const NOW = 1731300000;
const TTL_SECONDS = 600;

/** The policy the receipt authorizes - the amount here is a string, never a float. */
const POLICY = { asset: "XLM", maxAmount: "10", destination: DESTINATION };

function buildEnv(amount) {
  const built = buildPaymentEnvelope({
    source: SOURCE,
    sequence: "1",
    destination: DESTINATION,
    amount,
    asset: "XLM",
    network: "testnet",
    fee: "100",
    timeoutSeconds: 180,
  });
  if (!built.ok) throw new Error(`envelope build failed: ${built.error}`);
  return built;
}

/**
 * The full demo arc. Throws on any unexpected outcome (fail-closed demo):
 * a PASS that should be a BLOCK, or a BLOCK with the wrong code, means the
 * property this feature exists to guarantee has broken - so the command fails.
 */
export function runArc() {
  const steps = [];
  const clock = { now: NOW }; // injected clock; no wall-clock reads inside the arc

  // Step 1 - the REAL transaction: a genuine unsigned Stellar envelope.
  const env = buildEnv("10");
  steps.push({
    step: "build unsigned payment envelope (AGENT-XDR/1, offline)",
    ok: true,
    network: "TESTNET",
    unsigned: env.unsigned,
    xdrBytes: env.xdr.length,
  });

  // Step 2 - issue the receipt bound to the EXACT XDR bytes.
  const issuer = createInMemoryIssuer({ seedHex: DEMO_ISSUER_SEED });
  const issued = issueAuthorizationReceipt({
    network: "TESTNET",
    xdr: env.xdr,
    policy: POLICY,
    issuer,
    nowSeconds: clock.now,
    ttlSeconds: TTL_SECONDS,
  });
  if (!issued.ok) throw new Error(`receipt issue failed: ${issued.error}`);
  steps.push({
    step: `issue pre-sign receipt (${PSAR_VERSION}, scope ${RECEIPT_SCOPE})`,
    ok: true,
    receiptId: issued.digest,
    issuedAt: issued.receipt.issuedAt,
    expiresAt: issued.receipt.expiresAt,
    issuer: issued.receipt.issuer,
  });

  const verify = (xdr, nowSeconds) =>
    verifyAuthorizationReceipt({
      receipt: issued.receipt,
      xdr,
      network: "TESTNET",
      policy: POLICY,
      nowSeconds,
      issuerPublicKey: issuer.publicKeyHex,
    });

  // Step 3 - the wallet verifies the envelope it was issued for: PASS.
  const pass = verify(env.xdr, clock.now + 1);
  steps.push({
    step: "verify the exact authorized envelope",
    decision: pass.decision,
    code: pass.code,
    executionProof: pass.executionProof,
  });

  // Step 4 - the tampered transaction: same approval, amount changed to 500.
  const tampered = buildEnv("500");
  const block = verify(tampered.xdr, clock.now + 1);
  steps.push({
    step: 'verify the tampered envelope (amount changed to "500")',
    decision: block.decision,
    code: block.code,
    executionProof: block.executionProof,
  });

  // Step 5 - the stale approval: clock advanced past the receipt window.
  const expired = verify(env.xdr, issued.receipt.expiresAt);
  steps.push({
    step: "verify after the receipt window lapses",
    decision: expired.decision,
    code: expired.code,
    executionProof: expired.executionProof,
  });

  // Self-assertions: the demo fails loudly if any guarantee breaks.
  const expected = [
    { name: "authorized envelope PASSes", cond: pass.decision === "PASS" && pass.code === null },
    {
      name: "tampered envelope BLOCKs with XDR_BINDING_MISMATCH",
      cond: block.decision === "BLOCK" && block.code === "XDR_BINDING_MISMATCH",
    },
    {
      name: "lapsed window BLOCKs with RECEIPT_EXPIRED",
      cond: expired.decision === "BLOCK" && expired.code === "RECEIPT_EXPIRED",
    },
    {
      name: "every verdict carries executionProof NOT_INCLUDED",
      cond: [pass, block, expired].every((v) => v.executionProof === EXECUTION_PROOF_FIELD),
    },
  ];
  const failed = expected.filter((c) => !c.cond);
  if (failed.length > 0) {
    throw new Error(`demo arc guarantee broken: ${failed.map((f) => f.name).join("; ")}`);
  }

  return { ok: true, steps, guarantees: expected.map((c) => c.name) };
}

/** Print the arc when executed directly; exit 0 on success (drain, never hard-exit). */
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop() || "");

if (isMain) {
  const r = runArc();
  console.log("CoreGuard PSAR/1 - Pre-sign Authorization Receipt (offline demo)");
  console.log("no signing, no wallet, no network - decisions deterministic, digests vary (timeBounds)");
  console.log("");
  for (const s of r.steps) {
    if (s.decision !== undefined) {
      console.log(`[ ${s.decision}${s.code ? " / " + s.code : ""} ] ${s.step}`);
      console.log(`    executionProof: ${s.executionProof}`);
    } else {
      console.log(`[ ok ] ${s.step}`);
      for (const [k, v] of Object.entries(s)) {
        if (k !== "step" && k !== "ok") console.log(`    ${k}: ${v}`);
      }
    }
  }
  console.log("");
  for (const g of r.guarantees) console.log(`guarantee held: ${g}`);
  console.log("");
  console.log("A receipt binds an authorization decision to the EXACT transaction bytes.");
  console.log("It never proves execution - that proof comes from the ledger after submission.");
  console.log("exit: 0");
}
