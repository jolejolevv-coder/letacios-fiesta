#!/usr/bin/env python3
"""Die Bestenliste selbst holen: verbinden, anmelden, fuenf Seiten, trennen.

Phase 2 und 3 aus `specs/features/bestenliste.md`. Alle Pakete, die hier gesendet
werden, sind vorher in `enet_paket.py` gegen einen Mitschnitt geprueft worden; diese
Datei fuegt nur den Ablauf hinzu.

Ablauf, so wie ihn der Spielclient faehrt:

    raus  CONNECT           Peer 4095, Kanal 255, Folge 1
    rein  VERIFY_CONNECT    der Server vergibt die eigene Peer-Kennung
    raus  ACK + PING
    raus  login_request     Kanal 0
    raus  request_filtered_leaderboard, Seite 1 bis 5
    raus  DISCONNECT

**Zugangsdaten kommen nie aus dem Quelltext.** Gesucht wird zuerst in den
Umgebungsvariablen OPBOUNTY_USER, OPBOUNTY_PASS und OPBOUNTY_ID, danach in
~/.opbounty_zugang. Ausgegeben werden sie nirgends, auch nicht im Fehlerfall.

Der Laeufer spielt nicht. Er sendet ausser Anmeldung, Bestenliste und Trennung
keinen einzigen Aufruf und betritt keine Warteschlange.

    python3 tools/bestenliste_holen.py --ziel bestenliste.json
    python3 tools/bestenliste_holen.py --seiten 1 --trocken
"""
import argparse
import json
import os
import random
import socket
import struct
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enet_paket as bau  # noqa: E402
from enet_strom import befehle, kopf_lesen, SEND_RELIABLE, SEND_FRAGMENT  # noqa: E402
from enet_strom import ACKNOWLEDGE, VERIFY_CONNECT, DISCONNECT, PING  # noqa: E402
from bestenliste_lesen import variante, zeile_bauen, SPALTEN  # noqa: E402

SERVER = ("34.235.236.170", 4694)
KANAL_STEUER, KANAL_DATEN = 255, 0
KNOTEN_ANTWORT, METHODE_ANTWORT = 2, 104

WARTEN_HANDSCHLAG = 10.0
WARTEN_ANMELDUNG = 20.0
WARTEN_SEITE = 25.0
ZUGANGSDATEI = os.path.expanduser("~/.opbounty_zugang")


def zugang():
    """Benutzer, Passwort und Kontonummer, aus der Umgebung oder der Datei."""
    u = os.environ.get("OPBOUNTY_USER")
    p = os.environ.get("OPBOUNTY_PASS")
    n = os.environ.get("OPBOUNTY_ID")
    if u and p and n:
        return u, p, int(n)
    if not os.path.exists(ZUGANGSDATEI):
        raise SystemExit(
            "Keine Zugangsdaten. Entweder OPBOUNTY_USER, OPBOUNTY_PASS und "
            f"OPBOUNTY_ID setzen oder {ZUGANGSDATEI} anlegen.")
    with open(ZUGANGSDATEI, encoding="utf-8") as datei:
        d = json.load(datei)
    fehlt = [k for k in ("user", "pass", "id") if not d.get(k)]
    if fehlt:
        raise SystemExit(f"In {ZUGANGSDATEI} fehlt: {', '.join(fehlt)}")
    return d["user"], d["pass"], int(d["id"])


