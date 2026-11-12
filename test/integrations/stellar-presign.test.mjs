/**
 * test/integrations/stellar-presign.test.mjs
 *
 * PSAR/1 - the pre-sign authorization receipt contract.
 *
 * The one property everything here protects: a receipt lets a wallet decide
 * from ITS OWN verification - not from a verdict string, an image, or a DApp's
 * claim - and every way the world can attack that decision BLOCKs by name:
 * the XDR is swapped or edited after issuance, the network differs, the policy
 * is altered, the window lapses, the signature breaks, the digest is edited,
 * unknown fields ride along - and an internal verifier error BLOCKs too.
 * The only PASS is a fully verified receipt, and no verdict ever claims
 * execution.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PSAR_VERSION,
  PSAR_SCHEMA,
  PSAR_NETWORKS,
  RECEIPT_SCOPE,
  EXECUTION_PROOF_FIELD,
  DECISIONS,
  REJECT_CODES,
  canonicalJson,
  fingerprintXdr,
  normalizePolicy,
  createInMemoryIssuer,
  issueAuthorizationReceipt,
  verifyAuthorizationReceipt,
  status,
  selfCheck,
} from "../../packages/stellar/presign.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/* ---- the fixed world the known-answer vectors live in ---- */
const SEED = "42".repeat(32);
const ISSUER_PUB = "2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12";
const XDR = "AAAAAgAAAADg3G3xaslKJQ0Ab7wbLQvgZ9vJY5NZB4PFHLU7lixGRgAAAAIAAAABAAAAAQAAAAA=";
const XDR_FP = "3a1c59c974d893d7d44b96dd23e36429c560867da12d6a2b266d1dd4d2d5d3ea";
const POLICY = { asset: "XLM", maxAmount: "10", destination: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" };
const NOW = 1731300000;
const TTL = 3600;

function issue(overrides = {}) {
  const issuer = createInMemoryIssuer({ seedHex: SEED });
  return issueAuthorizationReceipt({
    network: "TESTNET", xdr: XDR, policy: POLICY, issuer, nowSeconds: NOW, ttlSeconds: TTL, ...overrides,
  });
}

function verify(receipt, overrides = {}) {
  return verifyAuthorizationReceipt({
    receipt, xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: NOW + 1, issuerPublicKey: ISSUER_PUB, ...overrides,
  });
}

test("PSAR/1 exports version, schema, scope and the two-valued decision set", () => {
  assert.equal(PSAR_VERSION, "PSAR/1");
  assert.equal(PSAR_SCHEMA, "coreguard.psar/1");
  assert.equal(RECEIPT_SCOPE, "PRE_SIGN_AUTHORIZATION");
  assert.deepEqual([...DECISIONS], ["PASS", "BLOCK"]);
  assert.ok(PSAR_NETWORKS.includes("TESTNET") && PSAR_NETWORKS.includes("PUBLIC"));
});

test("every reject code the module can emit is in the frozen vocabulary", () => {
  for (const code of ["MALFORMED_RECEIPT", "MALFORMED_INPUT", "BAD_DIGEST", "BAD_SIGNATURE", "ISSUER_MISMATCH", "XDR_BINDING_MISMATCH", "NETWORK_MISMATCH", "POLICY_MISMATCH", "NOT_YET_VALID", "RECEIPT_EXPIRED", "VERIFIER_ERROR"]) {
    assert.ok(REJECT_CODES.includes(code), `missing code ${code}`);
  }
  assert.equal(REJECT_CODES.length, 11, "the reject vocabulary is an explicit, versioned set, not open-ended");
});

test("status() is honest: offline prototype, integration NOT_BUILT, execution never claimed", () => {
  const s = status();
  assert.equal(s.integrationStatus, "NOT_BUILT");
  assert.equal(s.runMode, "OFFLINE_PROTOTYPE");
  assert.equal(s.executed, false);
  assert.equal(s.receiptCaptured, false);
  assert.ok(s.doesNotProve.includes("EXECUTION"));
  assert.ok(s.failClosed.includes("never a pass"));
});

test("selfCheck() passes - the whole issue/verify/tamper/expire cycle in-memory", () => {
  const r = selfCheck();
  assert.equal(r.ok, true);
});

test("canonicalJson is byte-deterministic (sorted keys, no whitespace) - known answer", () => {
  assert.equal(canonicalJson({ b: 2, a: 1, c: { z: 1, y: [2, 1] } }), '{"a":1,"b":2,"c":{"y":[2,1],"z":1}}');
});

test("fingerprintXdr binds the EXACT utf8 bytes - known answer", () => {
  assert.equal(fingerprintXdr(XDR), XDR_FP);
  assert.notEqual(fingerprintXdr(XDR + " "), XDR_FP);
});

test("issueAuthorizationReceipt gates on invalid args and never touches wallet keys", () => {
  assert.equal(issue({ xdr: "" }).ok, false);
  assert.equal(issue({ network: "mainnet" }).ok, false);
  assert.equal(issue({ policy: { amount: 10 } }).ok, false); // amounts are strings, never floats
  assert.equal(issue({ issuer: { publicKeyHex: ISSUER_PUB } }).ok, false); // no sign closure
  assert.equal(issue({ nowSeconds: "now" }).ok, false);
  assert.equal(issue({ ttlSeconds: 0 }).ok, false);
});

test("issued receipt carries the exact field set with the known-answer digest", () => {
  const r = issue();
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.receipt).sort(), ["digest", "expiresAt", "issuedAt", "issuer", "network", "policy", "scope", "signature", "v", "xdrFingerprint"]);
  assert.equal(r.receipt.xdrFingerprint, XDR_FP);
  assert.equal(r.receipt.issuedAt, NOW);
  assert.equal(r.receipt.expiresAt, NOW + TTL);
  assert.equal(r.receipt.issuer, ISSUER_PUB);
  assert.match(r.receipt.signature, /^[0-9a-f]{128}$/);
  assert.equal(r.digest, "5ab4c8dfc685514305029e43bfd82268905063f826eb46ebe07d84e5f046d6b1");
});

