# Agent Authorization Firewall — AC-FW/1 (product 1, composed)

**Date:** 2026-11-16 · **Status:** BUILT · TEST_EXECUTED (offline) · integration NOT_BUILT (no external adopter yet) · broadcast surfaces: none, by design.

## الملخص (عربي)

منتج «جدار الحماية للتفويض» في عائلة CoreGuard Agent Commerce هو الآن **وجه واحد مؤلَّف** فوق المحركات الموجودة في المستودع — لم يُبنَ محرك خامس. البوابة قبل التنفيذ (`authorizeRequest`) تحكم على الطلب المُعلَن قبل إرساله: السياسة المُلتزَمة، وتطابق بايتات الطلب مع بايتات الموافقة، ونافذة التفويض (ضد وقت يثبّته المستدعي فقط — لا تُقرأ ساعة النظام أبداً)، وحالة الاستهلاك للاستخدام الواحد (تُستشار ولا تُستهلك). المراجعة بعد التنفيذ (`reviewExecution`) تعيد سجل التحقق الكامل (CGEP/1 + التصنيف AGR/1). القرار ALLOW أو DENY، ورفض مغلق فشلياً بكود مسمّى من مفردات AC-FW/1 المجمدة؛ القائمة الفارغة للأسباب هي **الطريق الوحيد** إلى ALLOW. لا توقيع ولا إرسال ولا بث هنا أبداً؛ VERIFIED ≠ SAFE؛ الطلب الاصطناعي فقط في كل مثال.

## What ships (this tree)

- `packages/agent-commerce/firewall.mjs` — the composed face (AC-FW/1):
  - **PRE-EXECUTION `authorizeRequest({ consent?, intent?, policy, declaredTrace, nowSeconds?, consumedSet? })`** — the request-time interception hook an application calls BEFORE submitting an agent order. Judges the DECLARED request: committed policy (`packages/policy`) evaluated against the family's shared trace→policy context; when a consent record is supplied, the request must be byte-identical to the approved declared bytes (and any claimed intent/policy must canonical-match the approved ones); the authorization window is enforced only against a caller-pinned `nowSeconds` (the wall clock is never read — the C40 rule); single-use replay state is consulted, never consumed.
  - **POST-EXECUTION `reviewExecution({ consent, trace, consumedSet? })`** — the after-the-fact review: the full `verifyExecution` record (CGEP/1 check list + AGR/1 named classes + `driftNamed`). A single-use consent is consumed here, by its first verified execution.
  - **`createFirewall({ consumedSet? })`** — one bound guard with ONE shared consumption ledger, so the same gate is wired before and after submit.
- `packages/agent-commerce/policy-context.mjs` — the ONE trace→policy mapping shared by the firewall and the risk engine (AGR/1), so a gate decision and a risk report can never disagree about what a rule saw.
- `examples/agent-commerce-firewall/run.mjs` + committed `artifacts.json` — the deterministic offline demo (exact arc + 5 named attack legs); byte-stable across reruns.
- `test/integrations/agent-commerce-firewall.test.mjs` — the contract: the exact arc, every refusal code, byte-determinism, the frozen vocabularies, the no-broadcast export discipline, and the registry's product-1 mapping.

## The two decision points

| Phase | Function | Consumes single-use? | Judges |
|---|---|---|---|
| PRE-EXECUTION | `authorizeRequest` | **never** — the request has not executed | the DECLARED request: policy + consent byte-match + caller-pinned window + replay state |
| POST-EXECUTION | `reviewExecution` | **yes** — first verified execution | the EXECUTED order: CGEP/1 checks + AGR/1 classes + driftNamed |

## What it composes — and what it does NOT absorb

The face composes existing committed engines and builds no fifth engine: `packages/policy` (rule evaluation), the CGCR/1 consent binding (`index.mjs` verifyConsent + hashTrace), the CGEP/1 verdict + AGR/1 taxonomy (via `verifyExecution`), and the shared context mapping. The distinct older surfaces stay distinct: `packages/firewall` is the Phase-D EVM decision core for the signed-intent lane (its own 16-leg attack lab), and `packages/agent-gate` is the Stellar mandate gate (AGENT-GATE/1). The registry's product-1 entry (`agent-authorization-firewall`) now points at the composed face — previously it pinned `packages/agent-gate/index.mjs`, a real mapping discrepancy this push resolves, guarded by a contract test.

## The frozen refusal vocabulary (AC-FW/1)

`MALFORMED_REQUEST` · `POLICY_REFUSED` · `CONSENT_MISMATCH` · `CONSENT_INVALID` · `WINDOW_CLOSED` · `SINGLE_USE_CONSUMED` — adding a code is additive; renaming is forbidden; decisions cite the code. Verdicts: ALLOW | DENY, fail-closed end to end; unreadable fields are refusals, never guesses; the underlying verifier's own wall-clock report field is deliberately dropped (the decision stays byte-deterministic).

## How a reviewer re-derives (offline, zero keys)

Run the demo: `node examples/agent-commerce-firewall/run.mjs` — exit 0 ONLY on the exact arc (PRE gate ALLOW → the exact execution VERIFIES → the 5 named attack legs DENIED with their codes → determinism).

Run the contract: `node --test test/integrations/agent-commerce-firewall.test.mjs` — 21 tests over the arc, the refusal codes, determinism, the vocabularies, the no-broadcast discipline and the registry mapping.

Re-run determinism: the demo regenerates `examples/agent-commerce-firewall/artifacts.json` byte-identically — the committed copy is the reference artifact.

## Honest gaps (stated, never hidden)

- **Durable single-use consumption anchoring is NOT_BUILT** — the default ledger is process-local by design; a fresh process cannot see a previous consumption (documented on every report); `consumedSet` accepts an external ledger today, and the spec's named next step remains the durable anchor.
- **integration NOT_BUILT** — no external adopter has wired the firewall yet; TEST_EXECUTED is the honest execution axis.
- **No tsc lane yet** — the firewall module is plain ESM without a type declaration surface in this push.
- **The window needs a pinned time** — the gate never reads the wall clock; a caller that wants window enforcement pins `nowSeconds` (the POST review enforces expiry against the trace's own blockTimestamp unconditionally).

## Boundary (standing)

The firewall REFUSES — it never signs, submits, broadcasts or sends anything. VERIFIED ≠ SAFE. Delivery conformity (DDE/1) is never decided. The actor is declared, never detected. Every order in the demo is synthetic (the credential is a placeholder, never a PAN). No contact, integration or endorsement is claimed with OpenAI, American Express, Mastercard, Visa or any provider.
