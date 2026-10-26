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
    "2026-10-26/mode_0/25_1000/stats0001.json",
    "2026-10-27/mode_0/25_1000/stats0002.json",
    "2026-10-27/mode_0/3000/stats0002.json",
    "2026-10-27/mode_1/25_1000/stats0002.json",
    "2026-10-28/mode_0/1000_2000/stats0003.json",
]


def satz_mit(listen):
    return {"leader": [{"listen": [{"d": d, "w": w, "l": l} for d, w, l in listen]}]}


class Format(unittest.TestCase):
    def test_tage_ab_start(self):
        self.assertEqual(A.tage_ab(INDEX, A.FORMAT_START), ["2026-10-27", "2026-10-28"])

    def test_teile_aller_bereiche_nur_modus_0_ohne_umstellungstag(self):
        tage = A.tage_ab(INDEX, A.FORMAT_START)
        self.assertEqual(A.roh_teile(INDEX, tage, A.FORMAT_MODUS, list(A.BOUNTY)), [
            "2026-10-27/mode_0/25_1000/stats0002.json",
            "2026-10-27/mode_0/3000/stats0002.json",
            "2026-10-28/mode_0/1000_2000/stats0003.json",
        ])

    def test_teile_eines_bereichs_wie_bisher(self):
        self.assertEqual(A.roh_teile(INDEX, ["2026-10-27"], "mode_0", ["3000"]),
                         ["2026-10-27/mode_0/3000/stats0002.json"])

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

    def test_formatsatz_ganz_oben(self):
        saetze = dict.fromkeys(["Stats_lw", "Stats_LWS1BillionBounty", "Stats_LWS2BillionBounty",
                                "Stats_OP17", "Roh_mode_0_3000", A.FORMAT_SCHLUESSEL])
        self.assertEqual(A.satz_reihenfolge(saetze), [
            A.FORMAT_SCHLUESSEL, "Stats_lw", "Stats_LWS1BillionBounty",
            "Stats_LWS2BillionBounty", "Roh_mode_0_3000", "Stats_OP17"])

    def test_wochensatz_mischt_bis_misch_ende(self):
        self.assertEqual(A.anzeigename("Stats_lw", "2026-11-02"),
                         "Last Week Standard, mixed formats")
        self.assertEqual(A.anzeigename("Stats_lw", A.MISCH_ENDE), "Last Week Standard")

    def test_altes_format_heisst_old(self):
        self.assertEqual(A.anzeigename("Stats_OP17", "2026-10-27"), "OP17 format (old)")

    def test_special_queue_ausgeblendet(self):
        self.assertIn("Stats_Special_Queue", A.AUSGEBLENDET)

    def test_wochenfenster_ohne_altes_format(self):
        tage = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]
        self.assertEqual(A.wochentage(tage), ["2026-10-27", "2026-10-28"])

    def test_wochenfenster_vor_dem_ersten_neuen_tag(self):
        tage = ["2026-10-24", "2026-10-25", "2026-10-26"]
        self.assertEqual(A.wochentage(tage), tage)


def produkt(pid, name, nummer):
    return {"productId": pid, "name": name,
            "imageUrl": f"https://tcgplayer-cdn.tcgplayer.com/product/{pid}_200w.jpg",
            "extendedData": [{"name": "Number", "value": nummer}]}


class Tcgcsv(unittest.TestCase):
    def test_grundmotiv_statt_variante_und_1000_px(self):
        adressen = A.tcgcsv_bilder([
            produkt(9, "Nico Robin (010) (Alternate Art)", "EB05-010"),
            produkt(8, "Nico Robin (010)", "EB05-010"),
            produkt(5, "Nico Robin (Manga)", "OP18-031"),
            produkt(7, "Nico Robin", "OP18-031"),
            {"productId": 1, "name": "Booster Box", "extendedData": []},
        ])
        self.assertEqual(adressen, {
            "EB05-010": "https://tcgplayer-cdn.tcgplayer.com/product/8_in_1000x1000.jpg",
            "OP18-031": "https://tcgplayer-cdn.tcgplayer.com/product/7_in_1000x1000.jpg"})


