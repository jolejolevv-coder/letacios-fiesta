#!/usr/bin/env python3
"""Misst, wie gut sich Ingame Namen ueber Bounty und Leader einem Spieler zuordnen lassen.

Phase 2 von specs/features/ingame-namen.md. Fuer jeden Ingame Namen aus den Replays der
letzten Tage gilt seine juengste Bounty (vor der Partie) als Fingerabdruck. Kandidat ist der
Spieler der Bestenliste mit der naechsten Bounty, wenn
  - der Abstand hoechstens ABSTAND ist,
  - der Zweitbeste mindestens VORSPRUNG weiter weg liegt,
  - jeder Leader, den der Name gespielt hat, in der Leaderliste des Spielers steht.
Geprueft wird gegen die Namen, die frische_partien.py aus dem Schnappschuss lernt (Belege).

Ausgabe nur in Zahlen, keine Namen.

    python3 werkzeuge/ingame_bounty_messung.py --spieler S.json.gz --beste B.json.gz \
        --ende 2026-11-06T09:05:00
"""
import argparse
import datetime
import gzip
import json
import os
import sys

HIER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HIER)
import frische_partien as F  # noqa: E402
from firestore import Db  # noqa: E402

ABSTAENDE = (5, 10, 15, 20, 30, 40)     # Raster fuer den groessten erlaubten Abstand
VORSPRUENGE = (0, 5, 10, 20)             # Raster fuer den Vorsprung vor dem Zweitbesten
ZIEL_PRECISION = 0.95


def lesen(pfad):
    with gzip.open(pfad, "rb") as datei:
        return json.loads(datei.read())


def auftritte(docs, texte):
    """{Ingame Name: [(Zeit, Bounty vor der Partie, Leader)]}, Mirrors ohne Seite fehlen."""
    aus = {}
    for doc in docs:
        seiten = F.log_spieler(texte.get(doc.get("path")))
        if len(seiten) != 2 or seiten[0][1] == seiten[1][1]:
            continue
        for name, leader in seiten:
            if leader == doc.get("winner_leader"):
                bounty = doc.get("winner_bounty")
            elif leader == doc.get("loser_leader"):
                bounty = doc.get("loser_bounty")
            else:
                continue
            if bounty is None:
                continue
            aus.setdefault(name, []).append((str(doc.get("timestamp")), float(bounty), leader))
    return aus


def fingerabdruck(liste):
    """(juengste Bounty, Menge der Leader) eines Namens."""
    juengste = max(liste)
    return juengste[1], {leader for _, _, leader in liste}


def kandidat(bounty, leader, beste, abstand, vorsprung):
    """user_id des passenden Spielers oder None."""
    nah = sorted((abs(e["bounty"] - bounty), str(e["user_id"]), e) for e in beste
                 if e.get("bounty") is not None and e.get("user_id") is not None)
    if not nah or nah[0][0] > abstand:
        return None
    if len(nah) > 1 and nah[1][0] - nah[0][0] < vorsprung:
        return None
    gespielt = {F.leader_kennung(l.get("leader") or "") for l in nah[0][2].get("leader") or []}
    if not leader <= gespielt:
        return None
    return nah[0][1]


def messen(abdruecke, beste, wahr, abstand, vorsprung):
    """(richtig, falsch, geprueft, Treffer ohne Beleg) fuer ein Parameterpaar."""
    richtig = falsch = geprueft = ohne_beleg = 0
    for name, (bounty, leader) in abdruecke.items():
        uid = kandidat(bounty, leader, beste, abstand, vorsprung)
        if name in wahr:
            geprueft += 1
            if uid is None:
                continue
            if uid == wahr[name]:
                richtig += 1
            else:
                falsch += 1
        elif uid is not None:
            ohne_beleg += 1
    return richtig, falsch, geprueft, ohne_beleg


def main():
    a = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    a.add_argument("--spieler", required=True)
    a.add_argument("--beste", required=True)
    a.add_argument("--ende", required=True, help="Zeitpunkt der Bestenliste, UTC")
    a.add_argument("--tage", type=int, default=F.TAGE)
    args = a.parse_args()

    paket = lesen(args.spieler)
    beste = lesen(args.beste)["spieler"]
    wahr = F.namen_lernen(paket["spieler"], paket["speicher"])
    grenze = min(e["bounty"] for e in beste if e.get("bounty") is not None) - F.BOUNTY_RAND
    ende = datetime.datetime.fromisoformat(args.ende)
    docs = [d for d in F.replays_suchen(Db(), ende, args.tage)
            if str(d.get("game_mode")) == "0"
            and max(float(d.get("winner_bounty") or 0), float(d.get("loser_bounty") or 0)) >= grenze]
    texte = F.parallel_laden([d["path"] for d in docs if d.get("path")], paket["speicher"])
    abdruecke = {n: fingerabdruck(l) for n, l in auftritte(docs, texte).items()}
    in_replays = sum(1 for n in wahr if n in abdruecke)
    print(f"{len(docs)} Replays, {len(abdruecke)} Ingame Namen, {len(wahr)} Belege, "
          f"davon {in_replays} in den Replays")
    print("Abstand Vorsprung  richtig falsch  Precision Recall  ohne Beleg")
    for abstand in ABSTAENDE:
        for vorsprung in VORSPRUENGE:
            r, f, g, o = messen(abdruecke, beste, wahr, abstand, vorsprung)
            prec = r / (r + f) if r + f else 0.0
            rec = r / g if g else 0.0
            mark = " *" if prec >= ZIEL_PRECISION and r else ""
            print(f"{abstand:7} {vorsprung:9}  {r:7} {f:6}  {prec:9.2f} {rec:6.2f}  {o:10}{mark}")


if __name__ == "__main__":
    main()
