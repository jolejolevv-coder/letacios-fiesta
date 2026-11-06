"""Tests fuer die Suche der echten Replaypfade in Firestore (specs/features/replay-pfade.md).

Seit etwa W43 legt der Client Replays unter `<verlierer>_<hash>.log` ab; der gerechnete Pfad
trifft dann nie. Die Beispieldokumente stammen aus einer Probe vom 06.11.2026."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import replays_holen as H  # noqa: E402
import spieler_daten as S  # noqa: E402

GERECHNET = "Replays/2026-W44/0/OP13-001/OP12-061_2480_1739.log"
ECHT = ("Replays/2026-W44/0/OP13-001/OP12-061_"
        "16723107eaecee18ff2c7622349003f920601af8392f581415529372c04c79f7.log")


def dok(sieger_bounty, verlierer_bounty, pfad):
    return {"winner_bounty": sieger_bounty, "loser_bounty": verlierer_bounty, "path": pfad}


class PfadTeile(unittest.TestCase):
    def test_gerechneter_pfad(self):
        self.assertEqual(S.pfad_teile(GERECHNET), ("0", "OP13-001", "OP12-061", 2480, 1739))

    def test_hashpfad_wird_nicht_noch_einmal_gesucht(self):
        self.assertIsNone(S.pfad_teile(ECHT))

    def test_leer(self):
        self.assertIsNone(S.pfad_teile(None))


class Frage(unittest.TestCase):
    def test_wie_der_client_ab_einer_stunde_vorher(self):
        filter_ = S.replay_frage("0", "OP13-001", "OP12-061", "2026-11-04T14:57:32")[
            "structuredQuery"]["where"]["compositeFilter"]["filters"]
        werte = {(f["fieldFilter"]["field"]["fieldPath"], f["fieldFilter"]["op"]):
                 f["fieldFilter"]["value"]["stringValue"] for f in filter_}
        self.assertEqual(werte[("winner_leader", "EQUAL")], "OP13-001")
        self.assertEqual(werte[("loser_leader", "EQUAL")], "OP12-061")
        self.assertEqual(werte[("game_mode", "EQUAL")], "0")
        self.assertEqual(werte[("timestamp", "GREATER_THAN")], "2026-11-04T13:57:32")
        self.assertEqual(werte[("timestamp", "LESS_THAN")], "2026-11-05T14:57:32")


class PassenderPfad(unittest.TestCase):
    def test_bounty_abgeschnitten_nicht_gerundet(self):
        docs = [dok(2480.9, 1739.99, ECHT)]
        self.assertEqual(S.passender_pfad(docs, 2480, 1739), ECHT)

    def test_andere_bounty_ist_eine_andere_partie(self):
        docs = [dok(2914.34, 1814.84, "Replays/x/a.log")]
        self.assertIsNone(S.passender_pfad(docs, 2480, 1739))

    def test_kaputtes_dokument_wird_uebersprungen(self):
        docs = [{"winner_bounty": None, "path": "Replays/x/a.log"}, dok(2480.1, 1739.2, ECHT)]
        self.assertEqual(S.passender_pfad(docs, 2480, 1739), ECHT)


class Aufloesen(unittest.TestCase):
    def test_treffer_ohne_upload_und_ausfall(self):
        partien = [{"zeit": "2026-11-04T14:57:32", "replay": GERECHNET},
                   {"zeit": "2026-11-05T17:16:27",
                    "replay": "Replays/2026-W44/0/OP17-058/OP13-001_2655_2544.log"},
                   {"zeit": "2026-11-05T19:51:02",
                    "replay": "Replays/2026-W44/0/OP17-039/OP17-039_1767_3145.log"},
                   {"zeit": "2026-11-05T19:00:00", "replay": None}]

        def antwort(db, frage):
            sieger = frage["structuredQuery"]["where"]["compositeFilter"]["filters"][0]
            leader = sieger["fieldFilter"]["value"]["stringValue"]
            if leader == "OP13-001":
                return [dok(2480.5, 1739.5, ECHT)]
            if leader == "OP17-058":
                return [dok(2914.3, 1814.8, "Replays/x/fremd.log")]
            raise OSError("Netz weg")

        with mock.patch.object(S, "replay_dokumente", antwort):
            self.assertEqual(S.replays_aufloesen(object(), partien), (1, 1, 1))
        self.assertEqual(partien[0]["replay"], ECHT)
        # Ohne Treffer und bei einem Ausfall bleibt der gerechnete Pfad.
        self.assertTrue(partien[1]["replay"].endswith("_2655_2544.log"))
        self.assertTrue(partien[2]["replay"].endswith("_1767_3145.log"))
        self.assertIsNone(partien[3]["replay"])


class Holen(unittest.TestCase):
    def test_zaehlung_je_woche(self):
        self.assertEqual(H.zaehlung(["Replays/2026-W44/0/a/b.log"],
                                    ["Replays/2026-W44/0/a/c.log", "Replays/2026-W42/0/a/d.log"]),
                         "2026-W42 0/1, 2026-W44 1/2")

    def test_fehlende_verlieren_den_pfad(self):
        quelle = {"spieler": {"1": {"partien": [{"replay": "a"}, {"replay": "b"}, {"replay": None}]}}}
        self.assertEqual(H.fehlende_austragen(quelle, ["b"]), 1)
        self.assertEqual([p["replay"] for p in quelle["spieler"]["1"]["partien"]], ["a", None, None])


if __name__ == "__main__":
    unittest.main()
