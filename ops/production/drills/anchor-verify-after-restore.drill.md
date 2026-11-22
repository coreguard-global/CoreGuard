# Drill: Anchor Verification After Restore (TEMPLATE)

**Status:** NOT_EXECUTED.

## Steps
1. Capture anchor receipt before backup.
2. Restore from backup.
3. Recompute/verify local audit chain.
4. Verify anchor receipt against restored head (and external witness if configured).
5. Record any mismatch as incident.

## Evidence
- anchor receipt
- restored head hash/length
- verification output
- witness response/receipt
