/**
 * Agent Commerce console page contract tests — the bilingual static console
 * must embed the committed suite artifacts verbatim inside its data island,
 * name every attack class in Arabic, carry its standing boundaries in BOTH
 * languages, and stay fully offline (no external scripts, no fetches, no
 * absolute URLs). Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pagePath = resolve(here, "../../docs/agent-commerce-console.html");
const artifactsPath = resolve(here, "../../examples/agent-commerce-security-suite/artifacts.json");

const page = readFileSync(pagePath, "utf8");
const artifactsRaw = readFileSync(artifactsPath, "utf8");

const ISLAND = /<script type="application\/json" id="suite-artifacts">([\s\S]*?)<\/script>/;

test("the console embeds the committed artifacts.json verbatim in its data island", () => {
  const m = page.match(ISLAND);
  assert.ok(m, "suite-artifacts data island present");
  assert.equal(m[1].trim(), artifactsRaw.trim());
});

test("the embedded JSON deep-equals the committed artifacts (and no placeholder remains)", () => {
  const m = page.match(ISLAND);
  assert.ok(m);
  const embedded = JSON.parse(m[1]);
  const committed = JSON.parse(artifactsRaw);
  assert.deepEqual(embedded, committed);
  assert.ok(!page.includes("@@ARTIFACTS_JSON@@"), "placeholder must be substituted");
});

test("every one of the eight attack labels appears in the Arabic arc table", () => {
  const labels = [
    "انحراف الإجمالي",
    "استبدال التاجر",
    "بند محقون",
    "استبدال الاعتماد",
    "تفويض منته",
    "إعادة استخدام",
    "تلاعب السجل",
    "غير مقروءة",
  ];
  for (const label of labels) assert.ok(page.includes(label), label);
});

test("standing boundaries travel in BOTH languages (VERIFIED ≠ SAFE · DDE/1 · no-contact · no fraud score)", () => {
  for (const s of [
    "VERIFIED ≠ SAFE", // both languages
    "DDE/1", // both languages
    "لا اتصال ولا تكامل ولا تأييد", // Arabic banner
    "no contact, integration or endorsement", // English mirror
    "ليس درجة احتيال احتمالية", // Arabic products table
    "never a probabilistic fraud score", // English mirror
    "NOT_BUILT", // honest un-built label, both languages
    "بقرار المالك", // Arabic owner-gated label
    "owner-gated", // English owner-gated label
  ]) {
    assert.ok(page.includes(s), s);
  }
});

test("the page is fully offline: no external scripts, no fetches, no absolute URLs", () => {
  assert.ok(!/<script[^>]+src=/.test(page), "no <script src>");
  assert.ok(!/\bfetch\s*\(/.test(page), "no fetch calls");
  assert.ok(!/https?:\/\//.test(page), "no absolute http(s) URLs anywhere (incl. the data island)");
  assert.ok(!/import\s/.test(page), "no module imports");
});

test("the page is Arabic-first with an English mirror", () => {
  assert.ok(page.includes('<html lang="ar" dir="rtl">'));
  assert.ok(page.includes("مرآة إنجليزية — English mirror"));
  assert.ok(page.includes("عائلة المنتجات الخمسة"));
  assert.ok(page.includes("The arc, measured — not designed"));
});
