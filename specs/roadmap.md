# Roadmap Letacios Fiesta

Stand 24.10.2026. Ausführlich in `docs/uebergabe.md`.

## Erledigt

* EB05 Queue: Sätze „EB05 Queue“ und „EB05 Heroines Event“, fehlende Kartenbilder aus
  dem Sim (`specs/features/eb05-queue.md`). Rangliste und Replays gestrichen.
* Ladder per Bildschirmfoto und OCR vom Bazzite, mit Plausibilitätsschutz (PR 2).
* Zähler zeigen sofort den Endwert (PR 3).
* EB05 Heroines Event: alle Winrates nur gegen Event Leader (PR 5).

## In Arbeit und in Planung

* Kartenquelle tcgcsv mit Kaizoku als Ersatz (`specs/features/kartenquelle-tcgcsv.md`),
  freigegeben, Bau in neuer Sitzung.
* Zuordnung der user_id über die Leaderzahl (`specs/features/zuordnung-leaderzahl.md`).

## Später, nur auf Wunsch

* Signalfarben im Ladder ohne Partienzahl, Kartenleiste am Handy, gleichnamige Leader.

## Rückblick 24.10.2026

1. Gut: erst messen, dann bauen. Die Notice als Ursache war nach einem Blick auf die Fotos klar.
2. Falsche Annahmen: der Merge von PR 1 baut nicht (paths ignore), und rAF im verborgenen
   Pane steht still, obwohl `document.hidden` false meldet.
3. Besser spezifizieren: bei jeder neuen Spielversion vorher klären, wer die Notice wegklickt.
