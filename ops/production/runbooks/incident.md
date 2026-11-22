# CGCP Incident Runbook (REFERENCE)

## Triggers
- Audit verify fails
- Store unavailable / lock contention
- 401 spike / auth provider outage
- Anchor verification mismatch

## Actions
- Freeze writes (operator decision)
- Preserve logs, store snapshot, anchor receipts
- Verify audit chain and restore from known-good backup if needed
- Rotate compromised keys
- Publish incident report with timestamps and evidence
