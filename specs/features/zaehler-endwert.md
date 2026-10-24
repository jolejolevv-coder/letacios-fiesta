# Zähler zeigen sofort den richtigen Wert

Entwurf vom 24.10.2026, am selben Tag freigegeben (Animation beim Wechsel bleibt) und gebaut.

## Goal

Jede Zahl in der Kennzeile steht vom ersten Bild an richtig da. Sie zählt nur beim Wechsel
auf einen neuen Wert hoch, und gar nicht bei `prefers-reduced-motion` oder in einem
Hintergrund-Tab.

## Warum

`Zaehler` in `src/App.jsx` rendert zuerst „0“ und zählt dann per GSAP in 0,5 s zum Wert
hoch. GSAP läuft über `requestAnimationFrame`. In einem verborgenen Tab stand die
Kennzeile am 24.10.2026 über 3 Sekunden auf „0 % / 0 games“, mitten im Zählen einmal auf
42,0 % statt 53,4 %. Das verletzt das Produktprinzip „Die Zahl zuerst“. Die Kartenvorschau
beachtet reduzierte Bewegung schon, der Zähler nicht.

Der Zähler steckt in der Kennzeile der leaderbezogenen Reiter (Win rate, Games, Wins,
Losses, Going first, Going second, Lists) und auf der Spielerseite (Rank, Win rate,
Games).

## Scope

- In scope: `Zaehler` in `src/App.jsx`, ein kleines neues Modul `src/zaehler.js` mit der
  Formatierung und der Entscheidung „animieren oder nicht“, Tests in
  `tests/zaehler.test.js`, ein Satz in `DESIGN.md`, ein Eintrag in `src/changelog.js`.
- Out of scope: die Einzugsanimation beim ersten Aufbau, die anderen Fehler aus der
  Kritik (Ladderfarben, Kartenstreifen, gleichnamige Leader), neue Abhängigkeiten wie
  jsdom.

## Acceptance criteria

- [x] Beim ersten Aufbau steht der Endwert im Zähler, nie „0“, auch nicht für einen Frame.
- [x] Beim Wechsel des Leaders zählt die Zahl vom alten zum neuen Wert, 0,5 s wie bisher.
- [x] Mit `prefers-reduced-motion: reduce` springt die Zahl ohne Animation auf den Wert.
- [x] In einem verborgenen Tab (`document.hidden`) springt die Zahl ebenfalls sofort.
- [x] Steht `requestAnimationFrame` still, ohne dass `document.hidden` es meldet, steht der
      Endwert spätestens `NACHLAUF_MS` (150 ms) nach der Dauer. Beim Bauen im
      eingebetteten Browser gefunden: ohne diese Sicherung blieb die Zahl auf dem alten Wert.
- [x] Ein Wechsel mitten in einer laufenden Animation zählt vom gerade sichtbaren Wert
      weiter und endet auf dem neuen Wert.
- [x] Format unverändert: Tausenderpunkte nach `en-US`, Nachkommastellen und Suffix wie
      bisher („53.4 %“, „42,490“).
- [x] `npm test` und `npx vite build` laufen durch.
- [x] Am Handy (375 px) und am Desktop (1280 px) geprüft, Bildschirmfoto als Beleg.

## Implementation plan

Phase 1: `src/zaehler.js` mit `zahlText(n, nachkomma, suffix)` und
`animieren({ reduziert, versteckt, alt, neu })`, beide ohne DOM und mit Tests.

Phase 2: `Zaehler` umbauen. Der Span bekommt keinen eigenen Text von React. Ein
`useLayoutEffect` setzt beim ersten Aufbau den Endwert, bevor der Browser zeichnet. Bei
jedem Wechsel entscheidet `animieren()`: entweder GSAP vom sichtbaren Wert aus, oder den
Text direkt setzen. Jedes `onUpdate` merkt sich den sichtbaren Wert, ein Abbruch zählt von dort
weiter. Ein Timer setzt den Endwert, falls die Animation stehen bleibt.

Phase 3: Prüfen in der Review-Vorschau, `DESIGN.md` (Abschnitt Components) um einen Satz
ergänzen, Changelog-Eintrag auf Englisch.

## Open questions

- Keine. Die Animation beim Wechsel bleibt, freigegeben am 24.10.2026.
- Nicht im Browser nachgestellt: `prefers-reduced-motion`. Abgedeckt nur über den Test von
  `animieren()`.
