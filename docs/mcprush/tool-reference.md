# CoreGuard Agent Commerce — MCP tool reference

Paste-ready reference for the MCP directory listing. Package `@coreguard/agent-commerce@0.1.5`, server `io.github.EslaM-X/coreguard-agent-commerce`, transport **stdio**, protocol `2025-06-18`.

Generated from `initialize` + `tools/list` against `packages/agent-commerce/mcp.mjs`. Every example arguments block below was executed against that server when this page was built; the shown result is the real response (long consent payloads abridged where marked).

**Boundary:** this is an offline, deterministic verification engine. `VERIFIED` means the executed bytes matched the approved bytes — it is not a safety, fraud or settlement guarantee, and no payment, chain or provider is contacted.

## Tools (26)

| Tool | Required | Optional | Purpose |
|---|---|---|---|
| [`coreguard_assess_risk`](#coreguard_assess_risk) | `intent`, `policy`, `trace` | `consumed`, `callerContext` | Classify one executed order against one approved authorization with the deterministic AGR/1 taxonomy. Not a… |
| [`coreguard_audit_transaction`](#coreguard_audit_transaction) | `storePath` | `txRef`, `approvalId`, `agentId`, `limit`, `callerContext` | CGCP/1 mapping: read and optionally filter the append-only hash-chained audit report from a file-backed control… |
| [`coreguard_authorize`](#coreguard_authorize) | `intent`, `policy`, `declaredTrace`, `nowSeconds` | `callerContext` | Bind a user's approval as a CoreGuard Consent Receipt (CGCR/1): the exact approved order bytes (intent + policy +… |
| [`coreguard_authorize_x402_payment`](#coreguard_authorize_x402_payment) | `challenge`, `policy` | `selectedIndex`, `callerContext` | Evaluate an x402 challenge against a local policy and produce an authorization decision. No custody, no broadcast,… |
| [`coreguard_build_attestation`](#coreguard_build_attestation) | `consent`, `executedTrace`, `adapterId`, `nowSeconds` | `callerContext` | Build a CGXA/1 offline execution attestation from a consent record and executed trace. No broadcast; no… |
| [`coreguard_check_limits`](#coreguard_check_limits) | `storePath`, `agentId` | `policyId`, `merchant`, `address`, `amountMinor`, `currency`, `approvalId`, `callerContext` | CGCP/1 mapping: evaluate policy/limit decision for an agent request in a file-backed control plane. No funds moved… |
| [`coreguard_consumption_status`](#coreguard_consumption_status) | `receiptId` | `action`, `storePath`, `callerContext` | Check/consume/release a receiptId in a consumption ledger. Default is process-local (this MCP process only). If… |
| [`coreguard_create_intent`](#coreguard_create_intent) | `storePath`, `agentId` | `intentId`, `policyId`, `merchant`, `address`, `amountMinor`, `currency`, `requestedBy`, `expiresAt`, `callerContext` | CGCP/1 mapping: create an intent/approval request in a self-hosted file-backed control plane. Not a blockchain… |
| [`coreguard_create_machine_task`](#coreguard_create_machine_task) | `taskId`, `machineId`, `terms` | `callerContext` | Create a deterministic machine task record with terms/price/SLA conditions. No payment custody or physical execution… |
| [`coreguard_decide_outcome`](#coreguard_decide_outcome) | `report` | `receiptId`, `callerContext` | Map a verification report to CG-OUT/1 outcome and authorization decision. ABSENT/NOT_CHECKED never render as BLOCK;… |
| [`coreguard_inspect_identity`](#coreguard_inspect_identity) | `issuer`, `scope`, `subject`, `contentDigest` | `anchor`, `other`, `callerContext` | Inspect CG-ID/1 identity split: recordId (who) vs contentDigest (what), with optional anchor facts and optional… |
| [`coreguard_issue_receipt`](#coreguard_issue_receipt) | `storePath`, `agentId` | `receiptId`, `policyId`, `approvalId`, `merchant`, `address`, `amountMinor`, `currency`, `status`, `txRef`, `metadata`, `callerContext` | CGCP/1 mapping: record an execution receipt in a self-hosted file-backed control plane. This is a local execution… |
| [`coreguard_meter_agent_usage`](#coreguard_meter_agent_usage) | `agentId`, `events` | `currency`, `callerContext` | Deterministically meter agent usage/cost events into an auditable total. No billing custody or external payment. |
| [`coreguard_parse_x402_challenge`](#coreguard_parse_x402_challenge) | `challenge` | `callerContext` | Parse and normalize an x402 payment challenge (HTTP 402 accepts). Offline deterministic validation only; no network… |
| [`coreguard_profile_reference`](#coreguard_profile_reference) | `action` | `receiptId`, `reference`, `callerContext` | Create or parse a CG-OUT/1 profile reference. action='make' requires receiptId; action='parse' requires reference. |
| [`coreguard_reconcile_payment`](#coreguard_reconcile_payment) | `authorization` | `challenge`, `settlement`, `receipt`, `callerContext` | Reconcile authorization, settlement evidence, and receipt. Deterministic evidence check only; no external… |
| [`coreguard_register_machine`](#coreguard_register_machine) | `machineId`, `manifest` | `owner`, `callerContext` | Create a local machine registration record from a manifest. No external device attestation/TPM trust root… |
| [`coreguard_revoke_consent`](#coreguard_revoke_consent) | `storePath`, `targetType`, `targetId` | `reason`, `decidedBy`, `callerContext` | CGCP/1 mapping: revoke an approval, agent, or policy in a file-backed control plane. Local single-host revocation;… |
| [`coreguard_verify_attestation`](#coreguard_verify_attestation) | `attestation`, `attestationId`, `consent`, `executedTrace` | `callerContext` | Verify a CGXA/1 attestation against its consent and executed trace. Offline, fail-closed; no chain/network contact. |
| [`coreguard_verify_consent`](#coreguard_verify_consent) | `consent` | `callerContext` | Verify a consent record's integrity and binding: recompute every commitment against the record's own approved bytes.… |
| [`coreguard_verify_delegation_chain`](#coreguard_verify_delegation_chain) | `chain` | `trust`, `callerContext` | Verify delegation chain structure/continuity and optionally verify Ed25519 signatures when trust roots/public keys… |
| [`coreguard_verify_execution`](#coreguard_verify_execution) | `consent`, `trace` | `callerContext` | Verify an executed order against a consent record, fail-closed: exact execution -> VERIFIED; any drift -> INVALID… |
| [`coreguard_verify_receipt`](#coreguard_verify_receipt) | `storePath` | `receiptId`, `callerContext` | CGCP/1 mapping: verify a receipt record and the audit chain in a file-backed control plane. No external… |
| [`coreguard_verify_task_completion`](#coreguard_verify_task_completion) | `task`, `completion` | `telemetryVerification`, `callerContext` | Verify task completion evidence against task record. Evidence acceptance is not physical-world proof; independent… |
| [`coreguard_verify_telemetry`](#coreguard_verify_telemetry) | `taskId`, `telemetry` | `trust`, `callerContext` | Verify caller-supplied telemetry evidence structure/digest and optionally verify Ed25519 signature when trust… |
| [`coreguard_verify_x402_settlement`](#coreguard_verify_x402_settlement) | `challenge`, `settlement` | `callerContext` | Verify caller-supplied x402 settlement evidence against a challenge. No network confirmation performed;… |

---

### `coreguard_assess_risk`

Classify one executed order against one approved authorization with the deterministic AGR/1 taxonomy. Not a probabilistic fraud score; VERIFIED ≠ SAFE.

**Required:** `intent`, `policy`, `trace` · **Optional:** `consumed`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `intent` | `object` | **required** | — | the approved order |
| `policy` | `object` | **required** | — | the committed policy |
| `trace` | `object` | **required** | — | the executed order payload |
| `consumed` | `boolean` | optional | `false` | whether this authorization was already consumed |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "intent": {
      "type": "object",
      "description": "the approved order"
    },
    "policy": {
      "type": "object",
      "description": "the committed policy"
    },
    "trace": {
      "type": "object",
      "description": "the executed order payload"
    },
    "consumed": {
      "type": "boolean",
      "description": "whether this authorization was already consumed",
      "default": false
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "intent",
    "policy",
    "trace"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "intent": {
    "version": "CGEP/1",
    "chainId": "0",
    "signer": "0x000000000000000000000000000000000000000d",
    "nonce": "0",
    "validAfter": "0",
    "validUntil": "9999999999",
    "action": "AGENT_CHECKOUT",
    "target": "0x0000000000000000000000000000000000000042",
    "selector": "0xa9059cbb",
    "asset": "0x0000000000000000000000000000000000000002",
    "amount": "47000",
    "recipient": "0x0000000000000000000000000000000000000042",
    "constraints": [
      {
        "type": "MAX_VALUE",
        "value": "47000"
      },
      {
        "type": "RECIPIENT_ALLOWLIST",
        "addresses": [
          "0x0000000000000000000000000000000000000042"
        ]
      }
    ],
    "merchantName": "synthetic-store.example",
    "currency": "USD",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
    "authorizedAtUtc": "2026-11-14T12:00:00Z",
    "expiryUtc": "2026-11-14T12:10:00Z",
    "singleUse": true
  },
  "policy": {
    "version": "CGEP/1",
    "policyId": "0x00000000000000000000000000000000000000ac",
    "name": "Agent Commerce Policy",
    "rules": [
      {
        "ruleId": "VALUE_001",
        "type": "VALUE_LIMIT",
        "params": {
          "max": "47000"
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "TARGET_001",
        "type": "TARGET_ALLOWLIST",
        "params": {
          "targets": [
            "0x0000000000000000000000000000000000000042"
          ]
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "RECIPIENT_001",
        "type": "RECIPIENT_ALLOWLIST",
        "params": {
          "addresses": [
            "0x0000000000000000000000000000000000000042"
          ]
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "SELECTOR_001",
        "type": "SELECTOR_ALLOWLIST",
        "params": {
          "selectors": [
            "0xa9059cbb"
          ]
        },
        "severity": "CRITICAL"
      }
    ]
  },
  "trace": {
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": 65337,
    "blockTimestamp": "1794657600",
    "from": "0x000000000000000000000000000000000000000d",
    "to": "0x0000000000000000000000000000000000000042",
    "value": "47000",
    "calldata": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000b798",
    "slippageBps": "0",
    "gasUsed": "21000",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)"
  },
  "consumed": false
}
```

**Result of that exact call:**

```json
{
  "spec": "AGR/1",
  "classification": "CLEAN",
  "violations": [],
  "boundary": "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE"
}
```

### `coreguard_audit_transaction`

CGCP/1 mapping: read and optionally filter the append-only hash-chained audit report from a file-backed control plane. No external audit/audit anchoring.

**Required:** `storePath` · **Optional:** `txRef`, `approvalId`, `agentId`, `limit`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `txRef` | `string` | optional | — |  |
| `approvalId` | `string` | optional | — |  |
| `agentId` | `string` | optional | — |  |
| `limit` | `integer` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "txRef": {
      "type": "string"
    },
    "approvalId": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "limit": {
      "type": "integer",
      "minimum": 1
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "agentId": "agent-0001",
  "limit": 20
}
```

**Stable fields of that exact call** (the tool was executed; the raw result is the full audit report: every record, every audit entry and its `headHash`, all stamped at call time):

```json
{
  "type": "cgcp_audit_report",
  "spec": "CGCP/1",
  "report": {
    "version": "CGCP/1",
    "schema": "coreguard.control-plane/1",
    "counts": {
      "agents": 1,
      "policies": 1,
      "policyVersions": 1,
      "approvals": 1,
      "executions": 1,
      "verifications": 0,
      "revocations": 0,
      "audit": 6
    },
    "chain": {
      "ok": true,
      "length": 6,
      "brokenAt": null
    }
  },
  "mapping": "coreguard_audit_transaction -> CGCP auditReport/filter"
}
```

### `coreguard_authorize`

Bind a user's approval as a CoreGuard Consent Receipt (CGCR/1): the exact approved order bytes (intent + policy + declared submit payload) committed as an independently re-derivable receipt. nowSeconds must be a pinned unix-seconds string.

**Required:** `intent`, `policy`, `declaredTrace`, `nowSeconds` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `intent` | `object` | **required** | — | CGEP/1 intent (the approved order, incl. merchant/items/total/credentialRef/window) |
| `policy` | `object` | **required** | — | CGEP/1 policy (value limit + target/recipient/selector allowlists) |
| `declaredTrace` | `object` | **required** | — | the exact submit-order payload the approval covers |
| `nowSeconds` | `string` | **required** | — | pinned approval epoch (unix seconds) — never the wall clock |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "intent": {
      "type": "object",
      "description": "CGEP/1 intent (the approved order, incl. merchant/items/total/credentialRef/window)"
    },
    "policy": {
      "type": "object",
      "description": "CGEP/1 policy (value limit + target/recipient/selector allowlists)"
    },
    "declaredTrace": {
      "type": "object",
      "description": "the exact submit-order payload the approval covers"
    },
    "nowSeconds": {
      "type": "string",
      "description": "pinned approval epoch (unix seconds) — never the wall clock",
      "pattern": "^[0-9]+$"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "intent",
    "policy",
    "declaredTrace",
    "nowSeconds"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "intent": {
    "version": "CGEP/1",
    "chainId": "0",
    "signer": "0x000000000000000000000000000000000000000d",
    "nonce": "0",
    "validAfter": "0",
    "validUntil": "9999999999",
    "action": "AGENT_CHECKOUT",
    "target": "0x0000000000000000000000000000000000000042",
    "selector": "0xa9059cbb",
    "asset": "0x0000000000000000000000000000000000000002",
    "amount": "47000",
    "recipient": "0x0000000000000000000000000000000000000042",
    "constraints": [
      {
        "type": "MAX_VALUE",
        "value": "47000"
      },
      {
        "type": "RECIPIENT_ALLOWLIST",
        "addresses": [
          "0x0000000000000000000000000000000000000042"
        ]
      }
    ],
    "merchantName": "synthetic-store.example",
    "currency": "USD",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)",
    "authorizedAtUtc": "2026-11-14T12:00:00Z",
    "expiryUtc": "2026-11-14T12:10:00Z",
    "singleUse": true
  },
  "policy": {
    "version": "CGEP/1",
    "policyId": "0x00000000000000000000000000000000000000ac",
    "name": "Agent Commerce Policy",
    "rules": [
      {
        "ruleId": "VALUE_001",
        "type": "VALUE_LIMIT",
        "params": {
          "max": "47000"
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "TARGET_001",
        "type": "TARGET_ALLOWLIST",
        "params": {
          "targets": [
            "0x0000000000000000000000000000000000000042"
          ]
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "RECIPIENT_001",
        "type": "RECIPIENT_ALLOWLIST",
        "params": {
          "addresses": [
            "0x0000000000000000000000000000000000000042"
          ]
        },
        "severity": "CRITICAL"
      },
      {
        "ruleId": "SELECTOR_001",
        "type": "SELECTOR_ALLOWLIST",
        "params": {
          "selectors": [
            "0xa9059cbb"
          ]
        },
        "severity": "CRITICAL"
      }
    ]
  },
  "declaredTrace": {
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": 65337,
    "blockTimestamp": "1794657600",
    "from": "0x000000000000000000000000000000000000000d",
    "to": "0x0000000000000000000000000000000000000042",
    "value": "47000",
    "calldata": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000b798",
    "slippageBps": "0",
    "gasUsed": "21000",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)"
  },
  "nowSeconds": "1794657600"
}
```

**Result of that exact call:**

```json
{
  "spec": "CGCR/1",
  "sdkVersion": "AC-SDK/1",
  "receipt": {
    "version": "CGEP/1",
    "chainId": "0",
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": "65337",
    "intentHash": "0xa369fe320981a760d60459843831cd8544f6858776d7f7649e23447ba449d036",
    "policyHash": "0x50c26b0dc90c5b285c6e36026343cabcd39ae8116184bfbe33002a690e53a53a",
    "executionTraceHash": "0x3b118bdd33154c736f2bc33e3ff3bf9eb6193a58536ecdd14ad5c5d08f347e3b",
    "stateDeltaHash": "0x92a483f2a811418bd74b7528982d73ba3f720824911877025569b6511ba09b37",
    "evidenceRoot": "0x908f123fb62af126e683d99aa331a397a8c1cbbf940e3116fa74da34fccbe262",
    "simulation": {
      "blockNumber": "65337",
      "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    },
    "execution": {
      "blockNumber": "65337",
      "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    },
    "verifierVersion": "0.1.0",
    "verificationLevel": "L2",
    "result": "VALID",
    "timestamp": "<unix-seconds at call time>",
    "checks": [],
    "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e"
  },
  "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
  "intent": {
    "version": "CGEP/1",
    "chainId": "0",
    "signer": "0x000000000000000000000000000000000000000d",
    "nonce": "0",
    "validAfter": "0",
    "validUntil": "9999999999",
    "action": "AGENT_CHECKOUT",
    "target": "0x0000000000000000000000000000000000000042",
    "selector": "0xa9059cbb",
    "asset": "0x0000000000000000000000000000000000000002",
    "amount": "47000",
    "recipient": "0x0000
… (abridged — full object is returned by the server)
```

<sub>Call-time clock fields (1) are shown as placeholders; they are read by the tool, not committed by it.</sub>

### `coreguard_authorize_x402_payment`

Evaluate an x402 challenge against a local policy and produce an authorization decision. No custody, no broadcast, no payment execution.

**Required:** `challenge`, `policy` · **Optional:** `selectedIndex`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `challenge` | `object` | **required** | — |  |
| `policy` | `object` | **required** | — | policy: maxAmount, allowedNetworks, allowedAssets, allowedPayTo |
| `selectedIndex` | `integer` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "challenge": {
      "type": "object"
    },
    "policy": {
      "type": "object",
      "description": "policy: maxAmount, allowedNetworks, allowedAssets, allowedPayTo"
    },
    "selectedIndex": {
      "type": "integer",
      "minimum": 0
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "challenge",
    "policy"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "challenge": {
    "accepts": [
      {
        "scheme": "exact",
        "network": "base",
        "asset": "USDC",
        "amount": "100",
        "payTo": "0xabc"
      }
    ]
  },
  "policy": {
    "maxAmount": "100",
    "allowedNetworks": [
      "base"
    ],
    "allowedAssets": [
      "USDC"
    ],
    "allowedPayTo": [
      "0xabc"
    ]
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "x402_authorization",
  "verdict": "AUTHORIZED",
  "issues": [],
  "selectedIndex": 0,
  "selected": {
    "scheme": "exact",
    "network": "base",
    "asset": "USDC",
    "amount": "100",
    "payTo": "0xabc",
    "resource": null
  },
  "challengeDigest": "5938fa55c4987269e3f7419a54771785424cae5f897a0e4d7d5fec38d23df326",
  "policyDigest": "65b99bcdc73303b62248408d5a84a335b39fae2a4d5218ab70511131f54bbf7e",
  "authorizationId": "021c9338da4c286f33a659c90bc8656b49b4470e260b1bf48ff0d852a89bcad8",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. No payment executed; authorization is a policy decision only."
}
```

### `coreguard_build_attestation`

Build a CGXA/1 offline execution attestation from a consent record and executed trace. No broadcast; no chain/network contact. nowSeconds must be pinned.

**Required:** `consent`, `executedTrace`, `adapterId`, `nowSeconds` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `consent` | `object` | **required** | — | CGCR/1 consent record |
| `executedTrace` | `object` | **required** | — | executed trace observed by caller |
| `adapterId` | `string` | **required** | — | CGXA adapter id |
| `nowSeconds` | `integer` \| `string` | **required** | — | pinned approval epoch (unix seconds) as non-negative integer or digit string — never wall clock |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "consent": {
      "type": "object",
      "description": "CGCR/1 consent record"
    },
    "executedTrace": {
      "type": "object",
      "description": "executed trace observed by caller"
    },
    "adapterId": {
      "type": "string",
      "description": "CGXA adapter id"
    },
    "nowSeconds": {
      "description": "pinned approval epoch (unix seconds) as non-negative integer or digit string — never wall clock",
      "oneOf": [
        {
          "type": "integer",
          "minimum": 0
        },
        {
          "type": "string",
          "pattern": "^[0-9]+$"
        }
      ]
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "consent",
    "executedTrace",
    "adapterId",
    "nowSeconds"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "consent": {
    "$ref": "CGCR/1 consent object returned by coreguard_authorize"
  },
  "executedTrace": {
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": 65337,
    "blockTimestamp": "1794657600",
    "from": "0x000000000000000000000000000000000000000d",
    "to": "0x0000000000000000000000000000000000000042",
    "value": "47000",
    "calldata": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000b798",
    "slippageBps": "0",
    "gasUsed": "21000",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)"
  },
  "adapterId": "stellar-anchor",
  "nowSeconds": "1794657600"
}
```

**Result of that exact call:**

```json
{
  "spec": "CGXA/1",
  "attestation": {
    "v": "CGXA/1",
    "consentReceiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
    "executedCommitment": "0x3b118bdd33154c736f2bc33e3ff3bf9eb6193a58536ecdd14ad5c5d08f347e3b",
    "adapter": {
      "id": "stellar-anchor",
      "network": "stellar-mainnet"
    },
    "chainBinding": {
      "anchorContract": "CCKA2GYVILX7YZVSXGVIHOPNLTRBBF2SSWKBTQBIE7M67N5N2QMMXPSP"
    },
    "verificationLevel": "COMMITTED_EVIDENCE",
    "issuedAtSeconds": 1794657600
  },
  "attestationId": "0xbfae4088c95871d639566d8c2506aacd4eb9e13da5ac8f5e654c2eefdc9f9ab0"
}
```

### `coreguard_check_limits`

CGCP/1 mapping: evaluate policy/limit decision for an agent request in a file-backed control plane. No funds moved and no external IdP/KMS involved.

**Required:** `storePath`, `agentId` · **Optional:** `policyId`, `merchant`, `address`, `amountMinor`, `currency`, `approvalId`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `agentId` | `string` | **required** | — |  |
| `policyId` | `string` | optional | — |  |
| `merchant` | `string` | optional | — |  |
| `address` | `string` | optional | — |  |
| `amountMinor` | `string` | optional | — |  |
| `currency` | `string` | optional | — |  |
| `approvalId` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "policyId": {
      "type": "string"
    },
    "merchant": {
      "type": "string"
    },
    "address": {
      "type": "string"
    },
    "amountMinor": {
      "type": "string"
    },
    "currency": {
      "type": "string"
    },
    "approvalId": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath",
    "agentId"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "agentId": "agent-0001",
  "policyId": "policy-01",
  "merchant": "synthetic-store.example",
  "amountMinor": "47000",
  "currency": "USD",
  "approvalId": "intent-0001"
}
```

**Stable fields of that exact call** (the tool was executed; the raw result also carries the per-check detail and a call-time `at` stamp):

```json
{
  "type": "cgcp_limit_check",
  "spec": "CGCP/1",
  "decision": {
    "version": "CGCP/1",
    "allowed": true,
    "reasons": [],
    "agentId": "agent-0001",
    "policyId": "policy-01",
    "policyVersion": 1,
    "merchant": "synthetic-store.example",
    "amountMinor": "47000",
    "currency": "USD"
  },
  "mapping": "coreguard_check_limits -> CGCP evaluate (policy/limit decision)"
}
```

### `coreguard_consumption_status`

Check/consume/release a receiptId in a consumption ledger. Default is process-local (this MCP process only). If storePath is supplied (or COREGUARD_CONSUMPTION_STORE is set), uses the AC-CS/1 lock-guarded file store, which is atomic across processes on the same host. Cross-host reconciliation is CG-SPEND/1 merge; on-chain anchoring is NOT_BUILT.

**Required:** `receiptId` · **Optional:** `action`, `storePath`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `receiptId` | `string` | **required** | — | receipt/consent identifier key |
| `action` | `check` \| `consume` \| `release` | optional | `"check"` | check, consume, or release |
| `storePath` | `string` | optional | — | optional AC-CS/1 file-backed store path for same-host cross-process consumption (default: COREGUARD_CONSUMPTION_STORE) |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "receiptId": {
      "type": "string",
      "description": "receipt/consent identifier key"
    },
    "action": {
      "type": "string",
      "enum": [
        "check",
        "consume",
        "release"
      ],
      "description": "check, consume, or release",
      "default": "check"
    },
    "storePath": {
      "type": "string",
      "description": "optional AC-CS/1 file-backed store path for same-host cross-process consumption (default: COREGUARD_CONSUMPTION_STORE)"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "receiptId"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
  "action": "check"
}
```

**Result of that exact call:**

```json
{
  "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
  "action": "check",
  "consumed": true,
  "ledger": "process-local",
  "boundary": "process-local only; set storePath or COREGUARD_CONSUMPTION_STORE for the AC-CS/1 file ledger (cross-process on this host); cross-host sync is CG-SPEND/1 merge; on-chain anchoring NOT_BUILT"
}
```

### `coreguard_create_intent`

CGCP/1 mapping: create an intent/approval request in a self-hosted file-backed control plane. Not a blockchain receipt and not payment execution.

**Required:** `storePath`, `agentId` · **Optional:** `intentId`, `policyId`, `merchant`, `address`, `amountMinor`, `currency`, `requestedBy`, `expiresAt`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `intentId` | `string` | optional | — |  |
| `agentId` | `string` | **required** | — |  |
| `policyId` | `string` | optional | — |  |
| `merchant` | `string` | optional | — |  |
| `address` | `string` | optional | — |  |
| `amountMinor` | `string` | optional | — |  |
| `currency` | `string` | optional | — |  |
| `requestedBy` | `string` | optional | — |  |
| `expiresAt` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "intentId": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "policyId": {
      "type": "string"
    },
    "merchant": {
      "type": "string"
    },
    "address": {
      "type": "string"
    },
    "amountMinor": {
      "type": "string"
    },
    "currency": {
      "type": "string"
    },
    "requestedBy": {
      "type": "string"
    },
    "expiresAt": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath",
    "agentId"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "intentId": "intent-0001",
  "agentId": "agent-0001",
  "policyId": "policy-01",
  "merchant": "synthetic-store.example",
  "amountMinor": "47000",
  "currency": "USD",
  "requestedBy": "owner@example"
}
```

**Stable fields of that exact call** (the tool was executed; the raw result also carries `requestedAt` / `expiresAt` / `hash`, stamped and chained at call time):

```json
{
  "type": "cgcp_intent",
  "spec": "CGCP/1",
  "intent": {
    "id": "intent-0001",
    "agentId": "agent-0001",
    "policyId": "policy-01",
    "merchant": "synthetic-store.example",
    "amountMinor": "47000",
    "currency": "USD",
    "status": "pending",
    "requestedBy": "owner@example"
  },
  "mapping": "coreguard_create_intent -> CGCP requestApproval (intent/approval request)"
}
```

### `coreguard_create_machine_task`

Create a deterministic machine task record with terms/price/SLA conditions. No payment custody or physical execution guarantee.

**Required:** `taskId`, `machineId`, `terms` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `taskId` | `string` | **required** | — |  |
| `machineId` | `string` | **required** | — |  |
| `terms` | `object` | **required** | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string"
    },
    "machineId": {
      "type": "string"
    },
    "terms": {
      "type": "object"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "taskId",
    "machineId",
    "terms"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "taskId": "task-0001",
  "machineId": "machine-0001",
  "terms": {
    "price": "500",
    "currency": "USD",
    "sla": "30m"
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "machine_task",
  "verdict": "CREATED",
  "taskId": "task-0001",
  "machineId": "machine-0001",
  "termsDigest": "1b77fe47a9c8bbbf17923ec7b7bf90a33df040540beb1165c5c1e6d118e4a4fd",
  "price": "500",
  "currency": "USD",
  "taskDigest": "7c8827e0e2086576d7d5d40eddca6203a090f29246c15836128159ba35eec2ea",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE."
}
```

### `coreguard_decide_outcome`

Map a verification report to CG-OUT/1 outcome and authorization decision. ABSENT/NOT_CHECKED never render as BLOCK; VERIFIED ≠ SAFE.

**Required:** `report` · **Optional:** `receiptId`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `report` | `object` | **required** | — | verification report or bridge-compatible report object |
| `receiptId` | `string` | optional | — | optional receipt id for profile reference |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "report": {
      "type": "object",
      "description": "verification report or bridge-compatible report object"
    },
    "receiptId": {
      "type": "string",
      "description": "optional receipt id for profile reference"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "report"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "report": {
    "$ref": "verification report returned by coreguard_verify_execution"
  }
}
```

**Result of that exact call:**

```json
{
  "outcome": {
    "outcome": "ABSENT",
    "code": "ABSENT",
    "reason": "no record was presented — silence is not a failed verification",
    "layers": {
      "record": {
        "evaluated": false,
        "ok": null,
        "code": null
      },
      "anchor": {
        "evaluated": false
      }
    },
    "blocks": false,
    "outcomeVersion": "CG-OUT/1",
    "detail": null
  },
  "decision": {
    "decision": "NONE",
    "reason": "no record was presented — nothing to decide on"
  }
}
```

### `coreguard_inspect_identity`

Inspect CG-ID/1 identity split: recordId (who) vs contentDigest (what), with optional anchor facts and optional comparison to another identity. Offline and deterministic.

**Required:** `issuer`, `scope`, `subject`, `contentDigest` · **Optional:** `anchor`, `other`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `issuer` | `string` | **required** | — | identity issuer |
| `scope` | `string` | **required** | — | identity scope |
| `subject` | `string` | **required** | — | identity subject |
| `contentDigest` | `string` | **required** | — | content digest as 64-char lowercase hex (no 0x prefix) |
| `anchor` | `object` | optional | — | optional anchor reference |
| `other` | `object` | optional | — | optional other identity for comparison |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "issuer": {
      "type": "string",
      "description": "identity issuer"
    },
    "scope": {
      "type": "string",
      "description": "identity scope"
    },
    "subject": {
      "type": "string",
      "description": "identity subject"
    },
    "contentDigest": {
      "type": "string",
      "description": "content digest as 64-char lowercase hex (no 0x prefix)"
    },
    "anchor": {
      "type": "object",
      "description": "optional anchor reference"
    },
    "other": {
      "type": "object",
      "description": "optional other identity for comparison"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "issuer",
    "scope",
    "subject",
    "contentDigest"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "issuer": "did:example:issuer",
  "scope": "agent-commerce",
  "subject": "did:example:agent-0001",
  "contentDigest": "abababababababababababababababababababababababababababababababab",
  "anchor": {
    "kind": "chain",
    "locator": "eip155:0:block:65337"
  }
}
```

**Result of that exact call:**

```json
{
  "identity": {
    "identityVersion": "CG-ID/1",
    "schema": "coreguard.identity/1",
    "recordId": "7ca1fc5b808f1becf3a332a20c1760efaa5c0b97c4fa5181d2b720faff3b3f42",
    "contentDigest": "abababababababababababababababababababababababababababababababab",
    "anchorRef": {
      "kind": "chain",
      "locator": "eip155:0:block:65337"
    }
  },
  "anchorFacts": {
    "present": true,
    "evaluated": false,
    "outcome": "not_checked"
  }
}
```

### `coreguard_issue_receipt`

CGCP/1 mapping: record an execution receipt in a self-hosted file-backed control plane. This is a local execution record, not an on-chain proof or external payment receipt.

**Required:** `storePath`, `agentId` · **Optional:** `receiptId`, `policyId`, `approvalId`, `merchant`, `address`, `amountMinor`, `currency`, `status`, `txRef`, `metadata`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `receiptId` | `string` | optional | — |  |
| `agentId` | `string` | **required** | — |  |
| `policyId` | `string` | optional | — |  |
| `approvalId` | `string` | optional | — |  |
| `merchant` | `string` | optional | — |  |
| `address` | `string` | optional | — |  |
| `amountMinor` | `string` | optional | — |  |
| `currency` | `string` | optional | — |  |
| `status` | `string` | optional | — |  |
| `txRef` | `string` | optional | — |  |
| `metadata` | `object` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "receiptId": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "policyId": {
      "type": "string"
    },
    "approvalId": {
      "type": "string"
    },
    "merchant": {
      "type": "string"
    },
    "address": {
      "type": "string"
    },
    "amountMinor": {
      "type": "string"
    },
    "currency": {
      "type": "string"
    },
    "status": {
      "type": "string"
    },
    "txRef": {
      "type": "string"
    },
    "metadata": {
      "type": "object"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath",
    "agentId"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "receiptId": "receipt-0001",
  "agentId": "agent-0001",
  "policyId": "policy-01",
  "approvalId": "intent-0001",
  "merchant": "synthetic-store.example",
  "amountMinor": "47000",
  "currency": "USD",
  "status": "executed",
  "txRef": "0xexample"
}
```

**Stable fields of that exact call** (the tool was executed; the raw result also carries `at` / `hash`, stamped and chained at call time):

```json
{
  "type": "cgcp_receipt",
  "spec": "CGCP/1",
  "receipt": {
    "id": "receipt-0001",
    "agentId": "agent-0001",
    "policyId": "policy-01",
    "approvalId": "intent-0001",
    "merchant": "synthetic-store.example",
    "amountMinor": "47000",
    "currency": "USD",
    "status": "executed",
    "txRef": "0xexample"
  },
  "mapping": "coreguard_issue_receipt -> CGCP recordExecution (execution receipt record)"
}
```

### `coreguard_meter_agent_usage`

Deterministically meter agent usage/cost events into an auditable total. No billing custody or external payment.

**Required:** `agentId`, `events` · **Optional:** `currency`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `agentId` | `string` | **required** | — |  |
| `events` | array of `object` | **required** | — |  |
| `currency` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string"
    },
    "events": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "currency": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "agentId",
    "events"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "agentId": "agent-0001",
  "currency": "USD",
  "events": [
    {
      "amount": "10"
    },
    {
      "amount": "25",
      "resource": "tool"
    }
  ]
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "agent_usage_meter",
  "agentId": "agent-0001",
  "eventCount": 2,
  "totalAmount": "35",
  "currency": "USD",
  "eventsDigest": "7002ca18f1ae4fa75200df57590dc983b011f267f8c147e39468b9cb5b254f0f",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE."
}
```

### `coreguard_parse_x402_challenge`

Parse and normalize an x402 payment challenge (HTTP 402 accepts). Offline deterministic validation only; no network contact, no payment execution.

**Required:** `challenge` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `challenge` | `object` | **required** | — | x402 challenge/402 body with accepts[] |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "challenge": {
      "type": "object",
      "description": "x402 challenge/402 body with accepts[]"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "challenge"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "challenge": {
    "accepts": [
      {
        "scheme": "exact",
        "network": "base",
        "asset": "USDC",
        "amount": "100",
        "payTo": "0xabc"
      }
    ]
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "x402_challenge",
  "verdict": "PARSED",
  "issues": [],
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "asset": "USDC",
      "amount": "100",
      "payTo": "0xabc",
      "resource": null
    }
  ],
  "challengeDigest": "5938fa55c4987269e3f7419a54771785424cae5f897a0e4d7d5fec38d23df326",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE."
}
```

### `coreguard_profile_reference`

Create or parse a CG-OUT/1 profile reference. action='make' requires receiptId; action='parse' requires reference.

**Required:** `action` · **Optional:** `receiptId`, `reference`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `action` | `make` \| `parse` | **required** | — | make or parse |
| `receiptId` | `string` | optional | — | receipt id for action=make |
| `reference` | any | optional | — | profile reference object/string for action=parse |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": [
        "make",
        "parse"
      ],
      "description": "make or parse"
    },
    "receiptId": {
      "type": "string",
      "description": "receipt id for action=make"
    },
    "reference": {
      "description": "profile reference object/string for action=parse"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "action"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "action": "make",
  "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e"
}
```

**Result of that exact call:**

```json
{
  "action": "make",
  "profileReference": {
    "receipt_id": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
    "profile": "CG-OUT/1",
    "profile_version": 1
  }
}
```

### `coreguard_reconcile_payment`

Reconcile authorization, settlement evidence, and receipt. Deterministic evidence check only; no external ledger/custody.

**Required:** `authorization` · **Optional:** `challenge`, `settlement`, `receipt`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `authorization` | `object` | **required** | — |  |
| `challenge` | `object` | optional | — |  |
| `settlement` | `object` | optional | — |  |
| `receipt` | `object` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "authorization": {
      "type": "object"
    },
    "challenge": {
      "type": "object"
    },
    "settlement": {
      "type": "object"
    },
    "receipt": {
      "type": "object"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "authorization"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "authorization": {
    "$ref": "authorization decision returned by coreguard_authorize_x402_payment"
  },
  "challenge": {
    "accepts": [
      {
        "scheme": "exact",
        "network": "base",
        "asset": "USDC",
        "amount": "100",
        "payTo": "0xabc"
      }
    ]
  },
  "settlement": {
    "network": "base",
    "asset": "USDC",
    "amount": "100",
    "payTo": "0xabc",
    "txRef": "0xexample",
    "status": "confirmed"
  },
  "receipt": {
    "authorizationId": "021c9338da4c286f33a659c90bc8656b49b4470e260b1bf48ff0d852a89bcad8",
    "txRef": "0xexample"
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "payment_reconciliation",
  "verdict": "RECONCILED",
  "issues": [],
  "authorizationId": "021c9338da4c286f33a659c90bc8656b49b4470e260b1bf48ff0d852a89bcad8",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE."
}
```

### `coreguard_register_machine`

Create a local machine registration record from a manifest. No external device attestation/TPM trust root verification performed.

**Required:** `machineId`, `manifest` · **Optional:** `owner`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `machineId` | `string` | **required** | — |  |
| `manifest` | `object` | **required** | — |  |
| `owner` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "machineId": {
      "type": "string"
    },
    "manifest": {
      "type": "object"
    },
    "owner": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "machineId",
    "manifest"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "machineId": "machine-0001",
  "owner": "org-example",
  "manifest": {
    "capabilities": [
      "deliver",
      "scan"
    ],
    "model": "R2"
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "machine_registration",
  "verdict": "REGISTERED_LOCAL",
  "machineId": "machine-0001",
  "owner": "org-example",
  "capabilities": [
    "deliver",
    "scan"
  ],
  "manifestDigest": "6a2c4d835c5445eb16b890f9d732b39e34b92b7cdaa0bc01362ecba151d98b1d",
  "registrationId": "01cca1ebf9aa1015a09bde8e8869d95a59161dc044ea4d7528ffcf5297d3b69d",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. Local registration record only; no external identity attestation performed."
}
```

### `coreguard_revoke_consent`

CGCP/1 mapping: revoke an approval, agent, or policy in a file-backed control plane. Local single-host revocation; no distributed propagation, no external IdP lifecycle.

**Required:** `storePath`, `targetType`, `targetId` · **Optional:** `reason`, `decidedBy`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `targetType` | `approval` \| `agent` \| `policy` | **required** | — |  |
| `targetId` | `string` | **required** | — |  |
| `reason` | `string` | optional | — |  |
| `decidedBy` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "targetType": {
      "type": "string",
      "enum": [
        "approval",
        "agent",
        "policy"
      ]
    },
    "targetId": {
      "type": "string"
    },
    "reason": {
      "type": "string"
    },
    "decidedBy": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath",
    "targetType",
    "targetId"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "targetType": "approval",
  "targetId": "intent-0001",
  "reason": "owner revoked before execution",
  "decidedBy": "owner@example"
}
```

**Stable fields of that exact call** (the tool was executed; the raw result also carries `requestedAt` / `decidedAt` / `hash`, stamped and chained at call time):

```json
{
  "type": "cgcp_revocation",
  "spec": "CGCP/1",
  "targetType": "approval",
  "targetId": "intent-0001",
  "result": {
    "id": "intent-0001",
    "agentId": "agent-0001",
    "status": "rejected",
    "decidedBy": "owner@example",
    "reason": "owner revoked before execution"
  },
  "mapping": "coreguard_revoke_consent -> CGCP revoke/decision mapping"
}
```

### `coreguard_verify_attestation`

Verify a CGXA/1 attestation against its consent and executed trace. Offline, fail-closed; no chain/network contact.

**Required:** `attestation`, `attestationId`, `consent`, `executedTrace` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `attestation` | `object` | **required** | — | CGXA/1 attestation |
| `attestationId` | `string` | **required** | — | attestation identifier |
| `consent` | `object` | **required** | — | CGCR/1 consent record |
| `executedTrace` | `object` | **required** | — | executed trace |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "attestation": {
      "type": "object",
      "description": "CGXA/1 attestation"
    },
    "attestationId": {
      "type": "string",
      "description": "attestation identifier"
    },
    "consent": {
      "type": "object",
      "description": "CGCR/1 consent record"
    },
    "executedTrace": {
      "type": "object",
      "description": "executed trace"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "attestation",
    "attestationId",
    "consent",
    "executedTrace"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "attestation": {
    "$ref": "CGXA/1 attestation object returned by coreguard_build_attestation"
  },
  "attestationId": "0xbfae4088c95871d639566d8c2506aacd4eb9e13da5ac8f5e654c2eefdc9f9ab0",
  "consent": {
    "$ref": "CGCR/1 consent object returned by coreguard_authorize"
  },
  "executedTrace": {
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": 65337,
    "blockTimestamp": "1794657600",
    "from": "0x000000000000000000000000000000000000000d",
    "to": "0x0000000000000000000000000000000000000042",
    "value": "47000",
    "calldata": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000b798",
    "slippageBps": "0",
    "gasUsed": "21000",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)"
  }
}
```

**Result of that exact call:**

```json
{
  "decision": "VERIFIED",
  "code": null,
  "reasons": [],
  "attested": {
    "adapterId": "stellar-anchor",
    "network": "stellar-mainnet",
    "verificationLevel": "COMMITTED_EVIDENCE",
    "source": "docs/EVIDENCE-MATRIX.md"
  },
  "boundary": "attests that this arc's committed chain binding is the record the adapter cites; never bridge trust, never a relay, never delivery conformity (DDE/1); VERIFIED ≠ SAFE"
}
```

### `coreguard_verify_consent`

Verify a consent record's integrity and binding: recompute every commitment against the record's own approved bytes. Any tampered byte fails closed.

**Required:** `consent` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `consent` | `object` | **required** | — | CGCR/1 consent record as returned by coreguard_authorize |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "consent": {
      "type": "object",
      "description": "CGCR/1 consent record as returned by coreguard_authorize"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "consent"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "consent": {
    "$ref": "CGCR/1 consent object returned by coreguard_authorize"
  }
}
```

**Result of that exact call:**

```json
{
  "receiptId": "0x052d018d623a04167614dd15f0b4e7102b9dac85d8da39c460ce73ca9081ac0e",
  "result": "VERIFIED",
  "verdict": "VERIFIED",
  "verdictCode": "RECEIPT_INTEGRITY",
  "verificationLevel": "L2",
  "required": [
    "RECEIPT_COMMITMENT",
    "STATE_PINNING",
    "INTENT_HASH",
    "POLICY_HASH",
    "TRACE_HASH",
    "INTENT_EXECUTION_BINDING"
  ],
  "requiredMissing": [],
  "failing": [],
  "checks": [
    {
      "check": "RECEIPT_COMMITMENT",
      "result": "PASS",
      "detail": "Receipt commitment matches"
    },
    {
      "check": "INTENT_HASH",
      "result": "PASS",
      "detail": "Intent hash matches"
    },
    {
      "check": "POLICY_HASH",
      "result": "PASS",
      "detail": "Policy hash matches"
    },
    {
      "check": "TRACE_HASH",
      "result": "PASS",
      "detail": "Execution trace hash matches"
    },
    {
      "check": "POLICY_EVAL",
      "result": "PASS",
      "detail": "Policy re-evaluation satisfied against observed execution"
    },
    {
      "check": "REPLAY_CONSISTENCY",
      "result": "PASS",
      "detail": "Replay plan coherent (0 frame(s))"
    },
    {
      "check": "INTENT_EXECUTION_BINDING",
      "result": "PASS",
      "detail": "Execution matches committed intent"
    },
    {
      "check": "STATE_PINNING",
      "result": "PASS",
      "detail": "State pinning is consistent"
    }
  ],
  "replay": {
    "digest": "0x0cc8a68b9fb79fad5d6f3a1a8169fc6d5ddf86762587bd9e0a8dfdc11354d8c8",
    "frames": 0
  },
  "verifierVersion": "0.1.0",
  "timestamp": "<unix-seconds at call time>"
}
```

<sub>Call-time clock fields (1) are shown as placeholders; they are read by the tool, not committed by it.</sub>

### `coreguard_verify_delegation_chain`

Verify delegation chain structure/continuity and optionally verify Ed25519 signatures when trust roots/public keys are supplied. Verification proves signatures over supplied payloads, not delegator identity beyond supplied key material.

**Required:** `chain` · **Optional:** `trust`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `chain` | array of `object` | **required** | — |  |
| `trust` | `object` | optional | — | Optional trust roots: { publicKeyPem } or { publicKeys: [{keyId,publicKeyPem}]\|{keyId:pem} } or { keyring } |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "chain": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "trust": {
      "type": "object",
      "description": "Optional trust roots: { publicKeyPem } or { publicKeys: [{keyId,publicKeyPem}]|{keyId:pem} } or { keyring }"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "chain"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "chain": [
    {
      "delegator": "did:example:hq",
      "delegate": "did:example:agent-0001",
      "scope": [
        "pay"
      ],
      "signature": "sig"
    }
  ]
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "delegation_chain_verification",
  "verdict": "CHAIN_STRUCTURALLY_VALID_UNVERIFIED_SIGNATURES",
  "issues": [],
  "depth": 1,
  "signaturesVerified": false,
  "chainDigest": "349bb78084441d395a9b10749c9dca0b3d8ea68ba06f74fb3ed436cef782c46e",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. Cryptographic signature verification is performed only when trust roots/public keys are supplied; verification proves signature over the supplied payload, not delegator identity beyond the supplied key material."
}
```

### `coreguard_verify_execution`

Verify an executed order against a consent record, fail-closed: exact execution -> VERIFIED; any drift -> INVALID with the drifted field named (AGR/1). Single-use consents are consumed by first verified execution (process-local by default; file-backed host store via AC-CS/1 when supplied by caller integration).

**Required:** `consent`, `trace` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `consent` | `object` | **required** | — | CGCR/1 consent record |
| `trace` | `object` | **required** | — | the executed order payload as observed |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "consent": {
      "type": "object",
      "description": "CGCR/1 consent record"
    },
    "trace": {
      "type": "object",
      "description": "the executed order payload as observed"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "consent",
    "trace"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "consent": {
    "$ref": "CGCR/1 consent object returned by coreguard_authorize"
  },
  "trace": {
    "txHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "blockHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "blockNumber": 65337,
    "blockTimestamp": "1794657600",
    "from": "0x000000000000000000000000000000000000000d",
    "to": "0x0000000000000000000000000000000000000042",
    "value": "47000",
    "calldata": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000b798",
    "slippageBps": "0",
    "gasUsed": "21000",
    "items": [
      {
        "sku": "SKU-MCP-T",
        "name": "Synthetic item M",
        "qty": 1,
        "unitPriceMinor": "47000"
      }
    ],
    "paymentCredentialRef": "TOKENIZED-CREDENTIAL-REF-TEST (placeholder)"
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "AC-SDK/1",
  "verdict": "VERIFIED",
  "engineVerdict": "VERIFIED",
  "checks": [
    {
      "check": "RECEIPT_COMMITMENT",
      "result": "PASS",
      "detail": "Receipt commitment matches"
    },
    {
      "check": "INTENT_HASH",
      "result": "PASS",
      "detail": "Intent hash matches"
    },
    {
      "check": "POLICY_HASH",
      "result": "PASS",
      "detail": "Policy hash matches"
    },
    {
      "check": "TRACE_HASH",
      "result": "PASS",
      "detail": "Execution trace hash matches"
    },
    {
      "check": "POLICY_EVAL",
      "result": "PASS",
      "detail": "Policy re-evaluation satisfied against observed execution"
    },
    {
      "check": "REPLAY_CONSISTENCY",
      "result": "PASS",
      "detail": "Replay plan coherent (0 frame(s))"
    },
    {
      "check": "INTENT_EXECUTION_BINDING",
      "result": "PASS",
      "detail": "Execution matches committed intent"
    },
    {
      "check": "STATE_PINNING",
      "result": "PASS",
      "detail": "State pinning is consistent"
    }
  ],
  "risk": {
    "spec": "AGR/1",
    "classification": "CLEAN",
    "violations": [],
    "boundary": "deterministic authorization-drift taxonomy (AGR/1) — never a probabilistic fraud score; VERIFIED ≠ SAFE"
  },
  "driftNamed": [],
  "consumed": true,
  "consumedLedger": "caller-supplied ledger — process-local Set, AC-CS/1 file store (cross-process on this host), or an asynchronous shared store; a global register and on-chain anchoring are NOT_BUILT",
  "boundary": "execution verification never decides delivery conformity (DDE/1); VERIFIED ≠ SAFE; the actor is declared, never detected"
}
```

**Drift variant** — same consent, executed total `57000` instead of `47000`: verdict `INVALID`, classification `VIOLATIONS`.

### `coreguard_verify_receipt`

CGCP/1 mapping: verify a receipt record and the audit chain in a file-backed control plane. No external anchor/witness/on-chain verification is performed.

**Required:** `storePath` · **Optional:** `receiptId`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `storePath` | `string` | **required** | — |  |
| `receiptId` | `string` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "storePath": {
      "type": "string"
    },
    "receiptId": {
      "type": "string"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "storePath"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "storePath": "tmp/mcprush-reference/control-plane.json",
  "receiptId": "receipt-0001"
}
```

**Stable fields of that exact call** (the tool was executed; the raw result also carries the full receipt record and the audit chain's `headHash`, both stamped at call time):

```json
{
  "type": "cgcp_receipt_verification",
  "spec": "CGCP/1",
  "verdict": "VERIFIED",
  "issues": [],
  "receiptId": "receipt-0001",
  "receiptFound": true,
  "auditChain": {
    "ok": true,
    "length": 5,
    "brokenAt": null
  },
  "mapping": "coreguard_verify_receipt -> CGCP audit chain verification + receipt lookup in audit report"
}
```

### `coreguard_verify_task_completion`

Verify task completion evidence against task record. Evidence acceptance is not physical-world proof; independent verification required for high-stakes actions.

**Required:** `task`, `completion` · **Optional:** `telemetryVerification`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `task` | `object` | **required** | — |  |
| `completion` | `object` | **required** | — |  |
| `telemetryVerification` | `object` | optional | — |  |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "task": {
      "type": "object"
    },
    "completion": {
      "type": "object"
    },
    "telemetryVerification": {
      "type": "object"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "task",
    "completion"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server; the `$ref` items are the exact objects returned by the earlier steps — paste those instead of the placeholder):

```json
{
  "task": {
    "$ref": "machine task record returned by coreguard_create_machine_task"
  },
  "completion": {
    "taskId": "task-0001",
    "machineId": "machine-0001",
    "status": "completed",
    "evidence": [
      {
        "type": "photo",
        "ref": "hash://1"
      }
    ]
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "task_completion_verification",
  "verdict": "EVIDENCE_ACCEPTED",
  "issues": [],
  "taskDigest": "7c8827e0e2086576d7d5d40eddca6203a090f29246c15836128159ba35eec2ea",
  "completionDigest": "291ded293a38c5dfe63fc80795a86aa3052b8b960dac988d48bd7cfdbf34a319",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. Evidence acceptance is not physical-world proof. Independent verification/oracle required for high-stakes actions."
}
```

### `coreguard_verify_telemetry`

Verify caller-supplied telemetry evidence structure/digest and optionally verify Ed25519 signature when trust roots/public keys are supplied. Signature trust/physical-world truth not proven beyond supplied key material.

**Required:** `taskId`, `telemetry` · **Optional:** `trust`, `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `taskId` | `string` | **required** | — |  |
| `telemetry` | `object` | **required** | — |  |
| `trust` | `object` | optional | — | Optional trust roots: { publicKeyPem } or { publicKeys: [{keyId,publicKeyPem}]\|{keyId:pem} } or { keyring } |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string"
    },
    "telemetry": {
      "type": "object"
    },
    "trust": {
      "type": "object",
      "description": "Optional trust roots: { publicKeyPem } or { publicKeys: [{keyId,publicKeyPem}]|{keyId:pem} } or { keyring }"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "taskId",
    "telemetry"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "taskId": "task-0001",
  "telemetry": {
    "machineId": "machine-0001",
    "timestamp": 1,
    "readings": [
      {
        "k": "temp",
        "v": 1
      }
    ]
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "telemetry_verification",
  "verdict": "INVALID",
  "issues": [
    "MISSING_SIGNATURE_EVIDENCE"
  ],
  "taskId": "task-0001",
  "machineId": "machine-0001",
  "keyId": null,
  "signatureVerified": false,
  "trustStatus": "NO_TRUST_ROOT",
  "telemetryDigest": "57e5822638431fa59b45ec0c1e63701a450aeaa12a6c6a13991cdde5604f86dc",
  "computedDigest": "416d707ea412b599fdd665a7f1343a814ecbf7d4e669a18f8208e10811ee576f",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. Cryptographic signature verification is performed only when a trust root/public key is supplied; supplied-key verification does NOT prove device identity, key custody, or physical-world truth."
}
```

### `coreguard_verify_x402_settlement`

Verify caller-supplied x402 settlement evidence against a challenge. No network confirmation performed; evidence-only, fail-closed.

**Required:** `challenge`, `settlement` · **Optional:** `callerContext`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `challenge` | `object` | **required** | — |  |
| `settlement` | `object` | **required** | — | caller-supplied settlement evidence (network, asset, amount, payTo, txRef, status) |
| `callerContext` | `object` | optional | — | Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input. |

<details><summary>Input schema (from tools/list)</summary>

```json
{
  "type": "object",
  "properties": {
    "challenge": {
      "type": "object"
    },
    "settlement": {
      "type": "object",
      "description": "caller-supplied settlement evidence (network, asset, amount, payTo, txRef, status)"
    },
    "callerContext": {
      "type": "object",
      "description": "Optional caller-provided trace/context metadata. Echoed in structuredContent.callerContext; never used as a cryptographic input."
    }
  },
  "required": [
    "challenge",
    "settlement"
  ]
}
```

</details>

**Example arguments** (executed against the shipped server, paste as-is):

```json
{
  "challenge": {
    "accepts": [
      {
        "scheme": "exact",
        "network": "base",
        "asset": "USDC",
        "amount": "100",
        "payTo": "0xabc"
      }
    ]
  },
  "settlement": {
    "network": "base",
    "asset": "USDC",
    "amount": "100",
    "payTo": "0xabc",
    "txRef": "0xexample",
    "status": "confirmed"
  }
}
```

**Result of that exact call:**

```json
{
  "spec": "CG-ME/1",
  "type": "x402_settlement_verification",
  "verdict": "VERIFIED",
  "issues": [],
  "challengeDigest": "5938fa55c4987269e3f7419a54771785424cae5f897a0e4d7d5fec38d23df326",
  "settlementDigest": "5bcb69ba0a034e15c2271469392bacb71045fb36a5c90e2db1e992ef882b3a6f",
  "boundary": "deterministic offline verification/planning surface; no payment custody, no broadcast, no network calls; x402 settlement/telemetry/physical completion verified only from caller-supplied evidence; VERIFIED != SAFE. Settlement verified only from caller-supplied evidence; no network confirmation performed."
}
```

---

## Calling conventions

- One JSON-RPC 2.0 object per line over stdio; start with `initialize`, then `tools/list`, then `tools/call`.
- Every tool accepts an optional `callerContext` object echoed back in `structuredContent.callerContext`; it is never used as a cryptographic input.
- Time is never read from the wall clock inside a commitment: pass a pinned `nowSeconds` digit string.
- Errors use a stable contract (`code` + `detail`) and never crash the server; unknown tools, missing arguments and wrong types are rejected before execution.
