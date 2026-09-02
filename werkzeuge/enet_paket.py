#!/usr/bin/env python3
"""ENet-Pakete und Godot-Aufrufe bauen. Phase 1: es wird nichts verbunden.

Gegenstueck zu `enet_strom.py`, das dieselben Pakete liest. Die Abnahme dieser Datei
ist der Selbsttest ganz unten: die hier gebauten Bytes muessen denen aus dem
Mitschnitt vom 01.09.2026 **genau** entsprechen. Solange das nicht stimmt, hat es
keinen Sinn, sich zu verbinden.

    python3 tools/enet_paket.py selbsttest ~/Downloads/opbounty-leaderboard.pcap

Zur Kodierung der Aufrufargumente, ehrlich gesagt: Zeichenketten stehen mit dem
ueblichen Godot-Kopf aus vier Byte Typ und vier Byte Laenge da, aufgefuellt auf ein
Vielfaches von vier. Die beiden Zahlen am Ende des Bestenlistenaufrufs dagegen stehen
mit nur zwei Byte, einem Typbyte und einem Wertbyte. Warum die beiden Formen sich
unterscheiden, habe ich aus dem Spielcode nicht herausgelesen. Die Kurzform ist hier
aus dem Mitschnitt uebernommen und ausschliesslich fuer diesen einen Aufruf belegt.
Sie traegt nur Werte bis 255; `limit` ist 20 und `page` geht bis 5, das passt, aber
wer sie anderswo benutzt, muss sie vorher pruefen.
"""
import argparse
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ENet-Befehle, gleiche Nummern wie in enet_strom.py.
ACKNOWLEDGE, CONNECT, VERIFY_CONNECT, DISCONNECT, PING = 1, 2, 3, 4, 5
SEND_RELIABLE, SEND_UNRELIABLE, SEND_FRAGMENT = 6, 7, 8
FLAG_ACKNOWLEDGE = 0x80

KOPF_SENT_TIME = 0x8000
PEER_UNBEKANNT = 0x0FFF          # bis der Server eine Kennung vergibt

# Werte, die der Spielclient beim Verbindungsaufbau schickt. Aus dem Mitschnitt
# abgelesen, nicht geraten; sie muessen zum Server passen.
MTU = 1392
FENSTER = 65536
KANAELE = 255
DROSSEL_INTERVALL = 5000
DROSSEL_BESCHLEUNIGUNG = 2
DROSSEL_VERZOEGERUNG = 2

# Der Bestenlistenaufruf.
KNOTEN_ANFRAGE, METHODE_ANFRAGE = 1, 0x46
SEITENGROESSE = 20               # LEADERBOARD_ENTRIES_PER_REQUEST

NIL, INT, STRING, ARRAY = 0, 2, 4, 28


def kette(text: str) -> bytes:
    """Godot-Zeichenkette: vier Byte Typ, vier Byte Laenge, dann aufgefuellt."""
    roh = text.encode("utf-8")
    return (struct.pack("<II", STRING, len(roh)) + roh
            + b"\x00" * (-len(roh) % 4))


# Wertbreite je Kodierung in den oberen zwei Bit des Typbytes.
BREITEN = {1: 0, 2: 1, 4: 2, 8: 3}
BREITEN_ZURUECK = {0: 1, 1: 2, 2: 4, 3: 8}


def zahl(wert: int) -> bytes:
    """Zahl im Argumentteil: Typbyte mit kodierter Breite, dann der Wert.

    0x02 traegt ein Byte, 0x42 zwei. Belegt an `limit` und `page` des
    Bestenlistenaufrufs und an der user_id im Anmeldeaufruf, deren Lesung gegen
    `PublicUsers/32615` geprueft wurde. Die Breiten 4 und 8 sind aus dem Muster
    fortgeschrieben und bisher nicht beobachtet.
    """
    if wert < 0:
        raise ValueError("negative Zahlen sind hier nicht beobachtet")
    for breite in (1, 2, 4, 8):
        if wert < 256 ** breite:
            return bytes((INT | (BREITEN[breite] << 6),)) + \
                wert.to_bytes(breite, "little")
    raise ValueError(f"Zahl zu gross: {wert}")


