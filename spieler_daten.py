#!/usr/bin/env python3
"""Je Spieler der Bestenliste die letzten Partien holen: Decklisten und Replaypfade.

Quelle ist `PublicUsers/<user_id>`, das gepackte Feld `Western`. Darin steht
`Public_matches`, ein Schnappschuss der letzten neun Partien mit 27 Positionen je
Zeile. Die Bedeutung ist zurueckgerechnet und in docs/opbounty-datenmodell.md
festgehalten; hier die Positionen, die gebraucht werden:

     0 username1     2 bounty1     5 status1    14 duration   17 deck1
     6 username2     8 bounty2    11 status2    15 game_mode  18 deck2
    16 timestamp    24 user_id1   25 user_id2

Der Replaypfad ist daraus berechenbar, der Client bildet ihn genauso:

    Replays/{ISO-Woche}/{game_mode}/{sieger_leader}/{verlierer_leader}_{sieger_mmr}_{verlierer_mmr}.log

**Harte Grenze:** neun Partien je Spieler, mehr schreibt der Server nicht ins Profil.
Der Bestand waechst nur mit den Laeufen, nicht rueckwirkend. Deshalb wird auch hier
fortgeschrieben statt ersetzt.

**Personenbezug:** gelesen wird ausschliesslich `PublicUsers`, nie `Users`. Es wird nur
uebernommen, was fuer Decklisten und Replays gebraucht wird.

    python3 spieler_daten.py            # alle aus der Bestenliste
    python3 spieler_daten.py --grenze 5 # nur die ersten fuenf, zum Ausprobieren
"""
import argparse
import datetime
import difflib
import gzip
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from firestore import Db, wert, entpacke  # noqa: E402

HIER = os.path.dirname(os.path.abspath(__file__))
BESTE = os.path.join(HIER, "public", "bestenliste.json.gz")
ZIEL = os.path.join(HIER, "public", "spieler.json.gz")

# Positionen in einer Zeile von Public_matches.
P_NAME1, P_BOUNTY1, P_STATUS1 = 0, 2, 5
P_NAME2, P_BOUNTY2, P_STATUS2 = 6, 8, 11
P_DAUER, P_MODUS, P_ZEIT, P_DECK1, P_DECK2 = 14, 15, 16, 17, 18
P_ID1, P_ID2 = 24, 25

# Seit dem 20.10.2026 liest der Bazzite die Bestenliste vom Bildschirm, und dort steht keine
# user_id. Nachgeschlagen wird sie hier: PublicUsers traegt je Spieler eine gespeicherte
# Platzierung (Position.Western, nicht tagesaktuell), und in den eigenen Partien steht der
# eigene Name. Wer je unter den ersten POSITION_GRENZE stand, kommt in die Namenstabelle.
POSITION_GRENZE = 300
NAMEN_AEHNLICH = 0.8         # wie in werkzeuge/bestenliste_ocr.py


def leader_kennung(karte):
    """Aus 'MY1xOP14-020' die reine Kartennummer machen."""
    text = str(karte or "")
    for marke in ("MY1x", "1x"):
        if text.startswith(marke):
            return text[len(marke):]
    return text


def woche(zeitstempel):
    """Die Wochenangabe des Replaypfads.

    **Das ist nicht die ISO-Woche.** Das Spiel rechnet sie selbst, in
    `_get_iso_week_from_unix_time`, und die Formel weicht ab:

        week = int((Tag_im_Jahr + 10 - (Wochentag + 1) % 7) / 7)

    mit Godots Wochentagszaehlung, in der die Null der Sonntag ist. Fuer den
    01.09.2026 ergibt das 35, waehrend die echte ISO-Woche 36 waere. Wer hier
    `isocalendar()` nimmt, bekommt vom Storage ein sauberes 404 und sucht den Fehler
    danach an der falschen Stelle; genau das ist am 01.09.2026 passiert.
    """
    try:
        if isinstance(zeitstempel, str):
            tag = datetime.datetime.fromisoformat(zeitstempel)
        else:
            tag = datetime.datetime.utcfromtimestamp(float(zeitstempel))
    except Exception:
        return None
    tag_im_jahr = tag.timetuple().tm_yday
    godot_wochentag = (tag.weekday() + 1) % 7      # 0 ist Sonntag
    w = int((tag_im_jahr + 10 - (godot_wochentag + 1) % 7) / 7)
    return f"{tag.year}-W{w:02d}"


