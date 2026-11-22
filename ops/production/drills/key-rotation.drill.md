# Drill: Key Rotation (TEMPLATE)

**Status:** NOT_EXECUTED.

## Steps
1. Create new key in KMS/secret manager.
2. Deploy dual-key acceptance window (if supported).
3. Rotate clients.
4. Remove old key.
5. Verify old key rejected, new key accepted.
6. Verify audit anchor receipts and signature verification.

## Evidence
- key ids/fingerprints (no secret material)
- rotation timestamps
- 401/200 transition logs
- anchor verify receipts
