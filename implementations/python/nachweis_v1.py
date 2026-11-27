"""nachweis/v1 profile resolver — Python port of packages/agent-commerce/profiles/nachweis-v1.mjs.

A receipt pointer carries {receipt_id, profile}. For profile "nachweis/v1" the
id names the execution record, `refId` leads to the decision it follows, and the
id is recomputable from the record. This module locates, recomputes, links, and
names drift. It does not verify signatures, the mandate credential, revocation
or any server key, and it contacts nothing. VERIFIED != SAFE.

Canonical encoding matches @coreguard/canonical (not full RFC 8785): keys sort
by UTF-16 code units, integers only, strings starting with "0x" are lowercased,
other strings use JSON escaping with non-ASCII kept as-is.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

PROFILE = "nachweis/v1"
SPEC = "CG-PROFILE-NACHWEIS/1"
BOUNDARY = (
    "locates and recomputes nachweis/v1 records supplied by the holder; "
    "no signature, credential, revocation or lookup verification; VERIFIED != SAFE"
)

RECORD_FIELDS = (
    "id", "kind", "refId", "mandateId", "agentId", "principalId", "intentHash",
    "stepUp", "gateState", "rail", "railStatus", "amount", "currency", "payee",
)
DRIFT_FIELDS = ("amount", "currency", "rail")
RECEIPT_ID = re.compile(r"^[0-9a-f]{64}$")

_MISSING = object()


def _utf16_key(key):
    return key.encode("utf-16-be")


def _quote(text):
    return json.dumps(text, ensure_ascii=False)


def canonicalize(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        if not -(2**53 - 1) <= value <= 2**53 - 1:
            raise ValueError("unsafe integer: pass large values as strings")
        return str(value)
    if isinstance(value, float):
        raise TypeError("non-integer numbers are not supported")
    if isinstance(value, str):
        text = value.lower() if value.startswith("0x") else value
        return _quote(text)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        for key in value:
            if not isinstance(key, str):
                raise TypeError("object keys must be strings")
        keys = sorted(value, key=_utf16_key)
        return "{" + ",".join(_quote(k) + ":" + canonicalize(value[k]) for k in keys) + "}"
    raise TypeError(f"unsupported type: {type(value).__name__}")


def sha256_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def record_fields(record):
    rest = {key: record[key] for key in RECORD_FIELDS if key in record}
    if record.get("v") == 2 and not isinstance(record.get("v"), bool):
        rest["v"] = 2
        rest["mandateSeq"] = record.get("mandateSeq")
        rest["mandatePrevHash"] = record.get("mandatePrevHash")
        rest["agentName"] = record.get("agentName")
    return rest


def record_hash(record):
    if not isinstance(record, dict):
        raise TypeError("record must be an object")
    array = [
        record.get("prevHash"),
        record.get("intent"),
        record.get("decision"),
        record.get("reasons"),
        record.get("railRef"),
        record.get("createdAt"),
        record_fields(record),
    ]
    return sha256_hex(canonicalize(array))


def intent_hash(intent):
    if not isinstance(intent, dict):
        raise TypeError("intent must be an object")
    return "sha256:" + sha256_hex(canonicalize(intent))


def _refusal(receipt_id, code, detail):
    return {
        "ok": False,
        "spec": SPEC,
        "profile": PROFILE,
        "receiptId": receipt_id,
        "codes": [code],
        "detail": detail,
        "boundary": BOUNDARY,
    }


def resolve_nachweis_export(export_doc, receipt_id):
    records = export_doc if isinstance(export_doc, list) else (
        export_doc.get("records") if isinstance(export_doc, dict) else None
    )
    if not isinstance(records, list) or not records:
        return _refusal(receipt_id, "NO_RECORDS", "export carries no records")
    if not isinstance(receipt_id, str) or not RECEIPT_ID.match(receipt_id):
        return _refusal(receipt_id, "INVALID_RECEIPT_ID", "receipt_id must be 64 lowercase hex characters")

    record = next((r for r in records if isinstance(r, dict) and r.get("hash") == receipt_id), None)
    if record is None:
        return _refusal(receipt_id, "RECORD_NOT_FOUND", "no record in this export has that hash")

    codes = []
    checks = {"receiptId": "MATCH", "kind": record.get("kind"), "intent": "NOT_CHECKED", "drift": []}

    if record_hash(record) != record.get("hash"):
        codes.append("HASH_MISMATCH")
        checks["receiptId"] = "MISMATCH"
    if record.get("kind") != "execution":
        codes.append("UNEXPECTED_KIND")

    decision = next((r for r in records if isinstance(r, dict) and r.get("id") == record.get("refId")), None)
    if decision is None:
        codes.append("REF_MISSING")
        return {
            "ok": False,
            "spec": SPEC,
            "profile": PROFILE,
            "receiptId": receipt_id,
            "record": record,
            "checks": checks,
            "codes": codes,
            "detail": "refId does not resolve inside this export",
            "boundary": BOUNDARY,
        }

    if record.get("intentHash") != decision.get("intentHash"):
        codes.append("INTENT_HASH_MISMATCH")
        checks["intent"] = "MISMATCH"
    else:
        checks["intent"] = "MATCH"

    approved = decision.get("intent") if isinstance(decision.get("intent"), dict) else {}
    if checks["intent"] == "MATCH":
        for field in DRIFT_FIELDS:
            if record.get(field, _MISSING) != approved.get(field, _MISSING):
                codes.append(f"{field.upper()}_DRIFT")
                checks["drift"].append(field)
        approved_payee = approved["payee"].get("value", _MISSING) if isinstance(approved.get("payee"), dict) else _MISSING
        executed_payee = record["payee"].get("value", _MISSING) if isinstance(record.get("payee"), dict) else _MISSING
        if executed_payee != approved_payee:
            codes.append("PAYEE_DRIFT")
            checks["drift"].append("payee")

    return {
        "ok": not codes,
        "spec": SPEC,
        "profile": PROFILE,
        "receiptId": receipt_id,
        "record": record,
        "decision": {
            "id": decision.get("id"),
            "decision": decision.get("decision"),
            "reasons": decision.get("reasons") if isinstance(decision.get("reasons"), list) else [],
        },
        "checks": checks,
        "codes": codes,
        "boundary": BOUNDARY,
    }


def _fixture_path():
    return Path(__file__).resolve().parents[2] / "test" / "fixtures" / "nachweis" / "demo-allow-reduced.json"


def main(argv):
    import argparse

    parser = argparse.ArgumentParser(description="nachweis/v1 fixture check and resolver")
    parser.add_argument("--json", action="store_true", help="print ids and one resolution as JSON")
    parser.add_argument("--receipt", default=None, help="receipt_id to resolve")
    parser.add_argument("--set", dest="set_field", default=None, metavar="FIELD=VALUE",
                        help="edit that field on the execution record before resolving")
    parser.add_argument("--fixture", default=str(_fixture_path()))
    args = parser.parse_args(argv[1:])

    doc = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    ids = [record_hash(r) for r in doc["records"]]
    receipt = args.receipt or next(r["hash"] for r in doc["records"] if r["kind"] == "execution")
    if args.set_field:
        field, _, value = args.set_field.partition("=")
        execution = next(r for r in doc["records"] if r["kind"] == "execution")
        execution[field] = value
    resolved = resolve_nachweis_export(doc, receipt)

    if args.json:
        print(json.dumps({"ids": ids, "resolve": resolved}, ensure_ascii=False))
        return 0

    for expected, actual in zip(ids, [r["hash"] for r in doc["records"]]):
        print(("MATCH " if expected == actual else "DIFFER ") + expected)
    print(f"{sum(1 for r in doc['records'] if record_hash(r) == r.get('hash'))}/{len(doc['records'])} ids reproduce")
    print(f"resolve {receipt[:12]}: ok={resolved['ok']} codes={resolved['codes']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
