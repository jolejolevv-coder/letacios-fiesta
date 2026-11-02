# Kaizoku Daten wie optcg-data

Entwurf vom 02.11.2026, wartet auf Freigabe. Grundlage: `docs/recherche-github-tools.md`. Der Nutzer hat am 02.11.2026 die Regel "Kaizoku nicht über `card_data.json` hinaus" gelockert und will die Abrufe auf dieselbe Art wie `alexfrey317/optcg-data`.

## Goal

Statistik, Decklisten und Matchups von Card Kaizoku kommen zusätzlich zu unseren eigenen Zahlen auf die Seite, abgerufen mit denselben Adressen und derselben Höflichkeit wie im Vorbild.

## Scope

* In scope, Stufe A (statisch, ohne Konto und Spielerbezug): `manifest.json`, Tagesdateien `stats/stats_<SET>_y_p_<Datum>.json` und `stats/decklist_<SET>_y_p_<Datum>.json` von `cdn.cardkaizoku.com`.
* In scope, Stufe B: Wochenstände aus dem Manifest (`cardstats`, `leaderboard`, `matchuptech`, `hands`, `curve`).
* In scope, Stufe C (nur auf ausdrückliches Ok, weil einzelne Spieler abgefragt werden): `POST api.cardkaizoku.com/search`, `GET api.cardkaizoku.com/player-stats`.
* Out of scope: Scraping der Webseite, Umgehen von Grenzen, Weitergabe der Rohdateien.

## Vorgaben aus dem Vorbild

Ehrlicher Bot `User-Agent` mit Projektlink, `Accept: application/json`, `Accept-Encoding: gzip`, 0,4 Sekunden Abstand, höchstens vier parallele Abrufe, Wiederholung bei 429 und 5xx, nur neu holen, wenn sich das Datum im Manifest ändert, 404 bedeutet "noch nicht da".

## Acceptance criteria

- [ ] Stufe A läuft täglich, Rohdateien liegen im Cache der Action, nicht im Repo.
- [ ] Eine Seite oder ein Reiter zeigt die Kaizoku Zahlen sichtbar getrennt von unseren, mit Quellenhinweis und Stand.
- [ ] Fehlt das Datum im Manifest länger als zwei Tage, meldet die Action das und die Seite zeigt den alten Stand.
- [ ] Tests mit Fixtures.
- [ ] Stufen B und C erst nach eigener Freigabe.

## Implementation plan

Phase 1: Abrufmodul mit gemeinsamer HTTP Schicht (Kennung, Abstand, Wiederholung), Stufe A, Tests.
Phase 2: Anzeige (Reiter oder Spalte), Quellenhinweis.
Phase 3: Stufe B.
Phase 4: Stufe C nur nach Ok.

## Open questions

* Wohin damit auf der Seite: eigener Reiter, oder als Spalte in Decks und Matchups?
* Welche Datensätze (`op17_lw_p` oder ein anderer für unsere Ladder)? Das Vorbild nutzt `op17_lw_p`.
* Stufe C: ja oder nein?
