#!/usr/bin/env python3
"""Die Bestenliste aus einem Mitschnitt der Spielverbindung lesen.

Der Weg: pcap lesen, ENet-Fragmente zusammensetzen, die Antworten auf
`send_leaderboard` heraussuchen und die Godot-Variantenkette darin auspacken.

Aufbau einer Antwort, aus dem Mitschnitt vom 01.09.2026 zurueckgerechnet:

    00        Befehlsart, 0 heisst entfernter Aufruf
    02        Knotennummer
    68        Methodennummer 104, das ist send_leaderboard
    08        Zahl der Argumente
    02 00     erstes Argument, der Seitenindex
    dann das erste Argument von Gewicht: ein Feld aus 20 Zeilen, jede Zeile
    selbst ein Feld aus neun Werten.

Eine Zeile:

    0  Loginname            5  is_marine         << wird verworfen
    1  Anzeigename          6  Discord-Kennung   << wird verworfen
    2  Bounty (double)      7  Land              << wird verworfen
    3  Rang                 8  Leaderaufstellung, gzip in base64
    4  user_id

Die Zuordnung ist nicht geraten, sie steht in `update_leaderboard` im Spielcode:
`row[1]` wird der Anzeigename, `row[2]` die Bounty, `row[3]` die angezeigte Nummer,
`row[4]` die `user_id`, `row[5]` das Marine-Flag, `row[7]` das Land, `row[8]` die
Leader. Eine Spielzeit gibt es in der Zeile nicht; die Dauer steht nur je Leader in
der ausgepackten Aufstellung und wird hier zu `spielzeit` aufsummiert.

Die `user_id` ist der Schluessel zu `PublicUsers/<id>` und damit zu den letzten neun
Partien eines Spielers, aus denen sich die Replaypfade bilden lassen.

Uebernommen werden also Loginname, Anzeigename, Bounty, Rang, user_id, die
Leaderaufstellung und die daraus gerechnete Spielzeit.

**Die Discord-Kennung wird beim Auslesen weggeworfen.** Der Server schickt sie
ungefragt mit, sie steht nirgends in der Oberflaeche, und sie ist eine direkt
personenbeziehbare Kennung fremder Leute. Sie darf in keine Ausgabedatei geraten.

    python3 tools/bestenliste_lesen.py mitschnitt.pcap
    python3 tools/bestenliste_lesen.py mitschnitt.pcap --ziel bestenliste.json
"""
import argparse
import base64
import gzip
import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pcap_enet import pakete  # noqa: E402
from enet_strom import nachrichten, kopf_lesen  # noqa: E402

KNOTEN, METHODE = 2, 104

# Godot-Variantentypen, so weit sie hier vorkommen.
NIL, BOOL, INT, FLOAT, STRING, ARRAY = 0, 1, 2, 3, 4, 28
FLAG_64 = 1 << 16

# Feldnamen einer Zeile. Die Namen in VERWERFEN stehen hier nur, damit die
# Positionen stimmen; ihre Werte werden nie uebernommen.
SPALTEN = ["login", "name", "bounty", "rang", "user_id", "marine",
           "discord", "land", "leader_roh"]
# `discord` faellt weg, weil es eine personenbeziehbare Kennung fremder Leute ist,
# die der Server ungefragt mitschickt. `marine` und `land` fallen weg, weil sie
# nicht gebraucht werden; Land war ohnehin nur bei 67 von 100 Spielern gesetzt.
VERWERFEN = {"discord", "marine", "land"}


def variante(daten, i):
    """Liest einen Wert ab Position i. Gibt (wert, neue Position) zurueck."""
    if i + 4 > len(daten):
        raise ValueError("Kette endet mitten im Typkopf")
    wort = struct.unpack("<I", daten[i:i + 4])[0]
    typ, flaggen = wort & 0xFFFF, wort >> 16
    i += 4

    if typ == NIL:
        return None, i
    if typ == BOOL:
        return struct.unpack("<I", daten[i:i + 4])[0] != 0, i + 4
    if typ == INT:
        if flaggen & 1:  # 64 Bit
            return struct.unpack("<q", daten[i:i + 8])[0], i + 8
        return struct.unpack("<i", daten[i:i + 4])[0], i + 4
    if typ == FLOAT:
        if flaggen & 1:
            return struct.unpack("<d", daten[i:i + 8])[0], i + 8
        return struct.unpack("<f", daten[i:i + 4])[0], i + 4
    if typ == STRING:
        laenge = struct.unpack("<I", daten[i:i + 4])[0]
        i += 4
        text = daten[i:i + laenge].decode("utf-8", "replace")
        # Godot fuellt auf ein Vielfaches von vier auf.
        return text, i + laenge + (-laenge % 4)
    if typ == ARRAY:
        anzahl = struct.unpack("<I", daten[i:i + 4])[0] & 0x7FFFFFFF
        i += 4
        feld = []
        for _ in range(anzahl):
            w, i = variante(daten, i)
            feld.append(w)
        return feld, i
    raise ValueError(f"unbekannter Typ {typ} an Position {i - 4}")


