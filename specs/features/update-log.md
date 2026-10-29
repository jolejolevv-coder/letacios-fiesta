# Update Log von OPBounty über einen eigenen Discord Bot

Entwurf vom 29.10.2026, am selben Tag freigegeben. Phase 1 gebaut: `update_log.py`,
`tests/test_update_log.py`, Schritt in der Action, Anleitung `docs/discord-bot-anleitung.md`.

Entschieden am 29.10.: Der Nutzer folgt dem Update Kanal bereits und leitet ihn in seinen
eigenen Server um. Die Action bleibt bei einem Lauf am Tag plus nach jedem Push.

## Goal

Die Action liest bei jedem Lauf die neuesten Update Meldungen von OPBounty und meldet über
GitHub, wenn eine davon Format, Queue oder Statistik betrifft.

## Ablauf

1. Der Update Kanal von OPBounty wird per „Folgen“ in einen eigenen, privaten Discord Server
   des Nutzers gespiegelt. Discord legt jede neue Meldung dort automatisch als Nachricht ab.
2. Ein eigener Bot des Nutzers (Discord Developer Portal) ist Mitglied nur dieses Servers und
   hat dort nur das Recht, den Kanal zu lesen (View Channel, Read Message History).
3. Ein neues Skript `update_log.py` holt mit dem Bot Token über die offizielle REST API
   (`GET /channels/<id>/messages`) die letzten Nachrichten. Es braucht kein Gateway und keinen
   dauernd laufenden Bot.
4. Neue Meldungen landen in `public/tage/update_log.json` (Datum, Version, Text), höchstens
   die letzten 20.
5. Enthält eine neue Meldung ein Set (`OP\d\d`, `EB\d\d`), das Wort Queue oder eine Version
   (`v\d+\.\d+\.\d+`), schreibt die Action `::warning::` mit der ersten Zeile der Meldung.

## Scope

In scope:
- `update_log.py` mit Tests ohne Netz (Beispielnachrichten als JSON).
- Ein Schritt in `veroeffentlichen.yml` vor dem Bau, mit `DISCORD_BOT_TOKEN` und
  `DISCORD_KANAL_ID` als GitHub Secrets.
- Fehlt das Token oder antwortet Discord nicht, läuft der Bau weiter, mit `::warning::`.

Out of scope:
- Anzeige der Meldungen auf der Seite (später, nur auf Wunsch).
- Automatisches Umstellen von Satz oder Format anhand der Meldung; die Formaterkennung aus den
  Replays bleibt die einzige Stelle, die umstellt.
- Lesen anderer Kanäle oder Server; der Bot sieht nur den gespiegelten Kanal.

## Was der Nutzer einmal tun muss

1. Erledigt: Update Kanal per „Folgen“ in den eigenen Server umgeleitet.
2. Erledigt.
3. Im Developer Portal eine Anwendung mit Bot anlegen und den Bot mit Leserecht einladen.
4. Token und Kanal ID als Secrets im Repo `letacios-fiesta` eintragen. Claude tippt das Token nie.

## Acceptance criteria

- [ ] Eine neue Meldung im Update Kanal steht nach dem nächsten Lauf in `update_log.json`.
- [x] Eine Meldung mit Set, Queue oder Version erzeugt genau eine `::warning::`, auch über
      mehrere Läufe nicht doppelt.
- [x] Ohne Token oder bei Fehler von Discord baut die Seite trotzdem, mit `::warning::`.
- [x] Python Tests laufen durch.

## Implementation plan

Phase 1 (gebaut, Tests ohne Netz): `update_log.py` mit Tests, Schritt in der Action, Secrets durch den Nutzer.
Phase 2: erster Lauf, Prüfung gegen die Meldung zu v2.7.8.

## Tradeoffs

Der Bot ist regelkonform und hängt nicht an der Discord Oberfläche, kostet aber einmal etwa
zehn Minuten Einrichtung. Meldungen kommen nur so oft an wie die Action läuft (täglich plus
nach jedem Push); für Sofortmeldungen bräuchte es einen dauernd laufenden Bot auf dem Bazzite.

## Open questions

- Keine. Der Nutzer legt noch Bot und Secrets an (`DISCORD_BOT_TOKEN`, `DISCORD_KANAL_ID`).
