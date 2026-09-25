#!/usr/bin/env python3
"""Erkennen, welcher Knopf gerade im Spielfenster zu sehen ist.

Gebraucht von `mitschnitt_server.sh`. Das Skript klickt nie blind: vor jedem Klick muss
der Ausschnitt eines Bildschirmfotos dem Referenzbild der Klickstelle entsprechen.
Koordinaten und Referenzen sind relativ zum Spielfenster, damit es egal ist, wo der
Fenstermanager das Fenster gerade hinlegt.

    python3 werkzeuge/bildschirm.py finde foto.png hinweis_schliessen anmelden bestenlisten
    python3 werkzeuge/bildschirm.py pruefe foto.png naechste_seite
    python3 werkzeuge/bildschirm.py klick naechste_seite

`finde` gibt den Namen der ersten passenden Stelle aus, in der angegebenen Reihenfolge,
und endet mit 1, wenn keine passt. `pruefe` endet mit 0 oder 1. `klick` gibt "x y" aus.
"""
import glob
import json
import os
import sys

from PIL import Image, ImageChops, ImageStat

HIER = os.path.dirname(os.path.abspath(__file__))
KLICKSTELLEN = os.path.join(HIER, "klickstellen.json")
REFERENZEN = os.path.join(HIER, "referenz")

# Mittlere Abweichung je Farbkanal, 0 bis 255. Gemessen am 25.09.2026 an fuenf echten
# Bildschirmfotos: eine passende Stelle weicht um 0,0 ab, jede andere um mindestens
# 32,4. Die 32,4 kamen vom Hover, als die Maus noch auf dem Knopf stand; das Skript
# schiebt die Maus deshalb vor jedem Foto weg. 12 laesst Raum fuer leichte
# Darstellungsunterschiede und bleibt weit unter jedem Fehltreffer.
SCHWELLE = 12.0


def stellen_laden(pfad=KLICKSTELLEN):
    """Die Klickstellen als dict Name -> {"box": [...], "klick": [...]}."""
    with open(pfad, encoding="utf-8") as datei:
        daten = json.load(datei)
    return {name: wert for name, wert in daten.items() if not name.startswith("_")}


def abweichung(foto, referenz, box):
    """Mittlere Abweichung des Ausschnitts `box` von `referenz`, 0 bis 255.

    Liegt der Ausschnitt ganz oder teilweise ausserhalb des Fotos, ist das keine
    Uebereinstimmung: dann kommt unendlich zurueck, nie ein Zufallstreffer."""
    links, oben, rechts, unten = box
    if rechts > foto.width or unten > foto.height:
        return float("inf")
    ausschnitt = foto.convert("RGB").crop(box)
    if ausschnitt.size != referenz.size:
        return float("inf")
    kanaele = ImageStat.Stat(ImageChops.difference(ausschnitt, referenz.convert("RGB"))).mean
    return sum(kanaele) / len(kanaele)


def referenzdateien(name, referenzen=REFERENZEN):
    """Alle Referenzbilder einer Stelle: `<name>.png` und jede Variante `<name>__*.png`.

    Varianten gibt es, weil derselbe Knopf verschieden aussehen kann. "Next Page"
    behaelt nach dem Klick den Fokus und wird heller, Abweichung 32,4 zur Grundform,
    gemessen im Prueflauf vom 25.09.2026. Der Knopf ist dann trotzdem da."""
    haupt = os.path.join(referenzen, name + ".png")
    varianten = sorted(glob.glob(os.path.join(referenzen, glob.escape(name) + "__*.png")))
    return [haupt] + varianten


def passt(foto, name, stellen, referenzen=REFERENZEN, schwelle=SCHWELLE):
    """Zeigt das Foto an der Stelle `name` eines ihrer Referenzbilder?"""
    box = stellen[name]["box"]
    for pfad in referenzdateien(name, referenzen):
        with Image.open(pfad) as referenz:
            if abweichung(foto, referenz, box) <= schwelle:
                return True
    return False


def finde(foto, namen, stellen, referenzen=REFERENZEN):
    """Die erste Stelle aus `namen`, die im Foto zu sehen ist, sonst None."""
    for name in namen:
        if passt(foto, name, stellen, referenzen):
            return name
    return None


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    befehl, stellen = argv[0], stellen_laden()
    if befehl == "klick":
        x, y = stellen[argv[1]]["klick"]
        print(x, y)
        return 0
    try:
        foto = Image.open(argv[1])
    except OSError as fehler:
        print(f"Foto nicht lesbar: {fehler}", file=sys.stderr)
        return 2
    if befehl == "finde":
        treffer = finde(foto, argv[2:], stellen)
        if treffer is None:
            return 1
        print(treffer)
        return 0
    if befehl == "pruefe":
        return 0 if passt(foto, argv[2], stellen) else 1
    print(f"unbekannter Befehl: {befehl}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