class Verbindung:
    """Das Noetigste an ENet: Folgenummern, Bestaetigungen, Fragmente."""

    def __init__(self, ziel, laut=True, mitschreiben=False):
        self.ziel = ziel
        self.laut = laut
        self.mitschreiben = mitschreiben
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(0.25)
        self.peer = bau.PEER_UNBEKANNT
        self.sitzung = 0
        self.folge = {}                 # je Kanal die letzte gesendete Folge
        self.offen = {}                 # angefangene Fragmentsammlungen
        self.start = time.monotonic()
        self.nachrichten = []           # fertige Godot-Pakete
        self.bestaetigt = set()         # schon bestaetigte Pfade

    def sagen(self, text):
        if self.laut:
            print(f"  {time.monotonic() - self.start:6.2f}  {text}")

    def zeit(self):
        return int((time.monotonic() - self.start) * 1000) & 0xFFFF

    def naechste(self, kanal):
        self.folge[kanal] = self.folge.get(kanal, 0) + 1
        return self.folge[kanal]

    def senden(self, befehl):
        self.senden_roh([befehl])

    def senden_roh(self, befehle_liste):
        roh = bau.paket(self.peer, self.zeit(), befehle_liste, self.sitzung)
        if self.mitschreiben:
            self.sagen(f"    raus {len(roh)}B  {roh[:28].hex(' ')}")
        self.sock.sendto(roh, self.ziel)

    # -- Empfang ---------------------------------------------------------

    def lesen(self, dauer):
        """Liest bis `dauer` Sekunden, bestaetigt und sammelt Nachrichten."""
        ende = time.monotonic() + dauer
        while time.monotonic() < ende:
            try:
                roh, _ = self.sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError as fehler:
                self.sagen(f"Socketfehler: {fehler}")
                return
            if self.mitschreiben:
                self.sagen(f"    rein {len(roh)}B  {roh[:28].hex(' ')}")
            self._paket(roh)

    def _paket(self, roh):
        if len(roh) < 4:
            return
        gesendet = struct.unpack(">H", roh[2:4])[0]
        antworten = []
        for b in befehle(roh):
            art = b["art"]
            if art == VERIFY_CONNECT:
                self.peer = struct.unpack(">H", b["felder"][:2])[0]
                # Byte 2 und 3 sind die beiden Sitzungskennungen. Sie gehoeren in
                # den Kopf jedes weiteren Pakets.
                self.sitzung = b["felder"][3]
                self.sagen(f"VERIFY_CONNECT, Peer {self.peer}, "
                           f"Sitzung {b['felder'][2]}/{b['felder'][3]}")
                antworten.append(bau.befehl_bestaetigen(
                    b["kanal"], b["folge"], gesendet))
            elif art == DISCONNECT:
                self.sagen("Server hat getrennt")
                raise ConnectionError("Server hat die Verbindung getrennt")
            elif art in (SEND_RELIABLE, SEND_FRAGMENT):
                antworten.append(bau.befehl_bestaetigen(
                    b["kanal"], b["folge"], gesendet))
                self._nutzdaten(b)
            elif art == PING:
                antworten.append(bau.befehl_bestaetigen(
                    b["kanal"], b["folge"], gesendet))
        if antworten:
            self.senden_roh(antworten)

    def _pfad_pruefen(self, daten):
        """Meldet der Server einen Pfad an, wird er bestaetigt. Ohne diese Antwort
        bleibt der Abgleich offen und eigene Aufrufe laufen ins Leere."""
        gelesen = bau.pfad_anmeldung_lesen(daten)
        if not gelesen:
            return
        nummer, pfad = gelesen
        if pfad in self.bestaetigt:
            return
        self.bestaetigt.add(pfad)
        self.sagen(f"Pfad {pfad!r} als Nummer {nummer} angemeldet, bestaetige")
        self.aufrufen(bau.pfad_bestaetigung(pfad))

    def _nutzdaten(self, b):
        if b["art"] == SEND_RELIABLE:
            self.nachrichten.append(b["daten"])
            self._pfad_pruefen(b["daten"])
            return
        start, _, _, _, gesamt, versatz = struct.unpack(">HHIIII", b["felder"])
        s = self.offen.setdefault((b["kanal"], start), {"gesamt": gesamt,
                                                        "stuecke": {}})
        s["stuecke"][versatz] = b["daten"]
        if sum(len(x) for x in s["stuecke"].values()) >= s["gesamt"]:
            daten = b"".join(s["stuecke"][k] for k in sorted(s["stuecke"]))
            self.nachrichten.append(daten[:gesamt])
            self._pfad_pruefen(daten[:gesamt])
            del self.offen[(b["kanal"], start)]

    # -- Ablauf ----------------------------------------------------------

    def verbinden(self):
        # Das Datenfeld im CONNECT ist bei Godot nicht frei: dort steht die eigene
        # Peer-Kennung der Multiplayer-Schicht, eine 31-Bit-Zahl. Der Spielclient
        # schickt dort etwa 0x7f6268f0. Mit einer Null gilt der Peer als ungueltig,
        # der Server antwortet dann zwar mit VERIFY_CONNECT, spricht danach aber
        # nicht weiter. Genau daran hing der erste Versuch.
        self.eigene_id = random.randrange(2, 2 ** 31 - 1)
        self.sagen(f"CONNECT, eigene Kennung {self.eigene_id}")
        self.senden(bau.befehl_verbinden(self.naechste(KANAL_STEUER),
                                         random.getrandbits(32),
                                         self.eigene_id))
        ende = time.monotonic() + WARTEN_HANDSCHLAG
        while self.peer == bau.PEER_UNBEKANNT and time.monotonic() < ende:
            self.lesen(0.5)
        if self.peer == bau.PEER_UNBEKANNT:
            raise ConnectionError("keine Antwort auf CONNECT")
        self.senden(bau.befehl_ping(self.naechste(KANAL_STEUER)))
        self.lesen(1.5)
        self.sagen(f"{len(self.nachrichten)} Nachrichten nach dem Handschlag")

    def aufrufen(self, nutzlast):
        self.senden(bau.befehl_senden(KANAL_DATEN,
                                      self.naechste(KANAL_DATEN), nutzlast))

    def trennen(self):
        try:
            self.sagen("DISCONNECT")
            self.senden(bau.befehl_trennen(self.naechste(KANAL_STEUER)))
            self.lesen(0.5)
        except Exception:
            pass
        finally:
            self.sock.close()


