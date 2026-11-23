/**
 * Identity adapter (CG-IDP/1)
 *
 * Real OIDC discovery + JWKS + JWT signature/claim verification, SAML assertion
 * policy validation (with a mandatory injected XML-DSig verifier), and SCIM 2.0
 * lifecycle client with forced tenant scoping.
 *
 * SECURITY NOTE: the SAML structural reader is deliberately narrow and is NOT a
 * general XML parser. An injected verifier (xml-crypto / node-saml / gateway)
 * MUST validate the enveloped XML signature before this module accepts claims.
 */

import { readFileSync } from "node:fs";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import {
  INTEGRATIONS_BOUNDARY, requireProvisioned, requestJson, verdict, nowIso, isPlaceholder,
} from "./common.mjs";

export const IDP_VERSION = "CG-IDP/1";
const DEFAULT_ALGS = Object.freeze(["RS256", "RS384", "ES256", "ES384"]);
/** JWT alg -> node:crypto digest/sign algorithm name. */
const NODE_ALG = Object.freeze({ RS256: "RSA-SHA256", RS384: "RSA-SHA384", ES256: "sha256", ES384: "sha384", PS256: "RSA-SHA256" });

const decode = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

function requireProvisionedUrl(value, key, allowLocal) {
  requireProvisioned({ [key]: value }, [key], { allowLocal });
  if (!allowLocal && !String(value).startsWith("https://")) {
    throw Object.assign(new Error(`CG-IDP/1: ${key} must be HTTPS`), { code: "INSECURE_ENDPOINT" });
  }
  return String(value).replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ OIDC */

export function createOidcVerifier(config = {}) {
  const allowLocal = !!config.allowLocal;
  const issuer = requireProvisionedUrl(config.issuer, "issuer", allowLocal);
  const audience = (() => {
    requireProvisioned({ audience: config.audience }, ["audience"], { allowLocal });
    return String(config.audience);
  })();
  const jwksUrlInput = config.jwksUrl ? requireProvisionedUrl(config.jwksUrl, "jwksUrl", allowLocal) : null;
  const algs = Array.isArray(config.allowedAlgs) && config.allowedAlgs.length ? config.allowedAlgs : DEFAULT_ALGS;
  const clockToleranceSec = config.clockToleranceSec === undefined ? 30 : Number(config.clockToleranceSec);
  const tenantClaim = config.tenantClaim || "tenant_id";
  const rolesClaim = config.rolesClaim || "roles";
  const cache = new Map();
  let discoveryDoc = null;
  let initialized = false;

  async function loadJwks(force = false) {
    if (!force && cache.size > 0) return cache;
    const url = jwksUrlInput || discoveryDoc?.jwks_uri;
    if (!url) throw new Error("CG-IDP/1: JWKS URL unknown (call initialize() first)");
    const res = await requestJson(url, {
      timeoutMs: config.timeoutMs ?? 8000,
      retries: 1,
      label: "oidc-jwks",
      expectStatus: [200],
    });
    if (!Array.isArray(res.body?.keys)) throw new Error("CG-IDP/1: JWKS has no keys array");
    cache.clear();
    for (const jwk of res.body.keys) if (jwk?.kid) cache.set(jwk.kid, jwk);
    return cache;
  }

  async function initialize() {
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    const res = await requestJson(discoveryUrl, {
      timeoutMs: config.timeoutMs ?? 8000,
      retries: 1,
      label: "oidc-discovery",
      expectStatus: [200],
    });
    const doc = res.body;
    if (!doc || typeof doc !== "object") throw new Error("CG-IDP/1: invalid discovery document");
    if (doc.issuer !== issuer) throw new Error(`CG-IDP/1: discovery issuer mismatch (${doc.issuer})`);
    if (jwksUrlInput && doc.jwks_uri && doc.jwks_uri.replace(/\/+$/, "") !== jwksUrlInput) {
      throw new Error("CG-IDP/1: configured jwksUrl disagrees with discovery jwks_uri");
    }
    discoveryDoc = doc;
    await loadJwks(true);
    initialized = true;
    return { issuer, jwksUri: doc.jwks_uri || jwksUrlInput, algorithms: algs };
  }

  async function verifyIdToken(token, options = {}) {
    if (!initialized) {
      try { await initialize(); } catch (err) {
        return verdict("IDP_UNAVAILABLE", { reason: "IDP_UNAVAILABLE", message: err.message });
      }
    }
    if (typeof token !== "string" || token.split(".").length !== 3) {
      return verdict("INVALID_TOKEN", { reason: "INVALID_TOKEN" });
    }
    const [h, p, s] = token.split(".");
    let header, claims;
    try { header = decode(h); claims = decode(p); } catch { return verdict("INVALID_TOKEN", { reason: "INVALID_TOKEN" }); }
    if (!algs.includes(header.alg)) return verdict("ALG_NOT_ALLOWED", { reason: "ALG_NOT_ALLOWED", alg: header.alg });
    if (!header.kid) return verdict("MISSING_KID", { reason: "MISSING_KID" });

    let jwk = cache.get(header.kid);
    if (!jwk) {
      try { await loadJwks(true); jwk = cache.get(header.kid); } catch { /* handled below */ }
    }
    if (!jwk) return verdict("UNKNOWN_SIGNING_KEY", { reason: "UNKNOWN_SIGNING_KEY", kid: header.kid });
    if (jwk.alg && jwk.alg !== header.alg) return verdict("JWK_ALG_MISMATCH", { reason: "JWK_ALG_MISMATCH" });
    if (jwk.use && jwk.use !== "sig") return verdict("JWK_NOT_FOR_SIGNING", { reason: "JWK_NOT_FOR_SIGNING" });

    let signatureOk = false;
    try {
      const key = createPublicKey({ key: jwk, format: "jwk" });
      signatureOk = cryptoVerify(NODE_ALG[header.alg] || header.alg, Buffer.from(`${h}.${p}`, "utf8"), key, Buffer.from(s, "base64url"));
    } catch { signatureOk = false; }
    if (!signatureOk) return verdict("SIGNATURE_INVALID", { reason: "SIGNATURE_INVALID" });

    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== issuer) return verdict("ISSUER_MISMATCH", { reason: "ISSUER_MISMATCH" });
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(audience)) return verdict("AUDIENCE_MISMATCH", { reason: "AUDIENCE_MISMATCH" });
    if (typeof claims.exp !== "number" || claims.exp <= now - clockToleranceSec) return verdict("TOKEN_EXPIRED", { reason: "TOKEN_EXPIRED" });
    if (claims.nbf !== undefined && claims.nbf > now + clockToleranceSec) return verdict("TOKEN_NOT_YET_VALID", { reason: "TOKEN_NOT_YET_VALID" });
    if (claims.iat !== undefined && claims.iat > now + clockToleranceSec) return verdict("TOKEN_IAT_IN_FUTURE", { reason: "TOKEN_IAT_IN_FUTURE" });
    if (typeof claims.sub !== "string" || !claims.sub) return verdict("MISSING_SUBJECT", { reason: "MISSING_SUBJECT" });
    if (options.nonce && claims.nonce !== options.nonce) return verdict("NONCE_MISMATCH", { reason: "NONCE_MISMATCH" });
    if (config.maxTokenAgeSec && (typeof claims.auth_time !== "number" || claims.auth_time < now - Number(config.maxTokenAgeSec))) {
      return verdict("STALE_AUTHENTICATION", { reason: "STALE_AUTHENTICATION" });
    }
    const tenant = claims[tenantClaim] ?? null;
    if (config.requireTenant && (typeof tenant !== "string" || !tenant)) return verdict("MISSING_TENANT", { reason: "MISSING_TENANT" });
    const roles = Array.isArray(claims[rolesClaim]) ? claims[rolesClaim] : (claims[rolesClaim] ? [claims[rolesClaim]] : []);

    return {
      spec: IDP_VERSION,
      verdict: "VERIFIED",
      reason: "OK",
      boundary: INTEGRATIONS_BOUNDARY,
      at: nowIso(),
      subject: claims.sub,
      tenant,
      roles,
      claims,
      signingKid: header.kid,
      algorithm: header.alg,
    };
  }

  return Object.freeze({ spec: IDP_VERSION, initialize, verifyIdToken, loadJwks });
}

