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
* Polish (PR 33), Bilder und Ladepfad am Handy (PR 35), Replaypfade aus Firestore (PR 36).

## In Arbeit

* Selbstlauf Phase 3 (Wachen, Event Ablauf) und Phase 4 (Meldungen), Stand offen.
* Update Log: Bot und Secrets beim Nutzer, Stand offen.

* Ingame Namen: Gedächtnis gebaut auf `pi/ingame-namen`, wartet auf Push (Spec `ingame-namen.md`).

## Später, nur auf Wunsch

* Signalfarben im Ladder ohne Partienzahl, Kartenleiste am Handy, gleichnamige Leader.


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

## Rückblick Ingame Namen 06.11.2026

1. Gut: vor dem Einbau gegen bekannte Namen gemessen. Die Bountyerkennung wäre sonst mit falschen Zuordnungen live gegangen.
2. Falsche Annahme: `winner_bounty` im Replay Dokument sei die Bounty der Bestenliste. Sie liegt weit darunter und springt.
3. Besser spezifizieren: bei einem Fingerabdruck vorher an drei Belegen prüfen, ob das Feld überhaupt dasselbe misst.
