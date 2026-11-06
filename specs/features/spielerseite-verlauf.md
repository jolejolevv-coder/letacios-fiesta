# Spielerseite: Bountyverlauf und Partien ohne Ergebnis

Stand 06.11.2026, freigegeben am 06.11.2026. Idee aus `alexfrey317/optcg-data` (nur Idee, kein Code).

## Ausgangslage
1. Das Profil in `PublicUsers/<id>.Western` führt `Graph.y`: die Bounty nach jeder Partie der
   Saison, älteste zuerst, ohne Zeitstempel (`Graph.x` ist nur 1, 2, 3 …). Rang 1 hatte am
   06.11. 96 Punkte bei 71 Siegen und 25 Niederlagen. `spieler_daten.py` holt das Profil,
   wirft das Feld aber weg.
2. Die Liste der letzten Partien zeigt auch Partien, die der Client nicht als Ergebnis wertet.
   Im Spielpaket (Anzeige einer Profilzeile) gilt: Farbe für Sieg oder Niederlage nur bei
   `mtch[14] >= MIN_MATCH_TIME` (60 s) oder bei einer Niederlage; einen Replay Knopf gibt es
   erst ab 15 s. Partien ohne Sieger (`selfdc` gegen `selfdc`, `unresolved`, `started`,
   `cancelled`) haben gar kein Ergebnis. Bei uns zählt jede davon als „L“. In den Top 100
   waren das am 06.11. 90 Partien ohne Sieger und 14 Siege unter 60 s, von 843.

## Goal
Die Spielerseite zeigt den Bountyverlauf der Saison und nur noch Partien, die der Client als
Ergebnis wertet.

## Scope
- In scope: `Graph.y` in `spieler.json.gz`; eine Verlaufskurve auf der Spielerseite;
  Partien ohne Sieger und Siege unter 60 s fallen aus der Liste.
- Out of scope: Bountyänderung je Partie, Archiv über Läufe, Profilzeitstempel, Hinweis auf
  den Saisonreset (alles Punkte 3 bis 6 der Analyse, offen); Leader raten.

## Acceptance criteria
- [x] `spieler_daten.py` speichert je Spieler `verlauf`: die Werte aus `Graph.y`, auf eine
      Nachkommastelle gerundet, nur Zahlen. Fehlt das Feld, fehlt `verlauf`; die Seite zeigt
      dann keine Kurve.
- [x] Die Spielerseite zeigt unter den Kennzahlen eine Kurve „Bounty this season“: x = Partie
      Nummer, y = Bounty, mit Start, Höchstwert und aktuellem Wert als Zahl. Ohne neue
      Bibliothek, als eigenes SVG. Bei 390 px Breite kein seitliches Scrollen.
- [x] Partien ohne Sieger und Siege unter 60 s stehen nicht mehr in „Recent games“. Eine
      Niederlage unter 60 s bleibt (wie im Client). Die Regel steht an einer Stelle
      (`spieler_daten.py`), mit Verweis auf das Spielpaket.
- [x] Auch `frische_partien.py` und das Lernen der Namen sehen nur die gewerteten Partien.
- [x] Python Tests für Verlauf und Filter, Node Test für die Kurvenpunkte; alle bestehenden
      Tests grün; `npm run build` grün.

## Ergebnis 06.11.2026
Probe gegen Firestore mit den Top 95: 930 Partien vorher, 842 nachher; alle 95 haben einen
Verlauf, der längste hat 1.124 Punkte. `spieler.json.gz` wächst dadurch von 31 auf 74 KB
gepackt; geladen wird die Datei nur in den Reitern Player und Decklists. Kurve bei 1280 und 390
px geprüft, kein seitliches Scrollen (`scrollWidth` 1265 und 375). Tests: Python 11 neu, Node
6 neu, 109 grün; `npm run build` grün.

## Nachtrag 06.11.2026: nur komplette Partien
Entscheidung des Nutzers nach dem Merge von PR 39: „Recent games“ zeigt nur Partien mit beiden
Leadern. Fehlt ein Deck, lief die Partie ohne Sim Sync (Handy oder „play anyway“); keine dieser
Partien hatte ein Replay. Gezählt am Lauf 42204105619: 830 Partien, 342 komplett, 10 Spieler
ohne sichtbare Partie, Median 2 je Spieler. Gefiltert wird nur in der Anzeige
(`src/partien.js`, Test `tests/partien.test.js`); die Daten bleiben vollständig, weil der Reiter
Decklists sie braucht. Unter der Liste steht, wie viele Partien ausgeblendet sind.
- [x] Nur Partien mit beiden Leadern sichtbar, Zahl der ausgeblendeten genannt; ohne sichtbare
      Partie ein eigener Satz statt „No recent games recorded“.

## Implementation plan
Phase 1, Daten: `verlauf_aus(west)` und `gewertet(zeile)` in `spieler_daten.py`, `holen()`
nutzt beide. Konstante `MIN_PARTIE_S = 60` mit Verweis. Tests.

Phase 2, Seite: `src/verlauf.js` rechnet aus den Werten die SVG Punkte (reine Funktion, Test),
`Verlauf` Komponente in `App.jsx` im Stil von DESIGN.md, eingebaut in `Spieler`. Prüfung bei
1280 und 390 px mit der lokalen Vorschau.

Phase 3: Doku (README Abschnitt Spielerseite, Übergabe), Branch, PR nach deinem OK.

Tradeoffs: `Graph.y` hat keine Zeitachse, die Kurve zeigt also Partien, nicht Tage. Ein Tag
mit 30 Partien und eine Woche Pause sehen gleich aus. Dafür ist sie vollständig und kostet keinen
Abruf. Das Profil schreibt nur der Client des Spielers; wer die App länger nicht öffnet, hat
eine ältere Kurve als seine Bounty in der Bestenliste. Den letzten Punkt gleichen wir nicht an.
Ausblenden statt neutral zeigen: der Client zeigt solche Partien grau; wir lassen sie weg,
weil die Liste ohnehin nur neun Partien hat und ein „L“ ohne Ergebnis irreführt.

## Open questions
- Keine. Annahme: die Kurve steht über „Leaders played“; die Größe (etwa 120 px hoch) wähle ich
  nach DESIGN.md.
