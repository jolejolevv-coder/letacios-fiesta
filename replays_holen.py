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


DATEINAME = re.compile(r"([A-Za-z0-9-]+)_(-?\d+)_(-?\d+)\.log$")
# Bis zu dieser Summe an Abweichung gilt ein Kandidat als dieselbe Partie. Gemessen
# am 01.09.2026: exakte Treffer und Abweichungen von 1 oder 2 kommen vor, danach
# klafft eine Luecke bis ueber 50. Was weiter weg liegt, ist eine fremde Partie im
# selben Ordner, kein Rundungsfehler.
TOLERANZ = 2
_ordner = {}


def ordner_lesen(praefix, eimer):
    """Alle Dateinamen unter einem Praefix. Der Storage laesst sich auflisten, was
    das Raten ueberfluessig macht."""
    if praefix in _ordner:
        return _ordner[praefix]
    aus, token = [], None
    while True:
        u = ("https://firebasestorage.googleapis.com/v0/b/" + eimer + "/o?prefix="
             + urllib.parse.quote(praefix, safe="") + "&maxResults=1000")
        if token:
            u += "&pageToken=" + urllib.parse.quote(token, safe="")
        try:
            with urllib.request.urlopen(u, timeout=60) as antwort:
                d = json.loads(antwort.read())
        except Exception:
            break
        aus += [i["name"] for i in d.get("items", [])]
        token = d.get("nextPageToken")
        if not token:
            break
    _ordner[praefix] = aus
    return aus


def nachbar_suchen(pfad, eimer):
    """Den echten Dateinamen zu einem knapp danebenliegenden Pfad finden.

    Die Bounty im Dateinamen stammt vom hochladenden Client, die in der Partienzeile
    aus dem Profil. Beide runden gelegentlich verschieden, dann fehlt eine Eins. Hier
    wird der Ordner gelesen und der naechste Kandidat genommen, aber nur innerhalb
    der Toleranz und nur wenn er eindeutig ist: im selben Ordner liegen hunderte
    fremder Partien derselben Leaderpaarung.
    """
    teile = pfad.rsplit("/", 1)
    if len(teile) != 2:
        return None
    t = DATEINAME.search(teile[1])
    if not t:
        return None
    verlierer, s_mmr, v_mmr = t.group(1), int(t.group(2)), int(t.group(3))
    treffer = []
    for name in ordner_lesen(teile[0] + "/", eimer):
        k = DATEINAME.search(name)
        if not k or k.group(1) != verlierer:
            continue
        abstand = abs(int(k.group(2)) - s_mmr) + abs(int(k.group(3)) - v_mmr)
        if abstand <= TOLERANZ:
            treffer.append((abstand, name))
    if not treffer:
        return None
    treffer.sort()
    # Zwei gleich nahe Kandidaten heissen: nicht entscheidbar. Dann lieber nichts.
    if len(treffer) > 1 and treffer[0][0] == treffer[1][0]:
        return None
    return treffer[0][1]


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
        # Knapp daneben? Der Ordner verraet den echten Namen.
        nachbar = nachbar_suchen(pfad, eimer)
        if not nachbar:
            return None
        try:
            with urllib.request.urlopen(adresse(nachbar, eimer), timeout=30) as antwort:
                roh = antwort.read()
        except Exception:
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
        if not roh:
            continue

        # RZ1 CHK: der einzige Ort, an dem die Don-Zaehler stehen. Der Klartext
        # fuehrt Hand, Board, Trash und Life, aber kein Don. Ohne diese Zeilen
        # kann ein Brett die Don nicht zeigen.
        if roh.startswith("RZ1|CHK|"):
            f = roh.split("|")
            # Abgeschnittene Checkpoints kommen vor. Lieber ueberspringen als mit
            # Nullen auffuellen, sonst sind die Zaehler frei erfunden.
            #
            # Reihenfolge im CHK, aus src/replay_format.py:
            #   2 seq, 3 player, 4 deck, 5 hand, 6 board, 7 life,
            #   8 donDeck, 9 donActive, 10 trash, 11 stage, 12 leader, 13 donRested
            if len(f) >= 14:
                zeilen.append({"c": [int(f[3]), int(f[4]), int(f[5]), int(f[6]),
                                     int(f[7]), int(f[8]), int(f[9]), int(f[10]),
                                     int(f[11]), int(f[13])]})
            continue
        # RZ1 PLY nennt die Spielernummer zum Namen und zum Leader. Die CHK Zeilen
        # fuehren nur die Nummer, ohne diese Zuordnung waeren sie nicht zuzuordnen.
        if roh.startswith("RZ1|PLY|"):
            f = roh.split("|")
            if len(f) >= 5:
                zeilen.append({"p": [int(f[2]), UNSICHTBAR.sub("", f[3]), f[4]]})
            continue
        # RZ1 Bewegungszeilen. Erst mit ihnen laesst sich das Brett bei jedem
        # Schritt genau zeigen statt nur am Zugende.
        #
        #   RZ1|seq|player|cardId|srcZone|srcSlot|dstZone|dstSlot|f8|f9|rested|...
        #
        # Die Zonencodes stehen als `enum CardZone` im Spielpaket:
        #   0 deck, 1 hand, 2 character, 3 life, 4 don_start, 5 don_field,
        #   6 trash, 7 stage, 8 leader, 9 don_equipped
        # Feld 10 ist der Ruhezustand, nicht die Zone; Resten laeuft als 5 nach 5.
        # Am 02.09.2026 an 311 Logs geprueft: nachgespielt stimmen alle zehn
        # Zaehler an allen 135.846 Checkpoints.
        if roh.startswith("RZ1|"):
            f = roh.split("|")
            if len(f) >= 11 and f[1].isdigit():
                try:
                    zeilen.append({"m": [int(f[2]), f[3], int(f[4]), int(f[5]),
                                         int(f[6]), int(f[7]), int(f[10])]})
                except ValueError:
                    pass
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
