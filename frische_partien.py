#!/usr/bin/env python3
"""Die Spielerseiten mit den neuesten Partien aus den Replays auffrischen.

Die Partien auf der Spielerseite stammen aus `PublicUsers/<id>.Western.Public_matches`, einem
Schnappschuss der letzten neun Partien, den OPBounty nur ab und zu schreibt. Am 20.10.2026
endete er bei Rang 3 am 14.10., bei Rang 5 am 06.10. Die Replays dagegen kommen minütlich.

Nur tragen die Replays in Firestore keinen Namen und keine user_id, und im Log steht der
Ingame Name ("himm#7921"), nicht der Name der Bestenliste ("hiiiiimmmmm"). Die Brücke sind die
Partien im Schnappschuss: sie kennen user_id und Replaypfad. Im Log einer solchen Partie steht
bei dem Leader, den der Spieler gespielt hat, sein Ingame Name. Mit diesem Namen werden dann
alle neueren Replays der letzten TAGE gesucht.

Gesucht wird nicht in allen Replays: nur in denen, bei denen eine Seite mindestens so viel
Bounty hatte wie Rang 100 abzüglich BOUNTY_RAND. Am 20.10.2026 waren das 180 von 2582 am Tag.

Gelernte Namen bleiben im Gedächtnis `ingame_namen.json.gz.enc` (nur verschlüsselt im Repo,
specs/features/ingame-namen.md). Der Schnappschuss rollt weiter, ein einmal gelernter Name
bleibt so über Läufe erhalten und die Abdeckung wächst von Tag zu Tag.

Läuft in der Action nach `spieler_daten.py` und vor `replays_holen.py`; der holt und packt
die Logs der neuen Partien dann mit.

    python3 frische_partien.py
"""
import concurrent.futures as futures
import datetime
import gzip
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
from firestore import Db, wert  # noqa: E402
from replays_holen import laden, UNSICHTBAR  # noqa: E402
from spieler_daten import leader_kennung  # noqa: E402

SPIELER = os.path.join(HIER, "public", "spieler.json.gz")
BESTE = os.path.join(HIER, "public", "bestenliste.json.gz")
# Bewusst ausserhalb von public: das Gedaechtnis braucht nur der Lauf, nicht die Seite.
GEDAECHTNIS = os.path.join(HIER, "ingame_namen.json.gz.enc")

# Woher eine Zuordnung im Gedaechtnis stammt. Der Schnappschuss ist ein Beleg (user_id und
# Replay derselben Partie), die Bounty nur eine Schaetzung.
QUELLE_SCHNAPPSCHUSS = "schnappschuss"
QUELLE_BOUNTY = "bounty"

TAGE = 5                     # so weit zurück werden Replays gesucht
FENSTER_STUNDEN = 6          # eine Abfrage je Zeitfenster
ABFRAGE_LIMIT = 2000         # ist ein Fenster voll, wird es geteilt
BOUNTY_RAND = 300            # unter Rang 100, damit auch wer gerade verliert noch dabei ist
LERN_PARTIEN = 9             # alle Schnappschusspartien; Mirrors helfen nicht, je mehr, desto sicherer
PARTIEN_JE_SPIELER = 20      # so viele zeigt die Spielerseite höchstens
PARALLEL = 8                 # gleichzeitige Downloads
VERSUCHE = 3                 # je Abfrage, bei einem Netzaussetzer
PAUSE_SEKUNDEN = 5

LEADER_ZEILE = re.compile(r"\[([^\]]+)\] Leader is .*?link=\"([^\"]+)\"")


def log_spieler(text):
    """[(Ingame Name, Leader)] aus den beiden "Leader is" Zeilen eines Logs."""
    aus = []
    for name, leader in LEADER_ZEILE.findall(text or ""):
        aus.append((UNSICHTBAR.sub("", name), leader))
        if len(aus) == 2:
            break
    return aus


def ingame_name(partie, text):
    """Der Ingame Name des Profilinhabers in dieser Partie, oder None. Eindeutig nur, wenn
    die beiden Seiten verschiedene Leader spielten."""
    seiten = log_spieler(text)
    if len(seiten) != 2 or seiten[0][1] == seiten[1][1]:
        return None
    for name, leader in seiten:
        if leader == partie.get("eigener_leader"):
            return name
    return None


def namen_lernen(spieler, eimer):
    """{Ingame Name: user_id} aus den Schnappschusspartien."""
    auftraege = []
    for uid, d in spieler.items():
        for p in [p for p in d.get("partien", []) if p.get("replay")][:LERN_PARTIEN]:
            auftraege.append((uid, p))
    texte = parallel_laden([p["replay"] for _, p in auftraege], eimer)
    namen = {}
    for uid, p in auftraege:
        name = ingame_name(p, texte.get(p["replay"]))
        if name and uid not in namen.values():
            namen[name] = uid
    return namen


