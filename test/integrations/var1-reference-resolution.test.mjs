/**
 * CG-REF/1 — resolution, not naming.
 *
 * The load-bearing test is the one that asserts a name ALONE resolves nothing:
 * an opaque receipt id with no registry, no expectation and no locator must come
 * back `unresolvable`, never `resolved`. Everything else here is a source that
 * can produce bytes, and the rule that bytes which do not hash to what the name
 * claimed are `tampered` rather than retried against a laxer source.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {
  REFERENCE_VERSION,
  classifyReceiptId,
  digestOf,
  planResolution,
  resolveReceipt,
  resolutionOutcome,
  selfCheck,
} from "../../packages/agent-commerce/reference.mjs";

const sha = (s) => "sha256:" + createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const body = JSON.stringify({ receipt: "VAR/1", total: "12.00", currency: "USD" });
const digest = sha(body);

test("selfCheck passes", () => {
  const r = selfCheck();
  assert.equal(r.ok, true, r.checks.filter((c) => !c.pass).map((c) => c.name).join(", "));
});

test("the version is pinned", () => {
  assert.equal(REFERENCE_VERSION, "CG-REF/1");
});

test("an opaque id with no expectation is unresolvable, never resolved", async () => {
  const r = await resolveReceipt({ reference: { receiptId: "receipt-42", profile: "VAR/1" } });
  assert.equal(r.state, "unresolvable");
  assert.equal(r.reason, "no_expectation_and_no_locator");
  assert.equal(r.bytes, null);
  assert.equal(resolutionOutcome(r).outcome, "UNRESOLVABLE_RECORD");
});

test("content-addressed id: inline bytes are resolved by hashing, not by trusting the id", async () => {
  const id = "urn:sha256:" + digest.slice(7);
  const ok = await resolveReceipt({ reference: { receiptId: id }, inline: { bytes: body } });
  assert.equal(ok.state, "resolved");
  assert.equal(ok.digest, digest);
  assert.equal(ok.source, "inline");

  const bad = await resolveReceipt({ reference: { receiptId: id }, inline: { bytes: body + " " } });
  assert.equal(bad.state, "tampered");
  assert.equal(resolutionOutcome(bad).outcome, "VERIFICATION_FAILED");
});

test("a registry that disagrees with the id is tampered before any bytes are judged", async () => {
  const id = "urn:sha256:" + digest.slice(7);
  const r = await resolveReceipt({
    reference: { receiptId: id },
    registry: () => ({ bytes: body, digest: sha("something else") }),
  });
  assert.equal(r.state, "tampered");
  assert.equal(r.reason, "registry_disagrees_with_expectation");
});

test("registry bytes that match their published digest resolve", async () => {
  const r = await resolveReceipt({
    reference: { receiptId: "opaque-7" },
    registry: new Map([["opaque-7", { bytes: body, digest }]]),
  });
  assert.equal(r.state, "resolved");
  assert.equal(r.source, "registry");
});

test("a real HTTP locator resolves only because the bytes hash to the expectation", async () => {
  const payload = body;
  const server = createServer((req, res) => {
    if (req.url === "/good") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(payload);
    } else if (req.url === "/evil") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ receipt: "VAR/1", total: "999.00", currency: "USD" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const fetchImpl = async (url, { signal, maxBytes }) => {
    const res = await fetch(url, { signal });
    const text = await res.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error("response exceeds the cap");
    return { url, status: res.status, bytes: text };
  };
  try {
    const good = await resolveReceipt({
      reference: { receiptId: `http://127.0.0.1:${port}/good` },
      expectedDigest: digest,
      fetchImpl,
      allowInsecureLoopback: true,
    });
    assert.equal(good.state, "resolved");
    assert.equal(good.source, "locator");

    const evil = await resolveReceipt({
      reference: { receiptId: `http://127.0.0.1:${port}/evil` },
      expectedDigest: digest,
      fetchImpl,
      allowInsecureLoopback: true,
    });
    assert.equal(evil.state, "tampered");

    const missing = await resolveReceipt({
      reference: { receiptId: `http://127.0.0.1:${port}/nothing` },
      expectedDigest: digest,
      fetchImpl,
      allowInsecureLoopback: true,
    });
    assert.equal(missing.state, "unresolvable");
    assert.equal(missing.reason, "no_source_answered");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("plain http off loopback is refused by policy, and that refusal is not a claim about the record", async () => {
  const r = await resolveReceipt({
    reference: { receiptId: "http://example.com/receipt.json" },
    expectedDigest: digest,
    fetchImpl: async () => {
      throw new Error("must never be called");
    },
  });
  assert.equal(r.state, "unresolvable");
  assert.ok(r.tried.some((t) => t.reason === "url refused by policy"));
});

test("well-known derivation gives the same bytes a name for a mirror", () => {
  const id = "urn:sha256:" + digest.slice(7);
  const plan = planResolution({ receiptId: id, issuerOrigin: "https://issuer.example" });
  assert.equal(plan.idForm, "urn-sha256");
  assert.equal(plan.contentAddressed, true);
  const locator = plan.steps.find((s) => s.tier === "locator");
  assert.equal(locator.candidates[0], `https://issuer.example/.well-known/var1/receipts/${digest.slice(7)}`);
});

test("classification refuses a non-string id instead of coercing it", () => {
  assert.throws(() => classifyReceiptId(42), TypeError);
  assert.equal(classifyReceiptId("urn:sha256:" + "a".repeat(64)).contentAddressed, true);
  assert.equal(digestOf("x"), digestOf(Buffer.from("x")));
});
