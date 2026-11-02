#!/usr/bin/env python3
"""Wochendateien von Card Kaizoku holen (Stufe B, specs/features/kaizoku-daten.md).

Aus dem Manifest: Kartenwerte (`cardstats`), Starthände (`hands`), Techkarten je Matchup
(`matchuptech`) und die Zugkurve (`curve`). Alles Gesamtzahlen ohne Spielerbezug. Die
Bestenliste von Kaizoku (`leaderboard`) holen wir nicht: sie besteht aus Spielernamen.

Ausgabe: `public/kaizoku_b.json.gz`, je Leader die Teile `karten`, `hand`, `tech`, `kurve`.
Die Datei wird getrennt von `kaizoku.json.gz` ausgeliefert und erst geladen, wenn der
Leader geöffnet wird. Wird beim Bauen mit verschlüsselt und liegt nicht im Repo.

    python3 kaizoku_wochen.py
"""
import gzip
import json
import os
import sys
import time

from bestenliste_api import ApiFehler, anfrage
from kaizoku_holen import ABSTAND_S, BASIS, DATENSATZ, PUBLIC

KURVE_SATZ = "lw"              # die Zugkurve führt nur die letzte Woche
KURVE_MODUS = 0                # 0 ist Ranked
KARTEN_JE_LEADER = 40          # Kartenwerte, nach Nutzung
HAND_JE_LEADER = 20
TECH_JE_GEGNER = 3
TECH_GEGNER_JE_LEADER = 12     # Gegner mit den meisten Techkarten Treffern
KURVE_ZUEGE = 8                # Zug 1 bis 8, spätere Züge sind selten und streuen
MINDEST_LEADER = 30
ZIEL = os.path.join(PUBLIC, "kaizoku_b.json.gz")
# Zu jedem Datensatz aus kaizoku_holen die Datei mit den Kartenteilen.
ZIELE = {DATENSATZ: ZIEL, DATENSATZ + "_top20": os.path.join(PUBLIC, "kaizoku_top_b.json.gz")}


def pfad_holen(manifest, art, satz):
    try:
        return manifest["simStats"]["files"][art][satz]["current"]
    except (KeyError, TypeError) as fehler:
        raise ApiFehler(f"Manifest ohne {art}/{satz}: {fehler!r}") from fehler


def karten_bauen(eintrag):
    """[[Karte, Nutzung, Siegquote mit Karte, mittlere Kopien]], nach Nutzung."""
    zeilen = []
    for k in eintrag.get("cards") or []:
        try:
            zeilen.append([k["card"], round(k["usage_rate"], 4), round(k["win_rate"], 4),
                           round(k.get("avg_copies_when_included") or 0, 2)])
        except (KeyError, TypeError):
            continue
    return sorted(zeilen, key=lambda z: -z[1])[:KARTEN_JE_LEADER]


def hand_bauen(eintrag):
    """[[Karte, Anteil der Starthände]] nach Anteil."""
    zeilen = []
    for k in eintrag.get("common_cards") or []:
        try:
            zeilen.append([k["card"], round(k["appearance_rate"], 4)])
        except (KeyError, TypeError):
            continue
    return sorted(zeilen, key=lambda z: -z[1])[:HAND_JE_LEADER]


def tech_bauen(eintraege):
    """{Leader: {Gegner: [[Karte, Aufschlag]]}}: Karten, die dem Sieger gegen diesen Gegner
    nach Kaizokus eigener Prüfung (`has_strong_evidence`) am meisten bringen."""
    je = {}
    for e in eintraege:
        try:
            sieger, gegner = e["winnerLeaderKey"], e["loserLeaderKey"]
        except (KeyError, TypeError):
            continue
        karten = [t for t in e.get("tech_cards") or [] if t.get("has_strong_evidence")]
        karten.sort(key=lambda t: -(t.get("conservative_lift") or 0))
        if karten:
            je.setdefault(sieger, {})[gegner] = [
                [t["card"], round(t.get("conservative_lift") or 0, 3)] for t in karten[:TECH_JE_GEGNER]]
    # nur die Gegner mit den meisten Treffern behalten
    for sieger, gegner in je.items():
        beste = sorted(gegner.items(), key=lambda kv: -len(kv[1]))[:TECH_GEGNER_JE_LEADER]
        je[sieger] = dict(beste)
    return je


