"""Tests fuer die Pruefung vor dem Push, siehe werkzeuge/plausibel.py."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import plausibel  # noqa: E402

HEUTE = "2026-09-25"


def liste(anzahl, stand=HEUTE, **extra):
    spieler = [{"rang": i + 1, "name": f"s{i}", "stand": stand, **extra} for i in range(anzahl)]
    return {"stand": stand, "spieler": spieler}


class TestPlausibel(unittest.TestCase):
    def test_volle_liste_von_heute_geht_durch(self):
        self.assertEqual(plausibel.pruefen(liste(100), HEUTE), [])

    def test_alter_stand_wird_abgelehnt(self):
        self.assertTrue(plausibel.pruefen(liste(100, stand="2026-09-24"), HEUTE))

    def test_zu_wenige_spieler_werden_abgelehnt(self):
        # Eine verfehlte Seite: 80 statt 100.
        self.assertTrue(plausibel.pruefen(liste(80), HEUTE))

    def test_grenze_liegt_bei_neunzig(self):
        self.assertEqual(plausibel.pruefen(liste(90), HEUTE), [])
        self.assertTrue(plausibel.pruefen(liste(89), HEUTE))

    def test_doppelte_raenge_werden_abgelehnt(self):
        daten = liste(100)
        daten["spieler"][1]["rang"] = 1
        self.assertTrue(plausibel.pruefen(daten, HEUTE))

    def test_discordfeld_wird_abgelehnt(self):
        self.assertTrue(plausibel.pruefen(liste(100, discord="x"), HEUTE))


if __name__ == "__main__":
    unittest.main()
