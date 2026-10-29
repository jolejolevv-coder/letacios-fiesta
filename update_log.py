"""Holt die Update Meldungen von OPBounty aus Discord und meldet wichtige ueber GitHub.

Der Update Kanal von OPBounty ist per "Folgen" in einen eigenen Server gespiegelt. Ein
eigener Bot liest dort nur diesen Kanal, ueber die REST API, ohne dauernd zu laufen.
Siehe specs/features/update-log.md.

    python3 update_log.py --ziel public

Braucht DISCORD_BOT_TOKEN und DISCORD_KANAL_ID in der Umgebung. Fehlt eines davon oder
antwortet Discord nicht, gibt es eine ::warning:: und der Bau laeuft weiter.

Die Liste liegt in public/tage/update_log.json, also im Zwischenspeicher der Action. So
weiss der naechste Lauf, welche Meldungen schon gemeldet sind.
"""
import argparse
import json
import os
import re
import urllib.request

API = "https://discord.com/api/v10"
# Discord verlangt einen eigenen User-Agent fuer Bots, sonst antwortet es mit 403.
USER_AGENT = "DiscordBot (https://github.com/jolejolevv-coder/letacios-fiesta, 1.0)"
ABRUF_ANZAHL = 20
BEHALTEN = 20
ZEITLIMIT = 30
DATEI = os.path.join("tage", "update_log.json")
VERSION = re.compile(r"\bv(\d+\.\d+\.\d+)\b", re.IGNORECASE)
# Was die Seite betreffen kann: ein Set, eine Queue, eine neue Spielversion, die Statistik.
MARKDOWN = re.compile(r"[*_`~]")
WICHTIG = re.compile(r"\b(OP\d\d|EB\d\d|queues?|v\d+\.\d+\.\d+|stats?)\b", re.IGNORECASE)


def nachrichten_holen(token: str, kanal: str, anzahl: int = ABRUF_ANZAHL) -> list:
    """Die neuesten Nachrichten des Kanals, neueste zuerst, wie Discord sie liefert."""
    anfrage = urllib.request.Request(
        f"{API}/channels/{kanal}/messages?limit={anzahl}",
        headers={"Authorization": f"Bot {token}", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT) as antwort:
        return json.loads(antwort.read())


def text_aus_nachricht(nachricht: dict) -> str:
    """Der lesbare Text einer Nachricht, samt Titel und Text ihrer Embeds.

    Gespiegelte Meldungen tragen ihren Text meist in `content`, manche Bots schreiben
    ihn aber in ein Embed. Beides gehoert zur Meldung.
    """
    teile = [nachricht.get("content") or ""]
    for embed in nachricht.get("embeds") or []:
        teile += [embed.get("title") or "", embed.get("description") or ""]
    return "\n".join(t for t in teile if t).strip()


def meldung(nachricht: dict) -> dict:
    """Eine Nachricht in die Form, die in update_log.json steht."""
    text = text_aus_nachricht(nachricht)
    version = VERSION.search(text)
    return {"id": nachricht["id"], "zeit": nachricht.get("timestamp", ""),
            "version": version.group(1) if version else None, "text": text}


def ist_wichtig(text: str) -> bool:
    return bool(WICHTIG.search(text))


def erste_zeile(text: str) -> str:
    """Die erste Zeile mit Inhalt, ohne die Markdown Zeichen von Discord."""
    for zeile in text.splitlines():
        sauber = MARKDOWN.sub("", zeile).strip().lstrip("#> ").strip()
        if sauber:
            return sauber
    return ""


def zusammenfuehren(alt: list, neu: list) -> tuple[list, list]:
    """Alte und neue Meldungen vereinen. Gibt (Liste, bisher unbekannte) zurueck.

    Discord IDs wachsen mit der Zeit, also sortiert die ID von neu nach alt. Behalten
    werden die neuesten BEHALTEN Meldungen.
    """
    bekannt = {m["id"] for m in alt}
    unbekannt = [m for m in neu if m["id"] not in bekannt]
    alle = {m["id"]: m for m in alt + neu}
    liste = sorted(alle.values(), key=lambda m: int(m["id"]), reverse=True)[:BEHALTEN]
    return liste, sorted(unbekannt, key=lambda m: int(m["id"]))


def warnungen(unbekannt: list) -> list:
    """Je wichtige neue Meldung eine Zeile fuer ::warning::."""
    return [f"OPBounty Update ({m['zeit'][:10]}): {erste_zeile(m['text'])}"
            for m in unbekannt if ist_wichtig(m["text"])]


def lesen(pfad: str) -> list:
    if not os.path.exists(pfad):
        return []
    with open(pfad, encoding="utf-8") as datei:
        return json.load(datei)


def schreiben(pfad: str, liste: list) -> None:
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    with open(pfad, "w", encoding="utf-8") as datei:
        json.dump(liste, datei, ensure_ascii=False, indent=1)


def main() -> None:
    teiler = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    teiler.add_argument("--ziel", default="public")
    args = teiler.parse_args()

    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    kanal = os.environ.get("DISCORD_KANAL_ID", "")
    if not token or not kanal:
        print("::warning::DISCORD_BOT_TOKEN oder DISCORD_KANAL_ID fehlt, Update Log uebersprungen")
        return
    try:
        neu = [meldung(n) for n in nachrichten_holen(token, kanal)]
    except Exception as fehler:
        print(f"::warning::Discord nicht erreichbar, Update Log bleibt wie gestern: {fehler}")
        return

    pfad = os.path.join(args.ziel, DATEI)
    try:
        alt = lesen(pfad)
    except Exception as fehler:
        print(f"::warning::{pfad} unlesbar, fange neu an: {fehler}")
        alt = []
    liste, unbekannt = zusammenfuehren(alt, neu)
    # Beim allerersten Lauf ist alles unbekannt. Dann nur ablegen, sonst kaemen zwanzig
    # alte Meldungen auf einmal als Warnung.
    if alt:
        for zeile in warnungen(unbekannt):
            print(f"::warning::{zeile}")
    schreiben(pfad, liste)
    print(f"  update_log.json: {len(liste)} Meldungen, {len(unbekannt)} neu")


if __name__ == "__main__":
    main()
