# CoreGuard Agent Skills

72 agent skills that turn the `@coreguard/agent-commerce` MCP surface into
repeatable procedures. Each skill is a folder with a `SKILL.md` (YAML
frontmatter + instructions) that an agent runtime can load directly. The
table below shows the original ten; the full generated inventory with every
skill, tool reference and install line is in [`docs/SKILLS.html`](../docs/SKILLS.html)
and [`docs/skills.json`](../docs/skills.json).

Everything here is offline and deterministic: the skills call only local MCP
tools, never a network, a wallet, or a vendor API. `VERIFIED ≠ SAFE` travels in
every skill that could be read as a safety guarantee.

## The set

| Skill | Use it when |
|---|---|
| [`agent-purchase-guard`](agent-purchase-guard/SKILL.md) | an agent is about to spend money or submit an order |
| [`mcp-server-due-diligence`](mcp-server-due-diligence/SKILL.md) | before installing or listing a third-party MCP server |
| [`tool-poisoning-triage`](tool-poisoning-triage/SKILL.md) | tool descriptions look off or an agent acted on hidden instructions |
| [`agent-spend-control`](agent-spend-control/SKILL.md) | setting, reviewing or explaining spending limits |
| [`receipt-forensics`](receipt-forensics/SKILL.md) | reconstructing what was approved and proving it later |
| [`merchant-impersonation-check`](merchant-impersonation-check/SKILL.md) | a merchant/domain/package name resembles a known brand |
| [`tool-surface-drift-watch`](tool-surface-drift-watch/SKILL.md) | every MCP server upgrade or reconnect |
| [`incident-freeze-drill`](incident-freeze-drill/SKILL.md) | an agent must be stopped now, or you are rehearsing that |
| [`x402-payment-gate`](x402-payment-gate/SKILL.md) | an agent answers an HTTP 402 payment challenge |
| [`acp-interop-mapping`](acp-interop-mapping/SKILL.md) | a partner speaks a different receipt or checkout shape |

## Install

Skills are plain folders. Copy the ones you want into your runtime's skills
directory, or point the runtime at this folder:

```bash
# Claude Code / compatible runtimes
mkdir -p ~/.claude/skills
cp -r skills/* ~/.claude/skills/

# project-local
mkdir -p .claude/skills && cp -r skills/* .claude/skills/
```

The skills assume the MCP server is registered:

```json
{
  "mcpServers": {
    "coreguard": { "command": "npx", "args": ["-y", "@coreguard/agent-commerce@0.5.0"] }
  }
}
```

## Design rules these skills follow

1. **No silent fixes.** A denial is reported with its counterfactual; an agent
   never rewrites an order to make it pass.
2. **Evidence over adjectives.** Quote digests, counts and tool names. Never
   write "safe", "guaranteed" or "fraud-free".
3. **Fail closed.** Missing fields are denials, not wildcards.
4. **Pinned time.** `nowSeconds` / `asOfSeconds` are caller-supplied; a skill
   that needs time asks for it rather than reading the wall clock.
5. **Boundaries travel.** Each skill ends with what the tools cannot prove.
