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


INDEX = [
    "2026-10-09/mode_1/25_1000/stats0001.json",
    "2026-10-10/mode_1/25_1000/stats0002.json",
    "2026-10-10/mode_1/3000/stats0002.json",
    "2026-10-11/mode_0/25_1000/stats0003.json",
    "2026-10-11/mode_1/1000_2000/stats0003.json",
]


def satz_mit(listen):
    return {"leader": [{"listen": [{"d": d, "w": w, "l": l} for d, w, l in listen]}]}


class Eb05(unittest.TestCase):
    def test_tage_ab_start(self):
        self.assertEqual(A.tage_ab(INDEX, "2026-10-10"), ["2026-10-10", "2026-10-11"])

    def test_teile_aller_bereiche_nur_modus_1(self):
        tage = A.tage_ab(INDEX, A.EB05_START)
        self.assertEqual(A.roh_teile(INDEX, tage, A.EB05_MODUS, list(A.BOUNTY)), [
            "2026-10-10/mode_1/25_1000/stats0002.json",
            "2026-10-10/mode_1/3000/stats0002.json",
            "2026-10-11/mode_1/1000_2000/stats0003.json",
        ])

    def test_teile_eines_bereichs_wie_bisher(self):
        self.assertEqual(A.roh_teile(INDEX, ["2026-10-10"], "mode_1", ["3000"]),
                         ["2026-10-10/mode_1/3000/stats0002.json"])

    def test_anteil_nach_partien(self):
        satz = satz_mit([(["4xEB05-001", "4xOP13-016"], 3, 1), (["4xOP13-016"], 0, 4)])
        self.assertAlmostEqual(A.eb05_anteil(satz), 0.5)

    def test_keine_warnung_bei_genug_eb05(self):
        self.assertIsNone(A.eb05_warnung(satz_mit([(["4xEB05-001"], 2, 1)])))

    def test_warnung_wenn_eb05_fehlt(self):
        satz = satz_mit([(["4xEB05-001"], 1, 0), (["4xOP13-016"], 5, 4)])
        self.assertIn("10%", A.eb05_warnung(satz))

    def test_warnung_bei_leerem_satz(self):
        self.assertIsNotNone(A.eb05_warnung({"leader": []}))

    def test_eb05_vor_dem_wochensatz(self):
        saetze = dict.fromkeys(["Stats_lw", "Stats_LWS1BillionBounty", "Stats_LWS2BillionBounty",
                                "Stats_Special_Queue", "Stats_OP17", "Roh_mode_0_3000",
                                A.EB05_SCHLUESSEL])
        self.assertEqual(A.satz_reihenfolge(saetze), [
            "Stats_lw", "Stats_LWS1BillionBounty", "Stats_LWS2BillionBounty",
            "Roh_mode_0_3000", A.EB05_SCHLUESSEL, "Stats_Special_Queue", "Stats_OP17"])


def leader_zeile(kennung, w, l, gegner):
    zeile = {"id": kennung, "w": w, "l": l, "listen": []}
    for feld in A.GEGNER_FELDER:
        zeile[feld] = [g if feld == "geg" else n for n, g in enumerate(gegner, 1)]
    return zeile


class Event(unittest.TestCase):
    def setUp(self):
        self.satz = {"name": "EB05 Queue", "partien": 99, "stand": "2026-10-24", "leader": [
            leader_zeile("1xEB05-010", 6, 4, ["1xOP09-042", "1xOP11-022", "1xEB05-010"]),
            leader_zeile("1xOP09-042", 9, 1, ["1xEB05-010"]),
            leader_zeile("1xP-117", 1, 2, ["1xOP09-042"]),
        ]}
        self.event = A.event_satz(self.satz, {"EB05-010", "OP11-022", "P-117"}, "EB05 Heroines Event")

    def test_nur_erlaubte_leader(self):
        self.assertEqual([e["id"] for e in self.event["leader"]], ["1xEB05-010", "1xP-117"])

    def test_matchups_nur_gegen_erlaubte_parallel_gekuerzt(self):
        robin = self.event["leader"][0]
        self.assertEqual(robin["geg"], ["1xOP11-022", "1xEB05-010"])
        self.assertEqual(robin["gm"], [2, 3])
        self.assertEqual(robin["gsl"], [2, 3])
        self.assertEqual(self.event["leader"][1]["geg"], [])

    def test_kopfzahlen_bleiben_und_partien_aus_sicht_der_leader(self):
        self.assertEqual((self.event["leader"][0]["w"], self.event["leader"][0]["l"]), (6, 4))
        self.assertEqual(self.event["partien"], 13)
        self.assertEqual(self.event["name"], "EB05 Heroines Event")

    def test_eingangssatz_unveraendert(self):
        self.assertEqual(len(self.satz["leader"][0]["geg"]), 3)

    def test_leader_ohne_anzahl(self):
        self.assertEqual(A.leader_ohne_anzahl("1xP-117"), "P-117")
        self.assertEqual(A.leader_ohne_anzahl("Mobile"), "Mobile")

    def test_event_datei_im_repo(self):
        name, erlaubt = A.event_leader_lesen(A.EB05_EVENT_DATEI)
        self.assertEqual(name, "EB05 Heroines Event")
        self.assertEqual(len(erlaubt), 25)

    def test_fehlende_event_datei(self):
        self.assertIsNone(A.event_leader_lesen("/gibt/es/nicht.json"))

    def test_event_direkt_nach_eb05(self):
        saetze = dict.fromkeys(["Stats_lw", "Stats_Special_Queue", A.EB05_SCHLUESSEL,
                                A.EB05_EVENT_SCHLUESSEL])
        self.assertEqual(A.satz_reihenfolge(saetze), [
            "Stats_lw", A.EB05_SCHLUESSEL, A.EB05_EVENT_SCHLUESSEL, "Stats_Special_Queue"])


class Nachtrag(unittest.TestCase):
    def test_bild_kommt_aus_dem_repo_ohne_sim_und_ohne_netz(self):
        import tempfile
        kennung = sorted(os.listdir(A.NACHTRAG))[0].replace(".jpg", "")
        with tempfile.TemporaryDirectory() as ziel:
            A.schreiben(os.path.join(ziel, "saetze", "s.json.gz"),
                        {"leader": [{"id": "1x" + kennung, "geg": [], "listen": []}]})
            alt, A.BILDQUELLE = A.BILDQUELLE, "/gibt/es/nicht/*"
            try:
                A.bilder_kopieren(ziel)
            finally:
                A.BILDQUELLE = alt
            self.assertTrue(os.path.exists(os.path.join(ziel, "img", kennung + ".jpg")))


if __name__ == "__main__":
    unittest.main()
