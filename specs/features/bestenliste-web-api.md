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
Phase 2 (gebaut): Probebetrieb in der GitHub Action, Schritt "Bestenliste Web API gegen OCR" (`werkzeuge/bestenliste_vergleich.py`, `continue-on-error`). Er ändert keine Daten und schreibt nur Zahlen in die Zusammenfassung des Laufs (Namen gleich, ähnlich, anders, user_id Abdeckung, Median Rangabstand und Bountyabstand, Ausreißer), weil die Logs eines öffentlichen Repos öffentlich sind. Läuft nach dem Merge mit dem täglichen Lauf 06:20 UTC. Eine Woche beobachten.
Phase 3 (gebaut am 02.11.2026, ohne die Woche Probebetrieb abzuwarten, auf Wunsch des Nutzers): Umschalten auf die API als erste Quelle. Entscheidung des Nutzers am 02.11.2026: die OCR bleibt als Rückfall und springt ein, wenn die API ausfällt oder die Prüfung (`ApiFehler`) scheitert. Eintrag in Changelog und Übergabe.

## Open questions

* Wo läuft der Abruf: entschieden am 02.11.2026 für die GitHub Action. Risiko: gemeinsame IP Bereiche und ein enges Rate Limit. Der Probebetrieb zeigt, ob das hält (ein Lauf am Tag, zwei Aufrufe). Scheitert er, bleibt der Bazzite als Weg.
* Wie oft: einmal täglich nach der OCR Zeit (05:30 UTC) oder öfter? Sein Vorbild holt einmal am Tag.
* Enthält die Antwort Spielerkennungen, die `user_id` ersetzen könnten?

Phase 3 Umsetzung: In `veroeffentlichen.yml` läuft vor den Spielerdaten erst der Vergleich, dann `bestenliste_einbauen.py --api`. Gelingt der Abruf, ersetzt er die Liste dieses Laufs (nur im Lauf, nicht im Repo). Scheitert er, bleibt die OCR Liste vom Bazzite. Die Wache prüft weiter die Frische der OCR Datei und überwacht damit den Rückfall. Seit dem 04.11.2026 kennt sie die Quelle des Laufs (Ausgabe `bestenliste_quelle` des Jobs `bauen`): Hat die API geliefert, ist eine alte OCR Datei nur eine Warnung, rot wird der Lauf erst, wenn die Seite die alte OCR Liste zeigt. Der erste Lauf nach dem Merge zeigt, ob die Runner IPs angenommen werden; wenn nicht, holt der Bazzite die API Liste als Sicherung.