def nichts() -> bytes:
    """Ein Nullwert. Volles Typwort, vier Byte."""
    return struct.pack("<I", NIL)


def feld(eintraege: list = ()) -> bytes:
    """Ein Feld. Vier Byte Typ, vier Byte Anzahl, dann die Eintraege."""
    return struct.pack("<II", ARRAY, len(eintraege)) + b"".join(eintraege)


def aufruf(knoten: int, methode: int, argumente: list) -> bytes:
    """Godot-Nutzlast fuer einen entfernten Aufruf.

    Byte 0 ist null: Aufrufart 0, und Knoten- wie Methodennummer in der schmalsten
    Form, je ein Byte. Beides trifft auf die hier gebrauchten Aufrufe zu.
    """
    if not 0 <= knoten <= 255 or not 0 <= methode <= 255:
        raise ValueError("Knoten und Methode passen hier in je ein Byte")
    return bytes((0x00, knoten, methode, len(argumente))) + b"".join(argumente)


def bestenliste_anfrage(seite: int, leader: str = "", land: str = "",
                        knoten: int = KNOTEN_ANFRAGE) -> bytes:
    """Die Nutzlast von `request_filtered_leaderboard(leader, land, 20, seite)`.

    Die Knotennummer vergibt der Absender, sie ist keine feste Groesse. Im
    Mitschnitt vom 01.09.2026 hatte der Spielclient die 1 gewaehlt, deshalb steht
    sie als Vorgabe und der Selbsttest vergleicht dagegen. Ein eigener Laeufer
    meldet seinen Knoten unter einer eigenen Nummer an und muss die hier
    durchreichen.
    """
    return aufruf(knoten, METHODE_ANFRAGE,
                  [kette(leader), kette(land),
                   zahl(SEITENGROESSE), zahl(seite)])


# Der Anmeldeaufruf.
KNOTEN_ANMELDUNG, METHODE_ANMELDUNG = 1, 0x27

# Der Server prueft die Version. Aus dem Mitschnitt vom 01.09.2026. Aendert das Spiel
# sie, lehnt der Server die Anmeldung ab; das bricht laut und wird gemeldet, nicht
# umgangen.
VERSION = "2.5.5"


def anmeldung(benutzer: str, nummer: int, passwort: str, version: str) -> bytes:
    """Die Nutzlast von `login_request`.

    Die Signatur aus dem Spielcode lautet

        login_request.rpc_id(1, user, n, password, version,
                             discord_id, roles, batsu_roles, 0)

    `discord_id` steht im Mitschnitt als Nullwert, die beiden Rollenfelder sind
    leer. Der Laeufer meldet sich ohne Discord an, das ist der gleiche Fall.
    """
    return aufruf(KNOTEN_ANMELDUNG, METHODE_ANMELDUNG,
                  [kette(benutzer), zahl(nummer), kette(passwort), kette(version),
                   nichts(), feld(), feld(), zahl(0)])


# Der Pfad des Knotens, auf dem die Aufrufe liegen, und die Kennung, unter der ihn
# der Spielclient anmeldet. Beim allerersten Aufruf muss der Pfad mitgeschickt
# werden, danach genuegt die kurze Nummer.
KNOTENPFAD = "root_main/Main"      # dort liegt login_request
# Alle uebrigen Aufrufe laufen ueber den Elternknoten. Im Mitschnitt schickt der
# Spielclient Anmeldung und Bestenliste an verschiedene Knoten; genau daran hing
# die unbeantwortete Anfrage.
KNOTENPFAD_SPIEL = "root_main"
KNOTEN_SPIEL = 0x59
KNOTEN_LANG = 0x58
FLAGGE_PFAD_FOLGT = 0x80000000
KOPF_LANGE_NUMMER = 0x20


def aufruf_mit_pfad(nummer: int, methode: int, argumente: list,
                    pfad: str = KNOTENPFAD) -> bytes:
    """Aufruf in der langen Form, mit dem Knotenpfad am Ende.

    So schickt der Spielclient seinen ersten Aufruf. Die Knotennummer steht mit vier
    Byte da und traegt im obersten Bit die Angabe, dass ein Pfad folgt; der Pfad
    selbst haengt als nullterminierte Zeichenkette hinten dran, nicht als Variante.
    Ohne diesen Schritt kennt der Server die kurze Nummer nicht und laesst spaetere
    Aufrufe ins Leere laufen.
    """
    return (bytes((KOPF_LANGE_NUMMER,))
            + struct.pack("<I", nummer | FLAGGE_PFAD_FOLGT)
            + bytes((methode, len(argumente)))
            + b"".join(argumente)
            + pfad.encode("utf-8") + b"\x00")


