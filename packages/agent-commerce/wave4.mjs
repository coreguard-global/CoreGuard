/**
 * CoreGuard Agent Commerce — Wave 4 (CG-W4/1)
 *
 * Deterministic, offline evidence/policy tools for cross-border payments,
 * chain settlement evidence, machine/robot commerce, credit/loan evidence,
 * and operations. All inputs are caller-supplied. No live network, no chain
 * RPC, no bank/SWIFT/PI access, no custody, no compliance certification.
 *
 * VERIFIED ≠ SAFE. Findings are evidence for human decision, not truth,
 * settlement finality, sanctions clearance, or regulatory approval.
 */

import { createHash } from "node:crypto";

export const WAVE4_VERSION = "CG-W4/1";
export const WAVE4_BOUNDARY =
  "Wave 4 is deterministic, offline verification over caller-supplied evidence. " +
  "It does not contact SWIFT, banks, card networks, PI Network, Stellar, Ethereum, Core DAO, DeFi protocols, credit bureaus, or regulators. " +
  "Outputs are evidence/risk signals only; VERIFIED ≠ SAFE; no settlement finality, sanctions clearance, KYC/AML approval, or compliance certification is claimed.";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arr = (v) => Array.isArray(v) ? v : [];
const str = (v) => typeof v === "string" ? v : "";
const num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
const dec = (v) => { if (typeof v === "string" && /^-?[0-9]+(\.[0-9]+)?$/.test(v)) return v; if (Number.isInteger(v)) return String(v); return null; };
const decInt = (v) => { if (typeof v === "string" && /^[0-9]+$/.test(v)) return BigInt(v); if (Number.isInteger(v) && v >= 0) return BigInt(v); return null; };
const lower = (v) => str(v).toLowerCase();
const upper = (v) => str(v).toUpperCase();

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}
export function digestOf(value) { return "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex"); }

function ok(type, fields) { return { type, spec: WAVE4_VERSION, status: "OK", ...fields, boundary: WAVE4_BOUNDARY }; }
function refusal(type, code, detail, fields={}) { return { type, spec: WAVE4_VERSION, status: "REFUSED", refusal: { code, detail }, ...fields, boundary: WAVE4_BOUNDARY }; }
function check(id, okv, severity, detail, evidence={}) { return { id, ok: !!okv, severity, detail, evidence }; }

function requireObj(args, key, type) {
  const v = args[key];
  if (!isObj(v)) return refusal(type, "INVALID_ARGUMENT", `${key} must be an object`, { field: key });
  return null;
}
function requireStr(args, key, type) {
  if (!str(args[key])) return refusal(type, "MISSING_ARGUMENT", `${key} is required`, { field: key });
  return null;
}

function summarizeChecks(checks) {
  const failed = checks.filter(c => !c.ok);
  const critical = failed.filter(c => c.severity === "CRITICAL");
  const high = failed.filter(c => c.severity === "HIGH");
  return {
    verdict: critical.length ? "FAIL" : high.length ? "WARN" : failed.length ? "WARN" : "PASS",
    checks,
    failed: failed.map(c => c.id),
    critical: critical.map(c => c.id),
  };
}

// 1) ISO20022-like payment parse/validate
export function parseIso20022Payment(args={}) {
  const bad = requireObj(args, 'message', 'iso20022_payment_parse'); if (bad) return bad;
  const msg = args.message;
  const msgType = upper(str(msg.messageType || msg.type || msg.msgType));
  const allowed = ['PAIN.001','PACS.008','PACS.009','CAMT.054','PAIN.002'];
  const checks = [
    check('MSG_TYPE', allowed.includes(msgType) || msgType.length > 0, 'HIGH', `messageType=${msgType||'missing'}`, {messageType: msgType}),
    check('MSG_ID', !!str(msg.messageId || msg.msgId), 'HIGH', 'messageId present'),
    check('CREATION_DT', !!str(msg.creationDateTime || msg.creationDt), 'MEDIUM', 'creationDateTime present'),
    check('DEBTOR', isObj(msg.debtor) || !!str(msg.debtorName), 'HIGH', 'debtor present'),
    check('CREDITOR', isObj(msg.creditor) || !!str(msg.creditorName), 'HIGH', 'creditor present'),
    check('AMOUNT', dec(msg.amount || msg.instructedAmount?.value) !== null, 'CRITICAL', 'amount parseable'),
    check('CURRENCY', !!upper(str(msg.currency || msg.instructedAmount?.currency)), 'HIGH', 'currency present'),
  ];
  const amount = dec(msg.amount || msg.instructedAmount?.value);
  const currency = upper(str(msg.currency || msg.instructedAmount?.currency));
  const summary = summarizeChecks(checks);
  return ok('iso20022_payment_parse', { messageType: msgType, messageId: str(msg.messageId||msg.msgId), amount, currency, digest: digestOf(msg), ...summary });
}

// 2) cross-border instruction verification
export function verifyCrossBorderInstruction(args={}) {
  const badI = requireObj(args,'instruction','cross_border_instruction_verification'); if (badI) return badI;
  const badP = requireObj(args,'policy','cross_border_instruction_verification'); if (badP) return badP;
  const i = args.instruction, p = args.policy;
  const amount = decInt(i.amountMinor);
  const max = decInt(p.maxAmountMinor);
  const corridor = `${upper(str(i.sourceCountry))}->${upper(str(i.destinationCountry))}`;
  const allowedCorridors = arr(p.allowedCorridors).map(x=>upper(str(x)));
  const allowedCurrencies = arr(p.allowedCurrencies).map(x=>upper(str(x)));
  const checks = [
    check('AMOUNT_PARSE', amount !== null, 'CRITICAL', 'instruction.amountMinor parseable'),
    check('MAX_AMOUNT', amount !== null && max !== null ? amount <= max : false, 'CRITICAL', `amount ${amount} <= max ${max}`),
    check('CURRENCY', allowedCurrencies.length ? allowedCurrencies.includes(upper(str(i.currency))) : true, 'HIGH', 'currency allowed'),
    check('CORRIDOR', allowedCorridors.length ? allowedCorridors.includes(corridor) : true, 'HIGH', `corridor ${corridor} allowed`),
    check('PURPOSE', str(i.purposeCode || i.purpose).length > 0, 'MEDIUM', 'purpose present'),
    check('CUTOFF', p.cutoffHourUtc === undefined ? true : (num(i.submissionHourUtc) !== null && num(i.submissionHourUtc) <= num(p.cutoffHourUtc)), 'MEDIUM', 'submission within cutoff'),
  ];
  return ok('cross_border_instruction_verification', { corridor, amount: amount?.toString() ?? null, ...summarizeChecks(checks) });
}

