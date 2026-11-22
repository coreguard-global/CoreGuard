#!/usr/bin/env node
/**
 * CoreGuard Control Plane CLI (CGCP/1) — operator surface over the same plane
 * the SDK and HTTP API use. Every command prints canonical JSON to stdout and
 * exits 0; a failure prints `{error:{code,detail}}` to stderr and exits 1.
 *
 *   node packages/agent-commerce/control-plane-cli.mjs --store ./cp.json init
 *   ... policy upsert --id p1 --spend-limit 5000 --daily-limit 20000 --approval-above 1000
 *   ... agent upsert --id a1 --policy p1
 *   ... evaluate --agent a1 --merchant m1 --amount 900
 *   ... approval request --agent a1 --merchant m1 --amount 2000
 *   ... approval decide --id ap_x --decision approved --by ops@example
 *   ... exec --agent a1 --merchant m1 --amount 2000 --approval ap_x
 *   ... report
 *   ... serve --port 8787        (API key from --api-key or COREGUARD_CONTROL_PLANE_API_KEY)
 *
 * BOUNDARY: single-host, single-API-key. No RBAC/SSO/tenancy (NOT_BUILT).
 */

import { createControlPlane, CONTROL_PLANE_VERSION, CONTROL_PLANE_BOUNDARY } from "./control-plane.mjs";
import { startControlPlaneServer } from "./control-plane-http.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

const list = (value) =>
  value === undefined || value === true ? [] : String(value).split(",").map((s) => s.trim()).filter(Boolean);

function requireFlag(flags, name) {
  if (flags[name] === undefined || flags[name] === true) throw new Error(`--${name} is required`);
  return flags[name];
}

