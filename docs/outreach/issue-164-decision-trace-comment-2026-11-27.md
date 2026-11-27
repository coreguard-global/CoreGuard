# Draft comment for #164 — decision trace, not posted

Status: prepared 2026-11-27. Do not post without owner review.

---

The trace format proposed here is now an output rather than a sketch.

`CG-HANDOVER-TRACE/1` records the handover id, the `verdict_digest` that ties the
trace to the report, the observer and read time, both policies, both decisions
with their basis, whether the decision changed, the first named check that moved
it, the action taken — and `simulated: true`, because the receiver is still ours.

Two runs on the public records, read 2026-11-27:

| | zamback `e2ef637d…` | adctx `60b51198…` |
|---|---|---|
| `decision_before` | proceed | proceed |
| `decision_after` | hold | proceed |
| `changed` | yes | no |
| `reason` | step 18 (refused at the free limit) did not complete | — |

The zamback trace, shortened:

```json
{
  "trace_version": "CG-HANDOVER-TRACE/1",
  "handover_id": "e2ef637d-663e-4020-bdc9-c69fbb1fa4de",
  "verdict_digest": "sha256:16b425972a46bda507f6efa2fd8e41e4658a547f32f253890e08831b79727012",
  "decision_before": {
    "decision": "proceed",
    "basis": "issuer summary only: status=accepted, receipt_checks.checked=41, not_checked=1 (listed but not interpreted)"
  },
  "decision_after": {
    "decision": "hold",
    "reasons": ["step 18 (d36b7021-90eb-4a1f-9ea4-60d5bc45540b) did not complete: refused"]
  },
  "changed": true,
  "reason": "step 18 (d36b7021-90eb-4a1f-9ea4-60d5bc45540b) did not complete: refused",
  "action_taken": "hold",
  "simulated": true
}
```

The baseline is deliberately naive: it reads `receipt_checks.checked=41` and
`status=accepted` and does not interpret `not_checked=1`. That is the failure
mode the trace exists to expose, so it is stated as the basis rather than hidden
inside an "agent changed its mind" story.

The 4-step record produces `proceed → proceed`, which is just as useful: a
format that only fires on disagreement would be a demo, not a trace.

What is still missing is the thing this issue actually asks for — a receiving
agent that is not a policy we wrote, producing the same trace on a live
handover. The CLI takes `--trace <path>`; the bundles are committed; the
receiver is one inspectable function. Anyone can run it, and that is the point.

Files:
- `packages/handover-observer/trace.mjs`
- `evidence/handover-observer/trace-zamback-e2ef637d.json`
- `evidence/handover-observer/trace-adctx-60b51198.json`

If the shape is right, the next useful contribution is a real receiver's trace,
not another format revision from us.