// 3) FX quote risk
export function assessFxQuoteRisk(args={}) {
  const badQ = requireObj(args,'quote','fx_quote_risk'); if (badQ) return badQ;
  const badP = requireObj(args,'policy','fx_quote_risk'); if (badP) return badP;
  const q=args.quote, p=args.policy;
  const now = decInt(args.nowSeconds);
  const expires = decInt(q.expiresAtSeconds);
  const spread = num(q.spreadBps);
  const maxSpread = num(p.maxSpreadBps);
  const providers = arr(p.allowedProviders).map(x=>str(x));
  const checks = [
    check('QUOTE_ID', !!str(q.quoteId), 'MEDIUM', 'quoteId present'),
    check('PAIR', !!str(q.baseCurrency) && !!str(q.quoteCurrency), 'HIGH', 'currency pair present'),
    check('RATE', dec(q.rate) !== null, 'CRITICAL', 'rate parseable'),
    check('NOT_EXPIRED', now !== null && expires !== null ? expires >= now : false, 'CRITICAL', 'quote not expired at pinned nowSeconds'),
    check('SPREAD', spread !== null && maxSpread !== null ? spread <= maxSpread : true, 'HIGH', 'spread within policy'),
    check('PROVIDER', providers.length ? providers.includes(str(q.providerId)) : true, 'MEDIUM', 'provider allowed'),
  ];
  return ok('fx_quote_risk', { quoteId: str(q.quoteId), expired: now!==null&&expires!==null?expires<now:null, ...summarizeChecks(checks) });
}

// 4) SWIFT remittance evidence verification
export function verifySwiftRemittanceEvidence(args={}) {
  const badE = requireObj(args,'evidence','swift_remittance_evidence'); if (badE) return badE;
  const badX = requireObj(args,'expected','swift_remittance_evidence'); if (badX) return badX;
  const e=args.evidence, x=args.expected;
  const checks = [
    check('MSG_TYPE', !!str(e.messageType), 'MEDIUM', 'messageType present'),
    check('UETR', !!str(e.uetr || e.reference), 'HIGH', 'reference/uetr present'),
    check('AMOUNT_MATCH', dec(e.amountMinor) !== null && dec(e.amountMinor) === dec(x.amountMinor), 'CRITICAL', 'amount matches expected'),
    check('CURRENCY_MATCH', upper(str(e.currency)) === upper(str(x.currency)), 'CRITICAL', 'currency matches expected'),
    check('CREDITOR_MATCH', !str(x.creditorAccount) || str(e.creditorAccount) === str(x.creditorAccount), 'HIGH', 'creditor account matches when expected'),
    check('DEBTOR_MATCH', !str(x.debtorAccount) || str(e.debtorAccount) === str(x.debtorAccount), 'MEDIUM', 'debtor account matches when expected'),
    check('DIGEST', !str(x.digest) || str(e.digest) === str(x.digest), 'HIGH', 'digest matches when expected'),
  ];
  return ok('swift_remittance_evidence', { reference: str(e.uetr||e.reference), ...summarizeChecks(checks) });
}

// 5) bank transfer evidence
export function verifyBankTransferEvidence(args={}) {
  const badE = requireObj(args,'evidence','bank_transfer_evidence'); if (badE) return badE;
  const badX = requireObj(args,'expected','bank_transfer_evidence'); if (badX) return badX;
  const e=args.evidence, x=args.expected;
  const checks = [
    check('STATUS', ['SETTLED','COMPLETED','ACCEPTED'].includes(upper(str(e.status))), 'HIGH', `status=${str(e.status)}`),
    check('AMOUNT', dec(e.amountMinor) === dec(x.amountMinor), 'CRITICAL', 'amount matches'),
    check('CURRENCY', upper(str(e.currency)) === upper(str(x.currency)), 'CRITICAL', 'currency matches'),
    check('BENEFICIARY', !str(x.beneficiaryId) || str(e.beneficiaryId)===str(x.beneficiaryId), 'HIGH', 'beneficiary matches'),
    check('REFERENCE', !!str(e.reference || e.transactionId), 'MEDIUM', 'reference present'),
  ];
  return ok('bank_transfer_evidence', { reference: str(e.reference||e.transactionId), ...summarizeChecks(checks) });
}

// 6) sanctions screening evidence (no live screening)
export function assessSanctionsScreeningEvidence(args={}) {
  const badE = requireObj(args,'evidence','sanctions_screening_evidence'); if (badE) return badE;
  const badP = requireObj(args,'policy','sanctions_screening_evidence'); if (badP) return badP;
  const e=args.evidence, p=args.policy;
  const now = decInt(args.nowSeconds);
  const checkedAt = decInt(e.checkedAtSeconds);
  const maxAge = decInt(p.maxAgeSeconds);
  const ageOk = now!==null && checkedAt!==null && maxAge!==null ? (now >= checkedAt && (now-checkedAt) <= maxAge) : false;
  const result = upper(str(e.result));
  const checks = [
    check('RESULT_PRESENT', !!result, 'CRITICAL', 'screening result present'),
    check('RESULT_CLEAR', result==='CLEAR' || result==='PASS' || result==='NO_MATCH', 'CRITICAL', `result=${result}`),
    check('FRESH', ageOk, 'HIGH', 'screening evidence fresh at pinned nowSeconds'),
    check('SUBJECT', !!str(e.subjectId || e.subjectDigest), 'HIGH', 'subject identifier/digest present'),
    check('PROVIDER', !arr(p.allowedProviders).length || arr(p.allowedProviders).map(str).includes(str(e.providerId)), 'MEDIUM', 'provider allowed'),
  ];
  return ok('sanctions_screening_evidence', { result, fresh: ageOk, ...summarizeChecks(checks) });
}

// 7) invoice match
export function verifyInvoiceMatch(args={}) {
  const badInv = requireObj(args,'invoice','invoice_match'); if (badInv) return badInv;
  const badPay = requireObj(args,'payment','invoice_match'); if (badPay) return badPay;
  const inv=args.invoice, pay=args.payment;
  const checks = [
    check('INVOICE_ID', !!str(inv.invoiceId), 'MEDIUM', 'invoiceId present'),
    check('AMOUNT', dec(inv.amountMinor) === dec(pay.amountMinor), 'CRITICAL', 'amount matches'),
    check('CURRENCY', upper(str(inv.currency))===upper(str(pay.currency)), 'CRITICAL', 'currency matches'),
    check('PAYEE', !str(inv.payeeId) || str(inv.payeeId)===str(pay.payeeId), 'HIGH', 'payee matches'),
    check('REFERENCE', !str(inv.reference) || str(inv.reference)===str(pay.reference), 'MEDIUM', 'reference matches when present'),
  ];
  return ok('invoice_match', { invoiceId: str(inv.invoiceId), ...summarizeChecks(checks) });
}

