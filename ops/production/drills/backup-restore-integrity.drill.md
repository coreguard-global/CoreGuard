# Drill: Backup/Restore + Integrity (TEMPLATE)

**Status:** NOT_EXECUTED. Run on target environment and attach evidence.

## Objective
Prove backup can be restored and CGCP audit/ledger integrity verifies.

## Steps
1. Record pre-backup anchor: `control-plane-cli.mjs anchor --store <store>`.
2. Take backup/snapshot using target platform tooling.
3. Restore into isolated environment.
4. Run `verify` and `anchor --verify` equivalent; compare head hash/length.
5. Run application smoke checks and tenant isolation sanity checks.
6. Record RPO/RTO timestamps and artifact hashes.

## Expected evidence
- backup id/timestamp, restore id/timestamp
- pre/post anchor head hash and length
- verify output (ok=true)
- logs/metrics screenshots or exported files