# Was im Spiel als Niederlage zaehlt. Aus `_is_loss_status` im Spielcode: neben
# "loss" auch die beiden Trennungsarten.
NIEDERLAGE = ("loss", "dc", "selfdc")


def sieger_seite(zeile):
    """1 oder 2, oder None wenn es keinen eindeutigen Sieger gibt.

    Nachgebaut aus `_winner_player_index` im Spielcode. Wichtig ist der Fall, dass
    BEIDE Seiten kein "win" tragen, etwa "selfdc" gegen "selfdc": dann gibt es keinen
    Sieger, das Spiel bildet gar keinen Pfad und laedt auch nichts hoch. Wer hier
    stumpf "nicht gewonnen heisst verloren" rechnet, baut einen Pfad auf eine Datei,
    die es nie geben wird.
    """
    s1 = str(zeile[P_STATUS1]).lower()
    s2 = str(zeile[P_STATUS2]).lower()
    if s1 == "win" and s2 in NIEDERLAGE:
        return 1
    if s2 == "win" and s1 in NIEDERLAGE:
        return 2
    return None


def replaypfad(zeile):
    """Den Storagepfad einer Partie bilden, oder None wenn Angaben fehlen."""
    try:
        seite = sieger_seite(zeile)
        if seite is None:
            return None
        gewonnen = seite == 1
        sieger = leader_kennung((zeile[P_DECK1] or [None])[0] if gewonnen
                               else (zeile[P_DECK2] or [None])[0])
        verlierer = leader_kennung((zeile[P_DECK2] or [None])[0] if gewonnen
                                   else (zeile[P_DECK1] or [None])[0])
        # Die Bounty steht im Dateinamen als ganze Zahl. Das Spiel schneidet ab,
        # `int(_bounty_for_match_player(...))`, es rundet nicht. Aus 3681.3 wird
        # 3681; mit der Nachkommastelle gibt es ein 404.
        s_mmr = int(float(zeile[P_BOUNTY1] if gewonnen else zeile[P_BOUNTY2]))
        v_mmr = int(float(zeile[P_BOUNTY2] if gewonnen else zeile[P_BOUNTY1]))
        kw = woche(zeile[P_ZEIT])
        if not (sieger and verlierer and kw):
            return None
        return (f"Replays/{kw}/{int(zeile[P_MODUS])}/{sieger}/"
                f"{verlierer}_{s_mmr}_{v_mmr}.log")
    except Exception:
        return None


def partie(zeile, eigene_id):
    """Eine Zeile aus Public_matches in das eigene, schlanke Format bringen.

    Die Zeile fuehrt zwei Seiten, und welche dem Profil gehoert, steht nicht fest:
    entschieden wird ueber die user_id auf Position 24 und 25. Wer stattdessen immer
    Seite eins nimmt, traegt bei der Haelfte der Partien den Spieler als seinen
    eigenen Gegner ein.
    """
    if not isinstance(zeile, list) or len(zeile) < 26:
        return None
    zweite_seite = str(zeile[P_ID2]) == str(eigene_id)
    if zweite_seite:
        mein_status, mein_deck = zeile[P_STATUS2], zeile[P_DECK2]
        gegner, gegner_id, gegner_deck = zeile[P_NAME1], zeile[P_ID1], zeile[P_DECK1]
    else:
        mein_status, mein_deck = zeile[P_STATUS1], zeile[P_DECK1]
        gegner, gegner_id, gegner_deck = zeile[P_NAME2], zeile[P_ID2], zeile[P_DECK2]

    deck = [leader_kennung(k) for k in (mein_deck or [])]
    return {
        "zeit": zeile[P_ZEIT],
        "modus": zeile[P_MODUS],
        "gewonnen": str(mein_status).lower() == "win",
        "dauer": zeile[P_DAUER],
        "gegner": gegner,
        "gegner_id": gegner_id,
        "eigener_leader": deck[0] if deck else None,
        "gegner_leader": leader_kennung((gegner_deck or [None])[0]),
        "deck": deck,
        "replay": replaypfad(zeile),
    }


def holen(db, user_id):
    d = db.dokument(f"PublicUsers/{user_id}", felder=["Western"])
    west = entpacke(wert(d.get("fields", {}).get("Western")))
    if not west:
        return None
    partien = [partie(z, user_id) for z in (west.get("Public_matches") or [])]
    return {
        "siege": west.get("Wins"),
        "niederlagen": west.get("Losses"),
        "winrate": west.get("Winrate"),
        "partien": [p for p in partien if p],
    }


