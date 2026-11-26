# CG-SETTLE/1 — إثبات توقيع وتسوية Stellar Testnet بمفتاح مُفوَّض · 2026-11-26

**Status:** `SETTLEMENT_RECORDED — OWNER-DELEGATED TESTNET / NOT PRODUCTION`
**Authority:** `docs/OWNER-DECISION-2026-11-26-TESTNET-SETTLEMENT-SIGNING.md`
**Machine proof:** `docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json`

## الحقيقة المُقاسة

بعد تسجيل قرار المالك في Git ضمن commit منفصل `81cb3761b98fd57210ae1e30489f28a1ea430fa8` قبل أي توقيع أو بث، نفّذ runner مستقلّ توقيعاً وتسوية حقيقيين على **Stellar Testnet فقط**:

- أنشأ زوجي مفاتيح Ed25519 مؤقتين في الذاكرة (الدافع والمستلم) بموجب تفويض المالك المسجّل؛
- موّل الحسابين عبر Friendbot العام؛
- أنشأ دفعة أصلية (native XLM) بقيمة `1` XLM مع memo `cg-owner-settlement` وtime bounds مثبّتة؛
- مرّر البايتات عبر CG-SG/1: preflight `ALLOW`، ربط `BOUND`، وتحقق أدلة `VERIFIED` بصفر breaks؛
- وقّعRunner بالبايتات النهائية، وتحقّق من التوقيع رياضياً من المفتاح العام وحده؛
- بثّ المعاملة إلى Horizon Testnet، ثم أعاد قراءتها عبر GET مستقل؛
- انتظر حتى أُغلق الليدر وظهر ليدر لاحق، وسجّل فارق الرصيد الدقيق.

## البيانات العامة

| الحقل | القيمة |
|---|---|
| الشبكة | `testnet` — `Test SDF Network ; September 2015` |
| نقطة النهاية | `https://horizon-testnet.stellar.org` |
| المفتاح العام للدافع | `GC55WE4J4I5Q6JVZ4M26VDFLWFOQYQYOJ3KFBIY7IRD3NUFD6LUCD3WD` |
| المفتاح العام للمستلم | `GBJJHUF7SSPAONUCAITLOCKX2SB6SF4EQXM4NGNCGZT5RV2ULMI4V7UL` |
| تجزئة المعاملة | `c84d57b76b5de93444f41c72a29aca07525f3d3c84196fce03c2df01544c0309` |
| الليدر | `5936704` (مغلق عند `2026-11-26T15:32:43Z`) |
| تجزئة الليدر | `23e1a041b28cd4a5f9688c7ece3f040e4ad02ecdeb0b0ee4409fc169d2c8b95f` |
| أحدث ليدر مُلاحظ | `5936705` (تأكيد واحد بعد ليدر المعاملة) |
| نتيجة Horizon | `successful: true` |
| الرسوم | `100` stroops |
| رصيد الدافع | `10000.0000000` ← `9998.9999900` XLM |
| رصيد المستلم | `10000.0000000` ← `10001.0000000` XLM |

## إثبات التوقيع والتجريد

التوقيع مُخزَّن كـ 64 بايت في الأرشيف، ومع ذلك لا تُكتب أي كلمة سر أو مفتاح خاص في أي ملف. التحقق يعيد بناء المعاملة من `envelope_xdr` العام، ويشتق التجزئة، ويتحقق من التوقيع بالمفتاح العام فقط.

| البند | القيمة |
|---|---|
| خوارزمية | Ed25519 |
| تجزئة الرسالة المُوقَّعة | `c84d57b76b5de93444f41c72a29aca07525f3d3c84196fce03c2df01544c0309` |
| التوقيع (بيانات عامة) | `c2811ae8f2ec0518f6a0e4469c87c1dc905ead6f0a7c57816ea3dcab78bdfac60ce19b0f4fc54f4bc2d38f5c89b731326784a4c8eacacfda5c6dac1fba416401` |
| نتيجة التحقق | `true` |
| digest التفويض | `sha256:4e4c0a902b304a150e4eb91660d414fcabbb874bf4816e59b5903f046761ad99` |
| digest البايتات | `sha256:65de7ed567c2fbb08f1103bae0f83b66680ae73d8d4198412ea3dbd827f03811` |
| digest الأدلة | `sha256:bbf6a2b3422984c1f3fb625c7bb0bcfdf9c08b03b161ad33df4f71d43edef5c8` |
| digest حزمة الأدلة | `sha256:43d3163d7bc8020d967567a6610a9121e6a6762112c5457537a96d88e300b8df` |
| digest الأرشيف | `sha256:21349c1905e8bde4c7e0bf109047ac5bef3a10dda3110e0d22fd9d2beb757d4e` |

