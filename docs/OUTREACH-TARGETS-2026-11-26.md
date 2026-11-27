# External outreach map — 0.5.1 (CG-W6/1)

This is a target list with the honest angle for each venue and the rules that keep the project credible. It is **not** a script for mass-posting. Opening promotional issues or PRs in repositories that did not ask for them is spam, gets the account restricted, and permanently costs the project the audiences it needs.

## Rules that apply to every venue

1. **Contribute value first.** A PR must fix something the maintainer already wants, or add a tested adapter they asked for. "We built a thing, please look" belongs in Discussions/Show-and-tell, not in their issue tracker.
2. **One venue, one message, tailored.** No copy-paste across repos. If the message would make sense in any repo, it is not ready.
3. **Never claim adoption, a partnership, an audit or revenue.** The repository's claims audit exists because one inflated line invalidates every real number.
4. **Respect each venue's contribution guide.** Many lists require a specific entry format and a prior issue.
5. **Disclose the relationship.** "Maintainer of CoreGuard" in the first line, every time.

## Venue map

| Venue type | Examples | What is welcome | What is not |
|---|---|---|---|
| MCP registries and directories | MCP Registry (already published), MCPRush (owner studio), awesome-MCP lists | A listing entry with the real tool count and the offline boundary | A "please upvote" ask, or a listing that quotes a stale count |
| Stellar developer surfaces | Stellar Dev Discord, Stellar community fund discussions, Soroban examples repos | A worked example (session-key gate) that runs offline, offered as a PR to an examples repo if they accept examples | A generic "we support Stellar" post |
| Smart-account and wallet projects | OpenZeppelin Stellar Contracts, Freighter, Lobstr, Rabet, passkey wallets | A focused issue: "your signer snapshot has these fields; here is a gate that consumes them — would an adapter be useful?" | Opening a PR that changes their code without an issue first |
| Anchors and SEP implementers | SEP-10/24/31 implementers, anchor platforms | A conformance gap list from real payloads, offered privately first | Publishing an anchor's failing payload without consent |
| x402 and agent-payment ecosystem | x402 facilitators, agent frameworks, MCP clients | An adapter proposal that removes a "trust the facilitator" step | Claiming a facilitator integration that does not exist |
| Bank/ISO 20022 and reconciliation | Open-source ISO 20022 parsers, payment ops communities | A test-vector contribution for camt.054/MT103 field checks | Compliance or certification claims |
| Lending and credit | DeFi lending protocols, credit-scoring projects | Collateral/credit-line evidence checks with named refusals | A credit decision or a score that implies underwriting |
| Robotics and machine economy | ROS/robotics integrators, agent-economy research groups | Mission-receipt and lease evidence as a small spec proposal | Safety certification claims |
| AI agent platforms | Claude/Codex/Gemini/Copilot/VS Code MCP directories, Cursor, Windsurf, Zed | A client-specific config snippet and one honest capability line | "Works with X" when only the stdio protocol was exercised |

## The three messages that are always acceptable

