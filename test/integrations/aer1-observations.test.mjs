/**
 * CG-OBS/1 — the observation ledger.
 *
 * Each test pins a rule the layer refuses on, in both directions: the attempt is
 * rejected with a named code, and the honest twin still records. The three-read
 * scenario is the one from the AER-1 discussion thread: a caller holding only a
 * status scope gets a 403, an auditor with a file scope matches the bytes, and
 * the file key is revoked before the status caller reads again. One run, one
 * digest, three true statements — and the earlier ones are never rewritten.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  OBSERVATION_VERSION,
  CHECK_OUTCOMES,
  NOT_CHECKED_REASONS,
  OBSERVATION_CODES,
  createLedger,
  appendObservation,
  buildLedger,
  accrue,
  describeAccrual,
  recordObservation,
  observationId,
  parseInstant,
  selfCheck,
} from "../../packages/agent-commerce/observations.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
const SUBJECT = `sha256:${"a".repeat(64)}`;
const OTHER = `sha256:${"b".repeat(64)}`;
const RECORD = "130da435-e157-498e-af90-605866a86a27";

const base = (overrides = {}) => ({
  observer: "caller:status-only",
  scope: "status:read",
  action_id: "run-0001",
  record_id: RECORD,
  subject_digest: SUBJECT,
  observed_digest: null,
  action_at: "2026-11-19T16:00:00Z",
  checked_at: "2026-11-19T16:40:00Z",
  ...overrides,
});

test("the five outcomes are the corpus vocabulary, spelled the same way", () => {
  assert.equal(OBSERVATION_VERSION, "CG-OBS/1");
  assert.deepEqual([...CHECK_OUTCOMES], [
    "verified",
    "verification_failed",
    "not_checked",
    "absent",
    "unresolvable_record",
  ]);
  // Not a rename of a boolean: every one of the five is recordable on this layer.
  for (const outcome of CHECK_OUTCOMES) {
    const input = base({
      outcome,
      observed_digest: outcome === "verified" ? SUBJECT : null,
      reason: outcome === "not_checked" ? "not_attempted" : null,
      code: outcome === "verification_failed" ? "BAD_DIGEST" : null,
    });
    assert.equal(recordObservation(input).ok, true, `${outcome} should be recordable`);
  }
});

test("verified requires the bytes that were read, and they must be the subject's", () => {
  assert.equal(recordObservation(base({ outcome: "verified" })).code, OBSERVATION_CODES.VERIFIED_WITHOUT_BYTES);
  assert.equal(
    recordObservation(base({ outcome: "verified", observed_digest: OTHER })).code,
    OBSERVATION_CODES.VERIFIED_ON_DIFFERENT_BYTES,
  );
  const good = recordObservation(base({ outcome: "verified", observed_digest: SUBJECT }));
  assert.equal(good.ok, true);
  assert.equal(good.event.observed_digest, SUBJECT);
});

test("not_checked carries a frozen reason, because the remedy differs", () => {
  assert.equal(recordObservation(base({ outcome: "not_checked" })).code, OBSERVATION_CODES.NOT_CHECKED_WITHOUT_REASON);
  assert.equal(
    recordObservation(base({ outcome: "not_checked", reason: "felt_like_it" })).code,
    OBSERVATION_CODES.UNKNOWN_REASON,
  );
  const refused = recordObservation(base({ outcome: "not_checked", reason: "access_refused" }));
  const never = recordObservation(
    base({ outcome: "not_checked", reason: "not_attempted", observer: "caller:uninvolved" }),
  );
  assert.equal(refused.ok, true);
  assert.equal(never.ok, true);
  // The two are different facts with different remedies, and the ledger keeps
  // them apart instead of collapsing both into "unknown".
  assert.notEqual(refused.event.reason, never.event.reason);
  assert.deepEqual([...NOT_CHECKED_REASONS].includes("access_revoked"), true);
});

test("a failure is named, and a reason is not used as an excuse on a finding", () => {
  assert.equal(recordObservation(base({ outcome: "verification_failed" })).code, OBSERVATION_CODES.UNNAMED_FAILURE);
  assert.equal(
    recordObservation(base({ outcome: "verification_failed", code: "BAD_DIGEST" })).ok,
    true,
  );
  assert.equal(
    recordObservation(base({ outcome: "verified", observed_digest: SUBJECT, reason: "access_refused" })).code,
    OBSERVATION_CODES.REASON_ON_CHECKED,
  );
});

test("absent means nothing was read; bytes on it make it a different outcome", () => {
  assert.equal(recordObservation(base({ outcome: "absent" })).ok, true);
  assert.equal(
    recordObservation(base({ outcome: "absent", observed_digest: SUBJECT })).code,
    OBSERVATION_CODES.ABSENT_WITH_BYTES,
  );
});

test("an unresolvable record needs the pointer that could not be resolved", () => {
  assert.equal(
    recordObservation(base({ outcome: "unresolvable_record", record_id: null })).code,
    OBSERVATION_CODES.UNRESOLVABLE_WITHOUT_POINTER,
  );
  const unresolvable = recordObservation(base({ outcome: "unresolvable_record" }));
  assert.equal(unresolvable.ok, true);
  assert.equal(unresolvable.event.record_id, RECORD);
});

test("no backdating: the read time is the checker's, never the action's", () => {
  assert.equal(
    recordObservation(base({ outcome: "not_checked", reason: "not_attempted", checked_at: null })).code,
    OBSERVATION_CODES.MISSING_READ_TIME,
  );
  assert.equal(
    recordObservation(base({ outcome: "not_checked", reason: "not_attempted", checked_at: "2026-11-19T15:59:59Z" })).code,
    OBSERVATION_CODES.READ_BEFORE_ACTION,
  );
  // A wall-clock timestamp with no offset would order the same history
  // differently in two zones, so it is refused rather than guessed.
  assert.equal(
    recordObservation(base({ outcome: "not_checked", reason: "not_attempted", checked_at: "2026-11-19T16:40:00" })).code,
    OBSERVATION_CODES.BAD_READ_TIME,
  );
  // Calendar-invalid instants fail on the calendar, not only on the regex.
  assert.equal(parseInstant("2026-02-30T00:00:00Z"), null);
  assert.equal(parseInstant("2026-11-19T16:40:00Z").ms > 0, true);
  // The action time is carried, and it is not substituted for the read time.
  const late = recordObservation(
    base({ outcome: "not_checked", reason: "not_attempted", checked_at: "2026-11-20T00:00:00Z" }),
  );
  assert.equal(late.event.action_at, "2026-11-19T16:00:00Z");
  assert.equal(late.event.checked_at, "2026-11-20T00:00:00Z");
});

test("an unknown outcome fails closed instead of becoming a pass", () => {
  assert.equal(recordObservation(base({ outcome: "probably_fine" })).code, OBSERVATION_CODES.UNKNOWN_OUTCOME);
  assert.equal(recordObservation(base({ outcome: "PASS" })).code, OBSERVATION_CODES.UNKNOWN_OUTCOME);
  assert.equal(recordObservation({ ...base({ outcome: "verified", observed_digest: SUBJECT }), observer: "" }).code, OBSERVATION_CODES.MISSING_OBSERVER);
});

test("one run, three reads: 403, match, 401 — all three statements survive", () => {
  const built = buildLedger([
    base({ outcome: "not_checked", reason: "access_refused" }),
    base({
      observer: "auditor:files",
      scope: "files:orders/*",
      outcome: "verified",
      observed_digest: SUBJECT,
      checked_at: "2026-11-19T16:52:00Z",
    }),
    base({ outcome: "not_checked", reason: "access_revoked", checked_at: "2026-11-19T17:05:00Z" }),
  ]);
  assert.equal(built.ok, true);

  const state = accrue(built.ledger, { action_id: "run-0001" });
  assert.equal(state.events, 3);
  assert.deepEqual([...state.verified_by], ["auditor:files"]);
  // The status caller's latest state is the revocation, but its earlier 403 is
  // still in the history — the later read did not edit it out.
  const caller = state.observers.find((o) => o.observer === "caller:status-only");
  assert.equal(caller.latest_reason, "access_revoked");
  assert.equal(caller.reads, 2);
  assert.equal(caller.observation_ids.length, 2);
  // A confirmation is not contested by somebody who never got to look.
  assert.equal(state.contested, false);
  assert.equal(state.composite, "verified");
  assert.equal(state.executions, 1);
  assert.equal(state.first_read_at, "2026-11-19T16:40:00Z");
  assert.equal(state.first_verified_at, "2026-11-19T16:52:00Z");

  const sentence = describeAccrual(state);
  assert.match(sentence, /1 independent confirmation/);
  assert.match(sentence, /auditor:files matched the bytes at 2026-11-19T16:52:00Z/);
  assert.match(sentence, /1 execution/);
});

test("a later contradicting read contests the confirmation instead of replacing it", () => {
  const built = buildLedger([
    base({ observer: "auditor:files", outcome: "verified", observed_digest: SUBJECT }),
    base({
      observer: "auditor:replay",
      outcome: "verification_failed",
      code: "BAD_DIGEST",
      checked_at: "2026-11-19T17:10:00Z",
    }),
  ]);
  const state = accrue(built.ledger, { action_id: "run-0001" });
  assert.equal(state.contested, true);
  assert.equal(state.composite, "verified");
  assert.deepEqual([...state.failed_by], ["auditor:replay"]);
  assert.match(describeAccrual(state), /contested by a later read/);
});

test("the ledger is append-only and chronological, so a read cannot be backfilled", () => {
  const first = appendObservation(
    createLedger(),
    base({ observer: "auditor:files", outcome: "verified", observed_digest: SUBJECT }),
  );
  assert.equal(first.ok, true);
  const backfill = appendObservation(
    first.ledger,
    base({ observer: "caller:status-only", outcome: "not_checked", reason: "not_attempted", checked_at: "2026-11-19T16:10:00Z" }),
  );
  assert.equal(backfill.ok, false);
  assert.equal(backfill.code, OBSERVATION_CODES.OUT_OF_ORDER);
  assert.equal(backfill.ledger.events.length, 1);

  // Same read replayed is the same event, not a second confirmation.
  const replay = appendObservation(
    first.ledger,
    base({ observer: "auditor:files", outcome: "verified", observed_digest: SUBJECT, checked_at: "2026-11-19T16:40:00Z" }),
  );
  assert.equal(replay.duplicate, true);
  assert.equal(replay.ledger.events.length, 1);
  assert.equal(accrue(replay.ledger, { action_id: "run-0001" }).verified_by.length, 1);
});

test("observation ids are deterministic and time-sensitive", () => {
  const a = recordObservation(base({ outcome: "verified", observed_digest: SUBJECT })).event;
  const b = recordObservation(base({ outcome: "verified", observed_digest: SUBJECT })).event;
  const c = recordObservation(
    base({ outcome: "verified", observed_digest: SUBJECT, checked_at: "2026-11-19T16:53:00Z" }),
  ).event;
  assert.equal(a.observation_id, b.observation_id);
  assert.notEqual(a.observation_id, c.observation_id);
  assert.equal(observationId(a), a.observation_id);
});

test("nothing read for a run is absent, and silence is never a failed verification", () => {
  const empty = accrue(createLedger(), { action_id: "run-never-read" });
  assert.equal(empty.events, 0);
  assert.equal(empty.composite, "absent");
  assert.match(empty.detail, /silence is not a failed verification/);
  assert.deepEqual([...empty.verified_by], []);
  assert.equal(describeAccrual(empty), "no read recorded for this run");
});

test("self-check passes without the test runner", () => {
  const report = selfCheck();
  assert.equal(report.ok, true);
  assert.ok(report.checks.length >= 5);
});

test("the committed page is generated from the pinned subject and is current", () => {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts/aer1-observations.mjs"), "--check"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);

  const page = readFileSync(join(ROOT, "docs/AER1-OBSERVATION-LEDGER.md"), "utf8");
  // The real corpus subject, recomputed at generation time.
  assert.match(page, /sha256:0492c18e09059aa2e30ba0864f6aada2ef08475a5b35944cbf2a9ce46d12b9f1/);
  assert.match(page, /kit \*\*1\.5\.7\*\*/);
  // The page publishes the refusals, not only the happy path.
  assert.match(page, /NOT_CHECKED_WITHOUT_REASON/);
  assert.match(page, /READ_BEFORE_ACTION/);
  assert.match(page, /OUT_OF_ORDER/);
  // And it says the observers are synthetic, because they are.
  assert.match(page, /observers are synthetic/);
  assert.match(page, /\| executions \| 1 \|/);
});
