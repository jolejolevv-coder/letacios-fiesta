#!/usr/bin/env python3
"""Wie weit liegt der echte Dateiname vom berechneten entfernt?

Der Storage laesst sich auflisten. Statt Pfade zu raten, wird hier je fehlender
Partie der Ordner des Siegerleaders gelesen und der naechstgelegene Kandidat
gesucht: gleiche Woche, gleicher Modus, gleicher Verliererleader, und die beiden
Bountyzahlen so nah wie moeglich an den unseren.

Das Ergebnis entscheidet, ob eine Toleranz vertretbar ist. Liegen die Treffer bei
Abstand 0 bis 2, ist es eine Rundung. Liegen sie weit auseinander, waere jede
Zuordnung geraten und es bleibt beim exakten Pfad.

    python3 replay_naehe.py --spieler 6
"""
import argparse
import collections
import datetime
import gzip
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

WERKZEUGE = os.path.expanduser("~/Downloads/xebec-mirror-sim/tools")
HIER = os.path.dirname(os.path.abspath(__file__))

P_BOUNTY1, P_STATUS1, P_BOUNTY2 = 2, 5, 8
P_MODUS, P_ZEIT, P_DECK1, P_DECK2 = 15, 16, 17, 18

DATEI = re.compile(r"([A-Za-z0-9-]+)_(-?\d+)_(-?\d+)\.log$")


def leader_kennung(karte):
    text = str(karte or "")
    for marke in ("MY1x", "1x"):
        if text.startswith(marke):
            return text[len(marke):]
    return text


def woche(zeitstempel):
    tag = (datetime.datetime.fromisoformat(zeitstempel)
           if isinstance(zeitstempel, str)
           else datetime.datetime.utcfromtimestamp(float(zeitstempel)))
    godot = (tag.weekday() + 1) % 7
    w = int((tag.timetuple().tm_yday + 10 - (godot + 1) % 7) / 7)
    return f"{tag.year}-W{w:02d}"


def ordner_lesen(praefix, eimer, speicher):
    """Alle Dateinamen unter einem Praefix, mit Blaetterung und Zwischenspeicher."""
    if praefix in speicher:
        return speicher[praefix]
    aus, token = [], None
    while True:
        u = ("https://firebasestorage.googleapis.com/v0/b/" + eimer + "/o?prefix="
             + urllib.parse.quote(praefix, safe="") + "&maxResults=1000")
        if token:
            u += "&pageToken=" + urllib.parse.quote(token, safe="")
        try:
            with urllib.request.urlopen(u, timeout=60) as a:
                d = json.loads(a.read())
        except Exception:
            break
        aus += [i["name"] for i in d.get("items", [])]
        token = d.get("nextPageToken")
        if not token:
            break
    speicher[praefix] = aus
    return aus


def main():
    p = argparse.ArgumentParser(description="Abstand zum echten Dateinamen messen")
    p.add_argument("--spieler", type=int, default=6)
    a = p.parse_args()

    sys.path.insert(0, WERKZEUGE)
    from firestore_browser import Db, wert, entpacke

    with gzip.open(os.path.join(HIER, "public", "bestenliste.json.gz"), "rb") as d:
        beste = json.loads(d.read())["spieler"][:a.spieler]

    db = Db()
    eimer = db.c["storageBucket"]
    speicher = {}
    abstaende = collections.Counter()
    exakt = fehlt_ganz = 0
    beispiele = []
    vorzeichen = []

    for e in beste:
        d = db.dokument(f"PublicUsers/{e['user_id']}", felder=["Western"])
        west = entpacke(wert(d.get("fields", {}).get("Western")))
        for z in (west or {}).get("Public_matches") or []:
            try:
                gewonnen = str(z[P_STATUS1]).lower() == "win"
                s_leader = leader_kennung((z[P_DECK1] or [None])[0] if gewonnen
                                          else (z[P_DECK2] or [None])[0])
                v_leader = leader_kennung((z[P_DECK2] or [None])[0] if gewonnen
                                          else (z[P_DECK1] or [None])[0])
                b1, b2 = float(z[P_BOUNTY1]), float(z[P_BOUNTY2])
                s_mmr, v_mmr = (int(b1), int(b2)) if gewonnen else (int(b2), int(b1))
                kw, modus = woche(z[P_ZEIT]), int(z[P_MODUS])
            except Exception:
                continue
            if not (s_leader and v_leader):
                continue

            praefix = f"Replays/{kw}/{modus}/{s_leader}/"
            namen = ordner_lesen(praefix, eimer, speicher)
            kandidaten = []
            for name in namen:
                t = DATEI.search(name)
                if not t or t.group(1) != v_leader:
                    continue
                kandidaten.append((int(t.group(2)), int(t.group(3)), name))
            if not kandidaten:
                fehlt_ganz += 1
                continue
            bester = min(kandidaten,
                         key=lambda k: abs(k[0] - s_mmr) + abs(k[1] - v_mmr))
            d_ges = abs(bester[0] - s_mmr) + abs(bester[1] - v_mmr)
            if d_ges == 0:
                exakt += 1
            abstaende[min(d_ges, 20)] += 1
            if d_ges > 8 and len(vorzeichen) < 12:
                vorzeichen.append(
                    f"    erwartet {s_mmr}_{v_mmr}  ->  {bester[0]}_{bester[1]}   "
                    f"Sieger {bester[0] - s_mmr:+d}, Verlierer {bester[1] - v_mmr:+d}")
            if 0 < d_ges <= 8 and len(beispiele) < 6:
                beispiele.append(
                    f"    erwartet {v_leader}_{s_mmr}_{v_mmr}  ->  "
                    f"{os.path.basename(bester[2])}  (Abstand {d_ges})")

    gesamt = sum(abstaende.values()) + fehlt_ganz
    print(f"\n  {gesamt} Partien, {exakt} exakt getroffen, "
          f"{fehlt_ganz} ohne jeden Kandidaten im Ordner\n")
    print("  Abstand des naechsten Kandidaten (Summe beider Bountys):")
    for d in sorted(abstaende):
        marke = "  (20 oder mehr)" if d == 20 else ""
        print(f"    {d:3}   {abstaende[d]:4}x{marke}")
    if vorzeichen:
        print("\n  Weit entfernte Faelle, Richtung der Abweichung:")
        print("\n".join(vorzeichen))
    if beispiele:
        print("\n  Beispiele mit kleinem Abstand:")
        print("\n".join(beispiele))


if __name__ == "__main__":
    main()
