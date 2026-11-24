---
name: agent-purchase-guard
description: Use when an agent is about to spend money, submit an order, or sign a payment authorization, and you need the approval bound to exact bytes and the execution verified before anything is called successful.
---

# Agent purchase guard

Bind the buyer's approval to the order bytes, then verify what actually executed against that receipt. Offline, deterministic, fail-closed.

## When to use

- An agent is about to place an order, pay an invoice, settle an x402 challenge, or call a merchant API that moves value.
- You need a receipt a human (or a dispute process) can re-derive later without trusting your logs.
- A verifier, firewall, or marketplace asks "was this execution covered by an approval?".

Do **not** use it to claim an order is safe, fraud-free, or settled. `VERIFIED` means the executed bytes matched the approved bytes.

## Tools

| Step | Tool | Why |
|---|---|---|
| 1 | `coreguard_compile_policy` | turn the spend rules into a canonical policy with a stable digest |
| 2 | `coreguard_explain_decision` | check the intent is allowed **before** asking a human |
| 3 | `coreguard_authorize` | bind approval to `intent` + `policy` + `declaredTrace` at a pinned `nowSeconds` |
| 4 | `coreguard_verify_execution` | compare the executed trace to the receipt |
| 5 | `coreguard_build_attestation` / `coreguard_verify_attestation` | optional portable attestation for a third party |
| 6 | `coreguard_consumption_status` | enforce single use (`storePath` for a cross-process ledger) |

## Workflow

1. **Compile the policy** (once per buyer/agent):

   ```json
   { "spec": { "policyId": "buyer-42", "maxAmountMinor": "47000",
               "allowMerchants": ["store.example"], "allowRecipients": ["0x0000000000000000000000000000000000000042"],
               "allowSelectors": ["0xa9059cbb"], "currency": "USD" } }
   ```

   Keep `policyDigest`; it is the version you approved.

2. **Dry-run the intent** with `coreguard_explain_decision`. If the verdict is `DENY`, stop and read `counterfactual` — it names the single change that would clear the first blocking rule. Never silently rewrite the order to satisfy it; surface it to the buyer.

3. **Authorize** with the exact bytes the agent will submit. `nowSeconds` is a pinned digit string supplied by the caller — never the wall clock.

4. **Verify the execution.** `coreguard_verify_execution` returns a verdict plus named drift classes. Amount, recipient, selector, merchant name and item drift are distinct; treat every non-`VERIFIED` verdict as a stop, not a warning.

5. **Consume once.** Call `coreguard_consumption_status` with `action: "consume"` and the same `receiptId`. Without `storePath` the ledger is process-local; for anything that survives a restart pass `storePath` (AC-CS/1) or set `COREGUARD_CONSUMPTION_STORE`.

6. **Keep the evidence.** `coreguard_redact_receipt` produces a shareable copy with both digests; `coreguard_attest_batch` lets you notarise many receipts with one Merkle root.

## Failure handling

| Result | Action |
|---|---|
| `DENY` from explain | do not ask for approval; show the counterfactual to the buyer |
| `DRIFT` / non-verified execution | freeze the agent (`coreguard_freeze_agent`), preserve the trace, open an incident |
| `ALREADY_CONSUMED` | treat the second submission as a replay; do not retry |
| tool error `MISSING_ARGUMENT` | fix the call; the server never crashes on bad input |

## Boundaries

- No payment network, chain, merchant or platform is contacted.
- No custody, no broadcast, no settlement proof.
- `VERIFIED ≠ SAFE`; a matching receipt does not prove the goods exist or the merchant is honest.
