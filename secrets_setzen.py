#!/usr/bin/env python3
"""Die Zugangsdaten aus dem Spielpaket in die GitHub-Secrets schreiben.

Einmalig auszufuehren. Die Werte wandern direkt vom Paket in `gh secret set` und
werden dabei **nirgends ausgegeben**: nicht auf dem Bildschirm, nicht in der
Kommandozeile, nicht in einer Datei. Sie gehen ueber die Standardeingabe des
Unterprozesses.

Es ist nicht das Spielkonto des Nutzers, sondern das Dienstkonto, das in jeder
Installation des Spiels steckt. Die Action meldet sich damit an wie jeder Client.

    python3 secrets_setzen.py
    python3 secrets_setzen.py --pruefen   # nur zeigen, was gesetzt waere
"""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from firestore import zugang  # noqa: E402

# Name des Secrets -> Schluessel in den Zugangsdaten.
ZUORDNUNG = {
    "OPBOUNTY_API_KEY": "apiKey",
    "OPBOUNTY_PROJECT": "projectId",
    "OPBOUNTY_BUCKET": "storageBucket",
    "OPBOUNTY_EMAIL": "email",
    "OPBOUNTY_PASSWORT": "password",
}


def main():
    p = argparse.ArgumentParser(description="Secrets aus dem Spielpaket setzen")
    p.add_argument("--pruefen", action="store_true",
                   help="nur auflisten, nichts schreiben")
    a = p.parse_args()

    c = zugang()
    fehlt = [k for k in ZUORDNUNG.values() if not c.get(k)]
    if fehlt:
        raise SystemExit(f"Im Paket fehlt: {', '.join(fehlt)}")

    for name, schluessel in ZUORDNUNG.items():
        laenge = len(str(c[schluessel]))
        if a.pruefen:
            print(f"  {name:20} waere gesetzt, {laenge} Zeichen")
            continue
        lauf = subprocess.run(["gh", "secret", "set", name],
                              input=str(c[schluessel]), text=True,
                              capture_output=True)
        if lauf.returncode != 0:
            raise SystemExit(f"  {name}: {lauf.stderr.strip()[:200]}")
        print(f"  {name:20} gesetzt, {laenge} Zeichen")

    if not a.pruefen:
        print("\n  Fertig. Die Werte standen zu keinem Zeitpunkt in der Ausgabe.")


if __name__ == "__main__":
    main()
