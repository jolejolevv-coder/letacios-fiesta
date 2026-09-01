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


SALZDATEI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salz.txt")


def salz_holen() -> bytes:
    """Das feste Salz. Fehlt die Datei, wird eines erzeugt und abgelegt."""
    if os.path.exists(SALZDATEI):
        with open(SALZDATEI, encoding="utf-8") as datei:
            return base64.b64decode(datei.read().strip())
    salz = secrets.token_bytes(16)
    with open(SALZDATEI, "w", encoding="utf-8") as datei:
        datei.write(base64.b64encode(salz).decode() + "\n")
    return salz


def schluessel(passwort: str, salz: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", passwort.encode("utf-8"), salz, RUNDEN, 32)


def verschluesseln(schl: bytes, klartext: bytes) -> bytes:
    iv = secrets.token_bytes(12)
    return iv + AESGCM(schl).encrypt(iv, klartext, None)


def entschluesseln(schl: bytes, geheim: bytes) -> bytes:
    """Gegenstueck zu `verschluesseln`. Die ersten zwoelf Byte sind der Zufallswert."""
    return AESGCM(schl).decrypt(geheim[:12], geheim[12:], None)


def lesen(pfad: str) -> bytes:
    """Eine Datendatei lesen, egal ob im Klartext oder verschluesselt daneben.

    Gebraucht in der Action: dort liegt die Bestenliste nur als `.enc` im Repo, weil
    ein oeffentliches Repo keine Klartextdaten fremder Spieler tragen soll. Der
    taegliche Lauf braucht daraus aber die user_ids.
    """
    if os.path.exists(pfad):
        with open(pfad, "rb") as datei:
            return datei.read()
    if not os.path.exists(pfad + ".enc"):
        raise FileNotFoundError(pfad)
    passwort = os.environ.get("SEITEN_PASSWORT", "").strip()
    if not passwort:
        raise SystemExit(
            f"{pfad} liegt nur verschluesselt vor, aber SEITEN_PASSWORT ist nicht "
            "gesetzt.")
    with open(pfad + ".enc", "rb") as datei:
        return entschluesseln(schluessel(passwort, salz_holen()), datei.read())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ziel", default="public")
    args = ap.parse_args()

    passwort = os.environ.get("SEITEN_PASSWORT", "").strip()
    if not passwort:
        sys.exit("  SEITEN_PASSWORT ist nicht gesetzt.")

    # Festes Salz aus salz.txt. Es muss fest sein, weil die Bestenliste schon lokal
    # verschluesselt ins Repo geht und in der Action mit demselben Schluessel
    # aufgeschlossen werden muss. Ein Salz ist kein Geheimnis; es verhindert
    # vorberechnete Tabellen ueber verschiedene Seiten hinweg, nicht das Raten
    # dieses einen Passworts. Dafuer sind die 200.000 Runden da.
    salz = salz_holen()
    schl = schluessel(passwort, salz)

    muster = [
        os.path.join(args.ziel, "*.json.gz"),
        os.path.join(args.ziel, "saetze", "*.json.gz"),
        os.path.join(args.ziel, "tage", "*.json.gz"),
        os.path.join(args.ziel, "replays", "*.json.gz"),
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