def gedaechtnis_leer():
    return {"namen": {}, "gesperrt": []}


def gedaechtnis_laden(schl, pfad=None):
    """Das Gedaechtnis aus der verschluesselten Datei, leer wenn es sie noch nicht gibt."""
    from verschluesseln import entschluesseln
    pfad = pfad or GEDAECHTNIS
    if not os.path.exists(pfad):
        return gedaechtnis_leer()
    with open(pfad, "rb") as datei:
        roh = gzip.decompress(entschluesseln(schl, datei.read()))
    gedaechtnis = gedaechtnis_leer()
    gedaechtnis.update(json.loads(roh))
    return gedaechtnis


def gedaechtnis_speichern(gedaechtnis, schl, pfad=None):
    """Schreibt nur, wenn sich der Inhalt geaendert hat. Die Verschluesselung nimmt jedes Mal
    einen neuen Zufallswert; ohne diese Pruefung gaebe es jeden Tag einen leeren Commit.
    Gibt zurueck, ob geschrieben wurde."""
    from verschluesseln import verschluesseln
    pfad = pfad or GEDAECHTNIS
    if os.path.exists(pfad) and gedaechtnis_laden(schl, pfad) == gedaechtnis:
        return False
    roh = json.dumps(gedaechtnis, ensure_ascii=False, sort_keys=True,
                     separators=(",", ":")).encode()
    with open(pfad, "wb") as datei:
        datei.write(verschluesseln(schl, gzip.compress(roh, compresslevel=9, mtime=0)))
    return True


def namen_einpflegen(gedaechtnis, neu, quelle, heute):
    """Neue Zuordnungen {Ingame Name: user_id} ins Gedaechtnis. Aendert es an Ort und Stelle.

    Regeln: Ein gesperrter Name bleibt draussen. Ein Beleg aus dem Schnappschuss ersetzt eine
    abweichende Schaetzung aus der Bounty (die war dann falsch). Widersprechen sich zwei
    Belege, ist der Name nicht eindeutig (etwa ein Allerweltsname): er fliegt raus und wird
    gesperrt, statt still den alten Eintrag zu ueberschreiben.
    Gibt {"neu", "korrigiert", "konflikte"} zurueck."""
    zaehlung = {"neu": 0, "korrigiert": 0, "konflikte": 0}
    namen, gesperrt = gedaechtnis["namen"], set(gedaechtnis["gesperrt"])
    for name, uid in neu.items():
        uid = str(uid)
        if name in gesperrt:
            continue
        alt = namen.get(name)
        if alt is None:
            namen[name] = {"uid": uid, "quelle": quelle, "seit": heute}
            zaehlung["neu"] += 1
        elif alt["uid"] == uid:
            if quelle == QUELLE_SCHNAPPSCHUSS and alt["quelle"] != quelle:
                alt["quelle"] = quelle
        elif alt["quelle"] == QUELLE_BOUNTY and quelle == QUELLE_SCHNAPPSCHUSS:
            namen[name] = {"uid": uid, "quelle": quelle, "seit": heute}
            zaehlung["korrigiert"] += 1
        elif quelle == QUELLE_BOUNTY and alt["quelle"] == QUELLE_SCHNAPPSCHUSS:
            continue
        else:
            del namen[name]
            gesperrt.add(name)
            zaehlung["konflikte"] += 1
    gedaechtnis["gesperrt"] = sorted(gesperrt)
    return zaehlung


def namen_aus_gedaechtnis(gedaechtnis):
    """{Ingame Name: user_id} fuer zuordnen()."""
    return {name: e["uid"] for name, e in gedaechtnis["namen"].items()}


def parallel_laden(pfade, eimer):
    pfade = list(dict.fromkeys(pfade))
    with futures.ThreadPoolExecutor(PARALLEL) as pool:
        return dict(zip(pfade, pool.map(lambda p: laden(p, eimer), pfade)))


def abfrage(db, von, bis):
    frage = {"structuredQuery": {
        "from": [{"collectionId": "Replays"}],
        "where": {"compositeFilter": {"op": "AND", "filters": [
            {"fieldFilter": {"field": {"fieldPath": "timestamp"}, "op": "GREATER_THAN_OR_EQUAL",
                             "value": {"stringValue": von}}},
            {"fieldFilter": {"field": {"fieldPath": "timestamp"}, "op": "LESS_THAN",
                             "value": {"stringValue": bis}}}]}},
        "orderBy": [{"field": {"fieldPath": "timestamp"}, "direction": "DESCENDING"}],
        "limit": ABFRAGE_LIMIT}}
    r = urllib.request.Request(db.basis + ":runQuery", data=json.dumps(frage).encode(),
                               method="POST")
    r.add_header("Authorization", "Bearer " + db.tok)
    r.add_header("Content-Type", "application/json")
    for versuch in range(VERSUCHE):
        try:
            with urllib.request.urlopen(r, timeout=120) as antwort:
                return [{k: wert(v) for k, v in d["document"]["fields"].items()}
                        for d in json.loads(antwort.read().decode()) if "document" in d]
        except urllib.error.URLError:
            if versuch + 1 == VERSUCHE:
                raise
            time.sleep(PAUSE_SEKUNDEN * (versuch + 1))


