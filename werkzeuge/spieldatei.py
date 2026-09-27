#!/usr/bin/env python3
"""Die Spieldatei vor dem Start selbst laden, wenn sie nicht zur Datei auf dem Server passt.

Gebraucht von `mitschnitt_server.sh`. Der Starter von OPBounty laedt ein Update selbst,
auf dem Bazzite aber mit rund 50 KB/s: nach fuenf Minuten stand er bei 38 Prozent, das
Skript brach ab, und der naechste Lauf fing wieder bei null an. So scheiterten alle vier
Laeufe am 26. und 27.09.2026. `curl` holt dieselbe Datei dort mit 4,6 MB/s. Liegt die
aktuelle Datei schon an ihrem Platz, startet der Starter das Spiel ohne eigenen Download,
geprueft am 27.09.2026.

Es ist die offizielle Datei von derselben Adresse, die auch der Starter benutzt
(`version_nachziehen.PCK_URL`). Am Spiel wird nichts veraendert.

    python3 werkzeuge/spieldatei.py            # nachziehen, falls noetig

Eine Version erkennt das Werkzeug an Groesse und "Last-Modified". Einen Pruefwert
liefert S3 fuer diese Datei nicht: ihr ETag stammt aus einem mehrteiligen Upload und ist
kein MD5 des Inhalts. Die Kennung des letzten Downloads liegt neben der Arbeitsmappe.
"""
import os
import sys
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
from version_nachziehen import PCK_URL  # noqa: E402

ZIEL = os.path.expanduser("~/.local/share/godot/app_userdata/OPBounty/OPBounty.pck")
KENNUNGSDATEI = os.path.expanduser("~/mitschnitt/spieldatei.kennung")
ZEITGRENZE = 120          # Sekunden je Anfrage; bei 4,6 MB/s dauern 40 MB unter zehn
BLOCK = 1 << 20           # beim Herunterladen je ein MB


def server_kennung(url):
    """(Groesse, Last-Modified) der Datei auf dem Server, per HEAD."""
    anfrage = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(anfrage, timeout=ZEITGRENZE) as antwort:
        laenge = int(antwort.headers["Content-Length"])
        geaendert = antwort.headers.get("Last-Modified", "")
    return laenge, geaendert


def kennung_lesen(pfad):
    """Die gemerkte Kennung des letzten Downloads, oder None."""
    try:
        with open(pfad, encoding="utf-8") as datei:
            laenge, geaendert = datei.read().split("\n", 1)
        return int(laenge), geaendert.strip()
    except (OSError, ValueError):
        return None


def kennung_schreiben(pfad, kennung):
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    with open(pfad, "w", encoding="utf-8") as datei:
        datei.write(f"{kennung[0]}\n{kennung[1]}\n")


def muss_laden(kennung_server, kennung_gemerkt, lokale_laenge):
    """Laden, wenn der Server eine andere Version hat als die gemerkte, oder wenn die
    Datei am Platz nicht die volle Groesse hat. Letzteres faengt den Rest ab, den ein
    abgebrochener Download des Starters hinterlaesst, im Fehlerfall 19 von 40 MB."""
    if kennung_gemerkt != kennung_server:
        return True
    return lokale_laenge != kennung_server[0]


def laden(url, ziel, laenge):
    """Die Datei nach `<ziel>.neu` laden, die Groesse pruefen und erst dann an den Platz
    legen. So liegt am Platz nie eine halbe Datei, auch wenn der Download abbricht."""
    neu = ziel + ".neu"
    try:
        with urllib.request.urlopen(url, timeout=ZEITGRENZE) as antwort, \
                open(neu, "wb") as datei:
            while True:
                block = antwort.read(BLOCK)
                if not block:
                    break
                datei.write(block)
        erhalten = os.path.getsize(neu)
        if erhalten != laenge:
            raise OSError(f"{erhalten} statt {laenge} Byte erhalten")
        os.replace(neu, ziel)
    finally:
        if os.path.exists(neu):
            os.remove(neu)


def nachziehen(url=PCK_URL, ziel=ZIEL, kennungsdatei=KENNUNGSDATEI):
    """Laedt die Datei, falls noetig. Gibt "geladen" oder "aktuell" zurueck, wirft OSError
    bei einem Fehler; die Datei am Platz bleibt dann unberuehrt."""
    kennung = server_kennung(url)
    lokal = os.path.getsize(ziel) if os.path.exists(ziel) else -1
    if not muss_laden(kennung, kennung_lesen(kennungsdatei), lokal):
        return "aktuell"
    laden(url, ziel, kennung[0])
    kennung_schreiben(kennungsdatei, kennung)
    return "geladen"


def main():
    try:
        ergebnis = nachziehen()
    except OSError as fehler:
        print(f"  Spieldatei nicht nachgezogen: {fehler}", file=sys.stderr)
        return 1
    print(f"  Spieldatei {ergebnis}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
