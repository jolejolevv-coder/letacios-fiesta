# Formatsatz aus den Replays

Entwurf vom 28.10.2026, wartet auf Freigabe.

## Goal

„OP17 + EB05 Standard“ und das Heroines Event bekommen ihre Zahlen aus den Replays in
Firestore, weil OPBounty seine Statistik seit dem 26.10. nicht mehr veröffentlicht.

## Was gemessen ist (28.10.2026)

- OPBounty hat Rohdateien und fertige Sätze zuletzt am 26.10. um 18:28 UTC geschrieben.
  `files.json` und `regular/timestamps.json` stehen seitdem still, Dateien vom 27.10. gibt
  es auch außerhalb des Verzeichnisses nicht. Andere Pfade (`ranked/`, `eb05/`) antworten 403.
- Die Replays in Firestore (`Replays`, gelesen schon von `frische_partien.py`) laufen weiter.
  48 Stunden bis 28.10. früh: 13.252 Replays. Je Replay: `timestamp`, `game_mode`,
  `winner_leader`, `loser_leader`, `winner_deck`, `loser_deck`, `winner_bounty`,
  `loser_bounty`, `path` (Log im Storage), `week`.
- Anteil mit EB05 Karten, normale Queue (`game_mode` 0): 26.10. vormittags 1 %,
  nachmittags 30 %, 27.10. 57 bis 59 %, 28.10. früh 56 %. Rund 7.200 Partien am 27.10.
- Die EB05 Queue (`game_mode` 1) hat seit dem 27.10. nur noch 40 bis 45 Partien je halben
  Tag, EB05 Anteil 4 %. Laut Update Notice v2.7.7 läuft dort jetzt das alte Format.
- Zum Vergleich: OPBounty zählte in `mode_0` 11.000 bis 18.700 Partien am Tag. Die Replays
  sind also eine Teilmenge, gemessen etwa die Hälfte.

## Scope

In scope:
- Neue Funktion in `aktualisieren.py`: Replays von `game_mode` 0 ab `FORMAT_START`
  (27.10. 00:00 UTC) holen, mit der vorhandenen Abfrage aus `frische_partien.py`.
- Daraus einen Satz im selben Format wie heute bauen: je Leader Siege, Niederlagen, Gegner
  mit Partien und Siegen, Decklisten aus `winner_deck`/`loser_deck` mit Siegen und
  Niederlagen. Der Satz heißt wie bisher und hat denselben Schlüssel, die Seite ändert sich
  nicht.
- First und Second aus dem Log jedes Replays (wer anfängt), mit einem Zwischenspeicher je
  Replay im Cache der Action, damit jedes Log nur einmal geladen wird.
- Das Heroines Event wird wie heute aus diesem Satz gefiltert.
- Kommt OPBounty zurück, bleibt der Satz trotzdem bei den Replays, bis wir umstellen; ein
  Wechsel mitten in der Woche würde die Zahlen springen lassen.
- Der Satz sagt unter dem Namen, dass er aus Replays stammt („from replays“).
- Tests mit kleinen Beispielreplays, ohne Netz.

Out of scope:
- Starthände und Mulligan Werte. Die stehen nicht im Replay Dokument; aus den Logs ginge es,
  das wäre ein eigener Schritt.
- Häufigere Läufe der Action. Heute einmal am Tag plus nach jedem Push.
- Die Spielerseiten (`frische_partien.py`), sie bleiben wie sie sind.

## Acceptance criteria

- [ ] Nach dem nächsten Lauf stehen „OP17 + EB05 Standard“ und „EB05 Heroines Event“ auf
      der Seite, mit Partien ab dem 27.10.
- [ ] Partienzahl, Siege und Niederlagen stimmen mit einer Nachzählung der Replays überein.
- [ ] First und Second sind gefüllt, für jedes Replay, dessen Log lesbar ist.
- [ ] Fällt Firestore aus, bricht der Lauf nicht ab und schreibt `::warning::`.
- [ ] Python Tests, `npm test` und `npx vite build` laufen durch.

## Implementation plan

Phase 1: Replays holen und den Satz ohne First und Second bauen, live schalten.
Phase 2: First und Second aus den Logs, mit Zwischenspeicher.

## Tradeoffs

Die Replays decken nur etwa die Hälfte der Partien ab, die OPBounty zählt. Ob das eine
zufällige Hälfte ist, wissen wir nicht; die Bounty Verteilung prüfe ich beim Bau. Dafür
sind die Daten minutenfrisch und ab genau dem 27.10. sauber. Die Logs kosten je Lauf einige
tausend Abrufe beim ersten Mal, danach nur die neuen.

## Open questions

- Phase 2 (First und Second aus den Logs) gleich mitbauen oder erst Phase 1 live sehen?
  Vorschlag: Phase 1 sofort, Phase 2 direkt danach.