def leader_auspacken(text):
    """Das gepackte Leaderfeld einer Zeile lesen. Fehlschlag ist kein Grund
    aufzugeben, dann bleibt die Zeile eben ohne Aufstellung."""
    if not text:
        return []
    try:
        roh = gzip.decompress(base64.b64decode(text))
        werte = json.loads(roh)
    except Exception:
        return []
    aus = []
    for e in werte:
        # Der Leader steht mit Praefix, "MY1xOP14-020" meint OP14-020.
        kennung = str(e.get("Leader", ""))
        for marke in ("MY1x", "1x"):
            if kennung.startswith(marke):
                kennung = kennung[len(marke):]
                break
        aus.append({"leader": kennung, "siege": e.get("Wins", 0),
                    "niederlagen": e.get("Losses", 0),
                    "partien": e.get("Games", 0), "dauer": e.get("Duration", 0),
                    "erst_siege": e.get("first_wins", 0),
                    "erst_niederlagen": e.get("first_losses", 0),
                    "zweit_siege": e.get("second_wins", 0),
                    "zweit_niederlagen": e.get("second_losses", 0)})
    return aus


def zeile_bauen(feld):
    """Aus den neun Rohwerten einer Zeile den Eintrag machen."""
    e = {}
    for name, wert in zip(SPALTEN, feld):
        if name in VERWERFEN:
            continue
        e[name] = wert
    e["leader"] = leader_auspacken(e.pop("leader_roh", ""))
    # Die Zeile selbst traegt keine Spielzeit. Sie ergibt sich aus der Aufstellung.
    e["spielzeit"] = sum(l["dauer"] for l in e["leader"])
    e["partien"] = sum(l["partien"] for l in e["leader"])
    return e


def seiten(pfad):
    """Alle Bestenlistenantworten im Mitschnitt, in der Reihenfolge ihres
    Eintreffens."""
    ns = nachrichten(pakete(pfad), nur_server=True)
    aus = []
    for n in ns:
        k = kopf_lesen(n["daten"])
        if not k or k["knoten"] != KNOTEN or k["methode"] != METHODE:
            continue
        daten = n["daten"]
        # Nach Knoten, Methode und Argumentzahl steht der Seitenindex als kurzer
        # Wert, danach beginnt das Feld. Der Anfang wird gesucht statt geraten:
        # das erste, was sich als Feld lesen laesst, ist die Liste.
        for start in range(4, 12):
            try:
                wert, _ = variante(daten, start)
            except Exception:
                continue
            if isinstance(wert, list) and wert and isinstance(wert[0], list):
                aus.append({"zeit": n["zeit"], "zeilen": wert})
                break
    return aus


def main():
    p = argparse.ArgumentParser(description="Bestenliste aus einem Mitschnitt")
    p.add_argument("datei")
    p.add_argument("--ziel", help="JSON hierhin schreiben")
    p.add_argument("--zeigen", type=int, default=15)
    a = p.parse_args()

    ss = seiten(a.datei)
    if not ss:
        raise SystemExit("keine Bestenlistenantwort im Mitschnitt gefunden")

    eintraege, gesehen = [], set()
    for seite in ss:
        for feld in seite["zeilen"]:
            if not isinstance(feld, list) or len(feld) < len(SPALTEN):
                continue
            e = zeile_bauen(feld)
            if e.get("login") in gesehen:
                continue
            gesehen.add(e.get("login"))
            eintraege.append(e)
    eintraege.sort(key=lambda e: e.get("rang") or 10**9)

    print(f"  {len(ss)} Seiten, {len(eintraege)} Spieler\n")
    print("  Rang  Bounty     Name             user_id  Partien  Zeit    Top-Leader")
    for e in eintraege[:a.zeigen]:
        top = e["leader"][0] if e["leader"] else None
        spitze = (f"{top['leader']} {top['siege']}-{top['niederlagen']}"
                  if top else "")
        # Der Server schickt den vollen double, das Spiel zeigt eine Nachkommastelle.
        print(f"  {str(e.get('rang')):>4}  {round(e.get('bounty') or 0, 1):9}  "
              f"{str(e.get('name'))[:15]:15}  {str(e.get('user_id')):>7}  "
              f"{e['partien']:7}  {e['spielzeit'] / 3600:5.1f}h  {spitze}")

    if a.ziel:
        with open(a.ziel, "w", encoding="utf-8") as datei:
            json.dump(eintraege, datei, ensure_ascii=False, indent=1)
        print(f"\n  geschrieben: {a.ziel}")


if __name__ == "__main__":
    main()
