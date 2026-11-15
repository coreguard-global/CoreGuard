# Agent Commerce Security Suite (offline · synthetic · zero keys)

The product face of the agentic-commerce layer — the full security arc on the
repo's own committed machinery, end to end, in one run:

- **AC-SDK/1** — the Agent Commerce SDK façade over CGEP/1
- **CGCR/1** — CoreGuard Consent Receipts: the user's approval bound to the
  EXACT approved order bytes (intent + policy + declared submit payload) as an
  independently re-derivable receipt with a pinned timestamp
- **AGR/1** — the Agent Risk Engine: a deterministic authorization-drift
  taxonomy (named classes + severities) — never a probabilistic fraud score
- **MCP server** — a real stdio JSON-RPC 2.0 server (`packages/agent-commerce/mcp.mjs`)
  driven live through authorize → verify
- **REST API** — a real loopback HTTP instance (`packages/agent-commerce/http.mjs`)
  driven live through authorize → verify

`node examples/agent-commerce-security-suite/run.mjs` runs the whole suite
offline and exits 0 **only** on the exact arc — any other outcome exits 1
(fail-closed):

| Step | What happens | Verdict |
|---|---|---|
| CONSENT | user approves merchant/items/tax/shipping/total/credential → bound as a CGCR/1 receipt | integrity **VERIFIED** |
| EXECUTE exact | the store runs the approved order | **VERIFIED** (all checks PASS) |
| 1 TOTAL_DRIFT | post-approval surcharge | **INVALID** — VALUE_ESCALATION |
| 2 MERCHANT_SWAP | the payee changes after approval | **INVALID** — RECIPIENT_SUBSTITUTION |
| 3 ITEM_MUTATION | an injected item (prompt-injection shape) | **INVALID** — ITEM_MUTATION |
| 4 CREDENTIAL_SUBSTITUTION | the payment credential is swapped | **INVALID** — CREDENTIAL_SUBSTITUTION |
| 5 EXPIRED | execution after the window closed | **INVALID** — EXPIRED_AUTHORIZATION |
| 6 SINGLE_USE_REUSE | replay of a consumed authorization | **INVALID** — SINGLE_USE_REUSE |
| 7 RECORD_TAMPER | one byte of the consent record is edited | **INVALID** — commitment mismatch |
| 8 MALFORMED | unreadable execution payload | **INVALID** — refused, not guessed |
| MCP | real server, drifted order | **INVALID** (VALUE_ESCALATION) |
| HTTP | real API, exact order | **VERIFIED** |

Boundary (standing): **execution verification never decides delivery
conformity** (DDE/1) · **VERIFIED ≠ SAFE** · the actor is **declared, never
detected** · **durable single-use anchoring is NOT_BUILT** (consumption is
process-local by design — a fresh process cannot see a previous consumption;
nothing here hides that) · **no contact, integration or endorsement is
claimed** with OpenAI, American Express, Mastercard, Visa, or any provider —
the dated market context lives in
[`docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md`](../../docs/agent-commerce-moment-chatgpt-wallet-2026-11-14.md)
and the product spec in
[`docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md`](../../docs/AGENT-COMMERCE-SECURITY-SPEC-V1.md).

Honest labels: every order is **synthetic** (`paymentCredentialRef` is a
placeholder, never a PAN), the run is **offline** with **no keys** (the MCP
and HTTP instances bind loopback/stdio only — nothing leaves the machine), and
the output is deterministic. Artifacts: `artifacts.json` (committed,
deterministic — the consent receipt id, every attack verdict with its classes,
the MCP and HTTP outcomes, and the exit contract). Re-running regenerates it
byte-identically. The batteries isolate a fresh consumption ledger per case so
each attack's class is named precisely; a real deployment holds ONE ledger per
process.
