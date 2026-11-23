/**
 * CG-AER1/1 record checks, one test per rule added against the pinned corpus.
 *
 * Each rule is pinned twice: the corpus vector that exposes it must now be
 * refused, and a corpus record that is valid under the same rule must still
 * verify. A rule that only refuses would be a false-reject machine.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseAer1Record, findDuplicateMembers, KNOWN_PROVENANCE_CLASSES } from "../../packages/agent-commerce/aer1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, "../fixtures/aer1-corpus-v1.5.7/base/test-vectors");
const vector = (p) => JSON.parse(readFileSync(join(CORPUS, p), "utf8"));

test("canonical base64: unpadded and pad-bit encodings are refused", () => {
  for (const name of ["invalid/ax-base64-unpadded.json", "invalid/base64-unpadded.json", "invalid/base64-pad-bit.json"]) {
    const parsed = parseAer1Record(vector(name));
    assert.equal(parsed.verdict, "fail", name);
    assert.equal(parsed.structureOk, false, name);
    assert.ok(
      parsed.structure.some((c) => c.name === "canonical_bytes is canonical base64" && c.ok === false),
      `${name} must fail the canonical base64 check`,
    );
  }

  // The padded form of the same payload still verifies: the rule rejects the
  // encoding, not the bytes.
  const padded = parseAer1Record(vector("invalid/ax-feb29-1900.json"));
  assert.equal(
    padded.structure.find((c) => c.name === "canonical_bytes is canonical base64")?.ok,
    true,
    "a padded encoding must not be punished by the base64 rule",
  );
});

test("created_at: a real calendar, not just a timestamp-shaped string", () => {
  const invalid = [
    "invalid/ax-feb29-1900.json",
    "invalid/ax-feb29-non-leap.json",
    "invalid/feb29-1900.json",
    "invalid/feb29-non-leap.json",
    "invalid/impossible-date.json",
    "invalid/leap-second-created-at.json",
    "invalid/bad-created-at.json",
    "invalid/bad-offset-range.json",
  ];
  for (const name of invalid) {
    const parsed = parseAer1Record(vector(name));
    assert.equal(
      parsed.structure.find((c) => c.name.startsWith("created_at"))?.ok,
      false,
      `${name} must be refused on created_at`,
    );
  }

  const valid = ["valid/feb29-leap.json", "valid/maximum-offset-timestamp.json"];
  for (const name of valid) {
    const parsed = parseAer1Record(vector(name));
    assert.equal(
      parsed.structure.find((c) => c.name.startsWith("created_at"))?.ok,
      true,
      `${name} must pass the created_at rule`,
    );
  }

  // A bare record with no created_at stays acceptable: the rule judges a
  // claim, it does not invent one.
  const bare = parseAer1Record(vector("valid/legacy-real-2.json"));
  assert.equal(bare.structure.find((c) => c.name.startsWith("created_at"))?.ok, true);
});

test("tool: a verified record must name a structured descriptor", () => {
  const invalid = ["invalid/tool-empty-name.json", "invalid/tool-not-object.json", "invalid/ax-tool-empty-scope.json"];
  for (const name of invalid) {
    const parsed = parseAer1Record(vector(name));
    assert.equal(
      parsed.structure.find((c) => c.name.startsWith("tool"))?.ok,
      false,
      `${name} must be refused on the tool descriptor`,
    );
  }

  // The legacy bare record carries `tool` as a string and makes no
  // verification claim: refusing it would be a false reject.
  const legacy = parseAer1Record(vector("valid/legacy-real-2.json"));
  assert.equal(legacy.structure.find((c) => c.name.startsWith("tool"))?.ok, true);
  assert.equal(legacy.verdict, "pass");

  const structured = parseAer1Record(vector("valid/receipt-03-live.json"));
  assert.equal(structured.structure.find((c) => c.name.startsWith("tool"))?.ok, true);
});

test("id: a lowercase UUID, not a label that merely looks like one", () => {
  const invalid = ["invalid/bad-id.json", "invalid/uppercase-id.json", "invalid/id-trailing-newline.json"];
  for (const name of invalid) {
    const parsed = parseAer1Record(vector(name));
    assert.equal(
      parsed.structure.find((c) => c.name === "id is a lowercase UUID")?.ok,
      false,
      `${name} must be refused on the id shape`,
    );
  }

  // The shape check must not disturb binding: the id-binding family still
  // matches, mismatches and reports an unbound id as unverified.
  const live = parseAer1Record(vector("valid/receipt-03-live.json"), { expectedId: vector("valid/receipt-03-live.json").id });
  assert.equal(live.structure.find((c) => c.name === "id is a lowercase UUID")?.ok, true);
  assert.equal(live.id.verdict, "matched");
  assert.equal(parseAer1Record(vector("valid/receipt-03-live.json")).id.verdict, "unverified");
});

const load = (p) => {
  const text = readFileSync(join(CORPUS, p), "utf8");
  return { text, record: JSON.parse(text) };
};

const refusedBy = (parsed, name) => {
  const row = parsed.structure.find((c) => c.name === name);
  return parsed.verdict === "fail" && row !== undefined && row.ok === false;
};

test("duplicate member names are refused before any value is trusted", () => {
  const { text, record } = load("invalid/duplicate-member-name.json");
  assert.deepEqual(findDuplicateMembers(text), [{ path: "$", key: "output_hash" }]);

  const parsed = parseAer1Record(record, { rawText: text });
  assert.ok(refusedBy(parsed, "record text has no duplicate member names"));
  assert.equal(parsed.verdict, "fail");

  // Same bytes, no duplicate: the rule judges the text, not the record.
  const clean = load("valid/receipt-01.json");
  assert.deepEqual(findDuplicateMembers(clean.text), []);
  assert.equal(parseAer1Record(clean.record, { rawText: clean.text }).verdict, "pass");
});

test("an execution payload must commit an inputs object", () => {
  const { text, record } = load("invalid-profile/missing-inputs.json");
  const parsed = parseAer1Record(record, { rawText: text });
  assert.ok(refusedBy(parsed, "committed payload carries an inputs object"));
  assert.equal(parsed.verdict, "fail");

  // Legacy artifacts commit neither inputs nor outputs; refusing them would be
  // a false reject, so the rule applies only to canonical execution payloads.
  const legacy = load("valid/legacy-real-2.json");
  assert.equal(parseAer1Record(legacy.record, { rawText: legacy.text }).verdict, "pass");
});

test("a claimed verification_status other than verified is refused", () => {
  const { text, record } = load("invalid/bad-verification-status.json");
  assert.equal(record.verification_status, "unverified");
  const parsed = parseAer1Record(record, { rawText: text });
  assert.ok(refusedBy(parsed, "verification_status is verified when the record claims it"));
  assert.equal(parsed.verdict, "fail");
});

test("a provenance class outside the declared set is refused", () => {
  const { text, record } = load("invalid/bad-provenance.json");
  assert.equal(record.provenance_class, "TRUST ME");
  const parsed = parseAer1Record(record, { rawText: text });
  assert.ok(refusedBy(parsed, "provenance_class is a known class (when present)"));
  assert.equal(parsed.verdict, "fail");
});

test("a provenance class with a trailing newline is a different class", () => {
  const { text, record } = load("invalid/provenance-trailing-newline.json");
  assert.equal(record.provenance_class, "EXECUTED BY ZAMBO\n");
  assert.ok(!KNOWN_PROVENANCE_CLASSES.includes(record.provenance_class));
  const parsed = parseAer1Record(record, { rawText: text });
  assert.ok(refusedBy(parsed, "provenance_class is a known class (when present)"));
  assert.equal(parsed.verdict, "fail");
});

test("the refusal checks do not convict valid canonical or legacy records", () => {
  for (const name of ["valid/receipt-01.json", "valid/receipt-03-live.json", "valid/legacy-real-2.json", "valid/real-1-bare.json"]) {
    const { text, record } = load(name);
    const parsed = parseAer1Record(record, { expectedId: record.id, rawText: text });
    assert.equal(parsed.verdict, "pass", `${name}: ${JSON.stringify(parsed.structure.filter((c) => !c.ok))}`);
    assert.equal(parsed.id.state, "verified-expected");
  }
});

const SCHEMA04_VALID = [
  "bound-04.json", "deep-nesting.json", "edge-numbers.json", "empty-members.json",
  "input-hash-multikey-20.json", "large-payload.json", "maximum-offset-timestamp.json",
  "metadata-hash-non-ascii-tool.json", "optional-members-18.json", "real-04.json",
  "typographic-unicode.json", "uuid-v1-core.json",
];
const SCHEMA04_INVALID = [
  "input-hash-key-order-20.json", "input-hash-mismatch.json", "lowercase-timestamp.json",
  "nil-uuid.json", "payload-is-array.json", "payload-omits-issuer-claims.json",
  "provenance-control-char.json", "tampered-provenance.json", "timestamp-no-timezone.json",
];

test("schema 0.4: all 12 valid records verify, all 9 invalid records refuse by name", () => {
  for (const name of SCHEMA04_VALID) {
    const { text, record } = load(`valid/${name}`);
    const parsed = parseAer1Record(record, { expectedId: record.id, rawText: text });
    assert.equal(parsed.supportedVersion, true, name);
    assert.equal(parsed.verdict, "pass", `${name}: ${JSON.stringify(parsed.structure.filter((c) => !c.ok))}`);
  }
  for (const name of SCHEMA04_INVALID) {
    const { text, record } = load(`invalid/${name}`);
    const parsed = parseAer1Record(record, { expectedId: record.id, rawText: text });
    assert.equal(parsed.verdict, "fail", `${name}: a corpus-invalid 0.4 record was accepted`);
    assert.ok(parsed.structure.some((c) => !c.ok), name);
  }
});

test("schema 0.4: input_hash binds the canonical spelling, not the parsed object", () => {
  const good = load("valid/input-hash-multikey-20.json");
  assert.equal(parseAer1Record(good.record, { rawText: good.text }).verdict, "pass");
  for (const name of ["input-hash-key-order-20.json", "input-hash-mismatch.json"]) {
    const { text, record } = load(`invalid/${name}`);
    const parsed = parseAer1Record(record, { rawText: text });
    assert.ok(refusedBy(parsed, "input_hash binds the canonical JSON of the recorded inputs"), name);
  }
  // An input_hash that disagrees with the recorded inputs must bite even on a
  // record whose bytes and id are otherwise intact.
  const tampered = { ...good.record, input_hash: `sha256:${"0".repeat(64)}` };
  assert.ok(refusedBy(parseAer1Record(tampered, { rawText: good.text }), "input_hash binds the canonical JSON of the recorded inputs"));
});

test("schema 0.4: provenance is bound on both sides of the commitment", () => {
  for (const name of ["tampered-provenance.json", "payload-omits-issuer-claims.json"]) {
    const { text, record } = load(`invalid/${name}`);
    const parsed = parseAer1Record(record, { rawText: text });
    assert.ok(refusedBy(parsed, "provenance_class matches the committed issuer_claims"), name);
  }
  const good = load("valid/bound-04.json");
  assert.equal(parseAer1Record(good.record, { rawText: good.text }).verdict, "pass");
});

test("schema 0.4: nil uuid and lowercase timestamps are refused, older drafts still pass", () => {
  const nil = load("invalid/nil-uuid.json");
  assert.ok(refusedBy(parseAer1Record(nil.record, { rawText: nil.text }), "id is not the nil UUID"));
  for (const name of ["lowercase-timestamp.json", "timestamp-no-timezone.json"]) {
    const { text, record } = load(`invalid/${name}`);
    assert.ok(refusedBy(parseAer1Record(record, { rawText: text }), "created_at is RFC 3339 (when present)"));
  }
  // The strict spelling rule is versioned: corpus-valid older records with a
  // lowercase z must not become false rejects.
  const lenient = load("valid/receipt-01.json");
  assert.equal(parseAer1Record(lenient.record, { rawText: lenient.text }).verdict, "pass");
});

test("schema 0.4: metadata_hash shape is checked but its preimage is not invented", () => {
  const good = load("valid/real-04.json");
  const parsed = parseAer1Record(good.record, { rawText: good.text });
  assert.ok(parsed.structure.some((c) => c.name === "metadata_hash is sha256:<64 hex>" && c.ok));
  const bad = parseAer1Record({ ...good.record, metadata_hash: "not-a-digest" }, { rawText: good.text });
  assert.ok(refusedBy(bad, "metadata_hash is sha256:<64 hex>"));
});
