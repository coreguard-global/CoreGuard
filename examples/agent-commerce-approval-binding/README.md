# Agent-Commerce Approval-Binding Demo (offline · synthetic · zero keys)

The CoreGuard layer for the agentic-commerce gap, on the repo's own committed machinery.

`node examples/agent-commerce-approval-binding/run-demo.js` runs the full arc offline and exits 0 **only** on the exact outcome set — any other outcome exits 1 (fail-closed):

| Step | What happens | Verdict |
|---|---|---|
| APPROVE | user reviews merchant/items/total/card → approval bound as a receipt to exact canonical bytes (intent + policy) | receipt issued |
| EXECUTE exact | the executed order payload equals the approved bytes | **VERIFIED** (all checks PASS) |
| TOTAL DRIFT | a surcharge appears after the approval | **INVALID** — TRACE_HASH + VALUE_LIMIT + binding, field named |
| MERCHANT SWAP | the payee changes after the approval | **INVALID** — TRACE_HASH + TARGET/RECIPIENT allowlists + binding, field named |
| RECORD TAMPER | anyone edits a byte of the stored approval record | **INVALID** — RECEIPT_COMMITMENT mismatch |

Boundary (standing): **execution verification does not decide delivery conformity** — the DDE/1 payout gate opens only on party acceptance records.

Honest labels: every order here is **synthetic** (`paymentCredentialRef` is a placeholder, never a PAN; merchant/order identifiers are simulated), the run is **offline** with **no keys** and **no network**, and the output is deterministic. Nothing about any real platform, wallet, network or provider is claimed; the dated market context and the full capability mapping live in [`docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md`](../../docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md).

Artifacts: `artifacts.json` (committed, deterministic — the approved intent/policy, the receipt id, the four verdicts, and the named drifts). Re-running the demo regenerates it byte-identically.
