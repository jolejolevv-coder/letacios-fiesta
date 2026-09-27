"""Tests fuer das Nachziehen der Spieldatei, siehe werkzeuge/spieldatei.py.

Der Server wird durch eine lokale Datei ersetzt: urllib liefert auch fuer file://
Adressen Groesse und Last-Modified, genau die beiden Werte der Kennung."""
import os
import pathlib
import shutil
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import spieldatei  # noqa: E402


class TestNachziehen(unittest.TestCase):
    def setUp(self):
        self.ordner = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.ordner)
        self.quelle = os.path.join(self.ordner, "server.pck")
        self.ziel = os.path.join(self.ordner, "spiel", "OPBounty.pck")
        self.kennung = os.path.join(self.ordner, "spieldatei.kennung")
        os.makedirs(os.path.dirname(self.ziel))
        self.server_schreiben(b"version eins" * 1000)

    def server_schreiben(self, inhalt):
        with open(self.quelle, "wb") as datei:
            datei.write(inhalt)

    def nachziehen(self, url=None):
        return spieldatei.nachziehen(url or pathlib.Path(self.quelle).as_uri(),
                                     self.ziel, self.kennung)

    def inhalt(self):
        with open(self.ziel, "rb") as datei:
            return datei.read()

    def test_fehlende_datei_wird_geladen(self):
        self.assertEqual(self.nachziehen(), "geladen")
        self.assertEqual(self.inhalt(), b"version eins" * 1000)

    def test_zweiter_lauf_laedt_nicht_noch_einmal(self):
        self.nachziehen()
        self.assertEqual(self.nachziehen(), "aktuell")

    def test_neue_version_auf_dem_server_wird_geladen(self):
        self.nachziehen()
        time.sleep(1.1)       # Last-Modified hat Sekundengenauigkeit
        self.server_schreiben(b"version zwei" * 1000)
        self.assertEqual(self.nachziehen(), "geladen")
        self.assertEqual(self.inhalt(), b"version zwei" * 1000)

    def test_halbe_datei_des_starters_wird_ersetzt(self):
        # Der Fall vom 26.09.2026: der Starter hat abgebrochen und 19 von 40 MB liegen
        # lassen, die Kennung passt aber.
        self.nachziehen()
        with open(self.ziel, "r+b") as datei:
            datei.truncate(100)
        self.assertEqual(self.nachziehen(), "geladen")
        self.assertEqual(len(self.inhalt()), 12000)

    def test_fehlschlag_laesst_die_datei_unberuehrt(self):
        self.nachziehen()
        vorher = self.inhalt()
        falsch = pathlib.Path(self.ordner, "gibt_es_nicht.pck").as_uri()
        with self.assertRaises(OSError):
            self.nachziehen(falsch)
        self.assertEqual(self.inhalt(), vorher)
        self.assertFalse(os.path.exists(self.ziel + ".neu"))

    def test_zu_kurzer_download_kommt_nicht_an_den_platz(self):
        self.nachziehen()
        vorher = self.inhalt()
        echt = spieldatei.server_kennung
        spieldatei.server_kennung = lambda url: (99999, "anders")
        self.addCleanup(setattr, spieldatei, "server_kennung", echt)
        with self.assertRaises(OSError):
            self.nachziehen()
        self.assertEqual(self.inhalt(), vorher)
        self.assertFalse(os.path.exists(self.ziel + ".neu"))


class TestMussLaden(unittest.TestCase):
    def test_ohne_gemerkte_kennung_wird_geladen(self):
        self.assertTrue(spieldatei.muss_laden((10, "a"), None, 10))

    def test_gleiche_kennung_und_volle_groesse_heisst_aktuell(self):
        self.assertFalse(spieldatei.muss_laden((10, "a"), (10, "a"), 10))


if __name__ == "__main__":
    unittest.main()
