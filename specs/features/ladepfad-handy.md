## Goal
Decklists soll am Handy in unter 2,5 s stehen, indem die Daten nicht mehr hinter dem JS warten und das JS für den ersten Aufbau kleiner wird.

## Befund 06.11.2026 (Lighthouse 13.6, Stand nach `bilder-leistung.md`)
Decklists Handy: 86 Punkte, FCP 1,7 s, LCP 4,1 s, TBT 30 ms, CLS 0,001, 0,60 MB. Rechner: 99 Punkte, LCP 0,8 s.

Die Kette bis zum LCP Element (`img.kopf-bild`, das Leaderbild hinter dem Titel) läuft streng nacheinander:

1. HTML, dann `index.js` (130 KB gz, davon 67 KB beim ersten Aufbau ungenutzt) und `index.css` (19 KB, blockiert das Rendern 308 ms).
2. Erst wenn das JS läuft, startet `schluessel.json`. Danach `verzeichnis.json.gz`, und erst aus dem Verzeichnis kennt die Seite den Startsatz (`v.start`, heute `saetze/Stats_lw.json.gz`, 161 KB).
3. Gleichzeitig mit dem Satz laufen `karten.json.gz` (31 KB) und `spieler.json.gz` (48 KB). Die Spielerdatei braucht Decklists nur für „wer hat welche Liste gespielt“, sie teilt sich aber die Leitung mit dem Satz.
4. Erst mit dem Satz rendert die Bühne, dann lädt das Leaderbild (9 KB). Der Einzug per gsap blendet Kopf, Leiste und Bühne 0,45 s lang von Deckkraft 0 ein.

In der Produktion kommt noch das Entsperren dazu: PBKDF2 mit 200.000 Runden aus `lf.pw` und das Entschlüsseln jeder `.enc` Datei. Die lokale Messung zeigt das nicht; am Handy kostet die Ableitung geschätzt 0,2 bis 0,5 s, und sie liegt ebenfalls hinter dem JS.

Im Bundle liegen fest importiert und für Decklists unnötig: der Replayviewer (`replay.js`, `zuglager.js`, `wertnetz.js`, `spielbewertung.js`, `analyse.js`, zusammen rund 70 KB Quelltext), `book.js` (13 KB), `changelog.js` (8 KB) und gsap (72 KB roh, rund 28 KB gz), das nur der Einzug und die Zähler brauchen.

## Scope
In scope:
- **Vorabruf im HTML.** Ein kleines klassisches `<script>` in `index.html` (kein Modul, damit Vite es nicht ins Bundle zieht) holt `schluessel.json`, `verzeichnis`, `karten` und den Startsatz, während das JS noch lädt. Es legt nur die Antworten (Bytes) in `window` ab; `holen` in `src/daten.js` nimmt eine passende Antwort einmal ab und fällt sonst auf den normalen Abruf zurück. Entschlüsselt wird weiter im JS.
- **Startsatz ohne Verzeichnis.** Damit der Vorabruf den Satz kennt, ohne das verschlüsselte Verzeichnis zu lesen, schreibt `verschluesseln.py` den Dateinamen des Startsatzes offen in `schluessel.json` (Feld `start`). Lokal ohne Verschlüsselung liest der Vorabruf ihn aus dem Verzeichnis.
- **Spielerdatei später.** `spieler.json.gz` startet auf Decklists erst, wenn der Satz da ist. Auf der Spielerseite bleibt es wie heute.
- **Code Splitting.** Replayviewer, Analyze, Changelog und Book als eigene Chunks per `React.lazy` und `import()`, mit dem vorhandenen Ladezustand als Ersatz. Dafür wandern die betroffenen Komponenten aus `src/App.jsx` in eigene Dateien, ohne sie inhaltlich zu ändern.
- **gsap aus dem ersten Aufbau.** Der Einzug wird eine CSS Animation (gleiche Bewegung: 14 px, 0,45 s, Versatz 0,07 s, `prefers-reduced-motion` wie bisher). Die Zähler laden gsap per `import()` nach und zeigen bis dahin den Endwert.
- Tests für den Vorabruf in `holen` (Treffer, kein Treffer, Fehlschlag fällt auf normalen Abruf zurück) und für `verschluesseln.py` (Feld `start`).
- Messung mit Lighthouse vorher und nachher, Ergebnis in diese Spec.

