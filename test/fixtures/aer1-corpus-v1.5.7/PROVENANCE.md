# Provenance — AER-1 id-binding vectors, kit v1.5.7

**Upstream artifact, vendored verbatim. Do not edit these files in place.** An
edit is a new fixture version with a new recorded digest, never a patch to this
one — the whole value of the fixture is that its bytes are someone else's.

| Field | Value |
|---|---|
| Upstream | AER-1 — `draft-zambo-aer1-26`, agent execution receipt format |
| Author / corpus | Brennan Zambo (Zambo), corpus published at `https://zambo.dev/aer1/` |
| Vector file | `base/id-binding-vectors.json` from kit **v1.5.7** |
| Source URL | `https://zambo.dev/aer1/corpus/v1.5.7/base/id-binding-vectors.json` |
| Retrieved | 2026-11-16 (fetched with `curl`, written to disk unmodified) |
| Bytes | 11,382 |
| SHA-256 (vendored bytes) | `78cb42cbc8be1306458f63e90e01f0e9201504ff5bf5d455a659631f21237009` |
| SHA-256 published for this path | `78cb42cbc8be1306458f63e90e01f0e9201504ff5bf5d455a659631f21237009` — **equal**, so these are the published bytes and not a re-encode |
| Vectors / checks in that file | 6 / 6 |
| Corpus totals (kit v1.5.7) | 143 vectors · 146 checks |
| `evaluated_set_digest` of the whole corpus | `sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2` |
| Licence basis | offered in the issue thread as "free to lift as fixtures, no strings attached" (issue #56, 2026-11-14) |

`corpus-metadata.json` is a **metadata subset** of the corpus index
(`https://zambo.dev/aer1/corpus.json`), carrying the fields that make the
citation checkable — kit version, draft, counts, `evaluated_set_digest`, digest
algorithm. It is not the full file list and does not claim to be.

## Why these six

They are the corpus author's own must-fail set for the defect this repository
shipped and admitted on issue #56: a receipt whose committed digest verifies
perfectly, relabeled with a different receipt's id. The digest never covered the
label, so re-deriving the digest can never catch it — only a separate identity
binding can.

## How the fixtures are pinned here

`test/integrations/aer1-id-binding-fixtures.test.mjs` asserts, on every run:

1. the vendored file's sha256 equals the constant above **and** the digest the
   corpus index publishes for that path;
2. the metadata's `evaluated_set_digest`, kit version and corpus counts equal
   the pinned values;
3. each of the six vectors replays through AER-1's own two stages (commitment
   recompute with its structural rule; enumerated id verdict) and reproduces the
   published `expected_digest`, `expected_id_verdict` and `expected_verdict`;
4. our identity branch maps onto the three shared outcomes without ever being
   more permissive, and the two resolution vectors are answered with an
   enumerated `RECEIPT_ID_RESOLUTION_UNSUPPORTED` — because CGEP/1 has no
   resolution step, and "cannot exercise" must not read as "agrees".

A fixture edited by a single space fails check 1 by name, which is the only
reason to record a digest at all.

## Full corpus, added 2026-11-18

The six id-binding vectors are still the family this build judges end to end,
but the fixture directory now carries the **whole published set**: 72 files,
143 vectors, 146 checks, laid out exactly as published (`base/…`,
`workflow-merkle-seq-output-v1.json`). `corpus-index.json` is the published
index, vendored with them.

| Field | Value |
|---|---|
| Index | `https://zambo.dev/aer1/corpus.json` (vendored as `corpus-index.json`) |
| Files | 72, each written byte-for-byte from `https://zambo.dev/aer1/corpus/v1.5.7/<path>` |
| Per-file digests | all 72 match the `sha256` the index publishes for that path |
| `evaluated_set_digest` | `sha256:60bf73f325793e16843370cfa24903bb0d017525cb297e42bebc35857e2db0d2` — **reproduced** from the bytes on disk |
| Top-level `id-binding-vectors.json` | byte-identical to `base/id-binding-vectors.json` (asserted by the runner's test), kept because the earlier fixture test pins its digest |

What that buys, and what it does not: integrity is now a whole-corpus property
rather than a six-file property, and every vector file the corpus publishes is
present and named. Semantics now covers 41 vectors: id-binding (6), merkle (9), unicode (5) and
every schema 0.4 record (21, 12 valid and 9 invalid). `scripts/aer1-corpus.mjs`
prints the other 102 vectors as `NOT_CHECKED` with the family named — the anchor
family (8) and anchored records (6). A verifier that half-implements a family
and reports it green is the failure mode the corpus exists to catch.

`corpus-metadata.json` remains the metadata subset it says it is; the full file
list now lives in `corpus-index.json`.
