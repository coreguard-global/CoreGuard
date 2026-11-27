# Where the smart-account snapshot comes from

The smart-account kit maintainer answered the question about a built-in `kit.snapshot(ruleId)` helper: keep it outside the kit. The composition is `kit.rules.get(ruleId)` for the rule and `kit.policyClients` for the threshold, weighted and spending-limit weights. The kit will not flatten them into one shape.

Two reasons were given, and both belong in the integrator's record rather than in a helper that pretends otherwise. `ContextRule.policies` holds policy contract addresses only — no types and no ABIs — so a `policyWeights` shape would silently drop custom-policy and multi-policy constraints. `rules.get` and the policy clients are separate `simulateTransaction` calls, potentially at different ledgers, so wrapping them as a verifiable snapshot would over-promise a single atomic read.

CoreGuard stays on the consumer side. `packages/agent-commerce/smart-account-adapter.mjs` maps a caller-supplied snapshot into the three CG-W6/1 tools; it never fetches, signs, deploys or decides authorization. The caller, or an integration layer the caller trusts, assembles the snapshot and carries the ledger each part was read at. The adapter digests what it receives, so a changed weight, signer kind, presented weight or expiration ledger is visible in the snapshot digest.

Mapping from the kit surface to the adapter input: rule id and context type belong in the caller's record; `signers` from `Delegated(G…)` or `External(verifier, keyData)` become `signers[]`; the effective weight from the policy client keyed by `(smart_account, context_rule_id)` becomes the threshold input, not a field on the rule; the authorization entry supplies `contractId`, `functionName`, `argsDigest` and `signatureExpirationLedger` under `soroban.entry`; `valid_until` and the read ledger stay outside the digest unless the caller chooses to bind them explicitly.

No compatibility, adoption or endorsement claim is made here, and nothing in this document adds a network call to the kit or to the adapter. VERIFIED != SAFE: a reshaped snapshot is not an authorization decision.
