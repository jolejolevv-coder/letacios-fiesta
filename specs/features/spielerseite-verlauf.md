# Spielerseite: Bountyverlauf und Niederlagen nach Gegnerdeck

Status: Entwurf, wartet auf Freigabe. Nichts gebaut.

## Goal

Die Spielerseite zeigt, wie sich der Bounty eines Spielers entwickelt hat und gegen welche Decks er verliert, damit man seine Schwächen und seine Form auf einen Blick sieht.

## Scope

- In scope:
  - Bountyverlauf als Kurve, tagesgenau, für die Top 100.
  - Abschnitt "Verloren gegen": die verlorenen Partien des Spielers, gruppiert nach Leader des Gegners, mit Anzahl, Anteil an allen Niederlagen, Siegquote gegen diesen Leader und Link auf das Replay, wo eins vorliegt.
  - Hinweis zur Abdeckung ("N von M Partien bekannt"), weil Spielerdaten nur die letzten Partien tragen.
- Out of scope:
  - Spieler außerhalb der Top 100.
  - Rangverlauf, Serien, Siegquote über die Zeit (später möglich, die Tagesdatei trägt den Rang schon mit).
  - Namen oder Land von Gegnern anzeigen. Gegner erscheinen nur als Leader.
  - Eine öffentliche, unverschlüsselte Datei. Die Daten bleiben wie alle Spielerdaten verschlüsselt.

## Quellen und Befunde

* **Niederlagen:** `spieler.json.gz` trägt je Partie `gewonnen`, `gegner_leader`, `eigener_leader`, `deck`, `replay`, `zeit`, `dauer`. Das reicht für "Verloren gegen" ohne neue Abrufe. Heute: 794 Partien bei 88 Spielern, 235 Replays.
* **Deck des Gegners:** Das Feld `deck` ist die Liste des Spielers, nicht die des Gegners. "Gegen welche Decks" heißt deshalb zunächst **Leader des Gegners**. Die Liste des Gegners steht nur im Replay Log und wäre ein zweiter Schritt (siehe offene Fragen).
* **Bountyverlauf:** Die Web API liefert nur den Stand von jetzt. Einen Verlaufsabruf kenne ich nicht; ob es einen gibt, klärt Phase 0. Ohne ihn müssen wir selbst sammeln: jeden Tag nach dem Abruf der Top 100 (`bestenliste_api.py`) ein Punkt je Spieler (`user_id`, Tag, Bounty, Rang). Erst nach ein paar Wochen sieht die Kurve nach etwas aus. Vorher zeigt die Seite "Verlauf wird seit TT.MM. aufgezeichnet".
* **Wohin mit der Sammlung:** Die Action legt heute nichts ins Repo, außer nachgezogenen Spielversionen. Eine wachsende Datei braucht einen Speicherort, der den Lauf überlebt. Vorschlag: `public/bountyverlauf.json.gz.enc` im Repo, die Action hängt täglich einen Tag an und committet (wie bei `version_nachziehen.py`, Recht `contents: write` ist da). Das Repo ist öffentlich, deshalb nur verschlüsselt, gleiche Regel wie bei der Bestenliste. Größe: 100 Spieler mal 365 Tage mal etwa 12 Byte, gepackt unter 200 KB im Jahr.

## Acceptance criteria

- [ ] Jeder Lauf der Action hängt für jeden Spieler der Top 100 einen Punkt (Tag, Bounty, Rang) an die verschlüsselte Verlaufsdatei, höchstens einen je Tag und Spieler, auch bei zwei Läufen am Tag.
- [ ] Fällt der Abruf aus, entsteht kein Loch durch Nullwerte: der Tag fehlt einfach.
- [ ] Ein Spieler, der aus den Top 100 fällt, behält seine bisherigen Punkte; sie wachsen erst wieder, wenn er zurückkehrt.
- [ ] Die Datei liegt nur verschlüsselt im Repo und in den Logs stehen nur Zahlen, keine Namen.
- [ ] Die Spielerseite zeigt die Kurve mit Achsenbeschriftung (Datum, Bounty), Tooltip je Punkt und bei weniger als 3 Punkten den Hinweis statt einer leeren Kurve.
- [ ] Der Abschnitt "Verloren gegen" listet Leader des Gegners absteigend nach Niederlagen, je Zeile: Leader mit Bild, Niederlagen, Anteil, Siegquote des Spielers gegen diesen Leader (Siege/Partien), Replaylink falls vorhanden.
- [ ] Die Abdeckungszeile nennt, wie viele Partien der Auswertung zugrunde liegen, und dass es nur die zuletzt aufgezeichneten sind.
- [ ] Bei Spielern ohne Daten oder ohne Niederlagen erscheint ein erklärender Leerzustand.
- [ ] Tests: Anhängen (Tag doppelt, Lücke, Spieler fällt raus), Gruppierung nach Gegnerleader (Zählung, Anteil, Quote, Spieler ohne Niederlage), Rendern mit 0, 1 und vielen Punkten.
- [ ] WAF Kurzprüfung entfällt, es ist ein Hobbyprojekt; Rechtefrage (Datenquelle, Datenschutz) ist im Scope geklärt.

## Implementation plan

Phase 0: API prüfen. Gibt es einen Endpunkt für den Verlauf eines Spielers (zum Beispiel unter `/api/player/<id>`)? Nur lesende Probeaufrufe mit demselben Sitzungstoken, nichts speichern, Ergebnis ins Spec. Gibt es ihn, entfällt die eigene Sammlung und damit die Wartezeit.
Phase 1: "Verloren gegen" aus den vorhandenen Daten. Reine Auswertung im Frontend (`src/`), kein neuer Abruf, sofort sichtbar.
Phase 2: Sammlung des Bountys, falls Phase 0 keinen Endpunkt findet: Schritt in der Action nach dem Abruf der Top 100, Datei `bountyverlauf.json.gz.enc`, Commit durch die Action, Tests.
Phase 3: Kurve auf der Spielerseite, Leerzustand, Design nach den Regeln des Replay Gefühls (`replay-gefuehl.md`) nur dort, wo es passt.
Phase 4: Abnahme, Changelog, Übergabe.

## Open questions

- Reicht "Leader des Gegners", oder willst du die Liste des Gegners (aus dem Replay Log, nur wo ein Replay vorliegt)? Das deckt nur etwa ein Drittel der Partien ab.
- Bounty Verlauf nur ab jetzt sammeln, oder aus alten Daten nachträglich füllen? Die alten OCR Listen im Repo sind nur verschlüsselt und nicht archiviert; nachfüllen ist also nicht möglich.
- Kurve mit Tagesstand oder mit dem Stand nach jeder Partie? Letzteres geht nur über die bekannten Partien (`bounty` je Partie ist im Schnappschuss nicht enthalten, Phase 0 prüft das).
