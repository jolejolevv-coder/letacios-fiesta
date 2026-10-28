#!/usr/bin/env python3
"""Holt die OPBounty Statistiken und legt sie fuer die Webseite ab.

WOHER DIE DATEN KOMMEN. Nicht aus Firestore. Der Client laedt sie von einem oeffentlichen
CDN, der Pfad steht im Spielpaket im Klartext:

    <CDN>/stats/regular/timestamps.json   Index der fertigen Saetze
    <CDN>/stats/regular/<datei>           die fertigen Saetze
    <CDN>/stats/files.json                Index aller Tagesdateien
    <CDN>/stats/raw/<datum>/mode_<n>/<bounty>/statsNNNN.json

Jede Datei ist base64 verpacktes gzip mit JSON darin. Das CDN sendet KEINEN
Access-Control-Allow-Origin Kopf, ein Browser darf es also nicht direkt abfragen.
Deshalb dieses Skript.

EIN TAG SIND MEHRERE DATEIEN. Je Tag, Modus und Bountybereich liegen mehrere
`statsNNNN.json` nebeneinander, die zusammengefuehrt werden muessen. Genau das macht der
Client in `merge_statlists`, und genau das macht `zusammenfuehren` hier.

    python3 aktualisieren.py                 fertige Saetze auffrischen
    python3 aktualisieren.py --tage 60       zusaetzlich die letzten 60 Tage einzeln
    python3 aktualisieren.py --bilder        Kartenbilder aus der OPTCGSim Installation
"""
import argparse
import base64
import datetime
import io
import glob
import gzip
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from firestore import Db  # noqa: E402
from frische_partien import log_spieler, replays_suchen  # noqa: E402
from replays_holen import adresse, UNSICHTBAR  # noqa: E402

CDN = "https://d2spmnr3w7rm2f.cloudfront.net/stats/"
BILDQUELLE = ("/Volumes/*/Downloads/*_Mac/OPTCGSim.app/Contents/Resources/Data/"
              "StreamingAssets/Cards")
KARTE = re.compile(r"([A-Z]{2,4}\d{2}-\d{3}|P-\d{3})")
MODI = {"mode_0": "Western", "mode_1": "Webcam", "mode_2": "Eastern", "mode_3": "Arena"}
BOUNTY = ("25_1000", "1000_2000", "2000_3000", "3000")
# Die Bountybereiche im Pfad stehen in Millionen: 25_1000 ist 25M bis 1B, 3000 ist 3B
# aufwaerts. Das erklaert auch die fertigen Saetze, deren Namen der Client nicht uebersetzt:
# LWS1 traegt Bereich 1000_2000, LWS2 traegt 2000_3000.
BOUNTY_NAME = {
    "25_1000": "25M to 1B",
    "1000_2000": "1B to 2B",
    "2000_3000": "2B to 3B",
    "3000": "3B and up",
}
# "3B and up" ist der oberste Topf und nach oben offen. Die Spitze der Bestenliste steht
# weit darueber, am 21.09.2026 lief die Top 100 von 5361,9 bis 3130,8, die ersten zwoelf
# ueber 4000. Trennen laesst sich das nicht: die Rohdateien tragen nur Leader und
# Partienzahlen, keine Bounty je Partie. Ein eigener 4B Topf muesste vom Spiel kommen;
# taucht er im Index auf, genuegt hier ein Eintrag und ein Wert in --bounty.
# Bereiche, fuer die es beim Spiel keinen fertigen Satz gibt und die wir deshalb selbst
# aus der Rohebene rechnen. Sie landen in derselben Auswahl wie die fertigen und tragen
# denselben Zuschnitt: sieben Tage, wie die drei "Last Week" Saetze des Spiels.
#
# Ein Unterschied bleibt und laesst sich nicht aufloesen: unsere sieben Tage sind die
# letzten sieben, fuer die es Rohdaten gibt, die des Spiels koennen eine feste Woche
# sein. Die Zahlen sind also vergleichbar, aber nicht taggleich.
ROH_TAGE = 7
ROH_SAETZE = {"3000": "Last Week 3B Bounty"}

# Seit dem 26.10.2026 mittags ist die normale Queue (Modus 0) das Format OP17 plus EB05
# (specs/features/format-op17-eb05.md). Der Tag der Umstellung mischt beide Formate, der
# Satz beginnt deshalb mit dem ersten vollen Tag. Die EB05 Queue (Modus 1) ist entfallen,
# der Event Satz kommt seitdem aus dem Formatsatz.
FORMAT_START = "2026-10-27"
FORMAT_MODUS = "mode_0"
FORMAT_SCHLUESSEL = "Roh_mode_0_op17eb05"
FORMAT_NAME = "OP17 + EB05 Standard"
# Seit dem 26.10.2026 veroeffentlicht OPBounty keine Statistik mehr. Der Formatsatz kommt
# deshalb aus den Replays in Firestore (specs/features/format-aus-replays.md). Das Wort
# steht im Namen, damit die Seite es ohne Aenderung unter dem Satz zeigt.
REPLAY_ZUSATZ = " (from replays)"
REPLAY_MODUS = "0"
# Wer anfaengt, steht nur im Log. Je Replay einmal gelesen und hier gemerkt, in der Datei
# im Zwischenspeicher der Action (public/tage). Die Endung schuetzt sie vor dem Aufraeumen
# der Tagesdateien (*.json.gz).
START_ZWISCHEN = "replay_start.zwischen.gz"
START_SCHLUESSEL_LAENGE = 16
LOG_PARALLEL = 8
# Reihenfolge und Leader stehen in den ersten Zeilen; mehr als den Anfang braucht es nicht.
LOG_ANFANG_BYTES = 16384
LOG_TIMEOUT = 30
FEHLT = object()    # Log gibt es nicht (404): endgueltig, wird nicht nochmal versucht
ZUG_ZEILE = re.compile(r"\[([^\]]+)\] Chose to go (First|Second)")
# Unter diesem Anteil an Partien mit Karten des neuesten Sets im Deck sieht der Satz nicht
# nach dem Format aus, und sein Name stimmt nicht mehr. Derselbe Wert entscheidet, ab wann
# ein neues Format als eingefuehrt gilt (specs/features/selbstlauf.md, Phase 1).
EB05_MIN_ANTEIL = 0.30
# Format des Zustands: Anfangssets, Zustandsdatei und Endungen der abgelegten Dateien.
FORMAT_SETS = ("OP17", "EB05")
ZUSTAND_DATEI = "format.zustand.json"
ALT_SUFFIX = "_alt"
# Endung *.zwischen.gz, nicht *.json.gz: letzteres raeumt `main` bei den Tagesdateien weg.
ALT_ZWISCHEN = ".zwischen.gz"
ALT_ZUSATZ = " format (old)"
SCHLUESSEL_VORSATZ = "Roh_mode_0_"
SET_NAME = re.compile(r"^(OP|EB)(\d+)$")
# Ab diesem Anteil an Partien mit Karten eines neuen Sets beginnt die Umstellung. Der Tag
# mischt beide Formate; das neue Format beginnt am Tag danach (siehe EB05_MIN_ANTEIL).
UMSTELL_ANTEIL = 0.05
# Die Wochensaetze des Spiels reichen sieben Tage zurueck und mischen bis dahin altes und
# neues Format. Bis zum Formatstart plus WOCHE_TAGE (ausschliesslich) zeigen wir sie gar
# nicht; das neue Format steht dann nur im Formatsatz, mit den Tagen, die es schon gibt.
WOCHE_TAGE = 7
WOCHENSAETZE = ("Stats_lw", "Stats_LWS1BillionBounty", "Stats_LWS2BillionBounty")
# Das Event Anfang November 2026 erlaubt nur bestimmte Leader. Der Event Satz ist der
# Formatsatz, beschraenkt auf diese Leader und in den Matchups auf Gegner aus derselben Liste.
EVENT_DATEI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eb05_leader.json")
EVENT_SCHLUESSEL = "Roh_mode_0_op17eb05_event"
# Felder eines Leaders, die je Gegner eine Spalte tragen, parallel zu `geg`.
GEGNER_FELDER = ("geg", "gm", "gw", "gfw", "gfl", "gsw", "gsl")
# Fertige Saetze, die das Spiel noch liefert, die wir aber nicht mehr zeigen.
AUSGEBLENDET = {"Stats_Special_Queue"}


