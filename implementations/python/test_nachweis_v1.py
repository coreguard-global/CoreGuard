"""Tests for the nachweis/v1 Python port against the committed demo fixture.

    python3 -m unittest discover -s implementations/python -p "test_*.py"
"""

import json
import unittest
from pathlib import Path

import nachweis_v1

FIXTURE = Path(__file__).resolve().parents[2] / "test" / "fixtures" / "nachweis" / "demo-allow-reduced.json"

PINNED_IDS = [
    "d7aa1c8e3720bae0071e505da1bdfa31e0a6582035775b96d27e2fa8d9785824",
    "5ae6174ee39ae4724a54554d8986bd4de88ccb32a1c637441ce539be9d0769b6",
    "3cbb6b2c1031230eb49f3f7169812d2cc9ffd9123ec140287739334bb4136e6b",
    "d87faf507d9b4ad80c4631b060239edd1fb3420e44fb9dcd6724b079627a1be8",
    "d57c5f03fdc4f23776b20103ea3bf6e08d3c559283ecc745a5aa20c9f002af32",
    "84fb5a48e1716316ffdfb771e696cd45279afa5e68a0dad0c619965031ca921f",
    "1898f13c068b66ed5111da30f5913f14cea37e85e5955adfbc00f293d9f23d90",
]


class NachweisFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_all_seven_ids_reproduce(self):
        self.assertEqual(self.doc["license"], "Apache-2.0")
        self.assertEqual([nachweis_v1.record_hash(r) for r in self.doc["records"]], PINNED_IDS)
        self.assertEqual([r["hash"] for r in self.doc["records"]], PINNED_IDS)

    def test_clean_receipt_resolves_to_allow(self):
        res = nachweis_v1.resolve_nachweis_export(self.doc, PINNED_IDS[2])
        self.assertTrue(res["ok"], res["codes"])
        self.assertEqual(res["codes"], [])
        self.assertEqual(res["checks"], {"receiptId": "MATCH", "kind": "execution", "intent": "MATCH", "drift": []})
        self.assertEqual(res["decision"]["decision"], "allow")
        self.assertEqual(res["decision"]["reasons"], ["OK"])

    def test_edited_amount_is_named(self):
        edited = json.loads(json.dumps(self.doc))
        execution = next(r for r in edited["records"] if r["kind"] == "execution")
        execution["amount"] = "12.01"
        res = nachweis_v1.resolve_nachweis_export(edited, PINNED_IDS[2])
        self.assertFalse(res["ok"])
        self.assertEqual(res["codes"], ["HASH_MISMATCH", "AMOUNT_DRIFT"])
        self.assertEqual(res["checks"]["drift"], ["amount"])

    def test_unknown_and_malformed_ids_never_pass(self):
        self.assertEqual(
            nachweis_v1.resolve_nachweis_export(self.doc, "0" * 64)["codes"], ["RECORD_NOT_FOUND"]
        )
        self.assertEqual(
            nachweis_v1.resolve_nachweis_export(self.doc, "3CBB")["codes"], ["INVALID_RECEIPT_ID"]
        )
        self.assertEqual(nachweis_v1.resolve_nachweis_export({"records": []}, PINNED_IDS[2])["codes"], ["NO_RECORDS"])


if __name__ == "__main__":
    unittest.main()
