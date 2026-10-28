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

    def test_wochensatz_fehlt_bis_woche_ab(self):
        woche_ab = "2026-11-03"
        self.assertTrue(A.ausgeblendet("Stats_lw", "2026-11-02", woche_ab))
        self.assertFalse(A.ausgeblendet("Stats_lw", woche_ab, woche_ab))
        self.assertEqual(A.anzeigename("Stats_lw"), "Last Week Standard")

    def test_altes_format_bleibt_sichtbar(self):
        self.assertFalse(A.ausgeblendet("Stats_OP17", "2026-10-27", "2026-11-03"))
        self.assertEqual(A.anzeigename("Stats_OP17"), "OP17 format (old)")

    def test_special_queue_ausgeblendet(self):
        self.assertTrue(A.ausgeblendet("Stats_Special_Queue", "2026-11-03", "2026-11-03"))

    def test_wochenfenster_ohne_altes_format(self):
        tage = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]
        self.assertEqual(A.wochentage(tage), ["2026-10-27", "2026-10-28"])

    def test_wochenfenster_vor_dem_ersten_neuen_tag(self):
        tage = ["2026-10-24", "2026-10-25", "2026-10-26"]
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


def replay(sieger, verlierer, zeit="2026-10-27T10:00:00", pfad=None, sieger_deck="", verlierer_deck="",
           modus="0"):
    return {"timestamp": zeit, "game_mode": modus, "winner_leader": sieger,
            "loser_leader": verlierer, "winner_deck": sieger_deck, "loser_deck": verlierer_deck,
            "path": pfad or f"Replays/W/0/{sieger}/{verlierer}_{sieger}{zeit}.log"}


def log(waehler, wahl, a=("Anna#1", "OP17-039"), b=("Ben#2", "OP13-004")):
    zeile = '[{}] Leader is X [<mark><link="{}">{}</link></mark>]'
    return "\n".join([zeile.format(a[0], a[1], a[1]), zeile.format(b[0], b[1], b[1]),
                      f"[{waehler}] Will select turn order", f"[{waehler}] Chose to go {wahl}"])


class Replays(unittest.TestCase):
    def setUp(self):
        deck = "1xOP17-039\r\n4xEB05-001\r\n"
        self.docs = [
            replay("OP17-039", "OP13-004", sieger_deck=deck, pfad="a_h1.log"),
            replay("OP17-039", "OP13-004", sieger_deck=deck, pfad="a_h2.log"),
            replay("OP13-004", "OP17-039", verlierer_deck=deck, pfad="a_h3.log"),
            replay("OP17-039", "OP17-039", pfad="a_h4.log"),
            replay("OP17-039", "OP13-004", zeit="2026-10-26T23:59:59"),
            replay("OP17-039", "OP13-004", modus="1"),
        ]
        self.starts = {"a_h1.log": True, "a_h2.log": False, "a_h3.log": None}

    def satz(self):
        return A.replay_satz(self.docs, self.starts)

    def leader(self, satz, kennung):
        return next(e for e in satz["leader"] if e["id"] == kennung)

    def test_nur_modus_0_ab_formatstart(self):
        self.assertEqual(self.satz()["partien"], 4)
        self.assertEqual(self.satz()["name"], "OP17 + EB05 Standard (from replays)")

    def test_siege_niederlagen_und_gegner(self):
        e = self.leader(self.satz(), "1xOP17-039")
        # 2 Siege, 1 Niederlage gegen OP13-004, dazu der Mirror als Sieg und Niederlage
        self.assertEqual((e["w"], e["l"]), (3, 2))
        i = e["geg"].index("1xOP13-004")
        self.assertEqual((e["gm"][i], e["gw"][i]), (3, 2))
        self.assertEqual(len({len(e[f]) for f in A.GEGNER_FELDER}), 1)

    def test_first_und_second_nur_wo_bekannt(self):
        e = self.leader(self.satz(), "1xOP17-039")
        i = e["geg"].index("1xOP13-004")
        # h1: Sieger zuerst; h2: Sieger zweiter; h3: unbekannt
        self.assertEqual((e["fw"], e["fl"], e["sw"], e["sl"]), (1, 0, 1, 0))
        self.assertEqual((e["gfw"][i], e["gsw"][i]), (1, 1))
        gegner = self.leader(self.satz(), "1xOP13-004")
        self.assertEqual((gegner["fl"], gegner["sl"]), (1, 1))

    def test_decklisten_je_seite_die_eine_hat(self):
        e = self.leader(self.satz(), "1xOP17-039")
        self.assertEqual(len(e["listen"]), 1)
        liste = e["listen"][0]
        self.assertEqual(liste["d"], ["1xOP17-039", "4xEB05-001"])
        self.assertEqual((liste["w"], liste["l"], liste["fw"], liste["sw"]), (2, 1, 1, 1))
        self.assertEqual(A.eb05_anteil(self.satz()), 1.0)

    def test_ohne_hand_und_dauer(self):
        e = self.leader(self.satz(), "1xOP17-039")
        self.assertEqual((e["hand"], e["kopien"], e["dur"]), ({}, {}, 0))

    def test_heroines_filter_auf_dem_ergebnis(self):
        event = A.event_satz(self.satz(), {"OP17-039"}, "Event")
        self.assertEqual([e["id"] for e in event["leader"]], ["1xOP17-039"])
        self.assertEqual(event["leader"][0]["geg"], ["1xOP17-039"])
        self.assertEqual(event["partien"], 2)


