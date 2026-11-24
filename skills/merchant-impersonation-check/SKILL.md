---
name: merchant-impersonation-check
description: Use when an agent is about to pay a merchant, domain, or package whose name resembles a known brand, or when a payment instruction arrives from a new domain.
---

# Merchant impersonation check

Catch homoglyph, mixed-script and punycode impersonation before value moves.

## Why it matters

`paypal.com` vs `pаypal.com` (Cyrillic `а`) are different registrations that render almost identically. Agents compare strings, not pixels; a one-character difference in a payment instruction is an exfiltration primitive.

## Tool

`coreguard_check_lookalike` — deterministic confusable folding, skeleton edit distance, mixed-script and punycode signals.

```json
{ "candidate": "synthetic-store.examp1e", "reference": "synthetic-store.example" }
```

Result:

- `verdict`: `IDENTICAL` | `LOOKALIKE` | `DISTINCT`
- `signals`: `{ mixedScript, punycode, mappedCharacters, distance }`
- `candidateSkeleton` / `referenceSkeleton` — show these to a human; the difference becomes visible.

## Workflow

1. **Extract the reference** from the approval, not from the incoming message. If the approval does not name a canonical domain, stop and ask the buyer.
2. **Check the candidate** exactly as it will be used in the payment (host, `payTo`, package identifier).
3. **Escalate:**
   - `IDENTICAL` → continue to amount/recipient verification.
   - `LOOKALIKE` → block. Quote the skeleton and the signals. Do not "fix" the address automatically.
   - `DISTINCT` → continue, but note that this tool does not endorse the candidate; allowlists still apply.
4. **Record it.** Add the check result to the approval's caller context and keep the receipt. If the payment proceeded, `coreguard_verify_execution` will confirm the bytes; this check confirms the name.

## Limits

- The confusable table is a curated subset (Latin/Cyrillic/Greek and common digit substitutions), not the full Unicode confusables catalogue.
- `DISTINCT` can still be a scam for other reasons (newly registered domain, mismatched TLS, social engineering).
- It never resolves DNS or fetches the site.

## Boundaries

- Offline string analysis only; no WHOIS, no certificate check, no reputation feed.
- `VERIFIED ≠ SAFE`.
