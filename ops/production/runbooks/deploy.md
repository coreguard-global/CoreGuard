# CGCP Deploy Runbook (REFERENCE, NOT_PROVISIONED)

1. Provision managed Postgres HA and secrets.
2. Configure OIDC/SCIM and KMS/HSM.
3. Deploy CGCP app with config from `env.example`.
4. Verify `/health` (liveness) and readiness endpoint (when implemented).
5. Run smoke: agent upsert, policy, evaluate, commit, verify, anchor.
6. Capture evidence artifacts and hashes.
