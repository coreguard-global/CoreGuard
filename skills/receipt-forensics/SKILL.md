---
name: receipt-forensics
description: Use when reconstructing what happened to a payment or approval — redact a receipt for sharing, verify an evidence bundle, and prove a record is included in a notarised batch.
---

# Receipt forensics

Answer "what exactly was approved, what executed, and can we prove it later?" without a network or a trust root.

## Tools

| Need | Tool |
|---|---|
| Share a receipt without leaking PII/secrets | `coreguard_redact_receipt` |
| Check a bundle survived transport | `coreguard_verify_evidence_bundle` |
| Commit many receipts with one root | `coreguard_attest_batch` |
| Prove one receipt is in the batch | `coreguard_verify_batch_proof` |
| Order the ledger events | `coreguard_incident_timeline` |

## Workflow

1. **Redact before sharing.** Pass the receipt and, only if a field must stay visible, its dotted path in `reveal`:

   ```json
   { "receipt": { "receiptId": "r-1", "amount": "47000", "buyerEmail": "buyer@example.test", "paymentCredentialRef": "TOKENIZED-…" },
     "reveal": ["receiptId"] }
   ```

   Keep `originalDigest` with the redacted copy: a holder of the original can prove it is the same record without revealing the masked fields.

2. **Package evidence** as `{ spec: "CG-EB/1", items: [{ id, body, digest }], digest }`, where each `digest` is the canonical digest of `body` and `digest` is the canonical digest of `{ spec, items }`. `coreguard_verify_evidence_bundle` recomputes both; any edit, dropped item or substituted digest yields `INVALID` with the exact issue.

3. **Notarise a batch.** `coreguard_attest_batch` returns a Merkle root and one proof per receipt. Publish only the root (a tweet, an on-chain memo, a timestamped email). Hand each holder `{ leafDigest, root, proof }`.

4. **Verify inclusion offline.** `coreguard_verify_batch_proof` recomputes the root from the leaf and the left/right path. The proof is self-describing (`side` per step), so no index arithmetic is needed.

5. **Build the timeline** from the control-plane report: `coreguard_incident_timeline` orders by the ledger's own `seq`, reports gaps and chain status. A gap means records are missing — say so, do not interpolate.

## Evidence hygiene

- Hash the bytes you received, not a re-serialization.
- Store `originalDigest`, `redactedDigest` and the redaction manifest together.
- Never claim the root proves the events happened; it proves exactly these records existed in this order at the time you committed the root.

## Boundaries

- Local, offline verification only. No external witness, no timestamping authority, no chain anchoring (`NOT_BUILT`).
- `VERIFIED ≠ SAFE`.
