#!/usr/bin/env node
/**
 * release-please.mjs — the fail-closed release gate. Publishing happens
 * through this script only:
 *
 *   node scripts/release-please.mjs [--dry-run]
 *
 * Order of defense:
 *   1. NPM_TOKEN must be present in the environment — publish without a
 *      credential is refused before anything runs (no half-published trees).
 *   2. scripts/publish-check.mjs must exit 0 for all 14 packages — the
 *      tarball-content, escaped-import, dependency-truth and INSTALL PARITY
 *      gates run against packed tarballs installed into a scratch workspace.
 *   3. --dry-run prints the publish plan and exits without publishing.
 *
 * Exit 0 only when the gate passes; the release workflow runs this first and
 * publishes with `--provenance --access public` on tagged main commits.
 */

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = [
  "canonical", "crypto", "policy", "trace", "evidence", "replay", "evm",
  "provenance", "intent", "verifier", "firewall", "delivery", "sdk",
  "agent-commerce",
];

const dryRun = process.argv.includes("--dry-run");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const SPAWN_SHELL = process.platform === "win32" ? true : undefined;

// gate 1 — credential present
const token = process.env.NPM_TOKEN ?? "";
if (!token.trim()) {
  console.error("release-please: NPM_TOKEN is not set — refusing to publish without a credential");
  process.exit(1);
}
console.log("release-please: NPM_TOKEN present ✓");

// gate 2 — the publish-check gate (spawned so its exit code is authoritative)
console.log("release-please: running publish-check over all 14 packages…");
const check = spawnSync(process.execPath, [join(REPO, "scripts", "publish-check.mjs")], {
  cwd: REPO,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"],
});
const outTail = String(check.stdout ?? "").split("\n").slice(-3).join("\n");
const errTail = String(check.stderr ?? "").split("\n").slice(-6).join("\n");
if (check.status !== 0) {
  console.error(`release-please: publish-check FAILED (exit ${check.status}) — publishing BLOCKED`);
  if (outTail.trim()) console.error(outTail);
  if (errTail.trim()) console.error(errTail);
  process.exit(1);
}
console.log(outTail.trim());

// gate 3 — the plan
const versions = PACKAGES.map((d) => {
  const pkg = JSON.parse(readFileSync(join(REPO, "packages", d, "package.json"), "utf8"));
  return `${pkg.name}@${pkg.version}`;
});
console.log("release-please: publish plan (14 packages, dependency order):");
for (const v of versions) console.log(`  ${v}`);

if (dryRun) {
  console.log("release-please: dry-run complete — nothing was published");
  process.exit(0);
}

// gate 4 - publishes in dependency order, fail-fast but idempotent for
// already-published versions (avoids failed deployments when versions are live).
mkdirSync(join(REPO, "tmp"), { recursive: true });
const log = join(REPO, "tmp", "release-log.txt");
let failed = null;
let published = 0;
let skipped = 0;
for (const dir of PACKAGES) {
  if (failed) break;
  const pkg = JSON.parse(readFileSync(join(REPO, "packages", dir, "package.json"), "utf8"));
  const spec = `${pkg.name}@${pkg.version}`;

  const view = spawnSync(NPM, ["view", spec, "version"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: SPAWN_SHELL,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (view.status === 0 && String(view.stdout ?? "").trim() === pkg.version) {
    console.log(`skipped ${spec} (already published)`);
    skipped++;
    continue;
  }

  const res = spawnSync(NPM, ["publish", "--access", "public", "--loglevel=notice"], {
    cwd: join(REPO, "packages", dir),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: SPAWN_SHELL,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (res.status !== 0) {
    failed = {
      dir,
      spec,
      code: res.status,
      tail: String(res.stderr ?? res.stdout ?? "").split("\n").slice(-8).join("\n"),
    };
    break;
  }
  // A zero exit code is not proof: confirm the registry actually serves the
  // version before claiming success (a silent no-op publish must fail loudly).
  // npm answers an accepted publish with "being processed and may take a few
  // minutes" — so a 25-second window reports a successful publish as a failed
  // one (run 45450058617: @coreguard/agent-commerce@0.1.4 was live and `latest`
  // while this gate still said the registry did not serve it). Poll for four
  // minutes, and say what is happening while it propagates.
  let confirmed = false;
  for (let attempt = 0; attempt < 24 && !confirmed; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10_000));
    if (attempt > 0 && attempt % 6 === 0) console.log(`  ${spec}: registry still propagating (~${attempt * 10}s since publish)`);
    const check = spawnSync(NPM, ["view", spec, "version"], {
      cwd: REPO,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      shell: SPAWN_SHELL,
      stdio: ["ignore", "pipe", "pipe"],
    });
    confirmed = check.status === 0 && String(check.stdout ?? "").trim() === pkg.version;
  }
  if (!confirmed) {
    failed = {
      dir,
      spec,
      code: "unconfirmed",
      tail: `npm publish exited 0 but the registry still does not serve ${spec} after ~240s\n${output.split("\n").slice(-12).join("\n")}`,
    };
    break;
  }
  console.log(output.split("\n").filter((l) => l.trim()).slice(-4).join("\n"));
  console.log(`released ${spec} ✓ (confirmed on registry)`);
  published++;
}
if (failed) {
  writeFileSync(log, `release stopped at ${failed.spec} (exit ${failed.code})\n${failed.tail}\n`, "utf8");
  console.error(`release-please: publish of ${failed.spec} failed (exit ${failed.code}) — remaining packages NOT published; log: tmp/release-log.txt`);
  console.error(failed.tail);
  process.exit(1);
}
console.log(`release-please: complete ✓ (${published} published, ${skipped} already published; log: ${log})`);
