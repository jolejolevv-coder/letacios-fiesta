#!/usr/bin/env python3
"""Einen tcpdump-Mitschnitt der Spielverbindung lesen und die ENet-Pakete zeigen.

Ohne Wireshark, ohne tshark: der Mitschnitt wird hier direkt gelesen. Auf macOS
schreibt `tcpdump -i any` im Format PKTAP, dessen Kopf zuerst uebersprungen werden
muss; darunter liegt je nach Schnittstelle ein Ethernet-, Loopback- oder roher
IP-Rahmen.

    python3 tools/pcap_enet.py zeitachse mitschnitt.pcap
    python3 tools/pcap_enet.py gross mitschnitt.pcap --ab 200

`zeitachse` gruppiert die Pakete an den Sprechpausen. Genau dafuer wurden beim
Mitschneiden fuenf Sekunden zwischen den Klicks gelassen: die Gruppen sind dann die
einzelnen Seitenabrufe.
"""
import argparse
import struct
import sys

DLT_NULL, DLT_EN10MB, DLT_RAW_BSD, DLT_RAW = 0, 1, 12, 101
DLT_LOOP, DLT_PKTAP = 108, 258
# Linux liefert bei `tcpdump -i any` einen eigenen Rahmen, nicht PKTAP wie macOS.
DLT_LINUX_SLL, DLT_LINUX_SLL2 = 113, 276

# Ab dieser Ruhe gilt ein neuer Block als eigener Vorgang. Passt zu den fuenf
# Sekunden Pause, die beim Mitschneiden zwischen den Klicks gelassen wurden.
PAUSE = 2.0


def pcapng_lesen(datei):
    """pcapng: nur die Bloecke, die hier gebraucht werden.

    SHB setzt die Bytereihenfolge, jeder IDB traegt einen Linktyp und wird in der
    Reihenfolge seines Auftretens durchnummeriert, EPB verweist ueber diese Nummer
    darauf. Alles andere wird uebersprungen.
    """
    e = "<"
    linktypen, aufloesung = [], []
    while True:
        kopf = datei.read(8)
        if len(kopf) < 8:
            return
        typ = struct.unpack(e + "I", kopf[:4])[0]
        if typ == 0x0A0D0D0A:  # Section Header
            # Die Ordnungsmarke ist die Zahl 0x1A2B3C4D. Auf einer Little-Endian
            # Maschine steht sie als 4d 3c 2b 1a in der Datei, nicht andersherum.
            e = "<" if datei.read(4) == b"\x4d\x3c\x2b\x1a" else ">"
            datei.seek(-4, 1)
            linktypen, aufloesung = [], []
        laenge = struct.unpack(e + "I", kopf[4:8])[0]
        if laenge < 12:
            return
        rumpf = datei.read(laenge - 12)
        if len(rumpf) < laenge - 12:
            return
        datei.read(4)  # abschliessende Laenge

        if typ == 1:  # Interface Description
            linktypen.append(struct.unpack(e + "H", rumpf[:2])[0])
            # if_tsresol steckt in den Optionen; ohne Angabe gilt Mikrosekunden.
            aufloesung.append(tsresol_lesen(rumpf[8:], e))
        elif typ == 6:  # Enhanced Packet
            nr, hoch, tief, caplen, _ = struct.unpack(e + "IIIII", rumpf[:20])
            roh = rumpf[20:20 + caplen]
            teiler = aufloesung[nr] if nr < len(aufloesung) else 1e6
            yield ((hoch << 32 | tief) / teiler, roh,
                   linktypen[nr] if nr < len(linktypen) else 1)