def bounty_name(bereich: str) -> str:
    """Anzeigename eines Bountybereichs, auch fuer einen, den wir noch nicht kennen."""
    return BOUNTY_NAME.get(bereich, bereich)


def roh_schluessel(modus: str, bereich: str) -> str:
    return f"Roh_{modus}_{bereich}"


ANZEIGE = {
    "Stats_lw": "Last Week Standard",
    "Stats_LWS1BillionBounty": "Last Week 1B Bounty",
    "Stats_LWS2BillionBounty": "Last Week 2B Bounty",
    "Stats_OP17": "OP17 format (old)",
    "Stats_OP17-1BillionBounty": "OP17 format (old), 1B Bounty",
}


def hole(pfad: str) -> dict:
    """Laedt eine CDN Datei und entpackt sie. base64 ueber gzip, sonst nacktes JSON."""
    with urllib.request.urlopen(CDN + pfad, timeout=180) as antwort:
        roh = antwort.read()
    try:
        return json.loads(gzip.decompress(base64.b64decode(roh)).decode())
    except Exception:
        return json.loads(roh)


def karte(text: str):
    treffer = KARTE.search(str(text or ""))
    return treffer.group(1) if treffer else None


def _addiere(ziel: dict, quelle: dict, felder) -> None:
    for f in felder:
        ziel[f] = ziel.get(f, 0) + (quelle.get(f, 0) or 0)


ZAEHLER = ("wins", "losses", "first_wins", "first_losses",
           "second_wins", "second_losses", "number_of_matches", "duration")

# Version der eingedampften Dateien. 2 seit dem 20.10.2026: je Leader die Kartenwerte fuer den
# Reiter Analysis (`hand`, in den Saetzen auch `kopien`). Aeltere Tagesdateien im
# Zwischenspeicher werden neu gebaut. 3: Tagesdateien ohne `kopien`.
FORMAT = 3
# Je Karte in der Starthand acht Zaehler, in dieser Reihenfolge (specs/features/mulligan-guide.md):
HAND_FELDER = ("subject_keep_first", "subject_keep_second",
               "subject_mulligan_first", "subject_mulligan_second",
               "subject_wins_in_hand_first", "subject_wins_in_hand_second",
               "subject_losses_in_hand_first", "subject_losses_in_hand_second")


def zusammenfuehren(teile: list) -> dict:
    """Fuehrt mehrere Statistikdateien zu einer zusammen.

    Drei Ebenen, jede mit eigenem Schluessel:
      decklists        je Leader, darin je Deck (identische Kartenliste wird addiert)
      leaders_presence je Leader, darin je Gegner aus `subject` mit `presence`
      Kopfzahlen       number_of_matches
    """
    decks: dict = {}
    praesenz: dict = {}
    karten: dict = {}
    partien = 0
    stand = ""
    for teil in teile:
        partien += teil.get("number_of_matches", 0) or 0
        stand = max(stand, teil.get("timestamp", "") or "")
        for eintrag in teil.get("decklists", []) or []:
            leader = eintrag.get("leader")
            eimer = decks.setdefault(leader, {})
            for liste in eintrag.get("lists", []) or []:
                schluessel = "|".join(sorted(liste.get("deck", []) or []))
                vorhanden = eimer.get(schluessel)
                if vorhanden is None:
                    eimer[schluessel] = {"deck": liste.get("deck", []),
                                         **{f: (liste.get(f, 0) or 0) for f in ZAEHLER}}
                else:
                    _addiere(vorhanden, liste, ZAEHLER)
        for eintrag in teil.get("leaders_presence", []) or []:
            leader = eintrag.get("leader")
            ziel = praesenz.setdefault(leader, {"gegner": {}})
            _addiere(ziel, eintrag, ZAEHLER)
            themen = eintrag.get("subject", []) or []
            # `subject_matches` ist leer, die Partienzahl steht in `presence`.
            zahlen = eintrag.get("subject_matches") or eintrag.get("presence", []) or []
            for i, gegner in enumerate(themen):
                g = ziel["gegner"].setdefault(gegner, {"m": 0, "w": 0, "fw": 0,
                                                       "fl": 0, "sw": 0, "sl": 0})
                g["m"] += zahlen[i] if i < len(zahlen) else 0
                for kurz, lang in (("w", "subject_wins"), ("fw", "subject_first_wins"),
                                   ("fl", "subject_first_losses"),
                                   ("sw", "subject_second_wins"),
                                   ("sl", "subject_second_losses")):
                    reihe = eintrag.get(lang, []) or []
                    g[kurz] += reihe[i] if i < len(reihe) else 0
        for eintrag in teil.get("cards_presence", []) or []:
            ziel = karten.setdefault(eintrag.get("leader"), {"hand": {}, "kopien": {}})
            for i, karte_ in enumerate(eintrag.get("subject_mulligan", []) or []):
                zaehler = ziel["hand"].setdefault(karte_, [0] * len(HAND_FELDER))
                for j, feld in enumerate(HAND_FELDER):
                    reihe = eintrag.get(feld, []) or []
                    zaehler[j] += (reihe[i] or 0) if i < len(reihe) else 0
            spiele = eintrag.get("subject_matches", []) or []
            siege = eintrag.get("subject_wins", []) or []
            for i, karte_ in enumerate(eintrag.get("subject", []) or []):
                z = ziel["kopien"].setdefault(karte_, [0, 0])
                z[0] += (spiele[i] or 0) if i < len(spiele) else 0
                z[1] += (siege[i] or 0) if i < len(siege) else 0
    return {"decks": decks, "praesenz": praesenz, "karten": karten,
            "partien": partien, "stand": stand}


def eindampfen(roh: dict, name: str = "", modus: str = "", bounty: str = "",
               mit_kopien: bool = True) -> dict:
    """Nur die Felder behalten, die die Seite zeigt.

    Kurze Schluessel, weil sie sich je Liste und je Gegner wiederholen: w/l Siege und
    Niederlagen, fw/fl als First, sw/sl als Second, dur Sekunden je Partie.
    """
    leader = []
    for kennung, eimer in roh["decks"].items():
        p = roh["praesenz"].get(kennung, {})
        listen = []
        for eintrag in eimer.values():
            spiele = eintrag["wins"] + eintrag["losses"]
            if spiele < 1:
                continue
            listen.append({"d": eintrag["deck"], "w": eintrag["wins"],
                           "l": eintrag["losses"], "fw": eintrag["first_wins"],
                           "fl": eintrag["first_losses"], "sw": eintrag["second_wins"],
                           "sl": eintrag["second_losses"],
                           "dur": round(eintrag["duration"] / spiele)})
        gegner = sorted(p.get("gegner", {}).items(), key=lambda x: -x[1]["m"])
        spiele_leader = max(1, p.get("number_of_matches", 0) or 1)
        if not listen and not gegner:
            continue
        k = roh.get("karten", {}).get(kennung, {})
        # Die Kopienwerte sind gross (am 19.10. 26 KB je Tagesdatei gegen 7 KB fuer die
        # Starthand) und stehen deshalb nur in den Saetzen, nicht in jeder Tagesdatei.
        hand = {karte_: z for karte_, z in k.get("hand", {}).items() if any(z)}
        leader.append({
            "hand": hand, "kopien": k.get("kopien", {}) if mit_kopien else {},
            "id": kennung,
            "w": p.get("wins", 0), "l": p.get("losses", 0),
            "fw": p.get("first_wins", 0), "fl": p.get("first_losses", 0),
            "sw": p.get("second_wins", 0), "sl": p.get("second_losses", 0),
            "dur": round((p.get("duration", 0) or 0) / spiele_leader),
            "geg": [g[0] for g in gegner],
            "gm": [g[1]["m"] for g in gegner],
            "gw": [g[1]["w"] for g in gegner],
            "gfw": [g[1]["fw"] for g in gegner],
            "gfl": [g[1]["fl"] for g in gegner],
            "gsw": [g[1]["sw"] for g in gegner],
            "gsl": [g[1]["sl"] for g in gegner],
            "listen": listen,
        })
    leader.sort(key=lambda e: -(e["w"] + e["l"]))
    return {"format": FORMAT, "name": name, "stand": roh["stand"], "partien": roh["partien"],
            "modus": modus, "bounty": bounty, "leader": leader}


