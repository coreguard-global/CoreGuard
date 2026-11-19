# AER-1 corpus run report — template

Use this when running a published AER-1 corpus set and sharing outcomes in a
reproducible, per-vector format (for example in a discussion thread).

The goal is to report **what was actually checked**, **what was not checked**,
and **how to reproduce it** — without overstating coverage.

## Generate the report

From a CoreGuard checkout:

```bash
# 1) Get the corpus into a local directory (corpus-index.json + the files it lists)
#    Example: place the published corpus set under /tmp/aer1-corpus-live
#
# 2) Run the report tool
node scripts/aer1-corpus-report.mjs \
  --dir /tmp/aer1-corpus-live \
  --out /tmp/aer1-corpus-run \
  --label "aer1-corpus-<draft-or-date>"
```

This writes:
- `report.json` — machine-readable (integrity, per-vector outcomes, not-evaluated families, repro metadata)
- `REPORT.md` — shareable human-readable summary

For the vendored corpus fixture (offline smoke):

```bash
node scripts/aer1-corpus-report.mjs --out /tmp/aer1-corpus-run --label "vendored-v1.5.7"
```

## What the report means

- **Integrity:** every file is checked against its indexed sha256 and the
  recomputed `evaluated_set_digest` is compared to the published value. Integrity
  proves the bytes are the published artifacts (or match the supplied dir); it
  does **not** prove anything about the recorded work.
- **Evaluated families:** vectors judged end-to-end by the named parser
  (`CG-AER1/1`) and compared to each vector’s pinned expectation. Reported as
  per-vector outcomes (not just a total).
- **Not evaluated:** families not implemented by this parser are listed as
  **NOT_CHECKED** by name and count. This is intentional fail-closed reporting:
  a family that is not judged must not be reported as passing.

## Suggested post template (fill in)

Copy/paste and fill the placeholders:

~~~markdown
**AER-1 corpus run (CG-AER1/1, <commit-short>, node <version>)**

- Corpus: `<kit version / draft>`, <files> files, <vectors> vectors, <checks> checks
- Integrity: **<PASS/FAIL>** — `evaluated_set_digest` `<digest>` (matches published: <yes/no/n-a>)
- Evaluated (id-binding): **<matched>/<total> match** (per-vector outcomes below / in REPORT.md)
- Not evaluated: **<n> vectors** across <k> families — NOT_CHECKED (named in report)
- Artifacts: `report.json` + `REPORT.md` (command: `node scripts/aer1-corpus-report.mjs --dir <dir> --out <out> --label "<label>"`)

Per-vector (evaluated):
| vector | expected (digest/idVerdict/verdict) | actual (digest/idVerdict/verdict) | result |
|---|---|---|---|
| <name> | <exp> | <act> | ok/FAIL |

Notes/limits: integrity verifies bytes/digest only; pass is scoped to evaluated vectors under the named parser; unevaluated families are reported NOT_CHECKED, not as success.
~~~

## Reproducibility checklist

- [ ] Corpus source identified (dir / draft / published index) and `evaluated_set_digest` recorded
- [ ] Commit, node version, platform, command, and timestamp recorded (included in `report.json`)
- [ ] Per-vector outcomes included for every evaluated vector (no aggregate-only claim)
- [ ] Not-evaluated families listed by name/count as NOT_CHECKED
- [ ] Any mismatch or integrity failure reported plainly (do not summarize a failure as a pass)

## Boundary (keep explicit)

- A structural/commitment pass for a vector is not a claim that the recorded work was correct or safe.
- Coverage is the set of evaluated families only; do not imply blanket conformance for families reported NOT_CHECKED.
- If results are run against a specific dated corpus snapshot, state the source/draft and digest so the claim can be dated.