// 8) payment compliance packet
export function generatePaymentCompliancePacket(args={}) {
  const bad = requireObj(args,'payment','payment_compliance_packet'); if (bad) return bad;
  const payment=args.payment;
  const evidence = isObj(args.evidence) ? args.evidence : {};
  const redactedFields = arr(args.redactFields).map(str).filter(Boolean);
  const redacted = JSON.parse(JSON.stringify(payment));
  for (const f of redactedFields) { if (f in redacted) redacted[f] = '[REDACTED]'; }
  const packet = {
    spec: WAVE4_VERSION,
    packetType: 'payment_compliance_packet',
    createdAtSeconds: decInt(args.nowSeconds)?.toString() ?? null,
    paymentDigest: digestOf(payment),
    evidenceDigest: digestOf(evidence),
    redactedPayment: redacted,
    evidence: evidence,
    checks: arr(args.checks),
  };
  return ok('payment_compliance_packet', { packet, packetDigest: digestOf(packet), redactedFields });
}

// 9) Stellar settlement evidence
export function verifyStellarSettlementEvidence(args={}) {
  const badE=requireObj(args,'evidence','stellar_settlement_evidence'); if(badE) return badE;
  const badX=requireObj(args,'expected','stellar_settlement_evidence'); if(badX) return badX;
  const e=args.evidence,x=args.expected;
  const checks=[
    check('NETWORK', !str(x.network) || upper(str(e.network))===upper(str(x.network)), 'HIGH', 'network matches'),
    check('TX_HASH', !!str(e.txHash), 'CRITICAL', 'txHash present'),
    check('STATUS', ['SUCCESS','CONFIRMED'].includes(upper(str(e.status))), 'CRITICAL', `status=${str(e.status)}`),
    check('AMOUNT', dec(e.amount)===dec(x.amount) || dec(e.amountMinor)===dec(x.amountMinor), 'CRITICAL', 'amount matches'),
    check('ASSET', !str(x.asset) || upper(str(e.asset))===upper(str(x.asset)), 'HIGH', 'asset matches'),
    check('DESTINATION', !str(x.destination) || str(e.destination)===str(x.destination), 'HIGH', 'destination matches'),
    check('MEMO', !str(x.memo) || str(e.memo)===str(x.memo), 'MEDIUM', 'memo matches when expected'),
  ];
  return ok('stellar_settlement_evidence', { txHash: str(e.txHash), ...summarizeChecks(checks) });
}

// 10) EVM settlement evidence
export function verifyEvmSettlementEvidence(args={}) {
  const badE=requireObj(args,'evidence','evm_settlement_evidence'); if(badE) return badE;
  const badX=requireObj(args,'expected','evm_settlement_evidence'); if(badX) return badX;
  const e=args.evidence,x=args.expected;
  const checks=[
    check('CHAIN_ID', decInt(e.chainId)!==null && (!decInt(x.chainId) || decInt(e.chainId)===decInt(x.chainId)), 'HIGH', 'chainId present/matches'),
    check('TX_HASH', /^0x[0-9a-fA-F]{64}$/.test(str(e.txHash)), 'CRITICAL', 'txHash format'),
    check('STATUS', [1,'1','SUCCESS','0x1'].includes(e.status), 'CRITICAL', `status=${e.status}`),
    check('TO', !str(x.to) || lower(str(e.to))===lower(str(x.to)), 'HIGH', 'to matches'),
    check('AMOUNT', !dec(x.amountWei) || dec(e.amountWei)===dec(x.amountWei), 'CRITICAL', 'amountWei matches when expected'),
    check('TOKEN', !str(x.tokenAddress) || lower(str(e.tokenAddress))===lower(str(x.tokenAddress)), 'HIGH', 'tokenAddress matches when expected'),
  ];
  return ok('evm_settlement_evidence', { txHash: str(e.txHash), chainId: decInt(e.chainId)?.toString() ?? null, ...summarizeChecks(checks) });
}

// 11) Core DAO settlement evidence (EVM profile)
export function verifyCoreDaoSettlementEvidence(args={}) {
  const e = isObj(args.evidence) ? args.evidence : null;
  if (!e) return refusal('coredao_settlement_evidence','INVALID_ARGUMENT','evidence must be an object',{field:'evidence'});
  const expected = isObj(args.expected) ? args.expected : {};
  const merged = { ...args, expected: { ...expected, chainId: expected.chainId ?? 1116 } };
  const base = verifyEvmSettlementEvidence({ evidence: e, expected: merged.expected });
  if (base.status === 'REFUSED') return { ...base, type:'coredao_settlement_evidence' };
  const chainOk = decInt(e.chainId) === decInt(merged.expected.chainId);
  const checks = [...base.checks, check('COREDAO_CHAIN', chainOk, 'CRITICAL', `chainId must be ${merged.expected.chainId}`)];
  return ok('coredao_settlement_evidence', { txHash: base.txHash, chainId: base.chainId, ...summarizeChecks(checks) });
}

// 12) Pi payment evidence (attested/mock boundary explicit)
export function verifyPiPaymentEvidence(args={}) {
  const badE=requireObj(args,'evidence','pi_payment_evidence'); if(badE) return badE;
  const badX=requireObj(args,'expected','pi_payment_evidence'); if(badX) return badX;
  const e=args.evidence,x=args.expected;
  const checks=[
    check('PAYMENT_ID', !!str(e.paymentId), 'CRITICAL', 'paymentId present'),
    check('STATUS', ['COMPLETED','SETTLED','VERIFIED'].includes(upper(str(e.status))), 'CRITICAL', `status=${str(e.status)}`),
    check('AMOUNT', dec(e.amount)===dec(x.amount), 'CRITICAL', 'amount matches'),
    check('CURRENCY', !str(x.currency) || upper(str(e.currency))===upper(str(x.currency)), 'HIGH', 'currency matches'),
    check('PAYER', !str(x.payerId) || str(e.payerId)===str(x.payerId), 'MEDIUM', 'payer matches'),
    check('PAYEE', !str(x.payeeId) || str(e.payeeId)===str(x.payeeId), 'MEDIUM', 'payee matches'),
    check('ATTESTATION', !!str(e.attestationDigest) || isObj(e.attestation), 'MEDIUM', 'attestation digest/object present'),
  ];
  const out = ok('pi_payment_evidence', { paymentId: str(e.paymentId), ...summarizeChecks(checks) });
  out.boundary = WAVE4_BOUNDARY + ' Pi Network evidence is caller-supplied/attested; no live Pi network API or mainnet settlement verification is performed.';
  return out;
}

