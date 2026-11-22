/**
 * CoreGuard Control Plane HTTP API (CGCP/1) — zero-dependency node:http surface.
 *
 * The same plane the SDK and CLI use, reachable by an agent runtime, a CI job or
 * an operator console. Every /v1 route requires a bearer API key compared in
 * constant time; /health is deliberately public (liveness only, no data).
 *
 * BOUNDARY (standing): a single API key is host-level authorisation, NOT
 * multi-user identity. There is no RBAC/SSO/tenant isolation here — that is
 * NOT_BUILT and is stated by `CONTROL_PLANE_BOUNDARY` on every report. Bind it
 * to loopback or a private network; TLS and an authenticating reverse proxy are
 * deployment concerns, not claims of this module.
 */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { CONTROL_PLANE_BOUNDARY, CONTROL_PLANE_VERSION, createControlPlane } from "./control-plane.mjs";

const MAX_BODY_BYTES = 256 * 1024;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function apiError(res, status, code, detail) {
  json(res, status, { error: { code, detail }, boundary: CONTROL_PLANE_BOUNDARY });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function readJson(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        // Keep draining so the client can read the 413 instead of seeing a
        // reset socket; stop buffering and reject at end of stream.
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (tooLarge) return;
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) {
        const err = new Error("request body too large");
        err.statusCode = 413;
        err.code = "BODY_TOO_LARGE";
        return reject(err);
      }
      if (chunks.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("body must be a JSON object");
          err.statusCode = 400;
          err.code = "INVALID_JSON";
          return reject(err);
        }
        return resolve(parsed);
      } catch {
        const err = new Error("body is not valid JSON");
        err.statusCode = 400;
        err.code = "INVALID_JSON";
        return reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Build the request handler. Exported separately from the server so a host can
 * mount it in its own HTTP stack or test it without a socket.
 */
export function createControlPlaneHandler({ controlPlane, apiKey, maxBodyBytes = MAX_BODY_BYTES } = {}) {
  if (!controlPlane) throw new TypeError("CGCP/1: controlPlane is required");
  if (typeof apiKey !== "string" || apiKey.length === 0) throw new TypeError("CGCP/1: apiKey is required");

  return async function handler(req, res) {
    const url = new URL(req.url ?? "/", "http://control-plane.local");
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (path === "/health" && method === "GET") {
      const ledger = controlPlane.verifyLedger();
      return json(res, 200, {
        ok: ledger.ok,
        version: CONTROL_PLANE_VERSION,
        boundary: CONTROL_PLANE_BOUNDARY,
        chain: { ok: ledger.chain.ok, length: ledger.chain.length },
      });
    }

    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!safeEqual(token, apiKey)) return apiError(res, 401, "UNAUTHORIZED", "a valid bearer API key is required");

    try {
      let body = {};
      if (method === "POST" || method === "PUT" || method === "PATCH") body = await readJson(req, maxBodyBytes);

      if (path === "/v1/version" && method === "GET") {
        return json(res, 200, { version: CONTROL_PLANE_VERSION, boundary: CONTROL_PLANE_BOUNDARY });
      }

      if (path === "/v1/agents" && method === "GET") {
        return json(res, 200, { agents: controlPlane.listAgents() });
      }
      if (path === "/v1/agents" && method === "POST") {
        return json(res, 201, controlPlane.upsertAgent(body));
      }
      const revokeAgent = path.match(/^\/v1\/agents\/([^/]+)\/revoke$/);
      if (revokeAgent && method === "POST") {
        return json(res, 200, controlPlane.revokeAgent(decodeURIComponent(revokeAgent[1]), body.reason ?? ""));
      }
      const bind = path.match(/^\/v1\/agents\/([^/]+)\/policy$/);
      if (bind && method === "POST") {
        return json(res, 200, controlPlane.bindPolicy(decodeURIComponent(bind[1]), body.policyId));
      }

      if (path === "/v1/policies" && method === "GET") {
        return json(res, 200, { policies: controlPlane.listPolicies() });
      }
      if (path === "/v1/policies" && method === "POST") {
        return json(res, 201, controlPlane.upsertPolicy(body));
      }
      const policy = path.match(/^\/v1\/policies\/([^/]+)$/);
      if (policy && method === "GET") {
        const record = controlPlane.getPolicy(decodeURIComponent(policy[1]));
        if (!record) return apiError(res, 404, "NOT_FOUND", "unknown policy");
        return json(res, 200, record);
      }
      const revokePolicy = path.match(/^\/v1\/policies\/([^/]+)\/revoke$/);
      if (revokePolicy && method === "POST") {
        return json(res, 200, controlPlane.revokePolicy(decodeURIComponent(revokePolicy[1]), body.reason ?? ""));
      }

      if (path === "/v1/evaluate" && method === "POST") {
        return json(res, 200, controlPlane.evaluate(body));
      }
      if (path === "/v1/authorize" && method === "POST") {
        return json(res, 200, controlPlane.authorize(body));
      }

      if (path === "/v1/approvals" && method === "POST") {
        return json(res, 201, controlPlane.requestApproval(body));
      }
      const approval = path.match(/^\/v1\/approvals\/([^/]+)$/);
      if (approval && method === "GET") {
        const record = controlPlane.getApproval(decodeURIComponent(approval[1]));
        if (!record) return apiError(res, 404, "NOT_FOUND", "unknown approval");
        return json(res, 200, record);
      }
      const decide = path.match(/^\/v1\/approvals\/([^/]+)\/decide$/);
      if (decide && method === "POST") {
        return json(
          res,
          200,
          controlPlane.decideApproval(decodeURIComponent(decide[1]), {
            decision: body.decision,
            decidedBy: body.decidedBy ?? null,
            reason: body.reason ?? null,
          }),
        );
      }

      if (path === "/v1/executions" && method === "GET") {
        return json(res, 200, { executions: controlPlane.listExecutions({ limit: Number(url.searchParams.get("limit") ?? 100) }) });
      }
      if (path === "/v1/executions" && method === "POST") {
        const result = controlPlane.commitExecution(body);
        return json(res, result.committed ? 201 : 409, result);
      }

      if (path === "/v1/verifications" && method === "POST") {
        return json(res, 201, controlPlane.recordVerification(body));
      }

      if (path === "/v1/spend" && method === "GET") {
        return json(
          res,
          200,
          controlPlane.spend({
            agentId: url.searchParams.get("agentId"),
            policyId: url.searchParams.get("policyId"),
          }),
        );
      }

      if (path === "/v1/audit" && method === "GET") {
        return json(res, 200, { audit: controlPlane.auditReport({ limit: Number(url.searchParams.get("limit") ?? 200) }).recentAudit });
      }
      if (path === "/v1/audit/verify" && method === "GET") {
        return json(res, 200, controlPlane.verifyLedger());
      }
      if (path === "/v1/report" && method === "GET") {
        return json(res, 200, controlPlane.auditReport({ limit: Number(url.searchParams.get("limit") ?? 200) }));
      }

      return apiError(res, 404, "NOT_FOUND", `${method} ${path} is not a control-plane route`);
    } catch (err) {
      const status = err?.statusCode ?? (err instanceof TypeError ? 400 : 400);
      if (status === 413) return apiError(res, 413, "BODY_TOO_LARGE", "request body exceeds the configured limit");
      // Never leak a stack trace to a caller.
      return apiError(res, status, err?.code ?? "INVALID_REQUEST", err?.message ?? "request failed");
    }
  };
}

/**
 * Create (but do not start) an HTTP server bound to one plane.
 */
export function createControlPlaneServer({ controlPlane, apiKey, maxBodyBytes = MAX_BODY_BYTES } = {}) {
  const handler = createControlPlaneHandler({ controlPlane, apiKey, maxBodyBytes });
  return createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) apiError(res, 500, "INTERNAL", "request failed");
    });
  });
}

/**
 * Open a plane and start its HTTP API. Port 0 asks the OS for a free port (the
 * resolved URL is returned), which is what the example and tests use.
 */
export async function startControlPlaneServer({
  storePath,
  apiKey,
  port = 0,
  host = "127.0.0.1",
  controlPlane = null,
  maxBodyBytes = MAX_BODY_BYTES,
} = {}) {
  const plane = controlPlane ?? createControlPlane({ storePath });
  const server = createControlPlaneServer({ controlPlane: plane, apiKey, maxBodyBytes });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  const baseUrl = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${boundPort}`;
  return {
    server,
    controlPlane: plane,
    url: baseUrl,
    port: boundPort,
    close: () =>
      new Promise((resolve, reject) => {
        // Node's fetch keeps sockets alive; without this the close callback
        // waits for the client pool and a test/CLI shutdown hangs.
        server.closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
