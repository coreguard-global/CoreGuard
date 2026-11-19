/**
 * corpus-publication-claim.test.js
 *
 * On 2026-11-19 revision 6 of the AER-1 mapping said the vector "enters the
 * published corpus". It had not. The live corpus was still draft -26 at 143
 * vectors, and the other side had to check it first-hand and correct us in
 * public. That is the failure this guard exists for: our prose describing a
 * commitment as an entry.
 *
 * The guard cannot reach the corpus — CI has no network and will not get one —
 * so it does the only honest thing available: it holds prose to a DATED record
 * of what was checked (`docs/aer1-corpus-publication.json`), and it holds that
 * record to the fixtures that exist here. A claim may not outrun the record, and
 * the record may not drift from the tree.
 *
 * Two rules, both narrow enough to be worth failing on:
 *
 *   citation    a paragraph that states corpus status must cite the record by
 *               path, so a reader can see the date behind the sentence
 *   direction   a paragraph may not assert publication while the record says
 *               `accepted-not-published` — the exact claim that was wrong
 *
 * The checker is a pure function so the negative controls can feed it prose that
 * overclaims. A test that can only be run against today's honest docs proves
 * nothing about tomorrow's.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEDGER_PATH = "docs/aer1-corpus-publication.json";
const FIXTURE_DIR = "test/fixtures/var1-corpus-v1";
const STATUSES = new Set(["accepted-not-published", "published"]);

const read = (p) => readFileSync(join(REPO, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

const LEDGER = readJson(LEDGER_PATH);

/** Live prose: the root docs plus every markdown file under docs/. */
function liveDocs() {
  const paths = ["README.md", "AGENTS.md"];
  for (const entry of readdirSync(join(REPO, "docs"))) {
    if (entry.endsWith(".md")) paths.push(`docs/${entry}`);
  }
  return paths.map((path) => ({ path, text: read(path) }));
}

/**
 * Paragraphs with the line they start on, so a failure names the paragraph that
 * made the claim. Counted from the block's own offset: an earlier draft added
 * block lengths and reported a line 4 rows above the sentence, which points a
 * reader at the wrong text in a 300-line document.
 */
function paragraphs(text) {
  const out = [];
  const re = /[^\n](?:.|\n(?!\s*\n))*/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const block = match[0];
    if (block.trim().length === 0) continue;
    const line = text.slice(0, match.index).split("\n").length;
    out.push({ line, block });
  }
  return out;
}

/**
 * A sentence asserting presence IN THE CORPUS. The object is required on
 * purpose: docs/STATUS.md legitimately says the npm packages "are published on
 * npmjs.org" in a row that also names both vectors, and a rule that accepted a
 * bare `published` failed on that sentence — a guard that cries wolf on an
 * honest line gets deleted instead of obeyed. `is not published` and the like
 * are removed by deNegate before this runs.
 */
const PUBLICATION_ASSERTION =
  /\b(enters?|entered|has entered|is|are|was|were|now|already|landed|shipped|included|listed|appears?)\b[^.\n]{0,60}\b(?:published corpus|in the (?:live |published )?corpus|in the corpus|corpus entry)\b/i;
const CORPUS_STATUS = /\b(published|publication|publish|live corpus|corpus entry)\b/i;

const deNegate = (s) =>
  s
    .replace(/\b(?:is|are|was|were|has|have)\s+not\s+(?:yet\s+)?published\b/gi, " ")
    .replace(/\bnot\s+(?:yet\s+)?published\b/gi, " ")
    .replace(/\bnot\s+an?\s+entry\b/gi, " ")
    .replace(/\bneither\b[^.]{0,80}\bappears?\b/gi, " ");

/**
 * Every named problem with a set of docs against a ledger. Pure: no disk reads,
 * no clock, no network, so the controls below can drive it.
 */
function problemsFor({ docs, ledger, fixtures }) {
  const problems = [];
  const names = Object.keys(ledger.ourVectors ?? {});

  for (const name of names) {
    const status = ledger.ourVectors[name].status;
    if (!STATUSES.has(status)) {
      problems.push(`${LEDGER_PATH}: ${name} has unknown status ${JSON.stringify(status)}`);
    }
    if (status === "published" && !ledger.ourVectors[name].publishedIn) {
      problems.push(`${LEDGER_PATH}: ${name} is published but names no publishedIn draft`);
    }
    if (status === "published" && ledger.ourVectors[name].publishedIn !== ledger.draft) {
      problems.push(
        `${LEDGER_PATH}: ${name} claims publishedIn ${JSON.stringify(ledger.ourVectors[name].publishedIn)} but the record's draft is ${JSON.stringify(ledger.draft)}`,
      );
    }
  }

  for (const name of fixtures ?? []) {
    if (!(name in (ledger.ourVectors ?? {}))) {
      problems.push(`${FIXTURE_DIR}: fixture ${name} has no line in ${LEDGER_PATH}, so its publication state is unwritten`);
    }
  }
  for (const name of names) {
    if (fixtures && !fixtures.includes(name)) {
      problems.push(`${LEDGER_PATH}: ${name} is recorded but no fixture under ${FIXTURE_DIR} produces it`);
    }
  }

  for (const { path, text } of docs) {
    for (const { line, block } of paragraphs(text)) {
      const mentioned = names.filter((name) => block.includes(name));
      if (mentioned.length === 0) continue;
      if (!CORPUS_STATUS.test(block)) continue;
      if (!block.includes(LEDGER_PATH)) {
        problems.push(
          `${path}:${line}: ${mentioned.join(", ")} — paragraph states corpus status without citing ${LEDGER_PATH}`,
        );
        continue;
      }
      const asserted = PUBLICATION_ASSERTION.test(deNegate(block));
      const pending = mentioned.filter((name) => ledger.ourVectors[name]?.status !== "published");
      if (asserted && pending.length > 0) {
        problems.push(
          `${path}:${line}: ${pending.join(", ")} — paragraph asserts publication while ${LEDGER_PATH} records accepted-not-published`,
        );
      }
    }
  }
  return problems;
}

