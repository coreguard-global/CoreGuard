/**
 * Integration configuration decoder (CG-INT/1)
 *
 * Maps environment variables to adapter configs and reports, per integration,
 * PROVISIONED or NOT_PROVISIONED. Placeholder/example values are NEVER accepted
 * as provisioned. No network call is made here.
 */

import { existsSync, readFileSync } from "node:fs";
import { isPlaceholder } from "./common.mjs";

export const CONFIG_VERSION = "CG-INT/1";

const GROUPS = Object.freeze({
  x402: ["CG_X402_VERIFIER_ENDPOINT", "CG_X402_API_KEY_FILE", "CG_X402_NETWORK", "CG_X402_ASSET"],
  oidc: ["CG_OIDC_ISSUER", "CG_OIDC_AUDIENCE", "CG_OIDC_JWKS_URL"],
  scim: ["CG_SCIM_BASE_URL", "CG_SCIM_TOKEN_FILE"],
  kms: ["CG_KMS_PROVIDER", "CG_KMS_KEY_ID"],
  witness: ["CG_WITNESS_ENDPOINT", "CG_WITNESS_PUBLIC_KEY_FILE"],
  stellar: ["STELLAR_HORIZON_URL", "STELLAR_NETWORK_PASSPHRASE"],
  otel: ["OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_SERVICE_NAME"],
  alerts: ["CG_ALERT_WEBHOOK_URL"],
});

const FILE_FIELDS = new Set(["CG_X402_API_KEY_FILE", "CG_SCIM_TOKEN_FILE", "CG_WITNESS_PUBLIC_KEY_FILE", "CG_KMS_ACCESS_KEY_ID_FILE", "CG_KMS_SECRET_ACCESS_KEY_FILE", "CG_KMS_TOKEN_FILE", "CG_ALERT_TOKEN_FILE"]);

export function decodeIntegrationConfig(env = process.env) {
  const report = {};
  for (const [group, keys] of Object.entries(GROUPS)) {
    const values = {};
    const issues = [];
    for (const k of keys) {
      const v = env[k];
      values[k] = v ?? null;
      if (!v) { issues.push(`${k}: MISSING`); continue; }
      if (FILE_FIELDS.has(k)) {
        if (isPlaceholder(v)) issues.push(`${k}: PLACEHOLDER`);
        else if (!existsSync(v)) issues.push(`${k}: FILE_NOT_FOUND`);
      } else if (isPlaceholder(v)) issues.push(`${k}: PLACEHOLDER`);
    }
    report[group] = { status: issues.length ? "NOT_PROVISIONED" : "PROVISIONED", issues, values };
  }

  const provider = env.CG_KMS_PROVIDER || "";
  const kmsNeeds = {
    "aws-kms": ["CG_KMS_REGION", "CG_KMS_ACCESS_KEY_ID_FILE", "CG_KMS_SECRET_ACCESS_KEY_FILE"],
    "gcp-kms": ["CG_KMS_TOKEN_FILE"],
    "azure-keyvault": ["CG_KMS_VAULT", "CG_KMS_KEY", "CG_KMS_TOKEN_FILE"],
    "vault": ["CG_KMS_ADDR", "CG_KMS_TOKEN_FILE"],
    "pkcs11": [],
  }[provider];
  if (provider === "local-dev-only") {
    report.kms.status = "NOT_PROVISIONED";
    report.kms.issues.push("CG_KMS_PROVIDER: LOCAL_DEV_ONLY_IS_NOT_PRODUCTION");
  } else if (kmsNeeds) {
    for (const k of kmsNeeds) {
      const v = env[k];
      report.kms.values[k] = v ?? null;
      if (!v) report.kms.issues.push(`${k}: MISSING`);
      else if (FILE_FIELDS.has(k) && (isPlaceholder(v) || !existsSync(v))) report.kms.issues.push(`${k}: ${isPlaceholder(v) ? "PLACEHOLDER" : "FILE_NOT_FOUND"}`);
      else if (!FILE_FIELDS.has(k) && isPlaceholder(v)) report.kms.issues.push(`${k}: PLACEHOLDER`);
    }
    if (report.kms.issues.length) report.kms.status = "NOT_PROVISIONED";
  } else if (provider) {
    report.kms.status = "NOT_PROVISIONED";
    report.kms.issues.push("CG_KMS_PROVIDER: UNSUPPORTED");
  }

  return {
    spec: CONFIG_VERSION,
    at: new Date().toISOString(),
    summary: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.status])),
    groups: report,
    boundary: "PROVISIONED means configuration is present and non-placeholder. It does NOT mean the endpoint is reachable, credentials are correct, or the environment is production-ready.",
  };
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  const empty = decodeIntegrationConfig({});
  push("empty env is not provisioned", Object.values(empty.summary).every(s => s === "NOT_PROVISIONED"));
  push("boundary is explicit", /does NOT mean the endpoint is reachable/.test(empty.boundary));
  return { ok: checks.every(c => c.ok), checks };
}

export function adapterConfigs(env = process.env) {
  const v = (k) => env[k] ?? null;
  return {
    x402: {
      endpoint: v("CG_X402_VERIFIER_ENDPOINT"),
      apiKeyFile: v("CG_X402_API_KEY_FILE"),
      network: v("CG_X402_NETWORK"),
      asset: v("CG_X402_ASSET"),
      minConfirmations: Number(v("CG_X402_MIN_CONFIRMATIONS") ?? 1),
      verifierPublicKeyPem: (() => { const f = v("CG_X402_VERIFIER_PUBLIC_KEY_FILE"); return f && existsSync(f) ? readFileSync(f, "utf8") : null; })(),
    },
    oidc: { issuer: v("CG_OIDC_ISSUER"), audience: v("CG_OIDC_AUDIENCE"), jwksUrl: v("CG_OIDC_JWKS_URL"), tenantClaim: v("CG_OIDC_TENANT_CLAIM") || "tenant_id", requireTenant: v("CG_OIDC_REQUIRE_TENANT") === "true" },
    scim: { baseUrl: v("CG_SCIM_BASE_URL"), bearerTokenFile: v("CG_SCIM_TOKEN_FILE") },
    kms: {
      provider: v("CG_KMS_PROVIDER"), keyId: v("CG_KMS_KEY_ID"), region: v("CG_KMS_REGION"),
      accessKeyIdFile: v("CG_KMS_ACCESS_KEY_ID_FILE"), secretAccessKeyFile: v("CG_KMS_SECRET_ACCESS_KEY_FILE"),
      sessionTokenFile: v("CG_KMS_SESSION_TOKEN_FILE"), tokenFile: v("CG_KMS_TOKEN_FILE"),
      vault: v("CG_KMS_VAULT"), key: v("CG_KMS_KEY"), addr: v("CG_KMS_ADDR"),
    },
    witness: { endpoint: v("CG_WITNESS_ENDPOINT"), publicKeyPem: (() => { const f = v("CG_WITNESS_PUBLIC_KEY_FILE"); return f && existsSync(f) ? readFileSync(f, "utf8") : null; })() },
    stellar: { horizonUrl: v("STELLAR_HORIZON_URL"), networkPassphrase: v("STELLAR_NETWORK_PASSPHRASE") },
    otel: { endpoint: v("OTEL_EXPORTER_OTLP_ENDPOINT"), serviceName: v("OTEL_SERVICE_NAME") },
    alerts: { webhookUrl: v("CG_ALERT_WEBHOOK_URL"), tokenFile: v("CG_ALERT_TOKEN_FILE") || null },
  };
}
