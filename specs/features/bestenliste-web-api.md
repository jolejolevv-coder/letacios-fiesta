# Bestenliste aus der OPBounty Web API

Entwurf vom 02.11.2026, am selben Tag vom Nutzer freigegeben ("Bestenliste zuerst"). Phase 0 und 1 gebaut. Grundlage: `docs/recherche-github-tools.md`.

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

## Probeaufruf vom 02.11.2026, 13:18 UTC (Phase 0)

* `POST /auth/session` ohne Körper und ohne Zugangsdaten: HTTP 200, `{"token", "expires_in": 7200}`.
* `GET /api/leaderboard/mode_0?page=1&per_page=100` mit Bearer Token: HTTP 200, 32 KB, 100 Zeilen. Kopf: `totalPlayers` 31374, `totalPages` 314, `gameMode`, `timestamp`. `per_page=100` ist erlaubt.
* Zeile: `rank`, `username`, `displayName`, `rating` (das ist der Bounty), `wins`, `losses`, `matches`, `winRate`, `leaderMostPlayed`, `topLeaders[{code, winRate, matches}]`, `isPremium`, `playerId`, `country`, `isMarine`.
* **`playerId` ist unsere `user_id`.** Von 50 Spielern der OCR Liste mit bekannter `user_id`, die in der API Top 100 stehen, hatten alle denselben Namen (bis auf OCR Fehler). Die OCR Liste kennt nur für 57 von 100 eine `user_id`, die API liefert sie für alle 100.
* Bounty: Die API ist live, unsere Liste von 05:30 UTC. Abweichungen bis rund 300 sind Tagesbewegung, kein Lesefehler. Der Namensvergleich zeigt die OCR Fehler (a1A1 als alAl, Salva1 als Salval, Jioh als vioh).
* Gelesen wurden zwei Aufrufe, ein Token, 2 Sekunden Abstand, Kennung mit Projektlink.

## Acceptance criteria

- [x] Probeaufruf bestätigt Sitzung ohne Zugangsdaten, `per_page=100` und die Felder (siehe oben).
- [ ] Die Top 100 der API stimmen im Parallelbetrieb mit der OCR Liste desselben Tages bei Bounty auf eine Nachkommastelle überein; Abweichungen stehen im Vergleichsbericht (Namen, Rang).
- [x] `playerId` der API ist die `user_id`, der Abruf setzt sie für alle 100 Zeilen.
- [ ] Fällt die API aus oder ändert die Form, bleibt die OCR Liste stehen und die Action meldet es (Wache wie in `selbstlauf.md` Phase 3).
- [x] Tests mit Attrappe für das Netz (`tests/test_bestenliste_api.py`, 12 Tests, grün): Ablauf, Zeilenformat, Rundung, Sortierung, 429 mit Wiederholung, Aufgeben, 403 ohne Wiederholung, fehlendes Token, zu wenige Zeilen, doppelter Rang, steigender Bounty, unbekannte Form.
- [ ] Keine Zugangsdaten in Notizen oder im Repo. Das Token wird je Lauf neu geholt und nicht gespeichert.

## Implementation plan

Phase 0 (erledigt): Probeaufruf, Felder festgehalten.
Phase 1 (erledigt): `bestenliste_api.py` und Schalter `--api` in `bestenliste_einbauen.py`, Tests grün. Der Schalter ersetzt die Liste wie `--fotos`, ohne `--api` bleibt alles wie vorher.
Phase 2: Parallelbetrieb eine Woche, Vergleichsbericht (Name, Bounty, Rang).
Phase 3: Umschalten auf die API, OCR als Rückfall, Eintrag in Changelog und Übergabe.

## Open questions

* Wo läuft der Abruf: in der GitHub Action (gemeinsame IP Bereiche, Rate Limit eng) oder auf dem Bazzite Server (feste Heim IP)? Empfehlung: Server, weil die Bestenliste dort ohnehin entsteht.
* Wie oft: einmal täglich nach der OCR Zeit (05:30 UTC) oder öfter? Sein Vorbild holt einmal am Tag.
* Enthält die Antwort Spielerkennungen, die `user_id` ersetzen könnten?
