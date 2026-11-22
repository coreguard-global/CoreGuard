/**
 * M2 (PROPOSED/BUILT as code): RBAC model for CGCP production track.
 * NOT_BUILT: external SSO/SAML/OIDC provider integration, SCIM sync, managed IAM.
 * This module provides deterministic role->permission mapping and enforcement helpers.
 */

export const ROLES = Object.freeze(["owner", "admin", "operator", "auditor", "agent-runtime", "read-only"]);
export const PERMISSIONS = Object.freeze({
  "tenant:read": ["owner","admin","operator","auditor","read-only"],
  "tenant:write": ["owner","admin"],
  "agent:read": ["owner","admin","operator","auditor","agent-runtime","read-only"],
  "agent:write": ["owner","admin","operator"],
  "policy:read": ["owner","admin","operator","auditor","agent-runtime","read-only"],
  "policy:write": ["owner","admin"],
  "approval:read": ["owner","admin","operator","auditor","read-only"],
  "approval:write": ["owner","admin","operator"],
  "execution:read": ["owner","admin","operator","auditor","read-only"],
  "execution:commit": ["owner","admin","operator","agent-runtime"],
  "audit:read": ["owner","admin","operator","auditor","read-only"],
  "audit:verify": ["owner","admin","operator","auditor"],
  "key:rotate": ["owner","admin"],
});

export function normalizeRoles(roles) {
  const arr = Array.isArray(roles) ? roles : [roles];
  return [...new Set(arr.filter(r => ROLES.includes(r)))];
}

export function hasPermission(roles, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  const rs = normalizeRoles(roles);
  return rs.some(r => allowed.includes(r));
}

export function requirePermission(auth, permission) {
  if (!auth || !auth.tenantId) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED", statusCode: 401 });
  if (auth.status && auth.status !== "active") throw Object.assign(new Error("AUTH_INACTIVE"), { code: "AUTH_INACTIVE", statusCode: 403 });
  if (!hasPermission(auth.roles, permission)) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN", statusCode: 403, permission, roles: normalizeRoles(auth.roles) });
  return true;
}

export function createAuthContext({ tenantId, subject, roles = [], kind = "service", status = "active", claims = {} } = {}) {
  if (!tenantId) throw new Error("tenantId required");
  return { tenantId: String(tenantId), subject: subject ?? null, roles: normalizeRoles(roles), kind, status, claims };
}