def bestenliste_anfrage_lang(seite: int, leader: str = "",
                             land: str = "") -> bytes:
    """Die Bestenlistenanfrage in der langen Form, mit Pfad.

    Die kurze Form setzt voraus, dass der Server unsere Knotennummer schon kennt.
    Ob er sie bestaetigt hat, wissen wir nicht sicher, also schicken wir den Pfad
    jedes Mal mit. Das kostet fuenfzehn Byte und spart eine Fehlerquelle.
    """
    return aufruf_mit_pfad(KNOTEN_SPIEL, METHODE_ANFRAGE,
                           [kette(leader), kette(land),
                            zahl(SEITENGROESSE), zahl(seite)],
                           pfad=KNOTENPFAD_SPIEL)


# Was der Spielclient nach der Anmeldung und vor dem ersten Bestenlistenabruf
# schickt. Aus dem Mitschnitt vom 01.09.2026 aufgeschluesselt:
#   Methode 96  (nummer, Feld mit acht Eintraegen)   eigene Werte melden
#   Methode 133 (nummer, "country", "Germany")       Land melden
# Ohne diese Anmeldung beim Bestenlistensystem bleibt die Abfrage unbeantwortet.
METHODE_WERTE_MELDEN = 0x60
METHODE_FELD_MELDEN = 0x85


def werte_melden(nummer: int, eintraege: list = (),
                 knoten: int = KNOTEN_ANFRAGE) -> bytes:
    """Methode 96. Der Client meldet hier seine eigenen Werte."""
    return aufruf(knoten, METHODE_WERTE_MELDEN,
                  [zahl(nummer), feld(list(eintraege))])


def feld_melden(nummer: int, name: str, wert: str,
                knoten: int = KNOTEN_ANFRAGE) -> bytes:
    """Methode 133. Ein einzelnes Profilfeld, im Mitschnitt das Land."""
    return aufruf(knoten, METHODE_FELD_MELDEN,
                  [zahl(nummer), kette(name), kette(wert)])


# Methode 64 schickt der Client im selben Augenblick wie die Bestenlistenanfrage,
# mit Benutzername und Kontonummer. 27 Byte, das passt auf eine Zeichenkette von
# neun Zeichen und eine Zahl mit zwei Byte Wert.
METHODE_BEGLEITER = 0x40


def begleiter(benutzer: str, nummer: int,
              knoten: int = KNOTEN_ANFRAGE) -> bytes:
    """Methode 64, die der Client zusammen mit der Anfrage sendet."""
    return aufruf(knoten, METHODE_BEGLEITER, [kette(benutzer), zahl(nummer)])


def anmeldung_lang(benutzer: str, nummer: int, passwort: str,
                   version: str) -> bytes:
    """Der Anmeldeaufruf in der langen Form, so wie er als erster gesendet wird."""
    return aufruf_mit_pfad(KNOTEN_LANG, METHODE_ANMELDUNG,
                           [kette(benutzer), zahl(nummer), kette(passwort),
                            kette(version), nichts(), feld(), feld(), zahl(0)])


# Godots Pfadabgleich. Das erste Byte einer Nachricht sagt, worum es geht.
BEFEHL_AUFRUF, BEFEHL_PFAD_ANMELDEN, BEFEHL_PFAD_BESTAETIGEN = 0, 1, 2
TOKEN_LAENGE = 32          # Pruefsumme ueber die Methodenliste, plus Nullbyte


def pfad_anmeldung_lesen(daten: bytes):
    """Aus einer Pfadanmeldung Nummer und Pfad holen, oder None.

    Aufbau, aus dem Mitschnitt vom 01.09.2026:

        01 | Pruefsumme, 32 Zeichen | 00 | Nummer, vier Byte | Pfad | 00
    """
    if not daten or daten[0] & 0x07 != BEFEHL_PFAD_ANMELDEN:
        return None
    ab = 1 + TOKEN_LAENGE + 1
    if len(daten) < ab + 4:
        return None
    nummer = struct.unpack("<I", daten[ab:ab + 4])[0]
    pfad = daten[ab + 4:].split(b"\x00")[0].decode("utf-8", "replace")
    return nummer, pfad


