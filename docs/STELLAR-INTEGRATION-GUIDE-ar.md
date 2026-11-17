<!-- i18n: source=docs/STELLAR-INTEGRATION-GUIDE.md sha256=ec7aaf7fedbdd07906f1822d9925aed8ad2f70b3ca11d2b854eb5bbb21ec963f translated=2026-11-16 -->

# دليل تكامل CoreGuard مع Stellar

## نظرة عامة

توفّر CoreGuard حقيقة تنفيذ قابلة للتحقق على Stellar. كل دفعة على Stellar، وكل
استدعاء عقد Soroban، وكل معاملة DEX يمكن التحقق منها **قبل** التقديم بأدلة قابلة
لإعادة التشغيل بشكل مستقل.

---

## الميزات القاتلة (Stellar)

| الميزة | الوصف | الحالة |
|---|---|---|
| **Killer Feature** | ربط النيّة بالدليل في معاملات Stellar | ✅ مبني |
| **Killer Use** | بوابة دفع لوكلاء الذكاء الاصطناعي على Stellar | ✅ مبني |
| **Killer On-Chain** | مرساة الالتزام على Soroban | ✅ منشورة على Testnet |
| **Killer Utility** | درع DApp شامل لـ Stellar | ✅ مبني |
| **Killer Adoption** | تكامل بسطر واحد لتطبيقات Stellar | ✅ مبني |
| **Killer Reference** | إعادة تشغيل حتمية قبل التقديم | ✅ مبني |
| **Killer Customer** | تطبيقات Stellar، المحافظ، التجارة، الوكلاء، الضمان، الجسور، DEX | ✅ جاهز |

---

## التكامل مع النظام البيئي لـ Stellar

### 1. محفظة Freighter
- **الحزمة**: `packages/stellar/freighter.mjs`
- **الوظائف**: getPublicKey، getNetwork، signTransaction، signAuthEntry
- **الحالة**: ✅ جاهز

### 2. بوابة DEX على Soroban
- **الحزمة**: `packages/stellar/soroban-dex.mjs`
- **الوظائف**: swap، path payment، provide liquidity، remove liquidity، claim
- **الحالة**: ✅ جاهز

### 3. مرساة الالتزام على Soroban
- **الحزمة**: `packages/stellar-soroban/index.mjs`
- **الوظائف**: upload، create، invoke، read، anchor
- **Testnet**: ✅ منشورة (CCERTRITP7A6U4PQ7NUKHXKWL2BNRMSBLVAAAWWMRAZTICUN7ZGC5Q4R)
- **Mainnet**: 🔄 جاهزة (تحتاج 10 XLM لرفع WASM)

### 4. بوابة دفع لوكلاء الذكاء الاصطناعي
- **الحزمة**: `packages/stellar-agent/index.mjs`
- **الوظائف**: التحقق من دفعات الوكلاء، فرض السياسة، إعادة التشغيل
- **الحالة**: ✅ مبني

### 5. منفّذ الشبكة الرئيسية
- **الحزمة**: `packages/stellar/mainnet-executor.mjs`
- **الوظائف**: payment، Soroban invoke، commitment anchor
- **الحالة**: ✅ الخطة جاهزة

---

## لماذا يحتاج Stellar إلى CoreGuard

### المشكلة
- يعالج Stellar مليارات في المدفوعات العابرة للحدود
- لا توجد أداة تتحقق من مطابقة التنفيذ للتصريح
- إخفاقات الدفع يصعب تشخيصها
- فرق الامتثال تثق ولا تتحقق
- وكلاء الذكاء الاصطناعي بلا تحقق من الدفع

### الحل
توفّر CoreGuard:
1. **تحقق قبل التقديم** — تحقّق قبل أن تُقدّم
2. **إعادة تشغيل حتمية** — أعد التشغيل بعد التقديم بشكل مستقل
3. **مغلقة-عند-الفشل** — UNKNOWN ← HELD (لا مرور صامت أبدًا)
4. **بوابات وكلاء** — تحقّق من دفعات الوكلاء قبل التنفيذ
5. **بوابة DEX** — تحقّق من المبادلات ومدفوعات المسار وتوفير السيولة
6. **ترسية الالتزام** — رسّي الدليل على Soroban

### القيمة الفريدة
- **لا منافس** على Stellar يوفّر أدلة تنفيذ قابلة للتحقق
- **الأول** في التحقق من التنفيذ على Stellar
- **AI-first** — مبني لدفعات وكلاء الذكاء الاصطناعي
- **حتمي** — نفس المدخل ← نفس المخرج، دائمًا
- **مغلق-عند-الفشل** — المجهول يُحتجَز ولا يمرّ

---

## طلب SCF Build

