# Trust cards for MCP servers (CG-TC/1)

One command turns an MCP server record and its `tools/list` into a card you can attach to a listing:

```bash
npx -y @coreguard/agent-commerce trust-card \
  --server-json server.json \
  --stdio "npx -y @scope/your-server"
```

The card is Markdown, deterministic, and carries its own digests. It composes the two Wave 3 tools — `coreguard_audit_server_manifest` (record structure, transport, provenance, secret-shaped env vars) and `coreguard_scan_tool_descriptions` (bidi overrides, Unicode tag characters, zero-width characters, HTML comments, fixed imperative phrases) — with the full tool inventory, a verdict and an explicit boundary.

**What it is not:** an execution, a sandbox, a source review, or a security audit. It does not install or run the server unless you pass `--stdio`, and even then it only asks for `tools/list`. `PASS ≠ SAFE`; a card with no findings is a starting point for review.

## One command

From this repository:

```bash
npm run trust:card -- --server-json packages/agent-commerce/server.json --tools-list docs/trust-cards/sources/coreguard-tools-list.json
```

From anywhere, after the next package release (or with `npx -y @coreguard/agent-commerce@latest`):

```bash
npx -y @coreguard/agent-commerce trust-card \
  --server-json ./server.json \
  --tools-list ./tools-list.json \
  --out trust-card.md \
  --json trust-card.json \
  --date 2026-11-25 \
  --fail-on high
```

`--tools-list` accepts any of the three realistic shapes:

- a bare array of tool objects (`[...]`)
- `{ "tools": [...] }`
- a full JSON-RPC `tools/list` response (`{ "result": { "tools": [...] } }`)

Or let it ask the server itself: `--stdio "npx -y @scope/server"` performs `initialize` → `notifications/initialized` → `tools/list` over stdin/stdout and uses that answer. The process is terminated as soon as the list arrives.

### Options

| Option | Meaning |
|---|---|
| `--server-json <file>` | The registry record. Required. |
| `--tools-list <file>` / `--stdio "<command>"` | Exactly one is required. A card is not issued without a scanned tool surface. |
| `--out <file\|->` | Markdown destination. Default `-` (stdout). |
| `--json <file>` | Machine-readable sidecar (`spec: CG-TC/1`). |
| `--tools-out <file>` | Writes the normalised `tools/list` used, so a card can be reproduced from committed bytes. |
| `--date <YYYY-MM-DD>` | Card date. Omitted by default so identical inputs produce identical output. |
| `--url <https://…>` | Published card URL inside the paste-ready summary. |
| `--fail-on none\|medium\|high` | Gate. Default `none`; the Action defaults to `high`. |
| `--check` | Compare with the existing `--out`/`--json` files instead of writing. Exit 1 on drift. |

Exit codes: `0` card produced (and gate passed) · `1` gate tripped or `--check` drift · `2` usage/input error, no card written.

## GitHub Action

```yaml
name: mcp-trust-card
on:
  pull_request:
    paths: ["server.json", "tools-list.json"]
  workflow_dispatch:

jobs:
  card:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: coreguard-global/CoreGuard/.github/actions/mcp-trust-card@main
        with:
          server-json: server.json
          tools-list: tools-list.json
          out: trust-card.md
          json-out: trust-card.json
          fail-on: high
      - uses: actions/upload-artifact@v4
        with:
          name: trust-card
          path: |
            trust-card.md
            trust-card.json
```

Inputs mirror the CLI: `server-json` (default `server.json`), exactly one of `tools-list` or `stdio`, `out` (default `trust-card.md`), `json-out`, `date`, `url`, `fail-on` (default `high`). Outputs: `card-path`, `verdict`.

To audit a published package instead of a committed snapshot, pass `stdio: "npx -y @scope/server"` and omit `tools-list`.

## What the card contains

1. **Verdict** — `PASS`, `REVIEW` or `BLOCKED`, with the reasons that produced it.
2. **Record findings** — pinned version, distribution, transport, repository, secret-shaped environment variables, each graded `HIGH`/`MEDIUM`/`LOW`/`INFO`.
3. **Description scan** — every finding with tool name, detector, character or phrase, and exact offset.
4. **Tool inventory** — all tools, descriptions truncated, per-tool scan status.
5. **Digests** — manifest, `tools/list`, and one card digest binding verdict and inputs.
6. **Boundary** — what was and was not checked.
7. **Paste-ready summary** — a two-line block for a listing page.

A `HIGH` record finding or a `DANGEROUS` scan yields `BLOCKED`; any medium finding, suspicious scan or missing manifest yields `REVIEW`.

## Real cards

| Card | Verdict | What it shows |
|---|---|---|
| [CoreGuard Agent Commerce](trust-cards/coreguard-agent-commerce.md) | PASS | Our own server: 94 tools, clean descriptions, pinned npm package, live `tools/list`. |
| [domdomegg/filesystem-mcp 2.0.0](trust-cards/filesystem-mcp.md) | PASS | A third-party server, from its published MCP Registry record plus its own stdio `tools/list`. Not affiliated with CoreGuard. |
| [Poisoned fixture](trust-cards/examples/poisoned-fixture.md) | BLOCKED | **Synthetic, not a real server.** Shows the gate catching a remote transport, a bidi override, an injected instruction and a Unicode tag character. |

The two real cards are checked into `docs/trust-cards/` with their inputs under `docs/trust-cards/sources/`; `npm run trust:cards:check` regenerates and compares them, so a changed tool description or record fails CI instead of leaving a stale card behind.

## Publishing on MCPRush

1. Generate the card with the URL you will host it at:
   `npx -y @coreguard/agent-commerce trust-card --server-json server.json --tools-list tools-list.json --out trust-card.md --url https://your.site/trust-card`
2. Host the Markdown (GitHub Pages, a repo file, a gist rendered by your site).
3. Paste the card's **paste-ready summary** into the listing's description or verification section, and link the hosted card next to it.
4. Keep the digests visible. They are what makes the claim checkable: a reader re-runs the command over the same record and `tools/list` and compares the card digest.
5. If the card says `BLOCKED`, do not soften the text. Fix the finding (pin the version, remove the invisible characters, replace the remote endpoint) and regenerate — the verdict is computed, not editorial.

MCPRush itself is a directory: the card is your evidence, not their grade. Nothing here asks them to endorse it, and a `PASS` card is not a substitute for their automatic scan.

## Boundary

- `PASS` means no **structural** finding was raised by these two checks. It is not safety, correctness, licensing, privacy or payment-behaviour approval.
- The scanner is intentionally narrow: a fixed invisible-character range, HTML comments, and a fixed phrase list. Novel poisoning phrasing will not be caught.
- `--stdio` runs a command you specify, on your machine, with your environment. The tool only reads `tools/list`; that command can still do anything you allowed it to do.
- No wall clock is read. `--date` is the only timestamp, and it is caller-supplied.
