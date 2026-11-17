/**
 * BILINGUAL PAIRS — the Arabic edition is a contract, not a courtesy.
 *
 * The repository shipped bilingual surfaces for years as an editorial habit:
 * a doc got translated when someone had time, and nothing noticed when the
 * English source moved on without it. The result is worse than no translation,
 * because a stale Arabic edition is a *false* document that reads as current to
 * exactly the audience it was written for.
 *
 * So the pairing is declared in `docs/i18n-pairs.json`, and each Arabic edition
 * carries its provenance in the first line:
 *
 *     <!-- i18n: source=<path> sha256=<digest> translated=<YYYY-MM-DD> -->
 *
 * Three failures this guard makes loud, each naming the file to fix:
 *
 *  1. MISSING — a declared pair whose Arabic edition does not exist.
 *  2. STALE  — the English source's digest no longer equals the pin, i.e. the
 *     English changed and the translation was not reissued. The failure message
 *     says which of the two edits the author should make, because "stale" alone
 *     invites someone to re-pin without reading the diff.
 *  3. ORPHAN — an Arabic edition on disk that nobody declared, which is how a
 *     translation quietly stops being covered at all.
 *
 * Digests are computed over CRLF-normalized UTF-8. That is not pedantry: a
 * checkout with `core.autocrlf=true` produces different raw bytes for the same
 * committed text, and a pin that depends on the checkout would pass on the
 * machine that wrote it and fail on CI — the cross-machine trap this repository
 * has already paid for once in the docs-node contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, sep } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = resolve(REPO, "docs/i18n-pairs.json");
const MARKER = /^<!--\s*i18n:\s*source=(\S+)\s+sha256=([0-9a-f]{64})\s+translated=(\d{4}-\d{2}-\d{2})\s*-->/m;

const sha256 = (path) =>
  createHash("sha256")
    .update(readFileSync(resolve(REPO, path), "utf8").replaceAll("\r\n", "\n"), "utf8")
    .digest("hex");

const readManifest = () => JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

function provenanceOf(arPath) {
  const text = readFileSync(resolve(REPO, arPath), "utf8").replaceAll("\r\n", "\n");
  const m = text.match(MARKER);
  if (!m) return null;
  return { source: m[1], sha256: m[2], translated: m[3], text };
}

const arabicChars = (text) => (text.match(/[\u0600-\u06FF]/g) || []).length;

test("every declared pair has an Arabic edition that is not stale", () => {
  const { pairs } = readManifest();
  const problems = [];
  for (const pair of pairs) {
    const where = `pair "${pair.id}" (${pair.en})`;
    if (!existsSync(resolve(REPO, pair.en))) { problems.push(`${where}: English source is missing`); continue; }
    if (!existsSync(resolve(REPO, pair.ar))) {
      problems.push(`${where}: Arabic edition ${pair.ar} is missing — a declared pair cannot be English-only`);
      continue;
    }
    const disc = provenanceOf(pair.ar);
    if (!disc) {
      problems.push(`${pair.ar}: no i18n provenance line — expected <!-- i18n: source=<path> sha256=<digest> translated=<date> -->`);
      continue;
    }
    if (disc.source !== pair.en) {
      problems.push(`${pair.ar}: provenance names ${disc.source}, the manifest declares ${pair.en}`);
      continue;
    }
    const actual = sha256(pair.en);
    if (actual !== disc.sha256) {
      problems.push(
        `${pair.ar}: STALE — ${pair.en} is now ${actual}, the translation pinned ${disc.sha256}. ` +
          `Reissue the Arabic edition against the new English text, then update the pin with the digest above.`
      );
    }
  }
  assert.deepEqual(problems, [], `bilingual pairs are not in sync:\n${problems.join("\n")}`);
});

test("the CG-BTY-005 deliverables are declared — a row deleted is a row lost", () => {
  const required = [
    "docs/sep-receipt-semantics-draft-2026-11-11.md",
    "docs/STELLAR-INTEGRATION-GUIDE.md",
    "docs/reviewer-demo-script-2026-09.md",
  ];
  const declared = readManifest().pairs.map((p) => p.en);
  const absent = required.filter((en) => !declared.includes(en));
  assert.deepEqual(absent, [], `these deliverables lost their declared Arabic edition: ${absent.join(", ")}`);
});

test("an Arabic edition is real text, not a stub, and carries no executable fence", () => {
  const { pairs } = readManifest();
  for (const pair of pairs) {
    const text = readFileSync(resolve(REPO, pair.ar), "utf8").replaceAll("\r\n", "\n");
    const count = arabicChars(text);
    assert.ok(
      count >= 300,
      `${pair.ar}: only ${count} Arabic characters — a placeholder edition would satisfy the pin check and defeat the point`
    );
    assert.ok(
      !/^```bash\s*$/m.test(text),
      `${pair.ar}: a \`bash\` fence here would be EXECUTED by test/ci/docs-node-contract.test.js — translations show commands in \`text\` fences, and the executable block stays in the English edition`
    );
  }
});

test("no orphan Arabic editions — every one on disk is declared", () => {
  const { pairs } = readManifest();
  const declared = new Set(pairs.map((p) => p.ar));
  const onDisk = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".md")) continue;
      const rel = relative(REPO, full).split(sep).join("/");
      if (rel.startsWith("legacy-quarantine/") || rel.includes("/node_modules/")) continue;
      onDisk.push(rel);
    }
  };
  walk(resolve(REPO, "docs"));
  const orphans = onDisk.filter((rel) => {
    if (declared.has(rel)) return false;
    // Only files that CLAIM to be a translation are in scope: this guard is
    // about pairs it can verify, not about every Arabic document in the tree.
    return Boolean(provenanceOf(rel));
  });
  assert.deepEqual(orphans, [], `Arabic editions declare a source but are not listed in docs/i18n-pairs.json:\n${orphans.join("\n")}`);
});

test("negative controls: a changed source and a wrong source are both caught", () => {
  const { pairs } = readManifest();
  const pair = pairs[0];
  const disc = provenanceOf(pair.ar);
  assert.ok(disc, "the first declared pair must carry provenance for this control to mean anything");

  const tampered = readFileSync(resolve(REPO, pair.en), "utf8").replaceAll("\r\n", "\n") + "\n\u0000edited\n";
  const tamperedDigest = createHash("sha256").update(tampered, "utf8").digest("hex");
  assert.notEqual(tamperedDigest, disc.sha256, "a one-line edit to the source must change its digest");

  assert.equal(sha256(pair.en), disc.sha256, "and the untouched source must still match its pin (positive control)");

  const wrongSource = "docs/README.md";
  assert.notEqual(wrongSource, disc.source, "a provenance line naming another document must be detectable by string inequality");
});
