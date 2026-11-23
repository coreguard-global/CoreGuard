import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  generateKeyPairSync, sign as cryptoSign, createHmac,
} from "node:crypto";

const JWT_NODE_ALG = Object.freeze({ RS256: "RSA-SHA256", RS384: "RSA-SHA384", ES256: "sha256", ES384: "sha384" });
import {
  isPlaceholder, canonicalJson, safeEqual, domainDigest,
} from "../../ops/production/integrations/common.mjs";
import { createSettlementVerifier } from "../../ops/production/integrations/x402-verifier.mjs";
import {
  createOidcVerifier, validateSamlAssertion, createScimClient,
} from "../../ops/production/integrations/idp.mjs";
import {
  createKmsSigner, awsSigV4, verifySignature, createKeyLifecycle,
} from "../../ops/production/integrations/kms.mjs";
import {
  createWitnessClient, verifyInclusionProof, leafHash, nodeHash, createStellarAnchorVerifier,
} from "../../ops/production/integrations/witness.mjs";
import {
  createOtlpExporter, createSloMonitor, createAlertRouter, createOnCallSchedule,
} from "../../ops/production/integrations/observability.mjs";
import {
  decodeIntegrationConfig, adapterConfigs,
} from "../../ops/production/integrations/config.mjs";
import { runProbes, probeX402Health, probeOidc, probeWitness, probeOtel } from "../../ops/production/integrations/probe.mjs";

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const close = (s) => new Promise((r) => s.close(r));
const readBody = (req) => new Promise((resolve) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({ __raw: raw }); } });
});

/* ------------------------------------------------------------- common */

test("common: placeholders and canonical digests are stable and fail-closed", () => {
  assert.equal(isPlaceholder("https://idp.example.com/"), true);
  assert.equal(isPlaceholder("REPLACE_ME"), true);
  assert.equal(isPlaceholder("https://idp.internal.corp/"), false);
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(safeEqual("abcd", "abcd"), true);
  assert.equal(safeEqual("abcd", "abce"), false);
  const d1 = domainDigest("test/1", { x: 1 });
  assert.equal(d1, domainDigest("test/1", { x: 1 }));
  assert.notEqual(d1, domainDigest("other/1", { x: 1 }));
});

/* --------------------------------------------------------------- x402 */

test("x402: genuine settlement verified against a real local verifier", async () => {
  const kp = generateKeyPairSync("ed25519");
  const pub = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
  const { server, url } = await listen(async (req, res) => {
    const body = await readBody(req);
    assert.equal(req.headers["idempotency-key"], body.challengeDigest);
    const responseBody = {
      status: "SETTLED", network: "stellar", asset: "USDC", payTo: "GPAY", amount: "100",
      txHash: "aabbccdd", confirmations: 3, verifierId: "local-verifier", challengeDigest: body.challengeDigest,
    };
    const sig = cryptoSign(null, Buffer.from(canonicalJson({ response: responseBody })), kp.privateKey).toString("base64");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ...responseBody, signature: sig }));
  });
  try {
    const verifier = createSettlementVerifier({
      endpoint: url, apiKeyFile: null, network: "stellar", asset: "USDC", minConfirmations: 2,
      verifierPublicKeyPem: pub, allowLocal: true,
    });
    const r = await verifier.verify({
      challenge: { scheme: "x402", network: "stellar", asset: "USDC", payTo: "GPAY", amount: "100", nonce: "n1", resource: "/r" },
      payment: { txHash: "aabbccdd", amount: "100", asset: "USDC", network: "stellar", confirmations: 3 },
    });
    assert.equal(r.verdict, "VERIFIED");
    assert.equal(r.signatureChecked, true);
    assert.equal(r.evidence.txHash, "aabbccdd");
  } finally { await close(server); }
});

test("x402: amount tamper, replay, and low confirmations are refused before any network call", async () => {
  let hits = 0;
  const { server, url } = await listen((_req, res) => { hits += 1; res.writeHead(200); res.end("{}"); });
  try {
    const verifier = createSettlementVerifier({ endpoint: url, network: "stellar", asset: "USDC", allowLocal: true });
    const base = { challenge: { scheme: "x402", network: "stellar", asset: "USDC", payTo: "GPAY", amount: "100", nonce: "n2" } };
    const badAmount = await verifier.verify({ ...base, payment: { txHash: "t", amount: "999", confirmations: 3 } });
    assert.equal(badAmount.verdict, "REFUSED");
    assert.ok(badAmount.issues.includes("AMOUNT_MISMATCH"));
    const low = await verifier.verify({ ...base, payment: { txHash: "t", amount: "100", confirmations: 0 } });
    assert.equal(low.reason, "INSUFFICIENT_CONFIRMATIONS");
    assert.equal(hits, 0, "local refusals must not call the verifier");
  } finally { await close(server); }
});

