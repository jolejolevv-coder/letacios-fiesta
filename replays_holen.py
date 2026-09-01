#!/usr/bin/env python3
"""Replaylogs holen und zu etwas eindampfen, das der Viewer im Browser lesen kann.

Warum nicht direkt aus dem Browser: der Storage schickt keinen CORS-Kopf. Ein
`fetch` aus der Seite heraus scheitert, ein Link im neuen Tab funktioniert. Der
Viewer braucht die Daten also vorbereitet.

Warum nicht das rohe Log ausliefern: es enthaelt neben den Ereignissen viel
Beiwerk. Hier bleibt nur, was die Anzeige braucht.

Ein Log besteht aus zwei Arten von Zeilen. Klartextzeilen wie

    [Wasinha#6207] Leader is Enel [<mark><link="OP15-058">OP15-058</link></mark>]

und Maschinenzeilen im RZ1 Format, deren Aufbau in
~/Downloads/xebec-mirror-sim/src/replay_format.py steht. Fuer die Anzeige zaehlt der
Klartext; die CHK Zeilen liefern zusaetzlich den Zaehlerstand nach jedem Schritt.

    python3 replays_holen.py --grenze 5     # erst einmal messen
    python3 replays_holen.py                # alles, was in spieler.json.gz steht
"""
import argparse
import gzip
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
QUELLE = os.path.join(HIER, "public", "spieler.json.gz")
ORDNER = os.path.join(HIER, "public", "replays")
ZWISCHEN = os.path.expanduser("~/.opbounty_replays")


def dateiname(pfad):
    """Aus dem Storagepfad einen flachen, sicheren Dateinamen machen.

    Der Pfad traegt Schraegstriche und Punkte; beides wandert in ein einzelnes
    Trennzeichen, damit die Datei flach im Ordner liegt und die Seite sie ohne
    Umweg adressieren kann.
    """
    kurz = pfad[len("Replays/"):] if pfad.startswith("Replays/") else pfad
    return re.sub(r"[^A-Za-z0-9._-]", "_", kurz.replace(".log", "")) + ".json.gz"

TAG = re.compile(r"<[^>]+>")
KARTE = re.compile(r"\b([A-Z]{2,4}\d{2}-\d{3}|P-\d{3}|ST\d{2}-\d{3})\b")
# Das Spiel setzt ein unsichtbares Zeichen in die Spielernamen.
UNSICHTBAR = re.compile(r"[​‌‍﻿]")


def adresse(pfad, eimer):
    return ("https://firebasestorage.googleapis.com/v0/b/" + eimer + "/o/"
            + urllib.parse.quote(pfad, safe="") + "?alt=media")


def laden(pfad, eimer):
    """Ein Log holen, mit lokalem Zwischenspeicher. Logs aendern sich nie."""
    os.makedirs(ZWISCHEN, exist_ok=True)
    name = pfad.replace("/", "_")
    datei = os.path.join(ZWISCHEN, name)
    if os.path.exists(datei):
        with open(datei, "rb") as f:
            return f.read().decode("utf-8", "replace")
    try:
        with urllib.request.urlopen(adresse(pfad, eimer), timeout=30) as antwort:
            roh = antwort.read()
    except urllib.error.HTTPError:
        return None
    except Exception:
        return None
    with open(datei, "wb") as f:
        f.write(roh)
    return roh.decode("utf-8", "replace")


def eindampfen(text):
    """Aus dem Log die Zeilen holen, die der Viewer zeigt.

    Behalten wird der Klartext ohne Auszeichnungen, dazu je Zeile die erwaehnten
    Kartennummern, damit der Viewer Bilder einblenden kann. Die RZ1 Zeilen werden
    uebersprungen: sie tragen Zaehlerstaende, keine Erzaehlung, und verdoppeln die
    Groesse.
    """
    zeilen = []
    for roh in text.splitlines():
        roh = roh.strip()
        if not roh or roh.startswith("RZ1|"):
            continue
        karten = KARTE.findall(roh)
        sauber = UNSICHTBAR.sub("", TAG.sub("", roh)).strip()
        if not sauber:
            continue
        eintrag = {"t": sauber}
        if karten:
            # Doppelte je Zeile raus, Reihenfolge behalten.
            eintrag["k"] = list(dict.fromkeys(karten))
        zeilen.append(eintrag)
    return zeilen


def main():
    p = argparse.ArgumentParser(description="Replays holen und eindampfen")
    p.add_argument("--grenze", type=int, default=0)
    a = p.parse_args()


    with gzip.open(QUELLE, "rb") as datei:
        quelle = json.loads(datei.read())
    eimer = quelle.get("speicher")
    pfade = []
    for s in quelle["spieler"].values():
        for partie in s["partien"]:
            if partie.get("replay"):
                pfade.append(partie["replay"])
    pfade = list(dict.fromkeys(pfade))
    if a.grenze:
        pfade = pfade[:a.grenze]

    # Eine Datei je Replay statt eines Buendels. Bei 751 Partien waeren es sonst
    # rund 2,5 MB, die jeder Seitenaufruf mitschleppt; so holt der Browser genau die
    # eine, die jemand oeffnet, und die liegt auf derselben Herkunft, also ohne CORS.
    os.makedirs(ORDNER, exist_ok=True)
    sys.path.insert(0, HIER)
    from bestenliste_einbauen import seitenpasswort
    from verschluesseln import salz_holen, schluessel, verschluesseln

    passwort = seitenpasswort()
    schl = schluessel(passwort, salz_holen()) if passwort else None
    if not schl:
        print("  kein SEITEN_PASSWORT, es wird nur der Klartext geschrieben")

    neu = fehlt = uebersprungen = 0
    gepackt = 0
    for i, pfad in enumerate(pfade, 1):
        ziel = os.path.join(ORDNER, dateiname(pfad))
        if os.path.exists(ziel + ".enc") or (not schl and os.path.exists(ziel)):
            uebersprungen += 1
            continue
        text = laden(pfad, eimer)
        if text is None:
            fehlt += 1
            continue
        daten = json.dumps({"pfad": pfad, "zeilen": eindampfen(text)},
                           ensure_ascii=False, separators=(",", ":")).encode()
        with gzip.open(ziel, "wb", compresslevel=9) as datei:
            datei.write(daten)
        if schl:
            with open(ziel, "rb") as datei:
                klar = datei.read()
            with open(ziel + ".enc", "wb") as datei:
                datei.write(verschluesseln(schl, klar))
        gepackt += os.path.getsize(ziel)
        neu += 1
        if i % 50 == 0:
            print(f"  {i} von {len(pfade)}")

    print(f"  {neu} neu, {uebersprungen} schon da, {fehlt} nicht gefunden")
    if neu:
        print(f"  im Schnitt {gepackt // neu // 1024} KB je Replay, "
              f"{gepackt // 1024} KB neu dazu")
    vorhanden = len([f for f in os.listdir(ORDNER) if f.endswith(".enc")])
    print(f"  {vorhanden} verschluesselte Replays unter {ORDNER}")


if __name__ == "__main__":
    main()
