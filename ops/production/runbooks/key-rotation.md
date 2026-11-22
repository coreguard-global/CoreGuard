# Key Rotation Runbook (REFERENCE)

- Prefer secret file/KMS references; never commit secrets.
- Dual-accept window for API keys if supported.
- Record key fingerprint/id only, not secret material.
- Verify old key rejected, new key accepted.
- Verify audit anchor signatures/receipts after rotation.