// 13) bridge risk
export function assessBridgeRisk(args={}) {
  const badR=requireObj(args,'route','bridge_risk'); if(badR) return badR;
  const badP=requireObj(args,'policy','bridge_risk'); if(badP) return badP;
  const r=args.route,p=args.policy;
  const age = decInt(args.nowSeconds)!==null && decInt(r.quoteExpiresAtSeconds)!==null ? (decInt(args.nowSeconds)-decInt(r.quoteExpiresAtSeconds)) : null;
  const checks=[
    check('ROUTE_ID', !!str(r.routeId), 'MEDIUM', 'routeId present'),
    check('CHAINS', !!str(r.sourceChain) && !!str(r.destinationChain), 'HIGH', 'source/destination chains present'),
    check('ALLOW_CHAIN', !arr(p.allowedDestinationChains).length || arr(p.allowedDestinationChains).map(str).includes(str(r.destinationChain)), 'HIGH', 'destination chain allowed'),
    check('QUOTE_FRESH', age===null ? false : age <= 0n, 'CRITICAL', 'quote not expired'),
    check('SLIPPAGE', num(r.slippageBps)!==null && num(p.maxSlippageBps)!==null ? num(r.slippageBps)<=num(p.maxSlippageBps) : true, 'HIGH', 'slippage within policy'),
    check('PROOF', !!str(r.proofDigest) || isObj(r.proof), 'MEDIUM', 'proof digest/object present'),
  ];
  return ok('bridge_risk', { routeId: str(r.routeId), ...summarizeChecks(checks) });
}

// 14) DeFi position risk
export function assessDefiPositionRisk(args={}) {
  const badPos=requireObj(args,'position','defi_position_risk'); if(badPos) return badPos;
  const badPol=requireObj(args,'policy','defi_position_risk'); if(badPol) return badPol;
  const pos=args.position, pol=args.policy;
  const hf = num(pos.healthFactor);
  const minHf = num(pol.minHealthFactor);
  const ltv = num(pos.ltvPct);
  const maxLtv = num(pol.maxLtvPct);
  const checks=[
    check('POSITION_ID', !!str(pos.positionId), 'MEDIUM', 'positionId present'),
    check('HEALTH_FACTOR', hf!==null && minHf!==null ? hf >= minHf : false, 'CRITICAL', `healthFactor ${hf} >= ${minHf}`),
    check('LTV', ltv!==null && maxLtv!==null ? ltv <= maxLtv : true, 'HIGH', 'ltv within policy'),
    check('ORACLE_AGE', decInt(args.nowSeconds)!==null && decInt(pos.oracleUpdatedAtSeconds)!==null && decInt(pol.maxOracleAgeSeconds)!==null ? (decInt(args.nowSeconds)-decInt(pos.oracleUpdatedAtSeconds))<=decInt(pol.maxOracleAgeSeconds) : true, 'HIGH', 'oracle fresh'),
  ];
  return ok('defi_position_risk', { positionId: str(pos.positionId), healthFactor: hf, ...summarizeChecks(checks) });
}

// 15) web3 signature evidence
export function verifyWeb3SignatureEvidence(args={}) {
  const badE=requireObj(args,'evidence','web3_signature_evidence'); if(badE) return badE;
  const e=args.evidence;
  const checks=[
    check('SCHEME', !!str(e.scheme), 'HIGH', 'signature scheme present'),
    check('MESSAGE_DIGEST', /^sha256:[0-9a-f]{64}$/.test(str(e.messageDigest)) || !!str(e.messageDigest), 'HIGH', 'messageDigest present'),
    check('SIGNATURE', !!str(e.signature), 'CRITICAL', 'signature present'),
    check('CLAIMED_SIGNER', !!str(e.claimedSigner), 'HIGH', 'claimedSigner present'),
    check('RECOVERED_MATCH', e.recoveredSigner ? lower(str(e.recoveredSigner))===lower(str(e.claimedSigner)) : false, 'CRITICAL', 'recoveredSigner matches claimedSigner'),
  ];
  const out=ok('web3_signature_evidence', { claimedSigner: str(e.claimedSigner), ...summarizeChecks(checks) });
  out.boundary = WAVE4_BOUNDARY + ' Signature evidence is caller-supplied; no onchain call or key custody is performed.';
  return out;
}

// 16) stablecoin reserve evidence
export function verifyStablecoinReserveEvidence(args={}) {
  const badE=requireObj(args,'evidence','stablecoin_reserve_evidence'); if(badE) return badE;
  const badP=requireObj(args,'policy','stablecoin_reserve_evidence'); if(badP) return badP;
  const e=args.evidence,p=args.policy;
  const now=decInt(args.nowSeconds), asOf=decInt(e.asOfSeconds), maxAge=decInt(p.maxAgeSeconds);
  const fresh = now!==null && asOf!==null && maxAge!==null ? (now>=asOf && now-asOf<=maxAge) : false;
  const ratio = num(e.reserveRatioPct);
  const minRatio = num(p.minReserveRatioPct);
  const checks=[
    check('ISSUER', !!str(e.issuer), 'MEDIUM', 'issuer present'),
    check('ASSET', !!str(e.asset), 'MEDIUM', 'asset present'),
    check('FRESH', fresh, 'HIGH', 'attestation fresh'),
    check('RATIO', ratio!==null && minRatio!==null ? ratio>=minRatio : false, 'CRITICAL', 'reserve ratio meets policy'),
    check('DIGEST', !!str(e.attestationDigest) || isObj(e.attestation), 'MEDIUM', 'attestation digest/object present'),
  ];
  return ok('stablecoin_reserve_evidence', { asset: str(e.asset), reserveRatioPct: ratio, ...summarizeChecks(checks) });
}

