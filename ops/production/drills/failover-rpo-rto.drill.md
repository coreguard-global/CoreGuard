# Drill: Failover RPO/RTO (TEMPLATE)

**Status:** NOT_EXECUTED. Requires real managed HA environment.

## Steps
1. Generate steady write load in staging.
2. Record last committed execution id and audit head.
3. Trigger controlled primary failover.
4. Measure RTO until readiness/liveness/health pass.
5. Measure RPO by comparing last committed record pre/post failover.
6. Verify audit chain and idempotency behavior.

## Evidence
- failover start/end timestamps
- RTO, RPO
- lost/duplicated write analysis
- verify output
