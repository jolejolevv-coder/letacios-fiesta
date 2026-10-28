# Roadmap Letacios Fiesta

Stand 26.10.2026. Ausführlich in `docs/uebergabe.md`.

## Erledigt

* EB05 Queue: Sätze „EB05 Queue“ und „EB05 Heroines Event“, fehlende Kartenbilder aus
  dem Sim (`specs/features/eb05-queue.md`). Rangliste und Replays gestrichen.
* Ladder per Bildschirmfoto und OCR vom Bazzite, mit Plausibilitätsschutz (PR 2).
* Zähler zeigen sofort den Endwert (PR 3).
* EB05 Heroines Event: alle Winrates nur gegen Event Leader (PR 5). Seit 26.10. aus dem
  neuen Formatsatz.
* Format OP17 plus EB05 (`specs/features/format-op17-eb05.md`): Satz „OP17 + EB05 Standard“
  ab 27.10., OP17 als „format (old)“ (PR 7). Heroines Event aus dem neuen Satz (PR 8). Seit 28.10. aus Replays (PR 10).
* Update Notice auf dem Bazzite wird automatisch gesetzt (PR 10).

## In Arbeit und in Planung

* Selbstlauf (`specs/features/selbstlauf.md`): Phase 1 Formaterkennung gebaut (PR 11),
  Phase 2 tcgcsv Daten, Phase 3 Wachen und Event Ablauf, Phase 4 Meldungen.
* Kartenquelle tcgcsv (`specs/features/kartenquelle-tcgcsv.md`): Bilder live (PR 6),
  Daten aus tcgcsv mit Kaizoku als Ersatz offen.
* Zuordnung der user_id über die Leaderzahl (`specs/features/zuordnung-leaderzahl.md`).

## Später, nur auf Wunsch

* Signalfarben im Ladder ohne Partienzahl, Kartenleiste am Handy, gleichnamige Leader.

## Rückblick 24.10.2026

1. Gut: erst messen, dann bauen. Die Notice als Ursache war nach einem Blick auf die Fotos klar.
2. Falsche Annahmen: der Merge von PR 1 baut nicht (paths ignore), und rAF im verborgenen
   Pane steht still, obwohl `document.hidden` false meldet.
3. Besser spezifizieren: bei jeder neuen Spielversion vorher klären, wer die Notice wegklickt.