Out of scope:
- Kritisches CSS inline und das Aufteilen von `index.css` (Render Blocking 308 ms). Lohnt erst, wenn der Rest sitzt.
- Kleinere Satzdateien (anderes Format, Aufteilen nach Leader). Das wäre ein Umbau in `aktualisieren.py`.
- Die Schlüsselableitung schon im HTML Skript starten. Spart am Handy die PBKDF2 Zeit, verdoppelt aber den Kryptocode; siehe Open questions.
- Service Worker, Caching Header (GitHub Pages lässt sie nicht setzen), `lf.pw` in localStorage.

## Acceptance criteria
- [ ] Im Netzwerkverlauf starten `schluessel.json`, `verzeichnis`, `karten` und der Startsatz, bevor `index.js` fertig geladen ist (Lighthouse Abhängigkeitsbaum, Produktionsbuild).
- [ ] `index.js` für Decklists höchstens 85 KB gz; Replay, Analyze, Changelog und Book laden eigene Chunks erst beim Öffnen.
- [ ] Decklists Handy: LCP unter 2,5 s und mindestens 90 Punkte (Median aus drei Läufen, lokale Vorschaudaten).
- [ ] Decklists Rechner bleibt bei mindestens 99 Punkten, Leaderboard Handy bei mindestens 97 und Rechner bei 100; CLS überall unter 0,1.
- [ ] Mit Verschlüsselung (Build mit `SEITEN_PASSWORT`, lokal entsperrt) lädt Decklists korrekt, der Vorabruf greift, ein falsches oder fehlendes `start` Feld führt nur zum normalen Abruf.
- [ ] Replayviewer, Analyze, Changelog und Book sehen und verhalten sich wie vorher (Probe im Browser an beiden Größen); ein fehlgeschlagener Chunk zeigt die vorhandene Fehlergrenze des Reiters.
- [ ] Einzug sieht aus wie vorher, mit `prefers-reduced-motion` ohne Bewegung; Zähler zeigen den richtigen Endwert.
- [ ] `npm test` und `npx vite build` grün.

## Implementation plan
Phase 1: Vorabruf. Skript in `index.html`, Abnahme in `holen`, Feld `start` in `verschluesseln.py`, Tests. Messung.
Phase 2: Spielerdatei auf Decklists nach dem Satz. Messung.
Phase 3: Code Splitting der vier seltenen Reiter, gsap per `import()`, Einzug in CSS. Messung.
Phase 4: Probe mit Verschlüsselung, Lighthouse je drei Läufe an beiden Geräten, Ergebnis und Rückblick, Commit auf `claude/bilder-leistung` (Annahme, siehe unten), PR nach deinem OK.

Nach jeder Phase messe ich, damit klar ist, welcher Hebel was bringt. Bleibt das Handy nach Phase 3 über 2,5 s, schreibe ich das ehrlich ins Ergebnis und schlage den nächsten Hebel vor, statt weiterzubauen.

Tradeoffs:
- Der Vorabruf dupliziert die Dateinamen und die Basisadresse an einer zweiten Stelle (HTML). Ändert sich ein Name, lädt die Seite trotzdem, nur ohne Vorsprung. Ein Test prüft, dass beide Listen gleich sind.
- `start` offen in `schluessel.json` verrät den Namen der Startdatei. Die Dateinamen liegen im öffentlichen Repo ohnehin offen, der Inhalt bleibt verschlüsselt.
- Code Splitting heißt: der erste Klick auf Replay oder Analyze wartet einen Abruf länger (geschätzt 20 bis 40 KB gz). Dafür ist der erste Aufbau aller anderen Reiter schneller.
- Das Herauslösen der Komponenten aus `App.jsx` ist ein Umbau ohne neue Funktion. Ich verschiebe nur, ich ändere nichts daran.
- CSS statt gsap beim Einzug: eine Bibliothek weniger auf dem kritischen Pfad, aber zwei Arten Animation im Projekt.

Annahme: Die Arbeit baut auf `claude/bilder-leistung` auf (Leaderbild und Bildquellen sind die Grundlage der Messung) und landet auf demselben Branch, damit es ein PR bleibt.

## Open questions
- Soll das HTML Skript auch schon die Schlüsselableitung (PBKDF2 aus `lf.pw`) starten? Spart in der Produktion geschätzt 0,2 bis 0,5 s am Handy, braucht aber rund 30 Zeilen Kryptocode doppelt. Vorschlag: nein, erst messen.
- Feld `start` offen in `schluessel.json`: einverstanden?
