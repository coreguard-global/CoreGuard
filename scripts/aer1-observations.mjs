#!/usr/bin/env node
/**
 * AER-1 observation ledger page — generate docs/AER1-OBSERVATION-LEDGER.md from
 * real reads of the pinned corpus, not from a story about them.
 *
 *   node scripts/aer1-observations.mjs            # print the page
 *   node scripts/aer1-observations.mjs --write    # write the page
 *   node scripts/aer1-observations.mjs --check    # exit 1 if the committed page is stale
 *   node scripts/aer1-observations.mjs --json     # machine-readable ledger + accrual
 *
 * The subject of the ledger is `receipt-03-live` from the pinned kit 1.5.7
 * corpus, read through CG-AER1/1 so the digest on the page is recomputed from
 * the bytes at generation time. The three observers are declared synthetic: no
 * PSP, no file service, no real 403 was involved. What is real is the shape —
 * one run, one digest, three reads at three times, and the rule that the earlier
 * read is never rewritten by the later one.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAer1Record, AER1_PARSER_VERSION } from "../packages/agent-commerce/aer1.mjs";
import {
  OBSERVATION_VERSION,
  CHECK_OUTCOMES,
  NOT_CHECKED_REASONS,
  OBSERVATION_CODES,
  createLedger,
  appendObservation,
  accrue,
  describeAccrual,
  recordObservation,
} from "../packages/agent-commerce/observations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CORPUS = join(ROOT, "test/fixtures/aer1-corpus-v1.5.7");
const OUT = join(ROOT, "docs/AER1-OBSERVATION-LEDGER.md");
const KIT = "1.5.7";
const SET_DIGEST = "sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2";
const LIVE = join(CORPUS, "base/test-vectors/valid/receipt-03-live.json");
const PARSER_FILE = join(ROOT, "packages/agent-commerce/aer1.mjs");
const OBS_FILE = join(ROOT, "packages/agent-commerce/observations.mjs");

const fileSha = (path) => `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;

function subject() {
  const raw = readFileSync(LIVE, "utf8");
  const receipt = JSON.parse(raw);
  const parsed = parseAer1Record(receipt, { expectedId: receipt.id, rawText: raw });
  if (!parsed.digest?.computed) throw new Error("receipt-03-live carried no recomputed digest");
  return { id: receipt.id, digest: parsed.digest.computed, verdict: parsed.verdict };
}

/**
 * One run, three reads. Times are explicit offsets, the action time is the
 * action's, and no read is ever restated at another read's timestamp.
 */
function scenario(s) {
  const actionAt = "2026-11-19T16:00:00Z";
  const common = {
    action_id: "run-0001",
    record_id: s.id,
    subject_digest: s.digest,
    action_at: actionAt,
  };
  return [
    {
      ...common,
      observer: "caller:status-only",
      scope: "status:read",
      outcome: "not_checked",
      reason: "access_refused",
      observed_digest: null,
      checked_at: "2026-11-19T16:40:00Z",
      evidence: { http_status: 403, note: "the read was attempted and refused; this is not a failed verification" },
    },
    {
      ...common,
      observer: "auditor:files",
      scope: "files:orders/*",
      outcome: "verified",
      observed_digest: s.digest,
      checked_at: "2026-11-19T16:52:00Z",
      evidence: { bytes_decoded: 740, note: "digest recomputed from the saved bytes, not re-serialised" },
    },
    {
      ...common,
      observer: "caller:status-only",
      scope: "status:read",
      outcome: "not_checked",
      reason: "access_revoked",
      observed_digest: null,
      checked_at: "2026-11-19T17:05:00Z",
      evidence: { http_status: 401, note: "the file key was revoked after the first successful read; access is time-varying" },
    },
  ];
}

/** Every rule the layer refuses on, exercised with a real attempted observation. */
function refusals(s) {
  const actionAt = "2026-11-19T16:00:00Z";
  const base = {
    observer: "caller:status-only",
    action_id: "run-0001",
    record_id: s.id,
    subject_digest: s.digest,
    observed_digest: null,
    action_at: actionAt,
    checked_at: "2026-11-19T16:40:00Z",
  };
  return [
    { name: "not_checked with no reason", input: { ...base, outcome: "not_checked" } },
    { name: "not_checked with an invented reason", input: { ...base, outcome: "not_checked", reason: "felt_like_it" } },
    { name: "verified with no bytes read", input: { ...base, outcome: "verified" } },
    { name: "verified on a different digest", input: { ...base, outcome: "verified", observed_digest: `sha256:${"1".repeat(64)}` } },
    { name: "an anonymous failure", input: { ...base, outcome: "verification_failed" } },
    { name: "absent carrying bytes", input: { ...base, outcome: "absent", observed_digest: s.digest } },
    { name: "a read before the action", input: { ...base, outcome: "not_checked", reason: "not_attempted", checked_at: "2026-11-19T15:59:59Z" } },
    { name: "a reason on a finding", input: { ...base, outcome: "verified", observed_digest: s.digest, reason: "access_refused" } },
    { name: "an outcome this build does not know", input: { ...base, outcome: "probably_fine" } },
    { name: "an observation with no observer", input: { ...base, observer: "", outcome: "not_checked", reason: "not_attempted" } },
  ];
}