# Die Pruefsumme, die der Spielclient fuer `root_main/Main` anmeldet. Sie deckt die
# Methodenliste des Knotens ab und ist damit an die Spielversion gebunden, nicht an
# das Konto oder die Sitzung; aus dem Mitschnitt vom 02.09.2026, Version 2.5.5.
PRUEFSUMME_MAIN = "c102025c5f763c7f3ab733d81e9d6825"


def pfad_anmelden(nummer: int, pfad: str = KNOTENPFAD,
                  pruefsumme: str = PRUEFSUMME_MAIN) -> bytes:
    """Den EIGENEN Knoten beim Server anmelden (Godots SIMPLIFY_PATH).

    **Daran hing die unbeantwortete Bestenlistenanfrage.** Der Laeufer hat bisher nur
    die Anmeldungen des Servers bestaetigt, aber nie einen eigenen Knoten angemeldet.
    Ohne diesen Schritt nimmt der Server die Anfrage auf ENet-Ebene an und bestaetigt
    sie sogar, kann die Antwort danach aber niemandem zustellen: er kennt den Knoten
    nicht, auf dem `send_leaderboard` beim Client liegt. Genau deshalb sah es so aus,
    als wuerde eine byteweise identische Anfrage einfach ignoriert.

    Aufbau, aus dem Mitschnitt des echten Clients:

        01 | Pruefsumme, 32 Zeichen | 00 | Nummer, vier Byte | Pfad | 00

    Der echte Client meldet `root_main/Main` als Nummer 1 an und schickt danach alle
    Kurzaufrufe an genau diese Nummer.
    """
    return (bytes((BEFEHL_PFAD_ANMELDEN,))
            + pruefsumme.encode("ascii") + b"\x00"
            + struct.pack("<I", nummer)
            + pfad.encode("utf-8") + b"\x00")


def pfad_bestaetigung(pfad: str, gueltig: bool = True) -> bytes:
    """Die Antwort auf eine Pfadanmeldung.

    Zwei Byte und der Pfad: Befehlsart, dann das Ja zur Pruefsumme. Die Pruefsumme
    selbst wird nicht nachgerechnet; sie deckt die Methodenliste eines Knotens ab,
    den dieser Laeufer gar nicht besitzt. Wir bestaetigen, was der Server sagt.
    """
    return (bytes((BEFEHL_PFAD_BESTAETIGEN, 1 if gueltig else 0))
            + pfad.encode("utf-8") + b"\x00")


def paket(peer: int, zeit: int, befehle: list, sitzung: int = 0) -> bytes:
    """Setzt einen Paketkopf und eine Befehlskette zusammen.

    Der Kopf traegt mehr als die Peer-Kennung. Bit 15 heisst "Zeitstempel folgt",
    Bit 14 "komprimiert", und die Bits 12 und 13 tragen die Sitzungskennung, die der
    Server im VERIFY_CONNECT vergibt. Wer sie weglaesst, schickt Pakete mit Sitzung
    0, und der Server verwirft sie stillschweigend. Genau daran ist der erste
    Verbindungsversuch am 01.09.2026 gescheitert.
    """
    kopf_wert = peer | KOPF_SENT_TIME | ((sitzung & 0x03) << 12)
    return struct.pack(">HH", kopf_wert, zeit & 0xFFFF) + b"".join(befehle)


def befehl_senden(kanal: int, folge: int, nutzlast: bytes) -> bytes:
    """SEND_RELIABLE mit Bestaetigungswunsch."""
    return (bytes((SEND_RELIABLE | FLAG_ACKNOWLEDGE, kanal))
            + struct.pack(">HH", folge, len(nutzlast)) + nutzlast)


