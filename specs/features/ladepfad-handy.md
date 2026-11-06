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
- [x] Im Netzwerkverlauf starten `schluessel.json`, `verzeichnis`, `karten` und der Startsatz, bevor `index.js` fertig geladen ist (Lighthouse Abhängigkeitsbaum, Produktionsbuild).
- [x] `index.js` für Decklists höchstens 85 KB gz; Replay, Analyze, Changelog und Book laden eigene Chunks erst beim Öffnen.
- [ ] Decklists Handy: LCP unter 2,5 s und mindestens 90 Punkte (Median aus drei Läufen, lokale Vorschaudaten). Nicht erreicht: 85 Punkte, LCP 4,4 s, siehe Ergebnis.
- [ ] Decklists Rechner bleibt bei mindestens 99 Punkten, Leaderboard Handy bei mindestens 97 und Rechner bei 100; CLS überall unter 0,1. Rechner 99 und 100, CLS 0; Leaderboard Handy schwankt 93 bis 100.
- [x] Mit Verschlüsselung (Build mit `SEITEN_PASSWORT`, lokal entsperrt) lädt Decklists korrekt, der Vorabruf greift, ein falsches oder fehlendes `start` Feld führt nur zum normalen Abruf.
- [ ] Replayviewer, Analyze, Changelog und Book sehen und verhalten sich wie vorher (Probe im Browser an beiden Größen); ein fehlgeschlagener Chunk zeigt die vorhandene Fehlergrenze des Reiters. Teilweise: Inhalt im Browser geprüft, nur am Rechner; Brett mit echtem Replay und Handygröße offen; die Fehlergrenze griff beim fehlenden Import (behoben).
- [x] Einzug sieht aus wie vorher, mit `prefers-reduced-motion` ohne Bewegung; Zähler zeigen den richtigen Endwert.
- [x] `npm test` und `npx vite build` grün.

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
- Feld `start` offen in `schluessel.json`: einverstanden? Entschieden am 06.11.2026: ja, offen. PBKDF2 im HTML: nein, erst messen. Spec freigegeben.

## Ergebnis 06.11.2026
Lighthouse 13.6 auf dem Produktionsbuild mit den lokalen Vorschaudaten, Decklists am Handy je drei Läufe:

| Stand | Leistung | FCP | LCP | `index.js` gz |
|---|---|---|---|---|
| Vorher | 86 | 1,7 s | 4,1 s | 130 KB |
| Phase 1 Vorabruf | 85 bis 86 | 1,7 s | 4,1 bis 4,2 s | 130 KB |
| Phase 2 Spielerdatei später | 86 | 1,7 s | 4,1 s | 130 KB |
| Phase 3 Code Splitting, gsap per `import()` | 85 bis 87 | 0,9 s | 4,1 bis 4,4 s | 73 KB |

Übrige Seiten zum Schluss: Decklists Rechner 99 (LCP 0,9 s), Leaderboard Rechner 100, Leaderboard Handy schwankt zwischen 93 und 100 (zwei Läufe), CLS überall 0. Gewicht Decklists Handy 0,56 MB.

Umgesetzt:
- `src/vorab.js`, eingebettet in index.html durch `vite.vorab.js`: holt `schluessel.json`, Verzeichnis, Karten und auf Seiten mit Satz den Startsatz, während das JS lädt. `holen` und `verschluesselung` in `src/daten.js` nehmen die Antwort einmal ab. Ohne gemerktes Passwort holt der Vorabruf nur `schluessel.json`. Auf Leaderboard, Spieler, Replay, Guide, Analyze und Changelog holt er keinen Satz; mit Satz fiel das Leaderboard am Handy auf 95.
- `verschluesseln.py` schreibt `start` (die Satzdatei des Verzeichnisstarts) offen in `schluessel.json`.
- `spieler.json.gz` startet auf Decklists erst nach dem Satz.
- `src/Selten.jsx`: Replay, Analyze (Mulligan), Book (Guide), Changelog und eigenes Replay, unverändert aus `App.jsx` verschoben, per `React.lazy` geladen (30 KB gz eigener Chunk). `App.jsx` exportiert dafür 13 kleine Helfer.
- Einzug mit Web Animations statt gsap (gleiche Werte, neu mit `prefers-reduced-motion` ohne Bewegung). Startdeckkraft 0,01 statt 0: bei 0 zählte Chrome das LCP erst nach dem Ende der Animation (beobachtet 0,73 s statt 0,13 s). Die Zähler laden gsap per `import()` beim ersten Wechsel.

Geprüft im Browser: Decklists lädt `Selten` nicht; Changelog, Mulligan, Guide, Analyze und Replay laden den Chunk und zeigen ihren Inhalt; ein Leaderwechsel lädt gsap und endet auf dem richtigen Wert. Ein echtes Replay war mangels Replaydatei in den Vorschaudaten nicht zu sehen, nur die Meldung des Viewers. Verschlüsselt: mit einem testweise per Node verschlüsselten Build (gleiches Verfahren wie `verschluesseln.py`, das lokal mangels `cryptography` nicht läuft) zeigt die Seite ohne Passwort die Anmeldung und holt nur `schluessel.json`; mit Passwort starten Verzeichnis, Karten und Satz als `.enc` nach 27 bis 30 ms und die Seite steht.

Warum das Handy nicht unter 2,5 s kommt: beobachtet steht das Leaderbild nach 0,13 s. Die Simulation von Lighthouse (1,6 Mbit/s, vierfach gedrosselte CPU) rechnet aber mit allen Bytes, die vor dem Bild über die Leitung gehen. Seit Phase 1 laufen Daten und JS gleichzeitig und teilen sich die Leitung; der Engpass ist jetzt die Menge, allen voran der Satz mit 161 KB. Das Leaderbild hängt am Satz, weil erst der Satz sagt, welcher Leader oben steht. Gewonnen sind FCP (1,7 auf 0,9 s) und 57 KB weniger JS für jeden Reiter.

Nächster Hebel (nicht gebaut, Entscheidung offen):
- Das Leaderbild vor dem Satz zeigen, wenn die Adresse `?leader=` trägt, oder den zuletzt gewählten Leader merken. Dann hängt das LCP nicht mehr am Satz.
- Ein kleiner Kopfteil des Satzes (Leaderliste mit Kennzahlen) als eigene Datei vor dem vollen Satz. Umbau in `aktualisieren.py`.

## Rückblick
1. Gut: nach jeder Phase messen. So fiel auf, dass der Vorabruf allein nichts an der Punktzahl ändert und dass der Satz das Leaderboard bremste.
2. Falsche Annahme: weniger Wartezeit in der Kette heißt besseres LCP. Die Simulation ist bandbreitengebunden, parallel ist dort kaum schneller als nacheinander. Und Deckkraft 0 im Einzug verschiebt das LCP, sobald die Animation auf dem Compositor läuft.
3. Besser spezifizieren: ein Ziel in Punkten von Lighthouse braucht vorher eine Rechnung, wie viele Bytes vor dem LCP Element liegen dürfen.
