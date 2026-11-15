/**
 * The quickstart says `import … from "@coreguard/stellar/presign"`. That is
 * only true if the package can leave this repository.
 *
 * This test does what a consumer does, minus the registry: a real `npm pack`,
 * a real extraction into a throwaway project OUTSIDE the repo, and imports by
 * package name (root and subpath) in a fresh Node process. No network, no
 * publish, no symlink into the repo tree except the one runtime dependency the
 * full adapter declares — and even that is a junction, so the module under test
 * is only ever the packed tarball.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG_DIR = join(REPO, "packages", "stellar");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function pack(dest) {
  // Windows resolves `npm` to a .cmd shim, which Node refuses to spawn without
  // a shell; the paths involved contain spaces, so quote them in that case.
  const win = process.platform === "win32";
  // cmd.exe strips unquoted backslashes; forward slashes are accepted by npm.
  const arg = (p) => (win ? `"${p.replace(/\\/g, "/")}"` : p);
  const args = ["pack", arg(PKG_DIR), "--pack-destination", arg(dest), "--json"];
  const raw = execFileSync(NPM, args, { cwd: REPO, encoding: "utf8", shell: win });
  // npm has printed both an object and an array across versions, sometimes with
  // notices around it: accept either, never guess from one shape.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    assert.ok(start >= 0 && end > start, `npm pack did not print JSON: ${raw}`);
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  // Shapes seen in the wild: [ {…} ], { name, filename, files }, { "pkg-name": {…} }.
  const info = Array.isArray(parsed) ? parsed[0] : parsed.name ? parsed : Object.values(parsed)[0];
  assert.ok(info && info.filename, `npm pack JSON has no filename field: ${raw}`);
  return info;
}

test("the package packs with every file its exports name", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-pack-"));
  const info = pack(dir);

  assert.equal(info.name, "@coreguard/stellar");
  const packed = info.files.map((f) => f.path);
  for (const required of [
    "package.json",
    "index.mjs",
    "index.d.ts",
    "presign.mjs",
    "presign.d.ts",
    "README.md",
  ]) {
    assert.ok(packed.includes(required), `tarball is missing ${required}`);
  }
  // Every exports target must exist on disk, or a consumer hits a resolution error.
  const pkg = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8"));
  const targets = [];
  for (const value of Object.values(pkg.exports)) {
    if (typeof value === "string") targets.push(value);
    else targets.push(...Object.values(value));
  }
  for (const target of targets) {
    assert.equal(target.startsWith("./"), true, `export target must be relative: ${target}`);
    assert.ok(packed.includes(target.slice(2)), `export target not packed: ${target}`);
  }
});

test("a consumer outside the repo imports it by name and gets the same verdicts", () => {
  const dir = mkdtempSync(join(tmpdir(), "cg-consumer-"));
  const info = pack(dir);
  const tarball = join(dir, info.filename);
  assert.ok(existsSync(tarball), `expected the packed tarball at ${tarball}`);

  const consumer = join(dir, "consumer");
  const modules = join(consumer, "node_modules", "@coreguard");
  mkdirSync(modules, { recursive: true });
  // GNU tar reads "C:" as a remote host; --force-local is the portable escape
  // hatch on Windows and is not needed (or accepted) everywhere else.
  const tarArgs = process.platform === "win32" ? ["--force-local", "-xzf", tarball, "-C", consumer] : ["-xzf", tarball, "-C", consumer];
  execFileSync("tar", tarArgs, { cwd: dir });
  // npm pack names the extracted directory `package`; installing it by name is
  // exactly the layout a registry install produces.
  renameSync(join(consumer, "package"), join(modules, "stellar"));
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", type: "module", private: true }));

  // The full adapter declares @stellar/stellar-sdk; junction it so the ROOT
  // import can be exercised offline. The receipt surface needs nothing.
  mkdirSync(join(consumer, "node_modules", "@stellar"), { recursive: true });
  symlinkSync(
    join(REPO, "node_modules", "@stellar", "stellar-sdk"),
    join(consumer, "node_modules", "@stellar", "stellar-sdk"),
    "junction",
  );

  writeFileSync(
    join(consumer, "run.mjs"),
    `
import assert from "node:assert/strict";
import {
  PSAR_VERSION, REJECT_CODES, createInMemoryIssuer, issueAuthorizationReceipt, verifyAuthorizationReceipt, status,
} from "@coreguard/stellar/presign";
import { STELLAR_VERSION, presignStatus, createInMemoryIssuer as createFromRoot } from "@coreguard/stellar";

const xdr = "AAAAAgAAAABkbe0AAAAAAAAAAAAAAAA=";
const policy = { asset: "XLM", maxAmount: "10", destination: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" };
const NOW = 1731300000;
const issuer = createInMemoryIssuer({ seedHex: "42".repeat(32) });

const issued = issueAuthorizationReceipt({ network: "TESTNET", xdr, policy, issuer, nowSeconds: NOW, ttlSeconds: 600 });
assert.equal(issued.ok, true);

const pass = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr, network: "TESTNET", policy, nowSeconds: NOW, issuerPublicKey: issuer.publicKeyHex });
assert.equal(pass.decision, "PASS");
assert.equal(pass.executionProof, "NOT_INCLUDED");
assert.equal(pass.code, null);

const tampered = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr: xdr + " ", network: "TESTNET", policy, nowSeconds: NOW, issuerPublicKey: issuer.publicKeyHex });
assert.equal(tampered.decision, "BLOCK");
assert.equal(tampered.code, "XDR_BINDING_MISMATCH");

const expired = verifyAuthorizationReceipt({ receipt: issued.receipt, xdr, network: "TESTNET", policy, nowSeconds: issued.receipt.expiresAt, issuerPublicKey: issuer.publicKeyHex });
assert.equal(expired.code, "RECEIPT_EXPIRED");

assert.equal(PSAR_VERSION, "PSAR/1");
assert.equal(REJECT_CODES.length, 11);
assert.equal(STELLAR_VERSION, "STELLAR/1");
assert.equal(presignStatus().integrationStatus, "NOT_BUILT");
assert.equal(status().integrationStatus, "NOT_BUILT");
assert.equal(createFromRoot, createInMemoryIssuer, "root and subpath must resolve to one module");

console.log(JSON.stringify({ decision: pass.decision, tampered: tampered.code, expired: expired.code, digest: issued.receipt.digest }));
`,
  );

  const stdout = execFileSync(process.execPath, ["run.mjs"], { cwd: consumer, encoding: "utf8" });
  const result = JSON.parse(stdout.trim());
  assert.equal(result.decision, "PASS");
  assert.equal(result.tampered, "XDR_BINDING_MISMATCH");
  assert.equal(result.expired, "RECEIPT_EXPIRED");
  assert.match(result.digest, /^[0-9a-f]{64}$/);
});
