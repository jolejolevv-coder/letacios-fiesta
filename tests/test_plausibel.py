"""Tests fuer die Pruefung vor dem Push, siehe werkzeuge/plausibel.py."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import plausibel  # noqa: E402

HEUTE = "2026-09-25"


def liste(anzahl, stand=HEUTE, **extra):
    spieler = [{"rang": i + 1, "name": f"spieler{i}", "stand": stand, **extra} for i in range(anzahl)]
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

    def test_verdeckte_namen_werden_abgelehnt(self):
        # Die UPDATE NOTICE vom 23.10.2026 lag ueber den ersten acht Zeilen jeder Seite.
        daten = liste(100)
        for e, name in zip(daten["spieler"], ["| pstisx", "| pert", "| 7", "- | pgedfab",
                                              "| j°", "_| pase", "| }ya"]):
            e["name"] = name
        gruende = plausibel.pruefen(daten, HEUTE)
        self.assertEqual(len(gruende), 1)
        self.assertIn("7 Namen", gruende[0])

    def test_grenze_liegt_bei_sechs_verdaechtigen(self):
        daten = liste(100)
        for e in daten["spieler"][:plausibel.MAX_VERDAECHTIG]:
            e["name"] = "| x"
        self.assertEqual(plausibel.pruefen(daten, HEUTE), [])
        daten["spieler"][plausibel.MAX_VERDAECHTIG]["name"] = "| x"
        self.assertTrue(plausibel.pruefen(daten, HEUTE))

    def test_echte_namen_sind_nicht_verdaechtig(self):
        for name in ["UPS Employee", "jiji#6654", "-Pablo-", "madoka_hk", "kuge sv", "cal206"]:
            self.assertFalse(plausibel.verdaechtig(name), name)

    def test_bruchstuecke_und_kurze_namen_sind_verdaechtig(self):
        for name in ["| pstisx", "| j°", "Maki!367", "KF", "", None]:
            self.assertTrue(plausibel.verdaechtig(name), name)


if __name__ == "__main__":
    unittest.main()
