#!/usr/bin/env python3
"""Die Top 100 der Bestenliste aus der Web API von OPBounty holen.

Statt Bildschirmfoto und OCR (`werkzeuge/bestenliste_ocr.py`) liefert die Web API
unter `stats.tcgmatchmaking.com` die Liste als Text: exakte Namen, Bounty, Partien und die
häufigsten Leader. `playerId` ist dieselbe Zahl wie unsere `user_id`.
Spec: `specs/features/bestenliste-web-api.md`.

Ablauf wie im Vorbild (`alexfrey317/optcg-data`): ohne Zugangsdaten eine Sitzung öffnen
(`POST /auth/session`), danach `GET /api/leaderboard/mode_0` mit dem Token als Bearer.
Wir melden uns als Bot mit Link zum Projekt, halten Abstand zwischen den Aufrufen und
wiederholen nur bei Überlastung oder Serverfehlern. Das Token steht nur im Speicher.
"""
import json
import time
import urllib.error
import urllib.request

BASIS = "https://stats.tcgmatchmaking.com"
KENNUNG = ("letacios-fiesta (+https://github.com/jolejolevv-coder/letacios-fiesta; "
           "daily snapshot)")
MODUS = "mode_0"                  # Standard; mode_1 ist die Vorabqueue
ANZAHL = 100
MINDEST_ZEILEN = 90               # weniger gilt als kaputte Antwort
ABSTAND_S = 2.0                   # Pause zwischen zwei Aufrufen, wie im Vorbild
ZEITLIMIT_S = 60
WIEDERHOLUNGEN = 5
WARTE_START_S = 2.0
WARTE_MAX_S = 60.0
STATUS_WIEDERHOLEN = {429, 500, 502, 503, 504}
NACHKOMMA_BOUNTY = 1


class ApiFehler(Exception):
    """Die Web API antwortet nicht oder in einer Form, die wir nicht kennen."""


def _warten_nach(kopf, aktuell):
    """Wartezeit nach 429 oder 5xx: `Retry-After` in Sekunden, sonst die laufende Stufe."""
    try:
        return min(float(kopf), WARTE_MAX_S)
    except (TypeError, ValueError):
        return aktuell


def anfrage(url, daten=None, token=None, oeffnen=urllib.request.urlopen,
            schlafen=time.sleep):
    """Einen Aufruf mit Wiederholung bei Überlastung. Gibt das gelesene JSON zurück."""
    kopf = {"User-Agent": KENNUNG, "Accept": "application/json"}
    if token:
        kopf["Authorization"] = "Bearer " + token
    if daten is not None:
        kopf["Content-Type"] = "application/json"
    warte = WARTE_START_S
    letzter = None
    for versuch in range(WIEDERHOLUNGEN + 1):
        req = urllib.request.Request(
            url, data=None if daten is None else json.dumps(daten).encode(),
            headers=kopf, method="GET" if daten is None else "POST")
        try:
            with oeffnen(req, timeout=ZEITLIMIT_S) as antwort:
                return json.loads(antwort.read().decode("utf-8"))
        except urllib.error.HTTPError as fehler:
            if fehler.code not in STATUS_WIEDERHOLEN:
                raise ApiFehler(f"{url}: HTTP {fehler.code}") from fehler
            letzter = f"HTTP {fehler.code}"
            warte = _warten_nach(fehler.headers.get("Retry-After") if fehler.headers
                                 else None, warte)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as fehler:
            letzter = type(fehler).__name__
        if versuch < WIEDERHOLUNGEN:
            schlafen(warte)
            warte = min(warte * 2, WARTE_MAX_S)
    raise ApiFehler(f"{url}: aufgegeben nach {WIEDERHOLUNGEN + 1} Versuchen ({letzter})")


def sitzung_holen(**hilfen):
    antwort = anfrage(BASIS + "/auth/session", daten={}, **hilfen)
    token = antwort.get("token") if isinstance(antwort, dict) else None
    if not token:
        raise ApiFehler("Sitzung ohne Token")
    return token


def eintrag_bauen(roh):
    """Eine Zeile der API in das Format von `public/bestenliste.json.gz` bringen."""
    try:
        name = roh["displayName"] or roh["username"]
        eintrag = {
            "name": name,
            "login": roh.get("username") or name,
            "bounty": round(float(roh["rating"]), NACHKOMMA_BOUNTY),
            "rang": int(roh["rank"]),
            "user_id": int(roh["playerId"]),
            "partien": int(roh.get("matches", 0)),
            "siege": int(roh.get("wins", 0)),
            "niederlagen": int(roh.get("losses", 0)),
            "leader": [{"leader": l["code"], "winrate": float(l["winRate"]),
                        "partien": int(l["matches"])}
                       for l in roh.get("topLeaders", [])],
            "quelle": "api",
        }
    except (KeyError, TypeError, ValueError) as fehler:
        raise ApiFehler(f"Zeile in unbekannter Form: {fehler!r}") from fehler
    return eintrag


def top_holen(anzahl=ANZAHL, modus=MODUS, **hilfen):
    """Die ersten `anzahl` Spieler, nach Rang sortiert. Wirft `ApiFehler`, wenn die
    Antwort unvollständig oder falsch geordnet ist."""
    schlafen = hilfen.get("schlafen", time.sleep)
    token = sitzung_holen(**hilfen)
    schlafen(ABSTAND_S)
    url = f"{BASIS}/api/leaderboard/{modus}?page=1&per_page={anzahl}"
    antwort = anfrage(url, token=token, **hilfen)
    zeilen = antwort.get("entries") if isinstance(antwort, dict) else None
    if not isinstance(zeilen, list) or len(zeilen) < min(MINDEST_ZEILEN, anzahl):
        raise ApiFehler(f"zu wenige Zeilen: {len(zeilen) if zeilen is not None else 'keine'}")
    eintraege = sorted((eintrag_bauen(z) for z in zeilen), key=lambda e: e["rang"])
    raenge = [e["rang"] for e in eintraege]
    if len(set(raenge)) != len(raenge):
        raise ApiFehler("Ränge doppelt vergeben")
    bounties = [e["bounty"] for e in eintraege]
    if any(a < b for a, b in zip(bounties, bounties[1:])):
        raise ApiFehler("Bounty nicht absteigend nach Rang")
    return eintraege[:anzahl]
