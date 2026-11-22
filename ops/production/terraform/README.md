# Terraform Reference Skeleton (NOT_PROVISIONED)

This directory is a **reference skeleton** only. It does not provision real infrastructure.

## Expected operator-owned modules
- Managed Postgres (HA, replication, backups, PITR)
- KMS/HSM key + IAM policy
- OIDC/IdP app registration / SCIM config (where supported)
- Network/TLS/load balancer/WAF
- OTEL/metrics/logs/alerts stack

## Non-claims
- No `terraform apply` has been executed by this repo in this environment.
- No cloud resources are created by this pack.
