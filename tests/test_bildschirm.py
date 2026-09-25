"""Tests fuer den Bildvergleich vor jedem Klick, siehe werkzeuge/bildschirm.py."""
import os
import shutil
import sys
import tempfile
import unittest

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import bildschirm  # noqa: E402

# Ein kuenstliches Fenster: schwarzer Grund, ein roter "Knopf" an bekannter Stelle.
FENSTER = (400, 300)
KNOPF_BOX = [50, 60, 150, 90]
STELLEN = {"knopf": {"box": KNOPF_BOX, "klick": [100, 75]}}


def fenster_mit_knopf(farbe=(200, 30, 30), versatz=0):
    bild = Image.new("RGB", FENSTER, (0, 0, 0))
    links, oben, rechts, unten = KNOPF_BOX
    bild.paste(farbe, (links + versatz, oben, rechts + versatz, unten))
    return bild


class TestMitKuenstlichemFenster(unittest.TestCase):
    def setUp(self):
        self.ordner = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.ordner)
        fenster_mit_knopf().crop(KNOPF_BOX).save(os.path.join(self.ordner, "knopf.png"))

    def passt(self, foto):
        return bildschirm.passt(foto, "knopf", STELLEN, self.ordner)

    def test_gleiches_bild_passt(self):
        self.assertTrue(self.passt(fenster_mit_knopf()))

    def test_leeres_fenster_passt_nicht(self):
        self.assertFalse(self.passt(Image.new("RGB", FENSTER, (0, 0, 0))))

    def test_andere_farbe_passt_nicht(self):
        self.assertFalse(self.passt(fenster_mit_knopf(farbe=(30, 30, 200))))

    def test_verschobener_knopf_passt_nicht(self):
        # Genau der Fall, den der Probelauf gezeigt hat: das Fenster liegt woanders.
        self.assertFalse(self.passt(fenster_mit_knopf(versatz=40)))

    def test_zu_kleines_fenster_ist_nie_ein_treffer(self):
        # Im Menue ist das Spielfenster nur 225 Pixel breit. Eine Stelle ausserhalb
        # davon darf nicht als Treffer gelten.
        self.assertFalse(self.passt(Image.new("RGB", (100, 50), (200, 30, 30))))

    def test_finde_liefert_none_ohne_treffer(self):
        leer = Image.new("RGB", FENSTER, (0, 0, 0))
        self.assertIsNone(bildschirm.finde(leer, ["knopf"], STELLEN, self.ordner))

    def test_variante_wird_erkannt(self):
        # Der Knopf im Fokuszustand: hellere Farbe, eigene Referenz knopf__fokus.png.
        hell = fenster_mit_knopf(farbe=(250, 120, 120))
        self.assertFalse(self.passt(hell))
        hell.crop(KNOPF_BOX).save(os.path.join(self.ordner, "knopf__fokus.png"))
        self.assertTrue(self.passt(hell))
        self.assertTrue(self.passt(fenster_mit_knopf()), "Grundform bleibt gueltig")

    def test_variante_einer_anderen_stelle_zaehlt_nicht(self):
        # knopfleiste__x.png gehoert nicht zu "knopf", obwohl der Name so beginnt.
        hell = fenster_mit_knopf(farbe=(250, 120, 120))
        hell.crop(KNOPF_BOX).save(os.path.join(self.ordner, "knopfleiste__x.png"))
        self.assertFalse(self.passt(hell))

    def test_falsche_referenz_verhindert_den_klick(self):
        # Abnahmekriterium: mit absichtlich falschem Referenzbild wird nicht geklickt.
        Image.new("RGB", (100, 30), (0, 255, 0)).save(os.path.join(self.ordner, "knopf.png"))
        self.assertIsNone(bildschirm.finde(fenster_mit_knopf(), ["knopf"], STELLEN, self.ordner))


class TestEchteKlickstellen(unittest.TestCase):
    """Die abgelegten Referenzen aus dem Probelauf vom 25.09.2026."""

    def setUp(self):
        self.stellen = bildschirm.stellen_laden()

    def test_jede_stelle_hat_eine_referenz_in_passender_groesse(self):
        for name, stelle in self.stellen.items():
            links, oben, rechts, unten = stelle["box"]
            for pfad in bildschirm.referenzdateien(name):
                with Image.open(pfad) as ref:
                    self.assertEqual(ref.size, (rechts - links, unten - oben), pfad)

    def test_klickpunkt_liegt_in_der_box(self):
        for name, stelle in self.stellen.items():
            links, oben, rechts, unten = stelle["box"]
            x, y = stelle["klick"]
            self.assertTrue(links <= x < rechts and oben <= y < unten, name)

    def test_referenz_passt_nur_an_ihrer_stelle(self):
        grund = Image.new("RGB", (1920, 1080), (10, 10, 30))
        for name, stelle in self.stellen.items():
            foto = grund.copy()
            with Image.open(os.path.join(bildschirm.REFERENZEN, name + ".png")) as ref:
                foto.paste(ref.convert("RGB"), tuple(stelle["box"][:2]))
            self.assertTrue(bildschirm.passt(foto, name, self.stellen), name)
            self.assertFalse(bildschirm.passt(grund, name, self.stellen), name)


if __name__ == "__main__":
    unittest.main()
