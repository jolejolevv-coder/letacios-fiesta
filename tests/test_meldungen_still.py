"""Tests fuer das Schliessen der Desktop Meldungen, siehe werkzeuge/meldungen_still.py.

Ohne DBus: gi wird durch einen Nachbau ersetzt, der Bus durch FalscherBus.
"""
import os
import sys
import types
import unittest


class FalscherFehler(Exception):
    pass


def gi_nachbauen():
    """Ein gi Modul mit genau dem, was meldungen_still.py beim Import braucht."""
    glib = types.SimpleNamespace(Error=FalscherFehler,
                                 Variant=lambda typ, werte: werte,
                                 VariantType=lambda typ: typ)
    gio = types.SimpleNamespace(DBusCallFlags=types.SimpleNamespace(NONE=0))
    repository = types.ModuleType("gi.repository")
    repository.Gio, repository.GLib = gio, glib
    gi = types.ModuleType("gi")
    gi.repository = repository
    sys.modules.setdefault("gi", gi)
    sys.modules.setdefault("gi.repository", repository)


gi_nachbauen()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "werkzeuge"))
import meldungen_still as M  # noqa: E402


class Antwort:
    def __init__(self, werte):
        self.werte = werte

    def unpack(self):
        return self.werte


class FalscherBus:
    """Meldungsdienst mit fortlaufenden Kennungen, wie Plasma."""

    def __init__(self, offen, fehler_bei=()):
        self.offen = set(offen)
        self.naechste = max(offen, default=0) + 1
        self.fehler_bei = set(fehler_bei)
        self.geschlossen = []

    def call_sync(self, dienst, pfad, schnittstelle, methode, parameter, *rest):
        if methode == "Notify":
            kennung = self.naechste
            self.naechste += 1
            self.offen.add(kennung)
            return Antwort((kennung,))
        if methode == "CloseNotification":
            (kennung,) = parameter
            if kennung in self.fehler_bei:
                raise FalscherFehler("abgelehnt")
            self.offen.discard(kennung)
            self.geschlossen.append(kennung)
            return None
        if methode == "Inhibit":
            return Antwort((1,))
        raise AssertionError(methode)


class Meldungen(unittest.TestCase):
    def test_erste_runde_schliesst_alle_samt_probe(self):
        bus = FalscherBus(offen=[3, 5, 6])
        bis = M.nachschauen(bus, 0)
        self.assertEqual(bis, 7)
        self.assertEqual(bus.offen, set())

    def test_nachschau_nur_neue_kennungen(self):
        bus = FalscherBus(offen=[1, 2])
        bis = M.nachschauen(bus, 0)
        bus.offen.add(bus.naechste)
        bus.naechste += 1
        bus.geschlossen.clear()
        M.nachschauen(bus, bis)
        self.assertEqual(bus.geschlossen, [bis + 1, bis + 2])
        self.assertEqual(bus.offen, set())

    def test_abgelehnte_kennung_haelt_nicht_auf(self):
        bus = FalscherBus(offen=[1, 2, 3], fehler_bei=[2])
        self.assertEqual(M.alle_schliessen(bus, 1, 3), 2)
        self.assertEqual(bus.offen, {2})

    def test_sperren_liefert_cookie(self):
        self.assertEqual(M.meldungen_sperren(FalscherBus(offen=[])), 1)


if __name__ == "__main__":
    unittest.main()
