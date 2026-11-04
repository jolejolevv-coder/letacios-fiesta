#!/usr/bin/env python3
"""Desktop Meldungen fuer die Dauer des Mitschnitts schliessen und fernhalten.

Am 04.11.2026 scheiterte das Systemupdate des Bazzite (uupd) um 04:15 viermal und
hinterliess vier Meldungen rechts unten. Plasma laesst Meldungen stehen, solange niemand
am Rechner ist; um 06:30 lagen sie noch ueber dem Knopf "naechste Seite", der Mitschnitt
erkannte die offene Bestenliste nicht und brach nach 300 Sekunden ab. Ausserdem verdecken
sie die rechte Spalte der Liste, die die OCR liest.

Dieses Werkzeug
  1. bittet den Meldungsdienst per Inhibit, keine neuen Meldungen zu zeigen,
  2. schliesst alle stehenden Meldungen (CloseNotification fuer jede Kennung bis zur
     hoechsten; die hoechste liefert eine Probemeldung, die gleich mitgeschlossen wird),
  3. schliesst bis zu seinem Ende alle NACHSCHAU_SEKUNDEN die inzwischen neuen. Plasma
     zeigt Meldungen der Dringlichkeit "critical" trotz Inhibit (im Test am 04.11.2026).
Inhibit gilt nur, solange dieser Prozess am Bus haengt; mit seinem Ende, per SIGTERM aus
`aufraeumen`, zeigt Plasma wieder Meldungen.

    python3 werkzeuge/meldungen_still.py &   # im Mitschnitt, aufraeumen beendet es

Geschlossene Meldungen sind auch aus dem Verlauf von Plasma weg. Ein Fehler hier bricht
den Mitschnitt nicht ab, er kostet hoechstens freie Sicht.
"""
import sys

from gi.repository import Gio, GLib

DIENST = "org.freedesktop.Notifications"
PFAD = "/org/freedesktop/Notifications"
SCHNITTSTELLE = "org.freedesktop.Notifications"
ABSENDER = "mitschnitt"
GRUND = "Bestenliste wird fotografiert"
DBUS_FRIST_MS = 5000
PROBE_DAUER_MS = 1        # die Probemeldung soll sofort verfallen
NACHSCHAU_SEKUNDEN = 10   # so oft werden waehrend des Laufs neue Meldungen geschlossen


def aufrufen(bus, methode, parameter, antwort_typ=None):
    """Eine Methode des Meldungsdienstes aufrufen und das Ergebnis entpacken."""
    ergebnis = bus.call_sync(DIENST, PFAD, SCHNITTSTELLE, methode, parameter,
                             GLib.VariantType(antwort_typ) if antwort_typ else None,
                             Gio.DBusCallFlags.NONE, DBUS_FRIST_MS, None)
    return ergebnis.unpack() if ergebnis is not None else ()


def meldungen_sperren(bus) -> int:
    """Neue Meldungen fernhalten, solange dieser Prozess laeuft. Gibt das Cookie zurueck."""
    (cookie,) = aufrufen(bus, "Inhibit",
                         GLib.Variant("(ssa{sv})", (ABSENDER, GRUND, {})), "(u)")
    return cookie


def hoechste_kennung(bus) -> int:
    """Die naechste freie Kennung des Dienstes, ermittelt ueber eine Probemeldung."""
    (kennung,) = aufrufen(bus, "Notify", GLib.Variant(
        "(susssasa{sv}i)",
        (ABSENDER, 0, "", "Mitschnitt", "", [], {}, PROBE_DAUER_MS)), "(u)")
    return kennung


def alle_schliessen(bus, von: int, bis: int) -> int:
    """CloseNotification fuer jede Kennung von `von` bis `bis`. Unbekannte Kennungen
    ignoriert der Dienst. Gibt die Zahl der Aufrufe zurueck, die ohne Fehler durchgingen."""
    geschlossen = 0
    for kennung in range(von, bis + 1):
        try:
            aufrufen(bus, "CloseNotification", GLib.Variant("(u)", (kennung,)))
            geschlossen += 1
        except GLib.Error:
            pass
    return geschlossen


def nachschauen(bus, zuletzt: int) -> int:
    """Alle Meldungen schliessen, die seit Kennung `zuletzt` neu sind. Gibt die neue
    hoechste Kennung zurueck."""
    bis = hoechste_kennung(bus)
    alle_schliessen(bus, zuletzt + 1, bis)
    return bis


def still_halten(bus, zuletzt: int):
    """Bis zum Ende des Prozesses regelmaessig nachschauen. SIGTERM beendet den Prozess
    auf dem ueblichen Weg, damit faellt auch Inhibit."""
    stand = {"zuletzt": zuletzt}

    def runde():
        try:
            stand["zuletzt"] = nachschauen(bus, stand["zuletzt"])
        except GLib.Error as fehler:
            print(f"  Nachschau ging nicht: {fehler.message}", file=sys.stderr)
        return True  # weiter im Takt

    GLib.timeout_add_seconds(NACHSCHAU_SEKUNDEN, runde)
    GLib.MainLoop().run()


def main() -> int:
    try:
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        meldungen_sperren(bus)
        bis = nachschauen(bus, 0)
    except GLib.Error as fehler:
        print(f"  Meldungen nicht geschlossen: {fehler.message}", file=sys.stderr)
        return 1
    print(f"  Meldungen geschlossen (Kennungen bis {bis}), neue bleiben aus", flush=True)
    still_halten(bus, bis)
    return 0


if __name__ == "__main__":
    sys.exit(main())
