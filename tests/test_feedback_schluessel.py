"""Tests fuer werkzeuge/feedback_schluessel.py."""
import gzip
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import feedback_schluessel as F  # noqa: E402


class Schluessel(unittest.TestCase):
    def test_schreibt_datei(self):
        with tempfile.TemporaryDirectory() as ziel:
            pfad = F.schreiben(ziel, "abc")
            with gzip.open(pfad) as datei:
                self.assertEqual(json.loads(datei.read()), {"schluessel": "abc"})

    def test_ohne_variable_keine_datei(self):
        with tempfile.TemporaryDirectory() as ziel, \
                mock.patch.dict(os.environ, {"WEB3FORMS_KEY": ""}), \
                mock.patch.object(sys, "argv", ["x", "--ziel", ziel]):
            self.assertEqual(F.main(), 0)
            self.assertFalse(os.path.exists(os.path.join(ziel, F.DATEI)))


if __name__ == "__main__":
    unittest.main()
