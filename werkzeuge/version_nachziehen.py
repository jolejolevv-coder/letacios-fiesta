#!/usr/bin/env python3
"""Alle versionsabhaengigen Werte aus dem Spielpaket nachziehen.

Nach jedem Clientupdate verschieben sich die Methodennummern und die Pruefsumme, und
die Beschaffung der Bestenliste bricht. Beides muss aber nicht aus einem Mitschnitt
geholt werden, es steht im pck:

  * Die Nummer einer Methode ist ihr Index in der SORTIERTEN Liste aller `@rpc` Namen
    des Knotens `root_main/Main`.
  * Die Pruefsumme ist der MD5 ueber dieselbe Liste, aneinandergehaengt.
  * Die Versionszeichenkette steht im Klartext daneben.

    python3 werkzeuge/version_nachziehen.py                      # lokales Paket
    python3 werkzeuge/version_nachziehen.py --laden --schreiben  # Paket holen, setzen

Gefragt wird dabei auch der Spielserver: er nennt seine Version gleich nach dem
Verbinden von sich aus, ohne Anmeldung. Drei Werte werden verglichen, Server, pck und
Code. Will der Server eine Version, die das pck noch nicht hat, wird NICHTS geschrieben
und stattdessen gesagt, dass der Client einmal laufen muss; er aktualisiert sich dabei
selbst. Rueckgabe 2 in diesem Fall, 1 bei blossen Abweichungen, 0 wenn alles passt.

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
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)

from bestenliste_holen import server_version  # noqa: E402
from methoden_aus_pck import (PCK, rpc_methoden, skriptblock,  # noqa: E402
                              zeilen_aus_pck)

# Beide Kopien der Werkzeuge. Das Simulatorprojekt ist die Quelle, dieses Verzeichnis
# die Kopie; gesetzt werden trotzdem beide, damit sie nicht auseinanderlaufen.
KOPIEN = [HIER, os.path.expanduser("~/Downloads/xebec-mirror-sim/tools")]

# Woher der Client sein eigenes Paket laedt. Steht im pck selbst, in der Funktion
# `download_update_wl`, und ist oeffentlich ohne Anmeldung erreichbar.
#
# Das ist der Grund, warum hier kein Spielclient gebraucht wird: das Paket laesst sich
# direkt holen, und die Nummern stehen darin. Am 22.09.2026 geprueft, das geladene
# Paket liefert dieselbe Version, dieselben 144 Methoden und dieselbe Pruefsumme wie
# das lokal installierte.
PCK_URL = "https://opbountypck.s3.us-east-1.amazonaws.com/OPBounty.pck"

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


def pck_laden(ziel: str) -> str:
    """Das Spielpaket von der oeffentlichen Adresse holen. Gibt den Pfad zurueck."""
    os.makedirs(os.path.dirname(ziel) or ".", exist_ok=True)
    print(f"  lade {PCK_URL}")
    with urllib.request.urlopen(PCK_URL, timeout=600) as antwort:
        daten = antwort.read()
    if len(daten) < 8_000_000:
        raise SystemExit(f"Paket zu klein ({len(daten)} Byte), Abbruch")
    with open(ziel, "wb") as datei:
        datei.write(daten)
    print(f"  {len(daten) // 1024 // 1024} MB nach {ziel}")
    return ziel


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


def nur_server() -> int:
    """Nur fragen, ob der Server eine andere Version will als der Code kennt.

    Das braucht kein Spielpaket und laeuft deshalb auch in der Action. Reparieren kann
    es dort niemand, die Nummern stehen nur im pck auf dem Rechner mit dem Client; es
    ist eine Warnlampe, keine Werkstatt.
    """
    sys.path.insert(0, HIER)
    import enet_paket

    draussen = server_version()
    if draussen is None:
        print("  Spielserver nicht erreichbar, keine Aussage moeglich")
        return 0
    print(f"  Server meldet {draussen}, im Code steht {enet_paket.VERSION}")
    if draussen == enet_paket.VERSION:
        print("  gleich, nichts zu tun")
        return 0
    print(f"\n  OPBounty ist auf {draussen} gegangen. Die Methodennummern und die "
          f"Pruefsumme verschieben sich damit,")
    print("  und die Beschaffung der Bestenliste laeuft ins Leere, bis sie nachgezogen "
          "sind.")
    print("  Auf dem Rechner mit dem Spielclient: einmal OPBounty starten, dann")
    print("      python3 werkzeuge/version_nachziehen.py --schreiben")
    return 1


def main() -> int:
    p = argparse.ArgumentParser(
        description="Versionsabhaengige Werte aus dem Spielpaket nachziehen")
    p.add_argument("--pck", default=PCK)
    p.add_argument("--laden", action="store_true",
                   help="das Spielpaket erst herunterladen, statt das lokal "
                        "installierte zu lesen; braucht keinen Spielclient")
    p.add_argument("--schreiben", action="store_true",
                   help="die Konstanten setzen statt nur zu vergleichen")
    p.add_argument("--ohne-server", action="store_true", dest="ohne_server",
                   help="den Spielserver nicht nach seiner Version fragen")
    p.add_argument("--nur-server", action="store_true", dest="nur_server",
                   help="nur den Server fragen und mit dem Code vergleichen; ohne "
                        "Spielpaket, dafuer auch auf einem fremden Rechner")
    a = p.parse_args()

    if a.nur_server:
        return nur_server()

    pfad = a.pck
    if a.laden:
        pfad = pck_laden(os.path.join(
            os.environ.get("TMPDIR", "/tmp"), "OPBounty_geladen.pck"))

    soll, anzahl = aus_pck(pfad)
    print(f"  pck {pfad}")
    print(f"  Version {soll['Version']}, {anzahl} @rpc Methoden")

    # Der Server nennt seine Version von sich aus, ohne Anmeldung. Damit faellt ein
    # Update auf, bevor die naechste Beschaffung stumm ins Leere laeuft.
    draussen = None if a.ohne_server else server_version()
    if draussen is None and not a.ohne_server:
        print("  Server nicht erreichbar, es gilt allein das Spielpaket")
    elif draussen:
        print(f"  Server meldet {draussen}")
        if draussen != soll["Version"]:
            # Das pck aktualisiert sich erst, wenn der Client einmal laeuft. Vorher
            # waeren alle Nummern von gestern, und --schreiben wuerde Mist festschreiben.
            print(f"\n  Der Server will {draussen}, das Spielpaket steht auf "
                  f"{soll['Version']}.")
            print("  Mit --laden holt sich der Befehl das neue Paket selbst, dafuer "
                  "braucht es keinen Spielclient.")
            print("  Es wird nichts geschrieben, sonst stuenden hier die Nummern von "
                  "gestern.")
            return 2
    print()
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
