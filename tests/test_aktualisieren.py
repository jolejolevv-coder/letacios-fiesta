"""Tests fuer das Zusammenfuehren der Kartenwerte, siehe aktualisieren.py (Format 2)."""
import fnmatch
import os
import shutil
import sys
import tempfile
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
    def test_tage_ab_start_nur_modus_0(self):
        self.assertEqual(A.format_tage(INDEX, "2026-10-27"), ["2026-10-27", "2026-10-28"])
        self.assertEqual(A.format_tage(INDEX, A.FORMAT_START), [])

    def test_teile_aller_bereiche_nur_modus_0_ohne_umstellungstag(self):
        tage = A.format_tage(INDEX, "2026-10-27")
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

    def test_wochensatz_fehlt_bis_woche_ab(self):
        woche_ab = "2026-11-03"
        self.assertTrue(A.ausgeblendet("Stats_lw", "2026-11-02", woche_ab))
        self.assertFalse(A.ausgeblendet("Stats_lw", woche_ab, woche_ab))
        self.assertEqual(A.anzeigename("Stats_lw"), "Last Week Standard")

    def test_altes_format_ausgeblendet(self):
        self.assertTrue(A.ausgeblendet("Stats_OP17", "2026-10-27", "2026-11-03"))
        self.assertTrue(A.ausgeblendet("Stats_OP17-1BillionBounty", "2026-11-06", "2026-11-03"))
        self.assertFalse(A.ALTE_FORMATE_ZEIGEN)

    def test_nur_formatsaetze(self):
        # Nutzer 06.11.2026: nur Formatsatz und Event Satz in der Auswahl.
        self.assertTrue(A.NUR_FORMATSAETZE)

    def test_special_queue_ausgeblendet(self):
        self.assertTrue(A.ausgeblendet("Stats_Special_Queue", "2026-11-03", "2026-11-03"))

    def test_wochenfenster_ohne_altes_format(self):
        tage = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]
        self.assertEqual(A.wochentage(tage), ["2026-10-29", "2026-10-30"])

    def test_wochenfenster_vor_dem_ersten_neuen_tag(self):
        tage = ["2026-10-26", "2026-10-27", "2026-10-28"]
        self.assertEqual(A.wochentage(tage), [])


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

    def test_kopfzahlen_nur_gegen_erlaubte(self):
        robin = self.event["leader"][0]
        self.assertEqual((robin["w"], robin["l"], robin["sl"]), (5, 0, 5))   # nur Gegner 2 und 3
        robin["gw"] = [1, 2]                    # gm bleibt [2, 3], also 2 Niederlagen
        robin.update(A.kopfzahlen_aus_gegnern(robin))
        self.assertEqual((robin["w"], robin["l"]), (3, 2))
        self.assertEqual((robin["fw"], robin["fl"], robin["sw"], robin["sl"]), (5, 5, 5, 5))
        self.assertEqual((self.event["leader"][1]["w"], self.event["leader"][1]["l"]), (0, 0))

    def test_partien_aus_sicht_der_leader_und_hinweis(self):
        self.assertEqual(self.event["partien"], 5)
        self.assertEqual(self.event["name"], "EB05 Heroines Event")
        self.assertTrue(self.event["listen_alle_gegner"])

    def test_eingangssatz_unveraendert(self):
        self.assertEqual(len(self.satz["leader"][0]["geg"]), 3)

    def test_leader_ohne_anzahl(self):
        self.assertEqual(A.leader_ohne_anzahl("1xP-117"), "P-117")
        self.assertEqual(A.leader_ohne_anzahl("Mobile"), "Mobile")

    def test_event_datei_im_repo(self):
        name, erlaubt = A.event_leader_lesen(A.EVENT_DATEI)
        self.assertEqual(name, "EB05 Heroines Event")
        self.assertEqual(len(erlaubt), 25)

    def test_fehlende_event_datei(self):
        self.assertIsNone(A.event_leader_lesen("/gibt/es/nicht.json"))

    def test_event_direkt_nach_formatsatz(self):
        saetze = dict.fromkeys(["Stats_lw", "Stats_OP17", A.FORMAT_SCHLUESSEL,
                                A.EVENT_SCHLUESSEL, "Roh_mode_0_3000"])
        self.assertEqual(A.satz_reihenfolge(saetze), [
            A.FORMAT_SCHLUESSEL, A.EVENT_SCHLUESSEL, "Stats_lw", "Stats_OP17",
            "Roh_mode_0_3000"])


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