def schreiben(pfad: str, inhalt) -> int:
    """Schreibt gzip verpacktes JSON.

    Ein Tag im Bereich 25_1000 sind 4,8 MB nacktes JSON und 0,41 MB gepackt. Ein
    statischer Webserver liefert die .gz Datei unveraendert aus, die Seite entpackt sie
    im Browser mit DecompressionStream. Damit bleibt die Sammlung klein genug, dass ein
    Zeitraum tagesgenau nachgeladen werden kann.
    """
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    roh = json.dumps(inhalt, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    with gzip.open(pfad, "wb", compresslevel=6) as datei:
        datei.write(roh)
    return os.path.getsize(pfad)


def lesen(pfad: str):
    with gzip.open(pfad, "rb") as datei:
        return json.loads(datei.read().decode("utf-8"))


def anzeigename(schluessel: str) -> str:
    """Anzeigename eines fertigen Satzes."""
    return ANZEIGE.get(schluessel, schluessel.replace("Stats_", ""))


def ausgeblendet(schluessel: str, heute: str, woche_ab: str) -> bool:
    """Ob ein fertiger Satz fehlen soll: dauerhaft oder als Wochensatz vor `woche_ab`."""
    return schluessel in AUSGEBLENDET or (schluessel in WOCHENSAETZE and heute < woche_ab)


def fertige_saetze(ziel: str, woche_ab: str) -> dict:
    index = hole("regular/timestamps.json")
    heute = time.strftime("%Y-%m-%d")
    saetze = {}
    for eintrag in index.get("stats", []):
        datei = eintrag["file"]
        name = datei.rsplit(".", 1)[0]
        if ausgeblendet(name, heute, woche_ab):
            print(f"  {datei} ausgeblendet")
            continue
        print(f"  {datei} ...", flush=True)
        try:
            roh = zusammenfuehren([hole("regular/" + datei)])
            saetze[name] = eindampfen(roh, anzeigename(name))
        except Exception as fehler:
            print(f"    fehlgeschlagen: {fehler}")
    for name, satz in saetze.items():
        groesse = schreiben(os.path.join(ziel, "saetze", name + ".json.gz"), satz)
        print(f"    saetze/{name}.json.gz  {groesse/1e6:.2f} MB")
    return saetze


_INDEX: list | None = None


def index_schluessel() -> list:
    """Der Dateiindex der Rohebene, einmal geholt und gemerkt.

    Er ist knapp ein Megabyte und wird von `tage_laden` und `roh_satz` gebraucht.
    """
    global _INDEX
    if _INDEX is None:
        roh = urllib.request.urlopen(CDN + "files.json", timeout=180).read()
        _INDEX = [e["Key"] for e in json.loads(roh)]
    return _INDEX


def fenster(anzahl: int) -> list:
    """Die letzten N Tage, fuer die es ueberhaupt Rohdaten gibt."""
    return sorted({k.split("/")[0] for k in index_schluessel()})[-anzahl:]


def satz_reihenfolge(saetze: dict, zustand: dict | None = None) -> list:
    """Die selbst gerechneten Saetze neben die Wochensaetze des Spiels stellen.

    Sonst haengen sie hinter den Saisonsaetzen am Ende der Auswahl, obwohl sie
    denselben Zuschnitt haben wie "Last Week 2B Bounty" direkt darueber.

    Der Satz des aktuellen Formats steht ganz oben, sein Event Satz direkt darunter.
    """
    reihenfolge = list(saetze)
    schluessel_format = (zustand or standard_zustand())["schluessel"]
    oben = [k for k in (schluessel_format, EVENT_SCHLUESSEL) if k in reihenfolge]
    for schluessel in [k for k in reihenfolge
                       if k.startswith("Roh_") and k not in oben]:
        reihenfolge.remove(schluessel)
        letzte = max((i for i, k in enumerate(reihenfolge) if k.startswith("Stats_LWS")),
                     default=len(reihenfolge) - 1)
        reihenfolge.insert(letzte + 1, schluessel)
    for schluessel in oben:
        reihenfolge.remove(schluessel)
    return oben + reihenfolge


def roh_teile(schluessel_alle: list, tage: list, modus: str, bereiche: list) -> list:
    """Die Rohdateien eines Modus in den genannten Tagen und Bountybereichen."""
    tage, bereiche = set(tage), set(bereiche)
    return sorted(k for k in schluessel_alle
                  if (t := k.split("/")) and len(t) >= 4 and t[0] in tage
                  and t[1] == modus and t[2] in bereiche)


def roh_satz(ziel: str, schluessel_alle: list, tage: list, modus: str,
             bereiche: list, schluessel: str, name: str) -> dict | None:
    """Einen benannten Satz aus der Rohebene bauen, ueber das ganze Fenster.

    Die fertigen Saetze des Spiels decken den obersten Bountybereich nicht ab, es gibt
    dort keine Datei dafuer. Die Rohebene hat ihn, aber nur tageweise. Hier werden die
    Tage eines Fensters zu einem Satz zusammengerechnet, damit er in derselben Auswahl
    steht wie die fertigen.

    Gerechnet wird aus den Rohdateien, nicht aus den Tagesdateien unter `tage/`: die
    sind schon eingedampft und lassen sich nicht verlustfrei weiteraddieren.
    """
    passend = roh_teile(schluessel_alle, tage, modus, bereiche)
    if not passend:
        print(f"  {schluessel}: keine Rohdateien im Fenster, uebersprungen")
        return None
    print(f"  {schluessel}  {len(passend)} Teile aus {len(tage)} Tagen ...", flush=True)
    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            teile = list(pool.map(lambda k: hole("raw/" + k), passend))
    except Exception as fehler:
        print(f"    fehlgeschlagen: {fehler}")
        return None
    satz = eindampfen(zusammenfuehren(teile), name, modus, ",".join(bereiche))
    groesse = schreiben(os.path.join(ziel, "saetze", schluessel + ".json.gz"), satz)
    print(f"    {groesse/1e3:.0f} KB, {satz['partien']} Partien")
    return satz


def tage_ab(schluessel_alle: list, start: str) -> list:
    """Alle Tage ab `start` (YYYY-MM-DD), fuer die es Rohdaten gibt."""
    return sorted({k.split("/")[0] for k in schluessel_alle if k.split("/")[0] >= start})


def eb05_anteil(satz: dict, set_name: str = "EB05") -> float:
    """Anteil der Partien, deren Deck mindestens eine Karte des Sets enthaelt.

    Gezaehlt ueber die Decklisten des Satzes, jede mit ihren Siegen und Niederlagen.
    """
    alle = mit_eb05 = 0
    for leader in satz.get("leader", []):
        for liste in leader.get("listen", []):
            spiele = liste["w"] + liste["l"]
            alle += spiele
            if any(set_name + "-" in karte_ for karte_ in liste["d"]):
                mit_eb05 += spiele
    return mit_eb05 / alle if alle else 0.0


def eb05_warnung(satz: dict, zustand: dict | None = None) -> str | None:
    """Ein Warntext, wenn der Formatsatz nicht nach dem Format aussieht, sonst None.

    Massstab ist das neueste Set des Formats, bei OP17 plus EB05 also EB05.
    """
    neuestes = (zustand or standard_zustand())["sets"][-1]
    anteil = eb05_anteil(satz, neuestes)
    if anteil >= EB05_MIN_ANTEIL:
        return None
    return (f"Nur {anteil:.0%} der Partien in {FORMAT_MODUS} mit {neuestes} Karten, erwartet "
            f"mindestens {EB05_MIN_ANTEIL:.0%}. Stimmt das Format noch?")


def wer_wahl_traf(text: str) -> tuple[str, bool] | None:
    """(Name, geht zuerst) aus der Zeile "Chose to go First|Second", None wenn sie fehlt."""
    treffer = ZUG_ZEILE.search(text or "")
    if not treffer:
        return None
    return UNSICHTBAR.sub("", treffer.group(1)), treffer.group(2) == "First"


def sieger_zuerst(text: str, sieger_leader: str, verlierer_leader: str) -> bool | None:
    """Ob der Sieger anfing, aus dem Log. None, wenn das Log es nicht hergibt.

    Im Log waehlt ein Spieler die Reihenfolge. Welcher Seite er gehoert, sagen die
    "Leader is" Zeilen. Im Mirror ist das nicht zu trennen, dort bleibt es None.
    """
    if not sieger_leader or sieger_leader == verlierer_leader:
        return None
    wahl = wer_wahl_traf(text)
    seiten = dict(log_spieler(text))
    if not wahl or wahl[0] not in seiten:
        return None
    waehler_leader = seiten[wahl[0]]
    if waehler_leader == sieger_leader:
        return wahl[1]
    if waehler_leader == verlierer_leader:
        return not wahl[1]
    return None


def log_anfang(pfad: str, eimer: str):
    """Der Anfang eines Logs als Text; FEHLT bei 404, None bei einem anderen Fehler.

    Anders als `replays_holen.laden` ohne Platte: Tausende Logs von je 60 KB gehoeren
    nicht in den Zwischenspeicher, hier zaehlt nur der Beginn.
    """
    anfrage = urllib.request.Request(adresse(pfad, eimer), headers={
        "Range": f"bytes=0-{LOG_ANFANG_BYTES - 1}"})
    try:
        with urllib.request.urlopen(anfrage, timeout=LOG_TIMEOUT) as antwort:
            return antwort.read(LOG_ANFANG_BYTES).decode("utf-8", "replace")
    except urllib.error.HTTPError as fehler:
        return FEHLT if fehler.code == 404 else None
    except (urllib.error.URLError, OSError):
        return None


def start_schluessel(pfad: str) -> str:
    """Kurzer Schluessel je Replaypfad; der Pfad endet auf einen 64 stelligen Hash."""
    return pfad.rsplit("_", 1)[-1].removesuffix(".log")[:START_SCHLUESSEL_LAENGE]


def start_lesen(pfad: str) -> dict:
    """{Schluessel: Sieger zuerst (True/False) oder None}, leer wenn die Datei fehlt."""
    try:
        with gzip.open(pfad, "rt", encoding="utf-8") as datei:
            return json.load(datei)
    except (OSError, ValueError):
        return {}


def starts_ermitteln(docs: list, eimer: str, zwischen: str) -> dict:
    """{Replaypfad: Sieger zuerst} fuer alle Replays, deren Log lesbar ist.

    Jedes Log wird nur einmal geladen: das Ergebnis steht in der Zwischendatei, auch
    "nicht erkennbar" (None). Ein Log, das sich wegen eines Netzfehlers nicht laden
    laesst, wird nicht gemerkt und beim naechsten Lauf wieder versucht. Die Datei behaelt nur Replays aus `docs`.
    """
    bekannt = start_lesen(zwischen)
    neu = {}
    offen = []
    for doc in docs:
        pfad = doc.get("path")
        if not pfad:
            continue
        schluessel = start_schluessel(pfad)
        if schluessel in bekannt:
            neu[schluessel] = bekannt[schluessel]
        elif doc["winner_leader"] == doc["loser_leader"]:
            neu[schluessel] = None
        else:
            offen.append(doc)
    with ThreadPoolExecutor(max_workers=LOG_PARALLEL) as pool:
        texte = list(pool.map(lambda d: log_anfang(d["path"], eimer), offen))
    for doc, text in zip(offen, texte):
        if text is FEHLT:
            neu[start_schluessel(doc["path"])] = None
        elif text is not None:
            neu[start_schluessel(doc["path"])] = sieger_zuerst(
                text, doc["winner_leader"], doc["loser_leader"])
    os.makedirs(os.path.dirname(zwischen), exist_ok=True)
    with gzip.open(zwischen, "wt", encoding="utf-8") as datei:
        json.dump(neu, datei, separators=(",", ":"))
    print(f"    Start: {len(offen)} Logs neu gelesen, {len(neu)} gemerkt")
    return {d["path"]: neu[start_schluessel(d["path"])] for d in docs
            if d.get("path") and start_schluessel(d["path"]) in neu}


def format_replays_filtern(docs: list, zustand: dict | None = None, bis: str = "") -> list:
    """Nur die Replays der normalen Queue ab dem Formatstart, mit beiden Leadern.

    `bis` (ausschliesslich, ISO Zeit oder Tag) schneidet hinten ab, fuer den alten Satz.
    """
    start = (zustand or standard_zustand())["start"]
    return [d for d in docs
            if str(d.get("game_mode")) == REPLAY_MODUS
            and str(d.get("timestamp") or "") >= start
            and (not bis or str(d.get("timestamp") or "") < bis)
            and d.get("winner_leader") and d.get("loser_leader")]


def _leader_neu() -> dict:
    return {f: 0 for f in ZAEHLER} | {"gegner": {}}


def _seite_zaehlen(roh: dict, leader: str, gegner: str, deck: str, gewonnen: bool,
                   zuerst: bool | None) -> None:
    """Eine Seite einer Partie in die Rohstruktur von `zusammenfuehren` eintragen."""
    kennung, gegner_kennung = "1x" + leader, "1x" + gegner
    sieg = "w" if gewonnen else "l"
    ziel = roh["praesenz"].setdefault(kennung, _leader_neu())
    # `eindampfen` laeuft ueber die Decks; ein Leader ohne hochgeladene Liste braucht
    # trotzdem einen Eintrag, sonst fehlt er mitsamt seinen Siegen.
    eimer = roh["decks"].setdefault(kennung, {})
    g = ziel["gegner"].setdefault(gegner_kennung, {"m": 0, "w": 0, "fw": 0, "fl": 0,
                                                    "sw": 0, "sl": 0})
    felder = ["wins" if gewonnen else "losses"]
    g["m"] += 1
    g["w"] += gewonnen
    if zuerst is not None:
        felder.append(("first_" if zuerst else "second_") + felder[0])
        g[("f" if zuerst else "s") + sieg] += 1
    ziel["number_of_matches"] += 1
    for f in felder:
        ziel[f] += 1
    liste = [z.strip() for z in deck.splitlines() if z.strip()]
    if liste:
        eintrag = eimer.setdefault("|".join(sorted(liste)), {"deck": liste, **{f: 0 for f in ZAEHLER}})
        for f in felder + ["number_of_matches"]:
            eintrag[f] += 1


def roh_aus_replays(docs: list, starts: dict) -> dict:
    """Die Replays in dieselbe Rohstruktur wie `zusammenfuehren`, damit `eindampfen` bleibt.

    `starts` sagt je Replaypfad, ob der Sieger anfing (True/False), sonst gilt die Partie
    ohne First und Second. Decks stehen im Replay nur fuer die Seite, die sie hochlud;
    Hand, Kopien und Dauer fehlen und bleiben leer.
    """
    roh = {"decks": {}, "praesenz": {}, "karten": {}, "partien": 0, "stand": ""}
    for doc in docs:
        zuerst = starts.get(doc.get("path"))
        sieger, verlierer = doc["winner_leader"], doc["loser_leader"]
        _seite_zaehlen(roh, sieger, verlierer, doc.get("winner_deck") or "", True, zuerst)
        _seite_zaehlen(roh, verlierer, sieger, doc.get("loser_deck") or "", False,
                       None if zuerst is None else not zuerst)
        roh["partien"] += 1
        roh["stand"] = max(roh["stand"], str(doc.get("timestamp") or ""))
    return roh


def replay_satz(docs: list, starts: dict, zustand: dict | None = None, bis: str = "",
                name: str = "") -> dict:
    """Der Formatsatz aus Replays, im Format der Seite.

    Ohne `name` heisst er wie das Format im Zustand.
    """
    zustand = zustand or standard_zustand()
    roh = roh_aus_replays(format_replays_filtern(docs, zustand, bis), starts)
    return eindampfen(roh, (name or zustand["name"]) + REPLAY_ZUSATZ, FORMAT_MODUS,
                      ",".join(BOUNTY))


def set_nummer(name: str):
    """(Art, Nummer) eines Sets wie "OP17" oder "EB05", sonst None (ST, P, PRB, ...)."""
    treffer = SET_NAME.match(name)
    return (treffer.group(1), int(treffer.group(2))) if treffer else None


def format_name(sets: list) -> str:
    """Name des Formats aus seinen Sets, z.B. "OP17 + EB05 Standard"."""
    return " + ".join(sets) + " Standard"


def format_schluessel(sets: list) -> str:
    """Schluessel des Formatsatzes, z.B. Roh_mode_0_op17eb05."""
    return SCHLUESSEL_VORSATZ + "".join(sets).lower()


def standard_zustand() -> dict:
    """Der Zustand aus den Konstanten; gilt, wenn es keine Zustandsdatei gibt."""
    return {"start": FORMAT_START, "name": FORMAT_NAME, "schluessel": FORMAT_SCHLUESSEL,
            "sets": list(FORMAT_SETS), "alte": []}


def zustand_lesen(ziel: str) -> dict:
    """Der Zustand aus ziel/tage/format.zustand.json, bei fehlender oder kaputter Datei
    der aus den Konstanten."""
    pfad = os.path.join(ziel, "tage", ZUSTAND_DATEI)
    try:
        with open(pfad, encoding="utf-8") as datei:
            zustand = json.load(datei)
        gueltig = (isinstance(zustand["start"], str) and isinstance(zustand["name"], str)
                   and isinstance(zustand["schluessel"], str)
                   and isinstance(zustand["sets"], list) and zustand["sets"]
                   and isinstance(zustand["alte"], list))
    except (OSError, ValueError, KeyError, TypeError):
        return standard_zustand()
    return zustand if gueltig else standard_zustand()


def zustand_schreiben(ziel: str, zustand: dict) -> None:
    pfad = os.path.join(ziel, "tage", ZUSTAND_DATEI)
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    with open(pfad, "w", encoding="utf-8") as datei:
        json.dump(zustand, datei, ensure_ascii=False, indent=1)


def deck_sets(deck) -> set:
    """Die Sets (OP17, EB05, ST01, ...) der Karten eines Decks, Text oder Liste."""
    text = " ".join(deck) if isinstance(deck, list) else str(deck or "")
    return {k.split("-")[0] for k in KARTE.findall(text)}


def neue_sets(sets: set, zustand: dict) -> set:
    """Davon die OP und EB Sets mit hoeherer Nummer als das hoechste ihrer Art im Format."""
    hoechste = {}
    for name in zustand["sets"]:
        art, nummer = set_nummer(name) or (None, 0)
        hoechste[art] = max(hoechste.get(art, 0), nummer)
    neu = set()
    for name in sets:
        art_nummer = set_nummer(name)
        if art_nummer and art_nummer[1] > hoechste.get(art_nummer[0], 0):
            neu.add(name)
    return neu


def tag_anteile(docs: list, zustand: dict) -> dict:
    """Je UTC Tag: Partien im Modus 0 und wie viele davon Karten eines neuen Sets haben.

    Ergebnis: {tag: {"partien": n, "neu": n, "sets": {set: n}}}
    """
    tage = {}
    for doc in docs:
        if str(doc.get("game_mode")) != REPLAY_MODUS or not doc.get("timestamp"):
            continue
        tag = tage.setdefault(str(doc["timestamp"])[:10], {"partien": 0, "neu": 0, "sets": {}})
        neu = neue_sets(deck_sets(doc.get("winner_deck")) | deck_sets(doc.get("loser_deck")),
                        zustand)
        tag["partien"] += 1
        tag["neu"] += bool(neu)
        for name in neu:
            tag["sets"][name] = tag["sets"].get(name, 0) + 1
    return tage


def format_wechsel_erkennen(docs: list, zustand: dict):
    """(Starttag des neuen Formats, seine neuen Sets) oder None.

    Umstellungstag ist der erste Tag mit mindestens UMSTELL_ANTEIL Partien mit neuen Sets;
    er mischt beide Formate. Das neue Format beginnt am Tag danach, sobald es diesen Tag
    in den Daten gibt und er mindestens EB05_MIN_ANTEIL erreicht.
    """
    tage = tag_anteile(docs, zustand)
    for tag in sorted(t for t in tage if t >= zustand["start"]):
        if tage[tag]["neu"] / tage[tag]["partien"] < UMSTELL_ANTEIL:
            continue
        folgetag = str(datetime.date.fromisoformat(tag) + datetime.timedelta(days=1))
        folge = tage.get(folgetag)
        if folge and folge["neu"] / folge["partien"] >= EB05_MIN_ANTEIL:
            sets = {n for n, anzahl in folge["sets"].items()
                    if anzahl / folge["partien"] >= UMSTELL_ANTEIL}
            return folgetag, sets
    return None


def format_nach_wechsel(zustand: dict, start: str, neue: set) -> dict:
    """Das neue Format: ein neues OP Set ersetzt alles, ein neues EB Set kommt zum OP dazu."""
    nach_art = {"OP": [], "EB": []}
    for name in neue:
        nach_art[set_nummer(name)[0]].append(name)
    op = max(nach_art["OP"], key=set_nummer) if nach_art["OP"] else None
    eb = max(nach_art["EB"], key=set_nummer) if nach_art["EB"] else None
    if op:
        sets = [op] + ([eb] if eb else [])
    else:
        alt_op = [n for n in zustand["sets"] if n.startswith("OP")]
        sets = alt_op + ([eb] if eb else [])
    return {"start": start, "name": format_name(sets), "schluessel": format_schluessel(sets),
            "sets": sets, "alte": list(zustand["alte"])}


def alten_satz_ablegen(ziel: str, docs: list, starts: dict, zustand: dict,
                       umstellungstag: str) -> dict:
    """Den Satz des alten Formats bis zum Vortag der Umstellung rechnen und ablegen.

    Gibt den Eintrag fuer `zustand["alte"]` zurueck.
    """
    schluessel = zustand["schluessel"] + ALT_SUFFIX
    # "OP17 + EB05 Standard" wird "OP17 + EB05 format (old)", wie bei Stats_OP17.
    name = zustand["name"].removesuffix(" Standard") + ALT_ZUSATZ
    satz = replay_satz(docs, starts, zustand, umstellungstag, name)
    datei = schluessel + ALT_ZWISCHEN
    schreiben(os.path.join(ziel, "tage", datei), satz)
    print(f"  Altes Format abgelegt: {name}, {satz['partien']} Partien")
    return {"schluessel": schluessel, "name": name, "datei": datei}


def format_umstellen(ziel: str, docs: list, starts: dict, zustand: dict, start: str,
                     neue: set) -> dict:
    """Den alten Satz ablegen und den Zustand des neuen Formats liefern."""
    umstellungstag = str(datetime.date.fromisoformat(start) - datetime.timedelta(days=1))
    alt = alten_satz_ablegen(ziel, docs, starts, zustand, umstellungstag)
    neu = format_nach_wechsel(zustand, start, neue)
    neu["alte"] = [a for a in zustand["alte"] if a["schluessel"] != alt["schluessel"]] + [alt]
    print(f"  Neues Format ab {start}: {neu['name']}")
    return neu


def format_wechsel_anwenden(ziel: str, docs: list, starts: dict, zustand: dict) -> dict:
    """Alle erkannten Wechsel nacheinander anwenden; der Zustand ist danach aktuell."""
    wechsel = format_wechsel_erkennen(docs, zustand)
    while wechsel:
        zustand = format_umstellen(ziel, docs, starts, zustand, *wechsel)
        wechsel = format_wechsel_erkennen(docs, zustand)
    return zustand


def alte_saetze(ziel: str, zustand: dict) -> dict:
    """Die abgelegten Saetze alter Formate lesen und unter saetze/ neu schreiben."""
    saetze = {}
    for alt in zustand["alte"]:
        try:
            satz = lesen(os.path.join(ziel, "tage", alt["datei"]))
        except (OSError, ValueError, KeyError) as fehler:
            print(f"::warning::Alter Formatsatz {alt.get('schluessel')} nicht gelesen: {fehler}")
            continue
        schreiben(os.path.join(ziel, "saetze", alt["schluessel"] + ".json.gz"), satz)
        saetze[alt["schluessel"]] = satz
        print(f"  {alt['schluessel']}  {satz['partien']} Partien")
    return saetze


def format_satz(ziel: str, zustand: dict) -> tuple[dict | None, dict]:
    """Der Satz des aktuellen Formats: Modus 0, alle Tage ab dem Start, aus den Replays.

    Liefert den Satz und den Zustand, der nach einem erkannten Wechsel ein neuer ist.
    Faellt Firestore aus, entfaellt der Satz und der Lauf geht weiter.
    """
    try:
        db = Db()
        jetzt = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        tage = (jetzt - datetime.datetime.fromisoformat(zustand["start"])).days + 1
        docs = format_replays_filtern(replays_suchen(db, jetzt, tage), zustand)
    except (Exception, SystemExit) as fehler:
        print(f"::warning::Replays nicht gelesen, {zustand['name']} uebersprungen: {fehler}")
        return None, zustand
    print(f"  {len(docs)} Replays im Modus {REPLAY_MODUS} ab {zustand['start']}", flush=True)
    zwischen = os.path.join(ziel, "tage", START_ZWISCHEN)
    try:
        starts = starts_ermitteln(docs, db.c["storageBucket"], zwischen)
    except Exception as fehler:
        print(f"::warning::First und Second nicht gelesen: {fehler}")
        starts = {}
    zustand = format_wechsel_anwenden(ziel, docs, starts, zustand)
    satz = replay_satz(docs, starts, zustand)
    groesse = schreiben(os.path.join(ziel, "saetze", zustand["schluessel"] + ".json.gz"), satz)
    mit_start = sum(1 for v in starts.values() if v is not None)
    print(f"    {groesse/1e3:.0f} KB, {satz['partien']} Partien, First/Second bei "
          f"{mit_start}")
    print(f"    {zustand['sets'][-1]} Anteil {eb05_anteil(satz, zustand['sets'][-1]):.0%}")
    warnung = eb05_warnung(satz, zustand)
    if warnung:
        # So erscheint die Warnung in der Zusammenfassung der Action.
        print(f"::warning::{warnung}")
    return satz, zustand


def wochentage(alle_tage: list, zustand: dict | None = None) -> list:
    """Das Fenster der selbst gerechneten Wochensaetze, ohne Tage vor dem Format.

    Gibt es noch keinen Tag im neuen Format, ist das Fenster leer und der Satz fehlt.
    """
    start = (zustand or standard_zustand())["start"]
    return [t for t in alle_tage if t >= start]


def leader_ohne_anzahl(kennung: str) -> str:
    """"1xOP09-042" wird "OP09-042", so wie die Leader in eb05_leader.json stehen."""
    return kennung.split("x", 1)[1] if re.match(r"\d+x", kennung or "") else kennung


def event_leader_lesen(pfad: str) -> tuple[str, set] | None:
    """(Name, erlaubte Leader) aus der Event Datei, None wenn sie fehlt oder kaputt ist."""
    try:
        with open(pfad, encoding="utf-8") as datei:
            daten = json.load(datei)
        return daten["name"], set(daten["leader"])
    except (OSError, ValueError, KeyError) as fehler:
        print(f"  Event Leader nicht gelesen ({pfad}): {fehler}")
        return None


def event_satz(satz: dict, erlaubt: set, name: str) -> dict:
    """Ein Satz nur mit den erlaubten Leadern und nur mit Partien gegen erlaubte Gegner.

    Die Kopfzahlen eines Leaders (Siege, Niederlagen, First, Second) kommen aus den
    gefilterten Gegnerspalten, damit jede Winrate nur gegen die Event Leader gilt.
    Decklisten, Starthaende und Kopien fuehrt die Quelle nicht je Gegner; sie bleiben ueber
    alle Gegner, und `listen_alle_gegner` sagt das der Seite. `partien` zaehlt die Partien
    aus Sicht der erlaubten Leader; treffen zwei aufeinander, zaehlt die Partie zweimal.
    """
    leader = []
    for eintrag in satz["leader"]:
        if leader_ohne_anzahl(eintrag["id"]) not in erlaubt:
            continue
        behalten = [i for i, g in enumerate(eintrag["geg"])
                    if leader_ohne_anzahl(g) in erlaubt]
        neu = dict(eintrag)
        for feld in GEGNER_FELDER:
            neu[feld] = [eintrag[feld][i] for i in behalten]
        neu.update(kopfzahlen_aus_gegnern(neu))
        leader.append(neu)
    return {**satz, "name": name, "leader": leader, "listen_alle_gegner": True,
            "partien": sum(e["w"] + e["l"] for e in leader)}


def kopfzahlen_aus_gegnern(eintrag: dict) -> dict:
    """Siege, Niederlagen, First und Second eines Leaders als Summe seiner Gegnerspalten."""
    siege = sum(eintrag["gw"])
    return {"w": siege, "l": sum(eintrag["gm"]) - siege,
            "fw": sum(eintrag["gfw"]), "fl": sum(eintrag["gfl"]),
            "sw": sum(eintrag["gsw"]), "sl": sum(eintrag["gsl"])}


def format_event_satz(ziel: str, satz: dict) -> dict | None:
    """Den Event Satz aus dem Formatsatz bauen und schreiben."""
    gelesen = event_leader_lesen(EVENT_DATEI)
    if not gelesen:
        return None
    name, erlaubt = gelesen
    event = event_satz(satz, erlaubt, name + REPLAY_ZUSATZ)
    groesse = schreiben(os.path.join(ziel, "saetze", EVENT_SCHLUESSEL + ".json.gz"), event)
    print(f"  {EVENT_SCHLUESSEL}  {len(event['leader'])} von {len(erlaubt)} Leadern, "
          f"{event['partien']} Partien, {groesse/1e3:.0f} KB")
    return event


def tage_laden(ziel: str, anzahl: int, modi: list, bereiche: list) -> list:
    """Je Tag, Modus und Bereich eine eingedampfte Datei. Vorhandene werden uebersprungen."""
    schluessel = index_schluessel()
    tage = fenster(anzahl)
    plan = {}
    for k in schluessel:
        teil = k.split("/")
        if len(teil) < 4 or teil[0] not in tage:
            continue
        if teil[1] not in modi or teil[2] not in bereiche:
            continue
        plan.setdefault((teil[0], teil[1], teil[2]), []).append(k)

    verzeichnis = []
    for (tag, modus, bereich), dateien in sorted(plan.items()):
        name = f"{tag}__{modus}__{bereich}"
        pfad = os.path.join(ziel, "tage", name + ".json.gz")
        if os.path.exists(pfad) and lesen(pfad).get("format", 1) >= FORMAT:
            verzeichnis.append({"tag": tag, "modus": modus, "bounty": bereich,
                                "datei": "tage/" + name + ".json.gz",
                                "partien": lesen(pfad).get("partien", 0)})
            continue
        print(f"  {name}  {len(dateien)} Teile ...", flush=True)
        try:
            with ThreadPoolExecutor(max_workers=6) as pool:
                teile = list(pool.map(lambda k: hole("raw/" + k), sorted(dateien)))
        except Exception as fehler:
            print(f"    fehlgeschlagen: {fehler}")
            continue
        satz = eindampfen(
            zusammenfuehren(teile),
            f"{tag}, {MODI.get(modus, modus)}, {BOUNTY_NAME.get(bereich, bereich)}",
            modus, bereich, mit_kopien=False)
        groesse = schreiben(pfad, satz)
        print(f"    {groesse/1e3:.0f} KB, {satz['partien']} Partien")
        verzeichnis.append({"tag": tag, "modus": modus, "bounty": bereich,
                            "datei": "tage/" + name + ".json.gz",
                            "partien": satz["partien"]})
    return verzeichnis


NAMEN_QUELLE = ("https://raw.githubusercontent.com/buhbbl/punk-records/main/"
                "english/index/cards_by_id.json")
# Je Pack eine Datei mit dem Kartentext. Gebraucht nur fuer den Counter der Events, der
# im Index fehlt (dort steht er nur bei Characters).
PACK_QUELLE = ("https://raw.githubusercontent.com/buhbbl/punk-records/main/"
               "english/data/{pack}.json")
# Wie book.countertabelle in Metacoach: bei Events mit [Counter] die erste Powerzahl danach.
EVENT_COUNTER = re.compile(r"\[Counter\][^+]*\+(\d{4,5})")


# Kuerzel fuer die Farben, damit die Datei klein bleibt.
FARBKUERZEL = {"Red": "r", "Green": "g", "Blue": "b", "Purple": "p",
               "Black": "s", "Yellow": "y"}


def namen_holen(ziel: str) -> int:
    """Kartendaten aus dem Punk Records Datensatz.

    Uebernommen werden Name, Farben und Kosten. Die Farben tragen die Seite optisch, die
    Kosten machen aus dem Kartenhaufen einer Deckliste eine lesbare Kurve.

    Die Quelle fuehrt auch Varianten wie OP01-001_p1. Sie tragen dieselben Werte und
    werden weggelassen, sonst waere die Datei dreimal so gross ohne Mehrwert.
    """
    with urllib.request.urlopen(NAMEN_QUELLE, timeout=180) as antwort:
        roh = json.loads(antwort.read().decode("utf-8"))
    karten = {}
    for kennung, k in roh.items():
        if "_" in kennung or not k:
            continue
        name = k.get("name")
        if not name:
            continue
        eintrag = {"n": html.unescape(name)}
        farben = [FARBKUERZEL[f] for f in (k.get("colors") or []) if f in FARBKUERZEL]
        if farben:
            eintrag["f"] = "".join(farben)
        kosten = k.get("cost")
        if isinstance(kosten, int):
            eintrag["k"] = kosten
        art = k.get("category")
        if art and art != "Character":
            eintrag["a"] = art[:1].lower()   # l Leader, e Event, s Stage
        counter = k.get("counter")
        if isinstance(counter, int) and counter > 0:
            eintrag["c"] = counter
        karten[kennung] = eintrag
    events = event_counter_holen(roh)
    for kennung, wert in events.items():
        if kennung in karten:
            karten[kennung]["c"] = wert
    groesse = schreiben(os.path.join(ziel, "karten.json.gz"), karten)
    print(f"  karten.json.gz: {len(karten)} Karten, {len(events)} Event Counter, {groesse/1e3:.0f} KB")
    return len(karten)


def event_counter(effekt: str):
    """Der Counter eines Events aus seinem Text, oder None."""
    if "[Counter]" not in (effekt or ""):
        return None
    m = EVENT_COUNTER.search(effekt)
    return int(m.group(1)) if m else None


def event_counter_holen(index: dict) -> dict:
    """Counter der Events mit dem Schluesselwort Counter, aus den Packdateien.

    "Analyze my replay" braucht ihn, um zu sehen, ob die Hand einen Angriff halten konnte
    (specs/features/eigenes-replay-analysieren.md). Faellt ein Pack aus, fehlen nur seine
    Events; die Seite zaehlt sie dann mit 0, wie Metacoach eine unbekannte Karte.
    """
    packs = sorted({k.get("pack_id") for kennung, k in index.items()
                    if k and "_" not in kennung and k.get("category") == "Event"
                    and "Counter" in (k.get("keywords") or []) and k.get("pack_id")})

    def ein_pack(pack):
        try:
            with urllib.request.urlopen(PACK_QUELLE.format(pack=pack), timeout=60) as antwort:
                return json.loads(antwort.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, ValueError) as fehler:
            print(f"  Pack {pack} fehlt: {fehler}")
            return []

    aus = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for karten in pool.map(ein_pack, packs):
            for k in karten or []:
                if not isinstance(k, dict) or k.get("category") != "Event":
                    continue
                wert = event_counter(k.get("effect"))
                kennung = k.get("id") or ""
                if wert and "_" not in kennung:
                    aus[kennung] = wert
    return aus


# Eine Groesse je Karte. Die Rasteransicht zeigt 46 bis 54 Pixel breit, 120 deckt auch
# hohe Bildschirmdichten. Die offizielle Kartenseite liefert Bilder in voller Groesse,
# im Mittel 189 KB; ein voller Decklistenreiter waere damit ueber 80 MB gewesen.
BREITE_KLEIN = 120
# Kartenbilder, die tcgcsv nicht hat, liegen fertig verkleinert im Repo. Gefuellt von werkzeuge/bilder_nachtragen.py aus der lokalen OPTCGSim Installation.
NACHTRAG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bilder_nachtrag")


def bild_ablegen(roh: bytes, klein: str) -> None:
    from PIL import Image

    with Image.open(io.BytesIO(roh)) as bild:
        bild = bild.convert("RGB")
        if bild.width > BREITE_KLEIN:
            bild.thumbnail((BREITE_KLEIN, BREITE_KLEIN * 4), Image.LANCZOS)
        bild.save(klein, "JPEG", quality=80, optimize=True)


TCGCSV = "https://tcgcsv.com/tcgplayer/68/"      # Kategorie 68 ist One Piece
# Ohne eigenen User-Agent antwortet tcgcsv mit 401.
TCGCSV_KOPF = {"User-Agent": "letacios-fiesta (github.com/jolejolevv-coder/letacios-fiesta)"}
# tcgcsv nennt das Bild in 200 px; dieselbe Adresse gibt es in 1000 px, verkleinert wird ohnehin.
TCGCSV_KLEIN, TCGCSV_GROSS = "_200w.jpg", "_in_1000x1000.jpg"
# Varianten sind eigene Produkte mit derselben Nummer. Das Grundmotiv hat keinen dieser Zusaetze.
VARIANTE = re.compile(r"\((Alternate Art|Parallel|Manga|SP|Box Topper|Full Art|Pre-Release"
                      r"|Jolly Roger Foil|Treasure Rare|Reprint|Wanted Poster)", re.I)
# Steht in img/quelle.txt. Fehlt die Datei oder steht etwas anderes darin, ersetzt der Lauf
# alle Bilder einmal durch die von tcgcsv (specs/features/kartenquelle-tcgcsv.md).
BILD_KENNUNG = "tcgcsv-1000"
BILD_PARALLEL = 16


def tcgcsv_lesen(pfad: str):
    anfrage = urllib.request.Request(TCGCSV + pfad, headers=TCGCSV_KOPF)
    with urllib.request.urlopen(anfrage, timeout=120) as antwort:
        return json.loads(antwort.read().decode("utf-8"))


def kartennummer(produkt: dict):
    for feld in produkt.get("extendedData", []):
        if feld.get("name") == "Number":
            return feld.get("value")
    return None


def tcgcsv_bilder(produkte: list) -> dict:
    """Je Kartennummer die Bildadresse in 1000 px, vom Grundmotiv statt einer Variante."""
    beste = {}
    for produkt in produkte:
        nummer, url = kartennummer(produkt), produkt.get("imageUrl")
        if not nummer or not url:
            continue
        rang = (1 if VARIANTE.search(produkt.get("name", "")) else 0, produkt.get("productId", 0))
        if nummer not in beste or rang < beste[nummer][0]:
            beste[nummer] = (rang, url.replace(TCGCSV_KLEIN, TCGCSV_GROSS))
    return {nummer: url for nummer, (_, url) in beste.items()}


def tcgcsv_bilder_holen() -> dict:
    """Alle Bildadressen von tcgcsv. Leer, wenn die Quelle nicht antwortet."""
    try:
        gruppen = tcgcsv_lesen("groups")["results"]
        produkte = []
        for gruppe in gruppen:
            produkte += tcgcsv_lesen(f"{gruppe['groupId']}/products")["results"]
    except Exception as fehler:
        print(f"::warning::tcgcsv nicht erreichbar, Bilder bleiben wie sie sind: {fehler}")
        return {}
    return tcgcsv_bilder(produkte)


def gebrauchte_karten(ziel: str) -> set:
    """Jede Karte, die irgendeine abgelegte Datei nennt.

    Bewusst ueber die geschriebenen Dateien statt ueber die eben geladenen Saetze: die
    Tagesdateien nennen deutlich mehr Karten als die fertigen Saetze, und wer nur ueber
    letztere geht, laesst rund zwei Drittel der Bilder fehlen.
    """
    gebraucht = set()
    for pfad in (glob.glob(os.path.join(ziel, "saetze", "*.json.gz"))
                 + glob.glob(os.path.join(ziel, "tage", "*.json.gz"))):
        satz = lesen(pfad)
        for e in satz.get("leader", []):
            for text in ([e["id"]] + list(e.get("geg", []))
                         + [k for li in e.get("listen", []) for k in li["d"]]):
                k = karte(text)
                if k:
                    # Kennungen mit vorangestelltem X meinen dieselbe Karte, siehe daten.js.
                    gebraucht.add(k[1:] if re.match(r"^X[A-Z]{2,4}\d{2}-\d{3}$", k) else k)
    return gebraucht


def bild_laden(url: str, zieldatei: str) -> bool:
    try:
        anfrage = urllib.request.Request(url, headers=TCGCSV_KOPF)
        with urllib.request.urlopen(anfrage, timeout=120) as antwort:
            bild_ablegen(antwort.read(), zieldatei)
        return True
    except Exception:
        return False


def bilder_kopieren(ziel: str, adressen: dict | None = None) -> None:
    """Legt jedes gebrauchte Kartenbild unter img/ ab, aus tcgcsv.

    Ist der Bildspeicher noch nicht von tcgcsv (img/quelle.txt), werden alle Bilder einmal
    ersetzt. Karten ohne Bild von tcgcsv behalten ihr altes Bild oder bekommen eins aus
    bilder_nachtrag/; sie stehen in img/offen.txt und werden bei jedem Lauf neu versucht,
    bis tcgcsv sie liefert (Vorverkauf: Bild noch gesperrt).
    """
    ordner = os.path.join(ziel, "img")
    os.makedirs(ordner, exist_ok=True)
    kennung_pfad = os.path.join(ordner, "quelle.txt")
    offen_pfad = os.path.join(ordner, "offen.txt")
    ersetzen = zeilen_lesen(kennung_pfad) != [BILD_KENNUNG]
    offen = set(zeilen_lesen(offen_pfad))
    if adressen is None:
        adressen = tcgcsv_bilder_holen()

    gebraucht = gebrauchte_karten(ziel)
    datei = {k: os.path.join(ordner, k + ".jpg") for k in gebraucht}
    laden = [k for k in sorted(gebraucht) if k in adressen
             and (ersetzen or k in offen or not os.path.exists(datei[k]))]
    with ThreadPoolExecutor(BILD_PARALLEL) as pool:
        erfolg = list(pool.map(lambda k: bild_laden(adressen[k], datei[k]), laden))
    neu = {k for k, ok in zip(laden, erfolg) if ok}

    nachtrag, fehlt = 0, []
    for k in sorted(gebraucht):
        if os.path.exists(datei[k]):
            continue
        if os.path.exists(os.path.join(NACHTRAG, k + ".jpg")):
            shutil.copyfile(os.path.join(NACHTRAG, k + ".jpg"), datei[k])
            nachtrag += 1
        else:
            fehlt.append(k)

    # Von tcgcsv ist ein Bild, das eben kam oder schon vor diesem Lauf als neu galt.
    schon_neu = set() if ersetzen else gebraucht - offen
    noch_offen = sorted(gebraucht - neu - schon_neu)
    if adressen:
        zeilen_schreiben(kennung_pfad, [BILD_KENNUNG])
        zeilen_schreiben(offen_pfad, noch_offen)
    print(f"  Bilder: {len(neu)} von tcgcsv{' (alle ersetzt)' if ersetzen and adressen else ''}, "
          f"{nachtrag} aus dem Nachtrag, {len(laden) - len(neu)} Abrufe fehlgeschlagen, "
          f"{len(noch_offen)} noch nicht von tcgcsv")
    if fehlt:
        print(f"    ohne Bild: {fehlt}")


def zeilen_lesen(pfad: str) -> list:
    if not os.path.exists(pfad):
        return []
    with open(pfad) as datei:
        return [z.strip() for z in datei if z.strip()]


def zeilen_schreiben(pfad: str, zeilen: list) -> None:
    with open(pfad, "w") as datei:
        datei.write("".join(z + "\n" for z in zeilen))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ziel", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "public"))
    ap.add_argument("--tage", type=int, default=0,
                    help="zusaetzlich die letzten N Tage einzeln ablegen")
    ap.add_argument("--modi", default="mode_0",
                    help="kommagetrennt, z.B. mode_0,mode_2")
    ap.add_argument("--bounty", default=",".join(BOUNTY), help="kommagetrennt")
    ap.add_argument("--bilder", action="store_true")
    ap.add_argument("--nur-bilder", action="store_true", dest="nur_bilder",
                    help="Nur fehlende Kartenbilder holen, keine Daten. Fuer den Bau, "
                         "wenn die Daten schon im Repo liegen und nur die Bilder aus "
                         "dem Zwischenspeicher ergaenzt werden muessen.")
    args = ap.parse_args()

    ziel = args.ziel
    os.makedirs(ziel, exist_ok=True)

    if args.nur_bilder:
        print("Nur Bilder:")
        bilder_kopieren(ziel)
        return

    # Zuerst das Format: ein erkannter Wechsel verschiebt die Grenze der Wochensaetze.
    zustand = zustand_lesen(ziel)
    print(f"Satz aus den Replays, {zustand['name']}:")
    format_ergebnis, zustand = format_satz(ziel, zustand)
    zustand_schreiben(ziel, zustand)
    print("\nAlte Formate:")
    saetze = alte_saetze(ziel, zustand)

    print("\nFertige Saetze:")
    # Leer sein darf das hier: vor der Wochengrenze sind die Wochensaetze ausgeblendet.
    # Geprueft wird erst, wenn auch die selbst gerechneten Saetze da sind.
    woche_ab = str(datetime.date.fromisoformat(zustand["start"])
                   + datetime.timedelta(days=WOCHE_TAGE))
    saetze.update(fertige_saetze(ziel, woche_ab))

    print("\nKartennamen:")
    try:
        namen_holen(ziel)
    except Exception as fehler:
        print(f"  fehlgeschlagen, Seite zeigt Nummern: {fehler}")

    tage = []
    if args.tage:
        print(f"\nTagesdateien, letzte {args.tage} Tage:")
        tage = tage_laden(ziel, args.tage,
                          [m.strip() for m in args.modi.split(",") if m.strip()],
                          [b.strip() for b in args.bounty.split(",") if b.strip()])

    if args.tage:
        # Alte Tagesdateien wegraeumen, sonst waechst die Sammlung endlos und mit ihr
        # der Zwischenspeicher der Action.
        behalten = {os.path.basename(e["datei"]) for e in tage}
        weg = 0
        for pfad in glob.glob(os.path.join(ziel, "tage", "*.json.gz")):
            if os.path.basename(pfad) not in behalten:
                os.remove(pfad)
                weg += 1
        if weg:
            print(f"  {weg} Tagesdateien ausserhalb des Fensters entfernt")

    # Der oberste Bountybereich hat beim Spiel keinen fertigen Satz. Damit er in
    # derselben Auswahl steht wie die anderen, wird er hier aus der Rohebene ueber das
    # ganze Fenster gerechnet. Nur wenn er auch angefordert wurde.
    bereiche = [b.strip() for b in args.bounty.split(",") if b.strip()]
    modi = [m.strip() for m in args.modi.split(",") if m.strip()]
    for bereich, anzeige in ROH_SAETZE.items():
        if bereich not in bereiche or not modi:
            continue
        print(f"\nSatz aus der Rohebene, {anzeige}:")
        satz = roh_satz(ziel, index_schluessel(), wochentage(fenster(ROH_TAGE), zustand), modi[0],
                        [bereich], roh_schluessel(modi[0], bereich), anzeige)
        if satz:
            saetze[roh_schluessel(modi[0], bereich)] = satz

    if format_ergebnis:
        saetze[zustand["schluessel"]] = format_ergebnis
        event = format_event_satz(ziel, format_ergebnis)
        if event:
            saetze[EVENT_SCHLUESSEL] = event

    if not saetze:
        sys.exit("  Kein Satz geladen.")

    verzeichnis = {
        "erstellt": max((s["stand"] for s in saetze.values()), default=""),
        "saetze": [{"schluessel": k, "name": saetze[k]["name"],
                    "partien": saetze[k]["partien"], "stand": saetze[k]["stand"],
                    "datei": "saetze/" + k + ".json.gz"}
                   for k in satz_reihenfolge(saetze, zustand)],
        "tage": sorted(tage, key=lambda e: (e["tag"], e["modus"], e["bounty"])),
        "modi": MODI,
        "bounty": list(BOUNTY),
        "bounty_name": BOUNTY_NAME,
        "start": zustand["schluessel"],
    }
    schreiben(os.path.join(ziel, "verzeichnis.json.gz"), verzeichnis)
    print(f"\n  verzeichnis.json: {len(verzeichnis['saetze'])} Saetze, "
          f"{len(verzeichnis['tage'])} Tagesdateien")

    if args.bilder:
        bilder_kopieren(ziel)


if __name__ == "__main__":
    main()
