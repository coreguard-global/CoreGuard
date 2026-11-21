# Agent Commerce MCP — 60s Demo Script (Success + Rejection)

**Goal:** show in under a minute that CoreGuard binds an approval, verifies an exact execution as `VERIFIED`, and rejects a changed execution as `INVALID` with named drift.

## Setup (before recording)

```bash
git clone https://github.com/coreguard-global/CoreGuard.git
cd CoreGuard
npm install   # or use existing workspace install
```

## 60-second flow

### 0:00–0:10 — What it is
"CoreGuard Agent Commerce MCP gives AI agents four local, offline tools to bind approval, verify consent, verify execution, and assess risk. No network, no keys."

### 0:10–0:25 — Run runtime smoke/demo
```bash
node scripts/agent-commerce-mcp-smoke.mjs
# or
node examples/agent-commerce-mcp/run.mjs
```

Call out on screen:
- `coreguard_authorize` -> CGCR/1 receipt
- exact execution -> `VERIFIED`
- escalated execution ($47.00 vs $12.00 approved) -> `INVALID` with named drift (`VALUE_ESCALATION` / policy violation)
- malformed input -> structured error, server still responsive

### 0:25–0:45 — Show why it matters
"An agent can be tricked or drift during execution. CoreGuard doesn't just log; it compares executed bytes against the approved receipt and fails closed with named reasons."

### 0:45–0:60 — Honest boundary
"This is offline verification: `VERIFIED ≠ SAFE`. Single-use consumption is process-local in 0.1.3; durable cross-process replay protection is `NOT_BUILT`. No live merchant/payment integration is claimed."

## Recording checklist

- [ ] Terminal font large/readable.
- [ ] Show command and final PASS line.
- [ ] Show one INVALID/drift line clearly.
- [ ] Include boundary sentence verbally or as caption.
- [ ] Do not claim production guarantees, customers, endorsements, or live payment integrations.