## ما يُثبته هذا وما لا يُثبته

| يُثبته فعلاً | لا يُثبته |
|---|---|
| توقيع Ed25519 حقيقي على بايتات المعاملة المحفوظة | استخدام مفتاح خاص يمتلكه المالك |
| قبول Testnet للمعاملة وإدراجها في ليدر **مغلق** | تسوية Mainnet أو تحويل قيمة قانوني/مالي نهائي |
| إعادة قراءة مستقلة تطابق البايتات والنتيجة والليدر | وصول حقيقة الأصل أو سلامة المستلم أو KYC/AML |
| فروق رصيد دقيقة إلى الـ stroop في الحسابين العامّين | أمانة أو تدقيق أو شهادة امتثال |
| ربط CG-SG/1 للبايتات نفسها قبل البث وبعده | بوابة إنتاج أو SLA أو عميل/تجربة رائدة |
| قرار مالك مسجّل قبل التنفيذ باسم التفويض المحدد | سلطة توقيع قابلة للتحويل أو حفظ مفاتيح لدى CoreGuard |

**`VERIFIED ≠ SAFE`.** كلمة `VERIFIED` هنا تعني أن البايتات المحفوظة والأدلة المقدَّمة تطابقت؛ لا تعني أن التحويل «آمن» أو أن المستلم موثوق أو أن التسوية نهائية قانونياً.

ملف `docs/state-snapshot.json` و`docs/claims-registry.json` و`docs/STATUS.md` هي المصادر الرسمية للأرقام والحالة؛ لا تُستخدم هذه الوثيقة لإدعاء أي رقم خارج ما قيس هنا.

## إعادة التحقق دون شبكة

الأمر محفوظ داخل حقل `replay` في الأرشيف، ويُعيد deriviation البوابة والتوقيع وإغلاق الليدر والأرصدة من البايتات المحفوظة فقط. الاختبار `test/integrations/stellar-owner-settlement.test.mjs` يغطّي 11 حالة حتمية، منها تخريب بايت واحد، وتغيير التجزئة، وتغيير الرصيد، وحقن حقل سرّي.

## المراجع

- القرار: `docs/OWNER-DECISION-2026-11-26-TESTNET-SETTLEMENT-SIGNING.md`
- Runner: `scripts/stellar-owner-settlement.mjs`
- الأرشيف الآلي: `docs/STELLAR-OWNER-SETTLEMENT-2026-11-26.json`
- المواصفة: `docs/COREGUARD-STELLAR-AGENT-SECURITY-SPEC-v0.2.md`
- الإثبات السابق (تجريبي): `docs/STELLAR-TESTNET-PROOF-2026-11-26.md`

## English mirror

**Status:** `SETTLEMENT_RECORDED — OWNER-DELEGATED TESTNET / NOT PRODUCTION`.

After committing the owner decision in a separate commit `81cb3761b98fd57210ae1e30489f28a1ea430fa8` before any signing or broadcast, a standalone operator-only runner generated two ephemeral Ed25519 keypairs in memory under that recorded delegation, funded them through public Friendbot, built a 1 XLM native payment with memo `cg-owner-settlement`, passed it through CG-SG/1 preflight, exact-byte binding and evidence verification, signed the final envelope, and submitted it to the public Horizon Testnet endpoint. The transaction was independently re-read, observed in closed ledger `5936704` with one subsequent ledger, and its exact source/destination balance deltas were checked to the stroop.

The recorded public evidence is transaction hash `c84d57b76b5de93444f41c72a29aca07525f3d3c84196fce03c2df01544c0309`, ledger hash `23e1a041b28cd4a5f9688c7ece3f040e4ad02ecdeb0b0ee4409fc169d2c8b95f`, source key `GC55WE4J4I5Q6JVZ4M26VDFLWFOQYQYOJ3KFBIY7IRD3NUFD6LUCD3WD`, and destination key `GBJJHUF7SSPAONUCAITLOCKX2SB6SF4EQXM4NGNCGZT5RV2ULMI4V7UL`. The 64-byte Ed25519 signature verifies from public bytes alone. No secret value was written, logged, printed or exported.

This proves a real delegated-key signature and Testnet ledger-closed inclusion of the exact signed bytes. It does **not** prove owner-held-key use, Mainnet settlement, legal or financial finality, sanctions/KYC/AML clearance, asset truth, custody, audit, compliance, a customer/pilot, or production readiness. **`VERIFIED ≠ SAFE`** — here it means the saved bytes and supplied evidence matched.
