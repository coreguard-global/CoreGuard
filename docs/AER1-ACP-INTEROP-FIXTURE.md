# AER-1 ACP interop fixture (draft)

**Status:** draft fixture / interop artifact. Not a conformance claim, not a certification, not an ACP submission.

This fixture packages the AER-1 observation rows as a machine-readable interop surface. Any implementation can run the same pinned set, publish its own observer column joined on `name`, and state its compared scope honestly.

## Pins

| Field | Value |
|---|---|
| Kit | `1.5.7` |
| Evaluated-set digest | `sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2` |
| Vectors | `143` |
| Join key | `name` |
| Machine-readable manifest | [`aer1-acp-interop-fixture.json`](./aer1-acp-interop-fixture.json) |
| Row payload | [`aer1-observation-rows.json`](./aer1-observation-rows.json) |
| Human-readable join | [`AER1-OBSERVATION-JOIN.md`](./AER1-OBSERVATION-JOIN.md) |

## What an implementation may publish

An implementation may publish its own observer column over the same 143 rows, joined by `name`. For every row it claims, it must state:

- **observer** - stable observer name.
- **scope** - what was read (for example `record:bytes`).
- **outcome** - one of the five run-level outcomes: `verified`, `verification_failed`, `not_checked`, `absent`, `unresolvable_record`.
- **reason** - required only for `not_checked`, and only one of the six frozen reasons: `access_refused`, `unsupported_family`, `schema_not_implemented`, `outside_scope`, `provenance_not_present`, `not_yet_materialized`.
- **compared scope** - which rows are per-vector comparable, and which are family-level-only/unclaimed.

## Scope rules (load-bearing)

- **No invented timestamps** on corpus reads. Time/ordering belongs to real observed events, not fixture replay.
- **No execution language** for fixture reads. Reading 143 vectors is 143 reads, not 143 runs.
- **No gap-filling.** A column may only claim per-vector comparison where a per-vector verdict is actually measured. Family-level-only lines remain unclaimed.
- **Widening rule.** When a per-vector kit emit lands for the remaining families, the column widens on evidence and the divergence count stays honest wherever it lands.
- **Three checks, never collapsed.** Receipt/record verification, bytes/integrity verification, and reader/principal authorization are different checks. An access refusal is not a receipt failure and not a byte-integrity failure.

## Reason-set reconciliation (draft direction)

The CG-OBS/1 reference implementation and the Appendix A compact profile text currently use different six-reason `not_checked` sets. They are not vocabulary drift — they answer different questions. The thread direction is **two named fields, no silent remapping** (observer/access axis + record/provenance axis). Appendix A remains wired as-is while field names and schema are finalized.

| Axis | Draft field | Reasons |
|---|---|---|
| Observer/access lifecycle | `observer_reason` (draft name) | `not_attempted`, `access_refused`, `access_revoked`, `outside_scope`, `unsupported_family`, `schema_not_implemented` |
| Record/provenance availability | `record_reason` (draft name) | `provenance_not_present`, `not_yet_materialized` |

One normative set would make the second axis borrow labels (silent remapping), so it is rejected as the direction. Exact field names and forward mapping for existing CG-OBS/1 rows remain open.

## Current CoreGuard observer scope

| Observer | Kind | Scope |
|---|---|---|
| `cg-aer1:parser` | per-vector | 143 rows, CG-AER1/1 reading vector bytes |
| `cg-aer1:bytes` | per-file | 72 files, SHA-256 against pinned corpus index |
| `aer1-kit:per-vector` | per-vector, compared only | 66 compared rows, 0 divergences; family-level-only kit lines unclaimed |

## Boundary

- `verified` means the bytes/check the observer recomputed matched the claim it evaluated. It is **not** proof the described work happened, and it is **not** conformance/certification.
- The five run-level outcomes stay run-level outcomes. This fixture adds observer identity and compared scope; it does not change verdict semantics.
- Any divergence must be named by vector and scope. Zero divergences is a measured result on the stated compared set, not a blanket claim.

## Profile text (draft, wired from ACP thread)

Source: [zambodotdev comment on coreguard-global/CoreGuard#59](https://github.com/coreguard-global/CoreGuard/issues/59#issuecomment-7144044159). The text is wired as-is; the kit pin lives in the manifest, not hardcoded in the profile text.

> AER-1 observation profile (ACP interop). An observer runs the pinned AER-1 corpus and publishes its own column over the same rows, joined on vector name, against the kit release and evaluated-set digest stated in the fixture manifest. Every claimed row carries the observer's stable name, what it read, and one of the five run-level outcomes: verified, verification_failed, not_checked, absent, unresolvable_record. not_checked carries exactly one of the six frozen reasons: access_refused, unsupported_family, schema_not_implemented, outside_scope, provenance_not_present, not_yet_materialized. A column claims per-vector comparison only where a per-vector verdict is actually measured; family-level-only lines stay explicitly unclaimed, and the compared scope is printed on the fixture's face. Two rules are load-bearing: no invented timestamps on corpus reads, and no execution language for fixture reads. verified means the check the observer recomputed matched the claim it evaluated; it is not proof the described work happened, and it is not a conformance claim or a certification. When a per-vector kit emit lands for the remaining families, columns widen on evidence, and the divergence count stays honest wherever it lands.