test("a matching authorization PASSes and the PASS names no execution proof", () => {
  const r = issue();
  const v = verify(r.receipt);
  assert.equal(v.decision, "PASS");
  assert.equal(v.code, null);
  assert.deepEqual(v.reasons, []);
  assert.equal(v.executionProof, EXECUTION_PROOF_FIELD, "a pre-sign receipt never proves execution");
  assert.equal(v.receiptId, r.digest);
  assert.equal(EXECUTION_PROOF_FIELD, "NOT_INCLUDED");
});

test("one appended byte BLOCKs - the binding is to the exact XDR string", () => {
  const v = verify(issue().receipt, { xdr: XDR + " " });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "XDR_BINDING_MISMATCH");
});

test("an edited transaction (different bytes, same length) BLOCKs", () => {
  const swapped = XDR.slice(0, -4) + "AAAA";
  const v = verify(issue().receipt, { xdr: swapped });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "XDR_BINDING_MISMATCH");
});

test("a different network BLOCKs even for byte-identical XDR", () => {
  const v = verify(issue().receipt, { network: "PUBLIC" });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "NETWORK_MISMATCH");
});

test("an altered policy BLOCKs (the amount the user agreed to is the amount enforced)", () => {
  const v = verify(issue().receipt, { policy: { ...POLICY, maxAmount: "500" } });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "POLICY_MISMATCH");
});

test("policy keys are compared canonically, not by JS identity", () => {
  // Same policy content in a different key order must still PASS.
  const reordered = { destination: POLICY.destination, asset: POLICY.asset, maxAmount: POLICY.maxAmount };
  const v = verify(issue().receipt, { policy: reordered });
  assert.equal(v.decision, "PASS");
});

test("an expired receipt BLOCKs; the boundary is exclusive at expiresAt", () => {
  const v = verify(issue().receipt, { nowSeconds: NOW + TTL });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "RECEIPT_EXPIRED");
});

test("a receipt checked before its issuance BLOCKs (NOT_YET_VALID)", () => {
  const v = verify(issue().receipt, { nowSeconds: NOW - 1 });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "NOT_YET_VALID");
});

test("a flipped signature byte BLOCKs (BAD_SIGNATURE) and never throws", () => {
  const receipt = issue().receipt;
  const flipped = (receipt.signature[0] === "a" ? "b" : "a") + receipt.signature.slice(1);
  const v = verify({ ...receipt, signature: flipped });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "BAD_SIGNATURE");
});

