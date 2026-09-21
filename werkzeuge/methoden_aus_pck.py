"""Die RPC-Methodennummern aus dem pck des Clients ausrechnen.

Godot vergibt die Nummer einer @rpc Methode ueber die SORTIERTE Liste aller @rpc
Methoden des Knotens: die Nummer ist der Index in dieser Liste. Kommt eine Methode
dazu, verschiebt sich alles dahinter, und der Server beantwortet die alte Nummer nicht
mehr. Genau daran ist die Bestenliste am 09.09.2026 stehengeblieben.

Der Client aktualisiert sich selbst und legt sein pck unter
`~/Library/Application Support/Godot/app_userdata/OPBounty/OPBounty.pck` ab. Seit
Version 2.6.1 steht der GDScript Quelltext dort im Klartext, die Liste ist also
auslesbar, ohne ein einziges Paket zu senden.

Der Lauf prueft sich selbst: er rechnet zusaetzlich die Nummern des ALTEN Standes aus,
indem er die Methoden weglaesst, die im alten Textauszug nicht vorkommen. Kommt dabei
fuer request_filtered_leaderboard die 0x46 heraus, also die Nummer aus dem Mitschnitt
vom 01.09.2026, stimmen Liste und Sortierung.

    python3 werkzeuge/methoden_aus_pck.py
    python3 werkzeuge/methoden_aus_pck.py --pck /pfad/zum/OPBounty.pck
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess

PCK = os.path.expanduser(
    "~/Library/Application Support/Godot/app_userdata/OPBounty/OPBounty.pck")
ALTER_AUSZUG = os.path.expanduser("~/Downloads/xebec-mirror-sim/docs/pck_text.txt")
# Ein Anker im Skript des Knotens root_main/Main und die Grenze dahinter.
ANKER = "func send_leaderboard("
GRENZE = re.compile(r"^extends ")
# Was der Laeufer sendet, mit der Nummer aus dem Mitschnitt vom 01.09.2026 (2.5.5).
GEBRAUCHT = {
    "login_request": 0x27,
    "request_arena_stats": 0x40,
    "request_filtered_leaderboard": 0x46,
    "request_upgrades": 0x60,
    "update_auto_config": 0x85,
}


def zeilen_aus_pck(pfad: str) -> list[str]:
    roh = subprocess.run(["strings", "-a", pfad], capture_output=True, text=True,
                         errors="replace")
    return roh.stdout.split("\n")


def skriptblock(zeilen: list[str]) -> list[str]:
    """Das Skript, in dem send_leaderboard steht, von 'extends' bis 'extends'."""
    treffer = next((i for i, z in enumerate(zeilen) if z.startswith(ANKER)), None)
    if treffer is None:
        raise SystemExit(f"'{ANKER}' nicht gefunden, pck zu alt oder anders gepackt")
    anfang = max((i for i in range(treffer) if GRENZE.match(zeilen[i])), default=0)
    ende = next((i for i in range(treffer + 1, len(zeilen)) if GRENZE.match(zeilen[i])),
                len(zeilen))
    return zeilen[anfang:ende]


def rpc_methoden(block: list[str]) -> list[str]:
    namen = []
    for i, z in enumerate(block):
        if not z.startswith("@rpc"):
            continue
        for j in range(i + 1, min(i + 4, len(block))):
            m = re.match(r"func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", block[j])
            if m:
                namen.append(m.group(1))
                break
    return sorted(set(namen))


def alte_liste(neu: list[str], auszug: str) -> list[str] | None:
    """Der alte Stand, rekonstruiert ueber die Namen im alten Textauszug."""
    if not os.path.exists(auszug):
        return None
    with open(auszug, encoding="utf-8", errors="replace") as f:
        bekannt = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", f.read()))
    return [n for n in neu if n in bekannt]


def main() -> None:
    p = argparse.ArgumentParser(description="RPC-Nummern aus dem pck")
    p.add_argument("--pck", default=PCK)
    p.add_argument("--auszug", default=ALTER_AUSZUG)
    a = p.parse_args()

    zeilen = zeilen_aus_pck(a.pck)
    version = next((m.group(1) for z in zeilen
                    if (m := re.search(r'"(2\.\d+\.\d+)"', z))), "unbekannt")
    neu = rpc_methoden(skriptblock(zeilen))
    alt = alte_liste(neu, a.auszug)

    print(f"  pck {a.pck}")
    print(f"  Version {version}, {len(neu)} @rpc Methoden\n")
    if alt is not None:
        dazu = [n for n in neu if n not in alt]
        print(f"  gegenueber dem alten Auszug neu: {', '.join(dazu) or 'nichts'}\n")

    print(f"  {'Methode':<32}{'alt':>6}{'neu':>6}   Probe")
    for name, mitschnitt in GEBRAUCHT.items():
        if name not in neu:
            print(f"  {name:<32}{'':>6}{'fehlt':>6}")
            continue
        n = neu.index(name)
        a_idx = alt.index(name) if alt and name in alt else None
        probe = ""
        if a_idx is not None:
            probe = "stimmt" if a_idx == mitschnitt else f"ERWARTET 0x{mitschnitt:02x}"
        print(f"  {name:<32}{('0x%02x' % a_idx) if a_idx is not None else '':>6}"
              f"{'0x%02x' % n:>6}   {probe}")


if __name__ == "__main__":
    main()
