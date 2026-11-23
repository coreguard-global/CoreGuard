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
import { parseAer1Record } from "../../packages/agent-commerce/aer1.mjs";

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
