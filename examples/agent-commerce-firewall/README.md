# Agent Authorization Firewall (AC-FW/1) — product 1

ONE composed gate over the repo's existing engines — *"the request you are about to submit is exactly the one the user approved, it satisfies the committed policy, and it is inside the authorization window"* before execution, and the full CGEP/1 + AGR/1 verdict after it — with each limit stated honestly.

Run the demo: `node examples/agent-commerce-firewall/run.mjs`
Run the contract tests: `node --test test/integrations/agent-commerce-firewall.test.mjs`

## What the gate composes (no fifth engine)

- **PRE-EXECUTION** (`authorizeRequest`) — the request-time interception hook: committed policy (`packages/policy`) evaluated against the DECLARED request, the consent binding (the request's declared bytes must be byte-identical to the approved ones), the authorization window (only against a caller-pinned `nowSeconds` — the wall clock is never read), and single-use replay state. It never consumes: the request has not executed.
- **POST-EXECUTION** (`reviewExecution`) — the after-the-fact review: the full `verifyExecution` record (CGEP/1 checks + AGR/1 named classes + `driftNamed`). A single-use consent is consumed here, by its first verified execution.
- **`createFirewall({ consumedSet })`** — one bound guard with ONE shared consumption ledger, so an application wires the same gate before and after submit.
- Shared trace→policy mapping (`policy-context.mjs`) — the firewall and the risk taxonomy (AGR/1) can never disagree about what a rule saw.

## What is deliberately NOT here

- **No broadcast surface** — the firewall REFUSES; it never signs, submits or sends. No keys, no network, no wall clock.
- **Not the older engines** — `packages/firewall` (Phase-D EVM decision core, signed-intent lane) and `packages/agent-gate` (Stellar mandate gate) stay distinct; this face composes `packages/policy` + the agent-commerce verdict, it does not absorb them.
- **Durable single-use consumption anchoring stays NOT_BUILT** — the default ledger is process-local; a fresh process cannot see a previous consumption (documented on every report, never hidden). `consumedSet` accepts an external ledger.

## Fail-closed vocabulary

`MALFORMED_REQUEST` · `POLICY_REFUSED` · `CONSENT_MISMATCH` · `CONSENT_INVALID` · `WINDOW_CLOSED` · `SINGLE_USE_CONSUMED` — frozen and versioned (`AC-FW/1`); a new code lands with its own negative test in the same push; renaming is forbidden. Verdicts are ALLOW | DENY and an empty reasons list is the ONLY path to ALLOW; unreadable fields are refusals, never guesses.

## Status

**BUILT · TEST_EXECUTED** (offline; contract tests + deterministic demo with committed `artifacts.json`) · integration **NOT_BUILT** (no external adopter yet) · `VERIFIED ≠ SAFE` · delivery conformity (DDE/1) is never decided · every demo order is synthetic (the credential is a placeholder, never a PAN).
