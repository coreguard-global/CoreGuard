/**
 * M4 (BUILT as interfaces/local adapters): KMS and audit anchor abstractions.
 * NOT_BUILT: real KMS/HSM integration, managed external witness/on-chain anchor service.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";

export function createLocalKeyProvider({ keys = {} } = {}) {
  const store = new Map(Object.entries(keys));
  return {
    kind: "local-dev-only",
    async getActiveKey(keyId = "default") {
      const k = store.get(keyId);
      if (!k) throw new Error(`key not found: ${keyId}`);
      return { keyId, material: k };
    },
    async rotateKey(keyId = "default", material) {
      const next = material || randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
      store.set(keyId, next);
      return { keyId, rotatedAt: new Date().toISOString(), fingerprint: fingerprint(next) };
    },
    async sign(keyId, payload) {
      const { material } = await this.getActiveKey(keyId);
      const sig = createHmac("sha256", String(material)).update(payload).digest("hex");
      return { alg: "HMAC-SHA256", keyId, sig, fingerprint: fingerprint(material) };
    },
  };
}

function fingerprint(material) { return "sha256:" + createHash("sha256").update(String(material)).digest("hex").slice(0, 16); }

export function createAnchorProvider({ mode = "local-file", hmacKey = null } = {}) {
  return {
    kind: mode,
    async anchor(head) {
      const base = { headHash: head.headHash, length: head.length, at: new Date().toISOString(), mode };
      if (hmacKey) base.hmacSha256 = createHmac("sha256", String(hmacKey)).update(JSON.stringify({ headHash: base.headHash, length: base.length })).digest("hex");
      base.receiptId = "anchor_" + randomUUID();
      base.boundary = mode === "local-file" ? "local witness only; NOT_BUILT external witness" : "adapter boundary; external service NOT_BUILT in this environment";
      return base;
    },
    async verify(receipt, head) {
      const headOk = receipt.headHash === head.headHash && receipt.length === head.length;
      let hmacOk = true;
      if (receipt.hmacSha256) {
        if (!hmacKey) hmacOk = false;
        else hmacOk = receipt.hmacSha256 === createHmac("sha256", String(hmacKey)).update(JSON.stringify({ headHash: head.headHash, length: head.length })).digest("hex");
      }
      return { ok: headOk && hmacOk, headOk, hmacOk, mode };
    },
  };
}
