"""Tests fuer update_log.py, ohne Netz."""
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import update_log as U  # noqa: E402

BEISPIEL = os.path.join(os.path.dirname(__file__), "beispiele", "discord_nachrichten.json")


def nachrichten():
    with open(BEISPIEL, encoding="utf-8") as datei:
        return json.load(datei)


class Meldung(unittest.TestCase):
    def test_version_und_text(self):
        m = U.meldung(nachrichten()[0])
        self.assertEqual(m["version"], "2.7.8")
        self.assertTrue(m["text"].startswith("# We are back!"))

    def test_text_aus_embed(self):
        m = U.meldung(nachrichten()[1])
        self.assertEqual(m["text"], "Maintenance\nServer restart in 10 minutes")
        self.assertIsNone(m["version"])

    def test_erste_zeile_ohne_markdown(self):
        self.assertEqual(U.erste_zeile("\n# We are back! 🔥\nmehr"), "We are back! 🔥")
        self.assertEqual(U.erste_zeile("**OPBounty v2.7.7** is live"), "OPBounty v2.7.7 is live")

    def test_wichtig(self):
        self.assertTrue(U.ist_wichtig("mapped to EB05 queues"))
        self.assertTrue(U.ist_wichtig("updated to v2.7.8"))
        self.assertTrue(U.ist_wichtig("OP18 presale"))
        self.assertFalse(U.ist_wichtig("Server restart in 10 minutes"))


class Zusammenfuehren(unittest.TestCase):
    def test_nur_unbekannte_und_neueste_zuerst(self):
        alle = [U.meldung(n) for n in nachrichten()]
        liste, unbekannt = U.zusammenfuehren(alle[1:], alle)
        self.assertEqual([m["id"] for m in unbekannt], [alle[0]["id"]])
        self.assertEqual(liste[0]["id"], alle[0]["id"])
        self.assertEqual(len(liste), 3)

    def test_obergrenze(self):
        viele = [{"id": str(i), "zeit": "", "version": None, "text": ""} for i in range(30)]
        liste, _ = U.zusammenfuehren([], viele)
        self.assertEqual(len(liste), U.BEHALTEN)
        self.assertEqual(liste[0]["id"], "29")


class Lauf(unittest.TestCase):
    def lauf(self, ziel, env, holen=None):
        aus = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=False), \
             mock.patch.object(sys, "argv", ["update_log.py", "--ziel", ziel]), \
             mock.patch.object(U, "nachrichten_holen", holen or (lambda t, k: nachrichten())), \
             redirect_stdout(aus):
            U.main()
        return aus.getvalue()

    def setUp(self):
        self.ziel = tempfile.mkdtemp()
        self.env = {"DISCORD_BOT_TOKEN": "x", "DISCORD_KANAL_ID": "1"}

    def test_ohne_token_nur_warnung(self):
        aus = self.lauf(self.ziel, {"DISCORD_BOT_TOKEN": "", "DISCORD_KANAL_ID": ""})
        self.assertIn("::warning::DISCORD_BOT_TOKEN", aus)
        self.assertFalse(os.path.exists(os.path.join(self.ziel, U.DATEI)))

    def test_discord_fehler_nur_warnung(self):
        def kaputt(t, k):
            raise OSError("503")
        aus = self.lauf(self.ziel, self.env, kaputt)
        self.assertIn("::warning::Discord nicht erreichbar", aus)

    def test_erster_lauf_still_danach_genau_einmal(self):
        alt = nachrichten()[1:]
        erster = self.lauf(self.ziel, self.env, lambda t, k: alt)
        self.assertNotIn("::warning::", erster)
        zweiter = self.lauf(self.ziel, self.env)
        self.assertEqual(zweiter.count("::warning::"), 1)
        self.assertIn("We are back! OPBounty has been updated to v2.7.8", zweiter)
        dritter = self.lauf(self.ziel, self.env)
        self.assertNotIn("::warning::", dritter)
        with open(os.path.join(self.ziel, U.DATEI), encoding="utf-8") as datei:
            self.assertEqual(len(json.load(datei)), 3)


if __name__ == "__main__":
    unittest.main()
