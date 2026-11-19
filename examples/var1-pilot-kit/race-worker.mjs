/**
 * One contender in the cross-process spend race.
 *
 * The payload arrives on stdin, never in argv: a private key in a process list
 * is a private key on the machine. The child does one thing — claim — and
 * prints one JSON line. Its parent counts winners, because "spent: true" in a
 * single process proves only that the process agrees with itself.
 */

import { readFileSync } from "node:fs";
import { claimSpend } from "../../packages/agent-commerce/spend.mjs";

const payload = JSON.parse(readFileSync(0, "utf8"));
const result = claimSpend({
  path: payload.path,
  receiptDigest: payload.receiptDigest,
  approvalNonce: payload.approvalNonce,
  at: payload.at,
  orderRef: payload.orderRef ?? null,
  privateKeyPem: payload.privateKeyPem,
  timeoutMs: payload.timeoutMs ?? 5000,
});

process.stdout.write(
  JSON.stringify({
    pid: process.pid,
    ok: result.ok === true,
    state: result.state,
    reason: result.reason ?? null,
  }) + "\n",
);
