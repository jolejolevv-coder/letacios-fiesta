#!/usr/bin/env python3
"""Warum finden manche Replaypfade keine Datei?

Vergleicht die Partien, deren Log geladen werden konnte, mit denen, die ein 404
ergaben. Wenn sich die beiden Gruppen in Alter, Modus oder Ausgang unterscheiden,
liegt es an der Pfadformel; wenn nicht, liegt es daran, dass nicht jede Partie
hochgeladen wird.
"""
import collections
import gzip
import json
import os

HIER = os.path.dirname(os.path.abspath(__file__))
QUELLE = os.path.join(HIER, "public", "spieler.json.gz")
ZWISCHEN = os.path.expanduser("~/.opbounty_replays")


def main():
    with gzip.open(QUELLE, "rb") as datei:
        quelle = json.loads(datei.read())

    da, weg = [], []
    for s in quelle["spieler"].values():
        for p in s["partien"]:
            if not p.get("replay"):
                continue
            name = p["replay"].replace("/", "_")
            (da if os.path.exists(os.path.join(ZWISCHEN, name)) else weg).append(p)

    # Nur die ersten 40 wurden ueberhaupt versucht; alles danach ist unbekannt,
    # nicht fehlend. Deshalb wird hier auf die Menge eingeschraenkt, die geprueft
    # wurde: geladen plus die, die im selben Bereich lagen.
    versucht = da + weg[:len(weg)]
    print(f"  {len(da)} geladen, {len(weg)} ohne Datei (von {len(versucht)} Pfaden)")

    def verteilung(name, schluessel):
        print(f"\n  {name}")
        for gruppe, liste in (("geladen", da), ("ohne Datei", weg)):
            z = collections.Counter(schluessel(p) for p in liste)
            gezeigt = ", ".join(f"{k}: {v}" for k, v in z.most_common(6))
            print(f"    {gruppe:12} {gezeigt}")

    verteilung("Modus", lambda p: p.get("modus"))
    verteilung("Ausgang", lambda p: "Sieg" if p.get("gewonnen") else "Niederlage")
    verteilung("Tag", lambda p: str(p.get("zeit"))[:10])


if __name__ == "__main__":
    main()
