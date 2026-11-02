# Bestenliste aus der OPBounty Web API

Entwurf vom 02.11.2026, wartet auf Freigabe. Grundlage: `docs/recherche-github-tools.md`.

## Goal

Die Top 100 der Bestenliste kommen aus der Web API von `stats.tcgmatchmaking.com` statt per Bildschirmfoto und OCR, damit die Namen exakt sind.

## Scope

* In scope: Abruf von `GET /api/leaderboard/mode_0` (Seite 1, 100 Einträge) mit anonymer Sitzung; Zuordnung der Felder auf das Format von `public/bestenliste.json.gz`; Parallelbetrieb mit der OCR und ein Vergleichsbericht; danach Umschalten, OCR bleibt Rückfall.
* Out of scope: mehr als 100 Spieler, Piloten je Leader, Decklisten aus dieser API (eigene Specs, wenn gewünscht), Abschalten des Bazzite.

## Stand der Kenntnis (aus dem Quellcode eines Dritten, nicht geprüft)

* `POST /auth/session` ohne Zugangsdaten liefert ein Token, danach `Authorization: Bearer <token>`.
* `GET /api/leaderboard/{mode}?page=&per_page=` mit `mode_0` für Standard.
* Rate Limit nach seinen Angaben rund 12 Anfragen je Burst und IP, er wartet 2 Sekunden zwischen Aufrufen.
* Kennung wie bei ihm: ehrlicher Bot `User-Agent` mit Hinweis auf das Projekt, `Accept: application/json`, Wiederholung bis 5 mal bei 429 und 5xx mit Wartezeit ab 2 Sekunden, verdoppelt bis 60.

## Acceptance criteria

- [ ] Ein Probeaufruf (mit Ok des Nutzers) bestätigt: Sitzung ohne Zugangsdaten, `per_page=100` erlaubt, Antwortfelder bekannt. Die Felder stehen danach in diesem Spec.
- [ ] Die Top 100 der API stimmen im Parallelbetrieb mit der OCR Liste desselben Tages bei Bounty auf eine Nachkommastelle überein; Abweichungen stehen im Vergleichsbericht (Namen, Rang).
- [ ] Hat die API keine `user_id`, bleibt die Zuordnung wie heute (`spieler_daten.py`) und der Name aus der API dient als Anker.
- [ ] Fällt die API aus oder ändert die Form, bleibt die OCR Liste stehen und die Action meldet es (Wache wie in `selbstlauf.md` Phase 3).
- [ ] Tests mit festen Beispielantworten (Fixtures), ein Fehlerfall je Statuscode.
- [ ] Keine Zugangsdaten in Notizen oder im Repo. Das Token wird je Lauf neu geholt und nicht gespeichert.

## Implementation plan

Phase 0: Probeaufruf durch den Nutzer oder mit seinem Ok, Felder festhalten.
Phase 1: Modul `bestenliste_api.py` mit Sitzung, Abruf, Wiederholung, Zuordnung, Tests.
Phase 2: Parallelbetrieb eine Woche, Vergleichsbericht (Name, Bounty, Rang).
Phase 3: Umschalten auf die API, OCR als Rückfall, Eintrag in Changelog und Übergabe.

## Open questions

* Wo läuft der Abruf: in der GitHub Action (gemeinsame IP Bereiche, Rate Limit eng) oder auf dem Bazzite Server (feste Heim IP)? Empfehlung: Server, weil die Bestenliste dort ohnehin entsteht.
* Wie oft: einmal täglich nach der OCR Zeit (05:30 UTC) oder öfter? Sein Vorbild holt einmal am Tag.
* Enthält die Antwort Spielerkennungen, die `user_id` ersetzen könnten?
