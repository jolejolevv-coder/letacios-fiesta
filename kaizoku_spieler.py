#!/usr/bin/env python3
"""Decklisten und Bilanz der Top 100 von Card Kaizoku holen (Stufe C, specs/features/kaizoku-daten.md).

Die Nutzerfreigabe vom 02.11.2026 deckt diese Stufe: es gehen nur die Namen der Top 100 der
Bestenliste an `api.cardkaizoku.com`, nichts sonst.

  POST /search        {"searchTerm": name, "playerId": name} -> Partien von Spielern, deren Name
                      den Begriff enthält, mit Kaizoku Kennung `playerId` und vollem Namen.
  GET  /player-stats  ?playerId=..&startDate=..&endDate=.. -> je (Modus, privat) ein Eintrag mit
                      `deck_stats`, `leader_stats`, Zugreihenfolge.

Die Zuordnung ist der unsichere Teil: Suche ist Teilstring, Namen sind nicht eindeutig. Wir nehmen nur
Treffer, deren Name (ohne `#1234` und Nullbreitenzeichen) genau stimmt, und wählen unter mehreren den mit der
größten Überschneidung der Leader aus der Bestenliste. Stimmt kein Leader überein und es gibt mehrere
Treffer, bleibt der Spieler ohne Zuordnung. Geraten wird nicht.

Ausgabe: `public/kaizoku_spieler.json.gz`, Schlüssel ist unsere `user_id`. Wird beim Bauen
verschlüsselt, liegt nicht im Repo, im Log stehen nur Zahlen.

    python3 kaizoku_spieler.py
"""
import datetime
import gzip
import json
import os
import re
import sys
import time

from bestenliste_api import ApiFehler, anfrage, top_holen

API = "https://api.cardkaizoku.com"
ABSTAND_S = 0.4
FENSTER_TAGE = 28                 # Zeitraum der Decklisten
NULLBREIT = re.compile("[​‌‍⁠﻿]")
HANDLE_NUMMER = re.compile(r"#\d+\s*$")
MODUS_RANKED = 0
DECKS_JE_SPIELER = 12
GEGNER_JE_DECK = 8
LEADER_GEGNER = 10
MINDEST_ERFOLG = 1                # null zugeordnete Spieler gilt als Fehlschlag
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "kaizoku_spieler.json.gz")


def grundname(handle):
    """'Name​#1234' -> 'name' (kleingeschrieben, ohne Nullbreitenzeichen und Nummer)."""
    text = NULLBREIT.sub("", handle or "").strip()
    return HANDLE_NUMMER.sub("", text).strip().casefold()


def suchen(begriff, **hilfen):
    try:
        zeilen = anfrage(API + "/search", daten={"searchTerm": begriff, "playerId": begriff}, **hilfen)
    except ApiFehler as fehler:
        if "HTTP 400" in str(fehler) or "HTTP 404" in str(fehler):
            return []
        raise
    return zeilen if isinstance(zeilen, list) else []


def zuordnen(spieler, zeilen):
    """Aus den Suchtreffern die Kaizoku Kennung des Spielers wählen oder None."""
    namen = {n.casefold() for n in (spieler.get("name"), spieler.get("login")) if n}
    gesucht = {l["leader"]: l.get("partien") or 1 for l in spieler.get("leader") or [] if l.get("leader")}
    kandidaten = {}
    for z in zeilen:
        kid = z.get("playerId")
        if not kid or grundname(z.get("playerName")) not in namen:
            continue
        k = kandidaten.setdefault(kid, {"id": kid, "leader": {}, "ranked": 0})
        k["leader"][z.get("playerLeader")] = k["leader"].get(z.get("playerLeader"), 0) + 1
        if z.get("gameMode") == MODUS_RANKED:
            k["ranked"] += 1
    if not kandidaten:
        return None

    def wert(k):
        return (sum(gesucht.get(code, 0) for code in k["leader"]), k["ranked"])

    bester = max(kandidaten.values(), key=wert)
    if len(kandidaten) > 1 and wert(bester)[0] == 0:
        return None
    return bester["id"]


def statistik_holen(kennung, von, bis, **hilfen):
    try:
        daten = anfrage(f"{API}/player-stats?playerId={kennung}&startDate={von}&endDate={bis}", **hilfen)
    except ApiFehler as fehler:
        if "HTTP 400" in str(fehler) or "HTTP 404" in str(fehler):
            return []
        raise
    return daten if isinstance(daten, list) else []


