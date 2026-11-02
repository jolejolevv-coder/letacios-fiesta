import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import kaizoku_holen as k  # noqa: E402
from bestenliste_api import ApiFehler  # noqa: E402

MANIFEST = {"simStats": {"date": "20261102", "files": {
    "stats": {"op17_lw_p": {"current": "stats/stats_op17_lw_p_20261102.json"}},
    "decklist": {"op17_lw_p": {"current": "stats/decklist_op17_lw_p_20261102.json"}}}}}


def stat(lid, spiele=100):
    return {"leaderKey": lid, "leaderName": "N" + lid, "wins": spiele // 2, "number_of_matches": spiele,
            "total_matches": 5000, "raw_win_rate": 0.5, "weighted_win_rate": 0.49, "play_rate": 0.1,
            "first_win_rate": 0.5, "second_win_rate": 0.4,
            "matchups": [{"opponentKey": "B", "total_games": 10, "wins": 6},
                         {"opponentKey": "C", "total_games": 0, "wins": 0}]}


def deck(karten, spiele="23", siege="5", gegner=None):
    return {"decklist": "\n".join(karten), "unique_pilots": "2", "wins": siege, "total_games": spiele,
            "matchup_stats": str(gegner if gegner is not None else
                                 [{"oppLeaderKey": "B", "games_played": 3, "wins": 2}])}


class KaizokuTests(unittest.TestCase):
    def test_pfade_aus_dem_manifest(self):
        self.assertEqual(k.pfade_holen(MANIFEST)[1], "stats/stats_op17_lw_p_20261102.json")

    def test_manifest_ohne_datensatz(self):
        with self.assertRaises(ApiFehler):
            k.pfade_holen(MANIFEST, "gibtsnicht")

    def test_gegner_lesen_aus_python_literal(self):
        text = str([{"oppLeaderKey": "B", "games_played": 3, "wins": 2},
                    {"oppLeaderKey": "A", "games_played": 5, "wins": 1}])
        self.assertEqual(k.gegner_lesen(text), [["A", 5, 1], ["B", 3, 2]])

    def test_gegner_lesen_kaputt(self):
        self.assertEqual(k.gegner_lesen("{{{"), [])
        self.assertEqual(k.gegner_lesen(None), [])

    def test_listen_ohne_doppelte_und_nach_partien(self):
        e = {"best_decklists": [deck(["4xA", "4xB"], "10"), deck(["4xC"], "50")],
             "most_played_decklists": [deck(["4xB", "4xA"], "10")]}
        listen = k.listen_bauen(e)
        self.assertEqual([li["m"] for li in listen], [50, 10])
        self.assertEqual(listen[1]["gegner"], [["B", 3, 2]])

    def test_paket(self):
        stats = [stat(f"L{i}", 100 + i) for i in range(40)]
        decks = [{"leaderKey": "L0", "best_decklists": [deck(["4xA"])], "most_played_decklists": []}]
        p = k.paket_bauen(stats, decks, "20261102")
        self.assertEqual(len(p["leader"]), 40)
        self.assertEqual(p["leader"][0]["id"], "L39")          # nach Partien
        self.assertEqual(p["leader"][0]["gegner"], [["B", 10, 6]])  # Gegner ohne Partien fällt weg
        mit = [e for e in p["leader"] if e["id"] == "L0"][0]
        self.assertEqual(len(mit["listen"]), 1)
        self.assertEqual(p["partien"], 5000)

    def test_zu_wenige_leader(self):
        with self.assertRaises(ApiFehler):
            k.paket_bauen([stat("A")], [], "x")

    def test_zeile_unbekannter_form(self):
        stats = [stat(f"L{i}") for i in range(40)]
        del stats[5]["wins"]
        with self.assertRaises(ApiFehler):
            k.paket_bauen(stats, [], "x")

    def test_holen_ruft_drei_dateien_mit_abstand(self):
        stats = [stat(f"L{i}") for i in range(40)]
        antworten = {"manifest.json": MANIFEST, "stats_op17": stats, "decklist_op17": []}
        pausen, urls = [], []

        def anfr(url, **_):
            urls.append(url)
            return next(v for key, v in antworten.items() if key in url)

        original = k.anfrage
        k.anfrage = anfr
        try:
            paket = k.holen(schlafen=pausen.append)
        finally:
            k.anfrage = original
        self.assertEqual(len(urls), 3)
        self.assertEqual(pausen, [k.ABSTAND_S, k.ABSTAND_S])
        self.assertEqual(paket["stand"], "20261102")


if __name__ == "__main__":
    unittest.main()
