#!/usr/bin/env python3
"""Verschluesselt die Datendateien, damit die Seite ein echtes Passwort bekommt.

WARUM UEBERHAUPT. Die Seite liegt auf GitHub Pages, also statisch und oeffentlich. Eine
Passwortabfrage in JavaScript waere dort Theater: der Code liegt offen, die Datendateien
liegen daneben, ein Blick in die Entwicklerwerkzeuge genuegt. Deshalb wird nicht der
Zugang bewacht, sondern der Inhalt verschluesselt. Ohne Passwort laedt zwar die Huelle,
aber es gibt nichts zu sehen.

VERFAHREN. AES-256-GCM. Der Schluessel kommt aus PBKDF2-HMAC-SHA256 ueber das Passwort,
200000 Runden, mit einem Salz, das fuer alle Dateien gleich ist, damit der Browser die
Ableitung nur einmal rechnen muss. Jede Datei bekommt einen eigenen Zufallsvektor.

    Dateiformat   iv (12 Byte) || Geheimtext mit angehaengtem GCM-Tag
    schluessel.json   Salz, Rundenzahl und eine Probe zum Pruefen des Passworts

Die Kartenbilder bleiben unverschluesselt. Es sind oeffentliche Kartenscans, sie tragen
keine Information ueber den Nutzer, und 2200 Dateien zu verschluesseln waere Aufwand
ohne Gewinn.

    SEITEN_PASSWORT=... python3 verschluesseln.py --ziel public
"""
import argparse
import base64
import glob
import hashlib
import json
import os
import secrets
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

RUNDEN = 200_000
PROBE = b"letacios-fiesta"


def schluessel(passwort: str, salz: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", passwort.encode("utf-8"), salz, RUNDEN, 32)


def verschluesseln(schl: bytes, klartext: bytes) -> bytes:
    iv = secrets.token_bytes(12)
    return iv + AESGCM(schl).encrypt(iv, klartext, None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ziel", default="public")
    args = ap.parse_args()

    passwort = os.environ.get("SEITEN_PASSWORT", "").strip()
    if not passwort:
        sys.exit("  SEITEN_PASSWORT ist nicht gesetzt.")

    salz = secrets.token_bytes(16)
    schl = schluessel(passwort, salz)

    muster = [
        os.path.join(args.ziel, "*.json.gz"),
        os.path.join(args.ziel, "saetze", "*.json.gz"),
        os.path.join(args.ziel, "tage", "*.json.gz"),
    ]
    dateien = [p for m in muster for p in glob.glob(m)]
    for pfad in dateien:
        with open(pfad, "rb") as datei:
            roh = datei.read()
        with open(pfad + ".enc", "wb") as datei:
            datei.write(verschluesseln(schl, roh))
        os.remove(pfad)

    with open(os.path.join(args.ziel, "schluessel.json"), "w", encoding="utf-8") as datei:
        json.dump({
            "salz": base64.b64encode(salz).decode(),
            "runden": RUNDEN,
            "probe": base64.b64encode(verschluesseln(schl, PROBE)).decode(),
        }, datei)

    print(f"  {len(dateien)} Dateien verschluesselt, schluessel.json geschrieben")


if __name__ == "__main__":
    main()