def kurve_bauen(eintrag):
    """{first: [[Zug, [[Kombi, Anteil]]]], second: ...} ohne Aufschlüsselung nach Gegner."""
    aus = {}
    for seite in ("first", "second"):
        zuege = []
        for t in sorted(eintrag.get(seite) or [], key=lambda t: t.get("turn") or 0)[:KURVE_ZUEGE]:
            top = [[x["combo"], round(x["rate_all"], 3)] for x in t.get("overall_top3") or []
                   if "combo" in x and "rate_all" in x]
            if top:
                zuege.append([t.get("turn"), top])
        aus[seite] = zuege
    return aus


def paket_bauen(cardstats, hands, matchuptech, kurve, stand, datensatz=DATENSATZ):
    if not isinstance(cardstats, list) or len(cardstats) < MINDEST_LEADER:
        raise ApiFehler("Kartenwerte in unbekannter Form")
    leader = {}
    for e in cardstats:
        lid = e.get("leaderKey")
        if lid:
            leader[lid] = {"karten": karten_bauen(e), "hand": [], "tech": {}, "kurve": {}}
    for e in hands if isinstance(hands, list) else []:
        if e.get("leaderKey") in leader:
            leader[e["leaderKey"]]["hand"] = hand_bauen(e)
    for sieger, gegner in tech_bauen(matchuptech if isinstance(matchuptech, list) else []).items():
        if sieger in leader:
            leader[sieger]["tech"] = gegner
    for e in kurve if isinstance(kurve, list) else []:
        if e.get("gameMode") == KURVE_MODUS and e.get("leader") in leader:
            leader[e["leader"]]["kurve"] = kurve_bauen(e)
    return {"stand": stand, "datensatz": datensatz, "leader": leader}


def holen(datensatz=DATENSATZ, schlafen=time.sleep, **hilfen):
    manifest = anfrage(BASIS + "manifest.json", schlafen=schlafen, **hilfen)
    pfade = [pfad_holen(manifest, "cardstats", datensatz), pfad_holen(manifest, "hands", datensatz),
             pfad_holen(manifest, "matchuptech", datensatz), pfad_holen(manifest, "curve", KURVE_SATZ)]
    teile = []
    for pfad in pfade:
        schlafen(ABSTAND_S)
        teile.append(anfrage(BASIS + pfad, schlafen=schlafen, **hilfen))
    return paket_bauen(*teile, manifest["simStats"]["date"], datensatz)


def schreiben(datensatz, ziel):
    paket = holen(datensatz)
    os.makedirs(os.path.dirname(ziel), exist_ok=True)
    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(ziel, "wb", compresslevel=9) as datei:
        datei.write(roh)
    print(f"  Kaizoku Wochendateien {datensatz} vom {paket['stand']}: {len(paket['leader'])} Leader, "
          f"{len(roh) // 1024} KB roh, {os.path.getsize(ziel) // 1024} KB gepackt")


def main():
    """Jeder Datensatz einzeln: fehlt einer, bleibt der andere."""
    fehlgeschlagen = 0
    for datensatz, ziel in ZIELE.items():
        try:
            schreiben(datensatz, ziel)
        except ApiFehler as fehler:
            print(f"  Kaizoku Wochendateien {datensatz} nicht geholt: {fehler}", file=sys.stderr)
            fehlgeschlagen += 1
    return 1 if fehlgeschlagen == len(ZIELE) else 0


if __name__ == "__main__":
    sys.exit(main())
