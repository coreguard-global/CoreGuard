/**
 * Agent Commerce dashboard page contract tests — the bilingual operator
 * dashboard must embed the committed suite artifacts verbatim inside its data
 * island, carry its standing boundaries in BOTH languages, name every attack
 * class in Arabic, state the honest gaps, and stay fully offline (no external
 * scripts, no fetches, no absolute URLs, no imports). Node 18-safe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pagePath = resolve(here, "../../docs/agent-commerce-dashboard.html");
const artifactsPath = resolve(here, "../../examples/agent-commerce-security-suite/artifacts.json");

const page = readFileSync(pagePath, "utf8");
const artifactsRaw = readFileSync(artifactsPath, "utf8");

const ISLAND = /<script type="application\/json" id="suite-artifacts">([\s\S]*?)<\/script>/;

test("the dashboard embeds the committed artifacts.json verbatim in its data island", () => {
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

test("every one of the eight attack labels appears in Arabic with its refused verdict", () => {
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
  assert.ok(page.includes("8 من 8 مرفوضة بالاسم"), "the refused-count headline is stated");
});

test("standing boundaries travel in BOTH languages (VERIFIED ≠ SAFE · DDE/1 · no-contact · no fraud score · owner-gated · NOT_BUILT · synthetic · $0)", () => {
  for (const s of [
    "VERIFIED ≠ SAFE", // both languages
    "DDE/1", // both languages
    "لا اتصال ولا تكامل ولا تأييد", // Arabic banner
    "no contact, integration or endorsement", // English mirror
    "ليس درجة احتيال احتمالية", // Arabic
    "never a probabilistic fraud score", // English mirror
    "كل طلب اصطناعي", // Arabic synthetic note
    "every order synthetic", // English mirror
    "بقرار المالك", // Arabic owner-gated
    "owner-gated", // English owner-gated
    "NOT_BUILT", // honest un-built label, both languages
    "غير مبني", // Arabic un-built
    "$0", // money is stated as zero only
  ]) {
    assert.ok(page.includes(s), s);
  }
});

test("the receipt id and pinned epoch from the committed artifacts are shown", () => {
  const committed = JSON.parse(artifactsRaw);
  assert.ok(page.includes(committed.consentReceiptId), "consent receipt id");
  assert.ok(page.includes(committed.pinnedEpoch), "pinned epoch");
});

test("the page is Arabic-first with an English mirror and names the five-product family", () => {
  assert.ok(page.includes('<html lang="ar" dir="rtl">'));
  assert.ok(page.includes("مرآة إنجليزية — English mirror"));
  assert.ok(page.includes("عائلة المنتجات الخمسة"));
  assert.ok(page.includes("BUILT · TEST_EXECUTED"), "product 5 is honestly labeled built (offline attestation surface)");
  assert.ok(page.includes("OWNER-GATED / NOT_PERFORMED"), "product 5's on-chain broadcast legs stay owner-gated and not performed");
});

test("the page is fully offline: no external scripts, no fetches, no absolute URLs, no imports", () => {
  assert.ok(!/<script[^>]+src=/.test(page), "no <script src>");
  assert.ok(!/\bfetch\s*\(/.test(page), "no fetch calls");
  assert.ok(!/https?:\/\//.test(page), "no absolute http(s) URLs anywhere (incl. the data island)");
  assert.ok(!/import\s/.test(page), "no module imports");
});
