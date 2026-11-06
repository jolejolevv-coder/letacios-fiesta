# Roadmap Letacios Fiesta

Stand 29.10.2026. Ausführlich in `docs/uebergabe.md`.

## Erledigt

* EB05 Queue: Sätze „EB05 Queue“ und „EB05 Heroines Event“, fehlende Kartenbilder aus
  dem Sim (`specs/features/eb05-queue.md`). Rangliste und Replays gestrichen.
* Ladder per Bildschirmfoto und OCR vom Bazzite, mit Plausibilitätsschutz (PR 2).
* Zähler zeigen sofort den Endwert (PR 3).
* EB05 Heroines Event: alle Winrates nur gegen Event Leader (PR 5). Seit 26.10. aus dem
  neuen Formatsatz.
* Format OP17 plus EB05 (`specs/features/format-op17-eb05.md`): Satz „OP17 + EB05 Standard“
  ab 27.10., OP17 als „format (old)“ (PR 7). Heroines Event aus dem neuen Satz (PR 8). Vom 28.10. bis 02.11. aus Replays (PR 10), seitdem nur aus CDN mode_0 ab 29.10. (`format-aus-cdn.md`).
* Update Notice auf dem Bazzite wird automatisch gesetzt (PR 10).
* Redesign „Werkzeug“ (`specs/features/redesign.md`): Linear / Raycast, Geist, ⌘K Leadersuche,
  untere Leiste am Handy. Auf Branch `claude/website-redesign-bc8edc`, wartet auf Push und Merge.
* Härten nach Audit (`specs/features/haerten.md`): Error Boundaries, Ladefehler mit Hülle,
  Adressen für Spieler und Replay, Entsperren mit Fehlerpfad, 44 px Touchziele. Gebaut auf
  `claude/haerten-5ddc19`, wartet auf Push und PR.

## In Arbeit und in Planung

* Selbstlauf (`specs/features/selbstlauf.md`): Phase 1 Formaterkennung gebaut (PR 11),
  Phase 2 tcgcsv Daten, Phase 3 Wachen und Event Ablauf, Phase 4 Meldungen.
* Kartenquelle tcgcsv (`specs/features/kartenquelle-tcgcsv.md`): Bilder live (PR 6),
  Daten aus tcgcsv mit Kaizoku als Ersatz offen.
* Update Log aus Discord (`specs/features/update-log.md`): Phase 1 gebaut, wartet auf Bot und
  Secrets des Nutzers (`docs/discord-bot-anleitung.md`).
* Zuordnung der user_id über die Leaderzahl (`specs/features/zuordnung-leaderzahl.md`).

## Später, nur auf Wunsch

* Signalfarben im Ladder ohne Partienzahl, Kartenleiste am Handy, gleichnamige Leader.

## Rückblick 24.10.2026

1. Gut: erst messen, dann bauen. Die Notice als Ursache war nach einem Blick auf die Fotos klar.
2. Falsche Annahmen: der Merge von PR 1 baut nicht (paths ignore), und rAF im verborgenen
   Pane steht still, obwohl `document.hidden` false meldet.
3. Besser spezifizieren: bei jeder neuen Spielversion vorher klären, wer die Notice wegklickt.

## Rückblick Redesign 02.11.2026

1. Gut: Vergleichsseite mit vier Richtungen vor der Spec, dann v0 am echten Code. Die Wahl war
   danach schnell, und Tokens mit alten Namen hielten alle Ansichten zusammen.
2. Falsche Annahmen: Geist Mono ist breiter als Saira, feste Spaltenbreiten brachen um
   (Leaderleiste, Anteil in Rankings). Der Browser Pane zeigt zudem alte Stände, wenn der
   Nutzer im selben Tab klickt.
3. Besser spezifizieren: bei einem Schriftwechsel vorher alle festen Breiten für Zahlen auflisten.

## Rückblick Härten 06.11.2026

1. Gut: Fehler per Cookie in einer eigenen Vorschau simulieren, ohne `src/` anzufassen.
2. Falsche Annahme: der Vite Server liefert für eine fehlende `schluessel.json` index.html mit
   200; die strengere Prüfung hätte `npm run dev` gebrochen. Fiel erst im Browser auf.
3. Besser spezifizieren: welche Antwort des Servers „keine Verschlüsselung“ heißt.

## Rückblick Optimieren 06.11.2026

1. Gut: `verschmelzen` als Sammler umgebaut statt eine zweite Rechnung zu schreiben; das Ergebnis ist dadurch beweisbar gleich.
2. Falsche Annahme: die Vorschau hatte keine Tagesdateien und keine Replays; beides musste erst durchgereicht werden.
3. Besser spezifizieren: welche lokalen Daten für eine Leistungsprüfung reichen.

## Rückblick Polish 06.11.2026

1. Gut: der Befund kam aus Messungen im DOM (Höhen, `scrollWidth`, Schriftgrößen je Reiter), nicht aus Bildern; daran ließ sich jedes Kriterium direkt prüfen.
2. Falsche Annahme: eine leere Fläche auf einem Bildschirmfoto direkt nach dem Umschalten auf Handygröße galt als Fehler der Seite. Beim Nachmessen war sie nicht da.
3. Besser spezifizieren: bei Trefferflächen über `::after` vorher klären, wo die Knöpfe dicht nebeneinander stehen.

## Rückblick Bilder und Leistung 06.11.2026

1. Gut: erst messen, dann die Bildquellen umdrehen. Das Gewicht fiel von 5,1 MB auf 0,6 MB, und die Messung zeigte gleich, dass das Leaderbild das LCP Element ist.
2. Falsche Annahme: das scharfe CDN Bild für das Leaderbild sei billig, weil es nur eines ist. Es kostete am Handy 22 Sekunden LCP.
3. Besser spezifizieren: bei einem Ziel für das LCP vorher festlegen, welches Element es sein soll.

## Rückblick Ladepfad am Handy 06.11.2026

Steht in `specs/features/ladepfad-handy.md`: messen nach jeder Phase half. Falsch war die Annahme, weniger Wartezeit hieße besseres LCP, denn die Simulation ist bandbreitengebunden. Ein Punkteziel braucht vorher eine Rechnung, wie viele Bytes vor dem LCP Element liegen dürfen.

## Rückblick Replaypfade 06.11.2026

1. Gut: im Spielpaket nachgesehen, wie der Client selbst sucht, statt den Hash zu erraten. Die Sammlung `Replays` war die fertige Antwort.
2. Falsche Annahme: was nicht geladen wird, liegt unter einem anderen Namen. Tatsächlich hat der Client die meisten Partien nie hochgeladen.
3. Besser spezifizieren: ein Ziel für die Trefferquote erst festlegen, wenn bekannt ist, wie viel überhaupt in Storage liegt.