def cdn_index(tage, modus="mode_0"):
    return [f"{tag}/{modus}/25_1000/stats{i:04d}.json" for i, tag in enumerate(tage)]


def tag_roh(partien, mit_neu, karte_neu="OP18-001", deck_alt="4xOP17-039",
            leader="1xOP17-039"):
    """Rohstruktur eines CDN Tages: `partien` Siege, davon `mit_neu` mit `karte_neu`."""
    listen = [{"deck": ["4x" + karte_neu], "wins": mit_neu},
              {"deck": [deck_alt], "wins": partien - mit_neu}]
    return A.zusammenfuehren([{
        "number_of_matches": partien, "timestamp": "t",
        "decklists": [{"leader": leader, "lists": [l for l in listen if l["wins"]]}],
        "leaders_presence": [{"leader": leader, "number_of_matches": partien,
                              "wins": partien}]}])


class Cdn(unittest.TestCase):
    TAGE = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-01"]

    def test_format_tage_ab_start_samt_juengstem(self):
        index = cdn_index(self.TAGE) + cdn_index(["2026-11-02"], "mode_1")
        self.assertEqual(A.format_tage(index, A.FORMAT_START),
                         ["2026-10-29", "2026-10-30", "2026-11-01"])

    def test_keine_still_warnung_bis_zwei_tage(self):
        self.assertIsNone(A.cdn_still_warnung(cdn_index(self.TAGE), "2026-11-03"))

    def test_still_warnung_ab_drei_tagen(self):
        index = cdn_index(self.TAGE) + cdn_index(["2026-11-03"], "mode_1")
        warnung = A.cdn_still_warnung(index, "2026-11-04")
        self.assertIn("2026-11-01", warnung)
        self.assertIn("3 Tage", warnung)

    def test_still_warnung_ohne_daten(self):
        self.assertIsNotNone(A.cdn_still_warnung([], "2026-11-04"))

    def test_summe_nur_der_genannten_tage(self):
        je_tag = {"2026-10-28": tag_roh(50, 0), "2026-10-29": tag_roh(10, 6),
                  "2026-10-30": tag_roh(20, 14)}
        summe = A.summe_roh(je_tag, ["2026-10-29", "2026-10-30", "2026-10-31"])
        self.assertEqual(summe["partien"], 30)
        satz = A.eindampfen(summe, A.FORMAT_NAME)
        self.assertEqual(satz["leader"][0]["w"], 30)
        self.assertAlmostEqual(A.eb05_anteil(satz, "OP18"), 20 / 30)

    def test_roh_addieren_summiert_karten_und_gegner(self):
        a = A.zusammenfuehren([teil(3, 1)])
        b = A.zusammenfuehren([teil(2, 2)])
        summe = A.roh_addieren(a, b)
        self.assertEqual(summe["karten"]["1xOP17-039"]["kopien"]["2xOP17-041"], [8, 3])
        self.assertEqual(summe["partien"], 2)
        self.assertEqual(a["partien"], 1)

    def test_satz_ab_start_mit_hand_und_ohne_namenszusatz(self):
        liste = {"decklists": [{"leader": "1xOP17-039",
                                "lists": [{"deck": ["4xOP17-039"], "wins": 1, "losses": 1}]}]}
        je_tag = {"2026-10-28": A.zusammenfuehren([{**teil(9, 9), **liste}]),
                  "2026-10-29": A.zusammenfuehren([{**teil(3, 1), **liste}])}
        satz = A.format_satz_bauen(je_tag, A.standard_zustand())
        self.assertEqual(satz["name"], A.FORMAT_NAME)
        self.assertEqual(satz["partien"], 1)          # der 28.10. zaehlt nicht mehr
        self.assertEqual(satz["leader"][0]["hand"]["OP17-054"][0], 3)


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


