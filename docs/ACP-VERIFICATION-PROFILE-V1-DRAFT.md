# AER-1 verification profile — observer-scoped (draft, for ACP review)

**Status:** draft, written for the ACP discussion on AER-1 (`agentic-commerce-protocol#328`) at the invitation of the draft's author. It is **not** a submitted SEP, not ratified, and not an ACP conformance claim. It is a section proposal plus a working implementation that can be measured.

**What it adds:** the run-level outcome dictionary stays exactly as the draft defines it. This profile layers *who read what, when* around that outcome, because a verdict on a run is not one fact — it is a history of reads.

**What it does not add:** a sixth outcome, a replacement dictionary, a scoring scheme, or any claim about the world. `VERIFIED ≠ SAFE` applies to every sentence below.

---

## 0. Why this section exists

Three failures recur in real disputes, and none of them is visible in a single run-level outcome:

1. **A refused read becomes a failed verification.** A caller with a status scope asks for files, gets 403, and the run is recorded `verification_failed`. Nothing was verified and nothing failed — a check never ran. The remedy is to re-scope the caller, not to re-issue the record.
2. **A later read becomes evidence about an earlier moment.** A file key is revoked at 17:05 and the read at 17:05 is `not_checked`. A decision taken at 09:00 is then reported as having been made on a not-checked record, which is false in the only direction that matters: the approver had the bytes at 09:00.
3. **A verdict is inherited by a reader who never had it.** A row is inserted, re-keyed or backfilled into a ledger and the sequence now reads as if a check that happened later informed a decision taken earlier.

The profile fixes the shape, not the truth: it makes each read an event with an owner and a scope, refuses backdating, and keeps a later contradiction beside the earlier confirmation instead of overwriting it.

---

## 1. Scope

This profile applies to records that already carry an AER-1 verification outcome. It defines:

- the **observation event**: one immutable row per (observer, read);
- the **outcome vocabulary**: the five words the draft already uses, unchanged;
- the **reason set** on `not_checked`, frozen because the remedy differs;
- the **aggregate** a consumer is allowed to compute from those events;
- the **join**, so two independent runners can compare columns by name.

It does not define how an observer authenticates, how access is granted, how a clock is trusted, or what a record means about a purchase. Those stay where they are.

---

## 2. Terminology

| Term | Meaning |
|---|---|
| **run** | the execution a record describes; one run can carry many reads |
| **observation** | one read of a run's record by one observer at one time, over specific bytes |
| **observer** | the identity that performed the read, named at the granularity the access was granted at (a caller, an auditor, a service) |
| **scope** | the access the observer held for that read, as a string the granting system understands |
| **subject digest** | the digest the record claims for its own bytes |
| **observed digest** | the digest the observer recomputed from the bytes actually read |
| **aggregate** | the statement a consumer may make from the events, never from a field on the run |

---

## 3. Observation event — normative fields

An observation event MUST carry every field below. Field names are the ones the reference implementation uses; a profile MAY map them, but MUST NOT drop a field's meaning.

| Field | Type | Required | Rule |
|---|---|---|---|
| `observer` | string | yes | non-empty; the identity the read is attributable to |
| `scope` | string | yes | the access held for this specific read |
| `outcome` | enum | yes | one of the five run-level outcomes, spelled identically |
| `record_id` | string | yes | the record the read was about |
| `subject_digest` | string | yes | the digest the record claims |
| `observed_digest` | string \| null | yes | the digest recomputed from bytes; `null` only when no bytes were read |
| `action_at` | timestamp | yes | when the recorded action happened; never substituted for a read time |
| `checked_at` | timestamp | yes | when this read happened; never substituted for the action time |
| `reason` | enum \| absent | on `not_checked` | one of the six frozen reasons; MUST be absent on every other outcome |
| `detail` | object \| absent | no | what a failed check found; not a reason |

Two consequences are load-bearing:

- A `verified` outcome with `observed_digest = null` is invalid. Verification is a statement about bytes that were read.
- A `reason` outside `not_checked` is invalid. A finding is described by `detail`; a non-event is described by a reason.

