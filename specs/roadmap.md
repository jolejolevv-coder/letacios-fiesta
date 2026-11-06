# Roadmap Letacios Fiesta

Stand 06.11.2026. Ausführlich in `docs/uebergabe.md`. Frühere Erledigt Listen und Rückblicke
stehen in `docs/historie.md`.

## Erledigt (alle gemergt, PR 1 bis 32)

* Ladder per OCR, Zähler, EB05 Queue und Heroines Event, Format OP17 plus EB05 (PR 2 bis 10).
* Selbstlauf Phase 1 Formaterkennung (PR 11), Phase 2 Kartendaten aus Kaizoku und tcgcsv (PR 12),
  Formatsatz nur aus CDN (PR 16).
* Update Log aus Discord (PR 13, 14), Mitschnitt täglich (PR 15), Wache nach Quelle und stille
  Meldungen (PR 27).
* Redesign „Werkzeug“ und Signatur (PR 17, 18, 23).
* Bestenliste aus der Web API (PR 19, 20), Kaizoku als Dataset (PR 22 bis 26).
* Spielerseite: KaizokuListe und Leader aus der Web API (PR 28, 29).
* Härten nach Audit mit Error Boundaries (PR 30) und Optimieren (PR 31).
* AGENTS.md und lokaler Issue Tracker (PR 32).

## In Arbeit

* Polish (`specs/features/polish.md` auf dem Branch): PR 33 offen.
* Bilder und Leistung (`specs/features/bilder-leistung.md`): Branch `claude/bilder-leistung`, lokal.
* Selbstlauf Phase 3 (Wachen, Event Ablauf) und Phase 4 (Meldungen), Stand offen.
* Update Log: Bot und Secrets beim Nutzer, Stand offen.

## Später, nur auf Wunsch

* Signalfarben im Ladder ohne Partienzahl, Kartenleiste am Handy, gleichnamige Leader.


## Rückblick Optimieren 06.11.2026

1. Gut: `verschmelzen` als Sammler umgebaut statt eine zweite Rechnung zu schreiben; das Ergebnis ist dadurch beweisbar gleich.
2. Falsche Annahme: die Vorschau hatte keine Tagesdateien und keine Replays; beides musste erst durchgereicht werden.
3. Besser spezifizieren: welche lokalen Daten für eine Leistungsprüfung reichen.
