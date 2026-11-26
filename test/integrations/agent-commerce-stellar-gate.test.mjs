import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalStellarIntent,
  preflightStellarAgentPayment,
  bindStellarAuthorization,
  verifyStellarSubmissionEvidence,
  exportStellarEvidencePack,
  stellarAdversarialVectors,
  STELLAR_GATE_BOUNDARY,
  STELLAR_GATE_VERSION,
} from "../../packages/agent-commerce/stellar-gate.mjs";

const SOURCE = "G" + "A".repeat(55);
const DEST = "G" + "B".repeat(55);
const OTHER = "G" + "C".repeat(55);
const ISSUER = "G" + "D".repeat(55);
const ENVELOPE = "AAAAAgAAA" + "Q".repeat(120);
const NOW = "1794657600";
const MAX = String(BigInt(NOW) + 3600n);

const projection = (over = {}) => ({
  network: "testnet",
  sourceAccount: SOURCE,
  destination: DEST,
  asset: "native",
  amount: "5",
  memo: "cg-sg-ref",
  sequence: "1",
  ...over,
});
const proposal = (over = {}) => ({
  ...projection(),
  envelopeXdr: ENVELOPE,
  envelopeProjection: projection(),
  nonce: "nonce-1",
  scopes: ["pay"],
  agentScopes: ["pay", "read"],
  timeBounds: { minTime: NOW, maxTime: MAX },
  ...over,
});
const policy = (over = {}) => ({
  allowedNetworks: ["testnet"],
  allowedAssets: ["native"],
  allowedDestinations: [DEST],
  maxAmount: "100",
  requireMemo: true,
  requireNonce: true,
  requireTimeBounds: true,
  requiredScopes: ["pay"],
  usedNonces: [],
  ...over,
});
const authorize = (p = proposal(), pol = policy(), now = NOW) => preflightStellarAgentPayment({ proposal: p, policy: pol, nowSeconds: now });
const bind = (a = authorize(), envelope = ENVELOPE, observed = projection()) => bindStellarAuthorization({ authorization: a, envelopeXdr: envelope, observed });
const evidence = (over = {}) => ({
  network: "testnet",
  envelopeXdr: ENVELOPE,
  txHash: "ab".repeat(32),
  successful: true,
  ledger: 123456,
  resultXdr: "AAAAAAAAAAAAAA==",
  operation: projection(),
  ...over,
});

test("boundary and version travel with every result", () => {
  assert.equal(STELLAR_GATE_VERSION, "CG-SG/1");
  assert.match(STELLAR_GATE_BOUNDARY, /VERIFIED ≠ SAFE/);
  assert.match(STELLAR_GATE_BOUNDARY, /no Stellar RPC/);
  assert.match(STELLAR_GATE_BOUNDARY, /never signs or submits/);
  const out = authorize();
  assert.equal(out.boundary, STELLAR_GATE_BOUNDARY);
  assert.equal(out.spec, STELLAR_GATE_VERSION);
});

test("canonical intent is deterministic and digest-bound", () => {
  const a = canonicalStellarIntent(proposal());
  const b = canonicalStellarIntent(proposal());
  assert.equal(a.status, "OK");
  assert.equal(a.digest, b.digest);
  assert.match(a.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.canonical.destination, DEST);
  assert.equal(a.envelopeDigest, b.envelopeDigest);
});

test("canonical intent fails closed on missing required fields", () => {
  const p = proposal();
  delete p.envelopeProjection;
  const out = canonicalStellarIntent(p);
  assert.equal(out.status, "REFUSED");
  assert.equal(out.refusal.code, "INVALID_PROPOSAL");
  assert.ok(out.summary.breaks.some((b) => b.id === "required:envelopeProjection"));
});

test("canonical intent rejects a non-allowlisted network", () => {
  const out = canonicalStellarIntent(proposal({ network: "mainnet" }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "network:allowlist"));
});

test("canonical intent rejects a malformed asset", () => {
  const out = canonicalStellarIntent(proposal({ asset: "USDC:not-an-issuer" }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "asset:shape"));
});

test("canonical intent accepts CODE:ISSUER assets", () => {
  const out = canonicalStellarIntent(proposal({ asset: `USDC:${ISSUER}` }));
  assert.equal(out.status, "OK");
  assert.equal(out.canonical.asset, `USDC:${ISSUER}`);
});

