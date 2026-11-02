#!/usr/bin/env python3
"""Probebetrieb der Web API: ihre Top 100 gegen die OCR Liste im Repo halten.

Gedacht fuer die GitHub Action (specs/features/bestenliste-web-api.md, Phase 2). Das
Repo ist oeffentlich und die Logs der Action auch, deshalb gibt dieses Skript NUR Zahlen
aus, nie Namen, Bounty oder user_ids einzelner Spieler.

Die OCR Liste ist vom fruehen Morgen, die API ist live. Bountywerte weichen deshalb um die
Tagesbewegung ab; gezaehlt wird, wie viele Namen und Raenge zusammenpassen und wie viele
user_ids die API mehr liefert.
"""
import difflib
import gzip
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public",
                    "bestenliste.json.gz")
NAME_AEHNLICH = 0.7        # darunter gilt ein Name als anderer Spieler
BOUNTY_TOLERANZ = 400.0    # mehr als diese Tagesbewegung gilt als Ausreisser


def glatt(name):
    """Verwechslungen der OCR einebnen: 1, l, I, | und 0, O gelten als gleich."""
    return name.lower().translate(str.maketrans("li|o", "1110"))


def vergleichen(api, ocr):
    """Zaehlt, wie gut zwei Listen zusammenpassen. Gibt nur Zahlen zurueck."""
    nach_id = {e["user_id"]: e for e in api}
    mit_id = [p for p in ocr if p.get("user_id") in nach_id]
    gleich = aehnlich = ausreisser = 0
    rangabstand, bountyabstand = [], []
    for p in mit_id:
        e = nach_id[p["user_id"]]
        if p["name"] == e["name"]:
            gleich += 1
        elif difflib.SequenceMatcher(None, glatt(p["name"]), glatt(e["name"])).ratio() >= NAME_AEHNLICH:
            aehnlich += 1
        rangabstand.append(abs(p["rang"] - e["rang"]))
        d = abs(p["bounty"] - e["bounty"])
        bountyabstand.append(d)
        ausreisser += d > BOUNTY_TOLERANZ
    return {
        "api_zeilen": len(api),
        "ocr_zeilen": len(ocr),
        "api_mit_user_id": sum(1 for e in api if e.get("user_id")),
        "ocr_mit_user_id": sum(1 for p in ocr if p.get("user_id")),
        "ueber_user_id_gefunden": len(mit_id),
        "name_gleich": gleich,
        "name_aehnlich": aehnlich,
        "name_anders": len(mit_id) - gleich - aehnlich,
        "rangabstand_median": statistics.median(rangabstand) if rangabstand else None,
        "bountyabstand_median": round(statistics.median(bountyabstand), 1) if bountyabstand else None,
        "bounty_ausreisser": ausreisser,
    }


def ocr_laden(pfad=ZIEL):
    from verschluesseln import lesen
    return json.loads(gzip.decompress(lesen(pfad)))["spieler"]


def main():
    from bestenliste_api import top_holen
    api = top_holen()
    bericht = vergleichen(api, ocr_laden())
    zeilen = ["## Bestenliste: Web API gegen OCR", ""]
    zeilen += [f"* {k}: {v}" for k, v in bericht.items()]
    text = "\n".join(zeilen)
    print(text)
    ziel = os.environ.get("GITHUB_STEP_SUMMARY")
    if ziel:
        with open(ziel, "a", encoding="utf-8") as datei:
            datei.write(text + "\n")


if __name__ == "__main__":
    main()