class Reihenfolge(unittest.TestCase):
    def test_waehler_ist_sieger(self):
        self.assertTrue(A.sieger_zuerst(log("Anna#1", "First"), "OP17-039", "OP13-004"))
        self.assertFalse(A.sieger_zuerst(log("Anna#1", "Second"), "OP17-039", "OP13-004"))

    def test_waehler_ist_verlierer(self):
        self.assertFalse(A.sieger_zuerst(log("Ben#2", "First"), "OP17-039", "OP13-004"))
        self.assertTrue(A.sieger_zuerst(log("Ben#2", "Second"), "OP17-039", "OP13-004"))

    def test_unsichtbares_zeichen_im_namen(self):
        text = log("Anna#1", "First").replace("Anna#1", "Anna\u200b#1", 2)
        self.assertTrue(A.sieger_zuerst(text, "OP17-039", "OP13-004"))

    def test_mirror_ohne_wahl_und_kaputtes_log_geben_none(self):
        self.assertIsNone(A.sieger_zuerst(log("Anna#1", "First"), "OP17-039", "OP17-039"))
        self.assertIsNone(A.sieger_zuerst("", "OP17-039", "OP13-004"))
        self.assertIsNone(A.sieger_zuerst(None, "OP17-039", "OP13-004"))
        self.assertIsNone(A.sieger_zuerst(log("Zoe#9", "First"), "OP17-039", "OP13-004"))

    def test_zwischenspeicher_laedt_jedes_log_einmal(self):
        import tempfile
        docs = [replay("OP17-039", "OP13-004", pfad="Replays/x_" + "a" * 64 + ".log"),
                replay("OP17-039", "OP17-039", pfad="Replays/y_" + "b" * 64 + ".log")]
        geladen = []

        def fake(pfad, eimer):
            geladen.append(pfad)
            return log("Anna#1", "First")

        alt = A.log_anfang
        A.log_anfang = fake
        try:
            with tempfile.TemporaryDirectory() as ordner:
                datei = os.path.join(ordner, "tage", A.START_ZWISCHEN)
                erste = A.starts_ermitteln(docs, "eimer", datei)
                zweite = A.starts_ermitteln(docs, "eimer", datei)
        finally:
            A.log_anfang = alt
        self.assertEqual(geladen, [docs[0]["path"]])        # Mirror gar nicht, Rest einmal
        self.assertEqual(erste, zweite)
        self.assertEqual(erste[docs[0]["path"]], True)
        self.assertIsNone(erste[docs[1]["path"]])


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


def tag_docs(tag, partien, mit_neu, karte_neu="OP18-001", deck_alt="4xOP17-039"):
    """`partien` Replays an einem Tag, davon `mit_neu` mit einer Karte aus `karte_neu`."""
    return [replay("OP17-039", "OP13-004", zeit=f"{tag}T10:{n % 60:02d}:00",
                   sieger_deck=("4x" + karte_neu if n < mit_neu else deck_alt),
                   pfad=f"{tag}_{n}.log")
            for n in range(partien)]