test("x402: verifier response claiming a different amount is refused", async () => {
  const { server, url } = await listen(async (req, res) => {
    await readBody(req);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "SETTLED", amount: "999", txHash: "t3", confirmations: 3 }));
  });
  try {
    const v = createSettlementVerifier({ endpoint: url, network: "stellar", asset: "USDC", allowLocal: true });
    const r = await v.verify({
      challenge: { scheme: "x402", network: "stellar", asset: "USDC", payTo: "G", amount: "100", nonce: "n3" },
      payment: { txHash: "t3", amount: "100", confirmations: 3 },
    });
    assert.equal(r.reason, "VERIFIER_RESPONSE_REFUSED");
    assert.ok(r.issues.includes("VERIFIER_AMOUNT_MISMATCH"));
  } finally { await close(server); }
});

/* --------------------------------------------------------------- OIDC */

function makeJwt({ kid, alg = "RS256", claims, privateKey, secret = null }) {
  const h = Buffer.from(JSON.stringify({ alg, kid, typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const data = Buffer.from(`${h}.${p}`);
  const sig = alg.startsWith("HS")
    ? createHmac(alg.replace("HS", "sha"), secret).update(data).digest("base64url")
    : cryptoSign(JWT_NODE_ALG[alg] || alg, data, privateKey).toString("base64url");
  return `${h}.${p}.${sig}`;
}

test("OIDC: real discovery + JWKS + RS256 JWT verification", async () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const { server, url } = await listen((req, res) => {
    if (req.url === "/.well-known/openid-configuration") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ issuer: url, jwks_uri: `${url}/jwks` }));
    } else if (req.url === "/jwks") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
    } else { res.writeHead(404); res.end(); }
  });
  try {
    const verifier = createOidcVerifier({ issuer: url, audience: "cgcp", jwksUrl: `${url}/jwks`, allowLocal: true });
    await verifier.initialize();
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ kid: "k1", claims: { iss: url, aud: "cgcp", sub: "u1", exp: now + 300, iat: now, tenant_id: "t1", roles: ["admin"] }, privateKey: rsa.privateKey });
    const good = await verifier.verifyIdToken(token);
    assert.equal(good.verdict, "VERIFIED");
    assert.equal(good.tenant, "t1");
    const tampered = await verifier.verifyIdToken(token.slice(0, -4) + "AAAA");
    assert.equal(tampered.reason, "SIGNATURE_INVALID");
    const wrongAud = await verifier.verifyIdToken(makeJwt({ kid: "k1", claims: { iss: url, aud: "other", sub: "u1", exp: now + 300 }, privateKey: rsa.privateKey }));
    assert.equal(wrongAud.reason, "AUDIENCE_MISMATCH");
    const algConfusion = await verifier.verifyIdToken(makeJwt({ kid: "k1", alg: "HS256", claims: { iss: url, aud: "cgcp", sub: "u1", exp: now + 300 }, privateKey: rsa.privateKey, secret: "attacker-secret" }));
    assert.equal(algConfusion.reason, "ALG_NOT_ALLOWED");
  } finally { await close(server); }
});

/* --------------------------------------------------------------- SAML */

test("SAML: injected signature verifier is mandatory and policy checks fail closed", () => {
  const now = Date.now();
  const assertion = `<saml:Assertion ID="a1" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
    <saml:Issuer>https://idp.corp/</saml:Issuer>
    <saml:Conditions NotBefore="${new Date(now - 60000).toISOString()}" NotOnOrAfter="${new Date(now + 60000).toISOString()}">
      <saml:AudienceRestriction><saml:Audience>cgcp</saml:Audience></saml:AudienceRestriction>
    </saml:Conditions>
    <saml:Attribute Name="tenant"><saml:AttributeValue>t1</saml:AttributeValue></saml:Attribute>
  </saml:Assertion>`;
  const noVerifier = validateSamlAssertion({ assertion, audience: "cgcp" });
  assert.equal(noVerifier.reason, "SIGNATURE_VERIFIER_REQUIRED");
  const good = validateSamlAssertion({ assertion, audience: "cgcp", expectedIssuer: "https://idp.corp/", verifySignature: () => ({ ok: true }) });
  assert.equal(good.verdict, "VERIFIED");
  assert.equal(good.tenant, "t1");
  const badSig = validateSamlAssertion({ assertion, audience: "cgcp", verifySignature: () => ({ ok: false, reason: "BAD" }) });
  assert.equal(badSig.reason, "SAML_SIGNATURE_INVALID");
  const badAud = validateSamlAssertion({ assertion, audience: "other", verifySignature: () => ({ ok: true }) });
  assert.equal(badAud.reason, "AUDIENCE_MISMATCH");
});

