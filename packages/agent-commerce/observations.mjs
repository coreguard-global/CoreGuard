/**
 * CoreGuard Observation Ledger (CG-OBS/1) — a verification is an event, not a
 * property of the run.
 *
 * The outcome layer (CG-OUT/1) answers what a consumer may conclude about a
 * record it was handed. It cannot answer two questions that keep deciding real
 * disputes:
 *
 *   who looked        two callers on the same run, one with a file scope and one
 *                     without, do not hold the same evidence — and the one that
 *                     got a 403 did not fail a check, it never ran one
 *   when they looked  the bytes had a digest before the decision and the same
 *                     digest after it; a read at 18:00 is evidence about 18:00,
 *                     and backdating it to 09:00 invents knowledge the approver
 *                     never had
 *
 * So this layer records observations, one immutable event per (observer, read).
 * An event carries the observer, the scope that observer held, the bytes they
 * actually recomputed, the read time, and the action time it refers to — which
 * is never substituted for the read time. Five outcomes, the same five words the
 * AER-1 corpus uses, plus a named reason on `not_checked`, because "not checked"
 * with no why is the vague answer that makes the remedy unknowable: wait, or
 * re-scope the caller.
 *
 * What the ledger is for, concretely:
 *   - A later read adds evidence. `accrue()` reports the run as verified-by two
 *     observers without rewriting the first observer's 403 into a failure, and
 *     without a second execution (executions stays 1).
 *   - Access is time-varying. 403 at T1, matched at T2, 401 at T3 are three true
 *     statements about one run, and all three stay in the history.
 *   - A contradiction is a contest, not an edit. A later `verification_failed`
 *     marks the aggregate `contested: true` instead of silently replacing the
 *     verified row.
 *
 * BOUNDARY (standing, load-bearing):
 *   - This layer never asserts that an outside effect occurred. Matching bytes
 *     settle what the saved record says; nothing here observes the world.
 *   - It is pure and deterministic: no clock, no network, no keys. Every time in
 *     an event is supplied by the caller, which is what makes a replay exact.
 *   - `absent` cannot carry bytes, `not_checked` cannot omit a reason, and a
 *     failure cannot be anonymous. Each refusal is a named code, tested.
 *   - The ledger is append-only and chronological. An event whose read time
 *     precedes the last appended event is refused (`OUT_OF_ORDER`), because
 *     inserting a read "before" the moment it was needed is precisely how a
 *     verdict nobody had gets inherited downstream.
 */

import { createHash } from "node:crypto";

export const OBSERVATION_VERSION = "CG-OBS/1";

/** The five outcomes, spelled exactly as the AER-1 corpus spells them. */
export const CHECK_OUTCOMES = Object.freeze([
  "verified",
  "verification_failed",
  "not_checked",
  "absent",
  "unresolvable_record",
]);

/**
 * Why a check did not happen. The reason decides the remedy, so it is frozen:
 * `access_refused` is re-scope the caller, `access_revoked` is the key is gone,
 * `not_attempted` is nobody tried, `outside_scope` is this verifier never
 * claims that layer, `unsupported_family` and `schema_not_implemented` are a
 * build limitation named as such.
 */
export const NOT_CHECKED_REASONS = Object.freeze([
  "not_attempted",
  "access_refused",
  "access_revoked",
  "outside_scope",
  "unsupported_family",
  "schema_not_implemented",
]);