test("canonical intent rejects zero, negative-shape and over-precision amounts", () => {
  for (const amount of ["0", "0.00000000", "5.12345678", "abc"]) {
    assert.equal(canonicalStellarIntent(proposal({ amount })).status, "REFUSED", amount);
  }
});

test("canonical intent rejects an overlong memo", () => {
  assert.equal(canonicalStellarIntent(proposal({ memo: "m".repeat(29) })).status, "REFUSED");
});

test("canonical intent rejects a malformed declared envelope digest", () => {
  const out = canonicalStellarIntent(proposal({ envelopeDigest: "not-a-digest" }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "envelopeDigest:shape"));
});

test("preflight returns ALLOW for a complete coherent packet", () => {
  const out = authorize();
  assert.equal(out.status, "OK");
  assert.equal(out.verdict, "ALLOW");
  assert.equal(out.summary.failed, 0);
  assert.match(out.boundDigest, /^sha256:[0-9a-f]{64}$/);
});

test("preflight fails closed when policy is absent", () => {
  const out = preflightStellarAgentPayment({ proposal: proposal() });
  assert.equal(out.refusal.code, "MISSING_ARGUMENT");
});

test("preflight refuses amount escalation above policy.maxAmount", () => {
  const out = authorize(proposal({ amount: "101", envelopeProjection: projection({ amount: "101" }) }));
  assert.equal(out.status, "REFUSED");
  assert.equal(out.refusal.code, "POLICY_REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "policy:maxAmount"));
});

test("preflight refuses a destination outside the allowlist", () => {
  const out = authorize(proposal({ destination: OTHER, envelopeProjection: projection({ destination: OTHER }) }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "policy:destinations"));
});

test("preflight refuses an asset outside the allowlist", () => {
  const out = authorize(proposal({ asset: `USDC:${ISSUER}`, envelopeProjection: projection({ asset: `USDC:${ISSUER}` }) }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "policy:assets"));
});

test("preflight refuses a network outside the allowlist", () => {
  const out = authorize(proposal({ network: "pubnet", envelopeProjection: projection({ network: "pubnet" }) }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "policy:networks"));
});

test("preflight refuses a missing memo when policy requires one", () => {
  const out = authorize(proposal({ memo: "", envelopeProjection: projection({ memo: "" }) }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "policy:memo"));
});

test("preflight refuses a replayed nonce", () => {
  const out = authorize(proposal(), policy({ usedNonces: ["nonce-1"] }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "replay:nonce"));
});

test("preflight refuses request scopes outside agent authority", () => {
  const out = authorize(proposal({ scopes: ["pay", "trade"] }));
  assert.equal(out.status, "REFUSED");
  const break_ = out.summary.breaks.find((b) => b.id === "authority:overreach");
  assert.ok(break_);
  assert.deepEqual(break_.evidence.overreach, ["trade"]);
});

test("preflight refuses when the agent lacks a required scope", () => {
  const out = authorize(proposal({ agentScopes: ["read"] }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "authority:requiredScopes"));
});

test("preflight refuses a pinned time outside timeBounds", () => {
  const out = authorize(proposal(), policy(), String(BigInt(MAX) + 1n));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "time:pinned"));
});

test("preflight refuses when timeBounds are required but absent", () => {
  const p = proposal();
  delete p.timeBounds;
  const out = authorize(p);
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "time:bounds"));
});

test("preflight names envelope projection drift", () => {
  const p = proposal({ envelopeProjection: projection({ destination: OTHER }) });
  const out = authorize(p);
  assert.equal(out.status, "REFUSED");
  const drift = out.summary.breaks.find((b) => b.id === "envelope:projection");
  assert.equal(drift.evidence.drift[0].field, "destination");
  assert.equal(drift.evidence.drift[0].approved, DEST);
  assert.equal(drift.evidence.drift[0].observed, OTHER);
});

