# CoreGuard Agent Commerce — MCP tool reference

Paste-ready reference for the MCP directory listing. Package `@coreguard/agent-commerce@0.1.3`, server `io.github.EslaM-X/coreguard-agent-commerce`, transport **stdio**, protocol `2025-06-18`.

Generated from `initialize` + `tools/list` against `packages/agent-commerce/mcp.mjs`. Every example arguments block below was executed against that server when this page was built; the shown result is the real response (long consent payloads abridged where marked).

**Boundary:** this is an offline, deterministic verification engine. `VERIFIED` means the executed bytes matched the approved bytes — it is not a safety, fraud or settlement guarantee, and no payment, chain or provider is contacted.

## Tools (10)

| Tool | Required | Optional | Purpose |
|---|---|---|---|
| [`coreguard_assess_risk`](#coreguard_assess_risk) | `intent`, `policy`, `trace` | `consumed`, `callerContext` | Classify one executed order against one approved authorization with the deterministic AGR/1 taxonomy. Not a… |
| [`coreguard_authorize`](#coreguard_authorize) | `intent`, `policy`, `declaredTrace`, `nowSeconds` | `callerContext` | Bind a user's approval as a CoreGuard Consent Receipt (CGCR/1): the exact approved order bytes (intent + policy +… |
| [`coreguard_build_attestation`](#coreguard_build_attestation) | `consent`, `executedTrace`, `adapterId`, `nowSeconds` | `callerContext` | Build a CGXA/1 offline execution attestation from a consent record and executed trace. No broadcast; no… |
| [`coreguard_consumption_status`](#coreguard_consumption_status) | `receiptId` | `action`, `storePath`, `callerContext` | Check/consume/release a receiptId in a consumption ledger. Default is process-local (this MCP process only). If… |
| [`coreguard_decide_outcome`](#coreguard_decide_outcome) | `report` | `receiptId`, `callerContext` | Map a verification report to CG-OUT/1 outcome and authorization decision. ABSENT/NOT_CHECKED never render as BLOCK;… |
| [`coreguard_inspect_identity`](#coreguard_inspect_identity) | `issuer`, `scope`, `subject`, `contentDigest` | `anchor`, `other`, `callerContext` | Inspect CG-ID/1 identity split: recordId (who) vs contentDigest (what), with optional anchor facts and optional… |
| [`coreguard_profile_reference`](#coreguard_profile_reference) | `action` | `receiptId`, `reference`, `callerContext` | Create or parse a CG-OUT/1 profile reference. action='make' requires receiptId; action='parse' requires reference. |
| [`coreguard_verify_attestation`](#coreguard_verify_attestation) | `attestation`, `attestationId`, `consent`, `executedTrace` | `callerContext` | Verify a CGXA/1 attestation against its consent and executed trace. Offline, fail-closed; no chain/network contact. |
| [`coreguard_verify_consent`](#coreguard_verify_consent) | `consent` | `callerContext` | Verify a consent record's integrity and binding: recompute every commitment against the record's own approved bytes.… |
| [`coreguard_verify_execution`](#coreguard_verify_execution) | `consent`, `trace` | `callerContext` | Verify an executed order against a consent record, fail-closed: exact execution -> VERIFIED; any drift -> INVALID… |

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

---

## Calling conventions

- One JSON-RPC 2.0 object per line over stdio; start with `initialize`, then `tools/list`, then `tools/call`.
- Every tool accepts an optional `callerContext` object echoed back in `structuredContent.callerContext`; it is never used as a cryptographic input.
- Time is never read from the wall clock inside a commitment: pass a pinned `nowSeconds` digit string.
- Errors use a stable contract (`code` + `detail`) and never crash the server; unknown tools, missing arguments and wrong types are rejected before execution.