def kandidaten(db):
    """user_ids aller, die in PublicUsers eine Western Platzierung bis POSITION_GRENZE tragen.
    Nur das Feld User_id wird gelesen."""
    frage = {"structuredQuery": {
        "from": [{"collectionId": "PublicUsers"}],
        "where": {"compositeFilter": {"op": "AND", "filters": [
            {"fieldFilter": {"field": {"fieldPath": "Position.Western"}, "op": "GREATER_THAN",
                             "value": {"integerValue": "0"}}},
            {"fieldFilter": {"field": {"fieldPath": "Position.Western"},
                             "op": "LESS_THAN_OR_EQUAL",
                             "value": {"integerValue": str(POSITION_GRENZE)}}}]}},
        "select": {"fields": [{"fieldPath": "User_id"}]},
        "limit": 4 * POSITION_GRENZE}}
    r = urllib.request.Request(db.basis + ":runQuery", data=json.dumps(frage).encode(),
                               method="POST")
    r.add_header("Authorization", "Bearer " + db.tok)
    r.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(r, timeout=120) as antwort:
        treffer = json.loads(antwort.read().decode())
    return [str(wert(d["document"]["fields"]["User_id"]))
            for d in treffer if "document" in d and "User_id" in d["document"].get("fields", {})]


WR_TOLERANZ = 0.15           # Prozentpunkte; das Spiel rundet auf eine Nachkommastelle
MIN_FINGERABDRUCK = 2        # so viele Leader muessen mit Winrate passen


def steckbrief(db, user_id):
    """{"name": eigener Name aus den Partien, "leader": {Kennung: Winrate}} oder None.

    Die Leader stehen in `Western.Leaders` mit Wins und Losses. Die Winrate daraus ist
    dieselbe, die die Bestenliste neben dem Leaderbild zeigt (am 20.10.2026 fuer Rang 1
    auf die Kommastelle gleich: 86.7, 76.9, 0.0). Der Name in den Partien kann veraltet sein;
    wer sich umbenennt, behaelt seine user_id."""
    d = db.dokument(f"PublicUsers/{user_id}", felder=["Western"])
    west = entpacke(wert(d.get("fields", {}).get("Western"))) or {}
    name = None
    for z in west.get("Public_matches") or []:
        if isinstance(z, list) and len(z) >= 26:
            if str(z[P_ID1]) == str(user_id):
                name = z[P_NAME1]
                break
            if str(z[P_ID2]) == str(user_id):
                name = z[P_NAME2]
                break
    leader = {}
    for l in (west.get("Leaders") or [])[:3]:
        w, v = l.get("Wins", 0), l.get("Losses", 0)
        leader[leader_kennung(l.get("Leader", ""))] = round(100 * w / (w + v), 1) if w + v else 0.0
    if not name and not leader:
        return None
    return {"name": name, "leader": leader}


def namen_tabelle_ergaenzen(db, namen, bestand):
    """{user_id: Steckbrief} fuer alle Kandidaten neu holen. Die Winrates aendern sich jeden
    Tag, deshalb wird nicht zwischengespeichert, was schon drinsteht.

    Kandidaten sind, wer in PublicUsers eine Western Platzierung bis POSITION_GRENZE traegt,
    und jeder Gegner in den Partien der bekannten Spieler: wer gegen die Top 100 spielt, steht
    meist selbst weit oben."""
    gegner = {str(p["gegner_id"]) for d in bestand.values() for p in d.get("partien", [])
              if p.get("gegner_id") is not None}
    neu = 0
    for uid in sorted(set(kandidaten(db)) | gegner):
        try:
            s = steckbrief(db, uid)
        except Exception:
            continue
        if s:
            namen[uid] = s
            neu += 1
    return neu


def fingerabdruck_passt(eintrag, steck):
    """Wie viele der gelesenen Leader stimmen mit Winrate ueberein?"""
    passend = 0
    for l in eintrag.get("leader") or []:
        wr = steck.get("leader", {}).get(l.get("leader"))
        if wr is not None and l.get("winrate") is not None and abs(wr - l["winrate"]) <= WR_TOLERANZ:
            passend += 1
    return passend


