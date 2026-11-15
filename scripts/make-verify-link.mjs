#!/usr/bin/env node
/**
 * make-verify-link.mjs — turn a pilot bundle into one URL.
 *
 * Reads the three public files a pilot produces (receipt.json, envelope.txt,
 * issuer.json), packs them into the fragment of the static verifier page, and
 * prints the link. The fragment is never sent to a server, so the receipt does
 * not end up in anyone's access log — which is the reason it is a fragment and
 * not a query string.
 *
 *   node scripts/make-verify-link.mjs <dir> [--base docs/verify.html] [--at <unixSeconds>]
 *
 * Writes <dir>/verify-link.txt and prints the URL on stdout. No network.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { canonicalJson } from "../docs/verify-receipt.mjs";

const [dir, ...rest] = process.argv.slice(2);
if (!dir) {
  console.error("usage: make-verify-link.mjs <dir-with-receipt> [--base <page>] [--at <unixSeconds>]");
  process.exit(1);
}

const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

const base = flag("--base") ?? "docs/verify.html";
const at = flag("--at");
const root = resolve(dir);

const receiptPath = join(root, "receipt.json");
const envelopePath = join(root, "envelope.txt");
const issuerPath = join(root, "issuer.json");
for (const p of [receiptPath, envelopePath, issuerPath]) {
  if (!existsSync(p)) {
    console.error(`MAKE-VERIFY-LINK: missing ${p}`);
    process.exit(1);
  }
}

const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const xdr = readFileSync(envelopePath, "utf8").trim();
const issuerPublicKey = JSON.parse(readFileSync(issuerPath, "utf8")).publicKeyHex;

const bundle = { receipt, xdr, network: receipt.network, issuerPublicKey };
if (at !== undefined) {
  const pinned = Number(at);
  if (!Number.isInteger(pinned) || pinned < 0) {
    console.error("MAKE-VERIFY-LINK: --at must be a non-negative integer");
    process.exit(1);
  }
  bundle.at = pinned;
}
if (receipt.policy) bundle.policy = receipt.policy;

const encoded = Buffer.from(canonicalJson(bundle), "utf8").toString("base64url");
const url = `${base}#v1.${encoded}`;

writeFileSync(join(root, "verify-link.txt"), `${url}\n`, "utf8");
console.log(url);
console.error(
  `MAKE-VERIFY-LINK: ${url.length} chars · digest ${receipt.digest ?? "n/a"} · ${at === undefined ? "clock taken from the browser" : `clock pinned at ${at}`}`,
);