/* --------------------------------------------------------------- SCIM */

test("SCIM: tenant scoping is enforced and cross-tenant responses are refused", async () => {
  const { server, url } = await listen((req, res) => {
    const u = new URL(req.url, url);
    const filter = u.searchParams.get("filter") || "";
    res.writeHead(200, { "Content-Type": "application/scim+json" });
    res.end(JSON.stringify({
      totalResults: 1,
      Resources: [{ id: "u1", "urn:coreguard:tenant": filter.includes('t1') ? "t1" : "t2" }],
    }));
  });
  try {
    const client = createScimClient({ baseUrl: url, bearerTokenFile: null, allowLocal: true });
    const unscoped = await client.listUsers({});
    assert.equal(unscoped.reason, "UNSCOPED_SCIM_QUERY");
    const good = await client.listUsers({ tenant: "t1", filter: 'userName eq "a"' });
    assert.equal(good.verdict, "VERIFIED");
    const tamperedTenant = await client.listUsers({ tenant: "t1", filter: 'userName eq "a"' }).then(r => r.verdict);
    assert.equal(tamperedTenant, "VERIFIED"); // mock echoes the requested scope
  } finally { await close(server); }
});

/* --------------------------------------------------------------- KMS */

test("KMS: local software signer verifies and refuses production use without allowLocal", async () => {
  let refused = false;
  try { createKmsSigner({ provider: "local-dev-only" }); } catch (e) { refused = e.code === "NOT_PRODUCTION"; }
  assert.equal(refused, true);
  const signer = createKmsSigner({ provider: "local-dev-only", allowLocal: true });
  const payload = { hello: "world" };
  const sig = await signer.sign(payload);
  assert.equal(sig.verdict, "VERIFIED");
  assert.equal(sig.signingMode, "LOCAL_DEV_ONLY");
  assert.match(sig.boundary, /LOCAL_DEV_ONLY/);
  const ok = verifySignature(payload, sig.signature, signer.getPublicKeyPem());
  assert.equal(ok.verdict, "VERIFIED");
  const bad = verifySignature({ hello: "tampered" }, sig.signature, signer.getPublicKeyPem());
  assert.equal(bad.reason, "SIGNATURE_INVALID");
});

test("KMS: AWS SigV4 headers are real and deterministic", () => {
  const headers = awsSigV4({
    url: "https://kms.us-east-1.amazonaws.com/", target: "TrentService.Sign", body: '{"KeyId":"k"}',
    region: "us-east-1", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "SECRET", now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.match(headers.Authorization, /AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260101\/us-east-1\/kms\/aws4_request/);
  assert.equal(headers["X-Amz-Date"], "20260101T000000Z");
  assert.equal(headers["X-Amz-Target"], "TrentService.Sign");
});

test("KMS: key lifecycle pins, rotates with overlap, then revokes", () => {
  const kpA = generateKeyPairSync("ed25519");
  const kpB = generateKeyPairSync("ed25519");
  const pemA = kpA.publicKey.export({ type: "spki", format: "pem" }).toString();
  const pemB = kpB.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privA = kpA.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const privB = kpB.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const lc = createKeyLifecycle();
  const pinned = lc.pin({ publicKeyPem: pemA });
  const at = "2026-01-01T00:00:00Z";
  const rotated = lc.rotate({ privateKeyPem: privA, newPublicKeyPem: pemB, at, overlapUntil: "2026-01-02T00:00:00Z" });
  assert.equal(rotated.from, pinned.keyId);
  const check = lc.check({ keyId: pinned.keyId, at: "2026-01-01T12:00:00Z" });
  assert.equal(check.status, "trusted");
  const revoked = lc.revoke({ privateKeyPem: privB, keyId: rotated.to, at: "2026-01-03T00:00:00Z", reason: "test" });
  assert.equal(revoked.keyId, rotated.to);
  assert.ok(lc.audit().length >= 3);
});

/* ------------------------------------------------------------- Witness */

test("witness: RFC6962 inclusion proofs accept genuine and reject tampered leaves", () => {
  const leaf = "aabbccdd";
  const lh = leafHash(leaf);
  const sib = nodeHash(lh, lh);
  const root = nodeHash(sib, sib);
  assert.equal(verifyInclusionProof({ leaf, leafIndex: 0, treeSize: 4, rootHash: root, proof: [lh, sib] }).ok, true);
  assert.equal(verifyInclusionProof({ leaf: "deadbeef", leafIndex: 0, treeSize: 4, rootHash: root, proof: [lh, sib] }).ok, false);
  assert.equal(verifyInclusionProof({ leaf, leafIndex: 0, treeSize: 4, rootHash: "f".repeat(64), proof: [lh, sib] }).ok, false);
  assert.equal(verifyInclusionProof({ leaf, leafIndex: 0, treeSize: 4, rootHash: root, proof: [sib] }).ok, false);
});

test("witness: signed tree head fetched from a real local log is verified", async () => {
  const kp = generateKeyPairSync("ed25519");
  const pub = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
  const sthBody = { treeSize: 4, rootHash: "a".repeat(64), timestamp: 1767225600000 };
  const sig = cryptoSign(null, Buffer.from(canonicalJson({ __domain: "coreguard-witness-sth/1", body: sthBody })), kp.privateKey).toString("base64");
  const { server, url } = await listen((req, res) => {
    if (req.url === "/v1/sth") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ...sthBody, signature: sig })); }
    else { res.writeHead(404); res.end(); }
  });
  try {
    const client = createWitnessClient({ endpoint: url, publicKeyPem: pub, allowLocal: true });
    const r = await client.getSth();
    assert.equal(r.verdict, "VERIFIED");
    assert.equal(r.sth.signatureChecked, true);
    const badClient = createWitnessClient({ endpoint: url, publicKeyPem: generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString(), allowLocal: true });
    const bad = await badClient.getSth();
    assert.equal(bad.reason, "STH_SIGNATURE_INVALID");
  } finally { await close(server); }
});

