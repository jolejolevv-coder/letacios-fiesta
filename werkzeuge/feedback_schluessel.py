#!/usr/bin/env python3
"""Den Web3Forms Schluessel aus WEB3FORMS_KEY als feedback.json.gz ablegen.

Die Datei wird danach von verschluesseln.py mit dem Seitenpasswort verschluesselt
(specs/features/feedback.md). Fehlt die Umgebungsvariable, wird nichts geschrieben und eine
Warnung ausgegeben; die Seite zeigt dann keinen Knopf. Der Schluessel erscheint nie im Log.

    WEB3FORMS_KEY=... python3 werkzeuge/feedback_schluessel.py --ziel public
"""
import argparse
import gzip
import json
import os
import sys

DATEI = "feedback.json.gz"
VARIABLE = "WEB3FORMS_KEY"


def schreiben(ziel: str, schluessel: str) -> str:
    """Schreibt die Datei und gibt ihren Pfad zurueck."""
    pfad = os.path.join(ziel, DATEI)
    os.makedirs(ziel, exist_ok=True)
    with gzip.open(pfad, "wb", compresslevel=9) as datei:
        datei.write(json.dumps({"schluessel": schluessel}).encode())
    return pfad


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--ziel", default="public")
    args = ap.parse_args()
    schluessel = os.environ.get(VARIABLE, "").strip()
    if not schluessel:
        print(f"::warning::{VARIABLE} fehlt, die Seite zeigt keinen Knopf fuer Vorschlaege")
        return 0
    schreiben(args.ziel, schluessel)
    print(f"  {DATEI} geschrieben")
    return 0


if __name__ == "__main__":
    sys.exit(main())
