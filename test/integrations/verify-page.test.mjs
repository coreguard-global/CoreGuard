/**
 * The page is a second implementation, so it gets compared, not trusted.
 *
 * Cases are run twice — once through the Node verifier the pilot uses, once
 * through the browser module — and the decisions and codes must match. The
 * page's own assets are then checked for the property that makes it useful:
 * it must work with no network at all.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson as nodeCanonicalJson,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
} from "../../packages/stellar/presign.mjs";
import { canonicalJson as pageCanonicalJson, verifyBundle } from "../../docs/verify-receipt.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOW = 1731300000;
const XDR = "AAAAAgAAAABkbe0AAAAAAAAAAAAAAAA=";
const DEST = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const POLICY = { asset: "XLM", maxAmount: "10", destination: DEST };

const issuer = createInMemoryIssuer({ seedHex: "42".repeat(32) });
const issued = issueAuthorizationReceipt({
  network: "TESTNET",
  xdr: XDR,
  policy: POLICY,
  issuer,
  nowSeconds: NOW,
  ttlSeconds: 600,
});
const receipt = issued.receipt;

test("the browser verifier reaches the same verdict and code as the Node verifier", async () => {
  const cases = [
    ["exact match", { xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: NOW }],
    ["one appended byte", { xdr: `${XDR} `, network: "TESTNET", policy: POLICY, nowSeconds: NOW }],
    ["expired", { xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: receipt.expiresAt }],
    ["not yet valid", { xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: receipt.issuedAt - 1 }],
    ["wrong network", { xdr: XDR, network: "PUBLIC", policy: POLICY, nowSeconds: NOW }],
    ["wrong policy", { xdr: XDR, network: "TESTNET", policy: { ...POLICY, maxAmount: "11" }, nowSeconds: NOW }],
    ["unpinned issuer", { xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: NOW, issuerPublicKey: "11".repeat(32) }],
  ];

  for (const [name, args] of cases) {
    const nodeVerdict = verifyAuthorizationReceipt({
      receipt,
      issuerPublicKey: issuer.publicKeyHex,
      ...args,
    });
    const pageVerdict = await verifyBundle({
      receipt,
      issuerPublicKey: issuer.publicKeyHex,
      ...args,
    });
    assert.equal(pageVerdict.decision, nodeVerdict.decision, `${name}: decision`);
    assert.equal(pageVerdict.code, nodeVerdict.code, `${name}: code`);
    assert.equal(pageVerdict.executionProof, "NOT_INCLUDED", `${name}: execution is never claimed`);
  }
});

test("the browser verifier refuses malformed receipts with the same codes", async () => {
  const broken = [
    ["unknown field", { ...receipt, extra: 1 }, "MALFORMED_RECEIPT"],
    ["truncated digest", { ...receipt, digest: "0".repeat(63) }, "MALFORMED_RECEIPT"],
    ["re-ordered window", { ...receipt, expiresAt: receipt.issuedAt }, "MALFORMED_RECEIPT"],
    ["edited policy", { ...receipt, policy: { ...receipt.policy, maxAmount: "999" } }, "BAD_DIGEST"],
    // The signature is outside the digested fields: a forged one keeps the
    // digest valid and fails at the pinned-key check, by name.
    ["edited signature", { ...receipt, signature: "0".repeat(128) }, "BAD_SIGNATURE"],
  ];
  for (const [name, candidate, expected] of broken) {
    const pageVerdict = await verifyBundle({
      receipt: candidate,
      xdr: XDR,
      network: "TESTNET",
      nowSeconds: NOW,
      issuerPublicKey: issuer.publicKeyHex,
    });
    assert.equal(pageVerdict.decision, "BLOCK", `${name}: must block`);
    assert.equal(pageVerdict.code, expected, `${name}: code`);
  }
});

test("the two canonicalizers produce identical bytes on awkward values", () => {
  const values = [
    { b: 1, a: 2 },
    { policy: { maxAmount: "10", asset: "XLM" }, nested: { z: null, a: [1, "x", true] } },
    { unicode: "سعر · ✓", number: 0, negative: -1 },
    { empty: {}, list: [] },
  ];
  for (const value of values) {
    assert.equal(pageCanonicalJson(value), nodeCanonicalJson(value), JSON.stringify(value));
  }
});

test("the page loads nothing from the network and names only local modules", () => {
  const html = readFileSync(join(REPO, "docs", "verify.html"), "utf8");
  const page = readFileSync(join(REPO, "docs", "verify-page.mjs"), "utf8");
  const core = readFileSync(join(REPO, "docs", "verify-receipt.mjs"), "utf8");

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /src="https?:/);
  assert.doesNotMatch(html, /href="https?:/);
  assert.match(html, /src="\.\/verify-page\.mjs"/);

  for (const source of [page, core]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/, "no fetch");
    assert.doesNotMatch(source, /XMLHttpRequest/, "no XHR");
    assert.doesNotMatch(source, /from "https?:/, "no remote imports");
    assert.doesNotMatch(source, /from "node:/, "must run in a browser");
  }
  assert.doesNotMatch(core, /^\s*import /m, "the verification core has no imports at all");
});

test("the link generator packs the bundle into a fragment the page can read", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-link-"));
  writeFileSync(join(dir, "receipt.json"), JSON.stringify(receipt));
  writeFileSync(join(dir, "envelope.txt"), XDR);
  writeFileSync(join(dir, "issuer.json"), JSON.stringify({ publicKeyHex: issuer.publicKeyHex }));

  const url = execFileSync(
    process.execPath,
    [join(REPO, "scripts", "make-verify-link.mjs"), dir, "--at", String(NOW)],
    { encoding: "utf8" },
  ).trim();

  assert.match(url, /^docs\/verify\.html#v1\.[A-Za-z0-9_-]+$/);
  const bundle = JSON.parse(Buffer.from(url.split("#v1.")[1], "base64url").toString("utf8"));
  assert.equal(bundle.receipt.digest, receipt.digest);
  assert.equal(bundle.xdr, XDR);
  assert.equal(bundle.at, NOW);
  assert.equal(bundle.issuerPublicKey, issuer.publicKeyHex);
  assert.equal(readFileSync(join(dir, "verify-link.txt"), "utf8").trim(), url);
});
