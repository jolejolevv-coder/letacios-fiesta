#!/usr/bin/env python3
"""Die Bestenliste aus einem Mitschnitt in die Seite legen.

Der Auslöser für die Daten ist der Spielclient: er stellt die Anfrage, tcpdump hört
mit, dieses Skript wertet aus. Warum es keinen eigenen Läufer gibt, steht in
`specs/features/bestenliste.md` unter "Was am eigenen Laeufer gescheitert ist".

    sudo tcpdump -i any -n -s 0 -w ~/Downloads/bestenliste.pcap 'udp port 4694'
    # Spiel öffnen, Bestenliste, fünfmal blättern, Strg+C
    python3 bestenliste_einbauen.py ~/Downloads/bestenliste.pcap

Der Bestand wird fortgeschrieben, nicht ersetzt: Spieler, die in einer neuen Aufnahme
fehlen, bleiben mit ihrem alten Stand und ihrem Datum stehen. So wächst die Liste über
die Aufnahmen hinweg, statt bei jeder Lücke Löcher zu bekommen.

Ausgabe ist `public/bestenliste.json.gz`. Sie wird beim Bauen mit verschlüsselt, weil
`verschluesseln.py` alle `*.json.gz` im Zielverzeichnis erfasst.
"""
import argparse
import datetime
import gzip
import json
import os
import sys

# Die Leser fuer das Mitschnittformat liegen im Simulatorprojekt. Auf dem Server
# stehen sie woanders, deshalb ueberschreibbar.
WERKZEUGE = os.environ.get(
    "OPBOUNTY_WERKZEUGE",
    os.path.expanduser("~/Downloads/xebec-mirror-sim/tools"))
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    "public", "bestenliste.json.gz")


def aus_mitschnitt(pfad):
    """Die Spielerliste aus einem pcap lesen. Nutzt die Werkzeuge des Simulators."""
    if not os.path.isdir(WERKZEUGE):
        raise SystemExit(f"Werkzeuge nicht gefunden: {WERKZEUGE}")
    sys.path.insert(0, WERKZEUGE)
    from bestenliste_lesen import seiten, zeile_bauen, SPALTEN

    eintraege, gesehen = [], set()
    for seite in seiten(pfad):
        for feld in seite["zeilen"]:
            if not isinstance(feld, list) or len(feld) < len(SPALTEN):
                continue
            e = zeile_bauen(feld)
            if not e.get("login") or e["login"] in gesehen:
                continue
            gesehen.add(e["login"])
            if e.get("bounty") is not None:
                # Das Spiel zeigt eine Nachkommastelle, der volle double bringt nichts.
                e["bounty"] = round(e["bounty"], 1)
            eintraege.append(e)
    eintraege.sort(key=lambda e: e.get("rang") or 10 ** 9)
    return eintraege


def alt_laden():
    """Den bisherigen Bestand lesen, im Klartext oder verschluesselt.

    Auf dem Heimserver liegt nur die `.enc` im geklonten Repo, die Klartextdatei ist
    dort gar nicht vorhanden. Ohne diesen Weg faenge jeder Serverlauf bei null an und
    das Fortschreiben waere wirkungslos.
    """
    try:
        from verschluesseln import lesen
        return {e["login"]: e
                for e in json.loads(gzip.decompress(lesen(ZIEL))).get("spieler", [])}
    except Exception:
        return {}


def vom_laeufer(seiten=5):
    """Die Liste selbst holen, ohne Spielclient und ohne Mitschnitt.

    Seit dem 02.09.2026 funktioniert der eigene Laeufer: er meldet vor der Anmeldung
    seinen eigenen Knoten an (`pfad_anmelden`), und damit beantwortet der Server die
    Bestenlistenanfrage. Das ist der bevorzugte Weg; der Mitschnittweg bleibt als
    Rueckfall bestehen.
    """
    if not os.path.isdir(WERKZEUGE):
        raise SystemExit(f"Werkzeuge nicht gefunden: {WERKZEUGE}")
    sys.path.insert(0, WERKZEUGE)
    from bestenliste_holen import holen
    from bestenliste_lesen import zeile_bauen, SPALTEN

    eintraege, gesehen = [], set()
    for seite in holen(seiten=seiten, laut=False):
        for feld in seite:
            if not isinstance(feld, list) or len(feld) < len(SPALTEN):
                continue
            e = zeile_bauen(feld)
            if not e.get("login") or e["login"] in gesehen:
                continue
            gesehen.add(e["login"])
            if e.get("bounty") is not None:
                e["bounty"] = round(e["bounty"], 1)
            eintraege.append(e)
    eintraege.sort(key=lambda e: e.get("rang") or 10 ** 9)
    return eintraege


