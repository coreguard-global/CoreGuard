# Control plane demo (CGCP/1)

An offline walk through the plane over its real HTTP API. No keys, no network beyond
loopback, no external service. The store lives in a temp directory and is removed.

```bash
node examples/agent-commerce-control-plane/run.mjs
```

Expected output:

```
PASS  anonymous request is refused with 401
PASS  policy v1 is created
PASS  in-policy purchase is ALLOWED
PASS  denied address is refused with ADDRESS_DENIED
PASS  above-threshold purchase requires an approval
PASS  approved purchase commits and records spend
PASS  a second purchase over the cap is refused (409 + reason)
PASS  hash-chained audit verifies before and after a restart

8/8 PASS  ·  CGCP/1  ·  VERIFIED ≠ SAFE
```

## What it demonstrates

1. **Auth is on** — `/health` is public liveness; every `/v1` route needs the bearer key.
2. **Versioned policy** — spend cap, daily cap, approval floor, merchant allow list,
   address deny list.
3. **Bound agent** — the agent inherits its policy; no policy id is needed per call.
4. **Allow** — an in-policy purchase is authorised with a per-check record.
5. **Deny by name** — a denied address returns `ADDRESS_DENIED`, not a generic refusal.
6. **Hold** — above the approval floor the decision is `APPROVAL_REQUIRED`.
7. **Commit** — after a recorded approval, the execution commits and spend is recorded.
8. **Limit** — a second purchase over the cap is refused with `409` and named reasons.
9. **Evidence** — the hash chain verifies; reopening the same store after shutdown keeps
   the executions and the valid chain.

## What it is not

Not a hosted service, not multi-tenant, no RBAC/SSO, no HA, no custody. See
`docs/control-plane-architecture.md` for the built/NOT_BUILT split and
`docs/control-plane-runbook.md` for operating it.