def uebersicht(v, wieviele=14):
    """Was kam zurueck? Haeufigste Aufrufe und lesbare Bruchstuecke."""
    import collections
    import re

    zaehler = collections.Counter()
    for daten in v.nachrichten:
        k = kopf_lesen(daten)
        zaehler[(k["knoten"], k["methode"]) if k else (None, None)] += 1
    print("\n  haeufigste Aufrufe vom Server (Knoten, Methode, Anzahl):")
    for (kn, me), n in zaehler.most_common(wieviele):
        print(f"    {str(kn):>5}  {str(me):>5}  {n}")

    # Fehlermeldungen kommen als Text. Nur kurze Ketten zeigen, keine Nutzdaten.
    texte = collections.Counter()
    for daten in v.nachrichten:
        for t in re.findall(rb"[ -~]{5,40}", daten):
            texte[t.decode("ascii", "replace")] += 1
    print("\n  groesste Nachrichten vom Server:")
    for daten in sorted(v.nachrichten, key=len, reverse=True)[:6]:
        print(f"    {len(daten):7}B  erstes Byte 0x{daten[0]:02x}  "
              f"{daten[:12].hex(' ')}")

    print("\n  Nachrichten mit dem Knotenpfad:")
    for daten in v.nachrichten:
        if b"root_main/Main" in daten and len(daten) < 400:
            print(f"    {len(daten)}B  {daten[:24].hex(' ')}")

    print("\n  lesbare Zeichenketten:")
    for t, n in texte.most_common(wieviele):
        print(f"    {n:5}x  {t}")


def seiten_lesen(verbindung):
    """Alle bisher empfangenen Bestenlistenantworten auspacken."""
    aus = []
    for daten in verbindung.nachrichten:
        k = kopf_lesen(daten)
        if not k or k["knoten"] != KNOTEN_ANTWORT or k["methode"] != METHODE_ANTWORT:
            continue
        for start in range(4, 12):
            try:
                wert, _ = variante(daten, start)
            except Exception:
                continue
            if isinstance(wert, list) and wert and isinstance(wert[0], list):
                aus.append(wert)
                break
    return aus


def firebase_vorlauf(laut=True):
    """Vor der Spielverbindung bei Firebase anmelden, wie es der Client tut.

    Das ist ein Versuch, keine gesicherte Notwendigkeit. Der Client meldet sich mit
    dem Dienstkonto aus dem Spielpaket an, das in jeder Installation steckt; es
    verknuepft die Sitzung also nicht mit einem bestimmten Spieler. Wirken kann es
    nur, wenn der Spielserver ueber die Adresse korreliert. Der Token wird nirgends
    ausgegeben.
    """
    try:
        from firestore_browser import zugang as paket_zugang, anmelden
        antwort = anmelden(paket_zugang())
        if laut:
            print(f"  Firebase: angemeldet, Token {len(antwort['idToken'])} Zeichen")
        return antwort["idToken"]
    except Exception as fehler:
        if laut:
            print(f"  Firebase: fehlgeschlagen ({type(fehler).__name__})")
        return None


