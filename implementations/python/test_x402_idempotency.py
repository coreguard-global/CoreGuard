"""Python-side unit tests for the CG-X402-IDEM/1 second harness.

Run: python3 -m unittest discover -s implementations/python -p "test_x402_idempotency.py"
"""

import json
import unittest
from pathlib import Path

import x402_idempotency as idem

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "test" / "fixtures" / "x402" / "idempotency-matrix.json"
D500 = "sha256:fc3551f51cd85b8cdf020d3195f9bd1d088464eb3610de70b3de6f4852306490"
DLAPSE = "sha256:d1d0a6a4a0d79272286f8224f9e0ca93bdc8d4932319904815c91409a53e35eb"


class X402IdempotencyPythonTest(unittest.TestCase):
    def test_intent_digest_matches_the_node_canonical_encoding(self):
        self.assertEqual(idem.intent_digest_of({"resource": "/v1/verify", "amountCents": 500}), D500)
        self.assertEqual(idem.intent_digest_of({"resource": "/v1/lapse", "amount": 1}), DLAPSE)

    def test_lapsed_reservation_read_agrees_with_the_closed_write_window(self):
        now = [1000]
        gate = idem.create_purchase_gate(
            authenticate=lambda ctx: {"owner": "buyer-L"},
            clock=lambda: now[0],
            max_timeout_seconds=10,
            reservation_ttl_seconds=10,
            artifact_retention_seconds=30,
        )
        ctx = {"token": "ok"}
        first = gate["reserve"](ctx=ctx, purchase_id="purchase-lapse", intent_digest=DLAPSE)
        self.assertEqual(first["code"], "RESERVED")
        now[0] = 1011
        duplicate = gate["reserve"](ctx=ctx, purchase_id="purchase-lapse", intent_digest=DLAPSE)
        self.assertEqual(duplicate["code"], "RESERVATION_LAPSED")
        self.assertFalse(duplicate["replay"])
        self.assertEqual(duplicate["expiresAt"], first["expiresAt"])
        attach = gate["attachArtifact"](ctx=ctx, purchase_id="purchase-lapse",
                                        intent_digest=DLAPSE, artifact={"id": "late"})
        self.assertEqual(attach["code"], "RESERVATION_EXPIRED")

    def test_construction_fails_closed_on_short_reservation(self):
        with self.assertRaises(ValueError):
            idem.create_purchase_gate(
                authenticate=lambda ctx: {"owner": "buyer-A"},
                max_timeout_seconds=120,
                reservation_ttl_seconds=60,
            )

    def test_facilitator_replay_is_gated_on_the_verified_payer(self):
        dedup = idem.create_facilitator_dedup(clock=lambda: 1000)
        payload = idem.intent_digest_of({"payload": "signed"})
        first = dedup["claim"](payload_digest=payload, payer_verified="payer-A",
                               result={"settlement": "r1"})
        replay = dedup["claim"](payload_digest=payload, payer_verified="payer-A")
        other = dedup["claim"](payload_digest=payload, payer_verified="payer-B")
        self.assertEqual(first["code"], "ACCEPTED")
        self.assertEqual(replay["code"], "REPLAY")
        self.assertEqual(replay["result"]["settlement"], "r1")
        self.assertEqual(other["code"], "PAYER_CONFLICT")
        self.assertIsNone(other["result"])

    def test_the_shared_matrix_pins_all_fourteen_cases_in_python(self):
        doc = json.loads(MATRIX.read_text(encoding="utf-8"))
        out = idem.run_matrix(doc)
        self.assertEqual(len(out["cases"]), 14)
        for case in out["cases"]:
            expected = next(c["expect"] for c in doc["cases"] if c["name"] == case["name"])
            self.assertEqual(case["results"], expected, case["name"])


if __name__ == "__main__":
    unittest.main()
