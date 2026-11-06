## Goal
Lange Zeiträume und laufende Replays sollen am Handy flüssig bleiben und den Tab nicht mehr wegen Speicher abstürzen lassen. Grundlage sind die Punkte P2-7 und P2-8 aus dem Impeccable Audit vom 06.11.2026 (`docs/audit-2026-11-06.md`).

## Scope
In scope:
- P2-7: Das Ereignisprotokoll im Replay (`r-log` in `Replay`, `src/App.jsx`) wird nur gebaut, solange es offen ist. Heute entstehen bei jedem Schritt, auch beim Abspielen mit 4x (alle 175 ms), Hunderte Knöpfe in einer versteckten Liste.
- P2-8: Ein Zeitraum lädt die Tagesdateien nicht mehr alle auf einmal in den Speicher. Statt `Promise.all` und einem großen `verschmelzen` am Ende werden die Tage in kleinen Gruppen geholt und laufend in einen Zwischenstand eingerechnet. Die geparsten Tagesdateien bleiben danach nicht im Zwischenspeicher; gemerkt wird nur der fertige Satz des zuletzt gewählten Zeitraums. Die gepackten Dateien hält weiter der Browser Cache (`cache: "default"` für `tage/`).
- Tests in `tests/daten.test.js`: das schrittweise Einrechnen liefert genau denselben Satz wie das bisherige `verschmelzen` über alle Tage.

Out of scope:
- Ein Web Worker zum Entpacken und Parsen. Er würde den Hauptthread frei halten, ist aber deutlich mehr Umbau.
- Die Voreinstellung 30d zu streichen oder zu kappen. Sie bleibt.
- Alle anderen Punkte aus dem Audit, auch P3, und `lf.pw`.
- Neues Design und neue Texte.

## Acceptance criteria
- [x] Bei geschlossenem Ereignisprotokoll enthält `.r-log` keine Ereignisknöpfe. Öffnen zeigt die Liste mit dem aktuellen Schritt markiert und sichtbar, wie bisher.
- [x] Beim Abspielen mit 4x bleibt die Zahl der DOM Knoten im Replay konstant (geprüft per `document.querySelectorAll("*").length` vor und nach 20 Schritten).
- [x] Ein Zeitraum über alle vorhandenen Tage ergibt denselben Satz wie vorher: gleiche Partienzahl, gleiche Leader mit gleichen Werten (Test mit Fixtures).
- [x] Nach dem Laden eines Zeitraums liegen keine geparsten `tage/` Dateien mehr im Zwischenspeicher von `holen` (Test).
- [x] Höchstens drei Tagesdateien werden gleichzeitig geholt (Test mit vorgetäuschtem fetch).
- [x] Ein fehlender Tag im Zeitraum führt wie bisher zur Fehlermeldung aus der Härten Spec, nicht zu einem halben Satz.
- [x] Ein schneller Wechsel des Zeitraums während des Ladens zeigt am Ende den zuletzt gewählten Zeitraum.
- [x] `npm test` und `npx vite build` laufen grün; Decklists, Matrix und Rankings zeigen bei 7 Tagen in der Vorschau dieselben Zahlen wie vor dem Umbau.

## Implementation plan
Phase 1 (Replay Log): Liste nur bei `logOffen` rendern, Scrolleffekt prüfen, Messung im Browser.
Phase 2 (Zeitraum): in `src/daten.js` ein `zeitraumLaden`, das in Gruppen zu drei holt, je Gruppe mit dem Zwischenstand verschmilzt und die Tagesdateien danach aus dem Zwischenspeicher nimmt. Ein Merker für den letzten fertigen Zeitraum. Tests.
Phase 3: lokale Prüfung aller Kriterien in der Vorschau (`.impeccable/review/vite.haerten.mjs`, Port 5182), Commit auf `claude/optimieren`, PR nach deinem OK.

Tradeoffs: Gruppen zu drei laden etwas langsamer als alle 30 auf einmal, dafür liegen höchstens drei geparste Tage plus Zwischenstand im Speicher statt 30 (laut Kopf von `daten.js` etwa 4,8 MB JSON je Tag). Ein Wechsel zurück auf einen früheren Zeitraum parst die Tage neu, lädt sie aber aus dem Browser Cache statt aus dem Netz.

## Open questions
- Lokal liegen nur alte, kleine Tagesdateien (12 Stück, 668 KB). Den Speichergewinn bei echten 30 Tagen kann ich daher nur rechnerisch belegen, nicht messen. Reicht dir das?

## Ergebnis 06.11.2026
Offene Frage beantwortet mit „Freigeben, loslegen“: Der Speichergewinn bei 30 Tagen ist rechnerisch belegt (höchstens drei geparste Tage plus Zwischenstand statt aller). Geprüft auf den 12 echten lokalen Tagesdateien: Ergebnis identisch mit `verschmelzen` (39.291 Partien, 97 Leader, 14.312 Listen), danach kein Tag mehr im Zwischenspeicher. Replay mit 200 Ereignissen bei 4x: 22 Schritte, DOM konstant bei 533 Knoten.
