#!/usr/bin/env python3
"""Der kleinste Firestore-Zugang, den diese Seite braucht.

Warum eine eigene Datei und nicht der Browser aus dem Simulatorprojekt: der laeuft
auf einem Mac mit installiertem Spiel und liest die Zugangsdaten aus dem
Spielpaket. In der Action gibt es weder das eine noch das andere. Diese Seite muss
fuer sich stehen, sonst laeuft der taegliche Lauf nur auf einem bestimmten Rechner.

Zugangsdaten kommen deshalb aus der Umgebung:

    OPBOUNTY_API_KEY   Projektschluessel
    OPBOUNTY_PROJECT   Projektkennung
    OPBOUNTY_BUCKET    Speicherort der Replays
    OPBOUNTY_EMAIL     Dienstkonto aus dem Spielpaket
    OPBOUNTY_PASSWORT  dazu das Passwort

Ist keine gesetzt, wird ersatzweise das Spielpaket gelesen, damit es lokal ohne
Vorbereitung funktioniert.

**Das Dienstkonto ist nicht das Spielkonto des Nutzers.** Es steckt in jeder
Installation und ist das, womit sich auch der Client anmeldet.

Gelesen wird ausschliesslich `PublicUsers`. `Users` traegt IP-Listen und
Discord-Kennungen echter Personen und wird hier nicht angefasst.
"""
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request

PCK = os.path.expanduser(
    "~/Library/Application Support/Godot/app_userdata/OPBounty/OPBounty.pck")

FELDER = ("apiKey", "projectId", "storageBucket")


def _aus_paket():
    """Rueckfall fuer den heimischen Rechner: die Werte aus dem Spielpaket lesen."""
    if not os.path.exists(PCK):
        return None
    roh = subprocess.run(["strings", "-n", "4", PCK], capture_output=True,
                         text=True, errors="replace").stdout
    c = {}
    for k in FELDER:
        m = re.search('"' + k + '"="([^"]+)"', roh)
        if not m:
            return None
        c[k] = m.group(1)
    m = re.search(r'login_with_email_and_password\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)', roh)
    if not m:
        return None
    c["email"], c["password"] = m.group(1), m.group(2)
    return c


def zugang():
    u = {
        "apiKey": os.environ.get("OPBOUNTY_API_KEY", ""),
        "projectId": os.environ.get("OPBOUNTY_PROJECT", ""),
        "storageBucket": os.environ.get("OPBOUNTY_BUCKET", ""),
        "email": os.environ.get("OPBOUNTY_EMAIL", ""),
        "password": os.environ.get("OPBOUNTY_PASSWORT", ""),
    }
    if all(u.values()):
        return u
    aus_paket = _aus_paket()
    if aus_paket:
        return aus_paket
    fehlt = [k for k, v in u.items() if not v]
    raise SystemExit(
        "Keine Zugangsdaten. Entweder OPBOUNTY_API_KEY, OPBOUNTY_PROJECT, "
        "OPBOUNTY_BUCKET, OPBOUNTY_EMAIL und OPBOUNTY_PASSWORT setzen, oder das "
        f"Spielpaket bereitlegen. Fehlt gerade: {', '.join(fehlt)}")


class Db:
    """Nur Lesen, nur einzelne Dokumente. Mehr braucht die Seite nicht."""

    def __init__(self):
        self.c = zugang()
        r = urllib.request.Request(
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="
            + self.c["apiKey"],
            data=json.dumps({"email": self.c["email"],
                             "password": self.c["password"],
                             "returnSecureToken": True}).encode(),
            method="POST")
        r.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(r, timeout=30) as x:
            self.tok = json.loads(x.read().decode())["idToken"]
        self.basis = ("https://firestore.googleapis.com/v1/projects/"
                      + self.c["projectId"] + "/databases/(default)/documents")

    def dokument(self, pfad, felder=None):
        url = self.basis + "/" + pfad.strip("/")
        if felder:
            url += "?" + "&".join("mask.fieldPaths=" + urllib.parse.quote(f)
                                  for f in felder)
        r = urllib.request.Request(url)
        r.add_header("Authorization", "Bearer " + self.tok)
        with urllib.request.urlopen(r, timeout=120) as x:
            return json.loads(x.read().decode())


def wert(v):
    """Einen Firestore-Wert auf etwas Pythonisches bringen."""
    if v is None:
        return None
    for k, f in (("stringValue", str), ("integerValue", int),
                 ("doubleValue", float), ("booleanValue", bool)):
        if k in v:
            return f(v[k])
    if "nullValue" in v:
        return None
    if "arrayValue" in v:
        return [wert(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: wert(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return v


def entpacke(s):
    """Die gepackten Felder sind gzip in base64 mit JSON darin."""
    import base64
    import gzip
    if not isinstance(s, str) or not s.startswith("H4sI"):
        return None
    try:
        return json.loads(gzip.decompress(base64.b64decode(s)))
    except Exception:
        return None
