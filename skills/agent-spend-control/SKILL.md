---
name: agent-spend-control
description: Use when setting, reviewing, or explaining an agent's spending limits — compile the policy, simulate the month, prove the boundary cases, and project runway without touching production state.
---

# Agent spend control

Make the policy explicit, testable and explainable before an agent spends against it.

## Tools

| Question | Tool |
|---|---|
| What exactly is the policy? | `coreguard_compile_policy` |
| Why was this order denied? | `coreguard_explain_decision` |
| What would this batch cost / allow? | `coreguard_simulate_spend` |
| Did the limit change? | `coreguard_diff_policies` |
| Where does the policy break? | `coreguard_generate_boundary_cases` |
| How long until the budget is gone? | `coreguard_budget_runway` |
| Is this spend unusual? | `coreguard_detect_spend_anomaly` |

## Workflow

1. **Compile** the owner's intent into rules. The digest is the policy version; store it next to the approval.

2. **Simulate** a realistic batch before enabling the agent. `coreguard_simulate_spend` is a true dry run: no approval, no spend counter, no ledger write. Check `counts`, `totals.allowedMinor` and the counterfactual on each denied row.

3. **Prove the edges.** `coreguard_generate_boundary_cases` emits at-limit, one below, one above, unlisted target/recipient, closed window and wrong currency — with the verdict the server itself computes. Paste those into the integration suite; do not hand-assert them.

4. **Change deliberately.** Before shipping a new policy, `coreguard_diff_policies` tells you `strictness` (tighter/looser/mixed), the limit delta, and `requiresReconsent`. If it requires reconsent, do not reuse the old approval.

5. **Project runway** with pinned inputs:

   ```json
   { "asOfSeconds": "1794657600", "policyLimitMinor": "500000", "spentMinor": "125000",
     "windowSeconds": "86400", "events": [{ "atSeconds": "1794654000", "amountMinor": "25000" }] }
   ```

   `runwaySeconds: null` means zero burn in the window — an absence of spending, not infinite budget.

6. **Watch for outliers** with `coreguard_detect_spend_anomaly` (median/MAD). One huge order in a quiet week is a question for a human, not an automatic block.

## Rules of thumb

- Amounts are decimal strings compared as integers; never introduce floats.
- `nowSeconds`/`asOfSeconds` are caller-supplied pinned epochs. Two runs with the same inputs must produce the same answer.
- A counterfactual is an explanation, not an authorization: clearing it still requires a real approval.

## Boundaries

- No forecasting model, seasonality or confidence interval: runway is a straight line over the window you supply.
- `VERIFIED ≠ SAFE`; policy compliance is not solvency, fraud detection or credit risk.
