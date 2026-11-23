# AER-1 corpus + our own anchor service (CG-AER1/1 · CG-ANCHOR/1 · CG-COMPOSE/1)

Status: **LANDED** — 2026-11-18. Two things that were open in the public thread
are closed here, and one thing that was an argument is now a switch.

## 1. The corpus runs, and says what it did not judge

`node scripts/aer1-corpus.mjs` runs against the vendored corpus in
`test/fixtures/aer1-corpus-v1.5.7/`. Two claims are kept apart on purpose,
because merging them is how "we run their corpus" becomes a sentence nobody can
check:

| Claim | What is actually asserted |
|---|---|
| Integrity | 72 vendored files reproduce the published per-file SHA-256, and the whole set reproduces the published `evaluated_set_digest` (`sha256:60bf73f3…db0d2`) — recomputed from the bytes on disk, offline |
| Semantics | 41 vectors are replayed through `CG-AER1/1` and compared to their pinned expectations: id-binding (6), merkle (9), unicode (5), and all 21 schema 0.4 records, whose outer and committed claims are checked field by field |
| Not claimed | the other 102 vectors — the anchor family (8) and anchored records (6) — are enumerated per family and printed `NOT_CHECKED (family not implemented by CG-AER1/1)` — never green |

The negative control matters as much as the pass: flipping one byte in one
vendored file fails integrity **by path**, and also breaks the set digest,
because the set digest is recomputed from disk rather than copied from the index.

The parser itself is `packages/agent-commerce/aer1.mjs`. Its one design rule is
the format's own: the committed payload and the receipt id are separate things.
The digest is recomputed from `canonical_bytes`; the id is bound only against
something external — an expected id, or a resolved record whose own committed
digest must agree. With neither, the id is `unverified`: not matched, and not
refuted. A schema version this build does not implement becomes `NOT_CHECKED`
with the version named, never `VERIFICATION_FAILED`.

## 2. Anchoring we run ourselves

`packages/agent-commerce/anchor.mjs` is the anchor service, and
`node scripts/anchor.mjs` is its CLI (`keygen`, `attest`, `verify`, `resolve`,
`prepare`). The design is three sizes of the same claim:

- **attestation** — Ed25519 over canonical JSON: "at T, I saw this digest".
  It carries the signing public key, so a stranger verifies it offline, with no
  call to us and no secret.
- **log** — append-only and hash-chained: entry *n* names the leaf hash of entry
  *n−1*. Editing an old entry is visible at the tail, by position.
- **root** — one Merkle root over the log. That 32-byte value is the only thing
  that would ever need to reach a chain, a notary or a mirror.

Resolution distinguishes two facts that are easy to collapse and must not be:
a digest nobody claimed is `absent`; a digest someone claimed whose attestation
does not stand up is `unresolvable`. `prepareChainAnchor` returns the exact
32-byte memo a chain anchor would carry, reports `broadcast: false`, and refuses
`mainnet` by name — writing to a live network is not a library call.

## 3. The divergence is a mode now, not a round of review

The AER-1 reply to our outcome layer named the one real difference between the
two designs: under our composition, a second anchor that resolves later flips
the composed verdict; under AER-1's layered reporting, the record verdict never
moves. Both are defensible. `packages/agent-commerce/composition.mjs` makes the
choice a value:

| Mode | Headline | Unresolvable anchor | Best for |
|---|---|---|---|
| `composed` | the pair | `UNRESOLVABLE_RECORD`, may block | a commerce consumer that needs one answer now |
| `layered` | the record alone | record stays `VERIFIED`; anchor layer carries `rejected: "unresolvable record"` | a record that must outlive any single anchor |

The property that separates them is asserted with the real service, not a
hand-written fact set: hold a broken attestation, then let a valid second anchor
for the same digest arrive. In `composed` mode the headline moves
`UNRESOLVABLE_RECORD → VERIFIED`; in `layered` mode the record reads `VERIFIED`
at both steps and only the anchor block changes.

Two invariants hold in both modes, and both are tests: silence is never a
refusal (`ABSENT`, `blocks: false`), and a good anchor never rescues a failed
record.

## Reproduce

- corpus: `node scripts/aer1-corpus.mjs` (add `--json` for the machine form)
- anchor: `node scripts/anchor.mjs keygen --out /tmp/issuer.pem`, then
  `node scripts/anchor.mjs attest --log /tmp/anchor.json --key /tmp/issuer.pem --digest sha256:<64 hex>`
- policy: `node scripts/anchor.mjs modes`
- tests: `node --test test/integrations/aer1-corpus-run.test.mjs test/integrations/anchor-service.test.mjs test/integrations/composition-policy.test.mjs`

## Boundary

No network in any of these modules. No private key in this repository — the CLI
writes one locally with mode `600`. No broadcast path exists. An anchor says a
digest existed at a time in a place; it never says the record was correct,
authorized or safe, and it cannot resurrect bytes. `VERIFIED` is a claim about
evidence, not about safety.