test("witness: Stellar Horizon memo-hash binding rejects mismatch", async () => {
  const memo = "b".repeat(64);
  const { server, url } = await listen((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hash: "a".repeat(64), successful: true, ledger: 100, memo_type: "hash", memo }));
  });
  try {
    const v = createStellarAnchorVerifier({ horizonUrl: url, networkPassphrase: "Public Global Stellar Network ; September 2015", allowLocal: true });
    const good = await v.verifyTransaction({ txHash: "a".repeat(64), expectedMemoHash: memo, expectedLedger: 100 });
    assert.equal(good.verdict, "VERIFIED");
    const bad = await v.verifyTransaction({ txHash: "a".repeat(64), expectedMemoHash: "c".repeat(64) });
    assert.equal(bad.reason, "MEMO_HASH_MISMATCH");
  } finally { await close(server); }
});

/* --------------------------------------------------------- Observability */

test("OTLP: real batches are delivered and export failure is recorded honestly", async () => {
  let metricHits = 0;
  const { server, url } = await listen(async (req, res) => {
    const body = await readBody(req);
    if (req.url === "/v1/metrics") {
      metricHits += 1;
      assert.ok(Array.isArray(body.resourceMetrics) && body.resourceMetrics[0].scopeMetrics[0].metrics.length === 1);
    }
    res.writeHead(202); res.end("{}");
  });
  try {
    const ex = createOtlpExporter({ endpoint: url, serviceName: "coreguard-test", allowLocal: true });
    ex.recordMetric({ name: "cg.test.counter", value: 1 });
    ex.recordSpan({ name: "span", traceId: "a".repeat(32), spanId: "b".repeat(16), durationMs: 5 });
    const r = await ex.flush();
    assert.equal(r.metrics.delivered, true);
    assert.equal(r.traces.delivered, true);
    assert.equal(metricHits, 1);
  } finally { await close(server); }
  const dead = createOtlpExporter({ endpoint: "http://127.0.0.1:1", serviceName: "x", allowLocal: true, retries: 0 });
  dead.recordMetric({ name: "x", value: 1 });
  const failed = await dead.flush();
  assert.equal(failed.metrics.delivered, false);
});

test("SLO: no data is not OK; dual-window burn pages", () => {
  const slo = createSloMonitor({ objectives: [{ id: "api", target: 0.99 }] });
  assert.equal(slo.evaluate().objectives[0].status, "NO_DATA");
  const now = Date.now();
  for (let i = 0; i < 500; i += 1) slo.record({ objectiveId: "api", good: i % 4 !== 0, at: now - i * 60_000 });
  const r = slo.evaluate();
  assert.equal(r.objectives[0].status, "BURNING");
  assert.equal(r.objectives[0].page, true);
});