class Formaterkennung(unittest.TestCase):
    def setUp(self):
        self.zustand = A.standard_zustand()
        self.alt = tag_docs("2026-10-28", 100, 0)

    def erkennen(self, *tage):
        return A.format_wechsel_erkennen(self.alt + [d for t in tage for d in t], self.zustand)

    def test_vier_prozent_loesen_nichts_aus(self):
        self.assertIsNone(self.erkennen(tag_docs("2026-10-29", 100, 4),
                                        tag_docs("2026-10-30", 100, 60)))

    def test_mischtag_dann_dreissig_prozent_folgetag(self):
        self.assertEqual(self.erkennen(tag_docs("2026-10-29", 100, 10),
                                       tag_docs("2026-10-30", 100, 30)),
                         ("2026-10-30", {"OP18"}))

    def test_folgetag_unter_dreissig_prozent_noch_kein_wechsel(self):
        self.assertIsNone(self.erkennen(tag_docs("2026-10-29", 100, 10),
                                        tag_docs("2026-10-30", 100, 29)))

    def test_umstellungstag_ohne_folgetag_noch_kein_wechsel(self):
        self.assertIsNone(self.erkennen(tag_docs("2026-10-29", 100, 40)))

    def test_starter_und_promos_zaehlen_nicht(self):
        docs = [tag_docs("2026-10-29", 100, 100, "ST30-001"),
                tag_docs("2026-10-30", 100, 100, "P-045")]
        self.assertIsNone(self.erkennen(*docs))

    def test_nicht_hoehere_sets_zaehlen_nicht(self):
        self.assertIsNone(self.erkennen(tag_docs("2026-10-29", 100, 100, "EB05-002"),
                                        tag_docs("2026-10-30", 100, 100, "OP16-001")))

    def test_andere_modi_zaehlen_nicht(self):
        docs = [dict(d, game_mode="1") for d in tag_docs("2026-10-29", 100, 100)]
        self.assertIsNone(self.erkennen(docs, tag_docs("2026-10-30", 100, 100)))

    def test_decks_als_liste_und_verlierer_seite(self):
        docs = [dict(d, winner_deck=["4xOP17-039"], loser_deck=["1xOP18-001"])
                for d in tag_docs("2026-10-29", 100, 0)]
        self.assertEqual(self.erkennen(docs, docs and [dict(d, timestamp="2026-10-30T10:00:00")
                                                       for d in docs]),
                         ("2026-10-30", {"OP18"}))

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
        self.docs = (tag_docs("2026-10-28", 50, 0) + tag_docs("2026-11-09", 50, 0)
                     + tag_docs("2026-11-10", 50, 10) + tag_docs("2026-11-11", 50, 40)
                     + tag_docs("2026-11-12", 50, 45))
        self.alt = A.standard_zustand()
        self.neu = A.format_wechsel_anwenden(self.ziel, self.docs, {}, self.alt)

    def test_neues_format(self):
        self.assertEqual((self.neu["start"], self.neu["sets"], self.neu["name"],
                          self.neu["schluessel"]),
                         ("2026-11-11", ["OP18"], "OP18 Standard", "Roh_mode_0_op18"))

    def test_neuer_satz_ab_dem_start(self):
        satz = A.replay_satz(self.docs, {}, self.neu)
        self.assertEqual(satz["partien"], 100)
        self.assertEqual(satz["name"], "OP18 Standard (from replays)")
        self.assertAlmostEqual(A.eb05_anteil(satz, "OP18"), 85 / 100)
        self.assertIsNone(A.eb05_warnung(satz, self.neu))

    def test_alter_satz_bis_zum_vortag_der_umstellung(self):
        alte = A.alte_saetze(self.ziel, self.neu)
        self.assertEqual(list(alte), ["Roh_mode_0_op17eb05_alt"])
        satz = alte["Roh_mode_0_op17eb05_alt"]
        self.assertEqual(satz["partien"], 100)      # 28.10. und 09.11., ohne den Mischtag
        self.assertEqual(satz["name"], "OP17 + EB05 format (old) (from replays)")
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
        self.assertIsNone(A.format_wechsel_erkennen(self.docs, self.neu))

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