1. **A reproducible example.** "Here is a 10-minute offline walkthrough that makes the tool refuse something; the commands are in the repository." Link the Show-and-tell discussion (#153).
2. **A defect report on our side.** "Your payload failed check NO_CONFUSABLE; here is the exact input and the rule. Is our expectation wrong?" This is the highest-trust message an infrastructure project can send.
3. **A scoped offer.** "One seat, two weeks, one redacted payload, a written gap list, no payment and no logo." Link #147.

## The messages that must never be sent

- "Please integrate us" with no artifact.
- "We are the best agent payment security layer" without a test.
- A tool count that is not the published one (119 at 0.5.1).
- Anything that implies a customer, pilot, audit, funding or endorsement.

## Operating cadence (sustainable, not spammy)

| Cadence | Action |
|---|---|
| per release | Announcement discussion (own repo) + one directory update + one targeted example improvement |
| weekly | Answer every Q&A thread with a tested answer; convert two answers into docs |
| per design partner | One private gap list, then one public finding with consent |
| monthly | One upstream contribution that is a fix, not a promotion |

## How to measure without vanity metrics

Track: number of external payloads that ran through the tools; number of defects found in our checks; number of fixes shipped because of an external report. Do not track stars, impressions or "leads". A defect found by a stranger is worth more than a thousand impressions, and it is the only number that survives scrutiny.

## Live threads (updated 2026-11-27)

| Where | Thread | State | What happens next |
|---|---|---|---|
| OpenZeppelin Stellar Contracts | [#997](https://github.com/OpenZeppelin/stellar-contracts/issues/997) + [reply](https://github.com/OpenZeppelin/stellar-contracts/issues/997#issuecomment-7219929979) + [closing reply](https://github.com/OpenZeppelin/stellar-contracts/issues/997#issuecomment-7221143550) | **closed as completed, 2026-11-27** | answered: the trait already documents the fields, so no README subsection and no docs PR from us; the field list stays an external integrator note. No follow-up queued. |
| ACP | [#329 SEP](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/329) + [profile-requirements reply](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/329#issuecomment-7220171679) | proposal, awaiting sponsor | Prokura co-founder decides whether the vector belongs in ACP or `prokura-verify` |
| stellar/smart-account-kit | [#41](https://github.com/stellar/smart-account-kit/issues/41) | open, enhancement requested (label needs a maintainer) | answer on whether a snapshot helper or a docs example is the right surface. OZ's maintainer considered the example unnecessary in either repo; the question stands with this repo's maintainers, and we do not repost it. |
| x402 Foundation | [#4198](https://github.com/x402-foundation/x402/issues/4198#issuecomment-7221335078) | open, existing thread | design comment on the duplicate-payment window: return the original artifact for the same key and digest, bind the key into the signed material, dedup the facilitator on the payload digest. No new issue, no pitch. |
| x402 Foundation | [#4253](https://github.com/x402-foundation/x402/issues/4253#issuecomment-7221923150) | open, existing thread | sequential settle-retry semantics: a third `settlement_unknown` state carrying the broadcast hash, facilitator-side dedup on the canonical payload digest, the §7.1 read-only/verify conflict with durable dedup, and 402-vs-503 separation. Four rules, no product mention. |
| prokura-network/prokura-verify | [#4](https://github.com/prokura-network/prokura-verify/issues/4) | open, spec question | confirm the `receipt_id` traversal reading and where the vector lives |

Every thread above is a technical question with a runnable artifact behind it. None asks for money, a partnership or a review; if the answer is "not useful", the thread closes.

## Venues deliberately not used

- **coinbase/x402 → x402-foundation/x402** — the repo moved and `coinbase/x402` is now a development fork. Issues are open (916 at the time of writing) but `CONTRIBUTING.md` restricts them to bug reports and concrete feature proposals; questions, showcases and general design talk go to the x402 Slack, and Discussions are off. No new issue was opened. One substantive comment went to an existing thread, [#4198](https://github.com/x402-foundation/x402/issues/4198#issuecomment-7221335078), on what a duplicate caller receives when a purchase key is already reserved — the design gap that thread had not settled. No product link, no pitch, no second comment queued.
- **stellar/anchor-platform** — no `CONTRIBUTING.md` and an active security backlog; the honest entry is a private conformance gap list from real payloads, offered to the maintainers first, not a public issue.
- **Freighter / wallet repos** — the wallet draft in [`OUTREACH-3-DRAFTS-2026-11-26.md`](./OUTREACH-3-DRAFTS-2026-11-26.md) waits for a named maintainer or a support channel that accepts technical payloads.

## What can be offered without pitching

If a maintainer replies with interest, the deliverable is already built or one commit away:

- a field list for an off-chain verifier (OZ smart accounts, SEP-24 records, x402 settlement evidence);
- a deterministic vector with an expected verdict and a tamper case, runnable in their CI;
- an adapter that consumes their snapshot shape, with a named refusal vocabulary and no network calls;
- a resolution rule for a profile pointer (`receipt_id` + `profile`) that recomputes instead of trusting.