class Formaterkennung(unittest.TestCase):
    def setUp(self):
        self.zustand = A.standard_zustand()

    def erkennen(self, *tage):
        """Je Tag ab dem 30.10. eine Rohstruktur, dazu ein alter Tag am 29.10."""
        je_tag = {"2026-10-29": tag_roh(100, 0)}
        for n, roh in enumerate(tage):
            je_tag[f"2026-10-{30 + n}"] = roh
        return A.format_wechsel_erkennen(je_tag, self.zustand)

    def test_vier_prozent_loesen_nichts_aus(self):
        self.assertIsNone(self.erkennen(tag_roh(100, 4),
                                        tag_roh(100, 60)))

    def test_mischtag_dann_dreissig_prozent_folgetag(self):
        self.assertEqual(self.erkennen(tag_roh(100, 10),
                                       tag_roh(100, 30)),
                         ("2026-10-31", {"OP18"}))

    def test_folgetag_unter_dreissig_prozent_noch_kein_wechsel(self):
        self.assertIsNone(self.erkennen(tag_roh(100, 10),
                                        tag_roh(100, 29)))

    def test_umstellungstag_ohne_folgetag_noch_kein_wechsel(self):
        self.assertIsNone(self.erkennen(tag_roh(100, 40)))

    def test_starter_und_promos_zaehlen_nicht(self):
        self.assertIsNone(self.erkennen(tag_roh(100, 100, "ST30-001"),
                                        tag_roh(100, 100, "P-045")))

    def test_nicht_hoehere_sets_zaehlen_nicht(self):
        self.assertIsNone(self.erkennen(tag_roh(100, 100, "EB05-002"),
                                        tag_roh(100, 100, "OP16-001")))

    def test_tage_vor_dem_start_zaehlen_nicht(self):
        je_tag = {"2026-10-27": tag_roh(100, 100), "2026-10-28": tag_roh(100, 100)}
        self.assertIsNone(A.format_wechsel_erkennen(je_tag, self.zustand))

    def test_eb06_kommt_dazu_op18_ersetzt(self):
        eb = A.format_nach_wechsel(self.zustand, "2026-11-10", {"EB06"})
        self.assertEqual(eb["sets"], ["OP17", "EB06"])
        self.assertEqual(eb["name"], "OP17 + EB06 Standard")
        self.assertEqual(eb["schluessel"], "Roh_mode_0_op17eb06")
        op = A.format_nach_wechsel(self.zustand, "2026-11-10", {"OP18"})
        self.assertEqual((op["sets"], op["name"], op["schluessel"]),
                         (["OP18"], "OP18 Standard", "Roh_mode_0_op18"))
        beide = A.format_nach_wechsel(self.zustand, "2026-11-10", {"OP18", "EB06"})
        self.assertEqual(beide["sets"], ["OP18", "EB06"])
        self.assertEqual(beide["name"], "OP18 + EB06 Standard")

    def test_schluessel_des_heutigen_formats_unveraendert(self):
        self.assertEqual(A.format_schluessel(["OP17", "EB05"]), A.FORMAT_SCHLUESSEL)
        self.assertEqual(A.format_name(["OP17", "EB05"]), A.FORMAT_NAME)


