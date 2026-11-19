/**
 * A local reference merchant, over real HTTP on loopback.
 *
 * It holds one signing key, commits an approval by digest, executes an order,
 * and publishes the signed receipt at the content-addressed well-known path.
 * A second endpoint (/keys) publishes the public key, but the verifier in the
 * pilot never calls it: the pin arrives out of band, from the merchant's
 * startup console. Fetching the key from the same server that served the
 * receipt would be trust-on-first-use wearing a pin's clothes.
 *
 * It is also a slightly bad merchant on request: `execute_as` lets the caller
 * ask it to execute something other than what it approved, so the kit can show
 * a valid signature over an execution that drifted. That is a merchant bug or
 * a merchant attack, and the binding check is what catches it.
 *
 * BOUNDARY: loopback only. No ports are opened beyond 127.0.0.1, nothing is
 * sent anywhere, and the receipt is never written to a chain.
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { buildReceipt } from "./receipt.mjs";
import { digestOf } from "./lib.mjs";

const MAX_BODY = 1 << 20;

function send(res, status, body, headers = {}) {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": bytes.length,
    "cache-control": "no-store",
    ...headers,
  });
  res.end(bytes);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error(`request body exceeds ${MAX_BODY} bytes`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length === 0 ? null : JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(new Error(`request body is not JSON: ${err?.message ?? err}`));
      }
    });
    req.on("error", reject);
  });
}

function assertIntent(intent) {
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) throw new Error("intent must be an object");
  for (const f of ["merchant_id", "payee", "currency"]) {
    if (typeof intent[f] !== "string" || intent[f].length === 0) throw new Error(`intent.${f} must be a non-empty string`);
  }
  if (!Number.isSafeInteger(intent.total_minor) || intent.total_minor < 0) {
    throw new Error("intent.total_minor must be a non-negative safe integer (minor units)");
  }
  if (!Array.isArray(intent.items) || intent.items.length === 0) throw new Error("intent.items must be a non-empty array");
  for (const it of intent.items) {
    if (typeof it?.sku !== "string" || it.sku.length === 0) throw new Error("every item needs a sku");
    if (!Number.isSafeInteger(it.qty) || it.qty < 1) throw new Error(`item ${it.sku} needs a positive integer qty`);
    if (!Number.isSafeInteger(it.unit_minor) || it.unit_minor < 0) throw new Error(`item ${it.sku} needs an integer unit_minor`);
  }
}

function assertExecution(order) {
  if (!order || typeof order !== "object" || Array.isArray(order)) throw new Error("executed order must be an object");
  if (typeof order.order_ref !== "string" || order.order_ref.length === 0) throw new Error("executed order needs order_ref");
  for (const f of ["merchant_id", "payee", "currency"]) {
    if (typeof order[f] !== "string" || order[f].length === 0) throw new Error(`executed.${f} must be a non-empty string`);
  }
  if (!Number.isSafeInteger(order.total_minor) || order.total_minor < 0) throw new Error("executed.total_minor must be an integer");
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error("executed.items must be a non-empty array");
}

const CLOSED = Symbol("closed");

export async function startMerchantSandbox({ key, merchant, at, port = 0 }) {
  if (!key || typeof key.privateKeyPem !== "string") throw new TypeError("startMerchantSandbox needs a signing key");
  if (!merchant || typeof merchant.id !== "string") throw new TypeError("startMerchantSandbox needs a merchant id");

  const approvals = new Map(); // intent digest -> { intent, approvalNonce, at }
  const receipts = new Map(); // hex digest -> exact canonical bytes
  const idempotency = new Map(); // key -> response record
  const requests = [];
  let origin = null;

  const server = createServer(async (req, res) => {
    requests.push({ method: req.method, path: req.url, at: new Date().toISOString() });
    try {
      const url = new URL(req.url, "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/healthz") {
        return send(res, 200, { ok: true, merchant: merchant.id, origin });
      }

      if (req.method === "GET" && url.pathname === "/keys") {
        return send(res, 200, {
          merchant: merchant.id,
          keys: [
            {
              key_id: key.keyId,
              public_key_pem: key.publicKeyPem,
              note: "pin this out of band; the pilot verifier never fetches it",
            },
          ],
        });
      }

      if (req.method === "POST" && url.pathname === "/approvals") {
        const body = await readJson(req);
        const intent = body?.intent;
        assertIntent(intent);
        const approvalNonce = typeof body?.approval_nonce === "string" && body.approval_nonce.length > 0
          ? body.approval_nonce
          : "nonce-" + randomUUID();
        const intentDigest = digestOf(intent);
        approvals.set(intentDigest, { intent, approvalNonce, at });
        return send(res, 201, {
          merchant: merchant.id,
          intent_digest: intentDigest,
          approval_nonce: approvalNonce,
          note: "the merchant commits the approval by digest, not by trusting a later message",
        });
      }

      if (req.method === "POST" && url.pathname === "/orders") {
        const body = await readJson(req);
        const intentDigest = body?.intent_digest;
        const approvalNonce = body?.approval_nonce;
        const approval = approvals.get(intentDigest);
        if (!approval) return send(res, 404, { error: "unknown_approval", detail: "no approval was committed under this digest" });
        if (approval.approvalNonce !== approvalNonce) {
          return send(res, 409, { error: "approval_nonce_mismatch", detail: "the approval was committed under a different nonce" });
        }

        const idKey = typeof body?.idempotency_key === "string" && body.idempotency_key.length > 0
          ? body.idempotency_key
          : `${intentDigest}:${approvalNonce}`;
        if (idempotency.has(idKey)) {
          return send(res, 200, { ...idempotency.get(idKey), replayed: true });
        }

        const executed = body?.execute_as ?? body?.order;
        assertExecution(executed);
        const built = buildReceipt({
          merchant: { id: merchant.id, name: merchant.name ?? merchant.id },
          approved: approval.intent,
          approvalNonce: approval.approvalNonce,
          executed,
          at,
          privateKeyPem: key.privateKeyPem,
        });
        const hex = built.receiptId.slice("urn:sha256:".length);
        receipts.set(hex, built.bytes);
        const record = {
          receipt_id: built.receiptId,
          receipt_url: `${origin}/.well-known/var1/receipts/${hex}`,
          order_ref: executed.order_ref,
          replayed: false,
        };
        idempotency.set(idKey, record);
        return send(res, 201, record);
      }

      const served = /^\/\.well-known\/var1\/receipts\/([0-9a-f]{64})$/.exec(url.pathname);
      if (req.method === "GET" && served) {
        const bytes = receipts.get(served[1]);
        if (!bytes) return send(res, 404, { error: "no_receipt_under_that_digest" });
        return send(res, 200, bytes);
      }

      return send(res, 404, { error: "not_found" });
    } catch (err) {
      return send(res, 400, { error: "bad_request", detail: err?.message ?? String(err) });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;

  return Object.freeze({
    origin,
    merchant: Object.freeze({ id: merchant.id, name: merchant.name ?? merchant.id }),
    approvals,
    receipts,
    requests,
    close: () =>
      new Promise((resolve) => {
        if (server[CLOSED]) return resolve();
        server[CLOSED] = true;
        server.close(resolve);
      }),
  });
}

/**
 * A mirror that answers every request with bytes the caller chose.
 *
 * It exists to make one claim testable: a locator proves where bytes came from,
 * never what they are. The mirror can sit on the exact well-known path the id
 * names, answer 200, and still be refused, because the id is a hash.
 */
export async function startHostileMirror({ bytes, label = "hostile-mirror", port = 0 }) {
  if (typeof bytes !== "string" || bytes.length === 0) throw new TypeError("hostile mirror needs bytes");
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, at: new Date().toISOString() });
    if (req.method !== "GET") return send(res, 405, { error: "read_only_mirror" });
    return send(res, 200, bytes, { "x-mirror": label });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return Object.freeze({
    origin,
    label,
    requests,
    close: () =>
      new Promise((resolve) => {
        if (server[CLOSED]) return resolve();
        server[CLOSED] = true;
        server.close(resolve);
      }),
  });
}
