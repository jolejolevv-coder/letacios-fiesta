#!/usr/bin/env python3
"""Einen Bestenlistenabruf versuchen und festhalten, wie lange die Pause davor war.

Hintergrund: am 21.09.2026 lieferte der Laeufer genau einmal Daten, nach mehreren
Stunden ohne Verbindung. Drei Versuche unmittelbar danach und der Lauf der Action am
selben Abend gaben nichts. Die Pakete waren in allen Faellen dieselben, es sieht also
eher nach einer Sperre je Zeitfenster aus als nach einem Paketfehler.

Dieses Werkzeug misst genau das und sonst nichts: ein Versuch, eine Zeile.

    python3 werkzeuge/takt_messen.py          # ein Versuch, haengt eine Zeile an
    python3 werkzeuge/takt_messen.py --zeigen # das Protokoll auswerten

Das Protokoll liegt ausserhalb des Repos und enthaelt keine Zugangsdaten, nur
Zeitpunkt, Pause, Ergebnis und Zahlen.
"""

from __future__ import annotations

import argparse
import datetime
import os
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)

PROTOKOLL = os.path.expanduser("~/.opbounty_takt.log")
# Eine Seite genuegt fuer die Frage "antwortet er ueberhaupt", und sie haelt den
# Versuch kurz. Mehr Seiten wuerden die Messung nur laenger machen, nicht besser.
SEITEN = 1


def letzter_versuch() -> datetime.datetime | None:
    """Der Zeitpunkt der letzten Zeile, fuer die Pause davor."""
    if not os.path.exists(PROTOKOLL):
        return None
    with open(PROTOKOLL, encoding="utf-8") as datei:
        zeilen = [z for z in datei if z.strip() and not z.startswith("#")]
    if not zeilen:
        return None
    try:
        return datetime.datetime.fromisoformat(zeilen[-1].split("\t")[0])
    except ValueError:
        return None


def versuch() -> tuple[int, int, str]:
    """Ein Abruf. Gibt Seiten, Spieler und eine kurze Notiz zurueck."""
    from bestenliste_holen import holen

    try:
        seiten = holen(seiten=SEITEN, laut=False)
    except Exception as fehler:
        # Der Typ reicht als Notiz. Die Meldung koennte Zugangsdaten enthalten.
        return 0, 0, type(fehler).__name__
    spieler = sum(len(s) for s in seiten)
    return len(seiten), spieler, "ok" if seiten else "keine Antwort"


def schreiben(jetzt, pause_min, seiten, spieler, notiz) -> None:
    neu = not os.path.exists(PROTOKOLL)
    with open(PROTOKOLL, "a", encoding="utf-8") as datei:
        if neu:
            datei.write("# Zeitpunkt\tPause_min\tSeiten\tSpieler\tNotiz\n")
        datei.write(f"{jetzt.isoformat(timespec='seconds')}\t"
                    f"{'' if pause_min is None else pause_min}\t"
                    f"{seiten}\t{spieler}\t{notiz}\n")


def zeigen() -> int:
    if not os.path.exists(PROTOKOLL):
        print(f"  noch kein Protokoll unter {PROTOKOLL}")
        return 0
    zeilen = []
    with open(PROTOKOLL, encoding="utf-8") as datei:
        for z in datei:
            if z.startswith("#") or not z.strip():
                continue
            t = z.rstrip("\n").split("\t")
            if len(t) >= 5:
                zeilen.append(t)
    if not zeilen:
        print("  Protokoll ist leer")
        return 0

    treffer = [t for t in zeilen if t[2] != "0"]
    print(f"  {len(zeilen)} Versuche, davon {len(treffer)} mit Antwort\n")
    print("  Zeitpunkt            Pause   Seiten  Spieler  Notiz")
    for t in zeilen[-30:]:
        print(f"  {t[0]:20} {t[1]:>5}   {t[2]:>6}  {t[3]:>7}  {t[4]}")

    # Die eigentliche Frage: haengt der Erfolg an der Pause davor?
    def pausen(auswahl):
        return [int(t[1]) for t in auswahl if t[1].isdigit()]

    p_treffer, p_leer = pausen(treffer), pausen([t for t in zeilen if t[2] == "0"])
    print()
    if p_treffer:
        print(f"  Pause vor einem Treffer:    {min(p_treffer)} bis {max(p_treffer)} min, "
              f"im Mittel {sum(p_treffer) // len(p_treffer)}")
    else:
        print("  noch kein Treffer")
    if p_leer:
        print(f"  Pause vor einem Fehlschlag: {min(p_leer)} bis {max(p_leer)} min, "
              f"im Mittel {sum(p_leer) // len(p_leer)}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Takt des Bestenlistenabrufs messen")
    p.add_argument("--zeigen", action="store_true", help="nur auswerten, nicht abrufen")
    a = p.parse_args()
    if a.zeigen:
        return zeigen()

    jetzt = datetime.datetime.now()
    vorher = letzter_versuch()
    pause_min = None if vorher is None else int((jetzt - vorher).total_seconds() // 60)
    seiten, spieler, notiz = versuch()
    schreiben(jetzt, pause_min, seiten, spieler, notiz)
    print(f"  {jetzt.isoformat(timespec='seconds')}  Pause {pause_min} min  "
          f"{seiten} Seiten, {spieler} Spieler, {notiz}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