def main():
    p = argparse.ArgumentParser(description="Bestenliste in die Seite legen")
    p.add_argument("mitschnitt", nargs="?",
                   help="pcap; ohne Angabe holt der Laeufer die Liste selbst")
    p.add_argument("--stand", help="Datum der Aufnahme, sonst heute")
    p.add_argument("--ersetzen", action="store_true",
                   help="alten Bestand verwerfen statt fortschreiben")
    a = p.parse_args()

    # Das Passwort auch dem Leser bereitstellen: `lesen()` holt es nur aus der
    # Umgebung, auf dem Server steht es aber in einer Datei.
    if not os.environ.get("SEITEN_PASSWORT"):
        os.environ["SEITEN_PASSWORT"] = seitenpasswort()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    stand = a.stand or datetime.date.today().isoformat()
    if a.mitschnitt:
        neu = aus_mitschnitt(a.mitschnitt)
        quelle = "Mitschnitt"
    else:
        neu = vom_laeufer()
        quelle = "Laeufer"
    if not neu:
        raise SystemExit(f"keine Bestenliste ueber den {quelle} bekommen")

    bestand = {} if a.ersetzen else alt_laden()
    for e in neu:
        e["stand"] = stand
        bestand[e["login"]] = e

    spieler = sorted(bestand.values(), key=lambda e: e.get("rang") or 10 ** 9)
    frisch = sum(1 for e in spieler if e.get("stand") == stand)
    paket = {"stand": stand, "spieler": spieler}

    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(ZIEL, "wb", compresslevel=9) as datei:
        datei.write(roh)

    print(f"  {len(neu)} Spieler vom {quelle}, {len(spieler)} im Bestand, "
          f"{frisch} davon von heute")
    print(f"  {len(roh) // 1024} KB roh, "
          f"{os.path.getsize(ZIEL) // 1024} KB gepackt -> {ZIEL}")
    verschluesselt_ablegen()


def seitenpasswort():
    """Das Seitenpasswort, aus der Umgebung oder aus einer Datei ausserhalb des Repos."""
    p = os.environ.get("SEITEN_PASSWORT", "").strip()
    if p:
        return p
    datei = os.path.expanduser("~/.fiesta_passwort")
    if os.path.exists(datei):
        with open(datei, encoding="utf-8") as f:
            return f.read().strip()
    return ""


def verschluesselt_ablegen():
    """Die verschluesselte Fassung neben die Klartextdatei legen.

    Nur diese geht ins Repo. Das Repo ist oeffentlich, und in der Liste stehen Namen
    und Werte von hundert echten Leuten; unverschluesselt hat das dort nichts zu
    suchen. Moeglich ist es, weil das Salz in `salz.txt` festliegt und die Action
    denselben Schluessel bildet.
    """
    passwort = seitenpasswort()
    if not passwort:
        print("  kein SEITEN_PASSWORT gesetzt, keine verschluesselte Fassung "
              "geschrieben (die Seite zeigt dann keine Bestenliste)")
        return
    hier = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, hier)
    from verschluesseln import salz_holen, schluessel, verschluesseln

    schl = schluessel(passwort, salz_holen())
    with open(ZIEL, "rb") as datei:
        klartext = datei.read()
    with open(ZIEL + ".enc", "wb") as datei:
        datei.write(verschluesseln(schl, klartext))
    print(f"  verschluesselt -> {ZIEL}.enc "
          f"({os.path.getsize(ZIEL + '.enc') // 1024} KB, geht ins Repo)")


if __name__ == "__main__":
    main()
