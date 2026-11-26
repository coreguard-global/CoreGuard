# CoreGuard × Stellar Agent Security Gate — Specification v0.2 (CG-SG/1)

**Status:** `SPEC / P1–P4 IMPLEMENTED OFFLINE / P5 OWNER-GATED / P6 NOT_BUILT`
**Date:** 2026-11-26
**Supersedes:** `docs/COREGUARD-STELLAR-AGENTIC-INFRASTRUCTURE-BLUEPRINT-v0.1.md` §5–§7 as the implementation contract for `stellar-agent-gate`.
**Owner gate:** this document does not authorize signing, broadcasting, custody of keys, a live Stellar RPC/Horizon dependency, an x402 settlement, a customer pilot, a signed-in third-party client run, or any production/security claim.

## 0. Decision record (what the owner authorized and what that cannot create)

The owner delegated full authority to implement the technical roadmap inside the repository. That delegation authorizes code, offline tests, generated evidence, a documented real-Testnet proof, and a gated `0.5.0` release when checks are green. It **does not create external facts**: no customer, pilot, sponsor, audit, funding, partnership, endorsement, adoption, SLA, signed-in MCP client run, or production readiness exists because a document says so. Those remain owner/external actions and are recorded only when a real, independently reproducible receipt exists.

## 1. Scope and boundary

CG-SG/1 is a deterministic, offline gate for agent-initiated Stellar actions. The caller supplies:

- a proposed action (including the **exact base64 XDR envelope bytes** and a projected view of the operation),
- a policy (allowlists, ceiling, authority scopes, replay state, time-bound requirement),
- a pinned `nowSeconds` (never the host clock),
- later, submission evidence (tx hash, result XDR, ledger, projected operation).

The module returns ALLOW / REFUSED / BOUND / VERIFIED / INVALID / UNKNOWN with named breaks. It:

- makes **no** Stellar RPC, Horizon, Friendbot, wallet, bank, regulator, sanctions-list, KYC provider or network call;
- never signs, submits, holds a secret, checks a balance, resolves an address or settles money;
- does not depend on Stellar Raven or Stellar Docs MCP;
- is **not** a compliance certification.

**VERIFIED ≠ SAFE.** A `VERIFIED` verdict means the saved envelope bytes matched the bound bytes and the supplied evidence fields agreed. It is not settlement finality, sanctions clearance, KYC/AML approval, asset truth, model correctness, device identity or an audit.

`ops/production` stays `INTEGRATION_READY, NOT_PROVISIONED` until real endpoints, credentials, trust roots and evidence exist and an owner decision is recorded.

## 2. Phased roadmap and definition of done

| Phase | Deliverable | Definition of done | Current truth |
|---|---|---|---|
| P0 | Study Stellar developer portal, Raven, Docs MCP, Agent Skills, x402 and RPC docs; record differentiators | Blueprint reviewed; claim table published | `RESEARCH` — blueprint v0.1 merged in PR #138 |
| P1 | Gate API, refusal taxonomy, evidence schema, adversarial vectors | Spec committed; named vectors executed offline; no live claim | `IMPLEMENTED` — this document + `stellar-gate.mjs` + 39 tests |
| P2 | Deterministic payment adapter over caller-supplied evidence | Amount/asset/recipient/network/replay/scope/time drift all fail closed by name | `IMPLEMENTED` — `preflightStellarAgentPayment` |
| P3 | Bind authorization to exact XDR bytes and observed projection | Byte drift and named field drift are refused; replay cannot reuse an authorization | `IMPLEMENTED` — `bindStellarAuthorization` |
| P4 | Expose gate through MCP with input/output schemas | `tools/list` grows 94 → 99; every example executed against a real stdio child; generated artifacts regenerated | `IMPLEMENTED` — 5 CG-SG/1 tools, 12/12 smoke |
| P5 | Documented Testnet run with a real RPC endpoint | Receipt, transaction hash, replay command, keys provenance and named boundaries recorded; still not production | `PROOF_RECORDED / SYNTHETIC` — real Testnet hash `ab879a1a…b5b09`, ledger `5925850`, ephemeral agent-generated keys; `docs/STELLAR-TESTNET-PROOF-2026-11-26.md`; not owner-held-key or production evidence |
| P6 | Production pilot | Signed owner decision, named integrator, credentials, trust roots, SLA discussion, evidence and incident owner | `NOT_BUILT / OWNER-GATED` — never assumed |

