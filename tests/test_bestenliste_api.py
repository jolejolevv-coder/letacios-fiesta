"""Tests fuer den Abruf der Bestenliste, siehe bestenliste_api.py.

Das Netz wird nicht angefasst: `oeffnen` ist eine Attrappe mit festen Antworten."""
import io
import json
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bestenliste_api as A  # noqa: E402


class Antwort:
    def __init__(self, inhalt):
        self.inhalt = json.dumps(inhalt).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.inhalt


def zeile(rang, bounty=None, **mehr):
    z = {"rank": rang, "username": f"u{rang}", "displayName": f"Spieler {rang}",
         "rating": bounty if bounty is not None else 4000 - rang, "wins": 20, "losses": 10,
         "matches": 30, "winRate": 66.7, "playerId": 1000 + rang,
         "topLeaders": [{"code": "OP13-001", "winRate": 70.0, "matches": 20}]}
    z.update(mehr)
    return z


class Netz:
    """Antwortet der Reihe nach; ein Fehlerobjekt wird geworfen."""
    def __init__(self, *antworten):
        self.antworten = list(antworten)
        self.aufrufe = []

    def __call__(self, req, timeout=None):
        self.aufrufe.append((req.full_url, req.get_method(), dict(req.header_items())))
        a = self.antworten.pop(0)
        if isinstance(a, Exception):
            raise a
        return Antwort(a)


def fehler(code):
    return urllib.error.HTTPError("u", code, "x", {}, io.BytesIO(b""))


def holen(*antworten, anzahl=100):
    netz = Netz(*antworten)
    pausen = []
    erg = A.top_holen(anzahl, oeffnen=netz, schlafen=pausen.append)
    return erg, netz, pausen


class Abruf(unittest.TestCase):
    def liste(self, n=100):
        return {"entries": [zeile(r) for r in range(1, n + 1)]}

    def test_ablauf_sitzung_dann_liste(self):
        erg, netz, pausen = holen({"token": "T", "expires_in": 7200}, self.liste())
        self.assertEqual(len(erg), 100)
        url0, methode0, _ = netz.aufrufe[0]
        self.assertTrue(url0.endswith("/auth/session"))
        self.assertEqual(methode0, "POST")
        url1, methode1, kopf1 = netz.aufrufe[1]
        self.assertIn("/api/leaderboard/mode_0?page=1&per_page=100", url1)
        self.assertEqual(kopf1["Authorization"], "Bearer T")
        self.assertIn("letacios-fiesta", kopf1["User-agent"])
        self.assertEqual(pausen, [A.ABSTAND_S])

    def test_zeile_im_format_der_seite(self):
        erg, _, _ = holen({"token": "T"}, self.liste())
        e = erg[0]
        self.assertEqual(e["rang"], 1)
        self.assertEqual(e["user_id"], 1001)
        self.assertEqual(e["bounty"], 3999.0)
        self.assertEqual(e["leader"][0], {"leader": "OP13-001", "winrate": 70.0, "partien": 20})
        self.assertEqual(e["quelle"], "api")

    def test_bounty_wird_gerundet(self):
        z = [zeile(1, 5000.2189)] + [zeile(r) for r in range(2, 101)]
        erg, _, _ = holen({"token": "T"}, {"entries": z})
        self.assertEqual(erg[0]["bounty"], 5000.2)

    def test_sortiert_nach_rang(self):
        z = list(reversed([zeile(r) for r in range(1, 101)]))
        erg, _, _ = holen({"token": "T"}, {"entries": z})
        self.assertEqual([e["rang"] for e in erg][:3], [1, 2, 3])

    def test_wiederholt_bei_429_und_wartet(self):
        erg, netz, pausen = holen(fehler(429), {"token": "T"}, self.liste())
        self.assertEqual(len(erg), 100)
        self.assertEqual(pausen[0], A.WARTE_START_S)

    def test_gibt_auf_nach_allen_versuchen(self):
        netz = Netz(*[fehler(503)] * (A.WIEDERHOLUNGEN + 1))
        with self.assertRaises(A.ApiFehler):
            A.top_holen(oeffnen=netz, schlafen=lambda s: None)

    def test_andere_fehler_ohne_wiederholung(self):
        netz = Netz(fehler(403))
        with self.assertRaises(A.ApiFehler):
            A.top_holen(oeffnen=netz, schlafen=lambda s: None)
        self.assertEqual(len(netz.aufrufe), 1)

    def test_sitzung_ohne_token(self):
        with self.assertRaises(A.ApiFehler):
            holen({"expires_in": 1})

    def test_zu_wenige_zeilen(self):
        with self.assertRaises(A.ApiFehler):
            holen({"token": "T"}, self.liste(10))

    def test_doppelter_rang(self):
        z = [zeile(r) for r in range(1, 100)] + [zeile(50)]
        with self.assertRaises(A.ApiFehler):
            holen({"token": "T"}, {"entries": z})

    def test_bounty_muss_absteigen(self):
        z = [zeile(r) for r in range(1, 101)]
        z[10]["rating"] = 9999
        with self.assertRaises(A.ApiFehler):
            holen({"token": "T"}, {"entries": z})

    def test_unbekannte_form(self):
        z = [zeile(r) for r in range(1, 101)]
        del z[3]["playerId"]
        with self.assertRaises(A.ApiFehler):
            holen({"token": "T"}, {"entries": z})


if __name__ == "__main__":
    unittest.main()
