## Goal
Die Seite soll für jede Partie das Replay finden, das der Client wirklich hochgeladen hat. Dafür kommt der Storagepfad aus den Metadaten in Firestore (`Replays`) statt aus einer eigenen Rechnung.

## Befund 06.11.2026
Gemeldet: Auf der Live Seite lässt sich praktisch kein Replay laden, es erscheint „No replay stored for this game“.

1. Der Lauf vom 06.11. 01:43 UTC (Action 42145737214) meldet 32 neu, 244 nicht gefunden von 276 Pfaden. Die 32 sind fast alle alt (W38 bis W42) oder stammen aus `frische_partien.py`.
2. `spieler_daten.py replaypfad()` rechnet den Pfad nach dem alten Schema `Replays/<ISO Woche>/<Modus>/<Sieger>/<Verlierer>_<Bounty>_<Bounty>.log`. Seit etwa W43 legt der Client die Dateien aber als `<Verlierer>_<64 Hex Zeichen>.log` ab. In den Ordnern W43 und W44 gibt es nur noch solche Namen. Außerdem stimmt das Wochenetikett nicht mehr mit der ISO Woche: Uploads vom 06.11. liegen noch unter W44, W45 und W46 gibt es nicht.
3. `nachbar_suchen` in `replays_holen.py` sucht nur numerische Namen mit Bounty Toleranz und findet die Hashnamen deshalb nie.
4. Der Client selbst sucht ein Replay zuerst unter dem gerechneten Pfad und fällt dann auf die Firestore Sammlung `Replays` zurück (`get_firestore_replay_candidate_paths` im Spielpaket). Jedes Dokument dort trägt `path`, `winner_leader`, `loser_leader`, `game_mode`, `timestamp`, `winner_bounty`, `loser_bounty`. Gesucht wird nach Leadern, Modus, Zeit ab eine Stunde vor der Partie, dann wird die Bounty verglichen.
5. Probe mit 80 zufälligen Partien seit dem 27.10. aus `PublicUsers`: 16 über die Metadaten gefunden, 0 über den gerechneten Pfad, 64 gar nicht. Bei den 64 gibt es zu Leadern und Modus Dokumente, aber keines mit passender Bounty. Diese Partien hat der Client nicht hochgeladen.

Folge: Auch nach dem Fix hat nur etwa jede fünfte Partie ein Replay. Mehr gibt es in Storage nicht. Das Frontend ist nicht schuld, `dateiname` in `src/App.jsx` und `replays_holen.py` bilden denselben Namen.

## Scope
In scope:
- `spieler_daten.py`: nach dem Lesen der Partien je Partie das Replay Dokument in `Replays` suchen (Leader, Modus, Zeit, Bounty abgeschnitten auf ganze Zahlen wie im Client) und dessen `path` eintragen. Kein Treffer: der gerechnete Pfad bleibt, damit alte Wochen weiter über `laden` und `nachbar_suchen` gefunden werden.
- `replays_holen.py`: am Ende je Woche zählen, was gefunden wurde und was nicht, damit ein neuer Namenswechsel im Log sofort auffällt.
- Partien, deren Replay nach dem Holen fehlt, bekommen in `spieler.json.gz` kein `replay` mehr. Die Seite zeigt dort dann keinen Replay Knopf statt einer Fehlermeldung nach dem Klick (siehe Open questions).
- Tests für Abgleich und Bounty Vergleich mit Beispieldokumenten.

Out of scope:
- Mehr Uploads erzwingen oder eigene Replays aufzeichnen.
- `frische_partien.py`, das schon mit `path` aus den Metadaten arbeitet.
- Andere Sammlungen als `Replays` und `PublicUsers`. `Users` bleibt unangetastet.

## Acceptance criteria
- [x] Probe mit mindestens 50 Partien seit dem 27.10.: jede Partie, deren Replay in Storage liegt, bekommt den echten Pfad (63 junge Partien, 15 gefunden, 0 über den gerechneten Pfad).
- [ ] Ein Lauf von `replays_holen.py` nach `spieler_daten.py` findet mindestens dreimal so viele neue Replays wie der Lauf vom 06.11. (32), relativ zur Zahl der Pfade. (Probe: insgesamt 1,5 mal so viele, bei Partien seit dem 27.10. von 0 auf 15 von 63. Mehr liegt nicht in Storage.)
- [ ] Auf der Seite öffnet sich ein Replay einer Partie vom 05.11. oder später. (Erst nach dem Deploy prüfbar.)
- [x] Partien ohne hochgeladenes Replay führen nicht mehr ins „No replay stored“: `replays_holen.py` trägt sie aus, die Seite zeigt den Knopf nur mit `replay`.
- [x] Fällt die Firestore Abfrage aus, läuft `spieler_daten.py` mit den gerechneten Pfaden weiter wie bisher (Warnung im Log, Test).
- [x] `npm test` (81 pass, 7 skipped) und die Python Tests (204) grün.

## Ergebnis 06.11.2026
Probelauf mit 60 zufälligen Spielern aus `PublicUsers`, 297 Partien mit Pfad, ohne Schreiben nach `public`:

| | geladen vorher | geladen nachher |
|---|---|---|
| Partien vor dem 27.10. (234) | 65 | 84 |
| Partien ab dem 27.10. (63) | 0 | 15 |
| zusammen (297) | 65 (22 %) | 99 (33 %) |

Die Abfragen brauchten 15,6 s für 297 Partien (8 parallel), keine scheiterte. Das Kriterium „dreimal so viele“ ist nicht erreicht: die übrigen Partien hat der Client nicht hochgeladen, ihre Metadaten fehlen in `Replays`. Neu ist, dass sie auf der Seite keinen toten Knopf mehr haben.

## Implementation plan
Phase 1: `replay_metadaten(db, zeile)` in `spieler_daten.py` mit einer Abfrage je Partie, Grenze 300 Dokumente, Treffer über Leader, Modus und Bounty. Tests mit Beispieldokumenten.
Phase 2: `replays_holen.py` schreibt die Zählung je Woche und entfernt fehlende Replays aus `spieler.json.gz`. Test für das Entfernen.
Phase 3: Lokaler Lauf gegen Firestore und Storage, Probe im Browser mit einem frischen Replay, Ergebnis in diese Spec, Commit auf eigenem Branch, PR nach deinem OK.

Tradeoffs: Eine Abfrage je Partie sind bei etwa 280 Partien rund 280 Anfragen je Lauf, bei 0,3 s je Abfrage etwa anderthalb Minuten mehr Laufzeit. Eine Sammelabfrage über den ganzen Zeitraum wäre schneller, holt aber für zwei Wochen rund 35000 Dokumente samt Decklisten. Die Einzelabfrage ist genau die, die der Client auch stellt; der nötige Firestore Index existiert also sicher.

## Open questions
- Partien ohne hochgeladenes Replay: Knopf ausblenden (Vorschlag) oder wie bisher die Meldung nach dem Klick?