class Bilder(unittest.TestCase):
    """bilder_kopieren ohne Netz: bild_laden wird ersetzt und merkt sich die Abrufe."""

    def setUp(self):
        import tempfile
        self.ordner = tempfile.TemporaryDirectory()
        self.ziel = self.ordner.name
        self.nachtrag = sorted(os.listdir(A.NACHTRAG))[0].replace(".jpg", "")
        A.schreiben(os.path.join(self.ziel, "saetze", "s.json.gz"), {"leader": [{
            "id": "1xOP01-001", "geg": ["1x" + self.nachtrag], "listen": [{"d": ["4xOP01-002"]}]}]})
        os.makedirs(os.path.join(self.ziel, "img"))
        self.bild("OP01-001", b"alt")
        self.abrufe = []
        self.alt_laden = A.bild_laden
        A.bild_laden = self.laden

    def tearDown(self):
        A.bild_laden = self.alt_laden
        self.ordner.cleanup()

    def bild(self, k, inhalt):
        with open(os.path.join(self.ziel, "img", k + ".jpg"), "wb") as datei:
            datei.write(inhalt)

    def laden(self, url, zieldatei):
        self.abrufe.append(url)
        with open(zieldatei, "wb") as datei:
            datei.write(b"neu")
        return True

    def test_erster_lauf_ersetzt_alle_und_merkt_es_sich(self):
        A.bilder_kopieren(self.ziel, {"OP01-001": "u1", "OP01-002": "u2"})
        self.assertEqual(sorted(self.abrufe), ["u1", "u2"])
        with open(os.path.join(self.ziel, "img", "OP01-001.jpg"), "rb") as datei:
            self.assertEqual(datei.read(), b"neu")
        with open(os.path.join(self.ziel, "img", "quelle.txt")) as datei:
            self.assertEqual(datei.read().strip(), A.BILD_KENNUNG)

    def test_spaeterer_lauf_laedt_nur_fehlende(self):
        with open(os.path.join(self.ziel, "img", "quelle.txt"), "w") as datei:
            datei.write(A.BILD_KENNUNG)
        A.bilder_kopieren(self.ziel, {"OP01-001": "u1", "OP01-002": "u2"})
        self.assertEqual(self.abrufe, ["u2"])

    def test_nachtrag_fuer_karten_ohne_tcgcsv(self):
        A.bilder_kopieren(self.ziel, {})
        self.assertTrue(os.path.exists(os.path.join(self.ziel, "img", self.nachtrag + ".jpg")))
        self.assertFalse(os.path.exists(os.path.join(self.ziel, "img", "quelle.txt")))

    def test_fehlgeschlagener_abruf_nimmt_nachtrag_und_bleibt_offen(self):
        A.bild_laden = lambda url, zieldatei: False
        A.bilder_kopieren(self.ziel, {self.nachtrag: "u", "OP01-002": "u2"})
        self.assertTrue(os.path.exists(os.path.join(self.ziel, "img", self.nachtrag + ".jpg")))
        self.assertEqual(A.zeilen_lesen(os.path.join(self.ziel, "img", "offen.txt")),
                         sorted(["OP01-001", "OP01-002", self.nachtrag]))

    def test_offene_karte_wird_spaeter_ersetzt(self):
        A.zeilen_schreiben(os.path.join(self.ziel, "img", "quelle.txt"), [A.BILD_KENNUNG])
        A.zeilen_schreiben(os.path.join(self.ziel, "img", "offen.txt"), ["OP01-001"])
        A.bilder_kopieren(self.ziel, {"OP01-001": "u1"})
        self.assertEqual(self.abrufe, ["u1"])
        self.assertEqual(A.zeilen_lesen(os.path.join(self.ziel, "img", "offen.txt")), [])

    def test_karte_ohne_tcgcsv_behaelt_ihr_bild(self):
        A.bilder_kopieren(self.ziel, {"OP01-002": "u2"})
        with open(os.path.join(self.ziel, "img", "OP01-001.jpg"), "rb") as datei:
            self.assertEqual(datei.read(), b"alt")


if __name__ == "__main__":
    unittest.main()