test("an edited digest BLOCKs (BAD_DIGEST) - the receipt cannot lie about itself", () => {
  const receipt = issue().receipt;
  const forged = (receipt.digest[0] === "a" ? "b" : "a") + receipt.digest.slice(1);
  const v = verify({ ...receipt, digest: forged });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "BAD_DIGEST");
});

test("a signature made by a DIFFERENT issuer BLOCKs against the pinned key", () => {
  const other = createInMemoryIssuer({ seedHex: "77".repeat(32) });
  const r = issue({ issuer: other });
  const v = verify(r.receipt); // pinned ISSUER_PUB, receipt signed by "other"
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "BAD_SIGNATURE");
});

test("unknown fields BLOCK (the receipt shape is closed, not decorative)", () => {
  const receipt = issue().receipt;
  const v = verify({ ...receipt, verdict: "PASS" });
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "MALFORMED_RECEIPT");
});

test("a missing field and a wrong version BLOCK (MALFORMED_RECEIPT)", () => {
  const receipt = issue().receipt;
  const missing = { ...receipt }; delete missing.issuer;
  assert.equal(verify(missing).code, "MALFORMED_RECEIPT");
  assert.equal(verify({ ...receipt, v: "PSAR/2" }).code, "MALFORMED_RECEIPT");
  assert.equal(verify(null).code, "MALFORMED_RECEIPT");
  assert.equal(verify("PASS").code, "MALFORMED_RECEIPT");
});

test("malformed caller input BLOCKs by name, never passes", () => {
  const receipt = issue().receipt;
  assert.equal(verify(receipt, { xdr: "" }).code, "MALFORMED_INPUT");
  assert.equal(verify(receipt, { nowSeconds: -1 }).code, "MALFORMED_INPUT");
  assert.equal(verify(receipt, { network: "nope" }).code, "MALFORMED_INPUT");
  assert.equal(verify(receipt, { policy: null }).code, "MALFORMED_INPUT");
  assert.equal(verify(receipt, { issuerPublicKey: "zz" }).code, "MALFORMED_INPUT");
});

test("fail-closed end to end: a broken pinned key BLOCKs, verify() never throws", () => {
  const receipt = issue().receipt;
  const v = verify(receipt, { issuerPublicKey: "00".repeat(32) });
  assert.equal(v.decision, "BLOCK");
  assert.ok(["BAD_SIGNATURE", "MALFORMED_INPUT"].includes(v.code));
  assert.equal(v.executionProof, EXECUTION_PROOF_FIELD);
});

test("the digest is sha256 over the canonical ADR - re-derived here, not trusted", () => {
  const receipt = issue().receipt;
  const adr = {
    v: receipt.v, scope: receipt.scope, network: receipt.network, xdrFingerprint: receipt.xdrFingerprint,
    policy: receipt.policy, issuedAt: receipt.issuedAt, expiresAt: receipt.expiresAt, issuer: receipt.issuer,
  };
  const expected = createHash("sha256").update(Buffer.from(canonicalJson(adr), "utf8")).digest("hex");
  assert.equal(receipt.digest, expected);
});

test("issuing for the same inputs twice is byte-deterministic (same digest, same signature)", () => {
  const a = issue();
  const b = issue();
  assert.equal(a.digest, b.digest);
  assert.equal(a.receipt.signature, b.receipt.signature);
});

test("normalizePolicy refuses non-string values - amounts ride strings, never floats", () => {
  assert.equal(normalizePolicy({ amount: 10 }).ok, false);
  assert.equal(normalizePolicy({ amount: "10" }).ok, true);
  assert.equal(normalizePolicy(null).ok, false);
  assert.equal(normalizePolicy([1]).ok, false);
});

test("the demo fixture the docs cite runs the whole arc offline (import-shape check)", async () => {
  // The documented demo command is executed by the docs-node contract; this
  // test only proves the demo module exists and exports its arc builder.
  const mod = await import(pathToFileURL(resolve(here, "../../examples/stellar-presign/demo.mjs")).href);
  assert.equal(typeof mod.runArc, "function");
});

/* ---- fix batch 2026-11-12: issuer identity, hostile input, window hardening ---- */

