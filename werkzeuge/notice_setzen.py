#!/usr/bin/env python3
"""Die Update Notice des Spiels vor dem Start als gesehen markieren.

Nach jedem Clientupdate zeigt das Spiel einmal eine Update Notice ueber dem Hauptmenue.
Sie verdeckt die Bestenliste, der Mitschnitt findet seinen Knopf nicht und bricht nach
300 Sekunden ab (so am 23.10. mit 2.7.4 und am 27.10. mit 2.7.7). Das Spiel merkt sich
die zuletzt gesehene Version in `uinf.tres` als `seen_update_notice_v`. Steht dort die
Version des Pakets, bleibt die Notice weg.

Dieses Werkzeug liest die Version aus dem Spielpaket, so wie `version_nachziehen.py`,
und setzt den Wert, wenn er abweicht. Vorher legt es eine Sicherung daneben.

    python3 werkzeuge/notice_setzen.py            # Paket und uinf.tres von OPBounty
    python3 werkzeuge/notice_setzen.py --pruefen  # nur sagen, ob es abweicht

Rueckgabe 0, wenn der Wert passt oder gesetzt wurde, 1 bei einem Fehler. Der Mitschnitt
laeuft in beiden Faellen weiter; ein Fehler hier kostet hoechstens die Notice.
"""
import argparse
import os
import re
import shutil
import sys
import time

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)

from methoden_aus_pck import zeilen_aus_pck  # noqa: E402

UINF = os.path.expanduser("~/.local/share/godot/app_userdata/OPBounty/uinf.tres")
PAKET = os.path.join(os.environ.get("OPBOUNTY_SPIEL", os.path.expanduser(
    "~/Downloads/OPBounty_Linux")), "OPBounty.pck")
# Dasselbe Muster wie in version_nachziehen.aus_pck: die erste "2.x.y" im Skript.
VERSION_MUSTER = re.compile(r'"(2\.\d+\.\d+)"')
NOTICE_ZEILE = re.compile(r'(?m)^(seen_update_notice_v = ")([^"]*)(")')


def paket_version(pfad: str) -> str | None:
    """Die Versionszeichenkette aus dem Spielpaket, oder None."""
    for zeile in zeilen_aus_pck(pfad):
        treffer = VERSION_MUSTER.search(zeile)
        if treffer:
            return treffer.group(1)
    return None


def gesehene_version(text: str) -> str | None:
    """Der Wert von seen_update_notice_v in uinf.tres, oder None, wenn er fehlt."""
    treffer = NOTICE_ZEILE.search(text)
    return treffer.group(2) if treffer else None


def mit_version(text: str, version: str) -> str:
    """uinf.tres mit seen_update_notice_v auf `version`. Fehlt die Zeile, bleibt alles."""
    return NOTICE_ZEILE.sub(lambda m: m.group(1) + version + m.group(3), text, count=1)


def sichern(pfad: str) -> str:
    """Eine Kopie mit Datum neben die Datei legen und ihren Pfad liefern."""
    ziel = f"{pfad}.bak_{time.strftime('%Y-%m-%d')}"
    shutil.copy2(pfad, ziel)
    return ziel


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--paket", default=PAKET)
    ap.add_argument("--uinf", default=UINF)
    ap.add_argument("--pruefen", action="store_true", help="nichts schreiben")
    args = ap.parse_args()

    try:
        version = paket_version(args.paket)
        with open(args.uinf, encoding="utf-8") as datei:
            text = datei.read()
    except OSError as fehler:
        print(f"  Notice nicht geprueft: {fehler}")
        return 1
    if not version:
        print("  Notice nicht geprueft: keine Version im Spielpaket")
        return 1
    gesehen = gesehene_version(text)
    if gesehen is None:
        print("  Notice nicht geprueft: seen_update_notice_v fehlt in uinf.tres")
        return 1
    if gesehen == version:
        print(f"  Notice passt ({version})")
        return 0
    if args.pruefen:
        print(f"  Notice weicht ab: gesehen {gesehen}, Paket {version}")
        return 0
    sicherung = sichern(args.uinf)
    with open(args.uinf, "w", encoding="utf-8") as datei:
        datei.write(mit_version(text, version))
    print(f"  Notice von {gesehen} auf {version} gesetzt, Sicherung {sicherung}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