// 17) robot mission receipt
export function createRobotMissionReceipt(args={}) {
  const badM=requireObj(args,'mission','robot_mission_receipt'); if(badM) return badM;
  const badP=requireObj(args,'policy','robot_mission_receipt'); if(badP) return badP;
  const m=args.mission,p=args.policy;
  const now=decInt(args.nowSeconds);
  const start=decInt(m.startAtSeconds), end=decInt(m.endAtSeconds);
  const checks=[
    check('MISSION_ID', !!str(m.missionId), 'CRITICAL', 'missionId present'),
    check('ROBOT_ID', !!str(m.robotId || m.agentId), 'HIGH', 'robotId present'),
    check('WINDOW', start!==null && end!==null ? end>=start : false, 'CRITICAL', 'valid time window'),
    check('GEOFENCE', !arr(p.allowedZones).length || arr(p.allowedZones).map(str).includes(str(m.zoneId)), 'HIGH', 'zone allowed'),
    check('BUDGET', decInt(m.maxSpendMinor)!==null && decInt(p.maxSpendMinor)!==null ? decInt(m.maxSpendMinor)<=decInt(p.maxSpendMinor) : true, 'HIGH', 'mission budget within policy'),
    check('NOW', now!==null, 'MEDIUM', 'pinned nowSeconds provided'),
  ];
  const receipt={ spec:WAVE4_VERSION, type:'robot_mission_receipt', mission:m, policyDigest:digestOf(p), createdAtSeconds: now?.toString()??null };
  return ok('robot_mission_receipt', { receipt, receiptDigest:digestOf(receipt), ...summarizeChecks(checks) });
}

// 18) robot mission evidence
export function verifyRobotMissionEvidence(args={}) {
  const badR=requireObj(args,'receipt','robot_mission_evidence'); if(badR) return badR;
  const badE=requireObj(args,'evidence','robot_mission_evidence'); if(badE) return badE;
  const r=args.receipt,e=args.evidence;
  const m=isObj(r.mission)?r.mission:{};
  const checks=[
    check('RECEIPT_DIGEST', !str(args.receiptDigest) || digestOf(r)===str(args.receiptDigest), 'CRITICAL', 'receipt digest matches when provided'),
    check('MISSION_ID', str(e.missionId)===str(m.missionId), 'CRITICAL', 'missionId matches'),
    check('ROBOT_ID', str(e.robotId||e.agentId)===str(m.robotId||m.agentId), 'HIGH', 'robotId matches'),
    check('ZONE', !str(m.zoneId) || str(e.zoneId)===str(m.zoneId), 'HIGH', 'zone matches'),
    check('SPEND', decInt(e.spendMinor)!==null && decInt(m.maxSpendMinor)!==null ? decInt(e.spendMinor)<=decInt(m.maxSpendMinor) : true, 'CRITICAL', 'spend within mission budget'),
    check('STATUS', ['COMPLETED','SUCCESS'].includes(upper(str(e.status))), 'HIGH', `status=${str(e.status)}`),
  ];
  return ok('robot_mission_evidence', { missionId: str(m.missionId), ...summarizeChecks(checks) });
}

// 19) machine SLA assessment
export function assessMachineSla(args={}) {
  const badE=requireObj(args,'events','machine_sla_assessment'); if(badE) return refusal('machine_sla_assessment','INVALID_ARGUMENT','events must be an array',{field:'events'});
  const events = arr(args.events);
  const policy = isObj(args.policy)?args.policy:{};
  const maxDowntime = decInt(policy.maxDowntimeSeconds);
  let downtime=0n;
  for (const ev of events) {
    if (!isObj(ev)) continue;
    if (upper(str(ev.type))==='DOWNTIME') {
      const d=decInt(ev.durationSeconds); if (d!==null) downtime += d;
    }
  }
  const checks=[
    check('EVENTS', events.length>0, 'MEDIUM', 'events provided'),
    check('DOWNTIME', maxDowntime!==null ? downtime <= maxDowntime : true, 'HIGH', `downtime ${downtime} <= ${maxDowntime}`),
  ];
  return ok('machine_sla_assessment', { downtimeSeconds: downtime.toString(), ...summarizeChecks(checks) });
}

// 20) loan application risk
export function assessLoanApplication(args={}) {
  const badA=requireObj(args,'application','loan_application_assessment'); if(badA) return badA;
  const badP=requireObj(args,'policy','loan_application_assessment'); if(badP) return badP;
  const a=args.application,p=args.policy;
  const income = decInt(a.monthlyIncomeMinor);
  const debt = decInt(a.monthlyDebtMinor);
  const requested = decInt(a.requestedAmountMinor);
  const maxAmount = decInt(p.maxAmountMinor);
  const dti = (income!==null && debt!==null && income>0n) ? Number(debt*10000n/income)/100 : null;
  const maxDti = num(p.maxDtiPct);
  const checks=[
    check('APPLICANT', !!str(a.applicantId), 'HIGH', 'applicantId present'),
    check('INCOME', income!==null && income>0n, 'CRITICAL', 'monthly income present'),
    check('AMOUNT', requested!==null && maxAmount!==null ? requested<=maxAmount : true, 'CRITICAL', 'requested amount within policy'),
    check('DTI', dti!==null && maxDti!==null ? dti<=maxDti : false, 'HIGH', `DTI ${dti} <= ${maxDti}`),
    check('TENOR', decInt(a.tenorMonths)!==null && decInt(p.maxTenorMonths)!==null ? decInt(a.tenorMonths)<=decInt(p.maxTenorMonths) : true, 'MEDIUM', 'tenor within policy'),
  ];
  const out=ok('loan_application_assessment', { applicantId:str(a.applicantId), dtiPct:dti, ...summarizeChecks(checks) });
  out.boundary = WAVE4_BOUNDARY + ' Loan assessment is deterministic over caller-supplied data; no credit bureau, bank core, or regulatory decision is performed.';
  return out;
}

// 21) collateral packet verification
export function verifyCollateralPacket(args={}) {
  const badC=requireObj(args,'collateral','collateral_packet_verification'); if(badC) return badC;
  const badP=requireObj(args,'policy','collateral_packet_verification'); if(badP) return badP;
  const c=args.collateral,p=args.policy;
  const now=decInt(args.nowSeconds), exp=decInt(c.expiresAtSeconds);
  const value=decInt(c.valuationMinor), min=decInt(p.minValuationMinor);
  const checks=[
    check('COLLATERAL_ID', !!str(c.collateralId), 'HIGH', 'collateralId present'),
    check('OWNER', !!str(c.ownerId), 'HIGH', 'ownerId present'),
    check('VALUE', value!==null && min!==null ? value>=min : false, 'CRITICAL', 'valuation meets minimum'),
    check('NOT_EXPIRED', now!==null && exp!==null ? exp>=now : true, 'HIGH', 'collateral not expired'),
    check('DIGEST', !!str(c.evidenceDigest) || isObj(c.evidence), 'MEDIUM', 'evidence digest/object present'),
  ];
  return ok('collateral_packet_verification', { collateralId:str(c.collateralId), ...summarizeChecks(checks) });
}

