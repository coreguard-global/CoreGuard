#!/usr/bin/env node
/**
 * LOCAL SIMULATION ONLY - NOT_PRODUCTION_EVIDENCE
 * Simulates backup/restore+integrity against a local CGCP/1 file store.
 */
import { mkdtempSync, copyFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "../../../packages/agent-commerce/control-plane.mjs";

const dir = mkdtempSync(join(tmpdir(), "cgcp-drill-"));
const store = join(dir, "store.json");
const backup = join(dir, "store.backup.json");
const restored = join(dir, "restored.json");
const out = process.argv[2] || join(dir, "evidence.json");
try {
  const cp = createControlPlane({ storePath: store, create: true });
  cp.upsertAgent({ id: "a1", name: "agent-1" });
  cp.upsertPolicy({ id: "p1", spec: { currency: "USD", perTransactionMinor: "1000" } });
  cp.commitExecution({ id: "e1", agentId: "a1", amountMinor: "100", currency: "USD" });
  const before = cp.auditAnchor();
  copyFileSync(store, backup);
  copyFileSync(backup, restored);
  const cp2 = createControlPlane({ storePath: restored, create: false });
  const verify = cp2.verifyLedger();
  const after = cp2.auditAnchor();
  const evidence = {
    status: "LOCAL_SIMULATION_NOT_PRODUCTION_EVIDENCE",
    drill: "backup-restore-integrity",
    executedAt: new Date().toISOString(),
    environment: "local-simulation",
    before,
    after,
    verify,
    pass: verify.ok && before.headHash === after.headHash && before.length === after.length,
    notes: "Local file copy simulation only. Does not prove managed Postgres HA/replication/failover or production RPO/RTO.",
  };
  writeFileSync(out, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ ok: evidence.pass, out, status: evidence.status }));
  if (!evidence.pass) process.exit(1);
} finally {
  // keep out file if outside tmp; tmp dir cleaned
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
