"""Tests fuer das Ablesen der Bestenliste, siehe werkzeuge/bestenliste_ocr.py.

Tesseract selbst wird nicht getestet; geprueft wird alles, was aus seinen Lesungen
einen Eintrag macht oder einen falschen verwirft."""
import os
import sys
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import bestenliste_ocr as O  # noqa: E402


def eintrag(rang, bounty, name="x"):
    return {"rang": rang, "name": name, "bounty": bounty, "leader": [], "unsicher": []}


class Felder(unittest.TestCase):
    def test_bounty_aus_text(self):
        self.assertEqual(O.bounty_aus("B$ 7593.4 million"), 7593.4)
        self.assertEqual(O.bounty_aus("B 7304 million"), 7304.0)
        self.assertIsNone(O.bounty_aus("B$ million"))

    def test_winrate_nur_im_bereich(self):
        self.assertEqual(O.wr_aus("86.7%"), 86.7)
        self.assertEqual(O.wr_aus("0%"), 0.0)
        self.assertIsNone(O.wr_aus("526%"))    # am 20.10. als 52.6% gemeint
        self.assertIsNone(O.wr_aus("%"))


class Bountyreihe(unittest.TestCase):
    def test_ausreisser_nach_oben_wird_geleert(self):
        # 6738.7 als 8738.7 gelesen, so am 20.10.2026 im Probelauf
        e = [eintrag(4, 7042.0), eintrag(5, 8738.7), eintrag(6, 6281.7)]
        O.bounty_pruefen(e)
        self.assertIsNone(e[1]["bounty"])
        self.assertIn("bounty", e[1]["unsicher"])
        self.assertEqual(e[0]["bounty"], 7042.0)
        self.assertEqual(e[2]["bounty"], 6281.7)

    def test_ausreisser_nach_unten_wird_geleert(self):
        e = [eintrag(1, 7000.0), eintrag(2, 1000.0), eintrag(3, 6500.0)]
        O.bounty_pruefen(e)
        self.assertIsNone(e[1]["bounty"])

    def test_fallende_reihe_bleibt(self):
        e = [eintrag(i, 7000.0 - i) for i in range(1, 6)]
        O.bounty_pruefen(e)
        self.assertTrue(all(x["bounty"] is not None for x in e))


class Namen(unittest.TestCase):
    def test_bekannter_name_bekommt_id_und_schreibweise(self):
        e = [eintrag(1, 1.0, "Anestisx"), eintrag(2, 1.0, "voellig neu")]
        alt = [{"name": "AnestisX", "login": "anestis", "user_id": 7}]
        O.namen_zuordnen(e, alt, {})
        self.assertEqual(e[0]["name"], "AnestisX")
        self.assertEqual(e[0]["user_id"], 7)
        self.assertEqual(e[0]["login"], "anestis")
        self.assertNotIn("user_id", e[1])
        self.assertEqual(e[1]["login"], "voellig neu")

    def test_gegner_aus_partien_liefern_id(self):
        e = [eintrag(1, 1.0, "nanania")]
        O.namen_zuordnen(e, [], {"nanana": 42})
        self.assertEqual(e[0]["user_id"], 42)
        self.assertEqual(e[0]["name"], "nanana")


class Zeilen(unittest.TestCase):
    def foto(self, versatz):
        """Ein kuenstliches Foto im Aufbau der Liste: dunkle Zeilen, graue Trennlinien."""
        bild = Image.new("RGB", (1920, 1006), (16, 16, 16))
        d = ImageDraw.Draw(bild)
        y = 184 + versatz
        while y < 860:
            d.rectangle((0, y, 1919, y + 4), fill=(41, 41, 41))   # 5 Pixel wie im Spiel
            y += 34 if (y // 34) % 2 else 35
        return bild

    def test_trennlinien_ergeben_neunzehn_zeilen(self):
        oben = O.trennlinien_zeilen(self.foto(0))
        self.assertEqual(len(oben), O.SICHTBARE_ZEILEN)
        self.assertEqual(oben[0], 186)

    def test_verschobenes_raster_nach_dem_scrollen(self):
        oben = O.trennlinien_zeilen(self.foto(11))
        self.assertEqual(oben[0], 197)

    def test_ohne_trennlinien_gilt_das_feste_raster(self):
        leer = Image.new("RGB", (1920, 1006), (16, 16, 16))
        self.assertEqual(O.zeilen_oben(leer)[:2], [186, 220])


if __name__ == "__main__":
    unittest.main()
