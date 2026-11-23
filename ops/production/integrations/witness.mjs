/**
 * External witness / anchor adapter (CG-WITNESS/1)
 *
 * Real RFC 6962 Merkle audit-path verification and read-only Stellar Horizon
 * transaction/memo-hash checks. This adapter never submits transactions, never
 * signs, and never claims that an anchor proves physical-world truth.
 */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import {
  INTEGRATIONS_BOUNDARY, requireProvisioned, requestJson, verdict, safeEqual, canonicalJson, nowIso,
} from "./common.mjs";

export const WITNESS_VERSION = "CG-WITNESS/1";
const sha256 = (b) => createHash("sha256").update(b).digest();
const hex = (b) => Buffer.from(b).toString("hex");
function toBytes(v) {
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string") {
    const s = v.replace(/^0x/i, "");
    if (!/^[0-9a-f]*$/i.test(s) || s.length % 2 !== 0) throw new TypeError("leaf/node must be an even-length hex string or bytes");
    return Buffer.from(s, "hex");
  }
  throw new TypeError("leaf/node must be hex string or bytes");
}
const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

/** RFC 6962 leaf hash: SHA256(0x00 || leaf). */
export function leafHash(leaf) { return hex(sha256(Buffer.concat([LEAF_PREFIX, toBytes(leaf)]))); }

/** RFC 6962 internal node: SHA256(0x01 || left || right). */
export function nodeHash(left, right) { return hex(sha256(Buffer.concat([NODE_PREFIX, toBytes(left), toBytes(right)]))); }

/**
 * Real RFC 6962 inclusion-proof verification.
 * `proof` is an array of hex node hashes ordered bottom-up; `leafIndex` and
 * `treeSize` must describe the SAME signed tree head as `rootHash`.
 */
