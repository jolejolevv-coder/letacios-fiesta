#!/usr/bin/env python3
"""Die Bestenliste aus Fotos des Spiels lesen. specs/features/bestenliste-mitschnitt.md,
Nachtrag vom 20.10.2026.

Seit OPBounty 2.7 (19.10.2026) kommt die Bestenliste verschluesselt ueber
`wss://api.apibounty.online/ws`; der Mitschnitt sieht nur noch TLS. Deshalb fotografiert
`mitschnitt_server.sh` jede der fuenf Seiten, und dieses Werkzeug liest sie ab:

* Rang aus Seite und Zeile, nicht aus dem Bild (die einstelligen Raenge liest Tesseract
  unzuverlaessig).
* Name, Bounty und die Winrate der bis zu drei Leader mit Tesseract.
* Die Leader selbst ueber ihr kleines Kartenbild, verglichen mit den Leaderkarten der Seite.

Was das Spiel in der Zeile nicht zeigt, fehlt: Partien, Spielzeit, Sitzsplit.

Jeder unsichere Wert bleibt leer und steht in `unsicher`, statt geraten zu werden:
* Bounty: zwei Lesungen in verschiedener Groesse muessen gleich sein, und die Bounty muss
  mit dem Rang fallen.
* Leader: der beste Treffer muss deutlich besser sein als der zweitbeste.

    python3 werkzeuge/bestenliste_ocr.py <ordner mit seite_N.png>   # druckt JSON
"""
import difflib
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

from PIL import Image, ImageChops, ImageOps, ImageStat

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)

SEITEN = 5
ZEILEN_JE_SEITE = 20
SICHTBARE_ZEILEN = 19          # die 20. Zeile steht unter dem Rand, siehe seite_N_b.png
# Lage der Zeilen im Foto des Vollbildfensters (1920 breit), gemessen am 20.10.2026
ERSTE_ZEILE_OBEN = 186
ZEILENHOEHE = 34.47
SPALTEN = {                    # x von, x bis
    "name": (192, 540),
    "bounty": (930, 1200),
    "wr": [(583, 692), (733, 810), (849, 925)],
}
SYMBOL_X = [554, 706, 822]     # linke Kante der drei Leaderbilder
SYMBOL_B, SYMBOL_H = 23, 31
LISTE_OBEN, LISTE_UNTEN = 180, 860   # senkrechter Bereich der Zeilen im Foto
TRENNER_GRAU = (35, 48)        # Helligkeit der grauen Trennlinie zwischen zwei Zeilen
TRENNER_X = (0, 40)            # in der Rangspalte, dort steht nie ein Bild
MIN_ZEILE, MAX_ZEILE = 25, 32  # Hoehe der Schriftflaeche einer Zeile zwischen zwei Trennern
VERGLEICH = (12, 17)           # Groesse, in der Bild und Karte verglichen werden
SUCHE_X, SUCHE_Y = range(-5, 6), range(0, 5)
LEADER_GRENZE = 145            # schlechter passt kein Leader; Mihawk lag am 20.10. bei 120 bis 128
LEADER_VORSPRUNG = 15          # so viel besser als der zweitbeste muss der Treffer sein
NAMEN_AEHNLICH = 0.8           # ab hier gilt ein gelesener Name als ein bekannter
TESSERACT_FRIST = 20

SEITE_URL = "https://fiesta.nahobinoco.com"
BILDER = os.path.expanduser("~/mitschnitt/leaderbilder")


# --- Tesseract --------------------------------------------------------------------

def tesseract_pfad():
    for p in (shutil.which("tesseract"), "/home/linuxbrew/.linuxbrew/bin/tesseract",
              "/opt/homebrew/bin/tesseract"):
        if p and os.path.exists(p):
            return p
    raise SystemExit("tesseract fehlt (brew install tesseract)")


def vorbereiten(bild, groesse, schwelle, kanal=None):
    """Helle Schrift auf dunklem Grund fuer Tesseract: vergroessern, dunkle Schrift auf Weiss."""
    grau = bild.getchannel(kanal) if kanal else bild.convert("L")
    if schwelle:
        grau = grau.point(lambda v: 0 if v > schwelle else 255)
    else:
        grau = ImageOps.invert(grau)
    return grau.resize((grau.width * groesse, grau.height * groesse), Image.LANCZOS)


