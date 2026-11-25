---
name: x402-payment-gate
description: Use when an agent answers an HTTP 402 payment challenge — parse the challenge, authorize against policy, verify settlement evidence, and reconcile the payment without custody.
---

# x402 payment gate

A deterministic gate for x402-style challenges: parse, authorize, verify, reconcile. No wallet, no broadcast, no custody.

## Flow

```
402 challenge ──parse──▶ normalized requirements
      │                        │
      │                  authorize against policy ──▶ ALLOW / DENY (+ reasons)
      │                        │
      └──── pay outside ───────▶ settlement evidence ──verify──▶ VERIFIED / MISMATCH
                               │
                          reconcile ──▶ matched fields + unresolved losses
```

## Tools

| Step | Tool | Checks |
|---|---|---|
| 1 | `coreguard_parse_x402_challenge` | shape, required fields, accepted schemes |
| 2 | `coreguard_authorize_x402_payment` | amount ≤ max, network/asset/payTo allowlisted |
| 3 | `coreguard_verify_x402_settlement` | settlement matches the challenge it claims to settle |
| 4 | `coreguard_reconcile_payment` | authorization ↔ challenge ↔ settlement ↔ receipt |

## Workflow

1. **Parse** the challenge exactly as received. Keep the raw object; the digest of your parse is not the digest of the challenge.

2. **Authorize** with an explicit policy:

   ```json
   { "challenge": { "accepts": [{ "scheme": "exact", "network": "base", "asset": "USDC", "amount": "100", "payTo": "0xabc" }] },
     "policy": { "maxAmount": "100", "allowedNetworks": ["base"], "allowedAssets": ["USDC"], "allowedPayTo": ["0xabc"] } }
   ```

   Every allowlist is fail-closed: an absent field is a denial, not a wildcard.

3. **Pay outside this server.** CoreGuard never signs or broadcasts. The agent's wallet does that.

4. **Verify settlement evidence** against the challenge — network, asset, amount, payTo, `txRef`, status. A confirmed-looking receipt for a different amount is a mismatch, not a success.

5. **Reconcile** authorization, challenge, settlement and receipt. Any unresolved field is listed; do not close the books while `losses` is non-empty.

6. **Bind to the buyer's approval** when the payment is part of an agent purchase: `coreguard_authorize` + `coreguard_verify_execution`, then keep the receipt with the settlement reference.

## Failure rules

- `DENY` → do not pay; report the blocking allowlist field.
- Settlement mismatch → treat as unpaid; never retry into a second payment without reconciling the first.
- Missing `txRef` → evidence is incomplete; keep the payment open.

## Boundaries

- No custody, no signing, no broadcast, no chain reads: every check is over evidence you supply.
- `VERIFIED` means the evidence is internally consistent with the challenge; it does not prove finality.
- `VERIFIED ≠ SAFE`.