def befehl_verbinden(folge: int, verbindungs_id: int, daten: int = 0) -> bytes:
    """CONNECT, mit den Werten, die auch der Spielclient schickt."""
    return (bytes((CONNECT | FLAG_ACKNOWLEDGE, 0xFF))
            + struct.pack(">H", folge)
            + struct.pack(">HBB", 0, 0xFF, 0xFF)
            + struct.pack(">IIIII", MTU, FENSTER, KANAELE, 0, 0)
            + struct.pack(">IIII", DROSSEL_INTERVALL, DROSSEL_BESCHLEUNIGUNG,
                          DROSSEL_VERZOEGERUNG, verbindungs_id)
            + struct.pack(">I", daten))


def befehl_bestaetigen(kanal: int, folge: int, gesendet: int) -> bytes:
    """ACKNOWLEDGE auf ein empfangenes zuverlaessiges Paket.

    Die quittierte Folgenummer steht zweimal drin, im Befehlskopf und im Rumpf. So
    macht es der Spielclient auch; mit einer Null im Kopf nimmt der Server die
    Bestaetigung nicht an.
    """
    return (bytes((ACKNOWLEDGE, kanal)) + struct.pack(">H", folge)
            + struct.pack(">HH", folge, gesendet))


def befehl_ping(folge: int) -> bytes:
    """PING mit Bestaetigungswunsch, Kanal 255."""
    return bytes((PING | FLAG_ACKNOWLEDGE, 0xFF)) + struct.pack(">H", folge)


def befehl_trennen(folge: int) -> bytes:
    """DISCONNECT mit Bestaetigungswunsch, Kanal 255."""
    return (bytes((DISCONNECT | FLAG_ACKNOWLEDGE, 0xFF))
            + struct.pack(">H", folge) + struct.pack(">I", 0))


# ---------------------------------------------------------------------------
# Selbsttest gegen den Mitschnitt
# ---------------------------------------------------------------------------

def selbsttest(pfad: str) -> int:
    """Vergleicht die gebauten Bytes mit den aufgezeichneten. Null heisst gut."""
    from pcap_enet import pakete

    ps = pakete(pfad)
    raus = [p for p in ps if not p["server"]]
    fehler = 0

    # 1. Die fuenf Bestenlistenanfragen. Nutzlast ab Byte 10: zwei Byte Peer,
    #    zwei Byte Zeit, vier Byte Befehlskopf, zwei Byte Datenlaenge.
    echte = [p["nutz"][10:] for p in raus if len(p["nutz"]) == 34
             and p["nutz"][10:13] == bytes((0x00, KNOTEN_ANFRAGE, METHODE_ANFRAGE))]
    print(f"  {len(echte)} aufgezeichnete Bestenlistenanfragen")
    for i, echt in enumerate(echte, 1):
        gebaut = bestenliste_anfrage(i)
        gut = gebaut == echt
        fehler += 0 if gut else 1
        print(f"    Seite {i}  {'gleich' if gut else 'ABWEICHUNG'}")
        if not gut:
            print(f"      aufgezeichnet {echt.hex()}")
            print(f"      gebaut        {gebaut.hex()}")

    # 2. Der Verbindungsaufbau. Die Verbindungskennung ist bei jedem Lauf neu,
    #    deshalb wird sie aus dem Mitschnitt uebernommen und nur der Rest verglichen.
    # Vier Byte Paketkopf, vier Byte Befehlskopf, vierundvierzig Byte Rumpf.
    verbinden = [p["nutz"] for p in raus
                 if len(p["nutz"]) == 52 and (p["nutz"][4] & 0x0F) == CONNECT]
    print(f"\n  {len(verbinden)} aufgezeichnete Verbindungsaufbauten")
    if verbinden:
        echt = verbinden[0]
        folge = struct.unpack(">H", echt[6:8])[0]
        v_id, daten = struct.unpack(">II", echt[44:52])
        gebaut = paket(PEER_UNBEKANNT, struct.unpack(">H", echt[2:4])[0],
                       [befehl_verbinden(folge, v_id, daten)])
        gut = gebaut == echt
        fehler += 0 if gut else 1
        print(f"    {'gleich' if gut else 'ABWEICHUNG'}")
        if not gut:
            print(f"      aufgezeichnet {echt.hex()}")
            print(f"      gebaut        {gebaut.hex()}")

    print(f"\n  {'alles gleich' if not fehler else str(fehler) + ' Abweichungen'}")
    return fehler