def tsresol_lesen(opt, e):
    """if_tsresol aus den Optionen eines IDB. Ohne Angabe Mikrosekunden."""
    i = 0
    while i + 4 <= len(opt):
        code, laenge = struct.unpack(e + "HH", opt[i:i + 4])
        if code == 0:
            break
        if code == 9 and laenge >= 1:  # if_tsresol
            w = opt[i + 4]
            return float(2 ** (w & 0x7F) if w & 0x80 else 10 ** w)
        i += 4 + ((laenge + 3) // 4) * 4
    return 1e6


def pcap_lesen(pfad):
    """Liefert (zeit, roh, linktyp) je Paket. Versteht pcap, nicht pcapng."""
    with open(pfad, "rb") as datei:
        kopf = datei.read(24)
        if len(kopf) < 24:
            raise SystemExit("Datei zu kurz")
        magie = struct.unpack("<I", kopf[:4])[0]
        if magie in (0xA1B2C3D4, 0xA1B23C4D):
            e, nano = "<", magie == 0xA1B23C4D
        elif magie in (0xD4C3B2A1, 0x4D3CB2A1):
            e, nano = ">", magie == 0x4D3CB2A1
        elif kopf[:4] == b"\x0a\x0d\x0d\x0a":
            # macOS schreibt bei `-i any` pcapng, nicht das alte pcap.
            datei.seek(0)
            yield from pcapng_lesen(datei)
            return
        else:
            raise SystemExit(f"unbekanntes Format: {kopf[:4].hex()}")
        linktyp = struct.unpack(e + "I", kopf[20:24])[0]
        while True:
            ph = datei.read(16)
            if len(ph) < 16:
                return
            ts, tus, caplen, _ = struct.unpack(e + "IIII", ph)
            roh = datei.read(caplen)
            if len(roh) < caplen:
                return
            yield ts + tus / (1e9 if nano else 1e6), roh, linktyp


def udp_auspacken(roh, linktyp):
    """Schaelt PKTAP, Rahmen und IP ab. Gibt (quelle, ziel, nutzlast) oder None."""
    if linktyp == DLT_PKTAP:
        if len(roh) < 12:
            return None
        kopflaenge, _, dlt = struct.unpack("<III", roh[:12])
        if kopflaenge > len(roh):
            return None
        roh, linktyp = roh[kopflaenge:], dlt

    if linktyp == DLT_LINUX_SLL:
        # 16 Byte Kopf, das Protokoll steht auf Byte 14.
        if len(roh) < 16 or struct.unpack(">H", roh[14:16])[0] != 0x0800:
            return None
        roh = roh[16:]
        linktyp = DLT_RAW
    elif linktyp == DLT_LINUX_SLL2:
        # 20 Byte Kopf, das Protokoll steht ganz vorn.
        if len(roh) < 20 or struct.unpack(">H", roh[0:2])[0] != 0x0800:
            return None
        roh = roh[20:]
        linktyp = DLT_RAW

    if linktyp == DLT_EN10MB:
        if len(roh) < 14 or struct.unpack(">H", roh[12:14])[0] != 0x0800:
            return None
        roh = roh[14:]
    elif linktyp in (DLT_NULL, DLT_LOOP):
        roh = roh[4:]
    elif linktyp in (DLT_RAW, DLT_RAW_BSD):
        pass
    else:
        return None

    if len(roh) < 20 or (roh[0] >> 4) != 4:
        return None
    ihl = (roh[0] & 0x0F) * 4
    if roh[9] != 17 or len(roh) < ihl + 8:  # 17 = UDP
        return None
    ip_q = ".".join(str(b) for b in roh[12:16])
    ip_z = ".".join(str(b) for b in roh[16:20])
    udp = roh[ihl:]
    port_q, port_z, laenge = struct.unpack(">HHH", udp[:6])
    return (f"{ip_q}:{port_q}", f"{ip_z}:{port_z}", udp[8:laenge] if laenge >= 8 else udp[8:])


def pakete(pfad, server_port=4694):
    aus = []
    for zeit, roh, linktyp in pcap_lesen(pfad):
        t = udp_auspacken(roh, linktyp)
        if not t:
            continue
        quelle, ziel, nutz = t
        vom_server = quelle.endswith(":" + str(server_port))
        aus.append({"zeit": zeit, "quelle": quelle, "ziel": ziel,
                    "nutz": nutz, "server": vom_server})
    # Doppelte durch `-i any` wegwerfen: dieselbe Nutzlast im selben Augenblick.
    gesehen, einmalig = set(), []
    for p in aus:
        s = (round(p["zeit"], 4), p["nutz"][:64], p["server"])
        if s in gesehen:
            continue
        gesehen.add(s)
        einmalig.append(p)
    return einmalig


def zeitachse(ps):
    if not ps:
        print("  keine UDP-Pakete auf dem Port gefunden")
        return
    start = ps[0]["zeit"]
    bloecke, aktuell = [], [ps[0]]
    for vorher, p in zip(ps, ps[1:]):
        if p["zeit"] - vorher["zeit"] > PAUSE:
            bloecke.append(aktuell)
            aktuell = []
        aktuell.append(p)
    bloecke.append(aktuell)

    print(f"  {len(ps)} Pakete, {len(bloecke)} Bloecke, "
          f"{ps[-1]['zeit'] - start:.1f} Sekunden\n")
    print("  Block   ab Sek   Pakete   raus/rein   Bytes rein   groesstes rein")
    for i, b in enumerate(bloecke, 1):
        rein = [p for p in b if p["server"]]
        raus = [p for p in b if not p["server"]]
        summe = sum(len(p["nutz"]) for p in rein)
        groesstes = max((len(p["nutz"]) for p in rein), default=0)
        print(f"  {i:5}   {b[0]['zeit'] - start:6.1f}   {len(b):6}   "
              f"{len(raus):4}/{len(rein):-4}   {summe:10}   {groesstes:8}")


def gross(ps, ab):
    treffer = [p for p in ps if len(p["nutz"]) >= ab]
    if not treffer:
        print(f"  kein Paket ab {ab} Bytes")
        return
    start = ps[0]["zeit"]
    print(f"  {len(treffer)} Pakete ab {ab} Bytes\n")
    for p in treffer[:40]:
        richtung = "rein " if p["server"] else "raus"
        print(f"  {p['zeit'] - start:7.2f}  {richtung}  {len(p['nutz']):6} Bytes  "
              f"{p['nutz'][:40].hex()}")


def anfragen(ps, laenge=24):
    """Die Seitenabrufe finden: gleich lange Ausgangspakete, die sich nur am Ende
    unterscheiden. Genau so sieht `request_filtered_leaderboard` aus."""
    raus = [p for p in ps if not p["server"] and len(p["nutz"]) == laenge]
    t0 = ps[0]["zeit"]
    print(f"  {len(raus)} Ausgangspakete mit {laenge} Bytes\n")
    for p in raus:
        # ENet: 2 Byte Peer, 2 Byte Zeit, 1 Byte Befehl, 1 Byte Kanal,
        # 2 Byte Folgenummer, 2 Byte Datenlaenge. Danach die Nutzlast von Godot.
        print(f"  {p['zeit'] - t0:7.2f}  {p['nutz'][10:].hex()}")
    return raus


def lesbares(ps, von, bis, mindest=4, nur_server=True):
    """Lesbare Zeichenketten aus den Paketen eines Zeitfensters."""
    import re

    t0 = ps[0]["zeit"]
    fenster = [p for p in ps
               if von <= p["zeit"] - t0 <= bis and (p["server"] or not nur_server)]
    blob = b"".join(p["nutz"] for p in fenster)
    print(f"  {len(fenster)} Pakete, {len(blob)} Bytes im Fenster "
          f"{von} bis {bis} Sekunden")
    treffer = re.findall(rb"[ -~]{%d,}" % mindest, blob)
    print(f"  {len(treffer)} lesbare Zeichenketten\n")
    for t in treffer:
        print("   ", t.decode("ascii", "replace"))


def blobs(ps, von, bis, wieviele=2):
    """Die gepackten Felder in der Antwort auspacken.

    Der Server schickt je Spieler ein Feld als gzip in base64, dasselbe Verfahren
    wie in `PublicUsers`. Hier wird gezeigt, was darin steht.
    """
    import base64
    import gzip
    import json
    import re

    t0 = ps[0]["zeit"]
    blob = b"".join(p["nutz"] for p in ps
                    if von <= p["zeit"] - t0 <= bis and p["server"])
    # base64 laeuft ueber Paketgrenzen, deshalb erst alles zusammenkleben.
    kandidaten = re.findall(rb"H4sI[A-Za-z0-9+/=\s]{40,}", blob)
    print(f"  {len(kandidaten)} gepackte Felder gefunden\n")
    for k in kandidaten[:wieviele]:
        sauber = re.sub(rb"\s", b"", k)
        for schnitt in range(len(sauber), len(sauber) - 4, -1):
            try:
                roh = gzip.decompress(base64.b64decode(sauber[:schnitt] + b"=" * 3))
                break
            except Exception:
                roh = None
        if roh is None:
            print("    nicht entpackbar (ueber die Paketgrenze abgeschnitten)")
            continue
        try:
            print("   ", json.dumps(json.loads(roh), ensure_ascii=False)[:900])
        except Exception:
            print("   ", roh[:900])
        print()


def main():
    p = argparse.ArgumentParser(description="ENet-Mitschnitt lesen")
    u = p.add_subparsers(dest="befehl", required=True)
    z = u.add_parser("zeitachse")
    z.add_argument("datei")
    g = u.add_parser("gross")
    g.add_argument("datei")
    g.add_argument("--ab", type=int, default=200)
    f = u.add_parser("anfragen")
    f.add_argument("datei")
    f.add_argument("--laenge", type=int, default=24)
    t = u.add_parser("text")
    t.add_argument("datei")
    t.add_argument("von", type=float)
    t.add_argument("bis", type=float)
    t.add_argument("--mindest", type=int, default=4)
    t.add_argument("--auch-raus", action="store_true")
    b = u.add_parser("blobs")
    b.add_argument("datei")
    b.add_argument("von", type=float)
    b.add_argument("bis", type=float)
    b.add_argument("--wieviele", type=int, default=2)
    a = p.parse_args()

    ps = pakete(a.datei)
    if a.befehl == "zeitachse":
        zeitachse(ps)
    elif a.befehl == "gross":
        gross(ps, a.ab)
    elif a.befehl == "anfragen":
        anfragen(ps, a.laenge)
    elif a.befehl == "blobs":
        blobs(ps, a.von, a.bis, a.wieviele)
    else:
        lesbares(ps, a.von, a.bis, a.mindest, not a.auch_raus)


if __name__ == "__main__":
    main()