def replays_suchen(db, ende, tage):
    """Alle Replays der letzten `tage` Tage, Fenster für Fenster; volle Fenster geteilt."""
    fenster = []
    t = ende
    while t > ende - datetime.timedelta(days=tage):
        fenster.append((t - datetime.timedelta(hours=FENSTER_STUNDEN), t))
        t -= datetime.timedelta(hours=FENSTER_STUNDEN)
    aus = []
    while fenster:
        von, bis = fenster.pop()
        fmt = "%Y-%m-%dT%H:%M:%S"
        docs = abfrage(db, von.strftime(fmt), bis.strftime(fmt))
        if len(docs) >= ABFRAGE_LIMIT and bis - von > datetime.timedelta(minutes=10):
            mitte = von + (bis - von) / 2
            fenster += [(von, mitte), (mitte, bis)]
            continue
        aus += docs
    return aus


def deck_aus(text):
    """"1xOP17-001\\r\\n4xST30-004..." in das Format der Spielerseite: Leader ohne Anzahl,
    dann die Karten mit Anzahl."""
    zeilen = [z.strip() for z in str(text or "").splitlines() if z.strip()]
    if not zeilen:
        return []
    return [leader_kennung(zeilen[0])] + zeilen[1:]


def partie_aus(doc, eigener, gegner, gewonnen):
    """Eine Partie im Format von spieler_daten.partie. Dauer und gegner_id stehen nicht im
    Replay; die Seite zeigt dort einen Strich."""
    mein, sein = ("winner", "loser") if gewonnen else ("loser", "winner")
    return {"zeit": doc.get("timestamp"), "modus": int(doc.get("game_mode") or 0),
            "gewonnen": gewonnen, "dauer": None,
            "gegner": gegner.split("#")[0], "gegner_id": None,
            "eigener_leader": doc.get(f"{mein}_leader"),
            "gegner_leader": doc.get(f"{sein}_leader"),
            "deck": deck_aus(doc.get(f"{mein}_deck")),
            "replay": doc.get("path"), "quelle": "replay"}


MIRROR_ABSTAND = 50          # im Mirror: so viel näher muss eine Bounty an der des Spielers liegen


def mirror_sieger(doc, bounty):
    """Im Mirror sagt der Leader nicht, wer gewann. Die Bounty vor der Partie schon: die
    Seite, deren Bounty näher an der heutigen des Spielers liegt, ist er. None, wenn das
    nicht deutlich ist."""
    if bounty is None:
        return None
    w, v = float(doc.get("winner_bounty") or 0), float(doc.get("loser_bounty") or 0)
    if abs(abs(w - bounty) - abs(v - bounty)) < MIRROR_ABSTAND:
        return None
    return abs(w - bounty) < abs(v - bounty)


def zuordnen(docs, texte, namen, bounty_je_id=None):
    """{user_id: [Partien]} für alle Replays, in denen ein bekannter Ingame Name steht."""
    bounty_je_id = bounty_je_id or {}
    aus = {}
    for doc in docs:
        seiten = log_spieler(texte.get(doc.get("path")))
        if len(seiten) != 2:
            continue
        for i, (name, leader) in enumerate(seiten):
            uid = namen.get(name)
            if uid is None:
                continue
            gegner, gegner_leader = seiten[1 - i]
            if leader != gegner_leader:
                gewonnen = leader == doc.get("winner_leader")
            else:
                gewonnen = mirror_sieger(doc, bounty_je_id.get(uid))
                if gewonnen is None:
                    continue
            aus.setdefault(uid, []).append(partie_aus(doc, name, gegner, gewonnen))
    return aus


def decks_ergaenzen(partien):
    """Bei Siegen ist im Replay Dokument das Deck leer (winner_deck ""), und das Log nennt
    nur die gezogenen Karten. Dann gilt die letzte bekannte Liste desselben Spielers mit
    demselben Leader, mit ihrem Datum in `deck_von`, damit die Seite es sagen kann."""
    for i, p in enumerate(partien):
        if p.get("deck") or not p.get("eigener_leader"):
            continue
        quelle = next((q for q in partien[i + 1:] if q.get("deck")
                       and q.get("eigener_leader") == p["eigener_leader"]), None)
        if quelle:
            p["deck"] = quelle["deck"]
            p["deck_von"] = quelle.get("zeit")


