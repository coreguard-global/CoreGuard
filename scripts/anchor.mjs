#!/usr/bin/env node
/**
 * anchor.mjs — run CoreGuard's own anchor log from the command line.
 *
 *   keygen   create an Ed25519 issuer key locally (never in this repository)
 *   attest   append one signed anchor for a digest, print the new Merkle root
 *   verify   check every signature, the hash chain and the root
 *   resolve  ask the log whether it holds a digest — verified / absent / unresolvable
 *   prepare  print the 32-byte memo a chain anchor would carry (no broadcast)
 *
 * The log is a JSON file. It is append-only in the sense that matters: every
 * entry names the leaf hash of the one before it, so a rewrite anywhere changes
 * the tail and `verify` fails by position.
 *
 * Nothing in here broadcasts, signs a transaction, or talks to a network.
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ANCHOR_VERSION,
  appendAnchor,
  createLog,
  generateIssuerKey,
  keyIdFor,
  prepareChainAnchor,
  resolveAnchor,
  verifyLog,
} from "../packages/agent-commerce/anchor.mjs";
import { composeOutcome, compareModes } from "../packages/agent-commerce/composition.mjs";

function usage() {
  console.error(
    [
      "usage:",
      "  anchor.mjs keygen --out <key.pem>",
      "  anchor.mjs attest --log <log.json> --key <key.pem> --digest <sha256:hex> [--kind receipt] [--now ISO]",
      "  anchor.mjs verify --log <log.json>",
      "  anchor.mjs resolve --log <log.json> --digest <sha256:hex> [--mode composed|layered]",
      "  anchor.mjs prepare --log <log.json> [--network testnet]",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}

const readLog = (path) => {
  if (!existsSync(path)) return createLog();
  return JSON.parse(readFileSync(path, "utf8"));
};
const writeLog = (path, log) => writeFileSync(path, JSON.stringify(log, null, 2) + "\n");

const [, , command, ...rest] = process.argv;
const args = parseArgs(rest);

if (command === "keygen") {
  if (!args.out || args.out === true) usage();
  const keys = generateIssuerKey();
  writeFileSync(resolve(args.out), keys.privateKeyPem, { mode: 0o600 });
  try {
    chmodSync(resolve(args.out), 0o600);
  } catch {}
  console.log(`ANCHOR-KEYGEN: wrote ${args.out} (chmod 600)`);
  console.log(`keyId: ${keyIdFor(keys.publicKeyPem)}`);
  console.log("Keep the private key off this repository. Only the public key travels inside attestations.");
  process.exit(0);
}

if (command === "attest") {
  if (!args.log || !args.key || !args.digest) usage();
  const privateKeyPem = readFileSync(resolve(args.key), "utf8");
  const log = readLog(resolve(args.log));
  const next = appendAnchor(log, {
    subject: { kind: typeof args.kind === "string" ? args.kind : "receipt", digest: args.digest },
    issuedAt: typeof args.now === "string" ? args.now : new Date().toISOString(),
    privateKeyPem,
  });
  writeLog(resolve(args.log), next);
  console.log(`ANCHOR-ATTEST: ${ANCHOR_VERSION} entry ${next.entries.length - 1}`);
  console.log(`subject: ${next.entries.at(-1).subject.digest}`);
  console.log(`root:    ${next.root}`);
  process.exit(0);
}

if (command === "verify") {
  if (!args.log) usage();
  const log = readLog(resolve(args.log));
  const report = verifyLog(log);
  for (const c of report.checks) if (!c.ok) console.log(`  FAIL ${c.name}`);
  console.log(`ANCHOR-VERIFY: ${report.ok ? "OK" : "FAIL"} — ${log.entries.length} entries · root ${report.root}`);
  process.exit(report.ok ? 0 : 1);
}

if (command === "resolve") {
  if (!args.log || !args.digest) usage();
  const log = readLog(resolve(args.log));
  const anchor = resolveAnchor(log, args.digest);
  const mode = typeof args.mode === "string" ? args.mode : "composed";
  const composed = composeOutcome({ presented: true, record: { evaluated: true, ok: true }, anchor, mode });
  console.log(`ANCHOR-RESOLVE: ${anchor.outcome} (${anchor.matches ?? 0} entries)`);
  console.log(`composition ${mode}: headline ${composed.headline} · blocks ${composed.blocks}`);
  process.exit(0);
}

if (command === "prepare") {
  if (!args.log) usage();
  const log = readLog(resolve(args.log));
  const prepared = prepareChainAnchor(log, { network: typeof args.network === "string" ? args.network : "testnet" });
  if (!prepared.ok) {
    console.log(`ANCHOR-PREPARE: REFUSED — ${prepared.reason}`);
    process.exit(1);
  }
  console.log(`ANCHOR-PREPARE: adapter ${prepared.adapter} · network ${prepared.network} · broadcast ${prepared.broadcast}`);
  console.log(`memo (hash): ${prepared.memoHashHex}`);
  console.log(`root:        ${prepared.root} (${prepared.entries} entries)`);
  process.exit(0);
}

if (command === "modes") {
  // A tiny demonstration of the one policy difference, for reviewers.
  const anchor = { present: true, evaluated: true, outcome: "unresolvable" };
  const picture = compareModes({ presented: true, record: { evaluated: true, ok: true }, anchor });
  console.log(`composed: ${picture.composed.headline} (blocks ${picture.composed.blocks})`);
  console.log(`layered:  ${picture.layered.headline} (blocks ${picture.layered.blocks}) · anchor rejected: ${picture.layered.anchor.rejected}`);
  console.log(`same record outcome: ${picture.recordStable}`);
  process.exit(0);
}

usage();