/** The append-order rule: a backfilled read is refused, so it cannot precede the decision it never informed. */
function ordering(s) {
  let ledger = createLedger();
  const later = {
    observer: "auditor:files",
    action_id: "run-0001",
    record_id: s.id,
    subject_digest: s.digest,
    observed_digest: s.digest,
    outcome: "verified",
    checked_at: "2026-11-19T16:52:00Z",
  };
  const backfill = {
    ...later,
    observer: "caller:status-only",
    observed_digest: null,
    outcome: "not_checked",
    reason: "not_attempted",
    checked_at: "2026-11-19T16:10:00Z",
  };
  const first = appendObservation(ledger, later);
  ledger = first.ledger;
  const second = appendObservation(ledger, backfill);
  return { appended: first.ok === true, refused: second.code === OBSERVATION_CODES.OUT_OF_ORDER, detail: second.detail };
}

function build() {
  const s = subject();
  const built = [];
  let ledger = createLedger();
  for (const input of scenario(s)) {
    const appended = appendObservation(ledger, input);
    if (!appended.ok) throw new Error(`scenario observation refused: ${appended.code} ${appended.detail}`);
    ledger = appended.ledger;
    built.push({ input, event: appended.event, accrual: accrue(ledger, { action_id: "run-0001" }) });
  }
  return {
    s,
    steps: built,
    final: accrue(ledger, { action_id: "run-0001" }),
    ledger,
    refusals: refusals(s).map((r) => ({
      name: r.name,
      code: recordObservation(r.input).code,
    })),
    ordering: ordering(s),
  };
}

