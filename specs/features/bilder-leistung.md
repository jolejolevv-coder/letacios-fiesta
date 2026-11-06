## Goal
Decklists soll am Handy schnell erscheinen und beim Laden nicht springen. Dafür laden die kleinen Kartenbilder wieder die eigenen 9 KB Dateien statt 290 KB vom CDN, das Leaderbild oben kommt zuerst, und die Fußzeile bleibt still.

## Befund 06.11.2026 (Lighthouse 13.6)
Gemessen auf einem Produktionsbuild mit den lokalen Vorschaudaten (`.impeccable/review/vite.polish.mjs`, `vite preview` auf Port 5184).

| Seite | Leistung | LCP | CLS | Gewicht |
|---|---|---|---|---|
| Decklists Handy | 71 | 26,3 s | 0,104 | 5,1 MB |
| Decklists Rechner | 56 | 6,3 s | 0,415 | 9,5 MB |
| Leaderboard Handy | 99 | 1,6 s | 0,001 | 5,1 MB |
| Leaderboard Rechner | 100 | 0,4 s | 0,004 | 7,9 MB |

Barrierefreiheit und Best Practices haben überall 100 Punkte. SEO fällt absichtlich ab (`noindex`, kein `robots.txt`).

1. **Kartenbilder.** Seit Commit `86d9454` (02.11.2026) holt `Bild` in `src/App.jsx` jedes Kartenbild zuerst als WebP mit 600 px von `static.dotgg.gg` (`bildpfadCdn`). Eines wiegt etwa 290 KB, gezeigt wird es mit 16 bis 36 px. Die eigenen JPGs in `public/img` haben 120 px und rund 9 KB. Sie sind nicht verschlüsselt (`verschluesseln.py` nimmt nur `*.json.gz`) und liegen offen auf GitHub Pages. Lighthouse schätzt 4,6 MB (Handy) bis 9 MB (Rechner) Ersparnis.
2. **LCP.** Das größte Element ist das Leaderbild hinter dem Titel (`img.kopf-bild`, 340 × 475 px, 26 % Deckkraft). Es hat wie alle Bilder `loading="lazy"` und wartet hinter den kleinen Bildern.
3. **CLS.** Am Rechner springt erst `.blatt` und dann `footer.fuss`, am Handy die Fußzeile. Die Fußzeile steht unter dem Inhalt und rutscht nach unten, sobald die Liste da ist. Den Sprung von `.blatt` am Rechner erkläre ich mit der Scrollleiste, die erst mit dem Inhalt erscheint und die zentrierte Seite seitlich verschiebt. Das ist eine Vermutung, ich prüfe sie in Phase 3.

## Scope
In scope:
- `Bild` in `src/App.jsx`: kleine Bilder zuerst aus `public/img`, das CDN nur noch als Rückfall, wenn die eigene Datei fehlt (`img/offen.txt`).
- Das Leaderbild `kopf-bild` lädt sofort und mit hoher Priorität (`loading="eager"`, `fetchpriority="high"`). Quelle nach Entscheidung (siehe Open questions).
- Fußzeile und Seitenrand: kein Sprung beim Laden (Platz halten für den Inhalt, `scrollbar-gutter: stable`).
- `preconnect` in `index.html` nur noch, wenn das CDN für das Leaderbild bleibt.
- Ein Test für die Reihenfolge der Bildquellen.

Out of scope:
- Die große Kartenvorschau (Metacoach Bilder) und das Replaybrett.
- Ein eigener Bildserver, neue Bildgrößen in `aktualisieren.py`, Caching Header (GitHub Pages lässt sie nicht setzen).
- Die übrigen Lighthouse Punkte: ungenutztes JS (65 KB), ungenutztes CSS (15 KB), Render Blocking (bis 290 ms).

## Acceptance criteria
- [x] Decklists lädt am Handy höchstens 1 MB, gemessen mit Lighthouse auf dem Produktionsbuild.
- [ ] LCP auf Decklists am Handy unter 2,5 s, am Rechner unter 1,2 s. (Rechner erreicht mit 0,8 s, Handy nicht: 4,1 s)
- [x] CLS auf Decklists an beiden Geräten unter 0,1.
- [ ] Leistung auf Decklists an beiden Geräten mindestens 90, Leaderboard bleibt bei mindestens 99. (Rechner 99, Handy 86; Leaderboard Handy schwankt 97 bis 99)
- [x] Fehlt ein eigenes Bild, erscheint es weiter vom CDN; fehlt es auch dort, steht der Platzhalter mit Kennung wie bisher (Test und Probe im Browser).
- [x] Die Kartenbilder sehen bei 16 bis 36 px so scharf aus wie vorher (Sichtprüfung am Retina Bildschirm, 120 px reicht bis 40 px bei 3x).
- [x] `npm test` und `npx vite build` grün.