class Zustand(unittest.TestCase):
    def setUp(self):
        self.ziel = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.ziel)

    def test_ohne_datei_aus_den_konstanten(self):
        self.assertEqual(A.zustand_lesen(self.ziel), {
            "start": A.FORMAT_START, "name": A.FORMAT_NAME,
            "schluessel": A.FORMAT_SCHLUESSEL, "sets": ["OP17", "EB05"], "alte": []})

    def test_kaputte_datei_aus_den_konstanten(self):
        os.makedirs(os.path.join(self.ziel, "tage"))
        with open(os.path.join(self.ziel, "tage", A.ZUSTAND_DATEI), "w") as datei:
            datei.write("{kaputt")
        self.assertEqual(A.zustand_lesen(self.ziel), A.standard_zustand())

    def test_unvollstaendige_datei_aus_den_konstanten(self):
        os.makedirs(os.path.join(self.ziel, "tage"))
        with open(os.path.join(self.ziel, "tage", A.ZUSTAND_DATEI), "w") as datei:
            datei.write('{"start": "2026-11-10"}')
        self.assertEqual(A.zustand_lesen(self.ziel), A.standard_zustand())

    def test_alter_start_wird_auf_formatstart_gezogen(self):
        zustand = dict(A.standard_zustand(), start="2026-10-27", cdn_ab="2026-10-29")
        A.zustand_schreiben(self.ziel, zustand)
        self.assertEqual(A.zustand_lesen(self.ziel), A.standard_zustand())

    def test_replay_reste_werden_geraeumt(self):
        pfad = os.path.join(self.ziel, "tage", A.REPLAY_RESTE[0])
        os.makedirs(os.path.dirname(pfad))
        open(pfad, "w").close()
        A.replay_reste_raeumen(self.ziel)
        self.assertFalse(os.path.exists(pfad))

    def test_hin_und_zurueck(self):
        zustand = A.format_nach_wechsel(A.standard_zustand(), "2026-11-10", {"OP18"})
        zustand["alte"] = [{"schluessel": "k_alt", "name": "n", "datei": "k_alt.zwischen.gz"}]
        A.zustand_schreiben(self.ziel, zustand)
        self.assertEqual(A.zustand_lesen(self.ziel), zustand)


class Wechsel(unittest.TestCase):
    """Ein simulierter Wechsel auf OP18, ohne Codeaenderung."""

    def setUp(self):
        self.ziel = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.ziel)
        self.je_tag = {"2026-10-28": tag_roh(80, 0), "2026-10-30": tag_roh(50, 0),
                       "2026-11-09": tag_roh(50, 0), "2026-11-10": tag_roh(50, 10),
                       "2026-11-11": tag_roh(50, 40), "2026-11-12": tag_roh(50, 45)}
        self.alt = A.standard_zustand()
        self.neu = A.format_wechsel_anwenden(self.ziel, self.je_tag, self.alt)

    def test_neues_format(self):
        self.assertEqual((self.neu["start"], self.neu["sets"], self.neu["name"],
                          self.neu["schluessel"]),
                         ("2026-11-11", ["OP18"], "OP18 Standard", "Roh_mode_0_op18"))

    def test_neuer_satz_ab_dem_start(self):
        satz = A.format_satz_bauen(self.je_tag, self.neu)
        self.assertEqual(satz["partien"], 100)
        self.assertEqual(satz["name"], "OP18 Standard")
        self.assertAlmostEqual(A.eb05_anteil(satz, "OP18"), 85 / 100)
        self.assertIsNone(A.eb05_warnung(satz, self.neu))

    def test_alter_satz_bis_zum_vortag_der_umstellung(self):
        alte = A.alte_saetze(self.ziel, self.neu)
        self.assertEqual(list(alte), ["Roh_mode_0_op17eb05_alt"])
        satz = alte["Roh_mode_0_op17eb05_alt"]
        self.assertEqual(satz["partien"], 100)      # 30.10. und 09.11., ohne 28.10. und Mischtag
        self.assertEqual(satz["name"], "OP17 + EB05 format (old)")
        self.assertTrue(os.path.exists(os.path.join(
            self.ziel, "tage", "Roh_mode_0_op17eb05_alt" + A.ALT_ZWISCHEN)))
        self.assertTrue(os.path.exists(os.path.join(
            self.ziel, "saetze", "Roh_mode_0_op17eb05_alt.json.gz")))

    def test_alter_satz_bleibt_ueber_die_zustandsdatei(self):
        A.zustand_schreiben(self.ziel, self.neu)
        gelesen = A.zustand_lesen(self.ziel)
        self.assertEqual(list(A.alte_saetze(self.ziel, gelesen)), ["Roh_mode_0_op17eb05_alt"])

    def test_zwischendatei_bleibt_beim_aufraeumen(self):
        self.assertFalse(fnmatch.fnmatch("Roh_mode_0_op17eb05_alt" + A.ALT_ZWISCHEN, "*.json.gz"))

    def test_kein_zweiter_wechsel(self):
        self.assertIsNone(A.format_wechsel_erkennen(self.je_tag, self.neu))

    def test_wochengrenze_und_reihenfolge_folgen_dem_zustand(self):
        self.assertEqual(A.wochentage(["2026-11-10", "2026-11-11", "2026-11-12"], self.neu),
                         ["2026-11-11", "2026-11-12"])
        saetze = dict.fromkeys(["Stats_lw", "Roh_mode_0_op17eb05_alt", self.neu["schluessel"]])
        self.assertEqual(A.satz_reihenfolge(saetze, self.neu)[0], "Roh_mode_0_op18")

    def test_warnung_nennt_das_neueste_set(self):
        satz = satz_mit([(["4xOP17-039"], 5, 5)])
        self.assertIn("OP18", A.eb05_warnung(satz, self.neu))


