#!/usr/bin/env node
/**
 * Smart-account adapter — one synthetic snapshot, all three checks.
 *
 * A caller supplies an account snapshot it already holds; the adapter reshapes
 * it into the arguments of three tools, and this example runs those three
 * checks locally and prints what each one decided:
 *
 *   coreguard_verify_stellar_smart_account_signers
 *   coreguard_verify_stellar_multisig_thresholds
 *   coreguard_verify_stellar_soroban_auth_entry
 *
 * The snapshot is SYNTHETIC: made-up account, signers and contract id. Nothing
 * is fetched, signed, submitted or deployed, and no chain is contacted. This is
 * a usage example for the adapter, not an integration, endorsement or claim
 * about any wallet, network or provider. VERIFIED ≠ SAFE.
 *
 * Run: node examples/smart-account-adapter/run.mjs
 * Exit: 0 only when the adapter maps and all three checks return PASS.
 */

import {
  ADAPTER_BOUNDARY,
  fromSmartAccountSnapshot,
} from "../../packages/agent-commerce/smart-account-adapter.mjs";
import {
  verifyStellarSmartAccountSigners,
  verifyStellarMultisigThresholds,
  verifyStellarSorobanAuthEntry,
} from "../../packages/agent-commerce/wave6.mjs";

const ARGS_DIGEST = `sha256:${"ab".repeat(32)}`;
const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const snapshot = {
  network: "testnet",
  accountId: "CSYNTHETICACCOUNT",
  masterWeight: 0,
  thresholds: { low: 1, medium: 2, high: 3 },
  signers: [
    { key: "GSYNTHETICSESSION", kind: "session_key", weight: 1 },
    { key: "GSYNTHETICPASSKEY", kind: "passkey", weight: 2 },
  ],
  soroban: {
    entry: {
      contractId: CONTRACT,
      functionName: "transfer",
      argsDigest: ARGS_DIGEST,
      signatureExpirationLedger: "2000",
      rootInvocation: true,
      subInvocations: [],
    },
    expected: { contractId: CONTRACT, functionName: "transfer", argsDigest: ARGS_DIGEST },
    currentLedger: "1000",
    allowedContracts: [CONTRACT],
  },
};

const tools = {
  coreguard_verify_stellar_smart_account_signers: verifyStellarSmartAccountSigners,
  coreguard_verify_stellar_multisig_thresholds: verifyStellarMultisigThresholds,
  coreguard_verify_stellar_soroban_auth_entry: verifyStellarSorobanAuthEntry,
};

const mapped = fromSmartAccountSnapshot(snapshot);
if (!mapped.ok) {
  console.error(`adapter refused the snapshot: ${mapped.error.code} — ${mapped.error.detail}`);
  process.exit(1);
}

console.log(`spec:     ${mapped.spec}`);
console.log(`network:  ${mapped.network} (synthetic)`);
console.log(`account:  ${mapped.accountId}`);
console.log(`digest:   ${mapped.snapshotDigest}`);
console.log(`calls:    ${mapped.toolCalls.length}`);
console.log(`boundary: ${ADAPTER_BOUNDARY}`);
console.log("");

let allPassed = true;
for (const call of mapped.toolCalls) {
  const verify = tools[call.name];
  const result = verify(call.arguments);
  if (result.verdict !== "PASS") allPassed = false;

  console.log(call.name);
  console.log(`  verdict: ${result.verdict}   status: ${result.status}`);
  if (result.failed?.length) console.log(`  failed:  ${result.failed.join(", ")}`);
  if (result.requiredWeight !== undefined) {
    console.log(`  weight:  required ${result.requiredWeight}, present ${result.presentWeight}`);
  }
  console.log("");
}

console.log(allPassed ? "all three checks passed" : "one or more checks did not pass");
process.exit(allPassed ? 0 : 1);
