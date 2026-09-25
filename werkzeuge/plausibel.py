#!/usr/bin/env python3
"""Ist die frisch gebaute Bestenliste gut genug zum Pushen?

Gebraucht von `mitschnitt_server.sh` zwischen Auswerten und Push. Faellt die Pruefung
durch, wird nichts gepusht und die Seite zeigt weiter den letzten guten Stand.

    python3 werkzeuge/plausibel.py public/bestenliste.json.gz
"""
import argparse
import datetime
import gzip
import json
import sys

# Fuenf Seiten zu je 20 Spielern ergeben 100. Unter 90 hat der Mitschnitt mindestens
# eine Seite verfehlt, und eine Liste mit Loch soll nicht die volle ersetzen.
MIN_SPIELER = 90


def pruefen(daten, heute, min_spieler=MIN_SPIELER):
    """Liste der Gruende, warum die Liste nicht taugt. Leer heisst: pushen."""
    gruende = []
    if daten.get("stand") != heute:
        gruende.append(f"Stand ist {daten.get('stand')}, nicht {heute}")
    spieler = [e for e in daten.get("spieler", []) if e.get("stand", daten.get("stand")) == heute]
    if len(spieler) < min_spieler:
        gruende.append(f"nur {len(spieler)} Spieler von heute, verlangt sind {min_spieler}")
    raenge = [e.get("rang") for e in spieler]
    if len(set(raenge)) != len(raenge):
        gruende.append("Raenge sind doppelt vergeben")
    if any("discord" in e for e in spieler):
        gruende.append("ein Discordfeld ist in den Daten, das darf nie ins Repo")
    return gruende


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("datei")
    p.add_argument("--heute", default=datetime.date.today().isoformat())
    a = p.parse_args(argv)
    try:
        with gzip.open(a.datei, "rb") as datei:
            daten = json.loads(datei.read())
    except (OSError, ValueError) as fehler:
        print(f"Bestenliste nicht lesbar: {fehler}", file=sys.stderr)
        return 1
    gruende = pruefen(daten, a.heute)
    for grund in gruende:
        print(f"  nicht plausibel: {grund}", file=sys.stderr)
    if not gruende:
        print(f"  plausibel: {len(daten['spieler'])} Spieler vom {a.heute}")
    return 1 if gruende else 0


if __name__ == "__main__":
    sys.exit(main())
