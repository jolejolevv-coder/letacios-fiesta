#!/usr/bin/env python3
"""Warum finden 451 von 724 Replaypfaden keine Datei? Varianten durchprobieren.

Der Pfad wird aus `Public_matches` gebildet:

    Replays/{Woche}/{modus}/{sieger_leader}/{verlierer_leader}_{sieger_mmr}_{verlierer_mmr}.log

Beide Pfadbauer im Spiel, der zum Hochladen und der zum Herunterladen, sind
strukturell gleich. Der Unterschied liegt im Zeitpunkt: hochgeladen wird mit
`winner_bounty` aus den Matchdaten des Uploaders, gelesen wird hier die Bounty aus
der Partienzeile. Dazwischen liegt die Bountyaenderung der Partie, Position 20 und
21. Getestet werden deshalb mehrere Lesarten, statt eine zu raten.

Getestet wird mit HEAD, nicht mit GET: es geht um Existenz, nicht um Inhalt.

    python3 replay_pfad_probe.py --spieler 8
"""
import argparse
import datetime
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

WERKZEUGE = os.path.expanduser("~/Downloads/xebec-mirror-sim/tools")
HIER = os.path.dirname(os.path.abspath(__file__))

P_BOUNTY1, P_STATUS1, P_BOUNTY2, P_STATUS2 = 2, 5, 8, 11
P_MODUS, P_ZEIT, P_DECK1, P_DECK2, P_MOBIL = 15, 16, 17, 18, 19
P_DELTA1, P_DELTA2 = 20, 21


def leader_kennung(karte):
    text = str(karte or "")
    for marke in ("MY1x", "1x"):
        if text.startswith(marke):
            return text[len(marke):]
    return text


def woche(zeitstempel, versatz=0):
    """Die Wochenangabe des Spiels, nicht die ISO-Woche. `versatz` verschiebt sie,
    um die Grenzfaelle an Wochenwechseln zu pruefen."""
    try:
        tag = (datetime.datetime.fromisoformat(zeitstempel)
               if isinstance(zeitstempel, str)
               else datetime.datetime.utcfromtimestamp(float(zeitstempel)))
    except Exception:
        return None
    tag_im_jahr = tag.timetuple().tm_yday
    godot = (tag.weekday() + 1) % 7
    w = int((tag_im_jahr + 10 - (godot + 1) % 7) / 7) + versatz
    return f"{tag.year}-W{w:02d}"


def varianten(zeile):
    """Alle plausiblen Lesarten eines Pfades zu einer Partie."""
    try:
        gewonnen = str(zeile[P_STATUS1]).lower() == "win"
        s_leader = leader_kennung((zeile[P_DECK1] or [None])[0] if gewonnen
                                  else (zeile[P_DECK2] or [None])[0])
        v_leader = leader_kennung((zeile[P_DECK2] or [None])[0] if gewonnen
                                  else (zeile[P_DECK1] or [None])[0])
        b1, b2 = float(zeile[P_BOUNTY1]), float(zeile[P_BOUNTY2])
        d1 = float(zeile[P_DELTA1] or 0) if len(zeile) > P_DELTA1 else 0.0
        d2 = float(zeile[P_DELTA2] or 0) if len(zeile) > P_DELTA2 else 0.0
        s_roh, v_roh = (b1, b2) if gewonnen else (b2, b1)
        s_delta, v_delta = (d1, d2) if gewonnen else (d2, d1)
        modus = int(zeile[P_MODUS])
    except Exception:
        return []
    if not (s_leader and v_leader):
        return []

    zahlen = {
        "wie gespeichert": (int(s_roh), int(v_roh)),
        "plus delta": (int(s_roh + s_delta), int(v_roh + v_delta)),
        "minus delta": (int(s_roh - s_delta), int(v_roh - v_delta)),
        "gerundet": (round(s_roh), round(v_roh)),
    }
    # Sieger und Verlierer vertauscht. Der Ausgang steht als Text in der Zeile, und
    # falls dort etwas anderes als "win" steht, faellt meine Lesart auf die falsche
    # Seite; dann liegt die Datei im Ordner des anderen Leaders.
    zahlen_getauscht = {
        "vertauscht": (int(v_roh), int(s_roh)),
    }

    aus = []
    for zname, (sm, vm) in zahlen_getauscht.items():
        kw = woche(zeile[P_ZEIT])
        if kw:
            aus.append((f"Woche · {zname}",
                        f"Replays/{kw}/{modus}/{v_leader}/{s_leader}_{sm}_{vm}.log"))

    for wv in (0, -1, 1):
        kw = woche(zeile[P_ZEIT], wv)
        if not kw:
            continue
        wname = "Woche" if wv == 0 else f"Woche{wv:+d}"
        for zname, (sm, vm) in zahlen.items():
            aus.append((f"{wname} · {zname}",
                        f"Replays/{kw}/{modus}/{s_leader}/{v_leader}_{sm}_{vm}.log"))
    return aus


