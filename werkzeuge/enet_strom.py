#!/usr/bin/env python3
"""ENet-Befehle aus einem Mitschnitt lesen und fragmentierte Pakete zusammensetzen.

Ein UDP-Paket traegt bei ENet nicht eine Nachricht, sondern eine Kette von Befehlen:
Bestaetigungen, Herzschlag, Nutzdaten. Grosse Nutzdaten werden ueber viele Pakete
verteilt und muessen anhand von Startfolgenummer und Versatz wieder zusammengesetzt
werden. Genau das passiert mit der Antwort auf den Bestenlistenabruf, sie ist rund
20 KB gross und kommt in ueber vierzig Stuecken.

Aufbau eines Pakets:

    2 Byte  Peer-Kennung, oberstes Bit heisst "Zeitstempel folgt"
    2 Byte  Zeitstempel, nur wenn das Bit gesetzt ist
    dann beliebig viele Befehle, jeder mit
    1 Byte  Befehl, oberste Bits sind Flags
    1 Byte  Kanal
    2 Byte  zuverlaessige Folgenummer

Diese Datei kennt nur die Befehle, die in diesem Mitschnitt vorkommen. Alles andere
bricht die Kette sauber ab, statt zu raten.
"""
import argparse
import struct
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pcap_enet import pakete  # noqa: E402

ACKNOWLEDGE, CONNECT, VERIFY_CONNECT, DISCONNECT, PING = 1, 2, 3, 4, 5
SEND_RELIABLE, SEND_UNRELIABLE, SEND_FRAGMENT = 6, 7, 8
BANDWIDTH_LIMIT, THROTTLE_CONFIGURE, SEND_UNSEQUENCED = 9, 10, 11
SEND_UNRELIABLE_FRAGMENT = 12

# Feste Laenge je Befehl, ohne die vier Byte Befehlskopf. Nutzdatenbefehle tragen
# darueber hinaus ihre Datenlaenge im eigenen Kopf.
FESTE_LAENGE = {
    ACKNOWLEDGE: 4, CONNECT: 40, VERIFY_CONNECT: 40, DISCONNECT: 4, PING: 0,
    SEND_RELIABLE: 2, SEND_UNRELIABLE: 4, SEND_FRAGMENT: 20,
    BANDWIDTH_LIMIT: 8, THROTTLE_CONFIGURE: 12, SEND_UNSEQUENCED: 4,
    SEND_UNRELIABLE_FRAGMENT: 20,
}


def befehle(nutz):
    """Zerlegt ein UDP-Paket in seine ENet-Befehle."""
    if len(nutz) < 4:
        return
    peer = struct.unpack(">H", nutz[:2])[0]
    i = 2
    if peer & 0x8000:  # Zeitstempel vorhanden
        i += 2
    while i + 4 <= len(nutz):
        roh = nutz[i]
        art = roh & 0x0F
        kanal = nutz[i + 1]
        folge = struct.unpack(">H", nutz[i + 2:i + 4])[0]
        if art not in FESTE_LAENGE:
            return
        kopf = i + 4
        rest = FESTE_LAENGE[art]
        if kopf + rest > len(nutz):
            return
        felder = nutz[kopf:kopf + rest]
        daten = b""
        if art == SEND_RELIABLE:
            laenge = struct.unpack(">H", felder[:2])[0]
            daten = nutz[kopf + rest:kopf + rest + laenge]
            rest += laenge
        elif art == SEND_UNRELIABLE:
            laenge = struct.unpack(">H", felder[2:4])[0]
            daten = nutz[kopf + rest:kopf + rest + laenge]
            rest += laenge
        elif art in (SEND_FRAGMENT, SEND_UNRELIABLE_FRAGMENT):
            laenge = struct.unpack(">H", felder[2:4])[0]
            daten = nutz[kopf + rest:kopf + rest + laenge]
            rest += laenge
        yield {"art": art, "kanal": kanal, "folge": folge,
               "felder": felder, "daten": daten}
        i = kopf + rest


def nachrichten(ps, nur_server=True):
    """Setzt die Nutzdatenbefehle zu vollstaendigen Godot-Paketen zusammen.

    Unfragmentierte Sendungen sind sofort fertig. Fragmente werden ueber ihre
    Startfolgenummer gesammelt und erst ausgegeben, wenn die Gesamtlaenge erreicht
    ist; unvollstaendige Sammlungen fallen am Ende weg statt halb ausgewertet zu
    werden.
    """
    t0 = ps[0]["zeit"]
    offen = {}
    aus = []
    for p in ps:
        if nur_server and not p["server"]:
            continue
        for b in befehle(p["nutz"]):
            if b["art"] == SEND_RELIABLE:
                aus.append({"zeit": p["zeit"] - t0, "server": p["server"],
                            "daten": b["daten"], "teile": 1})
            elif b["art"] in (SEND_FRAGMENT, SEND_UNRELIABLE_FRAGMENT):
                start, _, anzahl, nummer, gesamt, versatz = struct.unpack(
                    ">HHIIII", b["felder"])
                schluessel = (b["kanal"], start)
                s = offen.setdefault(schluessel, {"gesamt": gesamt, "anzahl": anzahl,
                                                  "stuecke": {},
                                                  "zeit": p["zeit"] - t0,
                                                  "server": p["server"]})
                s["stuecke"][versatz] = b["daten"]
                if sum(len(x) for x in s["stuecke"].values()) >= s["gesamt"]:
                    daten = b"".join(s["stuecke"][k] for k in sorted(s["stuecke"]))
                    aus.append({"zeit": s["zeit"], "server": s["server"],
                                "daten": daten[:gesamt], "teile": len(s["stuecke"])})
                    del offen[schluessel]
    if offen:
        print(f"  {len(offen)} unvollstaendige Sammlungen verworfen", file=sys.stderr)
    aus.sort(key=lambda x: x["zeit"])
    return aus