def mischen(alt, neu):
    """Neue und alte Partien zusammen, ohne Doppel (gleicher Replaypfad), neueste zuerst."""
    gesehen, aus = set(), []
    for p in sorted(neu + alt, key=lambda p: str(p.get("zeit") or ""), reverse=True):
        schluessel = p.get("replay") or (p.get("zeit"), p.get("gegner"))
        if schluessel in gesehen:
            continue
        gesehen.add(schluessel)
        aus.append(p)
    decks_ergaenzen(aus)
    return aus[:PARTIEN_JE_SPIELER]


def main():
    from verschluesseln import lesen
    with gzip.open(SPIELER, "rb") as datei:
        paket = json.loads(datei.read())
    spieler, eimer = paket.get("spieler", {}), paket.get("speicher")
    beste = json.loads(gzip.decompress(lesen(BESTE)))["spieler"]
    bounties = [e["bounty"] for e in beste if e.get("bounty") is not None]
    if not spieler or not bounties:
        print("  keine Spieler oder keine Bounties, nichts aufzufrischen")
        return
    grenze = min(bounties) - BOUNTY_RAND

    gelernt = namen_lernen(spieler, eimer)
    print(f"  {len(gelernt)} Ingame Namen von {len(spieler)} Spielern aus dem Schnappschuss")
    schl = schluessel_holen()
    gedaechtnis = gedaechtnis_sicher_laden(schl)
    vorher = len(gedaechtnis["namen"])
    heute = datetime.date.today().isoformat()
    zaehlung = namen_einpflegen(gedaechtnis, gelernt, QUELLE_SCHNAPPSCHUSS, heute)
    print(f"  Gedaechtnis: {vorher} vorher, {zaehlung['neu']} neu, "
          f"{zaehlung['korrigiert']} korrigiert, {zaehlung['konflikte']} Konflikte")
    namen = namen_aus_gedaechtnis(gedaechtnis)

    db = Db()
    jetzt = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    docs = [d for d in replays_suchen(db, jetzt, TAGE)
            if str(d.get("game_mode")) == "0"
            and max(float(d.get("winner_bounty") or 0), float(d.get("loser_bounty") or 0)) >= grenze]
    print(f"  {len(docs)} Western Replays ab {grenze:.0f} Bounty in {TAGE} Tagen")
    texte = parallel_laden([d["path"] for d in docs if d.get("path")], eimer)
    bounty_je_id = {str(e["user_id"]): e.get("bounty") for e in beste if e.get("user_id") is not None}
    neu = zuordnen(docs, texte, namen, bounty_je_id)

    # Das Gedaechtnis kennt auch Spieler, die heute nicht mehr in den Top 100 stehen.
    neu = {uid: partien for uid, partien in neu.items() if uid in spieler}
    for uid, partien in neu.items():
        spieler[uid]["partien"] = mischen(spieler[uid].get("partien", []), partien)
    print(f"  {sum(len(v) for v in neu.values())} Partien aus Replays für {len(neu)} Spieler")

    roh = json.dumps(paket, ensure_ascii=False, separators=(",", ":")).encode()
    with gzip.open(SPIELER, "wb", compresslevel=9) as datei:
        datei.write(roh)
    if schl:
        from verschluesseln import verschluesseln
        with open(SPIELER + ".enc", "wb") as datei:
            datei.write(verschluesseln(schl, roh_gz(SPIELER)))
        geschrieben = gedaechtnis_speichern(gedaechtnis, schl)
        print(f"  Gedaechtnis {'geschrieben' if geschrieben else 'unveraendert'}, "
              f"{len(gedaechtnis['namen'])} Namen")
    else:
        print("  kein SEITEN_PASSWORT, das Gedaechtnis bleibt ungelesen und ungeschrieben")


def gedaechtnis_sicher_laden(schl):
    """Wie gedaechtnis_laden, aber ein unlesbares Gedaechtnis (anderes Passwort, kaputte
    Datei) kostet nicht den ganzen Schritt: dann beginnt es leer, mit einer Warnung."""
    if not schl:
        return gedaechtnis_leer()
    try:
        return gedaechtnis_laden(schl)
    except Exception as fehler:
        print(f"::warning::Gedaechtnis der Ingame Namen unlesbar ({type(fehler).__name__}), "
              "es beginnt leer")
        return gedaechtnis_leer()


def schluessel_holen():
    """Der Schluessel aus dem Seitenpasswort, oder None ohne Passwort."""
    from bestenliste_einbauen import seitenpasswort
    from verschluesseln import salz_holen, schluessel
    passwort = seitenpasswort()
    return schluessel(passwort, salz_holen()) if passwort else None


def roh_gz(pfad):
    with open(pfad, "rb") as datei:
        return datei.read()


if __name__ == "__main__":
    main()
