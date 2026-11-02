"""Tests fuer den Probebetrieb der Web API, siehe werkzeuge/bestenliste_vergleich.py."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import bestenliste_vergleich as V  # noqa: E402


def api(rang, name, uid, bounty):
    return {"rang": rang, "name": name, "user_id": uid, "bounty": bounty}


class Vergleich(unittest.TestCase):
    def test_zaehlt_namen_raenge_und_ids(self):
        a = [api(1, "a1A1", 1, 3575.0), api(2, "Salva1", 2, 3000.0), api(3, "Neu", 3, 2900.0)]
        o = [api(1, "alAl", 1, 3570.0), api(3, "Salva1", 2, 3100.0), api(2, "x", None, 1.0)]
        o[2].pop("user_id")
        r = V.vergleichen(a, o)
        self.assertEqual(r["ueber_user_id_gefunden"], 2)
        self.assertEqual(r["name_gleich"], 1)
        self.assertEqual(r["name_aehnlich"], 1)
        self.assertEqual(r["name_anders"], 0)
        self.assertEqual(r["api_mit_user_id"], 3)
        self.assertEqual(r["ocr_mit_user_id"], 2)
        self.assertEqual(r["rangabstand_median"], 0.5)

    def test_ausreisser_beim_bounty(self):
        a = [api(1, "x", 1, 3000.0)]
        o = [api(1, "x", 1, 3000.0 - V.BOUNTY_TOLERANZ - 1)]
        self.assertEqual(V.vergleichen(a, o)["bounty_ausreisser"], 1)

    def test_enthaelt_keine_namen(self):
        r = V.vergleichen([api(1, "Geheim", 1, 1.0)], [api(1, "Geheim", 1, 1.0)])
        self.assertNotIn("Geheim", repr(r))

    def test_leere_listen(self):
        r = V.vergleichen([], [])
        self.assertIsNone(r["bountyabstand_median"])


if __name__ == "__main__":
    unittest.main()
