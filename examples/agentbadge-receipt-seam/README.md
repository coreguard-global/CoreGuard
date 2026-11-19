# AgentBadge × CoreGuard — authorization-evidence seam (synthetic demo)

This example shows a small, concrete seam between a multi-rail agent payment
accept gate and CoreGuard-style verifiable authorization evidence:

- the agent (or merchant flow) presents **`receipt_id` + `profile`** as the
  evidence reference;
- the gate **resolves** the record by name, **verifies** what was actually
  executed against what was approved and who signed it, and
- maps the outcome to a payment decision (**ALLOW / ALLOW_UNVERIFIED / HOLD /
  DECLINE**) without guessing.

It is inspired by the discussion in ACP #328 where AgentBadge noted that their
reserved authorization-evidence seam (`receipt_id` + `profile`) matches the
shape used here.

## Run

```bash
node examples/agentbadge-receipt-seam/run.mjs
```

Optional:

```bash
node examples/agentbadge-receipt-seam/run.mjs --policy balanced --out ./agentbadge-seam-artifacts
```

The command prints a scenario table, writes `report.json` and a short
`REPORT.md` when `--out` is provided, and exits non-zero only if a scenario
lands in an unexpected decision.

## What the demo shows

| Scenario | Evidence state | Gate outcome | Payment posture |
|---|---|---|---|
| Verified receipt, pinned key, execution matches approval | `VERIFIED` | `ALLOW` | capture may proceed on evidence |
| Same receipt bytes, but issuer key not pinned | `NOT_CHECKED` | `ALLOW_UNVERIFIED` | proceed only if policy allows unverified evidence |
| Tampered bytes behind a content-addressed id | resolution refuses (`tampered`) | `DECLINE` | do not capture on tampered evidence |
| No record behind the name | `UNRESOLVABLE_RECORD` | `HOLD` (balanced/strict) | retry, locate, or escalate; do not treat silence as failed proof |
| Valid signature, but executed total drifted from approval | `VERIFICATION_FAILED` | `DECLINE` | refuse: signature ≠ approved execution |

The scenarios are synthetic and local. Receipt bytes are content-addressed and
verifiable offline once obtained; resolution/verifier inputs are injected
explicitly.

## Scope and boundaries

- **Synthetic demo:** local reference data, no third-party merchant, PSP,
  customer, auditor, or endorsement.
- **No network / no broadcast:** nothing is fetched from the internet and no
  chain/wallet/settlement call is made.
- **Not a fraud or safety claim:** a passing verification means the presented
  checks passed for the presented evidence; it does not mean the action is
  "safe", delivered, or free of fraud.
- **Policy is explicit:** `ALLOW_UNVERIFIED` means "proceed without checked
  evidence" and must remain visible to downstream systems — never a silent pass.

## Why this seam is useful

Payment gates often need a portable way to answer: *"was this agent action
authorized and executed as approved, according to evidence I can check?"*
Carrying `receipt_id` + `profile` gives the gate a stable handle: resolve the
named record, verify it against pinned trust material and the held intent, and
emit a named decision that downstream systems can audit.