## 3. Authority model and open decisions

**Default recommendation adopted here:** CoreGuard gates and verifies only. Signing or broadcast is a separate owner decision with its own key custody, endpoint, rate limits and incident response. No CoreGuard tool in this release signs, submits or holds keys.

| Decision | Recommended default in this spec | Owner action still required |
|---|---|---|
| Authority model | Gate + verify only | Approve any future signing surface separately |
| Stellar data source | Caller-supplied evidence only in published tools | Choose RPC vs Horizon for any real adapter; name trust roots |
| Agent integration route | MCP tools + skill documentation; no Raven/Docs MCP dependency | Decide if a standalone CoreGuard Stellar MCP server is wanted |
| Flow scope | Classic payment envelope first; path payment, Soroban, x402 later | Approve each flow separately |
| Trust roots | Agent-owned keys; CoreGuard never custodies | Name key owner, endpoint owner, incident owner |
| Commercial shape | Small paid pilot/design-partner path after readiness | No IP assignment, default exclusivity, SLA or production guarantee before explicit decision |

## 4. Gate contract

### 4.1 Canonical proposal (`canonicalStellarIntent`)

Required fields: `network`, `sourceAccount`, `destination`, `asset`, `amount`, `envelopeXdr`, `envelopeProjection`.

- `network ∈ {testnet, pubnet, futurenet}` — a string, never inferred.
- `sourceAccount` / `destination`: `G[A-Z2-7]{55}` shape; no resolution or existence check.
- `asset`: `native` or `CODE:G...` shape; no issuer trust check.
- `amount`: positive decimal with at most 7 fractional digits, compared as integer stroops.
- `envelopeXdr`: non-empty base64 string; its digest is computed over the exact string bytes.
- `envelopeProjection`: caller-supplied decoded view used for named field comparison.
- Optional: `memo` (≤28 bytes), `nonce`, `scopes`, `agentScopes`, `timeBounds`, `purpose`, `envelopeDigest`.

### 4.2 Preflight refusal taxonomy (`preflightStellarAgentPayment`)

Every failure is named; no silent remapping.

| Code / check id | Meaning |
|---|---|
| `MISSING_ARGUMENT` | proposal or policy object absent |
| `INVALID_PROPOSAL` | canonicalization failed (see §4.1) |
| `policy:networks` | policy does not allow the proposed network |
| `policy:assets` | policy does not allow the proposed asset |
| `policy:destinations` | policy does not allow the proposed destination |
| `policy:maxAmount` | amount above the named ceiling or ceiling malformed |
| `policy:memo` | memo required but absent |
| `policy:nonce` | replay nonce required but absent |
| `replay:nonce` | nonce already present in `policy.usedNonces` |
| `authority:requiredScopes` | agent lacks a required scope |
| `authority:overreach` | requested scope outside agent authority |
| `time:bounds` | pinned time bounds required but absent/malformed |
| `time:pinned` | `nowSeconds` outside the supplied bounds |
| `envelope:projection` | projected operation field differs from the proposal |
| `envelope:digest` | declared envelope digest does not match the bytes |
| `POLICY_REFUSED` | aggregate refusal carrying the named breaks above |

### 4.3 Binding (`bindStellarAuthorization`)

An authorization is bindable only when `status === OK` and `verdict === ALLOW`. Binding recomputes the digest of the exact `envelopeXdr`, compares it with the authorization digest, and compares the caller's `observed` projection with the approved intent. Failures are `NOT_AUTHORIZED`, `MISSING_ARGUMENT` or `BINDING_REFUSED` with named `binding:bytes` / `binding:projection` / `binding:digest` breaks. A successful binding has `statusValue: BOUND`.

### 4.4 Submission evidence (`verifyStellarSubmissionEvidence`)

Evidence fields: `network`, `envelopeXdr`, `txHash` (64 lowercase hex), `successful === true`, positive integer `ledger`, `resultXdr`, and an `operation` projection. A `BOUND` binding is required; otherwise verdict is `UNKNOWN`. A coherent packet returns `VERIFIED`; any named break returns `INVALID` with `EVIDENCE_MISMATCH`. No RPC lookup is performed to obtain any of these fields.

### 4.5 Evidence pack (`exportStellarEvidencePack`)

