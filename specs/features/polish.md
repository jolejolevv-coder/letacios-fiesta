## Goal
Ein letzter Feinschliff nach Härten und Optimieren: was am Handy abgeschnitten, zu klein oder verspätet ist, wird gerichtet, und die Schriftgrößen rücken zurück auf die Skala aus `DESIGN.md`, ohne das Aussehen von Fiesta zu ändern.

## Befund 06.11.2026
Geprüft in der lokalen Vorschau (`.impeccable/review/vite.polish.mjs`, Port 5183) auf allen neun Reitern, am Rechner und bei 375 px. Kein Reiter scrollt seitlich, alle Bedienelemente haben einen Namen, alle Bilder einen alt Text.

1. **Bounty abgeschnitten (Leaderboard, Handy).** Die Punktzahl rechts braucht 61 px und bekommt 60 px. Aus „9,611.0“ wird sichtbar „9,611.“. Das ist eine falsche Zahl auf dem Schirm.
2. **Touchziele unter 44 px (Handy).** Härten hat Knöpfe, Felder und Schalter auf 44 px gebracht. Übrig sind: das Suchfeld im Kopf (`.suche-knopf`, 34 px), der Quellenchip (`.quelle-chip`, 34 px), der Sombrero als Link (`.marke`, 16 px hoch), die Spielernamen im Leaderboard (19 px hoch) und der Kartenknopf im Mulligan (`.kb-knopf`, 26 × 36 px).
3. **Lücke beim Aufbau (Handy).** Zwei Sekunden nach dem Öffnen von Decklists und Matchups steht oben ein etwa 80 px hohes leeres Feld, der Leaderblock erscheint erst danach. Ursache noch offen: Einblendung oder Laden.
4. **Schriftgrößen neben der Skala.** `src/index.css` nutzt neben den Stufen aus `DESIGN.md` (25, 16, 14.5, 13.5, 13, 12.5, 11.5, 11, 18) auch 14 px (23 Stellen), 15 px (13), 15.5 px (5), 12 px (7) und 10.5 px (1). Zusammen sind das 49 Stellen, die je nach Rolle verschieden aussehen.

Bewusst nicht im Befund: die Kartenfarben in `src/leaderfarben.js` (feste Datenpalette, gewollt), die Matrixköpfe mit 36 px (eigene Scrollfläche, größer würde die Matrix sprengen) und die freigestellten Werte in `.impeccable/config.json`.

## Scope
In scope:
- Punkte 1 bis 4 aus dem Befund.
- Ein Durchlauf des Impeccable Detektors über die geänderten Dateien.

Out of scope:
- Neue Farben, neue Texte, neue Komponenten, neue Animationen.
- Die Matrixköpfe, die Kartenfarben, `lf.pw`.
- Alles, was das Aussehen am Rechner sichtbar verändert, außer den kleinen Größenverschiebungen aus Punkt 4.

## Acceptance criteria
- [x] Im Leaderboard steht bei 375 px jede Bounty vollständig (geprüft: `scrollWidth <= clientWidth` für alle `.bounty`).
- [x] Bei 375 px sind Suchfeld, Quellenchip, Sombrero, Spielernamen im Leaderboard und Kartenknopf im Mulligan mindestens 44 px hoch (oder haben eine Trefferfläche dieser Größe); keine Seite scrollt seitlich.
- [x] Am Handy zeigt Decklists und Matchups nach dem Öffnen keine leere Fläche über den Kennzahlen, sobald die Daten da sind.
- [x] `src/index.css` nutzt nur noch Größen aus der Skala oder freigestellte Werte; jede Verschiebung folgt der Rolle (Body 14.5, Bedienung 13.5, Klein 13, Zahl 12.5, Etikett 11.5). `DESIGN.md` beschreibt danach, was gebaut ist.
- [x] Am Rechner sehen Decklists, Matchups, Rankings, Leaderboard und Guide vorher und nachher gleich aus, bis auf die halben Pixel.
- [x] `npm test` und `npx vite build` grün, Detektor ohne neue Funde.

## Implementation plan
Phase 1: Bounty und Touchziele im Block `@media (max-width: 760px)` am Ende von `src/index.css`, Messung bei 375 px.
Phase 2: Ursache der Lücke finden und beheben (Einblendung früher starten oder Platz halten).
Phase 3: Schriftgrößen je Rolle auf die Skala ziehen, Abgleich in der Vorschau am Rechner und Handy, `DESIGN.md` nachziehen.
Phase 4: Detektor, Tests, Build, Commit auf `claude/polish`, PR nach deinem OK.

Tradeoffs: Größere Touchziele im Kopf machen die Kopfzeile am Handy etwa 10 px höher. Die Schriftgrößen zu vereinheitlichen verschiebt 49 Stellen um einen halben bis einen Pixel; das ist sauberer, aber eine breite Änderung, die man in jedem Reiter gegenprüfen muss.

## Open questions
- Punkt 4 (Schriftgrößen) mit rein oder als eigene Runde später? Beantwortet: mit rein.

## Ergebnis 06.11.2026
Freigegeben mit „Alle vier“. Geprüft in der Vorschau auf allen neun Reitern bei 375 px und am Rechner.

1. Bounty: Die Rechnerregel `.ladder.mit-zahlen.ohne-zeit .vorn` hat vier Klassen und schlug am Handy die Spalten. Die Handyregel setzt jetzt auch die Spalten. Alle 100 Bountys stehen vollständig.
2. Touchziele: Suchfeld 187 × 44, Quellenchip 96 × 44, Sombrero 44 × 44. Die Kartenbilder im Mulligan behalten 26 × 36 px, ihre Trefferfläche ist 44 px groß (nur im Mulligan, in den Kartenstreifen würden sich die Flächen überlappen). Die Spielernamen im Leaderboard bleiben klein: die ganze Zeile ist die Trefferfläche, ein Tipp in die Zeile öffnet die Spielerseite (geprüft).
3. Lücke: nicht nachstellbar. Der Leaderblock steht nach etwa 0,3 s da und hat keine Einblendung. Die leere Fläche aus dem Befund war ein Bildschirmfoto direkt nach dem Umschalten der Vorschau auf Handygröße. Keine Änderung.
4. Schriftgrößen: 81 Stellen auf die Skala gezogen (14 → 14.5 oder 13.5 für Zahlen, 15 → 14.5, 15.5 → 16, 12 → 11.5 oder 12.5 für Zahlen, 10.5 → 11). Detektor ohne Funde.

Annahme: Eingabefelder (`.feld`) stehen am Handy auf 16 px, die Palettensuche überall auf 16 px. Unter 16 px zoomt iOS beim Fokus heran. Das war nicht im Befund, gehört aber zu Punkt 4.
