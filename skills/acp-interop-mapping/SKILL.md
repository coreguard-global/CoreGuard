---
name: acp-interop-mapping
description: Use when a partner speaks a different receipt or checkout shape (ACP, x402, CGCR/1) and you need a structural mapping that names exactly what is lost, plus deterministic vectors to test their implementation.
---

# ACP interop mapping

Move records between profiles without pretending the mapping is lossless.

## When to use

- A partner (agent commerce platform, gateway, marketplace) asks for receipts in their shape.
- You are integrating an SDK and need test vectors that match the enforcer, not your reading of the spec.
- A dispute needs the same record expressed in two profiles.

## Tools

| Need | Tool |
|---|---|
| Structural translation | `coreguard_translate_receipt` |
| Integration vectors | `coreguard_emit_test_vectors` |
| Cross-profile verification evidence | `coreguard_verify_evidence_bundle` |
| Observation/profile join | `coreguard_verify_receipt` (CGCP/1), AER-1 docs in this repo |

## Workflow

1. **Translate:**

   ```json
   { "receipt": { "receiptId": "rcpt-example-0001", "amount": "47000", "currency": "USD", "merchant": "synthetic-store.example" },
     "to": "acp" }
   ```

   Response carries `translated`, `losses`, `sourceDigest`, `lossless`.

2. **Do not paper over `losses`.** If the target cannot carry a commitment (approval timestamp, asset id, signature), say so in the integration note. A translated record is a new object with a new digest — it is not the original attestation.

3. **Re-verify against the original bytes** whenever value moves. Translation is presentation; verification is `coreguard_verify_execution` / `coreguard_verify_receipt`.

4. **Emit vectors for the partner's test suite:**

   ```json
   { "policy": { "version": "CGEP/1", "policyId": "p", "rules": [{ "ruleId": "VALUE_001", "type": "VALUE_LIMIT", "params": { "max": "47000" } }] },
     "baseIntent": { "amount": "47000", "recipient": "0x42", "target": "store.example" },
     "nowSeconds": "1794657600" }
   ```

   Expected verdicts (`ALLOW`/`DENY`) come from the same engine the server enforces. If their implementation disagrees, the vector is the bug report.

5. **Share evidence portably:** bundle the translated record plus the original digest in `CG-EB/1`, and let the partner run `coreguard_verify_evidence_bundle` locally.

## Honesty rules

- Never call a translated receipt "signed", "verified" or "settled".
- Keep both digests: `sourceDigest` proves what you received; the translated digest proves what you sent.
- If a partner asks for a compatibility claim, point at the executable vectors, not a badge.

## Boundaries

- Structural mapping only: no signature creation or verification, no schema registry authority.
- Profiles evolve; pin the version you translated against and re-run the vectors after any change.