/* ------------------------------------------------------------------ SAML */

/** Narrow attribute/tag reader; signature MUST be verified by injected callback. */
function readTags(xml) {
  if (typeof xml !== "string" || xml.length > 2_000_000) throw new Error("invalid assertion size/type");
  const tags = [];
  const re = /<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\/([\w:.-]+)\s*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const opening = m[1];
    if (opening) {
      const attrs = {};
      const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ar.exec(m[2])) !== null) attrs[a[1]] = a[2] ?? a[3] ?? "";
      tags.push({ name: opening.split(":").pop(), rawName: opening, attrs, closing: false, selfClosing: !!m[3], index: m.index });
    } else {
      tags.push({ name: m[4].split(":").pop(), rawName: m[4], attrs: {}, closing: true, selfClosing: false, index: m.index });
    }
  }
  return tags;
}

function attr(tags, tagName, attrName) {
  const t = tags.find(x => x.name === tagName && !x.closing && x.attrs[attrName] !== undefined);
  return t ? t.attrs[attrName] : null;
}

/** Text content of leaf elements (Issuer, Audience, AttributeValue). */
function textValues(xml, tagName) {
  const out = [];
  const re = new RegExp(`<([\\w:.-]*:)?${tagName}(?:\\s[^>]*)?>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) {
    const start = m.index + m[0].length;
    if (m[0].endsWith("/>")) { out.push(""); continue; }
    const prefix = m[1] || "";
    const end = xml.indexOf(`</${prefix}${tagName}`, start);
    const raw = xml.slice(start, end >= 0 ? end : start);
    if (!/<[^>]+>/.test(raw)) out.push(raw.trim());
  }
  return out.filter(s => s !== "");
}

/** Attribute/AttributeValue pairs keyed by Name. */
function attributeMap(xml) {
  const out = new Map();
  const re = /<([\w:.-]*:)?Attribute\s+([^>]*)>([\s\S]*?)<\/\1Attribute\s*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const nameMatch = m[2].match(/Name\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    if (!nameMatch) continue;
    const vals = textValues(m[3], "AttributeValue");
    out.set(nameMatch[1] ?? nameMatch[2], vals);
  }
  return out;
}

export function validateSamlAssertion(input = {}) {
  const { assertion, expectedIssuer, audience, verifySignature, clockToleranceSec = 30, tenantAttribute = "tenant", roleAttribute = "role" } = input;
  if (typeof verifySignature !== "function") {
    return verdict("SIGNATURE_VERIFIER_REQUIRED", { reason: "SIGNATURE_VERIFIER_REQUIRED", note: "Inject a real XML-DSig verifier (xml-crypto/node-saml/gateway)." });
  }
  let sig;
  try { sig = verifySignature(assertion); } catch (err) { sig = { ok: false, reason: err.message }; }
  if (!sig?.ok) return verdict("SAML_SIGNATURE_INVALID", { reason: "SAML_SIGNATURE_INVALID", detail: sig?.reason ?? null });

  let tags;
  try { tags = readTags(assertion); } catch (err) { return verdict("ASSERTION_PARSE_FAILED", { reason: "ASSERTION_PARSE_FAILED", message: err.message }); }
  if (!tags.some(t => t.name === "Assertion" && !t.closing)) return verdict("NOT_AN_ASSERTION", { reason: "NOT_AN_ASSERTION" });

  const id = attr(tags, "Assertion", "ID");
  if (!id) return verdict("MISSING_ASSERTION_ID", { reason: "MISSING_ASSERTION_ID" });
  const issuer = textValues(assertion, "Issuer")[0] ?? null;
  if (!issuer) return verdict("MISSING_ISSUER", { reason: "MISSING_ISSUER" });
  if (expectedIssuer && issuer !== expectedIssuer) return verdict("ISSUER_MISMATCH", { reason: "ISSUER_MISMATCH" });

  const now = Date.now();
  const tol = Number(clockToleranceSec) * 1000;
  const conditions = tags.find(t => t.name === "Conditions" && !t.closing);
  if (!conditions) return verdict("MISSING_CONDITIONS", { reason: "MISSING_CONDITIONS" });
  const nb = conditions.attrs.NotBefore ? Date.parse(conditions.attrs.NotBefore) : NaN;
  const na = conditions.attrs.NotOnOrAfter ? Date.parse(conditions.attrs.NotOnOrAfter) : NaN;
  if (!Number.isFinite(nb) || !Number.isFinite(na) || na <= nb) return verdict("INVALID_CONDITION_WINDOW", { reason: "INVALID_CONDITION_WINDOW" });
  if (now + tol < nb) return verdict("ASSERTION_NOT_YET_VALID", { reason: "ASSERTION_NOT_YET_VALID" });
  if (now - tol > na) return verdict("ASSERTION_EXPIRED", { reason: "ASSERTION_EXPIRED" });

  const audiences = textValues(assertion, "Audience");
  if (!audience || !audiences.includes(String(audience))) return verdict("AUDIENCE_MISMATCH", { reason: "AUDIENCE_MISMATCH" });

  const scd = tags.find(t => t.name === "SubjectConfirmationData" && !t.closing);
  if (scd?.attrs.NotOnOrAfter && now - tol > Date.parse(scd.attrs.NotOnOrAfter)) return verdict("SUBJECT_CONFIRMATION_EXPIRED", { reason: "SUBJECT_CONFIRMATION_EXPIRED" });

  const attrMap = attributeMap(assertion);
  const tenant = attrMap.get(tenantAttribute)?.[0] ?? null;
  const roles = attrMap.get(roleAttribute) ?? [];

  return {
    spec: IDP_VERSION,
    verdict: "VERIFIED",
    reason: "OK",
    boundary: INTEGRATIONS_BOUNDARY,
    at: nowIso(),
    assertionId: id,
    issuer,
    audiences,
    tenant,
    roles,
    signatureChecked: true,
    note: "Claims accepted only after injected XML-DSig verifier returned ok:true.",
  };
}

/* ------------------------------------------------------------------ SCIM */

export function createScimClient(config = {}) {
  const allowLocal = !!config.allowLocal;
  const base = requireProvisionedUrl(config.baseUrl, "baseUrl", allowLocal);
  if (!allowLocal) requireProvisioned(config, ["bearerTokenFile"]);
  if (config.bearerTokenFile && isPlaceholder(config.bearerTokenFile)) throw Object.assign(new Error("CG-IDP/1: placeholder bearerTokenFile"), { code: "NOT_PROVISIONED" });
  const tenantAttribute = config.tenantAttribute || "urn:coreguard:tenant";
  const token = () => config.allowLocal && !config.bearerTokenFile ? "local-scim-token" : readFileSync(config.bearerTokenFile, "utf8").trim();

  async function call(method, path, { body, expectStatus = [200, 201], query = {} } = {}) {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    return requestJson(url.toString(), {
      method,
      headers: {
        "Authorization": `Bearer ${token()}`,
        "Content-Type": "application/scim+json",
        "Accept": "application/scim+json",
        "User-Agent": "CoreGuard-CG-IDP/1",
      },
      body,
      expectStatus,
      timeoutMs: config.timeoutMs ?? 8000,
      retries: 1,
      label: "scim",
    });
  }

  function assertTenant(resource, tenant) {
    if (!tenant) return false;
    return resource?.[tenantAttribute] === tenant ||
      resource?.[`${tenantAttribute}:string`] === tenant ||
      (Array.isArray(resource?.[tenantAttribute]) && resource[tenantAttribute].includes(tenant));
  }

  async function listUsers({ tenant, filter, startIndex = 1, count = 100 } = {}) {
    if (!tenant || !filter) {
      return verdict("UNSCOPED_SCIM_QUERY", { reason: "UNSCOPED_SCIM_QUERY", note: "listUsers requires tenant + filter to prevent cross-tenant reads." });
    }
    const scoped = `${filter} and ${tenantAttribute} eq "${tenant}"`;
    const res = await call("GET", "/scim/v2/Users", { query: { filter: scoped, startIndex, count } });
    const resources = Array.isArray(res.body?.Resources) ? res.body.Resources : [];
    const leaked = resources.filter(r => !assertTenant(r, tenant));
    if (leaked.length > 0) return verdict("TENANT_ISOLATION_VIOLATION", { reason: "TENANT_ISOLATION_VIOLATION", leaked: leaked.length });
    return { spec: IDP_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), totalResults: res.body.totalResults ?? resources.length, resources };
  }

  async function getUser(id, tenant) {
    const res = await call("GET", `/scim/v2/Users/${encodeURIComponent(id)}`);
    if (tenant && !assertTenant(res.body, tenant)) return verdict("TENANT_ISOLATION_VIOLATION", { reason: "TENANT_ISOLATION_VIOLATION" });
    return { spec: IDP_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), resource: res.body };
  }

  async function createUser(resource, tenant) {
    if (tenant && !assertTenant(resource, tenant)) return verdict("TENANT_MISMATCH", { reason: "TENANT_MISMATCH" });
    const res = await call("POST", "/scim/v2/Users", { body: resource, expectStatus: [201] });
    if (tenant && !assertTenant(res.body, tenant)) return verdict("TENANT_ISOLATION_VIOLATION", { reason: "TENANT_ISOLATION_VIOLATION" });
    return { spec: IDP_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), resource: res.body };
  }

  async function patchUser(id, operations, tenant) {
    if (!Array.isArray(operations) || operations.length === 0) return verdict("INVALID_PATCH", { reason: "INVALID_PATCH" });
    const res = await call("PATCH", `/scim/v2/Users/${encodeURIComponent(id)}`, { body: { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: operations } });
    if (tenant && !assertTenant(res.body, tenant)) return verdict("TENANT_ISOLATION_VIOLATION", { reason: "TENANT_ISOLATION_VIOLATION" });
    return { spec: IDP_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), resource: res.body };
  }

  async function deleteUser(id) {
    await call("DELETE", `/scim/v2/Users/${encodeURIComponent(id)}`, { expectStatus: [204, 200] });
    return { spec: IDP_VERSION, verdict: "VERIFIED", reason: "OK", boundary: INTEGRATIONS_BOUNDARY, at: nowIso(), deleted: id };
  }

  return Object.freeze({ spec: IDP_VERSION, listUsers, getUser, createUser, patchUser, deleteUser });
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  push("exports", [createOidcVerifier, validateSamlAssertion, createScimClient].every(f => typeof f === "function"));
  let samlRefused = false;
  try { const r = validateSamlAssertion({ assertion: "<x/>", audience: "a" }); samlRefused = r.reason === "SIGNATURE_VERIFIER_REQUIRED"; } catch {}
  push("saml requires injected signature verifier", samlRefused);
  let oidcRefused = false;
  try { createOidcVerifier({ issuer: "https://idp.example.com", audience: "a" }); } catch (e) { oidcRefused = e.code === "NOT_PROVISIONED"; }
  push("oidc refuses placeholder issuer", oidcRefused);
  let scimRefused = false;
  try { createScimClient({ baseUrl: "https://scim.example.com", bearerTokenFile: "/run/secrets/t" }); } catch (e) { scimRefused = e.code === "NOT_PROVISIONED"; }
  push("scim refuses placeholder baseUrl", scimRefused);
  return { ok: checks.every(c => c.ok), checks };
}
