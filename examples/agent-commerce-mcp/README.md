# Agent Commerce MCP — one-command example

Spawns the real stdio MCP server and drives it as a client would: approve a
470.00 order, refuse a 570.00 execution, verify the exact one, then send a
malformed call. Offline, zero keys, no install, no network.

```
node examples/agent-commerce-mcp/run.mjs
```

Expected output (the exact wording, on Node 18+):

```
PASS  initialize reports the package version — 0.1.2
PASS  four tools, each with input and output schemas — coreguard_authorize, coreguard_verify_consent, coreguard_verify_execution, coreguard_assess_risk
PASS  consent receipt issued (CGCR/1)
PASS  a 570.00 execution against a 470.00 approval is INVALID — verdict=INVALID
PASS  the drift is named — ITEM_MUTATION,POLICY_VIOLATION,VALUE_ESCALATION
PASS  the exact approved execution is VERIFIED — verdict=VERIFIED
PASS  a missing argument fails closed with a stable code — MISSING_ARGUMENT
PASS  the server keeps serving after bad input

PASS (8/8)
```

Exit code is 0 only on 8/8.

## What each line proves

1. `serverInfo.version` comes from `package.json` — the two can no longer drift.
2. Every tool publishes both an input and an output schema.
3. `coreguard_authorize` returns a CGCR/1 receipt over the approved bytes.
4. An execution that exceeds the approval is `INVALID`, not a warning.
5. The refusal names the drift classes instead of a generic error.
6. The exact approved execution is `VERIFIED` (run after the refusal: a
   single-use consent is consumed by its first verified execution).
7. Bad input yields `MISSING_ARGUMENT`, not a crash.
8. The process answered `ping` after the failure — a long-lived client is safe.

## What it does not prove

- Not a purchase. No merchant, store or payment rail is contacted; the order is
  synthetic data owned by the caller.
- Not replay protection across processes. The consumed ledger is process-local
  and durable single-use anchoring is `NOT_BUILT`.
- Not a security review. `VERIFIED` means the executed bytes re-derive the
  approved commitments; it does not mean the order was a good idea.

The argument shapes in `run.mjs` are the same ones the CI contract test uses, so
if this example passes, the documented parameter names are the ones the server
accepts.