if __name__ == "__main__":
    unittest.main()


BEISPIELE = os.path.join(os.path.dirname(__file__), "beispiele")


def beispiel(name):
    import json
    with open(os.path.join(BEISPIELE, name), encoding="utf-8") as datei:
        return json.load(datei)


class Kartenquelle(unittest.TestCase):
    """namen_holen und die Umrechner ohne Netz, mit Beispielantworten beider Quellen."""

    def setUp(self):
        self.produkte = beispiel("tcgcsv_produkte.json")
        self.kaizoku = beispiel("kaizoku.json")
        self.karten = A.karten_aus_tcgcsv(self.produkte)

    def test_grundmotiv_statt_variante(self):
        # Die Parallel Version steht zuerst und hat andere Kosten.
        self.assertEqual(self.karten["OP01-016"], {"n": "Nami", "f": "r", "k": 1, "c": 1000})

    def test_nur_variante_vorhanden_nimmt_die_variante(self):
        self.assertEqual(self.karten["OP18-001"]["n"], "Tony Tony.Chopper (Parallel)")

    def test_event_counter_aus_dem_kartentext(self):
        self.assertEqual(self.karten["OP01-029"], {"n": "Radical Beam!!", "f": "r", "k": 1,
                                                    "a": "e", "c": 2000})

    def test_event_als_character_gemeldet_wird_erkannt(self):
        self.assertEqual(self.karten["EB01-050"]["a"], "e")
        self.assertEqual(self.karten["EB01-050"].get("c"), None)   # kein +Zahl im Text

    def test_leader_nimmt_life_als_kosten_und_beide_farben(self):
        self.assertEqual(self.karten["EB01-001"], {"n": "Kouzuki Oden", "f": "gr", "k": 4, "a": "l"})

    def test_stage_und_namenszusatz(self):
        self.assertEqual(self.karten["EB04-010"], {"n": "Lulucia Kingdom", "f": "r", "k": 7, "a": "s"})
        self.assertEqual(self.karten["EB05-010"]["n"], "Nico Robin")

    def test_don_und_boxen_sind_keine_karten(self):
        self.assertNotIn("DON-001", self.karten)
        self.assertEqual(len(self.karten), 7)

    def test_kaizoku_umrechner(self):
        self.assertEqual(A.karte_aus_kaizoku(self.kaizoku[3]),
                         ("OP18-090", {"n": "Event X", "f": "s", "k": 2, "a": "e", "c": 4000}))
        self.assertEqual(A.karte_aus_kaizoku(self.kaizoku[2])[1]["f"], "rg")
        self.assertIsNone(A.karte_aus_kaizoku(self.kaizoku[5]))   # leerer Platzhalter
        self.assertIsNone(A.karte_aus_kaizoku(self.kaizoku[1]))   # P-999 ohne Kartenart

    def test_kaizoku_zuerst_tcgcsv_fuellt_luecken(self):
        karten = A.karten_aus_kaizoku(self.kaizoku)
        neu = A.karten_ergaenzen(karten, self.karten)
        # Nummern, die nur tcgcsv kennt, kommen dazu; Kaizoku Werte bleiben stehen.
        self.assertEqual(neu, len(set(self.karten) - set(A.karten_aus_kaizoku(self.kaizoku))))
        self.assertEqual(karten["OP18-090"]["c"], 4000)

    def test_ergaenzen_fuellt_nur_fehlende_felder(self):
        karten = {"OP01-001": {"n": "Kaizoku", "k": 5}}
        neu = A.karten_ergaenzen(karten, {"OP01-001": {"n": "tcgcsv", "k": 4, "c": 1000},
                                          "OP01-002": {"n": "Nur tcgcsv"}})
        self.assertEqual(neu, 1)
        self.assertEqual(karten["OP01-001"], {"n": "Kaizoku", "k": 5, "c": 1000})
        self.assertEqual(karten["OP01-002"], {"n": "Nur tcgcsv"})

    def test_namen_holen_schreibt_beide_quellen(self):
        with tempfile.TemporaryDirectory() as ziel:
            anzahl = A.namen_holen(ziel, self.produkte, self.kaizoku)
            gelesen = A.lesen(os.path.join(ziel, "karten.json.gz"))
        self.assertEqual(anzahl, 10)
        self.assertEqual(gelesen["OP01-016"]["n"], "Nami (Kaizoku)")   # Kaizoku zuerst
        self.assertEqual(gelesen["OP18-005"]["k"], 4)

    def test_kaizoku_ausfall_nimmt_tcgcsv_und_gestern(self):
        alt = A.kaizoku_holen
        A.kaizoku_holen = lambda: (_ for _ in ()).throw(OSError("aus"))
        try:
            with tempfile.TemporaryDirectory() as ziel:
                pfad = os.path.join(ziel, "karten.json.gz")
                A.schreiben(pfad, {"OP99-001": {"n": "Gestern"}})
                self.assertEqual(A.namen_holen(ziel, self.produkte), 8)
                self.assertEqual(A.lesen(pfad)["OP99-001"], {"n": "Gestern"})
        finally:
            A.kaizoku_holen = alt

    def test_tcgcsv_ausfall_nimmt_kaizoku_und_gestern(self):
        with tempfile.TemporaryDirectory() as ziel:
            pfad = os.path.join(ziel, "karten.json.gz")
            A.schreiben(pfad, {"OP99-001": {"n": "Gestern"}})
            anzahl = A.namen_holen(ziel, [], self.kaizoku)
            gelesen = A.lesen(pfad)
        self.assertEqual(anzahl, len(A.karten_aus_kaizoku(self.kaizoku)) + 1)
        self.assertEqual(gelesen["OP99-001"], {"n": "Gestern"})

    def test_beide_aus_laesst_die_alte_datei_stehen(self):
        with tempfile.TemporaryDirectory() as ziel:
            pfad = os.path.join(ziel, "karten.json.gz")
            A.schreiben(pfad, {"OP01-001": {"n": "Gestern"}})
            self.assertEqual(A.namen_holen(ziel, [], []), 0)
            self.assertEqual(A.lesen(pfad), {"OP01-001": {"n": "Gestern"}})

    def test_karten_ohne_daten(self):
        with tempfile.TemporaryDirectory() as ziel:
            os.makedirs(os.path.join(ziel, "saetze"))
            A.schreiben(os.path.join(ziel, "saetze", "x.json.gz"),
                        {"leader": [{"id": "OP01-001", "geg": ["OP01-002"], "listen": []}]})
            A.schreiben(os.path.join(ziel, "karten.json.gz"), {"OP01-001": {"n": "a"}})
            self.assertEqual(A.karten_ohne_daten(ziel), ["OP01-002"])
