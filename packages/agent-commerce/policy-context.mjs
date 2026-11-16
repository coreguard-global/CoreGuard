/**
 * Shared trace→policy-context mapping for the agent-commerce family.
 *
 * ONE mapping used by BOTH consumers of `packages/policy` inside the family:
 *
 *   - the Agent Risk Engine (AGR/1, `risk.mjs`) — policy rules evaluated
 *     against the EXECUTED order;
 *   - the composed Authorization Firewall (AC-FW/1, `firewall.mjs`) — the
 *     same rules evaluated against the DECLARED request before submission.
 *
 * Mirrors the CGEP/1 verifier's own private trace→policy mapping
 * (`packages/verifier`); the verifier keeps its copy because the layering is
 * verifier ← agent-commerce (the family may import the engine, never the
 * reverse). Sharing one mapping inside the family means a firewall decision
 * and a risk report can never disagree about what a rule saw.
 *
 * EVM selector-aware recipient decode: for transfer(address,uint256)
 * (0xa9059cbb) and transferFrom(address,address,uint256) (0x23b872dd) the
 * true recipient is a calldata argument, not `trace.to` — a policy
 * RECIPIENT_ALLOWLIST must judge the real payee.
 *
 * No wall clock, no network, no guessing: unreadable fields flow through as
 * the rule will see them, and the policy engine (or the taxonomy) decides
 * fail-closed. Same inputs → same context, byte-deterministic.
 */

export const POLICY_CONTEXT_VERSION = "AC-POLICY-CTX/1";

export function tracePolicyContext(trace) {
  const selector = String(trace.calldata ?? "0x").slice(0, 10).toLowerCase();
  let recipient = trace.to ?? null;
  if (selector === "0xa9059cbb" && String(trace.calldata ?? "").length >= 74) {
    recipient = "0x" + String(trace.calldata).slice(34, 74);
  } else if (selector === "0x23b872dd" && String(trace.calldata ?? "").length >= 138) {
    recipient = "0x" + String(trace.calldata).slice(98, 138);
  }
  return {
    value: trace.value ?? "0",
    target: trace.to ?? "0x",
    recipient: recipient ?? "0x",
    selector,
    blockTimestamp: trace.blockTimestamp ?? "0",
    slippageBps: trace.slippageBps ?? "0",
    gasUsed: trace.gasUsed ?? "0",
    priceBps: trace.priceBps ?? "10000",
  };
}
