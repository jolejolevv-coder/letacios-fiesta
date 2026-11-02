#!/usr/bin/env python3
"""Statistik und Decklisten von Card Kaizoku holen (Stufe A, specs/features/kaizoku-daten.md).

Ablauf wie im Vorbild `alexfrey317/optcg-data`: `manifest.json` nennt je Datensatz die
Tagesdateien, geholt werden `stats/stats_<satz>_<datum>.json` und
`stats/decklist_<satz>_<datum>.json` von `cdn.cardkaizoku.com`. Beides sind Gesamtzahlen
ohne Spielerbezug. Wir melden uns als Bot mit Projektlink, halten 0,4 Sekunden Abstand
und wiederholen nur bei Überlastung (siehe `bestenliste_api.anfrage`).

Ausgabe: `public/kaizoku.json.gz`, je Leader die Kopfzahlen und die Listen mit ihrer
Bilanz je Gegnerleader. Die Datei wird beim Bauen mit verschlüsselt und liegt nicht im Repo.

    python3 kaizoku_holen.py
"""
import ast
import gzip
import json
import os
import sys
import time

from bestenliste_api import ApiFehler, anfrage

BASIS = "https://cdn.cardkaizoku.com/"
DATENSATZ = "eb05_lw_p"        # aktuelle Woche, Standardformat OP17 + EB05 (bis 02.11.2026 op17_lw_p)
ABSTAND_S = 0.4                # Pause zwischen zwei Abrufen, wie im Vorbild
MINDEST_LEADER = 30            # weniger gilt als kaputte Antwort
LISTEN_JE_LEADER = 20          # Kaizoku führt je Leader bis zu 20 beste und 20 meistgespielte
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "kaizoku.json.gz")


def pfade_holen(manifest, datensatz=DATENSATZ):
    """Die Pfade der Tagesdateien für Statistik und Decklisten aus dem Manifest."""
    try:
        dateien = manifest["simStats"]["files"]
        return (manifest["simStats"]["date"],
                dateien["stats"][datensatz]["current"],
                dateien["decklist"][datensatz]["current"])
    except (KeyError, TypeError) as fehler:
        raise ApiFehler(f"Manifest ohne Datensatz {datensatz}: {fehler!r}") from fehler


def _zahl(wert):
    """Die Decklisten führen ihre Zahlen als Text."""
    try:
        return float(wert)
    except (TypeError, ValueError):
        return 0.0


def gegner_lesen(text):
    """`matchup_stats` einer Liste: ein Python Literal als Text. [[Gegner, Partien, Siege]]."""
    if isinstance(text, str):
        try:
            text = ast.literal_eval(text)
        except (ValueError, SyntaxError):
            return []
    zeilen = []
    for z in text if isinstance(text, list) else []:
        try:
            zeilen.append([z["oppLeaderKey"], int(z["games_played"]), int(z["wins"])])
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(zeilen, key=lambda z: -z[1])


def listen_bauen(eintrag):
    """Beste und meistgespielte Listen eines Leaders, gleiche Karten nur einmal."""
    gesehen, listen = set(), []
    for art in ("best_decklists", "most_played_decklists"):
        for roh in (eintrag.get(art) or [])[:LISTEN_JE_LEADER]:
            karten = [k for k in str(roh.get("decklist", "")).split("\n") if k]
            schluessel = "|".join(sorted(karten))
            if not karten or schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            partien = int(_zahl(roh.get("total_games")))
            listen.append({
                "d": karten,
                "pilot": int(_zahl(roh.get("unique_pilots"))),
                "w": int(_zahl(roh.get("wins"))),
                "m": partien,
                "gegner": gegner_lesen(roh.get("matchup_stats")),
            })
    return sorted(listen, key=lambda li: -li["m"])


def paket_bauen(stats, decklisten, stand, datensatz=DATENSATZ):
    """Beide Dateien zu einem Paket je Leader zusammenführen. Wirft ApiFehler bei Unsinn."""
    if not isinstance(stats, list) or len(stats) < MINDEST_LEADER:
        raise ApiFehler(f"Statistik mit {len(stats) if isinstance(stats, list) else '?'} Leadern")
    if not isinstance(decklisten, list):
        raise ApiFehler("Decklisten in unbekannter Form")
    je_leader = {e.get("leaderKey"): e for e in decklisten if isinstance(e, dict)}
    leader = []
    for e in stats:
        try:
            lid = e["leaderKey"]
            leader.append({
                "id": lid, "name": e.get("leaderName"),
                "w": int(e["wins"]), "m": int(e["number_of_matches"]),
                "roh": float(e["raw_win_rate"]), "gewichtet": float(e["weighted_win_rate"]),
                "rate": float(e["play_rate"]),
                "first": e.get("first_win_rate"), "second": e.get("second_win_rate"),
                "gegner": sorted(
                    [[g["opponentKey"], int(g["total_games"]), int(g["wins"])]
                     for g in e.get("matchups", []) if g.get("total_games")],
                    key=lambda g: -g[1]),
                "listen": listen_bauen(je_leader.get(lid, {})),
            })
        except (KeyError, TypeError, ValueError) as fehler:
            raise ApiFehler(f"Statistikzeile in unbekannter Form: {fehler!r}") from fehler
    leader.sort(key=lambda z: -z["m"])
    return {"stand": stand, "datensatz": datensatz,
            "partien": max((int(e.get("total_matches", 0)) for e in stats), default=0),
            "leader": leader}


def holen(datensatz=DATENSATZ, schlafen=time.sleep, **hilfen):
    """Manifest, Statistik und Decklisten abrufen und zum Paket verbinden."""
    manifest = anfrage(BASIS + "manifest.json", schlafen=schlafen, **hilfen)
    stand, stats_pfad, liste_pfad = pfade_holen(manifest, datensatz)
    schlafen(ABSTAND_S)
    stats = anfrage(BASIS + stats_pfad, schlafen=schlafen, **hilfen)
    schlafen(ABSTAND_S)
    decklisten = anfrage(BASIS + liste_pfad, schlafen=schlafen, **hilfen)
    return paket_bauen(stats, decklisten, stand, datensatz)


def main():
    try:
        paket = holen()
    except ApiFehler as fehler:
        print(f"  Kaizoku nicht geholt: {fehler}", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(ZIEL, "wb", compresslevel=9) as datei:
        datei.write(roh)
    listen = sum(len(e["listen"]) for e in paket["leader"])
    print(f"  Kaizoku {paket['datensatz']} vom {paket['stand']}: {len(paket['leader'])} Leader, "
          f"{listen} Listen, {len(roh) // 1024} KB roh, {os.path.getsize(ZIEL) // 1024} KB gepackt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