// 22) credit line utilization
export function assessCreditLineUtilization(args={}) {
  const badL=requireObj(args,'line','credit_line_utilization'); if(badL) return badL;
  const l=args.line;
  const limit=decInt(l.limitMinor), used=decInt(l.usedMinor);
  const maxPct=num(l.maxUtilizationPct) ?? 80;
  const pct = (limit!==null && used!==null && limit>0n) ? Number(used*10000n/limit)/100 : null;
  const checks=[
    check('LINE_ID', !!str(l.lineId), 'MEDIUM', 'lineId present'),
    check('LIMIT', limit!==null && limit>0n, 'CRITICAL', 'limit present'),
    check('USED', used!==null, 'CRITICAL', 'used present'),
    check('UTILIZATION', pct!==null ? pct <= maxPct : false, 'HIGH', `utilization ${pct}% <= ${maxPct}%`),
  ];
  return ok('credit_line_utilization', { lineId:str(l.lineId), utilizationPct:pct, ...summarizeChecks(checks) });
}

// 23) escrow milestone verification
export function verifyEscrowMilestone(args={}) {
  const badE=requireObj(args,'escrow','escrow_milestone_verification'); if(badE) return badE;
  const badM=requireObj(args,'milestone','escrow_milestone_verification'); if(badM) return badM;
  const e=args.escrow, m=args.milestone;
  const checks=[
    check('ESCROW_ID', !!str(e.escrowId), 'HIGH', 'escrowId present'),
    check('MILESTONE_ID', !!str(m.milestoneId), 'HIGH', 'milestoneId present'),
    check('APPROVALS', num(m.approvals)!==null && num(m.requiredApprovals)!==null ? num(m.approvals)>=num(m.requiredApprovals) : false, 'CRITICAL', 'required approvals met'),
    check('EVIDENCE', !!str(m.evidenceDigest) || arr(m.evidence).length>0, 'HIGH', 'evidence present'),
    check('AMOUNT', !dec(m.releaseAmountMinor) || (decInt(m.releaseAmountMinor)!==null && decInt(e.remainingMinor)!==null ? decInt(m.releaseAmountMinor)<=decInt(e.remainingMinor) : true), 'CRITICAL', 'release amount within remaining escrow'),
  ];
  return ok('escrow_milestone_verification', { escrowId:str(e.escrowId), milestoneId:str(m.milestoneId), ...summarizeChecks(checks) });
}

// 24) incident war room packet
export function createIncidentWarRoom(args={}) {
  const incident = isObj(args.incident) ? args.incident : {};
  const events = arr(args.events).filter(isObj);
  const actions = arr(args.actions).filter(isObj);
  const packet = {
    spec: WAVE4_VERSION,
    type: 'incident_war_room',
    incidentId: str(incident.incidentId || 'incident-unknown'),
    severity: upper(str(incident.severity || 'UNKNOWN')),
    createdAtSeconds: decInt(args.nowSeconds)?.toString() ?? null,
    summary: str(incident.summary),
    events: events.map(e=>({ atSeconds: decInt(e.atSeconds)?.toString()??null, type: str(e.type), actor: str(e.actor), detail: str(e.detail), digest: digestOf(e) })),
    actions: actions.map(a=>({ action: str(a.action), owner: str(a.owner), status: upper(str(a.status||'OPEN')) })),
  };
  const checks=[
    check('INCIDENT_ID', !!str(incident.incidentId), 'MEDIUM', 'incidentId present'),
    check('EVENTS', events.length>0, 'MEDIUM', 'events present'),
    check('ACTIONS', actions.length>0, 'LOW', 'actions present'),
  ];
  return ok('incident_war_room', { packet, packetDigest: digestOf(packet), ...summarizeChecks(checks) });
}


// ---------------------------------------------------------------------------
// MCP tool defs / handlers / validators
// ---------------------------------------------------------------------------

const schema = (properties, required, description) => ({
  type: "object", description, additionalProperties: true, properties, ...(required ? { required } : {}),
});
const out = (description) => ({ type: "object", description, additionalProperties: true });
function reqString(args, key) { if (typeof args?.[key] !== "string" || !args[key]) throw new Error(`${key} is required`); }
function reqObject(args, key) { if (!isObj(args?.[key])) throw new Error(`${key} is required and must be an object`); }