export function verifyInclusionProof({ leaf, leafIndex, treeSize, rootHash, proof }) {
  const issues = [];
  if (!Number.isInteger(leafIndex) || leafIndex < 0) issues.push("INVALID_LEAF_INDEX");
  if (!Number.isInteger(treeSize) || treeSize <= 0 || leafIndex >= treeSize) issues.push("INVALID_TREE_SIZE");
  if (!Array.isArray(proof)) issues.push("INVALID_PROOF");
  if (typeof rootHash !== "string" || !/^[0-9a-f]{64}$/i.test(rootHash)) issues.push("INVALID_ROOT_HASH");
  if (issues.length) return { ok: false, issues };

  let h;
  try { h = leafHash(leaf); } catch (err) { return { ok: false, issues: [`INVALID_LEAF: ${err.message}`] }; }
  let fn = leafIndex;
  let sn = treeSize - 1;
  for (const [i, node] of proof.entries()) {
    if (typeof node !== "string" || !/^[0-9a-f]{64}$/i.test(node)) return { ok: false, issues: [`INVALID_PROOF_NODE_${i}`] };
    if (sn === 0) return { ok: false, issues: ["PROOF_LONGER_THAN_TREE"] };
    if (fn === 0 && sn === 0) return { ok: false, issues: ["PROOF_PAST_ROOT"] };
    if ((fn & 1) === 1 || fn === sn) {
      h = nodeHash(node, h);
      while ((fn & 1) === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
    } else {
      h = nodeHash(h, node);
    }
    fn >>= 1;
    sn >>= 1;
  }
  const ok = sn === 0 && safeEqual(h, rootHash.toLowerCase());
  return { ok, issues: ok ? [] : ["INCLUSION_PROOF_MISMATCH"], computedRoot: h, expectedRoot: rootHash.toLowerCase() };
}

export function createWitnessClient(config = {}) {
  const allowLocal = !!config.allowLocal;
  const endpoint = (() => {
    requireProvisioned(config, ["endpoint"], { allowLocal });
    const e = String(config.endpoint).replace(/\/+$/, "");
    if (!allowLocal && !e.startsWith("https://")) throw Object.assign(new Error("CG-WITNESS/1: witness endpoint must be HTTPS"), { code: "INSECURE_ENDPOINT" });
    return e;
  })();

  function verifySthSignature(sth) {
    if (!config.publicKeyPem) return { checked: false, ok: null };
    if (!sth?.signature) return { checked: true, ok: false, reason: "MISSING_STH_SIGNATURE" };
    try {
      const body = { treeSize: sth.treeSize, rootHash: sth.rootHash, timestamp: sth.timestamp };
      const ok = cryptoVerify(
        null,
        Buffer.from(canonicalJson({ __domain: "coreguard-witness-sth/1", body }), "utf8"),
        createPublicKey(config.publicKeyPem),
        Buffer.from(sth.signature, "base64"),
      );
      return { checked: true, ok: ok === true, reason: ok ? null : "STH_SIGNATURE_INVALID" };
    } catch (err) { return { checked: true, ok: false, reason: `STH_SIGNATURE_ERROR: ${err.message}` }; }
  }

  async function getSth() {
    const res = await requestJson(`${endpoint}/v1/sth`, { timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "witness-sth", expectStatus: [200] });
    const sth = res.body;
    if (!sth || !Number.isInteger(sth.treeSize) || !/^[0-9a-f]{64}$/i.test(String(sth.rootHash || ""))) {
      return verdict("INVALID_STH", { reason: "INVALID_STH" });
    }
    const sig = verifySthSignature(sth);
    if (sig.checked && !sig.ok) return verdict(sig.reason, { reason: sig.reason, sth });
    return { spec: WITNESS_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), sth: { ...sth, signatureChecked: sig.checked } };
  }

  async function getProof({ leafIndex, treeSize }) {
    const url = `${endpoint}/v1/proof?leaf_index=${encodeURIComponent(leafIndex)}&tree_size=${encodeURIComponent(treeSize)}`;
    const proofRes = await requestJson(url, { timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "witness-proof", expectStatus: [200] });
    if (!Array.isArray(proofRes.body?.proof)) return verdict("INVALID_PROOF_RESPONSE", { reason: "INVALID_PROOF_RESPONSE" });
    return { spec: WITNESS_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), proof: proofRes.body.proof, leafIndex, treeSize };
  }

  async function submit(leaf) {
    const lh = leafHash(leaf);
    const res = await requestJson(`${endpoint}/v1/leaves`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: { leaf: typeof leaf === "string" ? leaf : Buffer.from(leaf).toString("hex"), leafHash: lh },
      timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "witness-submit", expectStatus: [200, 201, 202],
    });
    const leafIndex = res.body?.leafIndex;
    if (!Number.isInteger(leafIndex)) return verdict("INVALID_SUBMIT_RESPONSE", { reason: "INVALID_SUBMIT_RESPONSE" });
    return { spec: WITNESS_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), leafIndex, leafHash: lh };
  }

  async function verifyAnchor({ leaf, sth, proof, leafIndex }) {
    if (!sth || !proof) return verdict("ANCHOR_EVIDENCE_INCOMPLETE", { reason: "ANCHOR_EVIDENCE_INCOMPLETE" });
    const sig = verifySthSignature(sth);
    if (sig.checked && !sig.ok) return verdict(sig.reason, { reason: sig.reason });
    const p = verifyInclusionProof({ leaf, leafIndex, treeSize: sth.treeSize, rootHash: sth.rootHash, proof });
    if (!p.ok) return verdict(p.issues[0], { reason: p.issues[0], computedRoot: p.computedRoot });
    return {
      spec: WITNESS_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(),
      leafHash: leafHash(leaf), leafIndex, treeSize: sth.treeSize, rootHash: sth.rootHash,
      sthSignatureChecked: sig.checked,
      note: "Inclusion in an external log is proven; the log's trust root and the leaf's semantic content remain separate assumptions.",
    };
  }

  return Object.freeze({ spec: WITNESS_VERSION, getSth, getProof, submit, verifyAnchor, verifyInclusionProof: (a) => verifyInclusionProof(a) });
}

/**
 * Read-only Stellar Horizon anchor verifier. No signing, no submission.
 * It checks that a transaction exists, succeeded, and carries the expected
 * hash memo that binds an off-chain CoreGuard digest.
 */
