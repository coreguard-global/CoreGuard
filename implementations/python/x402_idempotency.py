"""Python harness for CG-X402-IDEM/1 (second-language harness, not a new tool).

This is a faithful port of packages/x402/idempotency.mjs. It exists to run the
same scenario matrix as the Node module so that a semantic drift in either
implementation becomes a visible byte difference. It is stdlib-only.

Boundary (unchanged): VERIFIED ≠ SAFE — no network, no signing, no settlement;
caller-supplied evidence only. The store and the clock are injected. The
reference store is in-process only; a cross-process deployment must inject an
atomic insert-if-absent store. No compatibility, finality, partnership or
endorsement claim is made here.
"""

import argparse
import hashlib
import json
import re
import sys

SPEC = "CG-X402-IDEM/1"
BOUNDARY = (
    "VERIFIED ≠ SAFE — no network, no signing, no settlement; "
    "caller-supplied evidence only"
)
INTENT_DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


def canonicalize(value):
    """CGEP/1-compatible canonical form used by packages/canonical/index.js."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        return json.dumps(value.lower() if value.startswith("0x") else value,
                          ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=lambda k: k.encode("utf-16-be"))
        return "{" + ",".join(
            json.dumps(k, ensure_ascii=False, separators=(",", ":")) + ":" + canonicalize(value[k])
            for k in keys
        ) + "}"
    raise TypeError("canonicalize: unsupported type " + type(value).__name__)


def intent_digest_of(intent):
    if not isinstance(intent, dict):
        raise TypeError("intentDigestOf: intent must be an object of caller-supplied terms")
    return "sha256:" + hashlib.sha256(canonicalize(intent).encode("utf-8")).hexdigest()


def _is_positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _key_for(owner, purchase_id):
    return owner + "\u0000" + purchase_id


def create_memory_store():
    rows = {}

    def insert_if_absent(key, make_row):
        if key in rows:
            return {"inserted": False, "row": rows[key]}
        row = make_row()
        rows[key] = row
        return {"inserted": True, "row": row}

    def get(key):
        return rows.get(key)

    def size():
        return len(rows)

    return {
        "insertIfAbsent": insert_if_absent,
        "get": get,
        "size": size,
        "_rows": rows,
    }


def create_purchase_gate(store=None, authenticate=None, clock=None,
                         max_timeout_seconds=None, reservation_ttl_seconds=None,
                         artifact_retention_seconds=None):
    if not callable(authenticate):
        raise TypeError("createPurchaseGate: authenticate(ctx) is required")
    if store is None:
        store = create_memory_store()
    if "insertIfAbsent" not in store or "get" not in store:
        raise TypeError("createPurchaseGate: injected store is required")
    if not _is_positive_int(max_timeout_seconds) or not _is_positive_int(reservation_ttl_seconds):
        raise TypeError("createPurchaseGate: timeouts must be positive integers")
    if reservation_ttl_seconds < max_timeout_seconds:
        raise ValueError("createPurchaseGate: reservationTtlSeconds must be >= maxTimeoutSeconds")
    retain_for = (reservation_ttl_seconds + max_timeout_seconds
                  if artifact_retention_seconds is None else artifact_retention_seconds)
    if not _is_positive_int(retain_for) or retain_for < reservation_ttl_seconds:
        raise ValueError("createPurchaseGate: artifactRetentionSeconds must be >= reservationTtlSeconds")
    if clock is None:
        clock = lambda: 0

    def owner_from(ctx):
        auth = authenticate(ctx)
        if not auth or not isinstance(auth.get("owner"), str) or not auth["owner"]:
            return None
        return auth["owner"]

    def view(row, code, extra=None):
        base = {
            "code": code,
            "state": row["state"] if row else None,
            "purchaseId": row["purchaseId"] if row else None,
            "expiresAt": row["expiresAt"] if row else None,
            "retainedUntil": row["retainedUntil"] if row else None,
            "replay": code in ("PENDING", "REPLAY", "RECEIPT_REPLAY"),
            "artifact": None,
            "receipt": None,
        }
        if extra:
            base.update(extra)
        return dict(base)

    def reserve(ctx=None, purchase_id=None, intent_digest=None):
        owner = owner_from(ctx)
        if owner is None:
            return {"code": "UNAUTHENTICATED", "state": None, "artifact": None}
        if not isinstance(purchase_id, str) or not 8 <= len(purchase_id) <= 256:
            return {"code": "INVALID_PURCHASE_ID", "state": None, "artifact": None}
        if not isinstance(intent_digest, str) or not INTENT_DIGEST_RE.fullmatch(intent_digest):
            return {"code": "INVALID_INTENT_DIGEST", "state": None, "artifact": None}
        now = clock()
        if not isinstance(now, int):
            return {"code": "INVALID_CLOCK", "state": None, "artifact": None}
        claim = store["insertIfAbsent"](_key_for(owner, purchase_id), lambda: {
            "owner": owner,
            "purchaseId": purchase_id,
            "intentDigest": intent_digest,
            "state": "RESERVED",
            "artifact": None,
            "receipt": None,
            "reservedAt": now,
            "expiresAt": now + reservation_ttl_seconds,
            "retainedUntil": now + retain_for,
        })
        if claim["inserted"]:
            row = claim["row"]
            return view(row, "RESERVED", {"expiresAt": row["expiresAt"]})
        row = claim["row"]
        if row["owner"] != owner:
            return {"code": "OWNER_CONFLICT", "state": None, "purchaseId": None,
                    "expiresAt": None, "retainedUntil": None, "replay": False,
                    "artifact": None, "receipt": None}
        if row["intentDigest"] != intent_digest:
            return view(row, "INTENT_MISMATCH", {
                "storedIntentDigest": row["intentDigest"],
                "incomingIntentDigest": intent_digest,
            })
        if now >= row["retainedUntil"]:
            return view(row, "EXPIRED", {"detail": "artifact retention ended; choose a new purchase id"})
        if row["state"] == "RESERVED" and now >= row["expiresAt"]:
            return view(row, "RESERVATION_LAPSED", {
                "detail": "winner's signing window closed without an artifact; choose a new purchase id",
            })
        if row["state"] == "RESERVED":
            return view(row, "PENDING", {"detail": "winner has not produced the artifact yet"})
        if row["state"] == "SETTLED":
            return view(row, "RECEIPT_REPLAY", {"artifact": row["artifact"], "receipt": row["receipt"]})
        return view(row, "REPLAY", {"artifact": row["artifact"]})

    def attach_artifact(ctx=None, purchase_id=None, intent_digest=None, artifact=None):
        owner = owner_from(ctx)
        if owner is None:
            return {"code": "UNAUTHENTICATED"}
        row = store["get"](_key_for(owner, purchase_id))
        if not row or row["owner"] != owner:
            return {"code": "NOT_RESERVED"}
        if row["intentDigest"] != intent_digest:
            return {"code": "INTENT_MISMATCH"}
        attached_at = clock()
        if not isinstance(attached_at, int) or attached_at >= row["expiresAt"]:
            return {"code": "RESERVATION_EXPIRED"}
        if row["state"] != "RESERVED":
            return {"code": "ARTIFACT_ALREADY_ATTACHED"}
        if not isinstance(artifact, dict):
            return {"code": "NO_ARTIFACT"}
        row["artifact"] = dict(artifact)
        row["state"] = "SIGNED"
        return {"code": "SIGNED", "artifact": row["artifact"]}

    def mark_settled(ctx=None, purchase_id=None, intent_digest=None, receipt=None):
        owner = owner_from(ctx)
        if owner is None:
            return {"code": "UNAUTHENTICATED"}
        row = store["get"](_key_for(owner, purchase_id))
        if not row or row["owner"] != owner:
            return {"code": "NOT_RESERVED"}
        if row["intentDigest"] != intent_digest:
            return {"code": "INTENT_MISMATCH"}
        if row["state"] != "SIGNED":
            return {"code": "NOT_SIGNED"}
        if not isinstance(receipt, dict):
            return {"code": "NO_RECEIPT"}
        row["receipt"] = dict(receipt)
        row["state"] = "SETTLED"
        return {"code": "SETTLED", "receipt": row["receipt"]}

    return {
        "version": SPEC,
        "boundary": BOUNDARY,
        "reserve": reserve,
        "attachArtifact": attach_artifact,
        "markSettled": mark_settled,
        "store": store,
    }


def create_facilitator_dedup(store=None, clock=None, ttl_seconds=300):
    if store is None:
        store = create_memory_store()
    if clock is None:
        clock = lambda: 0
    if not _is_positive_int(ttl_seconds):
        raise TypeError("createFacilitatorDedup: ttlSeconds must be a positive integer")

    def claim(payload_digest=None, payer_verified=None, result=None):
        if not isinstance(payload_digest, str) or not INTENT_DIGEST_RE.fullmatch(payload_digest):
            return {"code": "INVALID_PAYLOAD_DIGEST"}
        if not isinstance(payer_verified, str) or not payer_verified:
            return {"code": "PAYER_NOT_VERIFIED"}
        now = clock()
        hit = store["insertIfAbsent"](payload_digest, lambda: {
            "payerVerified": payer_verified,
            "result": result,
            "expiresAt": now + ttl_seconds,
        })
        if hit["inserted"]:
            return {"code": "ACCEPTED", "replay": False, "result": result}
        if hit["row"]["payerVerified"] != payer_verified:
            return {"code": "PAYER_CONFLICT", "replay": False, "result": None}
        if now >= hit["row"]["expiresAt"]:
            return {"code": "EXPIRED", "replay": False, "result": None}
        return {"code": "REPLAY", "replay": True, "result": hit["row"]["result"]}

    return {"version": SPEC, "claim": claim, "store": store}


NORMALIZE_KEYS = (
    "code", "state", "purchaseId", "expiresAt", "retainedUntil", "replay",
    "artifact", "receipt", "storedIntentDigest", "incomingIntentDigest",
    "detail", "result",
)


def normalize(result):
    """One comparable shape for both harnesses; only ids, never payloads."""
    out = {}
    for key in NORMALIZE_KEYS:
        value = result.get(key)
        if key in ("artifact", "receipt") and isinstance(value, dict):
            value = value.get("id")
        elif key == "result" and isinstance(value, dict):
            value = value.get("settlement")
        out[key] = value
    return out


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _authenticator(cfg):
    mode = cfg.get("authMode", "token")
    owner = cfg.get("owner", "buyer-A")
    if mode == "ctx-owner":
        return lambda ctx: {"owner": ctx.get("owner")} if ctx and ctx.get("owner") else None
    return lambda ctx: {"owner": owner} if ctx and ctx.get("token") == "ok" else None


def _store(cfg):
    if cfg.get("storeMode") == "purchase-only":
        rows = {}

        def insert_if_absent(key, make_row):
            purchase_id = key.split("\u0000")[1]
            if purchase_id in rows:
                return {"inserted": False, "row": rows[purchase_id]}
            row = make_row()
            rows[purchase_id] = row
            return {"inserted": True, "row": row}

        def get(key):
            return rows.get(key.split("\u0000")[1])

        return {"insertIfAbsent": insert_if_absent, "get": get,
                "size": lambda: len(rows)}
    return create_memory_store()


def run_matrix(doc):
    if doc.get("spec") != SPEC:
        raise ValueError("matrix spec mismatch")
    if not doc.get("cases"):
        raise ValueError("matrix has no cases")
    output = []
    for case in doc["cases"]:
        cfg = case.get("gate") or {}
        now = cfg.get("clock", 1000)
        clock = lambda: now
        results = []
        gate = None
        dedup = None
        try:
            gate = create_purchase_gate(
                store=_store(cfg),
                authenticate=_authenticator(cfg),
                clock=clock,
                max_timeout_seconds=cfg.get("maxTimeoutSeconds", 60),
                reservation_ttl_seconds=cfg.get("reservationTtlSeconds", 90),
                artifact_retention_seconds=cfg.get("artifactRetentionSeconds"),
            )
            results.append({"code": "CONSTRUCTED"})
        except (TypeError, ValueError):
            results.append({"code": "THROW"})
        if case.get("expectThrow") and results[-1]["code"] != "THROW":
            results.append({"code": "MISSING_THROW"})
        for step in case.get("steps", []):
            if step.get("at") is not None:
                now = step["at"]
            op = step.get("op")
            if op == "reserve":
                results.append(normalize(gate["reserve"](ctx=step.get("ctx"),
                                                         purchase_id=step["purchaseId"],
                                                         intent_digest=step["intentDigest"])))
            elif op == "attach":
                results.append(normalize(gate["attachArtifact"](ctx=step.get("ctx"),
                                                                purchase_id=step["purchaseId"],
                                                                intent_digest=step["intentDigest"],
                                                                artifact=step.get("artifact"))))
            elif op == "settle":
                results.append(normalize(gate["markSettled"](ctx=step.get("ctx"),
                                                             purchase_id=step["purchaseId"],
                                                             intent_digest=step["intentDigest"],
                                                             receipt=step.get("receipt"))))
            elif op == "dedup":
                if dedup is None:
                    dedup = create_facilitator_dedup(clock=clock,
                                                     ttl_seconds=step.get("ttlSeconds", 300))
                results.append(normalize(dedup["claim"](
                    payload_digest=intent_digest_of(step["payload"]),
                    payer_verified=step["payerVerified"],
                    result=step.get("result"),
                )))
            else:
                raise ValueError("unknown op " + str(op))
        output.append({"name": case["name"], "results": results})
    return {"spec": SPEC, "boundary": BOUNDARY, "cases": output}


def self_check():
    doc = {
        "spec": SPEC,
        "cases": [
            {"name": "first reserve", "gate": {}, "steps": [
                {"op": "reserve", "purchaseId": "purchase-0001",
                 "intentDigest": intent_digest_of({"resource": "/v1/verify", "amount": 500}),
                 "ctx": {"token": "ok"}}]},
            {"name": "lapsed read agrees with closed write", "gate": {
                "maxTimeoutSeconds": 10, "reservationTtlSeconds": 10,
                "artifactRetentionSeconds": 30}, "steps": [
                {"op": "reserve", "at": 1000, "purchaseId": "purchase-lapse",
                 "intentDigest": intent_digest_of({"resource": "/v1/lapse", "amount": 1}),
                 "ctx": {"token": "ok"}},
                {"op": "reserve", "at": 1011, "purchaseId": "purchase-lapse",
                 "intentDigest": intent_digest_of({"resource": "/v1/lapse", "amount": 1}),
                 "ctx": {"token": "ok"}},
                {"op": "attach", "at": 1011, "purchaseId": "purchase-lapse",
                 "intentDigest": intent_digest_of({"resource": "/v1/lapse", "amount": 1}),
                 "artifact": {"id": "late"}, "ctx": {"token": "ok"}}]},
        ],
    }
    out = run_matrix(doc)
    cases = out["cases"]
    ok = (
        cases[0]["results"][1]["code"] == "RESERVED"
        and cases[1]["results"][2]["code"] == "RESERVATION_LAPSED"
        and cases[1]["results"][2]["replay"] is False
        and cases[1]["results"][3]["code"] == "RESERVATION_EXPIRED"
    )
    if not ok:
        print(SPEC + " PY SELF-CHECK FAIL", file=sys.stderr)
        return 1
    print(SPEC + " PY SELF-CHECK OK 3/3 — " + BOUNDARY)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--matrix", help="path to the shared scenario matrix JSON")
    parser.add_argument("--self-check", action="store_true")
    parser.add_argument("--check", action="store_true",
                        help="also verify the matrix's pinned expectations")
    args = parser.parse_args(argv)
    if args.self_check:
        return self_check()
    if not args.matrix:
        parser.error("--matrix or --self-check is required")
    with open(args.matrix, encoding="utf-8") as handle:
        doc = json.load(handle)
    out = run_matrix(doc)
    if args.check:
        pinned = {case["name"]: case.get("expect") for case in doc["cases"]}
        for case in out["cases"]:
            if pinned[case["name"]] is not None and case["results"] != pinned[case["name"]]:
                print(SPEC + " MATRIX DRIFT: " + case["name"], file=sys.stderr)
                return 1
    print(canonical_json(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