---

## 4. The reason set, frozen

`not_checked` is the one outcome whose remedy depends entirely on why, so the profile fixes the six causes that actually occur:

| Reason | Remedy |
|---|---|
| `not_attempted` | nothing to fix on the record — nobody tried |
| `access_refused` | re-scope the caller, or read with another identity |
| `access_revoked` | the credential is gone; obtain access again |
| `outside_scope` | this verifier never claims that layer |
| `unsupported_family` | a build limitation, named as one |
| `schema_not_implemented` | upgrade the parser, then re-read |

A profile MUST NOT introduce a seventh without a version bump, and MUST NOT use a free-text reason.

---

## 5. Ordering

**VP-1.** Events are append-only and chronological within a `record_id`.

**VP-2.** An event whose `checked_at` precedes the last appended event's `checked_at` for the same record MUST be refused with a named code (`OUT_OF_ORDER` in the reference implementation). A backfilled read MUST NOT be inserted where it would appear to have informed a decision taken before it existed.

**VP-3.** A read MUST NOT carry the action's timestamp as its `checked_at`, and an event MUST NOT be re-stamped at another read's time. Re-stamping is the mechanism by which a 17:05 revocation becomes evidence about 09:00.

**VP-4.** A read MAY be refused for a reason that is itself evidence (`access_refused` at T1, `verified` at T2, `access_revoked` at T3 are three true statements about one run). Storage of all three is required; reconciliation into one is not permitted.

---

## 6. Aggregation

A consumer MAY compute the following from the events, and MUST compute nothing stronger:

| Field | Rule |
|---|---|
| `verified_by` | observers whose read produced `verified` over bytes matching `subject_digest`, deduplicated by observer |
| `not_checked_by` | `(observer, reason)` pairs, not a count |
| `first_read_at` / `first_verified_at` | the earliest event, and the earliest confirmation; both kept |
| `contested` | `true` only when a **later** read returned `verification_failed` over the same subject; an access refusal is not a contest |
| `executions` | the number of executions the events describe; reads never increment it |

**VP-5.** `executions` MUST NOT increase because more observers read. Two reads of one execution are one execution.

**VP-6.** `contested` MUST flip on a contradicting finding and MUST keep the original confirmation visible. Replacing the confirmation with the newer row is the failure this field exists to prevent.

**VP-7.** An aggregate MUST NOT render `not_checked` or `absent` as a refusal or a failure in any consumer-facing surface.

---

## 7. Joining two runners

**VP-8.** Two implementations SHOULD be able to join their columns without a translation table: the join key is the record (or vector) name, and the family key is stable across both sides.

**VP-9.** A reader's outcome and the expectation for the same record are different columns. A negative fixture read correctly produces `verification_failed`; that is not a divergence, and collapsing the two turns every correctly-read negative into a fake defect.

**VP-10.** A profile MUST NOT re-label the run-level outcome. If a run is `not_checked`, the profile may add *who* and *why*; it may not upgrade it to `verified` because two other observers confirmed a different scope.

**VP-11.** An implementation MUST publish the set digest it was run against and the exact bytes it pinned, so a third party can re-run and compare rather than trust a screenshot.

---

## 8. Conformance classes

| Class | Must | Need not |
|---|---|---|
| **recorder** | satisfy §3, §4, §5 | aggregate anything |
| **aggregator** | satisfy §6, including the `contested` and `executions` rules | accept third-party events |
| **joiner** | satisfy §7, publish pins, derive rows from real reads | ship a UI |

A recorder that cannot produce a valid event for a read it performed is not conformant with this profile; it is allowed to record nothing, which is the honest alternative to recording an anonymous failure.

---

## 9. Reference implementation

Measured, not asserted — every claim below is reproducible from the repository:

