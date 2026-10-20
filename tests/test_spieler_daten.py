"""Tests fuer das Nachtragen der user_id, siehe spieler_daten.py (ids_nachtragen).

Seit dem 20.10.2026 steht die user_id nicht mehr in der Bestenliste. Sie kommt ueber den
Fingerabdruck aus Leadern und Winrate oder ueber den Namen."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import spieler_daten as S  # noqa: E402


def zeile(name, *leader):
    return {"name": name, "leader": [{"leader": k, "winrate": w} for k, w in leader]}


class Fingerabdruck(unittest.TestCase):
    # Rang 1 am 20.10.2026: in der Liste "bblova", in seinen Partien noch "lolbriann".
    NAMEN = {"33748": {"name": "lolbriann",
                       "leader": {"OP17-039": 86.7, "ST30-001": 76.9, "OP05-098": 0.0}},
             "1": {"name": "jemand", "leader": {"OP17-039": 86.7, "OP14-020": 50.0}}}

    def test_umbenannter_spieler_ueber_leader_und_winrate(self):
        beste = [zeile("bblova", ("OP17-039", 86.7), ("ST30-001", 76.9), ("OP05-098", 0.0))]
        self.assertEqual(S.ids_nachtragen(beste, self.NAMEN), 1)
        self.assertEqual(beste[0]["user_id"], 33748)

    def test_ein_einziger_passender_leader_reicht_nicht_bei_zwei_gelesenen(self):
        # Beide Kandidaten haben Xebec mit 86.7; der zweite Leader passt zu keinem.
        beste = [zeile("neu", ("OP17-039", 86.7), ("OP09-062", 55.0))]
        S.ids_nachtragen(beste, self.NAMEN)
        self.assertNotIn("user_id", beste[0])

    def test_mehrdeutig_bleibt_leer(self):
        beste = [zeile("neu", ("OP17-039", 86.7))]     # passt auf beide Kandidaten
        S.ids_nachtragen(beste, self.NAMEN)
        self.assertNotIn("user_id", beste[0])

    def test_name_als_rueckfall(self):
        beste = [zeile("jemand")]
        S.ids_nachtragen(beste, self.NAMEN)
        self.assertEqual(beste[0]["user_id"], 1)

    def test_eine_id_wird_nur_einmal_vergeben(self):
        beste = [{"name": "jemand", "user_id": 1, "leader": []}, zeile("jemand")]
        S.ids_nachtragen(beste, self.NAMEN)
        self.assertNotIn("user_id", beste[1])


if __name__ == "__main__":
    unittest.main()
