# CGCP Production Evidence Schema (INTEGRATION_READY, NOT_PROVISIONED)

Evidence files are operator-generated from real target-environment drills. Templates/simulations are **not** production evidence.

## Required fields
- `status`: `EXECUTED` for real target evidence. `TEMPLATE_NOT_EXECUTED` and `LOCAL_SIMULATION_NOT_PRODUCTION_EVIDENCE` are invalid for readiness.
- `drill`: one of required drill IDs.
- `executedAt`: ISO timestamp.
- `environment`: real target environment identifier (not `local-simulation`).
- `operator`: responsible operator identity.
- `pass`: boolean.
- `artifacts`: array of artifact refs (logs/metrics/screenshots/receipts), each with `type`, `ref`, `sha256` when available.
- `observations`: array of factual observations.
- `metrics`: object (RPO/RTO/etc. where applicable).

## Required drills
- `backup-restore-integrity`
- `failover-rpo-rto`
- `key-rotation`
- `tenant-isolation-authz`
- `anchor-verify-after-restore`
