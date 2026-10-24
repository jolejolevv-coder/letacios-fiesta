#!/usr/bin/env python3
"""Kartenbilder, die auf der Liveseite fehlen, aus der lokalen OPTCGSim Installation ins
Repo legen (`bilder_nachtrag/`). Die Action kopiert sie von dort nach `img/`.

Warum: die Action hat keinen Sim, und fuer neue Sets nennt die offizielle Quelle oft noch
kein Bild. Der Sim laedt fehlende Bilder beim Spielen selbst nach.

    python3 aktualisieren.py --ziel /tmp/lauf           # Saetze ablegen
    python3 werkzeuge/bilder_nachtragen.py /tmp/lauf     # fehlende Bilder nachtragen
"""
import concurrent.futures as futures
import glob
import os
import re
import sys
import urllib.error
import urllib.request

HIER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HIER)
import aktualisieren as A  # noqa: E402

SEITE = "https://fiesta.nahobinoco.com/img/"
PARALLEL = 16
X_KARTE = re.compile(r"^X[A-Z]{2,4}\d{2}-\d{3}$")


def gebrauchte_karten(ordner):
    """Alle Kartenkennungen, die die Saetze und Tagesdateien unter `ordner` nennen."""
    karten = set()
    for pfad in (glob.glob(os.path.join(ordner, "saetze", "*.json.gz"))
                 + glob.glob(os.path.join(ordner, "tage", "*.json.gz"))):
        for e in A.lesen(pfad).get("leader", []):
            for text in ([e["id"]] + list(e.get("geg", []))
                         + [k for li in e.get("listen", []) for k in li["d"]]):
                k = A.karte(text)
                if k:
                    karten.add(k[1:] if X_KARTE.match(k) else k)
    return karten


def fehlt_live(kennung):
    """True, wenn die Liveseite kein Bild liefert. Bei Netzfehlern lieber False."""
    anfrage = urllib.request.Request(SEITE + kennung + ".jpg", method="HEAD")
    try:
        with urllib.request.urlopen(anfrage, timeout=20):
            return False
    except urllib.error.HTTPError as fehler:
        return fehler.code == 404
    except (urllib.error.URLError, TimeoutError):
        return False


def im_sim(basis, kennung):
    treffer = (glob.glob(os.path.join(basis, "*", kennung + "_small.*"))
               or glob.glob(os.path.join(basis, "*", kennung + ".*")))
    return treffer[0] if treffer else None


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    quellen = sorted(glob.glob(A.BILDQUELLE))
    if not quellen:
        sys.exit("  Keine OPTCGSim Installation gefunden: " + A.BILDQUELLE)
    basis = quellen[-1]
    karten = sorted(gebrauchte_karten(sys.argv[1]))
    with futures.ThreadPoolExecutor(PARALLEL) as pool:
        fehlend = [k for k, f in zip(karten, pool.map(fehlt_live, karten)) if f]
    os.makedirs(A.NACHTRAG, exist_ok=True)
    neu, ohne = 0, []
    for kennung in fehlend:
        ziel = os.path.join(A.NACHTRAG, kennung + ".jpg")
        quelle = im_sim(basis, kennung)
        if os.path.exists(ziel):
            continue
        if not quelle:
            ohne.append(kennung)
            continue
        with open(quelle, "rb") as datei:
            A.bild_ablegen(datei.read(), ziel)
        neu += 1
    print(f"  {len(karten)} gebraucht, {len(fehlend)} fehlen live, {neu} nachgetragen")
    if ohne:
        print(f"    auch im Sim ohne Bild: {ohne}")


if __name__ == "__main__":
    main()