def existiert(pfad, eimer, gesehen):
    if pfad in gesehen:
        return gesehen[pfad]
    adresse = ("https://firebasestorage.googleapis.com/v0/b/" + eimer + "/o/"
               + urllib.parse.quote(pfad, safe="") + "?alt=media")
    anfrage = urllib.request.Request(adresse, method="HEAD")
    try:
        with urllib.request.urlopen(anfrage, timeout=20):
            gesehen[pfad] = True
    except urllib.error.HTTPError:
        gesehen[pfad] = False
    except Exception:
        gesehen[pfad] = False
    return gesehen[pfad]


def main():
    p = argparse.ArgumentParser(description="Replaypfade durchprobieren")
    p.add_argument("--spieler", type=int, default=8)
    a = p.parse_args()

    sys.path.insert(0, WERKZEUGE)
    from firestore_browser import Db, wert, entpacke
    import gzip
    import json

    with gzip.open(os.path.join(HIER, "public", "bestenliste.json.gz"), "rb") as d:
        beste = json.loads(d.read())["spieler"][:a.spieler]

    db = Db()
    eimer = db.c["storageBucket"]
    gesehen = {}
    treffer = {}
    partien = 0
    geloest = 0
    import collections
    nach_tag = collections.defaultdict(lambda: [0, 0])   # Tag -> [gefunden, fehlt]
    nach_modus = collections.defaultdict(lambda: [0, 0])
    nach_mobil = collections.defaultdict(lambda: [0, 0])
    nach_decklaenge = collections.defaultdict(lambda: [0, 0])
    fehlende = []
    ausgaenge = collections.Counter()

    for e in beste:
        d = db.dokument(f"PublicUsers/{e['user_id']}", felder=["Western"])
        west = entpacke(wert(d.get("fields", {}).get("Western")))
        for zeile in (west or {}).get("Public_matches") or []:
            vs = varianten(zeile)
            if not vs:
                continue
            partien += 1
            ausgaenge[(str(zeile[P_STATUS1]), str(zeile[P_STATUS2]))] += 1
            tag = str(zeile[P_ZEIT])[:10]
            modus = str(zeile[P_MODUS])
            gefunden = False
            for name, pfad in vs:
                if existiert(pfad, eimer, gesehen):
                    treffer[name] = treffer.get(name, 0) + 1
                    geloest += 1
                    gefunden = True
                    break
            nach_tag[tag][0 if gefunden else 1] += 1
            nach_modus[modus][0 if gefunden else 1] += 1
            nach_mobil[str(zeile[P_MOBIL]) if len(zeile) > P_MOBIL else "?"][
                0 if gefunden else 1] += 1
            # Wie vollstaendig ist die Deckliste? Eine leere oder kurze Liste
            # deutet darauf hin, dass der Client die Partie nicht mitgeschrieben hat.
            laenge = len(zeile[P_DECK1] or []) + len(zeile[P_DECK2] or [])
            eimer_name = "beide Decks voll" if laenge >= 30 else f"nur {laenge} Karten"
            nach_decklaenge[eimer_name][0 if gefunden else 1] += 1
            if not gefunden:
                fehlende.append(vs[0][1])

    print(f"\n  {partien} Partien geprueft, {geloest} aufgeloest "
          f"({100 * geloest // max(partien, 1)} Prozent)\n")
    for name, n in sorted(treffer.items(), key=lambda x: -x[1]):
        print(f"    {n:4}x  {name}")
    if not treffer:
        print("    keine Variante trifft")

    print("\n  nach Tag (gefunden / fehlt):")
    for tag in sorted(nach_tag):
        g, f = nach_tag[tag]
        print(f"    {tag}   {g:3} / {f:3}")

    print("\n  nach Modus (gefunden / fehlt):")
    for m in sorted(nach_modus):
        g, f = nach_modus[m]
        print(f"    Modus {m}   {g:3} / {f:3}")

    print("\n  nach Mobilkennzeichen (gefunden / fehlt):")
    for k in sorted(nach_mobil, key=str):
        g, f = nach_mobil[k]
        print(f"    {k!r:8} {g:3} / {f:3}")

    print("\n  nach Decklistenlaenge (gefunden / fehlt):")
    for k in sorted(nach_decklaenge):
        g, f = nach_decklaenge[k]
        print(f"    {k:20} {g:3} / {f:3}")

    print("\n  Ausgangswerte in den Zeilen:")
    for k, n in sorted(ausgaenge.items(), key=lambda x: -x[1]):
        print(f"    {n:4}x  {k!r}")

    print("\n  Beispiele fuer fehlende Pfade:")
    for pfad in fehlende[:5]:
        print("    " + pfad)


if __name__ == "__main__":
    main()
