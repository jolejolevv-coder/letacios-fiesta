import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import kaizoku_wochen as w  # noqa: E402
from bestenliste_api import ApiFehler  # noqa: E402


def cs(lid):
    return {"leaderKey": lid, "cards": [
        {"card": "A", "usage_rate": 0.5, "win_rate": 0.55, "avg_copies_when_included": 3.5},
        {"card": "B", "usage_rate": 0.9, "win_rate": 0.5, "avg_copies_when_included": 4},
        {"win_rate": 1}]}


class WochenTests(unittest.TestCase):
    def test_karten_nach_nutzung_und_kaputte_zeile_faellt_weg(self):
        z = w.karten_bauen(cs("L"))
        self.assertEqual([k[0] for k in z], ["B", "A"])

    def test_hand(self):
        z = w.hand_bauen({"common_cards": [{"card": "A", "appearance_rate": 0.2},
                                           {"card": "B", "appearance_rate": 0.5}, {}]})
        self.assertEqual(z, [["B", 0.5], ["A", 0.2]])

    def test_tech_nur_mit_starker_evidenz_und_nach_aufschlag(self):
        e = [{"winnerLeaderKey": "X", "loserLeaderKey": "Y", "tech_cards": [
            {"card": "A", "has_strong_evidence": False, "conservative_lift": 0.9},
            {"card": "B", "has_strong_evidence": True, "conservative_lift": 0.1},
            {"card": "C", "has_strong_evidence": True, "conservative_lift": 0.3}]},
            {"winnerLeaderKey": "X", "loserLeaderKey": "Z", "tech_cards": []}]
        self.assertEqual(w.tech_bauen(e), {"X": {"Y": [["C", 0.3], ["B", 0.1]]}})

    def test_kurve(self):
        e = {"first": [{"turn": 2, "overall_top3": [{"combo": "A+B", "rate_all": 0.4567}]},
                       {"turn": 1, "overall_top3": [{"combo": "NO_PLAY", "rate_all": 0.3}]}],
             "second": []}
        k = w.kurve_bauen(e)
        self.assertEqual(k["first"], [[1, [["NO_PLAY", 0.3]]], [2, [["A+B", 0.457]]]])
        self.assertEqual(k["second"], [])

    def test_paket(self):
        karten = [cs(f"L{i}") for i in range(40)]
        hands = [{"leaderKey": "L1", "common_cards": [{"card": "A", "appearance_rate": 0.2}]}]
        kurve = [{"leader": "L1", "gameMode": 0, "first": [{"turn": 1, "overall_top3": [
            {"combo": "X", "rate_all": 0.5}]}]}, {"leader": "L2", "gameMode": 3, "first": []}]
        p = w.paket_bauen(karten, hands, [], kurve, "20261102")
        self.assertEqual(len(p["leader"]), 40)
        self.assertEqual(p["leader"]["L1"]["hand"], [["A", 0.2]])
        self.assertEqual(p["leader"]["L1"]["kurve"]["first"][0][0], 1)
        self.assertEqual(p["leader"]["L2"]["kurve"], {})       # Modus 3 zählt nicht

    def test_zu_wenige_leader(self):
        with self.assertRaises(ApiFehler):
            w.paket_bauen([cs("A")], [], [], [], "x")

    def test_pfad_fehlt(self):
        with self.assertRaises(ApiFehler):
            w.pfad_holen({}, "hands", "op17_lw_p")


if __name__ == "__main__":
    unittest.main()