def kopf_lesen(daten):
    """Godots RPC-Kopf: Befehlsart, Knotennummer, Methodennummer.

    Byte 0 traegt die Art in den unteren drei Bit und die Breite von Knoten- und
    Methodennummer in den Bit darueber. Alles, was hier vorkommt, nutzt die
    schmalste Form, ein Byte je Nummer.
    """
    if len(daten) < 3:
        return None
    art = daten[0] & 0x07
    knoten_breite = (daten[0] >> 3) & 0x03
    if art != 0 or knoten_breite != 0:  # 0 = REMOTE_CALL
        return {"art": art, "knoten": None, "methode": None, "rest": daten[1:]}
    return {"art": art, "knoten": daten[1], "methode": daten[2], "rest": daten[3:]}


NAMEN = {1: "ACK", 2: "CONNECT", 3: "VERIFY_CONNECT", 4: "DISCONNECT", 5: "PING",
         6: "SEND_RELIABLE", 7: "SEND_UNRELIABLE", 8: "SEND_FRAGMENT",
         9: "BANDWIDTH_LIMIT", 10: "THROTTLE_CONFIGURE", 11: "SEND_UNSEQUENCED",
         12: "SEND_UNRELIABLE_FRAGMENT"}


def kette_zeigen(ps, bis, wieviele):
    """Die Befehlsketten der ersten Pakete, um den Handschlag zu sehen."""
    t0 = ps[0]["zeit"]
    n = 0
    for p in ps:
        if p["zeit"] - t0 > bis or n >= wieviele:
            break
        richtung = "rein " if p["server"] else "raus"
        teile = []
        for b in befehle(p["nutz"]):
            marke = NAMEN.get(b["art"], str(b["art"]))
            zusatz = f" {len(b['daten'])}B" if b["daten"] else ""
            teile.append(f"{marke}(k{b['kanal']} f{b['folge']}{zusatz})")
        peer = struct.unpack(">H", p["nutz"][:2])[0] & 0x0FFF
        print(f"  {p['zeit'] - t0:6.2f}  {richtung}  peer {peer:5}  "
              + " ".join(teile))
        n += 1


def main():
    p = argparse.ArgumentParser(description="ENet-Nachrichten zusammensetzen")
    p.add_argument("datei")
    p.add_argument("--von", type=float, default=0.0)
    p.add_argument("--bis", type=float, default=1e9)
    p.add_argument("--ab", type=int, default=0, help="nur Nachrichten ab n Bytes")
    p.add_argument("--auch-raus", action="store_true")
    p.add_argument("--rohhex", type=int, default=0,
                   help="die ersten n Pakete vollstaendig als Hex")
    p.add_argument("--kette", type=int, default=0,
                   help="Befehlsketten der ersten n Pakete zeigen")
    p.add_argument("--hex", type=int, default=0,
                   help="von der ersten passenden Nachricht n Bytes zeigen")
    a = p.parse_args()

    ps = pakete(a.datei)
    ns = nachrichten(ps, nur_server=not a.auch_raus)
    ns = [n for n in ns if a.von <= n["zeit"] <= a.bis and len(n["daten"]) >= a.ab]
    if a.rohhex:
        t0 = ps[0]["zeit"]
        for p_ in ps[:a.rohhex]:
            richtung = "rein " if p_["server"] else "raus"
            print(f"  {p_['zeit'] - t0:6.2f}  {richtung}  {p_['nutz'].hex(' ')}")
        return

    if a.kette:
        kette_zeigen(ps, a.bis if a.bis < 1e8 else 1e9, a.kette)
        return

    if a.hex and ns:
        d = ns[0]["daten"][:a.hex]
        print(f"  erste Nachricht: {len(ns[0]['daten'])} Bytes, "
              f"Sekunde {ns[0]['zeit']:.2f}\n")
        for i in range(0, len(d), 16):
            teil = d[i:i + 16]
            lesbar = "".join(chr(b) if 32 <= b < 127 else "." for b in teil)
            print(f"  {i:6}  {teil.hex(' '):48}  {lesbar}")
        return

    print(f"  {len(ns)} Nachrichten\n")
    print("     Sek  Richtung  Teile   Bytes  Knoten  Methode")
    for n in ns:
        k = kopf_lesen(n["daten"]) or {}
        richtung = "rein" if n["server"] else "raus"
        print(f"  {n['zeit']:6.2f}  {richtung:8}  {n['teile']:5}  {len(n['daten']):6}  "
              f"{str(k.get('knoten')):>6}  {str(k.get('methode')):>7}")


if __name__ == "__main__":
    main()