function out(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const storePath = flags.store ?? process.env.COREGUARD_CONTROL_PLANE_STORE ?? "./.coreguard/control-plane.json";
  const plane = createControlPlane({ storePath, lockTimeoutMs: Number(flags["lock-timeout-ms"] ?? 5000) });
  const [command, sub] = positional;

  switch (command) {
    case undefined:
    case "help":
      out({
        version: CONTROL_PLANE_VERSION,
        boundary: CONTROL_PLANE_BOUNDARY,
        store: storePath,
        commands: [
          "init",
          "agent upsert|list|revoke",
          "policy upsert|list|revoke",
          "approval request|decide|get",
          "evaluate|authorize|exec|verification",
          "spend|report|verify|serve",
        ],
      });
      return;

    case "init":
      out({ version: CONTROL_PLANE_VERSION, storePath, created: plane.getState().createdAt, boundary: CONTROL_PLANE_BOUNDARY });
      return;

    case "agent": {
      if (sub === "upsert") {
        out(
          plane.upsertAgent({
            id: requireFlag(flags, "id"),
            name: flags.name ?? null,
            policyId: flags.policy ?? null,
            status: flags.status ?? undefined,
            metadata: flags.metadata ? JSON.parse(flags.metadata) : undefined,
          }),
        );
        return;
      }
      if (sub === "list") return out({ agents: plane.listAgents() });
      if (sub === "revoke") return out(plane.revokeAgent(requireFlag(flags, "id"), flags.reason ?? ""));
      break;
    }

    case "policy": {
      if (sub === "upsert") {
        out(
          plane.upsertPolicy({
            id: requireFlag(flags, "id"),
            name: flags.name ?? null,
            status: flags.status ?? undefined,
            note: flags.note ?? null,
            spendLimitMinor: flags["spend-limit"] ?? null,
            dailyLimitMinor: flags["daily-limit"] ?? null,
            totalLimitMinor: flags["total-limit"] ?? null,
            requireApprovalAboveMinor: flags["approval-above"] ?? null,
            currency: flags.currency ?? null,
            allowMerchants: list(flags["allow-merchants"]),
            denyMerchants: list(flags["deny-merchants"]),
            allowAddresses: list(flags["allow-addresses"]),
            denyAddresses: list(flags["deny-addresses"]),
          }),
        );
        return;
      }
      if (sub === "list") return out({ policies: plane.listPolicies() });
      if (sub === "revoke") return out(plane.revokePolicy(requireFlag(flags, "id"), flags.reason ?? ""));
      break;
    }

    case "approval": {
      if (sub === "request") {
        out(
          plane.requestApproval({
            id: flags.id,
            agentId: requireFlag(flags, "agent"),
            policyId: flags.policy ?? null,
            merchant: flags.merchant ?? null,
            address: flags.address ?? null,
            amountMinor: flags.amount ?? null,
            currency: flags.currency ?? null,
            requestedBy: flags.by ?? null,
            expiresAt: flags.expires ?? null,
          }),
        );
        return;
      }
      if (sub === "decide") {
        out(
          plane.decideApproval(requireFlag(flags, "id"), {
            decision: requireFlag(flags, "decision"),
            decidedBy: flags.by ?? null,
            reason: flags.reason ?? null,
          }),
        );
        return;
      }
      if (sub === "get") {
        const record = plane.getApproval(requireFlag(flags, "id"));
        if (!record) throw new Error("unknown approval");
        out(record);
        return;
      }
      break;
    }

    case "evaluate":
      return out(
        plane.evaluate({
          agentId: requireFlag(flags, "agent"),
          policyId: flags.policy ?? null,
          merchant: flags.merchant ?? null,
          address: flags.address ?? null,
          amountMinor: flags.amount ?? null,
          currency: flags.currency ?? null,
          approvalId: flags.approval ?? null,
        }),
      );

    case "authorize":
      return out(
        plane.authorize({
          agentId: requireFlag(flags, "agent"),
          policyId: flags.policy ?? null,
          merchant: flags.merchant ?? null,
          address: flags.address ?? null,
          amountMinor: flags.amount ?? null,
          currency: flags.currency ?? null,
          approvalId: flags.approval ?? null,
        }),
      );

    case "exec":
      return out(
        plane.commitExecution({
          id: flags.id,
          agentId: requireFlag(flags, "agent"),
          policyId: flags.policy ?? null,
          merchant: flags.merchant ?? null,
          address: flags.address ?? null,
          amountMinor: requireFlag(flags, "amount"),
          currency: flags.currency ?? null,
          approvalId: flags.approval ?? null,
          receiptId: flags.receipt ?? null,
          verdict: flags.verdict ?? null,
          orderRef: flags.order ?? null,
        }),
      );

    case "verification":
      return out(
        plane.recordVerification({
          executionId: flags.execution ?? null,
          receiptId: flags.receipt ?? null,
          verdict: flags.verdict ?? null,
          source: flags.source ?? null,
        }),
      );

    case "spend":
      return out(plane.spend({ agentId: flags.agent ?? null, policyId: flags.policy ?? null }));

    case "report":
      return out(plane.auditReport({ limit: Number(flags.limit ?? 200) }));

    case "verify":
      return out(plane.verifyLedger());

    case "serve": {
      const apiKey = flags["api-key"] ?? process.env.COREGUARD_CONTROL_PLANE_API_KEY;
      if (!apiKey || apiKey === true) throw new Error("--api-key or COREGUARD_CONTROL_PLANE_API_KEY is required");
      const started = await startControlPlaneServer({
        controlPlane: plane,
        apiKey,
        port: Number(flags.port ?? 8787),
        host: flags.host ?? "127.0.0.1",
      });
      out({ serving: started.url, version: CONTROL_PLANE_VERSION, boundary: CONTROL_PLANE_BOUNDARY });
      return;
    }
  }

  throw new Error(`unknown command: ${positional.join(" ") || "(none)"}`);
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ error: { code: "CLI_ERROR", detail: err?.message ?? String(err) } }) + "\n");
  process.exit(1);
});