test("preflight refuses a declared envelopeDigest that does not match the bytes", () => {
  const out = authorize(proposal({ envelopeDigest: "sha256:" + "11".repeat(32) }));
  assert.equal(out.status, "REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "envelope:digest"));
});

test("binding succeeds for exact bytes and observed projection", () => {
  const out = bind();
  assert.equal(out.status, "OK");
  assert.equal(out.statusValue, "BOUND");
  assert.equal(out.summary.failed, 0);
  assert.equal(out.envelopeDigest, authorize().envelopeDigest);
});

test("binding refuses a single-character envelope byte change", () => {
  const out = bind(authorize(), ENVELOPE + "A");
  assert.equal(out.refusal.code, "BINDING_REFUSED");
  assert.ok(out.summary.breaks.some((b) => b.id === "binding:bytes"));
});

test("binding refuses observed amount drift", () => {
  const out = bind(authorize(), ENVELOPE, projection({ amount: "6" }));
  assert.equal(out.refusal.code, "BINDING_REFUSED");
  assert.equal(out.summary.breaks.find((b) => b.id === "binding:projection").evidence.drift[0].field, "amount");
});

test("binding refuses an authorization that is not ALLOW", () => {
  const out = bind(authorize(proposal({ amount: "999" })));
  assert.equal(out.refusal.code, "NOT_AUTHORIZED");
});

test("submission verification returns VERIFIED for coherent evidence", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence() });
  assert.equal(out.status, "OK");
  assert.equal(out.verdict, "VERIFIED");
  assert.equal(out.summary.failed, 0);
  assert.match(out.evidenceDigest, /^sha256:/);
});

test("submission verification is UNKNOWN without a BOUND binding", () => {
  const out = verifyStellarSubmissionEvidence({ binding: { status: "REFUSED" }, evidence: evidence() });
  assert.equal(out.status, "UNKNOWN");
});

test("submission verification is UNKNOWN without evidence", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind() });
  assert.equal(out.status, "UNKNOWN");
});

test("submission verification rejects a malformed txHash", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence({ txHash: "not-a-hash" }) });
  assert.equal(out.status, "INVALID");
  assert.ok(out.summary.breaks.some((b) => b.id === "submission:txHash"));
});

test("submission verification rejects a failed result", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence({ successful: false }) });
  assert.equal(out.status, "INVALID");
  assert.ok(out.summary.breaks.some((b) => b.id === "submission:success"));
});

test("submission verification rejects a missing ledger", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence({ ledger: 0 }) });
  assert.equal(out.status, "INVALID");
  assert.ok(out.summary.breaks.some((b) => b.id === "submission:ledger"));
});

test("submission verification rejects operation destination drift", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence({ operation: projection({ destination: OTHER }) }) });
  assert.equal(out.status, "INVALID");
  assert.equal(out.summary.breaks.find((b) => b.id === "submission:operation").evidence.drift[0].field, "destination");
});

test("submission verification rejects submitted envelope byte drift", () => {
  const out = verifyStellarSubmissionEvidence({ binding: bind(), evidence: evidence({ envelopeXdr: ENVELOPE + "A" }) });
  assert.equal(out.status, "INVALID");
  assert.ok(out.summary.breaks.some((b) => b.id === "submission:bytes"));
});

test("evidence pack redacts nested secrets and is deterministic", () => {
  const items = [{ id: "a", body: { amount: "5", secretKey: "S..." , nested: { privateKey: "P..." } } }];
  const a = exportStellarEvidencePack({ items });
  const b = exportStellarEvidencePack({ items });
  assert.equal(a.status, "OK");
  assert.equal(a.root, b.root);
  assert.equal(a.items[0].body.secretKey, "[REDACTED]");
  assert.equal(a.items[0].body.nested.privateKey, "[REDACTED]");
  assert.equal(a.items[0].body.amount, "5");
});

test("evidence pack fails closed on empty items", () => {
  assert.equal(exportStellarEvidencePack({ items: [] }).refusal.code, "MISSING_ARGUMENT");
});

test("adversarial vectors are named, deterministic and cover all axes", () => {
  const a = stellarAdversarialVectors({ family: "stellar-agent-gate" });
  const b = stellarAdversarialVectors({ family: "stellar-agent-gate" });
  assert.equal(a.status, "OK");
  assert.equal(a.count, 16);
  assert.equal(a.root ?? a.vectors.length, 16);
  assert.deepEqual(a.vectors, b.vectors);
  const ids = new Set(a.vectors.map((v) => v.id));
  for (const id of ["AMOUNT_ESCALATION", "DESTINATION_SUBSTITUTION", "REPLAY_NONCE", "SCOPE_OVERREACH", "ENVELOPE_BYTE_DRIFT", "FAILED_RESULT", "MISSING_EVIDENCE"]) {
    assert.ok(ids.has(id), id);
  }
});

test("adversarial vectors reject an unknown family", () => {
  assert.equal(stellarAdversarialVectors({ family: "nope" }).refusal.code, "INVALID_ARGUMENT");
});