def eimer_waehlen(eintraege):
    """Ladderpartien sind Ranked und privat. Ohne private nehmen wir irgendeinen Ranked Eintrag."""
    ranked = [e for e in eintraege if e.get("gameMode") == MODUS_RANKED]
    privat = [e for e in ranked if e.get("isPrivate")]
    pool = privat or ranked
    return max(pool, key=lambda e: e.get("total_matches") or 0) if pool else None


def _gegner(zeilen, grenze):
    aus = sorted(zeilen or [], key=lambda m: -(m.get("games_played") or 0))[:grenze]
    return [[m.get("oppLeaderKey") or m.get("oppLeader"), m.get("games_played") or 0, m.get("wins") or 0]
            for m in aus]


def form_bauen(eimer):
    """Kompakte Form: Kopfzahlen, Leader mit Gegnern, Decklisten mit Gegnern."""
    decks = []
    for d in eimer.get("deck_stats") or []:
        karten = [k for k in str(d.get("decklist", "")).split("\n") if k]
        if karten:
            decks.append({"leader": d.get("playerLeader"), "d": karten,
                          "m": d.get("games_played") or 0, "w": d.get("wins") or 0,
                          "gegner": _gegner(d.get("matchup_stats"), GEGNER_JE_DECK)})
    decks.sort(key=lambda d: -d["m"])
    leader = [{"id": l.get("playerLeader"), "m": l.get("games_played") or 0, "w": l.get("wins") or 0,
               "gegner": _gegner(l.get("matchup_stats"), LEADER_GEGNER)}
              for l in eimer.get("leader_stats") or []]
    leader.sort(key=lambda l: -l["m"])
    return {"m": eimer.get("total_matches") or 0, "w": eimer.get("total_wins") or 0,
            "leader": leader, "decks": decks[:DECKS_JE_SPIELER]}


def einen_holen(spieler, von, bis, **hilfen):
    """Zahlen eines Spielers oder None. Wirft nur ApiFehler bei Netzproblemen."""
    zeilen = []
    for begriff in dict.fromkeys(n for n in (spieler.get("name"), spieler.get("login")) if n):
        zeilen += suchen(begriff, **hilfen)
        hilfen.get("schlafen", time.sleep)(ABSTAND_S)
    kennung = zuordnen(spieler, zeilen)
    if not kennung:
        return None
    eimer = eimer_waehlen(statistik_holen(kennung, von, bis, **hilfen))
    hilfen.get("schlafen", time.sleep)(ABSTAND_S)
    if not eimer:
        return None
    # Gegenprobe: mindestens ein Leader aus der Bestenliste muss bei Kaizoku vorkommen.
    gesucht = {l["leader"] for l in spieler.get("leader") or [] if l.get("leader")}
    vorhanden = {l.get("playerLeader") for l in eimer.get("leader_stats") or []}
    if gesucht and vorhanden and not (gesucht & vorhanden):
        return None
    return form_bauen(eimer)


def alle_holen(spielerliste, heute=None, **hilfen):
    bis = heute or datetime.datetime.now(datetime.timezone.utc).date()
    von = bis - datetime.timedelta(days=FENSTER_TAGE)
    ergebnis, zaehler = {}, {"geprueft": 0, "gefunden": 0, "ohne": 0, "fehler": 0}
    for s in spielerliste:
        zaehler["geprueft"] += 1
        if s.get("user_id") is None:
            zaehler["ohne"] += 1
            continue
        try:
            form = einen_holen(s, von.isoformat(), bis.isoformat(), **hilfen)
        except ApiFehler:
            zaehler["fehler"] += 1
            continue
        if form:
            ergebnis[str(s["user_id"])] = form
            zaehler["gefunden"] += 1
        else:
            zaehler["ohne"] += 1
    return {"stand": bis.isoformat(), "tage": FENSTER_TAGE, "spieler": ergebnis}, zaehler


def main():
    try:
        paket, z = alle_holen(top_holen())
    except ApiFehler as fehler:
        print(f"  Kaizoku Spieler nicht geholt: {fehler}", file=sys.stderr)
        return 1
    if z["gefunden"] < MINDEST_ERFOLG:
        print(f"  Kaizoku Spieler: keiner zugeordnet ({z})", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(ZIEL, "wb", compresslevel=9) as datei:
        datei.write(roh)
    print(f"  Kaizoku Spieler: {z['gefunden']} von {z['geprueft']} zugeordnet, {z['fehler']} Fehler, "
          f"{len(roh) // 1024} KB roh, {os.path.getsize(ZIEL) // 1024} KB gepackt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