def selbsttest_anmeldung(pfad: str) -> int:
    """Vergleicht den gebauten Anmeldeaufruf mit dem aufgezeichneten.

    Benutzername und Passwort kenne ich nicht und will sie nicht kennen. Gebaut
    wird deshalb mit Platzhaltern gleicher Laenge, und die beiden Wertbereiche
    werden vom Vergleich ausgenommen. Geprueft wird damit die Form: Reihenfolge,
    Typen, Laengenfelder, Auffuellung. Genau darum geht es hier.
    """
    from pcap_enet import pakete
    from enet_strom import nachrichten, kopf_lesen

    fehler = 0
    echte = []
    for n in nachrichten(pakete(pfad), nur_server=False):
        if n["server"]:
            continue
        k = kopf_lesen(n["daten"])
        if (k and k["knoten"] == KNOTEN_ANMELDUNG
                and k["methode"] == METHODE_ANMELDUNG and n["daten"][3] == 8):
            echte.append(n["daten"])

    print(f"  {len(echte)} aufgezeichnete Anmeldeaufrufe")
    if not echte:
        return 1
    echt = echte[0]

    # Laengen der beiden Geheimnisse aus dem Aufruf lesen, ohne die Werte anzufassen.
    benutzer_laenge = struct.unpack("<I", echt[8:12])[0]
    benutzer_ab = 12
    nach_benutzer = benutzer_ab + benutzer_laenge + (-benutzer_laenge % 4)
    nummer_breite = BREITEN_ZURUECK[echt[nach_benutzer] >> 6]
    nummer = int.from_bytes(
        echt[nach_benutzer + 1:nach_benutzer + 1 + nummer_breite], "little")
    passwort_ab = nach_benutzer + 1 + nummer_breite
    passwort_laenge = struct.unpack("<I", echt[passwort_ab + 4:passwort_ab + 8])[0]
    passwort_daten = passwort_ab + 8
    version_ab = passwort_daten + passwort_laenge + (-passwort_laenge % 4)
    version_laenge = struct.unpack("<I", echt[version_ab + 4:version_ab + 8])[0]
    version = echt[version_ab + 8:version_ab + 8 + version_laenge].decode()

    gebaut = anmeldung("X" * benutzer_laenge, nummer,
                       "Y" * passwort_laenge, version)

    # Die Wertbereiche der beiden Geheimnisse ausblenden, alles andere vergleichen.
    def ausblenden(b):
        b = bytearray(b)
        for ab, laenge in ((benutzer_ab, benutzer_laenge),
                           (passwort_daten, passwort_laenge)):
            b[ab:ab + laenge] = b"\x00" * laenge
        return bytes(b)

    print(f"    Version {version!r}, Laengen {benutzer_laenge} und "
          f"{passwort_laenge}, Zahl {nummer}")
    print(f"    aufgezeichnet {len(echt)} Bytes, gebaut {len(gebaut)} Bytes")
    if len(gebaut) != len(echt):
        print("    ABWEICHUNG in der Laenge")
        return 1
    if ausblenden(gebaut) != ausblenden(echt):
        print("    ABWEICHUNG in der Form")
        a, b = ausblenden(echt), ausblenden(gebaut)
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                print(f"      erste Abweichung bei Byte {i}: "
                      f"{x:02x} gegen {y:02x}")
                break
        fehler += 1
    else:
        print("    gleich, bis auf die zwei ausgeblendeten Wertbereiche")
    return fehler


def main():
    p = argparse.ArgumentParser(description="ENet-Pakete bauen")
    u = p.add_subparsers(dest="befehl", required=True)
    s = u.add_parser("selbsttest")
    s.add_argument("datei")
    m = u.add_parser("anmeldung", help="Form des Anmeldeaufrufs pruefen")
    m.add_argument("datei")
    z = u.add_parser("zeigen", help="eine Anfrage als Hex ausgeben")
    z.add_argument("seite", type=int)
    a = p.parse_args()

    if a.befehl == "zeigen":
        print(bestenliste_anfrage(a.seite).hex())
        return
    if a.befehl == "anmeldung":
        raise SystemExit(selbsttest_anmeldung(a.datei))
    raise SystemExit(selbsttest(a.datei))


if __name__ == "__main__":
    main()
