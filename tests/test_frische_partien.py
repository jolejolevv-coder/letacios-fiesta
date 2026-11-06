"""Tests fuer das Auffrischen der Spielerseiten aus den Replays, siehe frische_partien.py."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import frische_partien as F  # noqa: E402

# So beginnen die Logs, mit dem unsichtbaren Zeichen im Namen (20.10.2026, Rang 3).
LOG = ('[AKUMA​#7749] Leader is Sabo [<mark><link="OP13-004">OP13-004</link></mark>]\n'
       '[himm​#7921] Leader is Boa Hancock [<mark><link="OP14-041">OP14-041</link></mark>]\n')
MIRROR = ('[a#1] Leader is Rocks [<mark><link="OP17-039">OP17-039</link></mark>]\n'
          '[himm#7921] Leader is Rocks [<mark><link="OP17-039">OP17-039</link></mark>]\n')


def doc(pfad, sieger, verlierer, wb=7000.0, lb=5000.0):
    return {"path": pfad, "timestamp": "2026-10-20T07:21:00", "game_mode": "0",
            "winner_leader": sieger, "loser_leader": verlierer,
            "winner_bounty": wb, "loser_bounty": lb,
            "winner_deck": "1xOP13-004\r\n4xOP01-016", "loser_deck": "1xOP14-041\r\n4xOP14-060"}


class Namen(unittest.TestCase):
    def test_log_spieler_ohne_unsichtbares_zeichen(self):
        self.assertEqual(F.log_spieler(LOG), [("AKUMA#7749", "OP13-004"), ("himm#7921", "OP14-041")])

    def test_ingame_name_ueber_den_eigenen_leader(self):
        self.assertEqual(F.ingame_name({"eigener_leader": "OP14-041"}, LOG), "himm#7921")

    def test_im_mirror_kein_name(self):
        self.assertIsNone(F.ingame_name({"eigener_leader": "OP17-039"}, MIRROR))


class Zuordnen(unittest.TestCase):
    def test_partie_aus_einem_replay(self):
        d = doc("R/1.log", "OP13-004", "OP14-041")
        neu = F.zuordnen([d], {"R/1.log": LOG}, {"himm#7921": "132161"})
        p = neu["132161"][0]
        self.assertFalse(p["gewonnen"])
        self.assertEqual(p["eigener_leader"], "OP14-041")
        self.assertEqual(p["gegner"], "AKUMA")
        self.assertEqual(p["deck"], ["OP14-041", "4xOP14-060"])
        self.assertEqual(p["quelle"], "replay")

    def test_mirror_ueber_die_bounty(self):
        d = doc("R/2.log", "OP17-039", "OP17-039", wb=7290.0, lb=4100.0)
        neu = F.zuordnen([d], {"R/2.log": MIRROR}, {"himm#7921": "132161"}, {"132161": 7304.0})
        self.assertTrue(neu["132161"][0]["gewonnen"])

    def test_mirror_ohne_klare_bounty_bleibt_weg(self):
        d = doc("R/3.log", "OP17-039", "OP17-039", wb=7300.0, lb=7310.0)
        neu = F.zuordnen([d], {"R/3.log": MIRROR}, {"himm#7921": "132161"}, {"132161": 7304.0})
        self.assertEqual(neu, {})


class Mischen(unittest.TestCase):
    def test_ohne_doppel_neueste_zuerst(self):
        alt = [{"zeit": "2026-10-14T11:27", "replay": "R/a.log"}]
        neu = [{"zeit": "2026-10-20T07:21", "replay": "R/b.log"},
               {"zeit": "2026-10-14T11:27", "replay": "R/a.log"}]
        aus = F.mischen(alt, neu)
        self.assertEqual([p["replay"] for p in aus], ["R/b.log", "R/a.log"])

    def test_sieg_ohne_deck_bekommt_die_letzte_liste_mit_datum(self):
        alt = [{"zeit": "2026-10-14T11:27", "replay": "R/a", "eigener_leader": "OP14-041",
                "deck": ["OP14-041", "4xOP14-060"]}]
        neu = [{"zeit": "2026-10-20T07:21", "replay": "R/b", "eigener_leader": "OP14-041", "deck": []}]
        aus = F.mischen(alt, neu)
        self.assertEqual(aus[0]["deck"], ["OP14-041", "4xOP14-060"])
        self.assertEqual(aus[0]["deck_von"], "2026-10-14T11:27")

    def test_hoechstens_so_viele_wie_erlaubt(self):
        neu = [{"zeit": f"2026-10-{i:02d}", "replay": f"R/{i}"} for i in range(1, 31)]
        self.assertEqual(len(F.mischen([], neu)), F.PARTIEN_JE_SPIELER)


class Gegner(unittest.TestCase):
    def test_gegner_name_ueber_seinen_leader(self):
        self.assertEqual(F.gegner_name({"gegner_leader": "OP13-004"}, LOG), "AKUMA#7749")

    def test_gegner_im_mirror_kein_name(self):
        self.assertIsNone(F.gegner_name({"gegner_leader": "OP17-039"}, MIRROR))

    def test_belege_mit_gegner(self):
        p = {"replay": "R/1", "eigener_leader": "OP14-041", "gegner_leader": "OP13-004", "gegner_id": 999}
        belege = F.belege_sammeln([("132161", p)], {"R/1": LOG})
        self.assertEqual(belege, [("himm#7921", "132161"), ("AKUMA#7749", "999")])

    def test_ohne_gegner_id_nur_der_inhaber(self):
        p = {"replay": "R/1", "eigener_leader": "OP14-041", "gegner_leader": "OP13-004"}
        self.assertEqual(F.belege_sammeln([("132161", p)], {"R/1": LOG}), [("himm#7921", "132161")])

    def test_eindeutig(self):
        belege = [("a#1", "1"), ("a#1", "1"), ("b#2", "2")]
        self.assertEqual(F.belege_eindeutig(belege), {"a#1": "1", "b#2": "2"})

    def test_name_mit_zwei_ids_faellt_weg(self):
        self.assertEqual(F.belege_eindeutig([("You#1", "1"), ("You#1", "2"), ("b#2", "3")]), {"b#2": "3"})

    def test_id_mit_zwei_namen_behaelt_beide(self):
        # Umbenennung: alte und neue Partien sollen beide zugeordnet werden.
        self.assertEqual(F.belege_eindeutig([("a#1", "1"), ("c#3", "1")]), {"a#1": "1", "c#3": "1"})


SCHNAPP, BOUNTY = F.QUELLE_SCHNAPPSCHUSS, F.QUELLE_BOUNTY


class Gedaechtnis(unittest.TestCase):
    def test_neuer_name_kommt_dazu(self):
        g = F.gedaechtnis_leer()
        z = F.namen_einpflegen(g, {"himm#7921": 132161}, SCHNAPP, "2026-11-06")
        self.assertEqual(z["neu"], 1)
        self.assertEqual(F.namen_aus_gedaechtnis(g), {"himm#7921": "132161"})

    def test_bekannter_name_bleibt_ohne_doppelzaehlung(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"himm#7921": "1"}, SCHNAPP, "2026-11-05")
        z = F.namen_einpflegen(g, {"himm#7921": "1"}, SCHNAPP, "2026-11-06")
        self.assertEqual(z, {"neu": 0, "korrigiert": 0, "konflikte": 0})
        self.assertEqual(g["namen"]["himm#7921"]["seit"], "2026-11-05")

    def test_widerspruch_zweier_belege_sperrt_den_namen(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"You#1": "1"}, SCHNAPP, "2026-11-05")
        z = F.namen_einpflegen(g, {"You#1": "2"}, SCHNAPP, "2026-11-06")
        self.assertEqual(z["konflikte"], 1)
        self.assertEqual(F.namen_aus_gedaechtnis(g), {})
        F.namen_einpflegen(g, {"You#1": "1"}, SCHNAPP, "2026-11-07")
        self.assertEqual(F.namen_aus_gedaechtnis(g), {}, "gesperrt bleibt gesperrt")

    def test_beleg_korrigiert_schaetzung(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"a#1": "1"}, BOUNTY, "2026-11-05")
        z = F.namen_einpflegen(g, {"a#1": "2"}, SCHNAPP, "2026-11-06")
        self.assertEqual(z["korrigiert"], 1)
        self.assertEqual(g["namen"]["a#1"], {"uid": "2", "quelle": SCHNAPP, "seit": "2026-11-06"})

    def test_schaetzung_ueberstimmt_keinen_beleg(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"a#1": "1"}, SCHNAPP, "2026-11-05")
        z = F.namen_einpflegen(g, {"a#1": "2"}, BOUNTY, "2026-11-06")
        self.assertEqual(z, {"neu": 0, "korrigiert": 0, "konflikte": 0})
        self.assertEqual(F.namen_aus_gedaechtnis(g), {"a#1": "1"})

    def test_beleg_bestaetigt_schaetzung(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"a#1": "1"}, BOUNTY, "2026-11-05")
        F.namen_einpflegen(g, {"a#1": "1"}, SCHNAPP, "2026-11-06")
        self.assertEqual(g["namen"]["a#1"]["quelle"], SCHNAPP)


class GedaechtnisDatei(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.ordner = tempfile.TemporaryDirectory()
        self.pfad = os.path.join(self.ordner.name, "namen.json.gz.enc")
        self.schl = bytes(32)

    def tearDown(self):
        self.ordner.cleanup()

    def test_ohne_datei_leer(self):
        self.assertEqual(F.gedaechtnis_laden(self.schl, self.pfad), F.gedaechtnis_leer())

    def test_hin_und_zurueck(self):
        g = F.gedaechtnis_leer()
        F.namen_einpflegen(g, {"himm#7921": "1"}, SCHNAPP, "2026-11-06")
        self.assertTrue(F.gedaechtnis_speichern(g, self.schl, self.pfad))
        self.assertEqual(F.gedaechtnis_laden(self.schl, self.pfad), g)

    def test_unveraendert_wird_nicht_neu_geschrieben(self):
        g = F.gedaechtnis_leer()
        F.gedaechtnis_speichern(g, self.schl, self.pfad)
        with open(self.pfad, "rb") as datei:
            vorher = datei.read()
        self.assertFalse(F.gedaechtnis_speichern(g, self.schl, self.pfad))
        with open(self.pfad, "rb") as datei:
            self.assertEqual(datei.read(), vorher)

    def test_falscher_schluessel_beginnt_leer(self):
        F.gedaechtnis_speichern({"namen": {}, "gesperrt": ["x"]}, self.schl, self.pfad)
        alt = F.GEDAECHTNIS
        F.GEDAECHTNIS = self.pfad
        try:
            self.assertEqual(F.gedaechtnis_sicher_laden(b"\x01" * 32), F.gedaechtnis_leer())
        finally:
            F.GEDAECHTNIS = alt


if __name__ == "__main__":
    unittest.main()