Items are deep-copied, nested `secretKey` / `privateKey` / `mnemonic` / `callerContext` fields are redacted by default, and `root` / `packDigest` digests are computed over the cleaned pack. No transmission occurs.

## 5. Named adversarial vectors (16)

`coreguard_stellar_adversarial_vectors` exposes: `AMOUNT_ESCALATION`, `DESTINATION_SUBSTITUTION`, `ASSET_SUBSTITUTION`, `NETWORK_SUBSTITUTION`, `MEMO_DROP`, `REPLAY_NONCE`, `SCOPE_OVERREACH`, `TIMEBOUND_EXPIRY`, `ENVELOPE_BYTE_DRIFT`, `PROJECTED_FIELD_DRIFT`, `TX_HASH_MISMATCH`, `FAILED_RESULT`, `LEDGER_MISSING`, `OPERATION_DRIFT`, `MISSING_EVIDENCE`, `UNPINNED_AUTHORIZATION`. Tests construct each mutation and assert the named refusal, not only a generic false result.

## 6. MCP surface

Five tools were added to `@coreguard/agent-commerce`:

| Tool | Purpose |
|---|---|
| `coreguard_preflight_stellar_agent_payment` | Named pre-execution decision, fail closed |
| `coreguard_bind_stellar_authorization` | Exact-byte binding to the approved envelope |
| `coreguard_verify_stellar_submission_evidence` | Verify caller-supplied submission evidence |
| `coreguard_export_stellar_evidence_pack` | Redacted, digest-rooted evidence export |
| `coreguard_stellar_adversarial_vectors` | List the named deterministic cases |

All five have input/output schemas and a shared boundary string. The generated MCPRush reference executes every tool example against a real stdio server before writing docs. `npm run agent-commerce:mcp:smoke` exercises preflight → bind → verify → export → vectors end to end.

## 7. Real Testnet proof (P5, not a production claim)

`scripts/stellar-testnet-proof.mjs` is an optional manual script, deliberately excluded from `npm test`. It generates a fresh ephemeral keypair, funds it through the public Friendbot endpoint, builds and submits a real payment on Stellar Testnet through a named public RPC endpoint, then feeds the observed hash/ledger/result back through `verifyStellarSubmissionEvidence`. Its output must state:

- that keys are **ephemeral and agent-generated**, not owner-held;
- the exact endpoint and network used;
- the transaction hash, ledger and replay command;
- that this is a **synthetic technical proof**, not a customer, pilot, signing authority or production compatibility claim.

The script was run once on 2026-11-26 with ephemeral agent-generated keys. The real hash `ab879a1a06e8fc2e4eb4f7bf96908dd688a6b06a0e9921f97038196ea87b5b09`, ledger `5925850`, endpoint, replay command and boundaries are recorded in `docs/STELLAR-TESTNET-PROOF-2026-11-26.md` and `docs/STELLAR-TESTNET-PROOF-2026-11-26.json`, including a separate Horizon re-read. If it is not re-run, no additional hash is claimed.

## 8. Claim discipline

| Allowed now | Not allowed now |
|---|---|
| "Stellar's portal points developer tooling toward agents, MCP, skills and x402." | "CoreGuard is integrated with Stellar Raven or Stellar Docs MCP." |
| "CG-SG/1 provides offline, deterministic pre-execution gating and exact XDR byte binding." | "CoreGuard called Stellar RPC / Testnet / Mainnet" unless a recorded proof exists. |
| "A named adversarial suite and 5 MCP tools were prepared and tested offline." | "Production ready", "audited", "compliant", "settlement final", "verified safe". |
| "A manual Testnet proof script exists; any run will be recorded with its hash and boundaries." | Any customer, pilot, sponsor, funding, endorsement or adoption claim. |
| "`VERIFIED` means supplied bytes matched the bound bytes." | "`VERIFIED` means the payment settled or the recipient is safe." |

## 9. References

- Blueprint: `docs/COREGUARD-STELLAR-AGENTIC-INFRASTRUCTURE-BLUEPRINT-v0.1.md`
- Implementation: `packages/agent-commerce/stellar-gate.mjs`
- Tests: `test/integrations/agent-commerce-stellar-gate.test.mjs`
- Manual proof: `scripts/stellar-testnet-proof.mjs`
- Release preparation: `docs/releases/0.5.0.md`
- Status truth table: `docs/STATUS.md`
- Existing commerce spec: `docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md`