### المسار: Integration Track

### الميزانية: $130,000 (داخل سقف $150K)

### المدة: 6 أشهر

### المراحل
1. الشهر 1: نشر Soroban على الشبكة الرئيسية
2. الشهر 2: تكامل Freighter
3. الشهر 3: بوابة DEX
4. الشهر 4: بوابات الوكلاء
5. الشهر 5: التحقق العابر للحدود
6. الشهر 6: الإطلاق

### الروابط
- **المستودع**: https://github.com/coreguard-global/CoreGuard
- **حزمة Stellar**: packages/stellar/
- **حزمة Soroban**: packages/stellar-soroban/
- **طلب SCF**: docs/SCF-BUILD-APPLICATION.md
- **عرض التقديم**: docs/PITCH-DECK.md

---

## تكامل وكلاء الذكاء الاصطناعي

CoreGuard على Stellar مبني للوكلاء:

1. **بوابة دفع الوكيل** — تحقّق من دفعات الوكيل قبل التنفيذ
2. **فرض السياسة** — حدود الإنفاق وقوائم المستفيدين المسموحين
3. **إعادة تشغيل حتمية** — أعد تشغيل معاملات الوكيل للتدقيق
4. **ترسية الالتزام** — رسّي قرارات الوكيل على Soroban
5. **مغلقة-عند-الفشل** — دفعات الوكيل المجهولة تُحتجَز ولا تمرّ

### حالات الاستخدام
- **روبوتات التداول** — تحقّق من الصفقات قبل التنفيذ
- **وكلاء الدفع** — تحقّق من الدفعات قبل التقديم
- **وكلاء الضمان** — تحقّق من تحرير الضمان
- **وكلاء الامتثال** — تحقّق من المطابقة التنظيمية

---

## إمكانية البراءة

طبقة حقيقة التنفيذ القابلة للتحقق في CoreGuard قابلة للتسجيل:

1. **طريقة للتحقق من مطابقة التنفيذ** — نهج جديد للتحقق من التنفيذ
2. **نظام إعادة تشغيل حتمي** — آلية إعادة تشغيل جديدة
3. **بوابة دفع لوكلاء الذكاء الاصطناعي** — تحقق جديد من دفعات الوكلاء
4. **ترسية الالتزام** — ترسية أدلة جديدة على البلوكشين

---

## فيديوهات العرض التوضيحي

### CoreGuard × Freighter — PSAR/1 (90 ثانية)

**الملف**: [assets/video/coreguard_psar1_freighter_90s.mp4](assets/video/coreguard_psar1_freighter_90s.mp4)
**المدة**: ~90 ثانية | **الغرض**: تقييم تقني / عرض لمناقشة تكامل Stellar/Freighter

**ما يعرضه الفيديو (بصدق):**
- **المشكلة والنهج:** PSAR/1 يضيف سلامة تصريح قبل التوقيع.
- **مسار النسخة النظيفة:** يعرض مسارًا قابلًا لإعادة الإنتاج من سياق نسخة نظيفة.
- **حالتا PASS / BLOCK:** تحقق الإيصال ينجح، وBLOCK على بايتات معاملة معدَّلة
  (`XDR_BINDING_MISMATCH`)، وBLOCK على إيصال منتهي (`RECEIPT_EXPIRED`).
- **الحدود (بالتصميم):** `executionProof: NOT_INCLUDED`؛ تكامل المحفظة **NOT BUILT**؛
  التبني الخارجي **NOT YET**؛ فك ترميز مضمون السياسة الدلالي ليس جزءًا من PSAR/1
  (الفحص الدلالي = PSAR/2).

> **ملاحظة:** هذا فيديو عرض مُنتَج/تقديمي. أي أصول عرض قائمة على صفحات Stellar
> تبقى كما هي. الاثنان محفوظان بوسم واضح.

### روابط PSAR/1 السريعة
- **الموديول:** [packages/stellar/presign.mjs](../packages/stellar/presign.mjs)
- **العرض:** [examples/stellar-presign/demo.mjs](../examples/stellar-presign/demo.mjs)
- **الاختبارات:** 37 اختبار تكامل آلي
- **المقترح:** [docs/freighter-presign-integration-proposal-2026-11-12.md](freighter-presign-integration-proposal-2026-11-12.md)
- **المراجعة الأمنية:** [docs/psar-security-review-2026-11-12.md](psar-security-review-2026-11-12.md)

---

## التواصل

- **البريد**: inquire@coredao.org
- **GitHub**: https://github.com/coreguard-global/CoreGuard
- **LinkedIn**: https://www.linkedin.com/company/coreguard-global
- **Twitter**: https://x.com/CoreGuardGlobal