## Implementation plan
Phase 1: Quellenreihenfolge in `Bild` umdrehen (eigene Datei, dann CDN, dann Platzhalter), Test dazu.
Phase 2: `kopf-bild` sofort und mit hoher Priorität laden, Quelle nach Entscheidung.
Phase 3: CLS: Ursache am Rechner mit dem Performance Panel bestätigen, dann `scrollbar-gutter: stable` und Platz für den Inhalt halten, damit die Fußzeile beim ersten Bild unter dem sichtbaren Bereich liegt.
Phase 4: Lighthouse erneut an beiden Geräten auf Decklists und Leaderboard, Ergebnis in die Spec, Commit auf eigenem Branch, PR nach deinem OK.

Tradeoffs: Die eigenen Bilder kommen von GitHub Pages statt von einem schnellen CDN. Je Bild ist die Leitung etwas langsamer, dafür sind die Bilder 30 Mal kleiner. Das Umdrehen des Rückfalls macht den Commit `86d9454` zum größten Teil rückgängig. Damals ging es um die Geschwindigkeit, die Größe wurde nicht gemessen.

## Open questions
- Leaderbild oben (340 × 475 px, 26 % Deckkraft, weich ausgeblendet): bleibt es scharf vom CDN (290 KB, ein Bild je Seite) oder kommt es aus der eigenen 120 px Datei (9 KB, sichtbar weicher)? Entschieden am 06.11.2026: CDN, scharf. Spec freigegeben. Nach der Messung am selben Tag umentschieden: eigene 120 px Datei.

## Ergebnis 06.11.2026
Lighthouse 13.6 auf dem Produktionsbuild, vorher und nachher:

| Seite | Leistung | LCP | CLS | Gewicht |
|---|---|---|---|---|
| Decklists Handy | 71 → 77 | 26,3 s → 6,3 s | 0,104 → 0,001 | 5,1 MB → 0,87 MB |
| Decklists Rechner | 56 → 95 | 6,3 s → 1,5 s | 0,415 → 0,002 | 9,5 MB → 1,0 MB |
| Leaderboard Handy | 99 → 99 | 1,6 s → 1,7 s | 0,001 → 0,001 | 5,1 MB → 0,56 MB |
| Leaderboard Rechner | 100 → 100 | 0,4 s → 0,4 s | 0,004 → 0,004 | 7,9 MB → 0,66 MB |

Umgesetzt: `bildQuellen` in `src/daten.js` legt die Reihenfolge fest (klein: eigene Datei, dann CDN; scharf: CDN, dann eigene Datei), `Bild` geht sie der Reihe nach durch und zeigt danach den Platzhalter. Scharf sind das Leaderbild und die Karten auf dem Replaybrett (dort unverändert). Das Leaderbild lädt mit `loading="eager"` und `fetchpriority="high"`. `html { scrollbar-gutter: stable }` und `.inhalt { min-height: 100vh }` (vorher 40vh) nehmen die Sprünge. Auf Decklists kamen 211 von 212 Bildern aus der eigenen Datei, nur das Leaderbild vom CDN.

Nicht erreicht:
- LCP am Handy unter 2,5 s und Leistung am Handy mindestens 90. Das LCP Element ist das scharfe Leaderbild (278 KB). Zur Probe mit der eigenen 120 px Datei: Handy 86 Punkte und LCP 4,1 s, Rechner 99 Punkte und LCP 0,9 s. Auch dann bleibt das Handy über 2,5 s, weil vor dem Bild das JS (130 KB) und der Satz (160 KB) laden. Beides ist out of scope.
- LCP am Rechner unter 1,2 s: 1,5 s mit dem CDN Bild, 0,9 s mit der eigenen Datei.

Rückfall auf das CDN: per Test geprüft (`bildQuellen`); im Browser fehlte auf Decklists kein eigenes Bild, ein echter Rückfall war also nicht zu sehen.

Tradeoff: Kurze Seiten (Changelog, Analyze) haben jetzt eine Bildschirmhöhe Platz vor der Fußzeile.

## Nachtrag 06.11.2026: Leaderbild aus eigener Datei
Nach dem Ergebnis oben hat der Nutzer entschieden, das Leaderbild aus der eigenen 120 px Datei zu laden. Damit braucht der erste Bildaufbau das CDN nicht mehr, und `preconnect` zu `static.dotgg.gg` ist aus `index.html` entfernt. Das CDN bleibt Rückfall und erste Quelle für das Replaybrett.

| Seite | Leistung | LCP | CLS | Gewicht |
|---|---|---|---|---|
| Decklists Handy | 86 | 4,1 s | 0,001 | 0,60 MB |
| Decklists Rechner | 99 | 0,8 s | 0,002 | 0,75 MB |
| Leaderboard Handy | 97 bis 99 | 1,7 bis 2,4 s | 0,001 | 0,56 MB |
| Leaderboard Rechner | 100 | 0,3 s | 0,004 | 0,66 MB |

Leaderboard am Handy schwankt zwischen zwei Läufen von 97 auf 99 Punkte, die Seite selbst ist unverändert. Erreicht ist jetzt auch LCP am Rechner unter 1,2 s. Offen bleiben LCP am Handy unter 2,5 s und mindestens 90 Punkte am Handy; dafür müssten JS (130 KB) und der Satz (160 KB) schneller da sein, das ist eine eigene Runde.
