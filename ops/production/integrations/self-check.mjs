#!/usr/bin/env node
/** Aggregate offline self-check for every CG-INT/1 adapter. No network calls. */
import { selfCheck as commonCheck } from "./common.mjs";
import { selfCheck as x402Check } from "./x402-verifier.mjs";
import { selfCheck as idpCheck } from "./idp.mjs";
import { selfCheck as kmsCheck } from "./kms.mjs";
import { selfCheck as witnessCheck } from "./witness.mjs";
import { selfCheck as obsCheck } from "./observability.mjs";
import { selfCheck as configCheck } from "./config.mjs";
import { selfCheck as probeCheck } from "./probe.mjs";

const suites = {
  common: commonCheck?.() ?? { ok: true, checks: [] },
  x402: x402Check(),
  idp: idpCheck(),
  kms: kmsCheck(),
  witness: witnessCheck(),
  observability: obsCheck(),
  config: configCheck?.() ?? { ok: true, checks: [] },
  probe: probeCheck(),
};

const checks = Object.entries(suites).flatMap(([name, r]) => r.checks.map(c => ({ suite: name, ...c })));
const ok = checks.every(c => c.ok);
process.stdout.write(JSON.stringify({ spec: "CG-INT/1", ok, total: checks.length, checks }, null, 2) + "\n");
if (!ok) process.exitCode = 1;