function forgeReceipt({ issuerHex, signer, overrides = {} }) {
  // Build an INTERNALLY CONSISTENT receipt (digest + signature both valid) on a
  // hand-made ADR, so the deep verify steps can be exercised with chosen field
  // values (a false issuer claim that is nevertheless signed correctly).
  const adr = {
    v: PSAR_VERSION, scope: RECEIPT_SCOPE, network: "TESTNET",
    xdrFingerprint: XDR_FP, policy: POLICY, issuedAt: NOW, expiresAt: NOW + TTL,
    issuer: issuerHex, ...overrides,
  };
  const bytes = Buffer.from(canonicalJson(adr), "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  return { ...adr, digest, signature: signer.sign(bytes) };
}

const PINNED = createInMemoryIssuer({ seedHex: SEED }); // the key the verifier pins
const IMPOSTOR = createInMemoryIssuer({ seedHex: "77".repeat(32) }); // a key a receipt may falsely claim

const XDR_500 = "AAAAAgAAAADTsUWraPPAVsZ9DfGEXQoAZiHNc5uTB6WWAY5zJ3IfFQAAAGQAAAAAAAAAAgAAAAEAAAAAAAAAAAAAAABnMYz4AAAAAAAAAAEAAAAAAAAAAQAAAAABlHJijueOuScU0i0DkJY8JNkn6gCZmUhuiR+sLaqcIQAAAAAAAAABKgXyAAAAAAAAAAAA";

test("a receipt CLAIMED a different issuer BLOCKs (ISSUER_MISMATCH) even when the pinned key signed it", () => {
  // The ADR names the impostor and the PINNED key signed exactly those bytes:
  // the digest and signature are internally valid - the identity is the gap.
  const receipt = forgeReceipt({ issuerHex: IMPOSTOR.publicKeyHex, signer: PINNED });
  const v = verify(receipt);
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "ISSUER_MISMATCH");
  assert.equal(v.executionProof, EXECUTION_PROOF_FIELD);
  assert.equal(v.receiptId, receipt.digest);
});

test("the issuer-identity check sits AFTER signature verification - a claim-B receipt signed by B dies as BAD_SIGNATURE", () => {
  // Placement proof: a receipt that claims the impostor AND is signed by the
  // impostor must never reach the ISSUER_MISMATCH check - it dies at the
  // signature step against the pinned key first.
  const receipt = forgeReceipt({ issuerHex: IMPOSTOR.publicKeyHex, signer: IMPOSTOR });
  const v = verify(receipt);
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "BAD_SIGNATURE");
});

test("issuing fails closed when issuer.sign does not sign with issuer.publicKeyHex", () => {
  // The issuer object DECLARES the impostor key while sign() is bound to the
  // pinned key - issuance must refuse, never emit a mismatched receipt.
  const r = issue({ issuer: { publicKeyHex: IMPOSTOR.publicKeyHex, sign: PINNED.sign } });
  assert.equal(r.ok, false);
  assert.match(r.error, /issuer\.sign does not sign with issuer\.publicKeyHex/);
  assert.equal(r.receipt, null);
});

test("unsafe-integer window stamps are refused at issue and BLOCK at verify", () => {
  assert.equal(issue({ nowSeconds: 2 ** 53 }).ok, false); // beyond Number.MAX_SAFE_INTEGER
  assert.equal(issue({ nowSeconds: Number.MAX_SAFE_INTEGER - 10, ttlSeconds: 100 }).ok, false); // the SUM leaves the safe range
  const receipt = forgeReceipt({ issuerHex: ISSUER_PUB, signer: PINNED, overrides: { issuedAt: 2 ** 53, expiresAt: 2 ** 53 + TTL } });
  assert.equal(verify(receipt).code, "MALFORMED_RECEIPT");
  assert.equal(verify(issue().receipt, { nowSeconds: 2 ** 53 }).code, "MALFORMED_INPUT");
});

test("LIMITATION (v1): the byte-binding layer does not decode XDR - a policy contradicting the decoded amount still PASSes", () => {
  // Captured, deterministic 500-XLM payment envelope (the same builder the
  // demo uses, maxTime pinned): it is the tampered amount of the demo arc.
  // The receipt layer binds BYTES and never interprets them, so a receipt
  // issued for maxAmount "10" over a 500-XLM envelope verifies PASS - the gap
  // is documented and pinned here on purpose; closing it is enforced semantic
  // verification (PSAR/2 P1), NOT a v1 claim.
  const issued = issue({ xdr: XDR_500 });
  assert.equal(issued.ok, true);
  const v = verify(issued.receipt, { xdr: XDR_500 });
  assert.equal(v.decision, "PASS");
  assert.notEqual(fingerprintXdr(XDR_500), XDR_FP); // it really is a different transaction
});

