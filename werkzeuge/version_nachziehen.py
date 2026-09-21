#!/usr/bin/env python3
"""Alle versionsabhaengigen Werte aus dem Spielpaket nachziehen.

Nach jedem Clientupdate verschieben sich die Methodennummern und die Pruefsumme, und
die Beschaffung der Bestenliste bricht. Beides muss aber nicht aus einem Mitschnitt
geholt werden, es steht im pck:

  * Die Nummer einer Methode ist ihr Index in der SORTIERTEN Liste aller `@rpc` Namen
    des Knotens `root_main/Main`.
  * Die Pruefsumme ist der MD5 ueber dieselbe Liste, aneinandergehaengt.
  * Die Versionszeichenkette steht im Klartext daneben.

    python3 werkzeuge/version_nachziehen.py               # nur vergleichen
    python3 werkzeuge/version_nachziehen.py --schreiben    # Konstanten setzen

Ohne `--schreiben` endet der Befehl mit 1, sobald etwas abweicht; so laesst er sich
als Pruefung verwenden. Mit `--schreiben` werden beide Kopien der Werkzeuge gesetzt,
die hier und die im Simulatorprojekt.

Am 21.09.2026 gegen einen vollstaendigen Mitschnitt geprueft: alle sechs Nummern und
die Pruefsumme kommen so heraus, wie sie auf der Leitung stehen. Genau das hat an
dem Tag die halbe Analyse gekostet, weil es die 109 fuer `send_leaderboard` damals
nur aus dem Mitschnitt gab.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)

from methoden_aus_pck import (PCK, rpc_methoden, skriptblock,  # noqa: E402
                              zeilen_aus_pck)

# Beide Kopien der Werkzeuge. Das Simulatorprojekt ist die Quelle, dieses Verzeichnis
# die Kopie; gesetzt werden trotzdem beide, damit sie nicht auseinanderlaufen.
KOPIEN = [HIER, os.path.expanduser("~/Downloads/xebec-mirror-sim/tools")]

# Je Eintrag: Anzeigename, Datei, Muster mit genau einer Gruppe fuer den Wert, und
# woher der Sollwert kommt. `art` sagt, wie der Wert geschrieben wird.
STELLEN = [
    ("login_request", "enet_paket.py",
     r"(?m)^(KNOTEN_ANMELDUNG, METHODE_ANMELDUNG = 1, )(0x[0-9a-f]+)", "hex"),
    ("request_filtered_leaderboard", "enet_paket.py",
     r"(?m)^(KNOTEN_ANFRAGE, METHODE_ANFRAGE = 1, )(0x[0-9a-f]+)", "hex"),
    ("request_upgrades", "enet_paket.py",
     r"(?m)^(METHODE_WERTE_MELDEN = )(0x[0-9a-f]+)", "hex"),
    ("update_my_leaderboard_info", "enet_paket.py",
     r"(?m)^(METHODE_FELD_MELDEN = )(0x[0-9a-f]+)", "hex"),
    ("request_arena_stats", "enet_paket.py",
     r"(?m)^(METHODE_BEGLEITER = )(0x[0-9a-f]+)", "hex"),
    ("send_leaderboard", "bestenliste_lesen.py",
     r'(?m)^(KNOTEN, METHODE = 2, int\(__import__\("os"\)\.environ\.get\('
     r'"OPBOUNTY_METHODE", )(\d+)', "dez"),
    ("send_leaderboard", "bestenliste_holen.py",
     r"(?m)^(KNOTEN_ANTWORT, METHODE_ANTWORT = 2, )(\d+)", "dez"),
    ("Version", "enet_paket.py",
     r'(?m)^(VERSION = os\.environ\.get\("OPBOUNTY_VERSION", ")([^"]+)', "text"),
    ("Pruefsumme", "enet_paket.py",
     r'(?m)^(PRUEFSUMME_MAIN = os\.environ\.get\("OPBOUNTY_PRUEFSUMME",\s*\n\s*")'
     r"([0-9a-f]{32})", "text"),
]


def aus_pck(pfad: str) -> dict:
    """Version, Pruefsumme und die Nummer jeder Methode aus dem Spielpaket."""
    if not os.path.exists(pfad):
        raise SystemExit(f"Spielpaket nicht gefunden: {pfad}")
    zeilen = zeilen_aus_pck(pfad)
    namen = rpc_methoden(skriptblock(zeilen))
    if not namen:
        raise SystemExit("keine @rpc Methoden im pck gefunden, Anker geprueft?")
    version = next((m.group(1) for z in zeilen
                    if (m := re.search(r'"(2\.\d+\.\d+)"', z))), None)
    if not version:
        raise SystemExit("keine Versionszeichenkette im pck gefunden")
    soll = {name: index for index, name in enumerate(namen)}
    soll["Version"] = version
    soll["Pruefsumme"] = hashlib.md5("".join(namen).encode()).hexdigest()
    return soll, len(namen)


def schreibweise(wert, art: str) -> str:
    if art == "hex":
        return f"0x{wert:02x}"
    if art == "dez":
        return str(wert)
    return str(wert)


def pruefen(soll: dict, schreiben: bool) -> int:
    """Jede Stelle vergleichen und auf Wunsch setzen. Gibt die Zahl der Abweichungen."""
    abweichungen = 0
    print(f"  {'Wert':30} {'im Code':10} {'aus dem pck':12} Stand")
    for name, datei, muster, art in STELLEN:
        if name not in soll:
            print(f"  {name:30} {'':10} {'':12} NICHT im pck, Name geaendert?")
            abweichungen += 1
            continue
        neu = schreibweise(soll[name], art)
        for verzeichnis in KOPIEN:
            pfad = os.path.join(verzeichnis, datei)
            if not os.path.exists(pfad):
                continue
            text = open(pfad, encoding="utf-8").read()
            treffer = re.search(muster, text)
            if not treffer:
                # Eine nicht gefundene Stelle ist schlimmer als eine falsche: dann
                # greift die Pruefung ins Leere und niemand merkt es.
                print(f"  {name:30} {'':10} {neu:12} "
                      f"STELLE NICHT GEFUNDEN in {datei}")
                abweichungen += 1
                continue
            alt = treffer.group(2)
            gleich = alt == neu
            if verzeichnis == HIER:
                print(f"  {name:30} {alt:10} {neu:12} "
                      f"{'stimmt' if gleich else 'WEICHT AB'}")
            if gleich or not schreiben:
                if not gleich:
                    abweichungen += 1
                continue
            text = (text[:treffer.start(2)] + neu + text[treffer.end(2):])
            open(pfad, "w", encoding="utf-8").write(text)
            if verzeichnis == HIER:
                print(f"  {'':30} {'':10} {'':12} gesetzt")
    return abweichungen


def main() -> int:
    p = argparse.ArgumentParser(
        description="Versionsabhaengige Werte aus dem Spielpaket nachziehen")
    p.add_argument("--pck", default=PCK)
    p.add_argument("--schreiben", action="store_true",
                   help="die Konstanten setzen statt nur zu vergleichen")
    a = p.parse_args()

    soll, anzahl = aus_pck(a.pck)
    print(f"  pck {a.pck}")
    print(f"  Version {soll['Version']}, {anzahl} @rpc Methoden\n")
    abweichungen = pruefen(soll, a.schreiben)
    print()
    if not abweichungen:
        print("  alles auf dem Stand des Spielpakets")
        return 0
    if a.schreiben:
        print(f"  {abweichungen} Stellen gesetzt. Bitte die Tests laufen lassen "
              f"und den Mitschnittweg einmal gegenpruefen.")
        return 0
    print(f"  {abweichungen} Abweichungen. Mit --schreiben setzen.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
