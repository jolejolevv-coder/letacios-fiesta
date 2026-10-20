"""Tests fuer das Zusammenfuehren der Kartenwerte, siehe aktualisieren.py (Format 2)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import aktualisieren as A  # noqa: E402


def teil(keep_first, wins):
    return {"number_of_matches": 1, "cards_presence": [{
        "leader": "1xOP17-039",
        "subject_mulligan": ["OP17-054"],
        **{f: [0] for f in A.HAND_FELDER},
        "subject_keep_first": [keep_first],
        "subject": ["2xOP17-041"], "subject_matches": [4], "subject_wins": [wins]}]}


class Karten(unittest.TestCase):
    def test_zwei_teile_werden_addiert(self):
        roh = A.zusammenfuehren([teil(3, 1), teil(2, 2)])
        k = roh["karten"]["1xOP17-039"]
        self.assertEqual(k["hand"]["OP17-054"][0], 5)
        self.assertEqual(k["kopien"]["2xOP17-041"], [8, 3])

    def test_eingedampft_mit_format(self):
        roh = A.zusammenfuehren([teil(3, 1)])
        roh["decks"] = {"1xOP17-039": {}}
        roh["praesenz"] = {"1xOP17-039": {"gegner": {"1xOP13-004": {"m": 1, "w": 1, "fw": 1, "fl": 0, "sw": 0, "sl": 0}}}}
        s = A.eindampfen(roh)
        self.assertEqual(s["format"], A.FORMAT)
        self.assertEqual(s["leader"][0]["kopien"], {"2xOP17-041": [4, 1]})


class Tagesdateien(unittest.TestCase):
    def test_ohne_kopien_und_ohne_nullzeilen(self):
        roh = A.zusammenfuehren([teil(0, 1)])
        roh["decks"] = {"1xOP17-039": {}}
        roh["praesenz"] = {"1xOP17-039": {"gegner": {"1xOP13-004": {"m": 1, "w": 1, "fw": 1, "fl": 0, "sw": 0, "sl": 0}}}}
        s = A.eindampfen(roh, mit_kopien=False)
        self.assertEqual(s["leader"][0]["kopien"], {})
        self.assertEqual(s["leader"][0]["hand"], {})     # alle acht Zaehler null


if __name__ == "__main__":
    unittest.main()
