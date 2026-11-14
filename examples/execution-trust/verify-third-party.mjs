/**
 * examples/execution-trust/verify-third-party.mjs — the outsider's verifier.
 *
 * Reads three files and nothing else: the receipt, the envelope it must be
 * bound to, and the issuer's PUBLIC key. It never imports the issuer factory,
 * never sees a secret, and never calls the network — which is the whole point:
 * evidence a third party can check without trusting (or contacting) CoreGuard.
 *
 *   node verify-third-party.mjs <dir> [--at=<unixSeconds>]
 *
 * Exit codes: 0 PASS · 2 BLOCK · 1 usage/IO. The verdict line is
 * "<DECISION> <CODE>" so a caller can assert on either half.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { verifyAuthorizationReceipt } from "../../packages/stellar/presign.mjs";

const [dir, ...flags] = process.argv.slice(2);
if (!dir) {
  console.error("usage: verify-third-party.mjs <dir-with-receipt> [--at=<unixSeconds>]");
  process.exit(1);
}

const at = flags.find((f) => f.startsWith("--at="));
const receipt = JSON.parse(readFileSync(join(dir, "receipt.json"), "utf8"));
const envelope = readFileSync(join(dir, "envelope.txt"), "utf8").trim();
const issuerPublicKey = JSON.parse(readFileSync(join(dir, "issuer.json"), "utf8")).publicKeyHex;

const result = verifyAuthorizationReceipt({
  receipt,
  xdr: envelope,
  network: "TESTNET",
  policy: receipt.policy,
  nowSeconds: at ? Number(at.slice("--at=".length)) : receipt.issuedAt,
  issuerPublicKey,
});

console.log(`${result.decision} ${result.code ?? ""}`.trim());
process.exit(result.decision === "PASS" ? 0 : 2);