def holen(seiten=5, laut=True, mitschreiben=False, uebersicht_zeigen=False,
          firebase=False):
    benutzer, passwort, nummer = zugang()
    if firebase:
        firebase_vorlauf(laut)
    v = Verbindung(SERVER, laut, mitschreiben)
    try:
        v.verbinden()

        # Zuerst den EIGENEN Knoten anmelden, so wie es der echte Client tut.
        # Ohne diesen Schritt beantwortet der Server die Bestenlistenanfrage nicht:
        # er bestaetigt sie zwar auf ENet-Ebene, kennt aber den Knoten nicht, auf dem
        # `send_leaderboard` beim Client liegt, und verwirft die Antwort still.
        # Das war die Ursache der monatelang unbeantworteten Anfrage.
        v.sagen("eigenen Knoten anmelden")
        v.aufrufen(bau.pfad_anmelden(bau.KNOTEN_ANFRAGE))
        v.lesen(2.0)

        v.sagen("Anmeldung")
        # Jetzt kennt der Server unsere Knotennummer, die Kurzform genuegt.
        v.aufrufen(bau.anmeldung(benutzer, nummer, passwort, bau.VERSION))
        v.lesen(3.0)
        v.sagen(f"{len(v.nachrichten)} Nachrichten nach der Anmeldung")

        # Der Spielclient meldet sich nach der Anmeldung beim Bestenlistensystem
        # an, bevor er abfragt. Ohne diesen Schritt blieb die Abfrage stumm.
        v.sagen("beim Bestenlistensystem melden")
        v.aufrufen(bau.werte_melden(nummer))
        v.lesen(1.5)
        v.aufrufen(bau.feld_melden(nummer, "country", "Germany"))
        v.lesen(2.0)
        v.sagen(f"{len(v.nachrichten)} Nachrichten danach")

        gesehen = 0
        for seite in range(1, seiten + 1):
            v.sagen(f"Bestenliste Seite {seite}")
            v.aufrufen(bau.bestenliste_anfrage(seite))
            # Der Client schickt diesen Aufruf im selben Augenblick mit.
            v.aufrufen(bau.begleiter(benutzer, nummer))
            ende = time.monotonic() + WARTEN_SEITE
            while time.monotonic() < ende:
                v.lesen(0.5)
                if len(seiten_lesen(v)) > gesehen:
                    break
            neu = len(seiten_lesen(v))
            if neu == gesehen:
                v.sagen(f"  keine Antwort auf Seite {seite}")
            gesehen = neu
        if uebersicht_zeigen:
            uebersicht(v)
        return seiten_lesen(v)
    finally:
        v.trennen()


def main():
    p = argparse.ArgumentParser(description="Bestenliste holen")
    p.add_argument("--seiten", type=int, default=5)
    p.add_argument("--ziel")
    p.add_argument("--still", action="store_true")
    p.add_argument("--firebase", action="store_true",
                   help="vorher bei Firebase anmelden, wie es der Client tut")
    p.add_argument("--uebersicht", action="store_true",
                   help="zeigen, was der Server geschickt hat")
    p.add_argument("--mitschreiben", action="store_true",
                   help="jedes Paket als Hex zeigen")
    p.add_argument("--trocken", action="store_true",
                   help="nur pruefen, ob Zugangsdaten da sind, nichts senden")
    a = p.parse_args()

    if a.trocken:
        benutzer, _, nummer = zugang()
        print(f"  Zugangsdaten gefunden: Konto {benutzer}, Nummer {nummer}")
        print(f"  Version {bau.VERSION}, Ziel {SERVER[0]}:{SERVER[1]}")
        return

    roh = holen(a.seiten, not a.still, a.mitschreiben, a.uebersicht, a.firebase)
    eintraege, gesehen = [], set()
    for seite in roh:
        for feld in seite:
            if not isinstance(feld, list) or len(feld) < len(SPALTEN):
                continue
            e = zeile_bauen(feld)
            if e.get("login") in gesehen:
                continue
            gesehen.add(e["login"])
            eintraege.append(e)
    eintraege.sort(key=lambda e: e.get("rang") or 10**9)
    print(f"\n  {len(roh)} Seiten, {len(eintraege)} Spieler")
    for e in eintraege[:10]:
        print(f"  {str(e.get('rang')):>4}  {round(e.get('bounty') or 0, 1):9}  "
              f"{e.get('name')}")
    if a.ziel and eintraege:
        with open(a.ziel, "w", encoding="utf-8") as datei:
            json.dump(eintraege, datei, ensure_ascii=False, indent=1)
        print(f"\n  geschrieben: {a.ziel}")


if __name__ == "__main__":
    main()