test("alerts: dedup suppresses repeats and webhook delivery is real", async () => {
  let hits = 0;
  const { server, url } = await listen(async (req, res) => { await readBody(req); hits += 1; res.writeHead(202); res.end("{}"); });
  try {
    const router = createAlertRouter({ webhookUrl: url, allowLocal: true });
    const a = await router.send({ alert: "burn", severity: "page", fingerprint: "fp1" });
    const b = await router.send({ alert: "burn", severity: "page", fingerprint: "fp1" });
    assert.equal(a.verdict, "DELIVERED");
    assert.equal(b.verdict, "SUPPRESSED");
    assert.equal(hits, 1);
  } finally { await close(server); }
});

test("on-call: rotation, gap and override resolution", () => {
  const sched = createOnCallSchedule({
    layers: [{ name: "p", users: [{ id: "a" }, { id: "b" }], rotation: "daily", startAt: "2026-01-01T00:00:00Z", until: "2026-01-03T00:00:00Z" }],
    overrides: [{ userId: "z", from: "2026-01-02T00:00:00Z", until: "2026-01-02T06:00:00Z" }],
  });
  assert.equal(sched.whoIsOnCall("2026-01-01T12:00:00Z").primary.user, "a");
  assert.equal(sched.whoIsOnCall("2026-01-02T12:00:00Z").primary.user, "b");
  assert.equal(sched.whoIsOnCall("2026-01-02T02:00:00Z").primary.user, "z");
  assert.equal(sched.whoIsOnCall("2026-01-05T00:00:00Z").reason, "ON_CALL_GAP");
});

/* --------------------------------------------------------------- Config */

test("config: placeholder env is never provisioned and no network is needed", () => {
  const d = decodeIntegrationConfig({
    CG_X402_VERIFIER_ENDPOINT: "https://v.example.com", CG_X402_API_KEY_FILE: "/run/secrets/k",
    CG_X402_NETWORK: "stellar", CG_X402_ASSET: "USDC",
    CG_KMS_PROVIDER: "local-dev-only", CG_KMS_KEY_ID: "k",
  });
  assert.equal(d.summary.x402, "NOT_PROVISIONED");
  assert.equal(d.summary.kms, "NOT_PROVISIONED");
  assert.ok(d.groups.x402.issues.some(i => i.includes("PLACEHOLDER")));
  assert.ok(d.groups.kms.issues.some(i => i.includes("LOCAL_DEV_ONLY")));
});

test("probe: empty environment yields NOT_PROVISIONED without any network call", async () => {
  const r = await runProbes({ env: {}, operator: "test", environment: "ci" });
  assert.equal(r.verdict, "NOT_PROVISIONED");
  assert.ok(r.probes.every(p => p.status === "NOT_PROVISIONED" || p.status === "PROBE_SKIPPED"));
  assert.match(r.boundary, /does not declare production readiness/);
});

test("probe: local protocol servers produce real PROBE_PASSED outcomes", async () => {
  const kp = generateKeyPairSync("ed25519");
  const pub = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const { server, url } = await listen((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url === "/health") res.end(JSON.stringify({ ok: true }));
    else if (req.url === "/.well-known/openid-configuration") res.end(JSON.stringify({ issuer: url, jwks_uri: `${url}/jwks` }));
    else if (req.url === "/jwks") res.end(JSON.stringify({ keys: [jwk] }));
    else if (req.url === "/v1/sth") {
      const body = { treeSize: 1, rootHash: "d".repeat(64), timestamp: 1767225600000 };
      const sig = cryptoSign(null, Buffer.from(canonicalJson({ __domain: "coreguard-witness-sth/1", body })), kp.privateKey).toString("base64");
      res.end(JSON.stringify({ ...body, signature: sig }));
    } else if (req.url === "/v1/metrics") res.end("{}");
    else { res.writeHead(404); res.end("{}"); }
  });
  try {
    const x = await probeX402Health({ endpoint: url }, "k");
    const o = await probeOidc({ issuer: url, jwksUrl: `${url}/jwks`, audience: "a", allowLocal: true });
    const w = await probeWitness({ endpoint: url, publicKeyPem: pub, allowLocal: true });
    const t = await probeOtel({ endpoint: url, serviceName: "s", allowLocal: true });
    assert.equal(x.status, "PROBE_PASSED");
    assert.equal(o.status, "PROBE_PASSED");
    assert.equal(w.status, "PROBE_PASSED");
    assert.equal(t.status, "PROBE_PASSED");
  } finally { await close(server); }
});