def ids_nachtragen(beste, namen):
    """Eintraegen ohne user_id die id geben: erst ueber Leader und Winrate (eindeutig und
    mindestens MIN_FINGERABDRUCK Treffer, bei nur einem Leader dieser eine), dann ueber den
    Namen. Gibt die Zahl der Treffer."""
    vergeben = {str(e["user_id"]) for e in beste if e.get("user_id") is not None}
    treffer = 0
    for e in beste:
        if e.get("user_id") is not None:
            continue
        noetig = min(MIN_FINGERABDRUCK, len(e.get("leader") or []))
        kandidat = None
        if noetig:
            passende = [uid for uid, s in namen.items()
                        if uid not in vergeben and fingerabdruck_passt(e, s) >= noetig]
            if len(passende) == 1:
                kandidat = passende[0]
        if kandidat is None and e.get("name"):
            nach_name = {s.get("name"): uid for uid, s in namen.items()
                         if s.get("name") and uid not in vergeben}
            kandidat = nach_name.get(e["name"])
            if kandidat is None:
                nah = difflib.get_close_matches(e["name"], list(nach_name), n=1, cutoff=NAMEN_AEHNLICH)
                kandidat = nach_name[nah[0]] if nah else None
        if kandidat is not None:
            e["user_id"] = int(kandidat)
            vergeben.add(kandidat)
            treffer += 1
    return treffer


def alt_laden():
    """(Spielerdaten, Namenstabelle) aus dem letzten Lauf."""
    if not os.path.exists(ZIEL):
        return {}, {}
    try:
        with gzip.open(ZIEL, "rb") as datei:
            alt = json.loads(datei.read())
        return alt.get("spieler", {}), alt.get("namen", {})
    except Exception:
        return {}, {}


def main():
    p = argparse.ArgumentParser(description="Spielerdaten holen")
    p.add_argument("--grenze", type=int, default=0)
    a = p.parse_args()

    from verschluesseln import lesen
    paket_beste = json.loads(gzip.decompress(lesen(BESTE)))
    beste = paket_beste["spieler"]

    db = Db()
    bestand, namen = alt_laden()
    if any(e.get("user_id") is None for e in beste):
        try:
            print(f"  Namenstabelle: {namen_tabelle_ergaenzen(db, namen, bestand)} geholt, {len(namen)} bekannt")
        except Exception as f:
            print(f"  Namenstabelle nicht ergaenzt: {type(f).__name__}")
        print(f"  user_id nachgetragen: {ids_nachtragen(beste, namen)}, "
              f"ohne: {sum(1 for e in beste if e.get('user_id') is None)}")
        # Die ergaenzte Bestenliste im Klartext ablegen; der Schritt "Daten verschluesseln"
        # macht daraus die Fassung, die ausgeliefert wird. Ins Repo geht sie nicht.
        with gzip.open(BESTE, "wb", compresslevel=9) as datei:
            datei.write(json.dumps(paket_beste, ensure_ascii=False, separators=(",", ":")).encode())
    if a.grenze:
        beste = beste[:a.grenze]
    neu = fehler = 0
    for i, e in enumerate(beste, 1):
        if e.get("user_id") is None:
            continue
        kennung = str(e.get("user_id"))
        try:
            d = holen(db, kennung)
        except Exception:
            d = None
        if not d:
            fehler += 1
            continue
        d["name"] = e.get("name")
        bestand[kennung] = d
        neu += 1
        if i % 20 == 0:
            print(f"  {i} von {len(beste)}")

    # Der Speicherort der Replays gehoert in die Datei, damit die Seite die Adresse
    # bilden kann, ohne ihn zu kennen.
    paket = {"stand": datetime.date.today().isoformat(),
             "speicher": db.c["storageBucket"], "spieler": bestand, "namen": namen}
    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(ZIEL, "wb", compresslevel=9) as datei:
        datei.write(roh)
    print(f"  {neu} Spieler geholt, {fehler} ohne Daten, {len(bestand)} im Bestand")
    print(f"  {len(roh) // 1024} KB roh, {os.path.getsize(ZIEL) // 1024} KB gepackt")

    sys.path.insert(0, HIER)
    from bestenliste_einbauen import seitenpasswort
    from verschluesseln import salz_holen, schluessel, verschluesseln

    passwort = seitenpasswort()
    if not passwort:
        print("  kein SEITEN_PASSWORT, keine verschluesselte Fassung")
        return
    with open(ZIEL, "rb") as datei:
        klar = datei.read()
    with open(ZIEL + ".enc", "wb") as datei:
        datei.write(verschluesseln(schluessel(passwort, salz_holen()), klar))
    print(f"  verschluesselt -> {ZIEL}.enc "
          f"({os.path.getsize(ZIEL + '.enc') // 1024} KB)")


if __name__ == "__main__":
    main()
