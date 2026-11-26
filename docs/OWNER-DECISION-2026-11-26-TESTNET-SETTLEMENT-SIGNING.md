# سجلّ قرار المالك — 2026-11-26 · التوقيع والتسوية على Testnet بمفتاح مُفوَّض

Arabic-first instrument + English mirror. This instrument is committed **before** the action it authorizes. It lifts the CoreGuard owner gate for exactly one scoped operation: an owner-delegated, ephemeral-key-signed native XLM payment on **Stellar Testnet**, confirmed in a closed ledger. It authorizes no Mainnet action, no production action, no customer/pilot action, and no claim of owner-held-key custody or transferable signing authority.

## قرار المالك (المسجَّل حرفياً)

أذن المالك (صاحب المشروع) صراحةً بالتوقيع والتسوية في جلسة 2026-11-26، وطلب إتمام العمل للنهاية بدقة واحتراف بلا أخطاء. النص العربي كما ورد:

> «اعمل التسوية والتوقيع دا دا تفويض وصلاحية مني انا المالك
> اعمل دا بالكامل للنهاية للأخر باستثنائية وابتكار وعبقرية ودقة واحترافة وبدون اخطأ نهائي وتميز وابهرني»

**توضيح حاسم:** التفويض هنا هو تفويض تنفيذي موثَّق لوكيل المشروع كي يولّد مفتاحاً مؤقتاً في الذاكرة ويوقّع به على Testnet فقط. لا يوجد في هذه البيئة ملف محفظة `.stellar-wallet.json` ولا مفتاح خاص يمتلكه المالك، لذلك لا يُستخدم ولا يُادَّعى أي مفتاح خاص للمالك. ولا يمنح هذا القرار سلطة توقيع قابلة للتحويل ولا أي صلاحية Mainnet.

### الكتلة الآلية (قرار قابل للتحليل — يقرأهrunner عند كل تشغيل)

    DECISION-OWNER-AUTHORIZED-TESTNET-SETTLEMENT-2026-11-26
    authorized_signing: YES
    authorized_settlement: YES
    network: testnet
    key-origin: owner-delegated agent-generated in-memory ephemeral keypair
    owner-held-key: NOT_USED
    mainnet: NOT_AUTHORIZED
    scope: one native XLM payment, amount <= 5 XLM, from a funded ephemeral source to a funded ephemeral destination, memo cg-owner-settlement
    gate: preflight ALLOW + exact XDR binding + evidence VERIFIED before any settlement claim
    finality: Horizon transaction successful + closed ledger + independent re-read + exact source/destination balance deltas
    secret-discipline: generated keys stay in memory only; never written, logged, printed or exported; public keys only in the artifact
    never: mainnet, production, customer, pilot, sponsor, audit, funding, adoption, endorsement, KYC/AML clearance, asset truth, compliance certification
    never: owner-held-key claim, transferable signing authority, VERIFIED = SAFE, financial-advice claim
    refusal: any instruction implying owner-held keys or Mainnet under this decision is refused by name
    recorded-source: owner session message 2026-11-26 (this chat, Arabic, verbatim quote above)
    END DECISION-OWNER-AUTHORIZED-TESTNET-SETTLEMENT-2026-11-26

## Owner decision (English mirror)

The owner explicitly authorized signing and settlement on 2026-11-26 and requested the work be completed to the end, precisely, professionally, without errors, and with excellence. The recorded Arabic text is quoted verbatim above.

This instrument authorizes exactly one **delegated Testnet** signing and settlement execution: an agent-generated ephemeral keypair, held in memory only, signs a native XLM payment to a second funded ephemeral account; the transaction must pass CG-SG/1 preflight, bind exact envelope bytes, be accepted by Horizon, be re-read independently, and land in a **closed Testnet ledger** with exact balance deltas. No owner-held key exists in this environment and none is claimed. No Mainnet, production, customer, pilot, sponsor, audit, funding, adoption, compliance, KYC/AML, asset-truth, or `VERIFIED = SAFE` claim is authorized.

## Limits that survive the execution

- `VERIFIED` means saved bytes and supplied evidence matched; it never means `SAFE`.
- A closed Testnet ledger proves that this recorded Testnet transfer reached ledger closure; it does not prove Mainnet settlement, legal finality, asset truth, sanctions/KYC/AML clearance, or production readiness.
- The signature proves that the ephemeral delegated key produced the signed envelope; it does not prove owner-held-key custody or a transferable production signing authority.
- The live runner is operator-only and is not an MCP tool. MCP tools remain offline, deterministic, and caller-supplied-evidence-only.
