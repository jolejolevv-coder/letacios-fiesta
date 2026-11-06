"""Tests fuer das offene Feld `start` in schluessel.json (specs/features/ladepfad-handy.md)."""
import gzip
import json
import os
import shutil
import sys
import tempfile
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# start_datei braucht keine Kryptografie. Fehlt das Paket lokal, reicht ein Platzhalter,
# damit der Import gelingt; die Action installiert das echte Paket.
try:
    import cryptography.hazmat.primitives.ciphers.aead  # noqa: F401
except ImportError:
    for name in ["cryptography", "cryptography.hazmat", "cryptography.hazmat.primitives",
                 "cryptography.hazmat.primitives.ciphers"]:
        sys.modules.setdefault(name, types.ModuleType(name))
    aead = types.ModuleType("cryptography.hazmat.primitives.ciphers.aead")
    aead.AESGCM = object
    sys.modules["cryptography.hazmat.primitives.ciphers.aead"] = aead
import verschluesseln as V  # noqa: E402


def verzeichnis_schreiben(ziel, inhalt):
    with gzip.open(os.path.join(ziel, "verzeichnis.json.gz"), "wt", encoding="utf-8") as datei:
        json.dump(inhalt, datei)


class StartDatei(unittest.TestCase):
    def setUp(self):
        self.ziel = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.ziel)

    def test_start_aus_dem_verzeichnis(self):
        verzeichnis_schreiben(self.ziel, {"start": "B", "saetze": [
            {"schluessel": "A", "datei": "saetze/A.json.gz"},
            {"schluessel": "B", "datei": "saetze/B.json.gz"}]})
        self.assertEqual(V.start_datei(self.ziel), "saetze/B.json.gz")

    def test_ohne_start_kein_feld(self):
        verzeichnis_schreiben(self.ziel, {"saetze": [{"schluessel": "A", "datei": "saetze/A.json.gz"}]})
        self.assertIsNone(V.start_datei(self.ziel))

    def test_fremder_dateiname_kein_feld(self):
        verzeichnis_schreiben(self.ziel, {"start": "A", "saetze": [
            {"schluessel": "A", "datei": "../geheim.json"}]})
        self.assertIsNone(V.start_datei(self.ziel))

    def test_ohne_verzeichnis_kein_feld(self):
        self.assertIsNone(V.start_datei(self.ziel))


if __name__ == "__main__":
    unittest.main()
