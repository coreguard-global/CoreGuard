# On-Chain Broadcast & Calls — Preparation Runbook (OWNER-GATED, safety-first)

**Status:** preparation artifact. **No on-chain broadcast/call has been performed.** Any broadcast (including Soroban `commit_authorized` or consumption-marker related actions) is **OWNER-GATED**, irreversible in effect, may incur fees, and must only be done with proper keys, funded accounts, and explicit step-by-step confirmation.

## 1) Current repo truth (relevant)
- **CGXA-SOROBAN/1:** offline Soroban consent-binding **preparation** exists (`buildSorobanConsentBinding` / `deriveSorobanAuthorizedAnchorId` in `packages/agent-commerce/attest.mjs`) producing `commit_authorized` invocation payloads — **no broadcast** performed by these surfaces.
- **AC-CS/1:** durable **same-host** file-backed consumption anchoring (not distributed, not on-chain). Any distributed/on-chain consumption marker is **separate work/decision** (not built as a broadcast path here).
- Existing chain-related machinery/runners and recorded statuses live in-repo (e.g. Stellar/Soroban/Core artifacts and scripts under `scripts/`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`) — follow their documented, verified statuses; do not assume new capabilities.

## 2) Preconditions (must be satisfied before any broadcast)
- **Authority & intent:** explicit owner decision for network (testnet/mainnet), scope, and exact transaction(s).
- **Keys & custody:** signing keys/wallet available **locally and securely** to the owner; **never** share secrets, seed phrases, or private keys in chat/logs/repos. Prefer hardware wallet or secure signer flows.
- **Funding & fees:** account funded for fees/rent/reserves; understand failure modes (insufficient balance, seq issues, simulation errors).
- **Environment:** pinned commit/tag, reproducible build inputs, known RPC/Horizon endpoints, and verified contract IDs/WASM hashes as applicable.
- **Dry-run first:** simulate/invoke-readonly where possible; validate payloads against offline preparations and expected hashes/IDs.

## 3) Safe execution flow (testnet-first recommended)

```text
# 1) Pin & verify locally (no broadcast)
git checkout <pinned-commit>
npm ci && npm test && npm run boundary:audit

# 2) Produce/verify offline artifacts (example: consent-binding preparation)
#    Use repo APIs/scripts to generate the exact invocation payload; record hashes/IDs.
#    node <script-or-repl>  (no keys, no network send)

# 3) Preflight on chosen network (read-only)
#    - check account balance/sequence, contract state, network passphrase
#    - simulate transaction; confirm fee/resources and expected result

# 4) Broadcast (OWNER ACTION ONLY, per-transaction explicit confirmation)
#    - sign with owner-controlled key
#    - submit; capture tx hash, ledger, result XDR/return values

# 5) Post-verify
#    - read back on-chain state/events; confirm matches expected binding/commitment
#    - store evidence bundle (tx id, inputs, outputs, timestamps) without secrets
```

> Use network-specific tooling/CLIs already documented in-repo where applicable; if no runner exists for a specific action, do not improvise a broadcast — design/review first.

## 4) Soroban `commit_authorized` (specific notes)
- Inputs: derived anchor/binding payload from CGXA-SOROBAN/1 preparation; target contract/method/args as specified by the deployed interface.
- Verify: argument encoding, authorization requirements, and that the contract address/WASM corresponds to the intended, reviewed deployment.
- Record: prepared payload hash ↔ submitted tx ↔ on-chain result for independent audit.

## 5) Go/No-Go checklist (per broadcast)
- [ ] Correct network and contract/account identifiers confirmed
- [ ] Payload derived offline and independently rechecked
- [ ] Simulation/read-only checks passed (or reason documented)
- [ ] Fees/funding sufficient; signer identity confirmed
- [ ] Explicit owner confirmation for this exact transaction
- [ ] Rollback/incident plan understood (cannot “undo” a confirmed tx)

## 6) What this runbook does not do
- Does not provide keys, does not sign, does not submit transactions, and does not claim any on-chain action completed.

*Preparation only; execution remains an explicit, owner-controlled action.*