function render(report) {
  const { s, steps, final } = report;
  const out = [];
  out.push("# AER-1 observation ledger — a verification is an event, not a property of the run");
  out.push("");
  out.push(`Layer \`${OBSERVATION_VERSION}\` · subject \`receipt-03-live\` from kit **${KIT}** · digest \`${s.digest}\` · parser \`${AER1_PARSER_VERSION}\`.`);
  out.push("");
  out.push("Generated by `node scripts/aer1-observations.mjs --write`. The subject is a real receipt from the pinned corpus, read through CG-AER1/1 so the digest on this page is recomputed from the bytes at generation time. **The three observers are synthetic** — no PSP, no file service and no real 403 was involved. What is real is the shape they demonstrate.");
  out.push("");
  out.push("## The rule this page exists to state");
  out.push("");
  out.push("A verdict on a run is not one fact. It is a history of reads, and each read belongs to one observer at one time, over specific bytes. Collapsing that history into a single field on the run is how a 403 becomes a failed verification, how a read at 17:05 becomes evidence about 09:00, and how a caller inherits a verdict nobody can scope.");
  out.push("");
  out.push("| Field | What it holds | Never substituted by |");
  out.push("|---|---|---|");
  out.push("| `observer` | who ran the check | the run's owner, or the verifier's host |");
  out.push("| `scope` | the access that observer held | a claim about what access exists |");
  out.push("| `observed_digest` | the bytes that observer recomputed | the digest the record *states* |");
  out.push("| `checked_at` | when the read happened | the action's timestamp, or the decision's |");
  out.push("| `outcome` | one of the five corpus outcomes | a boolean pass/fail |");
  out.push("| `reason` | why a check did not happen | a generic error string |");
  out.push("");
  out.push("## One run, three reads");
  out.push("");
  out.push("| # | Observer | Scope | Outcome | Reason / code | Read at | Accrual after this read |");
  out.push("|---|---|---|---|---|---|---|");
  steps.forEach((step, i) => {
    const e = step.event;
    out.push(
      `| ${i + 1} | \`${e.observer}\` | \`${e.scope ?? "—"}\` | \`${e.outcome}\` | ${e.reason ? `\`${e.reason}\`` : e.code ? `\`${e.code}\`` : "—"} | ${e.checked_at} | ${step.accrual.verified_by.length} confirmed · ${step.accrual.not_checked_by.length} not checked |`,
    );
  });
  out.push("");
  out.push("Each row is an immutable event with its own `observation_id` (a digest over observer, scope, bytes, outcome and read time). The third read does not overwrite the first: `caller:status-only` is still **not checked / access_refused at 16:40** in the history, and **not checked / access_revoked at 17:05** in its latest state. Both are true. Neither is a failure of the receipt.");
  out.push("");
  out.push("What the run supports, stated by the layer itself:");
  out.push("");
  out.push("```");
  out.push(describeAccrual(final));
  out.push("```");
  out.push("");
  out.push("| Accrual field | Value |");
  out.push("|---|---|");
  out.push(`| independent confirmations | ${final.verified_by.length} (\`${final.verified_by.join("`, `") || "—"}\`) |`);
  out.push(`| not checked, by observer | ${final.not_checked_by.map((n) => `\`${n.observer}\` (${n.reason})`).join(" · ") || "—"} |`);
  out.push(`| first read / first confirmation | ${final.first_read_at} / ${final.first_verified_at} |`);
  out.push(`| composite | \`${final.composite}\` |`);
  out.push(`| contested | ${final.contested} |`);
  out.push(`| executions | ${final.executions} |`);
  out.push("");
  out.push("`executions: 1` is the whole point of the last row. The second and third reads added evidence about the same execution; neither replayed it.");
  out.push("");
  out.push("`contested` is `false` here for a reason worth naming: the third read is an access refusal, and somebody who could not look does not contradict somebody who did. Only a later read that **looked at bytes and refused them** (`verification_failed`) sets `contested: true` — and even then the confirmation stays on the page instead of being quietly replaced by the newer row. A flag that fired on every partial-access run would train readers to ignore it.");
  out.push("");
  out.push("## What the layer refuses, by name");
  out.push("");
  out.push("Every refusal below is an attempted observation run against the same real subject at generation time, and the code is the layer's answer — not prose about the answer.");
  out.push("");
  out.push("| Attempt | Refused with |");
  out.push("|---|---|");
  for (const r of report.refusals) out.push(`| ${r.name} | \`${r.code}\` |`);
  out.push("");
  out.push(`Append order is enforced separately: a read appended after a later read is refused \`${report.ordering.refused ? OBSERVATION_CODES.OUT_OF_ORDER : "NOT_REFUSED"}\` — ${report.ordering.refused ? "a backfilled observation cannot be made to look like evidence that existed before the decision it never informed" : "**the ordering rule did not fire, which is a defect on this page**"}.`);
  out.push("");
  out.push("## The five outcomes and the six reasons");
  out.push("");
  out.push("| Outcomes | |");
  out.push("|---|---|");
  out.push(`| ${CHECK_OUTCOMES.map((o) => `\`${o}\``).join(" | ")} | |`);
  out.push("");
  out.push("`not_checked` reasons, frozen because the remedy differs:");
  out.push("");
  out.push("| Reason | Remedy |");
  out.push("|---|---|");
  const remedies = {
    not_attempted: "nothing to fix on the record — nobody tried",
    access_refused: "re-scope the caller, or read with another identity",
    access_revoked: "the credential is gone; obtain access again",
    outside_scope: "this verifier never claims that layer",
    unsupported_family: "a build limitation, named as one",
    schema_not_implemented: "upgrade the parser, then re-read",
  };
  for (const reason of NOT_CHECKED_REASONS) out.push(`| \`${reason}\` | ${remedies[reason]} |`);
  out.push("");
  out.push("## Pins");
  out.push("");
  out.push("| Side | Pin |");
  out.push("|---|---|");
  out.push(`| Corpus | kit ${KIT} · \`${SET_DIGEST}\` |`);
  out.push(`| Subject | \`${s.id}\` · \`${s.digest}\` · parser verdict \`${s.verdict}\` |`);
  out.push(`| Code | observations \`${fileSha(OBS_FILE)}\` · parser \`${fileSha(PARSER_FILE)}\` |`);
  out.push("");
  out.push("## Boundary");
  out.push("");
  out.push("- This layer observes what a verifier read. It never observes the world: matching bytes settle what the saved record says, not whether the purchase, delivery or transfer happened.");
  out.push("- No clock, no network, no keys. Every timestamp is supplied by the caller, which is what makes a replay of the same ledger byte-identical.");
  out.push("- `absent` is not a failure, `not_checked` is not a failure, and neither may be rendered as a refusal. Only `verification_failed` and `unresolvable_record` are findings about the record.");
  out.push("- The observers on this page are synthetic. The digest, the id and the recomputation are not.");
  out.push("");
  return out.join("\n");
}

const report = build();
const page = render(report);
const mode = process.argv[2] ?? "";

if (mode === "--json") {
  process.stdout.write(
    JSON.stringify(
      {
        observation_version: OBSERVATION_VERSION,
        subject: report.s,
        events: report.ledger.events,
        accrual: report.final,
        refusals: report.refusals,
        ordering: report.ordering,
      },
      null,
      2,
    ),
  );
  process.stdout.write("\n");
} else if (mode === "--write") {
  writeFileSync(OUT, `${page}\n`);
  process.stdout.write(`wrote ${OUT} (${report.ledger.events.length} observations, ${report.final.verified_by.length} confirmation)\n`);
} else if (mode === "--check") {
  if (!existsSync(OUT)) {
    process.stderr.write(`MISSING ${OUT} — run: node scripts/aer1-observations.mjs --write\n`);
    process.exit(1);
  }
  const committed = readFileSync(OUT, "utf8");
  if (committed.trimEnd() !== page.trimEnd()) {
    process.stderr.write(`STALE ${OUT} — run: node scripts/aer1-observations.mjs --write\n`);
    process.exit(1);
  }
  process.stdout.write(`OK ${OUT} is current (${report.ledger.events.length} observations)\n`);
} else {
  process.stdout.write(`${page}\n`);
}