| Piece | Where |
|---|---|
| Layer (`CG-OBS/1`) | `packages/agent-commerce/observations.mjs` — `recordObservation`, `appendObservation`, `accrue`, `describeAccrual`, `selfCheck` |
| Ledger page (rules exercised with real attempts) | `docs/AER1-OBSERVATION-LEDGER.md` |
| Observation family joined to the corpus | `docs/AER1-OBSERVATION-JOIN.md` + `docs/aer1-observation-rows.json` |
| Generators | `scripts/aer1-observations.mjs`, `scripts/aer1-observation-join.mjs` |
| Tests | `test/integrations/aer1-observations.test.mjs`, `test/integrations/aer1-observation-join.test.mjs` |

The reference records `not_checked` with a guard that refuses an unknown reason, refuses a failure with no detail, refuses a `verified` without matching bytes, and refuses a backdated read. The join page reads 143 pinned vectors through the same layer and prints the five outcomes per family beside the reference kit's column, with `0` divergences.

**Boundary held by the reference:** the observer strings that carry a live 403/401 scenario are declared synthetic on the page that shows them. The corpus reads are not synthetic; the clock values on the scenario are supplied, and the page says so.

---

## 10. Security considerations

- **Observer identity is an authorization claim.** A profile that accepts a self-declared observer without a trust root records a name, not an account. Implementations SHOULD pin the trust root beside the events, or say plainly that they do not.
- **Read times are caller-supplied in the reference**, because a pure layer cannot read a clock it does not trust. A conforming deployment SHOULD take `checked_at` from the same authority that granted the scope, and SHOULD record which authority that was.
- **Privacy:** observation rows are more sensitive than run outcomes — they name who could not see what. A profile SHOULD support redacted observers (a role plus a stable pseudonym) without losing the ability to dedupe confirmations.
- **Replay:** deterministic generation of the same events from the same inputs is a feature. It means a profile can be diffed byte-for-byte, and it means an edited row is visible as an edit rather than a disagreement.

---

## 11. Out of scope

Not claimed, not implemented, not implied: that the record's work happened; that an observer is trustworthy; that a digest match implies a correct answer; that access control was configured correctly; that a `verified` run should be paid, shipped or trusted; that any of this is ACP-ratified.

---

## 12. Open questions for the ACP side

1. Does the profile belong as a section of the existing draft, or as a separate registry entry keyed by profile name and version?
2. Should `contested` be a field on the aggregate, or a derived view that a consumer computes? The reference exposes it as a field because a consumer that has to derive it will not.
3. Is a per-observer outcome allowed to be a *finding* (`verification_failed`) when the run-level outcome is `not_checked`? The reference says yes and keeps both visible; a stricter reading would force one to be dropped, and dropping either loses the dispute.
4. For deployment, should `checked_at` be signed by the scope-granting authority rather than supplied by the caller? If yes, the profile needs a minimal envelope definition, which is the natural next draft.

## Appendix A — Compact interop profile text (wired from ACP thread)

Source: [zambodotdev comment on coreguard-global/CoreGuard#59](https://github.com/coreguard-global/CoreGuard/issues/59#issuecomment-7144044159). Wired as-is; the kit pin lives in the fixture manifest.

> AER-1 observation profile (ACP interop). An observer runs the pinned AER-1 corpus and publishes its own column over the same rows, joined on vector name, against the kit release and evaluated-set digest stated in the fixture manifest. Every claimed row carries the observer's stable name, what it read, and one of the five run-level outcomes: verified, verification_failed, not_checked, absent, unresolvable_record. not_checked carries exactly one of the six frozen reasons: access_refused, unsupported_family, schema_not_implemented, outside_scope, provenance_not_present, not_yet_materialized. A column claims per-vector comparison only where a per-vector verdict is actually measured; family-level-only lines stay explicitly unclaimed, and the compared scope is printed on the fixture's face. Two rules are load-bearing: no invented timestamps on corpus reads, and no execution language for fixture reads. verified means the check the observer recomputed matched the claim it evaluated; it is not proof the described work happened, and it is not a conformance claim or a certification. When a per-vector kit emit lands for the remaining families, columns widen on evidence, and the divergence count stays honest wherever it lands.
