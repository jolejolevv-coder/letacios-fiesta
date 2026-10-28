"""Tests fuer das Setzen der Update Notice, siehe werkzeuge/notice_setzen.py."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import notice_setzen as N  # noqa: E402

UINF = '[gd_resource type="Resource" format=3]\n\n[resource]\nname = "x"\nseen_update_notice_v = "2.7.4"\nvolume = 0.5\n'


class Notice(unittest.TestCase):
    def test_gesehene_version(self):
        self.assertEqual(N.gesehene_version(UINF), "2.7.4")

    def test_fehlende_zeile(self):
        self.assertIsNone(N.gesehene_version("[resource]\n"))

    def test_nur_die_version_aendert_sich(self):
        neu = N.mit_version(UINF, "2.7.7")
        self.assertEqual(N.gesehene_version(neu), "2.7.7")
        self.assertEqual(neu.replace("2.7.7", "2.7.4"), UINF)

    def test_ohne_zeile_bleibt_alles(self):
        self.assertEqual(N.mit_version("[resource]\n", "2.7.7"), "[resource]\n")

    def test_version_aus_paket(self):
        with tempfile.NamedTemporaryFile("wb", suffix=".pck", delete=False) as datei:
            datei.write(b'\x00\x01var VERSION = "2.7.7"\n\x00\x02other "3.1.0"\n')
        try:
            self.assertEqual(N.paket_version(datei.name), "2.7.7")
        finally:
            os.remove(datei.name)

    def test_sicherung_neben_der_datei(self):
        with tempfile.TemporaryDirectory() as ordner:
            pfad = os.path.join(ordner, "uinf.tres")
            with open(pfad, "w", encoding="utf-8") as datei:
                datei.write(UINF)
            ziel = N.sichern(pfad)
            self.assertTrue(os.path.basename(ziel).startswith("uinf.tres.bak_"))
            with open(ziel, encoding="utf-8") as datei:
                self.assertEqual(datei.read(), UINF)


if __name__ == "__main__":
    unittest.main()