def lesen(bild, erlaubt=None, groesse=3, schwelle=None, kanal=None):
    """Eine Zeile Text. Leerer Text bei jedem Fehler von Tesseract."""
    with tempfile.NamedTemporaryFile(suffix=".png") as datei:
        vorbereiten(bild, groesse, schwelle, kanal).save(datei.name)
        befehl = [tesseract_pfad(), datei.name, "-", "--psm", "7"]
        if erlaubt:
            befehl += ["-c", f"tessedit_char_whitelist={erlaubt}"]
        try:
            r = subprocess.run(befehl, capture_output=True, text=True, timeout=TESSERACT_FRIST)
        except (OSError, subprocess.TimeoutExpired):
            return ""
    return r.stdout.strip()


# --- Felder -----------------------------------------------------------------------

BOUNTY_MUSTER = re.compile(r"(\d+(?:\.\d)?)\s*mil", re.I)
WR_MUSTER = re.compile(r"^(\d{1,3}(?:\.\d)?)%$")


def bounty_aus(text):
    m = BOUNTY_MUSTER.search(text.replace(",", ""))
    return float(m.group(1)) if m else None


def bounty_lesen(zelle):
    """Zwei Lesungen in verschiedener Groesse; nur wenn beide gleich sind, gilt der Wert."""
    erlaubt = "B$0123456789. milon"
    a = bounty_aus(lesen(zelle, erlaubt, 3))
    b = bounty_aus(lesen(zelle, erlaubt, 4))
    return a if a is not None and a == b else None


def wr_aus(text):
    m = WR_MUSTER.match(text)
    if not m:
        return None
    wert = float(m.group(1))
    return wert if 0 <= wert <= 100 else None


NAME_ROT_SCHWELLE = 110        # hinterlegte Zeile: Grund (29, 29, 98), Schrift hellblau


def name_lesen(zelle):
    """Erst wie die Zahlen, dann mit Schwelle, dann nur der Rotkanal. Hinterlegte Zeilen
    (eigene Freunde, blau) haben hellblaue Schrift auf Blau; im Rotkanal steht die Schrift
    bei rund 150, der Grund bei 29. So am 20.10.2026 fuer "nanana" auf Rang 18."""
    return (lesen(zelle) or lesen(zelle, schwelle=95)
            or lesen(zelle, schwelle=NAME_ROT_SCHWELLE, kanal="R"))


# --- Leaderbilder -----------------------------------------------------------------

def von_der_seite(datei, passwort):
    """Eine verschluesselte Datendatei der eigenen Seite holen und auspacken."""
    sys.path.insert(0, REPO)
    from verschluesseln import entschluesseln, salz_holen, schluessel

    with urllib.request.urlopen(f"{SEITE_URL}/{datei}.enc", timeout=60) as antwort:
        geheim = antwort.read()
    return json.loads(gzip.decompress(entschluesseln(schluessel(passwort, salz_holen()), geheim)))


def leaderkarten(passwort):
    """Die Kennungen aller Leader aus der Kartentabelle der Seite."""
    karten = von_der_seite("karten.json.gz", passwort)
    return sorted(k for k, v in karten.items() if v.get("a") == "l")


def bekannte_ids(passwort):
    """{Name: user_id} aus den Partien der Spielerseiten: jede Partie nennt den Gegner mit
    Name und user_id. So findet auch ein Spieler, der neu in den Top 100 ist, oft seine
    Spielerseite, sofern er gegen einen bekannten gespielt hat."""
    try:
        paket = von_der_seite("spieler.json.gz", passwort)
    except (OSError, ValueError):
        return {}
    spieler = paket.get("spieler", {})
    # Die Namenstabelle, die spieler_daten.py in der Action aus PublicUsers aufbaut.
    ids = {}
    for uid, s in paket.get("namen", {}).items():
        name = s.get("name") if isinstance(s, dict) else s
        if name:
            ids[name] = int(uid)
    for daten in spieler.values():
        for p in daten.get("partien", []):
            if p.get("gegner") and p.get("gegner_id") is not None:
                ids[p["gegner"]] = p["gegner_id"]
    return ids


def leaderbilder(passwort):
    """{Kennung: Vergleichsbild}. Fehlende Karten holt es einmal von der eigenen Seite."""
    os.makedirs(BILDER, exist_ok=True)
    aus = {}
    for kennung in leaderkarten(passwort):
        pfad = os.path.join(BILDER, f"{kennung}.jpg")
        if not os.path.exists(pfad):
            try:
                with urllib.request.urlopen(f"{SEITE_URL}/img/{kennung}.jpg", timeout=30) as a:
                    daten = a.read()
            except OSError:
                continue
            with open(pfad, "wb") as datei:
                datei.write(daten)
        try:
            aus[kennung] = Image.open(pfad).convert("RGB").resize(VERGLEICH, Image.BOX)
        except OSError:
            continue
    return aus


