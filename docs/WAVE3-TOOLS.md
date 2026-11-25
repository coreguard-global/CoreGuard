# Wave 3 — what the 20 new tools actually answer

Wave 3 (`CG-W3/1`) is a reasoning layer over the same offline receipt engine.
It exists because "the bytes matched" is necessary but not sufficient: operators
also need to explain a denial, vet the server they are about to install, prove a
record later, and stop an agent in one call.

## Policy reasoning (5)

| Question | Tool | Answer shape |
|---|---|---|
| What is the policy, exactly? | `coreguard_compile_policy` | canonical CGEP/1 policy + `policyDigest` |
| Why was this denied? | `coreguard_explain_decision` | per-rule checks + one counterfactual |
| What does this batch cost? | `coreguard_simulate_spend` | per-row verdicts + totals, `dryRun: true` |
| Did the limit change? | `coreguard_diff_policies` | added/removed/changed rules, `requiresReconsent` |
| Where does it break? | `coreguard_generate_boundary_cases` | at/±1 limit, unlisted target/recipient, closed window, wrong currency |

The counterfactual is the adoption feature: instead of "DENY", the agent gets
"amount 57000 > max 47000; change `intent.amount` to `47000`". It never rewrites
the order itself — a human still has to approve.

## MCP supply chain (5)

MCP servers are code plus metadata injected into a model's context. Wave 3 gives
a buyer four independent checks:

1. **Manifest** (`coreguard_audit_server_manifest`) — remote transports, unpinned
   packages, missing repository, secret env requests, undeclared distribution.
2. **Descriptions** (`coreguard_scan_tool_descriptions`) — bidi overrides,
   Unicode tag characters, zero-width/invisible operators, HTML comments and a
   fixed imperative phrase list, each with `{ tool, index, codepoint, kind, severity }`.
3. **Names** (`coreguard_check_lookalike`) — confusable folding + edit distance +
   mixed-script/punycode signals against the canonical reference.
4. **Change** (`coreguard_diff_tool_surface`) — what was added, removed or
   re-schema'd since the surface was approved, with `requiresReconsent`.

None of these executes the server. They make the record actionable, which is the
only honest thing a static audit can do.

## Evidence (3)

- `coreguard_redact_receipt` — masks credentials, tokens, PAN/card, email, phone
  and keys, lists every redaction with its path, and returns `originalDigest` +
  `redactedDigest`.
- `coreguard_attest_batch` — SHA-256 Merkle root over domain-separated leaves
  (0x00 leaf, 0x01 node), one self-describing proof per item.
- `coreguard_verify_batch_proof` — offline inclusion check; a mismatched root is
  reported, never rounded up.

## Operations (4)

- `coreguard_freeze_agent` — revoke + reject open approvals atomically, return
  the rejected ids and `chain.headHash`.
- `coreguard_budget_runway` — straight-line projection from pinned inputs only.
- `coreguard_detect_spend_anomaly` — median/MAD score with the threshold shown.
- `coreguard_incident_timeline` — ledger-ordered events, sequence gaps, chain status.

## Interop and meta (3)

- `coreguard_translate_receipt` — ACP / x402 / CGCR mapping with an explicit loss list.
- `coreguard_emit_test_vectors` — five vectors whose expected verdicts come from
  the same rule engine the server enforces.
- `coreguard_describe_surface` — the capability card a directory can quote.

## Boundaries

Everything is arithmetic over caller-supplied JSON. A finding is evidence for a
human decision, not a verdict on a third party. The audits do not execute the
audited server, do not resolve DNS, and do not contact a registry. `VERIFIED ≠ SAFE`.
