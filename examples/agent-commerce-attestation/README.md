# Cross-Chain Execution Attestation (CGXA/1) — product 5

One verifiable statement — *"this executed order corresponds to the authorization bound in consent record C, and the chain binding it cites is the chain's committed record"* — minted and verified **offline** from the repo's own committed machinery, with each network's limits stated honestly.

Run the demo: `node examples/agent-commerce-attestation/run.mjs`
Run the contract tests: `node --test test/integrations/agent-commerce-attestation.test.mjs`

## What the record binds

- **consentReceiptId** — the CGCR/1 consent receipt the execution is attested against.
- **executedCommitment** — the CGEP/1 trace-domain hash of the executed order: the same domain the family's verifier re-derives, so an attestation is only mintable for an arc that verifies exact.
- **adapter + chainBinding** — the target chain's binding record, byte-exact against the frozen registry in `packages/agent-commerce/attest.mjs`; every fact is pinned by a test to the committed document that holds it (`docs/DEPLOYMENT.md` for the Core DAO anchor on chainId 1116, `docs/EVIDENCE-MATRIX.md` for the Stellar anchor contract).
- **verificationLevel** — `COMMITTED_EVIDENCE`: the record cites committed chain truth, never a broadcast this module performed.

## What is deliberately NOT here

- **No broadcast surface** — no signing, no submitting, no network, no keys, no wall clock. A new anchor commit or a Soroban call is a new on-chain transaction: owner-authorized only by repo rule, and the code to attempt it does not exist in this module.
- **No bridge trust** — an attestation of one environment is never a relay claim or a cross-chain bridge guarantee.
- **No consumption** — verifying an attestation never consumes the single-use consent; consumption stays with the family's first-verified-execution ledger.

## Fail-closed vocabulary

`MALFORMED_ATTESTATION` · `ADAPTER_UNKNOWN` · `CHAIN_BINDING_MISMATCH` · `LEVEL_MISMATCH` · `CONSENT_MISMATCH` · `EXECUTION_MISMATCH` · `TIME_INVALID` · `ID_MISMATCH` · `VERIFIER_ERROR` — frozen and versioned; a new code lands with its own negative test in the same push. The verifier's own failure is a code too, never an exception leaking a pass.

## Status

**BUILT · TEST_EXECUTED** (offline attestation surface) · on-chain broadcast legs **OWNER-GATED / NOT_PERFORMED** · integration lanes **NOT_BUILT** · `VERIFIED ≠ SAFE` · delivery conformity (DDE/1) is never decided · every demo order is synthetic (the credential is a placeholder, never a PAN).