/** Named refusals. A rejected observation is never a generic error string. */
export const OBSERVATION_CODES = Object.freeze({
  BAD_INPUT: "BAD_INPUT",
  UNKNOWN_OUTCOME: "UNKNOWN_OUTCOME",
  MISSING_OBSERVER: "MISSING_OBSERVER",
  MISSING_ACTION: "MISSING_ACTION",
  MISSING_RECORD: "MISSING_RECORD",
  MISSING_SUBJECT_DIGEST: "MISSING_SUBJECT_DIGEST",
  MISSING_READ_TIME: "MISSING_READ_TIME",
  BAD_READ_TIME: "BAD_READ_TIME",
  READ_BEFORE_ACTION: "READ_BEFORE_ACTION",
  NOT_CHECKED_WITHOUT_REASON: "NOT_CHECKED_WITHOUT_REASON",
  UNKNOWN_REASON: "UNKNOWN_REASON",
  REASON_ON_CHECKED: "REASON_ON_CHECKED",
  VERIFIED_WITHOUT_BYTES: "VERIFIED_WITHOUT_BYTES",
  VERIFIED_ON_DIFFERENT_BYTES: "VERIFIED_ON_DIFFERENT_BYTES",
  UNNAMED_FAILURE: "UNNAMED_FAILURE",
  ABSENT_WITH_BYTES: "ABSENT_WITH_BYTES",
  UNRESOLVABLE_WITHOUT_POINTER: "UNRESOLVABLE_WITHOUT_POINTER",
  OUT_OF_ORDER: "OUT_OF_ORDER",
});

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/**
 * RFC 3339 instant, calendar-valid, with an explicit offset. Deliberately
 * strict: a date without a zone is a wall-clock guess, and two observers in two
 * zones would order the same history differently.
 */
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function parseInstant(value) {
  const s = text(value);
  if (!s) return null;
  const m = INSTANT.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(sec);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 60) return null;
  // Calendar validation, not just range validation: Date.parse silently rolls
  // 2026-02-30 forward to 2026-03-02, which would let an impossible read time
  // into an append-only history. Compare the components back, in UTC so the
  // offset does not shift them, and treat a leap second as the second it names.
  const calendarSecond = second === 60 ? 59 : second;
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, calendarSecond));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    probe.getUTCSeconds() !== calendarSecond
  ) {
    return null;
  }
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return { ms, lexeme: s };
}

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const normaliseDigest = (value) => {
  const s = text(value);
  if (!s) return null;
  const bare = s.replace(/^sha256:/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(bare) ? `sha256:${bare}` : null;
};

/** Deterministic event identity: same observation, same id, in every replay. */
export function observationId(event) {
  const identity = JSON.stringify({
    v: OBSERVATION_VERSION,
    observer: event.observer,
    scope: event.scope,
    action_id: event.action_id,
    record_id: event.record_id,
    subject_digest: event.subject_digest,
    observed_digest: event.observed_digest,
    outcome: event.outcome,
    code: event.code,
    reason: event.reason,
    checked_at: event.checked_at,
  });
  return sha256(identity);
}

/**
 * Validate one observation and freeze it. Pure: no clock is read, nothing is
 * inferred, and every refusal names the rule that produced it.
 *
 *   observer         who ran the check (a caller identity, not a host name)
 *   scope            the access that observer held, e.g. "files:orders/*"
 *   action_id        the run this observation is about; never re-executed
 *   record_id        the record/pointer that was checked, when one exists
 *   subject_digest   the digest the claim is about
 *   observed_digest  what the observer actually recomputed (null if not read)
 *   outcome          one of CHECK_OUTCOMES
 *   code             required for verification_failed: a named reject code
 *   reason           required for not_checked, forbidden elsewhere
 *   checked_at       the read time, supplied by the caller
 *   action_at        when the action happened; never used as checked_at
 *   evidence         optional caller facts (bytes_decoded, note) — opaque here
 */
export function recordObservation(input) {
  if (!isObject(input)) return reject(OBSERVATION_CODES.BAD_INPUT, "an observation must be an object");

  const observer = text(input.observer);
  if (!observer) return reject(OBSERVATION_CODES.MISSING_OBSERVER, "an observation without an observer is an anonymous verdict");

  const actionId = text(input.action_id);
  if (!actionId) return reject(OBSERVATION_CODES.MISSING_ACTION, "an observation must name the run it is about");

  const recordId = text(input.record_id);

  const outcome = text(input.outcome);
  if (!outcome) return reject(OBSERVATION_CODES.UNKNOWN_OUTCOME, `outcome is required; one of ${CHECK_OUTCOMES.join(", ")}`);
  if (!CHECK_OUTCOMES.includes(outcome)) {
    // Fail closed: an unrecognised outcome from somebody else's report never
    // becomes a pass, and never becomes a pass by being ignored either.
    return reject(OBSERVATION_CODES.UNKNOWN_OUTCOME, `unknown outcome "${outcome}"`);
  }

  const subjectDigest = normaliseDigest(input.subject_digest);
  if (!subjectDigest) return reject(OBSERVATION_CODES.MISSING_SUBJECT_DIGEST, "an observation must name the digest it is about");

  const observedRaw = input.observed_digest;
  const observedDigest = observedRaw === null || observedRaw === undefined ? null : normaliseDigest(observedRaw);
  if (observedRaw !== null && observedRaw !== undefined && !observedDigest) {
    return reject(OBSERVATION_CODES.BAD_INPUT, "observed_digest must be a sha256 digest or null");
  }

  const checked = parseInstant(input.checked_at);
  if (!text(input.checked_at)) return reject(OBSERVATION_CODES.MISSING_READ_TIME, "checked_at is required: the checker's read time is part of the claim");
  if (!checked) return reject(OBSERVATION_CODES.BAD_READ_TIME, "checked_at must be a calendar-valid RFC 3339 instant with an explicit offset");

  const action = input.action_at === null || input.action_at === undefined ? null : parseInstant(input.action_at);
  if (input.action_at !== null && input.action_at !== undefined && !action) {
    return reject(OBSERVATION_CODES.BAD_INPUT, "action_at must be a calendar-valid RFC 3339 instant when supplied");
  }
  if (action && checked.ms < action.ms) {
    return reject(OBSERVATION_CODES.READ_BEFORE_ACTION, "checked_at precedes action_at: bytes cannot be read before the action that produced them");
  }

  const reason = text(input.reason);
  const code = text(input.code);

  if (outcome === "not_checked") {
    if (!reason) return reject(OBSERVATION_CODES.NOT_CHECKED_WITHOUT_REASON, "not_checked must carry its reason, because the remedy differs");
    if (!NOT_CHECKED_REASONS.includes(reason)) return reject(OBSERVATION_CODES.UNKNOWN_REASON, `unknown not_checked reason "${reason}"`);
  } else if (reason) {
    return reject(OBSERVATION_CODES.REASON_ON_CHECKED, `reason is reserved for not_checked; "${outcome}" carries a finding, not a excuse`);
  }

  if (outcome === "verified") {
    if (!observedDigest) return reject(OBSERVATION_CODES.VERIFIED_WITHOUT_BYTES, "verified requires the bytes the observer recomputed");
    if (observedDigest !== subjectDigest) {
      return reject(OBSERVATION_CODES.VERIFIED_ON_DIFFERENT_BYTES, "verified requires the recomputed digest to equal the subject digest");
    }
  }

  if (outcome === "verification_failed" && !code) {
    return reject(OBSERVATION_CODES.UNNAMED_FAILURE, "verification_failed requires a named code; an anonymous no is not a finding");
  }

  if (outcome === "absent" && observedDigest) {
    return reject(OBSERVATION_CODES.ABSENT_WITH_BYTES, "absent means nothing was read; bytes on the record make it a different outcome");
  }

  if (outcome === "unresolvable_record" && !recordId) {
    return reject(OBSERVATION_CODES.UNRESOLVABLE_WITHOUT_POINTER, "unresolvable_record needs the pointer that could not be resolved");
  }

  const event = {
    observation_version: OBSERVATION_VERSION,
    observer,
    scope: text(input.scope),
    action_id: actionId,
    record_id: recordId,
    subject_digest: subjectDigest,
    observed_digest: observedDigest,
    outcome,
    code: code ?? null,
    reason: reason ?? null,
    checked_at: checked.lexeme,
    action_at: action?.lexeme ?? null,
    evidence: isObject(input.evidence) ? Object.freeze({ ...input.evidence }) : null,
  };
  const frozen = Object.freeze({ ...event, observation_id: observationId(event) });
  return Object.freeze({ ok: true, code: null, event: frozen });
}

function reject(code, detail) {
  return Object.freeze({ ok: false, code, detail, event: null });
}

/** An empty ledger. Events are append-only and ordered by read time. */
export function createLedger() {
  return Object.freeze({ observation_version: OBSERVATION_VERSION, events: Object.freeze([]) });
}

/**
 * Append one observation. Refuses out-of-order reads: a read appended with an
 * earlier `checked_at` than the ledger's newest event is a backfill, and a
 * backfilled read can be made to look like evidence that existed before the
 * decision. The reader who actually looked at 09:00 should have appended then.
 */
export function appendObservation(ledger, input) {
  const base = isObject(ledger) && Array.isArray(ledger.events) ? ledger : createLedger();
  const recorded = recordObservation(input);
  if (!recorded.ok) return Object.freeze({ ok: false, code: recorded.code, detail: recorded.detail, ledger: base, event: null });

  const last = base.events[base.events.length - 1] ?? null;
  if (last) {
    const lastAt = parseInstant(last.checked_at);
    const nextAt = parseInstant(recorded.event.checked_at);
    if (lastAt && nextAt && nextAt.ms < lastAt.ms) {
      return Object.freeze({
        ok: false,
        code: OBSERVATION_CODES.OUT_OF_ORDER,
        detail: `read at ${recorded.event.checked_at} precedes the ledger's last read at ${last.checked_at}`,
        ledger: base,
        event: null,
      });
    }
  }

  const duplicate = base.events.some((e) => e.observation_id === recorded.event.observation_id);
  if (duplicate) {
    // Same observer, same bytes, same read time: the event already exists. Not
    // an error — a replay of the same read should not double-count.
    return Object.freeze({ ok: true, code: null, detail: "duplicate observation ignored", ledger: base, event: recorded.event, duplicate: true });
  }

  const events = Object.freeze([...base.events, recorded.event]);
  return Object.freeze({
    ok: true,
    code: null,
    detail: null,
    duplicate: false,
    ledger: Object.freeze({ observation_version: OBSERVATION_VERSION, events }),
    event: recorded.event,
  });
}

/** Build a ledger from a list of observations, refusing the whole batch on the first defect. */
export function buildLedger(inputs = []) {
  let ledger = createLedger();
  for (const input of inputs) {
    const appended = appendObservation(ledger, input);
    if (!appended.ok) return Object.freeze({ ok: false, code: appended.code, detail: appended.detail, ledger: appended.ledger });
    ledger = appended.ledger;
  }
  return Object.freeze({ ok: true, code: null, detail: null, ledger });
}

const at = (event) => parseInstant(event.checked_at).ms;

/**
 * accrue(ledger, { action_id, subject_digest? }) — what the recorded reads
 * support, per observer, with the history kept intact.
 *
 * The aggregate is deliberately not a single verdict. It reports who confirmed
 * the bytes and when, who could not and why, and whether a later read contests
 * an earlier confirmation. `executions` is always 1: a re-read adds evidence, it
 * never replays the action.
 */
export function accrue(ledger, { action_id, subject_digest } = {}) {
  const events = (isObject(ledger) && Array.isArray(ledger.events) ? ledger.events : [])
    .filter((e) => (action_id ? e.action_id === action_id : true))
    .filter((e) => (subject_digest ? e.subject_digest === normaliseDigest(subject_digest) : true))
    .slice()
    .sort((a, b) => at(a) - at(b));

  if (events.length === 0) {
    return Object.freeze({
      observation_version: OBSERVATION_VERSION,
      action_id: action_id ?? null,
      events: 0,
      observers: Object.freeze([]),
      verified_by: Object.freeze([]),
      not_checked_by: Object.freeze([]),
      first_read_at: null,
      last_read_at: null,
      composite: "absent",
      contested: false,
      executions: 1,
      detail: "nothing has been read for this run — silence is not a failed verification",
    });
  }

  const byObserver = new Map();
  for (const event of events) {
    const entry = byObserver.get(event.observer) ?? { observer: event.observer, history: [], scopes: new Set() };
    entry.history.push(event);
    if (event.scope) entry.scopes.add(event.scope);
    byObserver.set(event.observer, entry);
  }

  const observers = [...byObserver.values()].map((entry) => {
    const latest = entry.history[entry.history.length - 1];
    return Object.freeze({
      observer: entry.observer,
      latest_outcome: latest.outcome,
      latest_code: latest.code,
      latest_reason: latest.reason,
      latest_checked_at: latest.checked_at,
      scopes: Object.freeze([...entry.scopes]),
      reads: entry.history.length,
      observation_ids: Object.freeze(entry.history.map((e) => e.observation_id)),
    });
  });

  const verifiedBy = observers.filter((o) => o.latest_outcome === "verified").map((o) => o.observer);
  const notCheckedBy = observers
    .filter((o) => o.latest_outcome === "not_checked")
    .map((o) => Object.freeze({ observer: o.observer, reason: o.latest_reason, at: o.latest_checked_at }));
  const failedBy = observers.filter((o) => o.latest_outcome === "verification_failed").map((o) => o.observer);
  const absentBy = observers.filter((o) => o.latest_outcome === "absent").map((o) => o.observer);

  // A contest is a later read that disagrees with an earlier confirmation. It is
  // reported, never resolved here: resolving it is a policy decision, and this
  // layer does not decide policy.
  // Only a read that looked at bytes and refused them contests a confirmation.
  // An access refusal afterwards is a different observer's state, not a
  // contradiction: it says the second observer could not look, not that the
  // first observer's match was wrong. Treating those as contests would make
  // every partial-access run permanently disputed and teach readers to ignore
  // the flag.
  const firstVerified = events.find((e) => e.outcome === "verified") ?? null;
  const contested = firstVerified !== null && events.some((e) => at(e) > at(firstVerified) && e.outcome === "verification_failed");

  let composite;
  if (firstVerified) {
    composite = "verified";
  } else if (failedBy.length > 0) {
    composite = "verification_failed";
  } else if (absentBy.length > 0 && absentBy.length === observers.length) {
    composite = "absent";
  } else if (notCheckedBy.length > 0) {
    composite = "not_checked";
  } else {
    composite = "unresolvable_record";
  }

  return Object.freeze({
    observation_version: OBSERVATION_VERSION,
    action_id: action_id ?? events[0].action_id,
    events: events.length,
    observers: Object.freeze(observers),
    verified_by: Object.freeze(verifiedBy),
    not_checked_by: Object.freeze(notCheckedBy),
    failed_by: Object.freeze(failedBy),
    absent_by: Object.freeze(absentBy),
    first_read_at: events[0].checked_at,
    first_verified_at: firstVerified?.checked_at ?? null,
    last_read_at: events[events.length - 1].checked_at,
    composite,
    contested,
    executions: 1,
    detail: null,
  });
}

/**
 * The one-line statement the layer exists to make printable: who saw what, for
 * which bytes, at which time. Never collapses two observers into one verdict.
 */
export function describeAccrual(accrual) {
  if (!accrual || accrual.events === 0) return "no read recorded for this run";
  // Confirmations first: the sentence a risk system quotes is "who matched the
  // bytes", and burying that after two observers who could not read invites the
  // reader to scan for the refusal and stop there.
  const ordered = [...accrual.observers].sort((a, b) => {
    const rank = (o) => (o.latest_outcome === "verified" ? 0 : o.latest_outcome === "not_checked" ? 2 : 1);
    return rank(a) - rank(b) || a.observer.localeCompare(b.observer);
  });
  const parts = ordered.map((o) => {
    const verb =
      o.latest_outcome === "verified"
        ? "matched the bytes"
        : o.latest_outcome === "not_checked"
          ? `did not check (${o.latest_reason})`
          : o.latest_outcome === "verification_failed"
            ? `refused (${o.latest_code})`
            : o.latest_outcome === "absent"
              ? "found nothing to read"
              : "could not resolve the record";
    return `${o.observer} ${verb} at ${o.latest_checked_at}`;
  });
  const contested = accrual.contested ? " · contested by a later read" : "";
  const confirmations = accrual.verified_by.length;
  return `${confirmations} independent confirmation${confirmations === 1 ? "" : "s"}: ${parts.join("; ")}${contested} · 1 execution`;
}

/** Self-check for callers that cannot run the test suite. */
export function selfCheck() {
  const subject = `sha256:${"0".repeat(64)}`;
  const base = {
    observer: "psp:risk-eu",
    action_id: "run-1",
    record_id: "130da435-e157-498e-af90-605866a86a27",
    subject_digest: subject,
    observed_digest: subject,
    action_at: "2026-11-19T16:00:00Z",
  };
  const verified = recordObservation({ ...base, outcome: "verified", checked_at: "2026-11-19T16:40:00Z" });
  const unchecked = recordObservation({
    ...base,
    observed_digest: null,
    outcome: "not_checked",
    reason: "access_refused",
    checked_at: "2026-11-19T16:40:00Z",
  });
  const noReason = recordObservation({
    ...base,
    observed_digest: null,
    outcome: "not_checked",
    checked_at: "2026-11-19T16:40:00Z",
  });
  const backdated = recordObservation({ ...base, outcome: "verified", checked_at: "2026-11-19T15:00:00Z" });
  const built = buildLedger([
    { ...base, observed_digest: null, outcome: "not_checked", reason: "access_refused", checked_at: "2026-11-19T16:10:00Z" },
    { ...base, observer: "auditor:files", outcome: "verified", checked_at: "2026-11-19T16:40:00Z" },
  ]);
  const checks = [
    { name: "verified observation recorded", pass: verified.ok === true },
    { name: "not_checked keeps its reason", pass: unchecked.ok === true && unchecked.event.reason === "access_refused" },
    { name: "not_checked without a reason is refused", pass: noReason.code === OBSERVATION_CODES.NOT_CHECKED_WITHOUT_REASON },
    { name: "a read before the action is refused", pass: backdated.code === OBSERVATION_CODES.READ_BEFORE_ACTION },
    { name: "two observers accrue two independent facts", pass: built.ok === true && accrue(built.ledger, { action_id: "run-1" }).verified_by.length === 1 },
  ];
  return Object.freeze({
    observationVersion: OBSERVATION_VERSION,
    outcomes: CHECK_OUTCOMES,
    reasons: NOT_CHECKED_REASONS,
    checks,
    ok: checks.every((c) => c.pass),
  });
}
