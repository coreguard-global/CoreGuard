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
 *   node scripts/make-verify-link.mjs <dir> [--short <site-root>]
 *   node scripts/make-verify-link.mjs --from-link <verify-link.txt> --id <receiptId> --short <site-root>
 *
 * --short writes <site-root>/v/<receiptId>/index.html: a static redirect page
 * that carries the same fragment. It needs no server, no rewrite rule and no
 * database — the receipt id is the directory name. Unlike a bare fragment link,
 * the redirect page is itself published, so only use --short for bundles you
 * intend to make public.
 *
 * Writes <dir>/verify-link.txt and prints the URL on stdout. No network.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { canonicalJson } from "../docs/verify-receipt.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const dir = positional[0];

const base = flag("--base") ?? "docs/verify.html";
const at = flag("--at");
const fromLink = flag("--from-link");
const shortRoot = flag("--short");
const explicitId = flag("--id");

if (!dir && !fromLink) {
  console.error("usage: make-verify-link.mjs <dir-with-receipt> [--base <page>] [--at <unixSeconds>] [--short <site-root>]");
  console.error("       make-verify-link.mjs --from-link <verify-link.txt> --id <receiptId> --short <site-root>");
  process.exit(1);
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let url;
let receiptId = explicitId;

if (fromLink) {
  if (!existsSync(fromLink)) {
    console.error(`MAKE-VERIFY-LINK: missing ${fromLink}`);
    process.exit(1);
  }
  url = readFileSync(fromLink, "utf8").trim();
  if (!url.includes("#v1.")) {
    console.error("MAKE-VERIFY-LINK: --from-link file is not a v1 verifier link");
    process.exit(1);
  }
} else {
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
  url = `${base}#v1.${encoded}`;
  receiptId = receiptId ?? receipt.receiptId ?? receipt.id ?? receipt.digest;

  writeFileSync(join(root, "verify-link.txt"), `${url}\n`, "utf8");
  console.log(url);
  console.error(
    `MAKE-VERIFY-LINK: ${url.length} chars · digest ${receipt.digest ?? "n/a"} · ${at === undefined ? "clock taken from the browser" : `clock pinned at ${at}`}`,
  );
}

if (shortRoot) {
  if (!receiptId || !SAFE_ID.test(receiptId)) {
    console.error(`MAKE-VERIFY-LINK: --short needs a safe receipt id (got ${JSON.stringify(receiptId ?? null)})`);
    process.exit(1);
  }
  const siteRoot = resolve(shortRoot);
  const shortDir = join(siteRoot, "v", receiptId);
  const target = relative(shortDir, resolve(base)).split(sep).join("/");
  const href = `${target}#v1.${url.split("#v1.")[1]}`;
  mkdirSync(shortDir, { recursive: true });
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${esc(href)}">
<title>CoreGuard · receipt ${esc(receiptId)}</title>
<style>
  :root { color-scheme: dark; --bg:#0B0F14; --ink:#E6EDF3; --dim:#9AA7B4; --accent:#FF8A00; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
  a { color: var(--accent); }
  code { color: var(--ink); }
  .n { color: var(--dim); font-size: 13px; margin-top: 18px; }
</style>
</head>
<body>
<main>
  <p>Redirecting to the CoreGuard verifier…</p>
  <p><a href="${esc(href)}">Open the verifier for this receipt</a></p>
  <p class="n">Receipt <code>${esc(receiptId)}</code> · verification runs in your browser; the fragment is never sent to a server.</p>
</main>
<script>location.replace(${JSON.stringify(href)});</script>
</body>
</html>
`;
  writeFileSync(join(shortDir, "index.html"), page, "utf8");
  console.log(`SHORT-LINK: ${join(siteRoot, "v", receiptId, "index.html")} → ${target}#v1.…`);
  console.log(`SHORT-LINK_PUBLIC_PATH: /v/${receiptId}/`);
}

if (!fromLink && !shortRoot) process.exit(0);
if (fromLink) console.error(`MAKE-VERIFY-LINK: read ${url.length} chars from ${fromLink}`);
