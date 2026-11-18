#!/usr/bin/env node
/**
 * bin wrapper — runs the CoreGuard Agent Commerce stdio MCP server.
 *
 * MCP client configuration (mcpServers):
 *   { "command": "npx", "args": ["-y", "@coreguard/agent-commerce"] }
 *
 * Offline by construction: no network calls, no keys, no wall clock.
 */
import { main } from "../mcp.mjs";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
