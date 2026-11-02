import datetime
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import kaizoku_spieler as s  # noqa: E402
from bestenliste_api import ApiFehler  # noqa: E402

SP = {"name": "Alpha", "login": "alpha", "user_id": 7,
      "leader": [{"leader": "OP17-039", "partien": 50}, {"leader": "OP17-058", "partien": 10}]}


def treffer(pid, name, leader, modus=0):
    return {"playerId": pid, "playerName": name, "playerLeader": leader, "gameMode": modus}


class SpielerTests(unittest.TestCase):
    def test_grundname(self):
        self.assertEqual(s.grundname("Alp​ha#1234"), "alpha")
        self.assertEqual(s.grundname(None), "")

    def test_zuordnen_genau_und_nach_leader(self):
        zeilen = [treffer("a", "Alpha#1", "OP17-039"), treffer("b", "Alpha#2", "OP01-001"),
                  treffer("c", "AlphaBeta#3", "OP17-039")]      # kein genauer Name
        self.assertEqual(s.zuordnen(SP, zeilen), "a")

    def test_zuordnen_mehrere_ohne_ueberschneidung(self):
        zeilen = [treffer("a", "Alpha#1", "OP01-001"), treffer("b", "Alpha#2", "OP02-001")]
        self.assertIsNone(s.zuordnen(SP, zeilen))

    def test_zuordnen_einer_ohne_ueberschneidung_reicht(self):
        self.assertEqual(s.zuordnen(SP, [treffer("a", "Alpha#1", "OP01-001")]), "a")

    def test_zuordnen_nichts(self):
        self.assertIsNone(s.zuordnen(SP, []))

    def test_eimer_bevorzugt_privat(self):
        e = [{"gameMode": 0, "isPrivate": False, "total_matches": 90},
             {"gameMode": 0, "isPrivate": True, "total_matches": 10},
             {"gameMode": 3, "isPrivate": True, "total_matches": 99}]
        self.assertEqual(s.eimer_waehlen(e)["total_matches"], 10)
        self.assertIsNone(s.eimer_waehlen([{"gameMode": 3}]))

    def test_form(self):
        eimer = {"total_matches": 20, "total_wins": 12,
                 "leader_stats": [{"playerLeader": "A", "games_played": 5, "wins": 3,
                                   "matchup_stats": [{"oppLeaderKey": "B", "games_played": 2, "wins": 1}]}],
                 "deck_stats": [{"playerLeader": "A", "decklist": "4xX\n3xY", "games_played": 5, "wins": 3,
                                 "matchup_stats": [{"oppLeader": "B", "games_played": 2, "wins": 1}]},
                                {"decklist": ""}]}
        f = s.form_bauen(eimer)
        self.assertEqual(f["decks"][0]["d"], ["4xX", "3xY"])
        self.assertEqual(f["decks"][0]["gegner"], [["B", 2, 1]])
        self.assertEqual(len(f["decks"]), 1)
        self.assertEqual(f["leader"][0]["gegner"], [["B", 2, 1]])

    def test_alle_holen_zaehlt_und_faengt_fehler(self):
        def ablauf(spieler, von, bis, **_):
            if spieler["user_id"] == 2:
                raise ApiFehler("x")
            return {"m": 1} if spieler["user_id"] == 1 else None

        original = s.einen_holen
        s.einen_holen = ablauf
        try:
            paket, z = s.alle_holen([{"user_id": 1}, {"user_id": 2}, {"user_id": 3}, {"user_id": None}],
                                    heute=datetime.date(2026, 11, 2))
        finally:
            s.einen_holen = original
        self.assertEqual(list(paket["spieler"]), ["1"])
        self.assertEqual(z, {"geprueft": 4, "gefunden": 1, "ohne": 2, "fehler": 1})
        self.assertEqual(paket["stand"], "2026-11-02")


if __name__ == "__main__":
    unittest.main()