export function createStellarAnchorVerifier(config = {}) {
  const allowLocal = !!config.allowLocal;
  const horizon = (() => {
    requireProvisioned(config, ["horizonUrl"], { allowLocal });
    const h = String(config.horizonUrl).replace(/\/+$/, "");
    if (!allowLocal && !h.startsWith("https://")) throw Object.assign(new Error("CG-WITNESS/1: Horizon endpoint must be HTTPS"), { code: "INSECURE_ENDPOINT" });
    return h;
  })();
  requireProvisioned(config, ["networkPassphrase"]);

  async function verifyTransaction({ txHash, expectedMemoHash, expectedLedger = null, minConfirmations = 0 }) {
    if (!/^[0-9a-f]{64}$/i.test(String(txHash || ""))) return verdict("INVALID_TX_HASH", { reason: "INVALID_TX_HASH" });
    if (!/^[0-9a-f]{64}$/i.test(String(expectedMemoHash || ""))) return verdict("INVALID_EXPECTED_MEMO", { reason: "INVALID_EXPECTED_MEMO" });
    let res;
    try {
      res = await requestJson(`${horizon}/transactions/${txHash}`, { timeoutMs: config.timeoutMs ?? 8000, retries: 1, label: "horizon-tx", expectStatus: [200] });
    } catch (err) { return verdict("HORIZON_UNREACHABLE", { reason: "HORIZON_UNREACHABLE", detail: err.detail ?? { message: err.message } }); }
    const tx = res.body;
    if (!tx || typeof tx !== "object") return verdict("INVALID_HORIZON_RESPONSE", { reason: "INVALID_HORIZON_RESPONSE" });
    const issues = [];
    if (String(tx.hash || "").toLowerCase() !== txHash.toLowerCase()) issues.push("TX_HASH_MISMATCH");
    if (tx.successful !== true) issues.push("TX_NOT_SUCCESSFUL");
    if (tx.ledger === undefined || !Number.isInteger(tx.ledger)) issues.push("MISSING_LEDGER");
    if (tx.memo_type !== "hash" || String(tx.memo || "").toLowerCase() !== expectedMemoHash.toLowerCase()) issues.push("MEMO_HASH_MISMATCH");
    if (expectedLedger !== null && tx.ledger !== Number(expectedLedger)) issues.push("LEDGER_MISMATCH");
    if (minConfirmations > 0 && config.currentLedger !== undefined && Number(config.currentLedger) - tx.ledger + 1 < minConfirmations) issues.push("INSUFFICIENT_CONFIRMATIONS");
    if (issues.length) return verdict(issues[0], { reason: issues[0], issues, txHash, ledger: tx.ledger ?? null });
    return {
      spec: WITNESS_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(),
      txHash, ledger: tx.ledger, memoHash: tx.memo, networkPassphrase: config.networkPassphrase,
      note: "Horizon records were read only; CoreGuard did not sign or submit this transaction.",
    };
  }

  return Object.freeze({ spec: WITNESS_VERSION, verifyTransaction });
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  const leaf = "abcdef";
  const lh = leafHash(leaf);
  push("leaf hash is 32 bytes", /^[0-9a-f]{64}$/.test(lh));
  const sibling = nodeHash(lh, lh);
  const root = nodeHash(sibling, sibling);
  const p = verifyInclusionProof({ leaf, leafIndex: 0, treeSize: 4, rootHash: root, proof: [lh, sibling] });
  push("valid RFC6962 proof accepted", p.ok === true);
  const bad = verifyInclusionProof({ leaf: "different", leafIndex: 0, treeSize: 4, rootHash: root, proof: [lh, sibling] });
  push("tampered leaf rejected", bad.ok === false);
  let refused = false;
  try { createWitnessClient({ endpoint: "https://witness.example.com" }); } catch (e) { refused = e.code === "NOT_PROVISIONED"; }
  push("refuses placeholder witness", refused);
  return { ok: checks.every(c => c.ok), checks };
}
