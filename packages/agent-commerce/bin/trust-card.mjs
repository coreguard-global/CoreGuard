#!/usr/bin/env node
/**
 * bin wrapper — coreguard-trust-card
 *
 * MCP server listings get a publishable trust card from one command:
 *   npx -y @coreguard/agent-commerce trust-card --server-json server.json --stdio "npx -y @scope/server"
 */
import { runTrustCardCli } from "../trust-card-cli.mjs";

runTrustCardCli().then(({ code }) => {
  process.exitCode = code;
});
