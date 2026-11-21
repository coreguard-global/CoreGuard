# CoreGuard Agent Commerce MCP — security and threat model

Scope: the stdio MCP server in `packages/agent-commerce/mcp.mjs` and the SDK
functions it exposes (`createConsent`, `verifyConsent`, `verifyExecution`,
`assessRisk`). Local, offline, deterministic, zero keys, MIT.

This page states what the surface guarantees, what it does not, and what an
attacker can still do. Where a guarantee depends on the caller, it says so. No
grade, score or badge is a substitute for this page.

## What the server is trusted to do

1. **Bind an approval to bytes.** `coreguard_authorize` commits a CGCR/1 receipt
   over the approved intent, policy and declared submit payload, plus a caller
   supplied `nowSeconds`. The receipt is re-derivable by anyone holding it.
2. **Refuse drift.** `coreguard_verify_execution` compares an executed trace to
   the receipt. Exact match → `VERIFIED`. Any difference → `INVALID` with the
   drifted field named under the AGR/1 taxonomy (`VALUE_ESCALATION`,
   `TARGET_MISMATCH`, `ITEM_MUTATION`, `POLICY_VIOLATION`, `RECIPIENT_MISMATCH`,
   …).
3. **Fail closed.** Missing or unusable input never becomes a pass. Emptiness is
   `UNKNOWN`/`INVALID`, never `VERIFIED`.
4. **Stay deterministic.** Same inputs → same output bytes. The server never
   reads the wall clock into a commitment; `nowSeconds` is always supplied.
5. **Not touch the network.** No HTTP client, no keys, no telemetry, no call to
   any commerce platform or payment network.

## What it is not trusted to do — read this before quoting it

- **VERIFIED ≠ SAFE.** A verdict says the executed bytes re-derive the approved
  commitments. It says nothing about whether the merchant is honest, the item
  exists, the price is fair, or the payment rail settles.
- **Single-use is process-local.** The consumed ledger is a `Set` inside the
  running server process. Two processes, two machines or a restart do not share
  it, so replay across those boundaries is **not** prevented. Durable
  single-use anchoring is `NOT_BUILT`. Every tool description and the
  `initialize` instructions repeat this.
- **The executed trace is caller-supplied.** The server verifies what it is
  given. If the caller lies about what executed, the encryption of the report is
  still correct about the lie. Fetching the trace from a chain or a PSP is an
  integration that does not exist in this package.
- **No review, no certification.** There is no third-party security review, no
  penetration test, no SOC 2, no certification. Marketplace grades are automated
  heuristics over published metadata; they are not audits and this repository
  does not embed them.
- **No transport security layer.** stdio is the transport. There is no TLS, no
  authentication, no authorization between a client and this server; the client
  spawning the process is the trust boundary.

## Adversary classes considered

| Adversary | Capability | What stops them | What does not |
|---|---|---|---|
| Prompt-injected agent | chooses tool arguments | policy allowlists + value limit, evaluated deterministically; drift is named | nothing prevents an agent from *calling* `authorize` with a generous policy — the approval surface is the human's |
| Tampering intermediary | edits the receipt in transit | every commitment is recomputed from the record's own bytes | a record signed by a key you do not check |
| Replay attacker | re-submits a consumed consent | process-local consumed ledger | another process, another host, or a restart |
| Malicious merchant | changes price/items after approval | `VALUE_ESCALATION`, `ITEM_MUTATION` at verification | anything before verification; the server does not sit in the payment path |
| Curious operator | reads the process memory | nothing; the receipt contains the approved order | — |
| Malformed-input sender | sends junk to crash the server | input validation with a stable error contract; parse errors answer `-32700`; the process keeps serving | resource exhaustion by a local co-tenant (no rate limits inside stdio) |

## Error contract (stable, machine readable)

Every failure is a **tool result**, not a thrown exception and not a process
exit:

- `content[0].text` = `CODE: detail`
- `structuredContent.error = { code, detail }`
- codes: `UNKNOWN_TOOL`, `MISSING_ARGUMENT`, `INVALID_ARGUMENT`, `TOOL_ERROR`

JSON-RPC level errors are separate: `-32700` parse, `-32600` invalid request,
`-32601` method not found. A bad line never terminates the server; CI asserts the
process answers `ping` after each failure class.

## Input validation and its limits

Validated before anything is committed: required objects exist and are objects
(not arrays, not `null`), `nowSeconds` is a digits-only string (a number is
rejected — it would invite float drift), `consumed` is a boolean when supplied.
Not validated: the *semantics* of an intent or policy beyond what the SDK's
CGEP/1 parser enforces. Validation is a crash barrier, not a policy engine.

## Supply chain

- Dependencies are the four first-party `@coreguard/*` packages; no transitive
  runtime network code in this package.
- Install by exact version if you need reproducibility; the package publishes
  the same source you can read here.
- `package.json` is the single source of the version reported by
  `serverInfo.version`; CI fails if they diverge. A version string mismatch
  between the server and npm was a real defect in the 0.1.2 line and is fixed in
  the 0.1.3 release candidate.

## Reporting

Report a security issue through the repository's security policy rather than a
public issue. Disclosure is welcome; a fix lands with a test that fails before
it and passes after.

Standing rule for every page we write: if a sentence here becomes untrue, the
sentence is removed in the same change that makes it untrue — not after.