test("LIMITATION (v1): an unsigned envelope carries no network - a receipt claiming TESTNET PASSes over PUBLIC-built bytes", () => {
  // The same captured bytes were built with network: "mainnet" (PUBLIC
  // passphrase) and came out byte-identical - an unsigned Stellar envelope
  // encodes no network, so the passphrase lives only in the absent signature
  // and the transaction hash that would be signed. The receipt's network is
  // therefore a CLAIM vs CLAIM (step 4), never a decoded fact; closing that
  // gap is PSAR/2 material, not a v1 verification step.
  const issued = issue({ network: "TESTNET", xdr: XDR_500 });
  const v = verify(issued.receipt, { xdr: XDR_500, network: "TESTNET" });
  assert.equal(v.decision, "PASS");
});

test("the verifier never throws on hostile receipts - a throwing getter BLOCKs (VERIFIER_ERROR) without escaping", () => {
  const receipt = issue().receipt;
  const hostileDigest = { ...receipt };
  Object.defineProperty(hostileDigest, "digest", { enumerable: true, get() { throw new Error("hostile getter"); } });
  const v = verify(hostileDigest);
  assert.equal(v.decision, "BLOCK");
  assert.equal(v.code, "VERIFIER_ERROR");
  assert.equal(v.receiptId, null); // the BLOCK path itself survives the hostile getter

  const hostilePolicy = { ...receipt };
  Object.defineProperty(hostilePolicy, "policy", { enumerable: true, get() { throw new Error("hostile getter"); } });
  const vp = verify(hostilePolicy);
  assert.equal(vp.decision, "BLOCK");
  assert.equal(vp.code, "VERIFIER_ERROR");
});

test("the verifier never throws on circular or exotic policies - each lands in a named BLOCK", () => {
  const receipt = issue().receipt;
  const circular = { asset: "XLM", maxAmount: "10" };
  circular.self = circular;
  assert.equal(verify(receipt, { policy: circular }).code, "MALFORMED_INPUT");
  assert.equal(verify({ ...receipt, policy: circular }).code, "MALFORMED_RECEIPT");

  let reads = 0;
  const twoFaced = {};
  Object.defineProperty(twoFaced, "maxAmount", { enumerable: true, get() { reads += 1; return reads === 1 ? "10" : twoFaced; } });
  const vt = verify(receipt, { policy: twoFaced });
  assert.equal(vt.decision, "BLOCK");
  assert.equal(vt.code, "VERIFIER_ERROR"); // the canonicalization recursion is caught, named, never thrown

  assert.equal(verify({ ...receipt, policy: new Map([["maxAmount", "10"]]) }).code, "MALFORMED_RECEIPT");
  assert.equal(verify(receipt, { policy: new Date(0) }).code, "MALFORMED_INPUT");
  class NotPlain { constructor() { this.maxAmount = "10"; } }
  assert.equal(verify(receipt, { policy: new NotPlain() }).code, "MALFORMED_INPUT");
  assert.equal(verifyAuthorizationReceipt({ receipt: new Map(), xdr: XDR, network: "TESTNET", policy: POLICY, nowSeconds: NOW, issuerPublicKey: ISSUER_PUB }).code, "MALFORMED_RECEIPT");
});

test("normalizePolicy requires a REAL plain object (prototype Object.prototype or null)", () => {
  assert.equal(normalizePolicy(new Map([["maxAmount", "10"]])).ok, false);
  assert.equal(normalizePolicy(new Date(0)).ok, false);
  class NotPlain { constructor() { this.maxAmount = "10"; } }
  assert.equal(normalizePolicy(new NotPlain()).ok, false);
  assert.equal(normalizePolicy(Object.assign(Object.create(null), { maxAmount: "10" })).ok, true); // prototype-less is still plain
  assert.equal(normalizePolicy({ maxAmount: "10" }).ok, true);
});

test("fingerprintXdr refuses non-strings instead of silently coercing them (TypeError)", () => {
  assert.throws(() => fingerprintXdr(123), TypeError);
  assert.throws(() => fingerprintXdr(null), TypeError);
  assert.throws(() => fingerprintXdr({}), TypeError);
});