/** The fixtures this tree carries, by the vector name inside each one. */
function fixtureNames() {
  const names = [];
  for (const entry of readdirSync(join(REPO, FIXTURE_DIR))) {
    const parsed = JSON.parse(readFileSync(join(REPO, FIXTURE_DIR, entry), "utf8"));
    if (parsed?.schema === "CG-VECTOR/1" && typeof parsed.name === "string") names.push(parsed.name);
  }
  return names;
}

test("the record is dated, sourced, and states a draft with a count", () => {
  assert.equal(LEDGER.schema, "CG-CORPUS-PUBLICATION/1");
  assert.match(LEDGER.source, /^https:\/\//);
  assert.match(LEDGER.draft, /^draft-[a-z0-9-]+-\d+$/i);
  assert.ok(Number.isInteger(LEDGER.vectorCount) && LEDGER.vectorCount > 0);
  assert.match(LEDGER.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(typeof LEDGER.checkedBy === "string" && LEDGER.checkedBy.length > 0);
  assert.ok(Object.keys(LEDGER.ourVectors).length > 0);
});

test("the live docs do not outrun the record", () => {
  assert.deepEqual(problemsFor({ docs: liveDocs(), ledger: LEDGER, fixtures: fixtureNames() }), []);
});

test("the fixtures and the record describe the same set of vectors", () => {
  const names = fixtureNames();
  assert.equal(new Set(names).size, names.length, "two fixtures must not share a vector name");
  assert.deepEqual(names.slice().sort(), Object.keys(LEDGER.ourVectors).sort());
});

test("control: a paragraph that claims publication without citing the record fails by name", () => {
  const docs = [
    {
      path: "docs/synthetic.md",
      text: "The vector `present-consistent-nonconforming` enters the published corpus this week.\n",
    },
  ];
  const problems = problemsFor({ docs, ledger: LEDGER, fixtures: fixtureNames() });
  assert.equal(problems.length, 1, `expected one named problem, got ${JSON.stringify(problems)}`);
  assert.match(problems[0], /docs\/synthetic\.md:1/);
  assert.match(problems[0], /without citing docs\/aer1-corpus-publication\.json/);
});

test("control: citing the record is not enough while the record says pending", () => {
  const docs = [
    {
      path: "docs/synthetic.md",
      text: `The vector \`present-consistent-nonconforming\` is in the published corpus, per \`${LEDGER_PATH}\`.\n`,
    },
  ];
  const problems = problemsFor({ docs, ledger: LEDGER, fixtures: fixtureNames() });
  assert.equal(problems.length, 1, `expected one named problem, got ${JSON.stringify(problems)}`);
  assert.match(problems[0], /asserts publication while docs\/aer1-corpus-publication\.json records accepted-not-published/);
});

test("control: the same sentence passes once the record says published", () => {
  const published = JSON.parse(JSON.stringify(LEDGER));
  published.ourVectors["present-consistent-nonconforming"].status = "published";
  published.ourVectors["present-consistent-nonconforming"].publishedIn = published.draft;
  const docs = [
    {
      path: "docs/synthetic.md",
      text: `The vector \`present-consistent-nonconforming\` is in the published corpus, per \`${LEDGER_PATH}\`.\n`,
    },
  ];
  assert.deepEqual(problemsFor({ docs, ledger: published, fixtures: fixtureNames() }), []);
});

test("control: a negated status sentence is not a publication claim", () => {
  const docs = [
    {
      path: "docs/synthetic.md",
      text: `\`anchor-unresolvable\` is not published; it is a commitment, per \`${LEDGER_PATH}\`.\n`,
    },
  ];
  assert.deepEqual(problemsFor({ docs, ledger: LEDGER, fixtures: fixtureNames() }), []);
});

test("control: a fixture with no line in the record fails, and so does a record with no fixture", () => {
  const orphanFixture = problemsFor({
    docs: [],
    ledger: LEDGER,
    fixtures: [...fixtureNames(), "vector-nobody-recorded"],
  });
  assert.ok(orphanFixture.some((p) => p.includes("vector-nobody-recorded") && p.includes("has no line")));

  // A name recorded but not produced here is the other direction of the same
  // drift: the record may not describe a vector this tree does not carry.
  const thinFixtures = fixtureNames().filter((name) => name !== "anchor-unresolvable");
  const orphanRecord = problemsFor({ docs: [], ledger: LEDGER, fixtures: thinFixtures });
  assert.ok(orphanRecord.some((p) => p.includes("anchor-unresolvable") && p.includes("no fixture")));

  const badStatus = JSON.parse(JSON.stringify(LEDGER));
  badStatus.ourVectors["anchor-unresolvable"].status = "in-review";
  const statusProblem = problemsFor({ docs: [], ledger: badStatus, fixtures: fixtureNames() });
  assert.ok(statusProblem.some((p) => p.includes("unknown status")));
});

test("every live doc the guard reads exists, so a rename cannot silence it", () => {
  const docs = liveDocs();
  assert.ok(docs.length >= 20, `expected the live doc set, got ${docs.length}`);
  assert.ok(docs.some((d) => d.path === "README.md"));
  assert.ok(docs.some((d) => d.path === "docs/STATUS.md"));
  for (const doc of docs) {
    assert.ok(doc.text.length > 0, `${relative(REPO, join(REPO, doc.path))} must not be empty`);
  }
});