def leader_erkennen(foto, oben, x, karten):
    """(Kennung oder None, sicher?). Sucht das Bild in einem kleinen Fenster um seinen Platz."""
    beste = None
    for dx in SUCHE_X:
        for dy in SUCHE_Y:
            bild = foto.crop((x + dx, oben + dy, x + dx + SYMBOL_B, oben + dy + SYMBOL_H))
            bild = bild.resize(VERGLEICH, Image.BOX)
            werte = sorted((sum(ImageStat.Stat(ImageChops.difference(bild, k)).mean), name)
                           for name, k in karten.items())[:2]
            if beste is None or werte[0][0] < beste[0][0]:
                beste = werte
    if len(beste) < 2 or beste[0][0] > LEADER_GRENZE:
        return None, True                     # kein Bild an diesem Platz
    return beste[0][1], beste[1][0] - beste[0][0] >= LEADER_VORSPRUNG


# --- Zeilen und Seiten ------------------------------------------------------------

def zeile_lesen(foto, oben, karten):
    e = {"name": name_lesen(foto.crop((*SPALTEN["name"][:1], oben + 4, SPALTEN["name"][1], oben + 30))),
         "bounty": bounty_lesen(foto.crop((SPALTEN["bounty"][0], oben + 4, SPALTEN["bounty"][1], oben + 30))),
         "leader": [], "unsicher": []}
    for platz, ((x0, x1), sx) in enumerate(zip(SPALTEN["wr"], SYMBOL_X), 1):
        wr_text = lesen(foto.crop((x0, oben + 4, x1, oben + 30)), "0123456789.%", 3)
        if not wr_text:
            continue                   # ohne Winrate daneben ist der Platz leer
        wr = wr_aus(wr_text)
        kennung, sicher = leader_erkennen(foto, oben, sx, karten)
        if kennung is None or not sicher:
            e["unsicher"].append(f"leader{platz}")
        e["leader"].append({"leader": kennung if sicher else None, "winrate": wr})
    if e["bounty"] is None:
        e["unsicher"].append("bounty")
    if not e["name"]:
        e["unsicher"].append("name")
    return e


def zeilen_oben(foto):
    """Oberkante jeder Zeile, an den Trennlinien gefunden. Findet es nicht genau so viele
    Zeilen, wie sichtbar sein muessen, gilt das feste Raster vom 20.10.2026."""
    gefunden = trennlinien_zeilen(foto)
    if len(gefunden) == SICHTBARE_ZEILEN:
        return gefunden
    return [round(ERSTE_ZEILE_OBEN + ZEILENHOEHE * i) for i in range(SICHTBARE_ZEILEN)]


def ist_trenner(foto, y):
    """Die Zeilen trennt eine 4 Pixel hohe, gleichmaessig graue Linie (Helligkeit um 41),
    die Zeilen selbst sind fast schwarz oder, wenn hinterlegt, blau. Gemessen am 20.10.2026."""
    grau = 0
    proben = range(TRENNER_X[0], TRENNER_X[1], 3)
    for x in proben:
        r, g, b = foto.getpixel((x, y))
        if abs(r - g) < 6 and abs(g - b) < 6 and TRENNER_GRAU[0] <= (r + g + b) / 3 <= TRENNER_GRAU[1]:
            grau += 1
    return grau >= 0.9 * len(proben)


def trennlinien_zeilen(foto):
    """Oberkanten der vollstaendig sichtbaren Zeilen, gefunden an den Trennlinien. Gebraucht
    fuer das Foto nach dem Scrollen: dort liegt das Raster um einen Bruchteil verschoben."""
    trenner = [y for y in range(LISTE_OBEN, LISTE_UNTEN) if ist_trenner(foto, y)]
    enden = [y for i, y in enumerate(trenner) if i + 1 == len(trenner) or trenner[i + 1] != y + 1]
    anfaenge = [y for i, y in enumerate(trenner) if i == 0 or trenner[i - 1] != y - 1]
    oben = []
    for ende, anfang in zip(enden, anfaenge[1:]):
        if MIN_ZEILE <= anfang - ende - 1 <= MAX_ZEILE:
            oben.append(ende - 2)    # wie im festen Raster: die Zeile beginnt knapp ueber der Flaeche
    return oben


