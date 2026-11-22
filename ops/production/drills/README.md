# Drill Pack (INTEGRATION_READY, NOT_PROVISIONED)

These drills are **templates/runbooks/scripts**. They are not evidence of execution.

## Required drills
1. Backup/restore + integrity
2. Failover RPO/RTO
3. Key rotation
4. Tenant isolation / authz adversarial
5. Anchor verification after restore

## Evidence rule
Every executed drill must produce:
- timestamped logs/metrics
- operator identity
- environment identifier
- command/script version
- pass/fail result
- artifact hashes/receipts

Use `node ops/production/drills/generate-evidence-template.mjs <drill> <out.json>` to create a template.