export const WAVE4_TOOLS = Object.freeze([
  { name:"coreguard_parse_iso20022_payment", description:"Parse and validate a caller-supplied ISO 20022-like payment message (pain.001/pacs.008/camt.054 etc.) into deterministic checks and a digest. Offline; no SWIFT/bank network access.", inputSchema:schema({message:{type:"object",description:"ISO20022-like JSON message"}},["message"],"ISO 20022-like payment message to parse."), outputSchema:out("Parse verdict, normalized fields, digest, checks.") },
  { name:"coreguard_verify_cross_border_instruction", description:"Verify a cross-border payment instruction against corridor/currency/amount/cutoff policy. Deterministic policy evidence only; no live compliance or sanctions screening.", inputSchema:schema({instruction:{type:"object"},policy:{type:"object"}},["instruction","policy"],"Instruction and corridor policy."), outputSchema:out("Pass/warn/fail checks for the instruction.") },
  { name:"coreguard_assess_fx_quote_risk", description:"Assess FX quote evidence for expiry, spread, provider allowlist, and rate presence at a pinned nowSeconds. Offline; no market data feed.", inputSchema:schema({quote:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["quote","policy","nowSeconds"],"FX quote, policy, pinned time."), outputSchema:out("FX quote risk verdict and checks.") },
  { name:"coreguard_verify_swift_remittance_evidence", description:"Verify caller-supplied SWIFT/remittance evidence against expected amount/currency/accounts/reference. Evidence only; no SWIFT network access or settlement finality claim.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence","expected"],"Remittance evidence and expected values."), outputSchema:out("Evidence match verdict and checks.") },
  { name:"coreguard_verify_bank_transfer_evidence", description:"Verify bank transfer evidence against expected instruction fields. Offline evidence check; no bank API call.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence","expected"],"Bank transfer evidence and expected values."), outputSchema:out("Bank transfer evidence verdict.") },
  { name:"coreguard_assess_sanctions_screening_evidence", description:"Assess a caller-supplied sanctions/screening result packet for freshness, provider allowlist, and clear/no-match result. No live sanctions screening; evidence only.", inputSchema:schema({evidence:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["evidence","policy","nowSeconds"],"Screening evidence, policy, pinned time."), outputSchema:out("Screening evidence assessment.") },
  { name:"coreguard_verify_invoice_match", description:"Deterministic 3-way style match between invoice and payment evidence (amount, currency, payee, reference).", inputSchema:schema({invoice:{type:"object"},payment:{type:"object"}},["invoice","payment"],"Invoice and payment evidence."), outputSchema:out("Invoice match verdict.") },
  { name:"coreguard_generate_payment_compliance_packet", description:"Bundle payment evidence into a redacted, hashed compliance packet for review/export. Local only; no regulatory submission.", inputSchema:schema({payment:{type:"object"},evidence:{type:"object"},checks:{type:"array",items:{type:"object"}},redactFields:{type:"array",items:{type:"string"}},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["payment"],"Payment and supporting evidence."), outputSchema:out("Redacted compliance packet and digests.") },
  { name:"coreguard_verify_stellar_settlement_evidence", description:"Verify caller-supplied Stellar settlement evidence against expected payment fields. No Horizon/network call; evidence only.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence","expected"],"Stellar evidence and expected values."), outputSchema:out("Stellar evidence verification verdict.") },
  { name:"coreguard_verify_evm_settlement_evidence", description:"Verify caller-supplied EVM tx/receipt evidence against expected chain, recipient, token, and amount. No RPC call; evidence only.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence","expected"],"EVM evidence and expected values."), outputSchema:out("EVM evidence verification verdict.") },
  { name:"coreguard_verify_coredao_settlement_evidence", description:"Verify caller-supplied Core DAO EVM settlement evidence with Core DAO chain-id profile checks. No RPC call; evidence only.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence"],"Core DAO evidence and optional expected values."), outputSchema:out("Core DAO evidence verification verdict.") },
  { name:"coreguard_verify_pi_payment_evidence", description:"Verify caller-supplied Pi Network payment evidence packet against expected values. Explicit boundary: attested/mock evidence only, no live Pi API/mainnet verification.", inputSchema:schema({evidence:{type:"object"},expected:{type:"object"}},["evidence","expected"],"Pi payment evidence and expected values."), outputSchema:out("Pi payment evidence verdict with explicit boundary.") },
  { name:"coreguard_assess_bridge_risk", description:"Assess bridge transfer route risk from caller-supplied route/quote/proof/policy data. No bridge API call.", inputSchema:schema({route:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["route","policy","nowSeconds"],"Bridge route, policy, pinned time."), outputSchema:out("Bridge risk verdict.") },
  { name:"coreguard_assess_defi_position_risk", description:"Assess DeFi position risk from caller-supplied snapshot (health factor, LTV, oracle age). No onchain/protocol call.", inputSchema:schema({position:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["position","policy","nowSeconds"],"Position snapshot, policy, pinned time."), outputSchema:out("DeFi position risk verdict.") },
  { name:"coreguard_verify_web3_signature_evidence", description:"Verify caller-supplied Web3 signature evidence structure and recovered/claimed signer match. No key custody or onchain call.", inputSchema:schema({evidence:{type:"object"}},["evidence"],"Signature evidence packet."), outputSchema:out("Signature evidence verdict.") },
  { name:"coreguard_verify_stablecoin_reserve_evidence", description:"Assess caller-supplied stablecoin reserve/attestation evidence for freshness and reserve ratio policy. No issuer API call; evidence only.", inputSchema:schema({evidence:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["evidence","policy","nowSeconds"],"Reserve evidence, policy, pinned time."), outputSchema:out("Reserve evidence verdict.") },
  { name:"coreguard_create_robot_mission_receipt", description:"Create a deterministic robot/agent mission receipt binding mission, zone, budget, and time window to a policy digest. Offline; no robot control.", inputSchema:schema({mission:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["mission","policy","nowSeconds"],"Mission, policy, pinned time."), outputSchema:out("Robot mission receipt and digest.") },
  { name:"coreguard_verify_robot_mission_evidence", description:"Verify robot/agent mission execution evidence against a mission receipt. Offline evidence check.", inputSchema:schema({receipt:{type:"object"},evidence:{type:"object"},receiptDigest:{type:"string"}},["receipt","evidence"],"Mission receipt and execution evidence."), outputSchema:out("Mission evidence verdict.") },
  { name:"coreguard_assess_machine_sla", description:"Assess machine/agent SLA from caller-supplied downtime/events against policy thresholds. Deterministic, offline.", inputSchema:schema({events:{type:"array",items:{type:"object"}},policy:{type:"object"}},["events"],"Events and SLA policy."), outputSchema:out("SLA assessment verdict.") },
  { name:"coreguard_assess_loan_application", description:"Assess loan application risk from caller-supplied financial fields and policy (DTI, amount, tenor). No credit bureau/bank/regulatory decision.", inputSchema:schema({application:{type:"object"},policy:{type:"object"}},["application","policy"],"Loan application and policy."), outputSchema:out("Loan application risk assessment.") },
  { name:"coreguard_verify_collateral_packet", description:"Verify collateral evidence packet for valuation, expiry, owner, and evidence digest presence. No registry/custody verification.", inputSchema:schema({collateral:{type:"object"},policy:{type:"object"},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["collateral","policy","nowSeconds"],"Collateral packet, policy, pinned time."), outputSchema:out("Collateral packet verdict.") },
  { name:"coreguard_assess_credit_line_utilization", description:"Assess credit line utilization against a max utilization threshold. Deterministic arithmetic only.", inputSchema:schema({line:{type:"object"}},["line"],"Credit line with limitMinor/usedMinor."), outputSchema:out("Utilization assessment.") },
  { name:"coreguard_verify_escrow_milestone", description:"Verify escrow milestone release conditions: approvals, evidence, and release amount within remaining escrow. No custody/broadcast.", inputSchema:schema({escrow:{type:"object"},milestone:{type:"object"}},["escrow","milestone"],"Escrow state and milestone evidence."), outputSchema:out("Escrow milestone verdict.") },
  { name:"coreguard_create_incident_war_room", description:"Create a deterministic incident war-room packet from incident metadata, events, and actions. Local evidence packaging only.", inputSchema:schema({incident:{type:"object"},events:{type:"array",items:{type:"object"}},actions:{type:"array",items:{type:"object"}},nowSeconds:{type:"string",pattern:"^[0-9]+$"}},["incident"],"Incident metadata, events, actions."), outputSchema:out("Incident war-room packet and digest.") },
]);

export const WAVE4_HANDLERS = Object.freeze({
  coreguard_parse_iso20022_payment: (a) => parseIso20022Payment(a),
  coreguard_verify_cross_border_instruction: (a) => verifyCrossBorderInstruction(a),
  coreguard_assess_fx_quote_risk: (a) => assessFxQuoteRisk(a),
  coreguard_verify_swift_remittance_evidence: (a) => verifySwiftRemittanceEvidence(a),
  coreguard_verify_bank_transfer_evidence: (a) => verifyBankTransferEvidence(a),
  coreguard_assess_sanctions_screening_evidence: (a) => assessSanctionsScreeningEvidence(a),
  coreguard_verify_invoice_match: (a) => verifyInvoiceMatch(a),
  coreguard_generate_payment_compliance_packet: (a) => generatePaymentCompliancePacket(a),
  coreguard_verify_stellar_settlement_evidence: (a) => verifyStellarSettlementEvidence(a),
  coreguard_verify_evm_settlement_evidence: (a) => verifyEvmSettlementEvidence(a),
  coreguard_verify_coredao_settlement_evidence: (a) => verifyCoreDaoSettlementEvidence(a),
  coreguard_verify_pi_payment_evidence: (a) => verifyPiPaymentEvidence(a),
  coreguard_assess_bridge_risk: (a) => assessBridgeRisk(a),
  coreguard_assess_defi_position_risk: (a) => assessDefiPositionRisk(a),
  coreguard_verify_web3_signature_evidence: (a) => verifyWeb3SignatureEvidence(a),
  coreguard_verify_stablecoin_reserve_evidence: (a) => verifyStablecoinReserveEvidence(a),
  coreguard_create_robot_mission_receipt: (a) => createRobotMissionReceipt(a),
  coreguard_verify_robot_mission_evidence: (a) => verifyRobotMissionEvidence(a),
  coreguard_assess_machine_sla: (a) => assessMachineSla(a),
  coreguard_assess_loan_application: (a) => assessLoanApplication(a),
  coreguard_verify_collateral_packet: (a) => verifyCollateralPacket(a),
  coreguard_assess_credit_line_utilization: (a) => assessCreditLineUtilization(a),
  coreguard_verify_escrow_milestone: (a) => verifyEscrowMilestone(a),
  coreguard_create_incident_war_room: (a) => createIncidentWarRoom(a),
});

export const WAVE4_VALIDATORS = Object.freeze({
  coreguard_parse_iso20022_payment: (a) => (isObj(a.message) ? null : { code: "MISSING_ARGUMENT", detail: "message is required and must be an object" }),
  coreguard_verify_cross_border_instruction: (a) => (isObj(a.instruction) && isObj(a.policy) ? null : { code: "MISSING_ARGUMENT", detail: "instruction and policy are required objects" }),
  coreguard_assess_fx_quote_risk: (a) => (isObj(a.quote) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "quote, policy, nowSeconds required" }),
  coreguard_verify_swift_remittance_evidence: (a) => (isObj(a.evidence) && isObj(a.expected) ? null : { code: "MISSING_ARGUMENT", detail: "evidence and expected are required objects" }),
  coreguard_verify_bank_transfer_evidence: (a) => (isObj(a.evidence) && isObj(a.expected) ? null : { code: "MISSING_ARGUMENT", detail: "evidence and expected are required objects" }),
  coreguard_assess_sanctions_screening_evidence: (a) => (isObj(a.evidence) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence, policy, nowSeconds required" }),
  coreguard_verify_invoice_match: (a) => (isObj(a.invoice) && isObj(a.payment) ? null : { code: "MISSING_ARGUMENT", detail: "invoice and payment are required objects" }),
  coreguard_generate_payment_compliance_packet: (a) => (isObj(a.payment) ? null : { code: "MISSING_ARGUMENT", detail: "payment is required and must be an object" }),
  coreguard_verify_stellar_settlement_evidence: (a) => (isObj(a.evidence) && isObj(a.expected) ? null : { code: "MISSING_ARGUMENT", detail: "evidence and expected are required objects" }),
  coreguard_verify_evm_settlement_evidence: (a) => (isObj(a.evidence) && isObj(a.expected) ? null : { code: "MISSING_ARGUMENT", detail: "evidence and expected are required objects" }),
  coreguard_verify_coredao_settlement_evidence: (a) => (isObj(a.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_verify_pi_payment_evidence: (a) => (isObj(a.evidence) && isObj(a.expected) ? null : { code: "MISSING_ARGUMENT", detail: "evidence and expected are required objects" }),
  coreguard_assess_bridge_risk: (a) => (isObj(a.route) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "route, policy, nowSeconds required" }),
  coreguard_assess_defi_position_risk: (a) => (isObj(a.position) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "position, policy, nowSeconds required" }),
  coreguard_verify_web3_signature_evidence: (a) => (isObj(a.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "evidence is required and must be an object" }),
  coreguard_verify_stablecoin_reserve_evidence: (a) => (isObj(a.evidence) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "evidence, policy, nowSeconds required" }),
  coreguard_create_robot_mission_receipt: (a) => (isObj(a.mission) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "mission, policy, nowSeconds required" }),
  coreguard_verify_robot_mission_evidence: (a) => (isObj(a.receipt) && isObj(a.evidence) ? null : { code: "MISSING_ARGUMENT", detail: "receipt and evidence are required objects" }),
  coreguard_assess_machine_sla: (a) => (Array.isArray(a.events) ? null : { code: "MISSING_ARGUMENT", detail: "events is required and must be an array" }),
  coreguard_assess_loan_application: (a) => (isObj(a.application) && isObj(a.policy) ? null : { code: "MISSING_ARGUMENT", detail: "application and policy are required objects" }),
  coreguard_verify_collateral_packet: (a) => (isObj(a.collateral) && isObj(a.policy) && typeof a.nowSeconds === "string" ? null : { code: "MISSING_ARGUMENT", detail: "collateral, policy, nowSeconds required" }),
  coreguard_assess_credit_line_utilization: (a) => (isObj(a.line) ? null : { code: "MISSING_ARGUMENT", detail: "line is required and must be an object" }),
  coreguard_verify_escrow_milestone: (a) => (isObj(a.escrow) && isObj(a.milestone) ? null : { code: "MISSING_ARGUMENT", detail: "escrow and milestone are required objects" }),
  coreguard_create_incident_war_room: (a) => (isObj(a.incident) ? null : { code: "MISSING_ARGUMENT", detail: "incident is required and must be an object" }),
});
