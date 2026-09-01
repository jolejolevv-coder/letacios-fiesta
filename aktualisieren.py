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
import io
import glob
import gzip
import html
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

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
ANZEIGE = {
    "Stats_lw": "Last Week Standard",
    "Stats_LWS1BillionBounty": "Last Week 1B Bounty",
    "Stats_LWS2BillionBounty": "Last Week 2B Bounty",
    "Stats_Special_Queue": "Special Queue, Webcam",
    "Stats_OP17": "OP17 overall",
    "Stats_OP17-1BillionBounty": "OP17, 1B Bounty",
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


def zusammenfuehren(teile: list) -> dict:
    """Fuehrt mehrere Statistikdateien zu einer zusammen.

    Drei Ebenen, jede mit eigenem Schluessel:
      decklists        je Leader, darin je Deck (identische Kartenliste wird addiert)
      leaders_presence je Leader, darin je Gegner aus `subject` mit `presence`
      Kopfzahlen       number_of_matches
    """
    decks: dict = {}
    praesenz: dict = {}
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
    return {"decks": decks, "praesenz": praesenz, "partien": partien, "stand": stand}


def eindampfen(roh: dict, name: str = "", modus: str = "", bounty: str = "") -> dict:
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
        leader.append({
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
    return {"name": name, "stand": roh["stand"], "partien": roh["partien"],
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


def fertige_saetze(ziel: str) -> dict:
    index = hole("regular/timestamps.json")
    saetze = {}
    for eintrag in index.get("stats", []):
        datei = eintrag["file"]
        name = datei.rsplit(".", 1)[0]
        print(f"  {datei} ...", flush=True)
        try:
            roh = zusammenfuehren([hole("regular/" + datei)])
            saetze[name] = eindampfen(roh, ANZEIGE.get(name, name.replace("Stats_", "")))
        except Exception as fehler:
            print(f"    fehlgeschlagen: {fehler}")
    for name, satz in saetze.items():
        groesse = schreiben(os.path.join(ziel, "saetze", name + ".json.gz"), satz)
        print(f"    saetze/{name}.json.gz  {groesse/1e6:.2f} MB")
    return saetze


def tage_laden(ziel: str, anzahl: int, modi: list, bereiche: list) -> list:
    """Je Tag, Modus und Bereich eine eingedampfte Datei. Vorhandene werden uebersprungen."""
    index = json.loads(urllib.request.urlopen(CDN + "files.json", timeout=180).read())
    schluessel = [e["Key"] for e in index]
    tage = sorted({k.split("/")[0] for k in schluessel})[-anzahl:]
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
        if os.path.exists(pfad):
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
            modus, bereich)
        groesse = schreiben(pfad, satz)
        print(f"    {groesse/1e3:.0f} KB, {satz['partien']} Partien")
        verzeichnis.append({"tag": tag, "modus": modus, "bounty": bereich,
                            "datei": "tage/" + name + ".json.gz",
                            "partien": satz["partien"]})
    return verzeichnis


NAMEN_QUELLE = ("https://raw.githubusercontent.com/buhbbl/punk-records/main/"
                "english/index/cards_by_id.json")


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
        karten[kennung] = eintrag
    groesse = schreiben(os.path.join(ziel, "karten.json.gz"), karten)
    print(f"  karten.json.gz: {len(karten)} Karten, {groesse/1e3:.0f} KB")
    return len(karten)


# Zwei Groessen je Karte. Die Rasteransicht zeigt 46 bis 54 Pixel breit, die Lupe 208.
# Die offizielle Kartenseite liefert Bilder in voller Groesse, im Mittel 189 KB; ein
# voller Decklistenreiter waere damit ueber 80 MB. Klein reicht fuer das Raster, gross
# wird nur geholt, wenn jemand auf eine Karte zeigt.
BREITE_KLEIN = 120
BREITE_GROSS = 400


def bild_ablegen(roh: bytes, klein: str, gross: str) -> None:
    from PIL import Image

    with Image.open(io.BytesIO(roh)) as bild:
        bild = bild.convert("RGB")
        for pfad, breite in ((klein, BREITE_KLEIN), (gross, BREITE_GROSS)):
            kopie = bild.copy()
            if kopie.width > breite:
                kopie.thumbnail((breite, breite * 4), Image.LANCZOS)
            kopie.save(pfad, "JPEG", quality=80, optimize=True)


def bilder_kopieren(ziel: str) -> None:
    """Kopiert jedes Kartenbild, das IRGENDEINE abgelegte Datei braucht.

    Bewusst ueber die geschriebenen Dateien statt ueber die eben geladenen Saetze: die
    Tagesdateien nennen deutlich mehr Karten als die fertigen Saetze, und wer nur ueber
    letztere geht, laesst rund zwei Drittel der Bilder fehlen.
    """
    quellen = sorted(glob.glob(BILDQUELLE))
    basis = quellen[-1] if quellen else None
    if basis is None:
        print("  Keine lokale Kartenbibliothek, alle Bilder kommen von der offiziellen "
              "Seite. Der erste Lauf dauert deshalb.")
    os.makedirs(os.path.join(ziel, "img"), exist_ok=True)
    gebraucht = set()
    for pfad in (glob.glob(os.path.join(ziel, "saetze", "*.json.gz"))
                 + glob.glob(os.path.join(ziel, "tage", "*.json.gz"))):
        satz = lesen(pfad)
        for e in satz.get("leader", []):
            for text in ([e["id"]] + list(e.get("geg", []))
                         + [k for li in e.get("listen", []) for k in li["d"]]):
                k = karte(text)
                if k:
                    gebraucht.add(k)
    neu, geladen, fehlt = 0, 0, []
    os.makedirs(os.path.join(ziel, "img", "gross"), exist_ok=True)
    offizielle = None
    for k in sorted(gebraucht):
        # Kennungen mit vorangestelltem X meinen dieselbe Karte, siehe daten.js.
        basiskennung = k[1:] if re.match(r"^X[A-Z]{2,4}\d{2}-\d{3}$", k) else k
        zieldatei = os.path.join(ziel, "img", basiskennung + ".jpg")
        grossdatei = os.path.join(ziel, "img", "gross", basiskennung + ".jpg")
        if os.path.exists(zieldatei) and os.path.exists(grossdatei):
            continue
        # Aus einem aelteren Lauf liegt vielleicht noch das ungerechnete Original da.
        # Dann daraus beide Groessen bauen, statt es erneut zu holen.
        if os.path.exists(zieldatei) and not os.path.exists(grossdatei):
            with open(zieldatei, "rb") as datei:
                vorhanden = datei.read()
            try:
                bild_ablegen(vorhanden, zieldatei, grossdatei)
                neu += 1
                continue
            except Exception:
                pass
        treffer = []
        if basis is not None:
            treffer = (glob.glob(os.path.join(basis, "*", basiskennung + "_small.*"))
                       or glob.glob(os.path.join(basis, "*", basiskennung + ".*")))
        if treffer:
            with open(treffer[0], "rb") as datei:
                bild_ablegen(datei.read(), zieldatei, grossdatei)
            neu += 1
            continue
        # Karten aus Sets, die neuer sind als die lokale Installation. Punk Records
        # nennt zu jeder Karte die offizielle Bild-URL, das schliesst die Luecke.
        if offizielle is None:
            with urllib.request.urlopen(NAMEN_QUELLE, timeout=180) as antwort:
                offizielle = json.loads(antwort.read().decode("utf-8"))
        url = (offizielle.get(basiskennung) or {}).get("img_url")
        if not url:
            fehlt.append(basiskennung)
            continue
        try:
            with urllib.request.urlopen(url, timeout=120) as antwort:
                daten = antwort.read()
            bild_ablegen(daten, zieldatei, grossdatei)
            geladen += 1
        except Exception:
            fehlt.append(basiskennung)
    print(f"  Bilder: {neu} lokal kopiert, {geladen} offiziell nachgeladen, "
          f"{len(gebraucht)} gebraucht")
    if fehlt:
        print(f"    ohne Bild: {fehlt}")


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

    print("Fertige Saetze:")
    saetze = fertige_saetze(ziel)
    if not saetze:
        sys.exit("  Kein Satz geladen.")

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

    verzeichnis = {
        "erstellt": max((s["stand"] for s in saetze.values()), default=""),
        "saetze": [{"schluessel": k, "name": v["name"], "partien": v["partien"],
                    "stand": v["stand"], "datei": "saetze/" + k + ".json.gz"}
                   for k, v in saetze.items()],
        "tage": sorted(tage, key=lambda e: (e["tag"], e["modus"], e["bounty"])),
        "modi": MODI,
        "bounty": list(BOUNTY),
        "bounty_name": BOUNTY_NAME,
    }
    schreiben(os.path.join(ziel, "verzeichnis.json.gz"), verzeichnis)
    print(f"\n  verzeichnis.json: {len(verzeichnis['saetze'])} Saetze, "
          f"{len(verzeichnis['tage'])} Tagesdateien")

    if args.bilder:
        bilder_kopieren(ziel)


if __name__ == "__main__":
    main()
