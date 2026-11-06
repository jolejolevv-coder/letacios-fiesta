"""Tests fuer Bountyverlauf und gewertete Partien, siehe specs/features/spielerseite-verlauf.md."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import spieler_daten as S  # noqa: E402

ICH, ER = 17751, 7674


def zeile(status1, status2, dauer, id1=ICH, id2=ER):
    """Eine Zeile aus Public_matches mit den Feldern, die die Regel liest."""
    z = [None] * 26
    z[S.P_STATUS1], z[S.P_STATUS2] = status1, status2
    z[S.P_DAUER] = dauer
    z[S.P_ID1], z[S.P_ID2] = id1, id2
    return z


class Gewertet(unittest.TestCase):
    def test_normaler_sieg(self):
        self.assertTrue(S.gewertet(zeile("win", "loss", 465.9), ICH))

    def test_sieg_unter_60_s_zaehlt_nicht(self):
        self.assertFalse(S.gewertet(zeile("win", "loss", 59.9), ICH))

    def test_sieg_genau_60_s_zaehlt(self):
        self.assertTrue(S.gewertet(zeile("win", "loss", 60), ICH))

    def test_niederlage_unter_60_s_zaehlt(self):
        self.assertTrue(S.gewertet(zeile("win", "loss", 12), ER))

    def test_eigene_seite_ueber_die_id(self):
        # Der Profilinhaber steht als zweite Seite und hat kurz gewonnen.
        self.assertFalse(S.gewertet(zeile("loss", "win", 20, id1=ER, id2=ICH), ICH))

    def test_ohne_sieger_nie(self):
        for a, b in (("selfdc", "selfdc"), ("unresolved", "unresolved"),
                     ("started", "started"), ("cancelled", "cancelled")):
            self.assertFalse(S.gewertet(zeile(a, b, 900), ICH), (a, b))

    def test_trennung_des_gegners_ist_sieg(self):
        self.assertTrue(S.gewertet(zeile("win", "dc", 300), ICH))

    def test_kaputte_zeile(self):
        self.assertFalse(S.gewertet([], ICH))
        self.assertFalse(S.gewertet(zeile("win", "loss", "x"), ICH))


class Verlauf(unittest.TestCase):
    def test_werte_gerundet(self):
        west = {"Graph": {"x": ["1", "2"], "y": [1424.649, 1495.35]}}
        self.assertEqual(S.verlauf_aus(west), [1424.6, 1495.3])

    def test_nur_zahlen(self):
        west = {"Graph": {"y": [1, "2", None, True, 3.0]}}
        self.assertEqual(S.verlauf_aus(west), [1, 3.0])

    def test_fehlt(self):
        self.assertIsNone(S.verlauf_aus({}))
        self.assertIsNone(S.verlauf_aus({"Graph": {"y": []}}))
        self.assertIsNone(S.verlauf_aus(None))


if __name__ == "__main__":
    unittest.main()