def zeile_20(ordner, seite, karten):
    """Die 20. Zeile aus dem Foto nach dem Scrollen: die letzte vollstaendig sichtbare."""
    pfad = os.path.join(ordner, f"seite_{seite}_b.png")
    if not os.path.exists(pfad):
        return None
    foto = Image.open(pfad).convert("RGB")
    oben = trennlinien_zeilen(foto)
    return zeile_lesen(foto, oben[-1], karten) if oben else None


def seiten_lesen(ordner, karten):
    eintraege = []
    for seite in range(1, SEITEN + 1):
        pfad = os.path.join(ordner, f"seite_{seite}.png")
        if not os.path.exists(pfad):
            continue
        foto = Image.open(pfad).convert("RGB")
        zeilen = [zeile_lesen(foto, y, karten) for y in zeilen_oben(foto)]
        z20 = zeile_20(ordner, seite, karten)
        # Nur uebernehmen, wenn es wirklich eine neue Zeile ist und nicht die 19. noch einmal.
        if z20 and z20.get("name") and difflib.SequenceMatcher(
                None, z20["name"], zeilen[-1].get("name") or "").ratio() < NAMEN_AEHNLICH:
            zeilen.append(z20)
        for i, e in enumerate(zeilen, 1):
            e["rang"] = (seite - 1) * ZEILEN_JE_SEITE + i
            eintraege.append(e)
    return eintraege


# --- Gegenproben ------------------------------------------------------------------

def bounty_pruefen(eintraege):
    """Die Bounty faellt mit dem Rang. Gilt als richtig gelesen, was zur laengsten nicht
    steigenden Folge gehoert; alles andere (etwa eine 6 als 8 gelesen) wird geleert."""
    stellen = [i for i, e in enumerate(eintraege) if e.get("bounty") is not None]
    werte = [eintraege[i]["bounty"] for i in stellen]
    laenge, vorgaenger = [1] * len(werte), [-1] * len(werte)
    for i in range(len(werte)):
        for k in range(i):
            if werte[k] >= werte[i] and laenge[k] + 1 > laenge[i]:
                laenge[i], vorgaenger[i] = laenge[k] + 1, k
    # Bei Gleichstand die Folge, die spaeter endet: sie laesst den Ausreisser in der Mitte aus.
    behalten, i = set(), max(reversed(range(len(werte))), key=lambda x: laenge[x], default=-1)
    while i >= 0:
        behalten.add(stellen[i])
        i = vorgaenger[i]
    for i in stellen:
        if i not in behalten:
            eintraege[i]["bounty"] = None
            if "bounty" not in eintraege[i]["unsicher"]:
                eintraege[i]["unsicher"].append("bounty")


def namen_zuordnen(eintraege, alt, gegner_ids):
    """Einen gelesenen Namen auf einen bekannten Spieler legen; dann gelten dessen Name,
    login und user_id (die Spielerseite haengt daran). Bekannt ist, wer in der letzten
    Bestenliste stand oder als Gegner in einer Partie der Spielerseiten vorkommt."""
    bekannte = {n: {"name": n, "user_id": i} for n, i in gegner_ids.items()}
    bekannte.update({e["name"]: e for e in alt if e.get("name")})
    for e in eintraege:
        if not e.get("name"):
            continue
        treffer = difflib.get_close_matches(e["name"], list(bekannte), n=1, cutoff=NAMEN_AEHNLICH)
        if treffer:
            b = bekannte[treffer[0]]
            e["name"] = b["name"]
            e["login"] = b.get("login", b["name"])
            if b.get("user_id") is not None:
                e["user_id"] = b["user_id"]
        else:
            e["login"] = e["name"]


def alt_laden(pfad):
    try:
        with gzip.open(pfad) as datei:
            return json.load(datei).get("spieler", [])
    except (OSError, ValueError):
        return []


def aus_fotos(ordner, passwort, alt_pfad):
    karten = leaderbilder(passwort)
    if not karten:
        raise SystemExit("keine Leaderbilder, Vergleich unmoeglich")
    eintraege = seiten_lesen(ordner, karten)
    bounty_pruefen(eintraege)
    namen_zuordnen(eintraege, alt_laden(alt_pfad), bekannte_ids(passwort))
    for e in eintraege:
        e["quelle"] = "ocr"
        if not e["unsicher"]:
            del e["unsicher"]
    return [e for e in eintraege if e.get("name")]


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        raise SystemExit(__doc__)
    sys.path.insert(0, REPO)
    from bestenliste_einbauen import seitenpasswort, ZIEL

    eintraege = aus_fotos(argv[0], seitenpasswort(), ZIEL)
    json.dump(eintraege, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    main()
