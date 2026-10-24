# EB05 Queue: Statistik, Rangliste und Replays

Entwurf vom 24.10.2026, am selben Tag freigegeben, Filter wie vorgeschlagen. Phase 1 gebaut.

Nachtrag 24.10.2026 auf Wunsch des Nutzers: ein eigener Satz „EB05 Heroines Event“
(`Roh_mode_1_eb05_event`) aus dem EB05 Satz, nur die Leader aus `eb05_leader.json`, Matchups
nur gegen Leader derselben Liste, Kopfzahlen über alle Gegner. Erster Lauf: 25 von 25
Leadern, 14.260 Partien aus Sicht der erlaubten Leader, 127 KB. Damit ist der Leaderfilter
für die Statistik erledigt; für die Rangliste bleibt er Teil von Phase 3.

Abgeschlossen am 24.10.2026. Phase 2 und 3 (Rangliste, Spielerseiten, Replays, Umschalter)
hat der Nutzer gestrichen: für die Vorbereitung reichen Decklists und Matchup Matrix der
beiden Sätze, sortiert nach Winrate wie bei den anderen Sätzen. Gebaut und gemessen war
Phase 2 schon: Die Bounty im Replay ist nicht die Bounty der Queue (Rang 1 hatte 6.134,8
nach einer einzigen Partie), eine Rangliste danach taugt nicht. Wer sie später doch will,
braucht eine andere Sortierung, etwa nach Bilanz ab einer Mindestzahl Partien. Der Kopf
eines Logs (8 KB per Range Anfrage) reicht für beide Namen.

Ergebnis Phase 1 am 24.10.2026, echter Lauf gegen das CDN: 101 Rohdateien aus 15 Tagen,
29.830 Partien, 438 KB, EB05 Anteil 78 %, Laufzeit des ganzen Skripts ohne Tagesdateien 16 s.
In der lokalen Vorschau steht „EB05 Queue (29,830 games)“ direkt vor „EB05 Queue, last week“
und zeigt die Leader. Die Partienzahl der Statistik ist höher als die Zahl der Replays
(12.125 in 14 Tagen), das Spiel zählt hier anders; beide Quellen messen dieselbe Queue.

## Goal

Fiesta zeigt die neue „Play EB05 Queue“ von OPBounty als eigenen Bereich mit Statistik,
Decklisten, Rangliste und Replays, damit sich der Nutzer auf ein EB05 Event Anfang
November 2026 vorbereiten kann, bei dem nur bestimmte Leader erlaubt sind.

## Was gemessen ist (24.10.2026)

Das Spielpaket von Client 2.7.4 nennt die Queue „Play EB05 Queue“, mit dem Hinweis
„Special EB05 queue (OP18 NOT allowed!)“. In allen drei Quellen ist sie Modus 1, der Platz
der früheren Special Queue, die Fiesta bisher „Special Queue, Webcam“ nennt.

Statistik: Das CDN liefert für `mode_1` Rohdateien je Tag und Bountybereich und den
fertigen Satz `Stats_Special_Queue` (8.368 Partien, nur letzte Woche). EB05 Karten stehen
in `mode_1` seit dem 10.10.2026, vorher hatte der Modus kaum Partien und kein EB05. Im
Western Ladder kommt EB05 fast nicht vor.

Replays: Die Sammlung `Replays` in Firestore trägt `game_mode`. In den letzten zwei Tagen
waren es 788 Replays in Modus 1, davon 628 mit EB05 im Deck. Jedes Replay hat beide
Decklisten, beide Leader und die Bounty beider Seiten. Ein Name steht nur im Log.

Spieler: `PublicUsers/<id>.Webcam` hält für jeden Spieler die Werte dieser Queue mit
eigener Bounty (MircoMorscio: 6 zu 1, Bounty zuletzt 98). Die Bounty der Queue ist getrennt
von der Western Bounty und beginnt bei etwa 25.

Erlaubte Leader in den Replays vom 10. bis 24.10.2026 (12.125 Replays in Modus 1, Mirror
nicht gezählt): EB05-010 Robin 1.809 Partien mit 50,4 %, OP11-022 Shirahoshi 1.181 mit
50,0 %, OP10-003 Sugar 770 mit 44,2 %, OP14-041 Hancock 470 mit 52,1 %, OP16-079 Yamato
264, OP09-062 Robin 216, OP08-058 Pudding 194 mit 61,9 %, OP17-099 Linlin 131 mit 61,1 %.
Zwölf Leader der Liste haben unter 40 Partien. Nur 637 Partien hatten auf beiden Seiten
einen erlaubten Leader.

Eine Rangliste der Queue im Spiel ist nicht geprüft. Die heutige Bestenliste kommt per
Bildschirmfoto aus dem Western Reiter.

## Scope

In scope:
- Statistik: ein eigener Satz „EB05 Queue“ aus den Rohdateien von `mode_1`, alle
  Bountybereiche, vom 10.10.2026 bis heute, täglich neu. Der alte Wochensatz bekommt den
  Namen „EB05 Queue, last week“.
- Rangliste: aus den Replays selbst gerechnet. Je Spieler die letzte Bounty in der Queue,
  Siege, Niederlagen, Winrate und die meistgespielten Leader. Der Name kommt aus dem Log
  (Ingame Name ohne `#1234`).
- Spielerseite und Replays: für die Top 50 der EB05 Rangliste deren Partien mit Replay,
  im vorhandenen Viewer und mit der vorhandenen Analyse.
- Leaderfilter: die erlaubten Leader des Events in `eb05_leader.json`. Ein Schalter
  „Event Leader“ beschränkt Statistik, Matrix und Rangliste in der EB05 Ansicht auf sie.
  Die Liste vom Nutzer, 24.10.2026, 25 Leader:
  OP05-002 Belo Betty, OP06-001 Uta, OP06-021 Perona, OP06-022 Yamato,
  OP06-042 Vinsmoke Reiju, OP07-019 Jewelry Bonney, OP07-038 Boa Hancock, OP08-021 Carrot,
  OP08-058 Charlotte Pudding, OP09-022 Lim, OP09-062 Nico Robin, OP10-003 Sugar,
  OP11-022 Shirahoshi, OP11-041 Nami, OP12-081 Koala, OP13-100 Jewelry Bonney,
  OP14-041 Boa Hancock, OP15-039 Rebecca, OP16-079 Yamato, OP17-099 Charlotte Linlin,
  EB03-001 Nefeltari Vivi, EB04-001 Jewelry Bonney, EB05-010 Nico Robin, ST11-001 Uta,
  P-117 Nami.
- Eine Warnung im Lauf, wenn der EB05 Anteil in `mode_1` unter eine Grenze fällt. Dann
  hat der Entwickler den Modus wohl neu belegt.

Out of scope:
- Eine Rangliste per Bildschirmfoto aus dem Spiel. Erst prüfen, falls die selbst gerechnete
  nicht reicht.
- Guide und Mulligan für EB05. Sie rechnen aus Replays und lassen sich später auf denselben
  Bestand setzen.
- Änderungen am Bazzite.

## Acceptance criteria

- [x] In der Satzauswahl steht „EB05 Queue“ mit allen Partien ab 10.10.2026, getrennt vom
      Western Ladder. Partienzahl und Stand sind sichtbar.
- [ ] ~~Ein eigener Reiter oder Umschalter zeigt die EB05 Rangliste.~~ Gestrichen.
- [ ] ~~Spieler der Top 50 mit EB05 Partien und Replay.~~ Gestrichen.
- [x] Die Statistik lässt sich auf die Event Leader beschränken (Satz „EB05 Heroines
      Event“).
- [x] Die Western Daten sind unverändert, die Tests laufen durch.
- [x] Der tägliche Lauf der Action bleibt unter 20 Minuten (der EB05 Satz kostet Sekunden).
- [x] Fällt der EB05 Anteil in `mode_1` unter 30 %, steht eine Warnung im Log der Action
      (`::warning::`, getestet in `tests/test_aktualisieren.py`).

## Implementation plan

Phase 1, Statistik (klein, sofort nützlich): `aktualisieren.py` rechnet den Satz aus den
Rohdateien von `mode_1` ab einem festen Startdatum, benennt den Wochensatz um und prüft den
EB05 Anteil. Tests für Startdatum und Warnung.

Phase 2, Replays und Rangliste: ein neues Skript `eb05_holen.py` holt die Replays mit
`game_mode` 1 seit dem 10.10. über `replays_suchen`, lädt die Logs in den vorhandenen
Zwischenspeicher, liest die Ingame Namen und schreibt `eb05.json.gz` mit Rangliste und
Partien. `replays_holen.py` packt die Replays der Top 50 mit ein. Tests mit einem kleinen
Beispiellog.

Phase 3, Seite: Umschalter „Ladder | EB05“, Rangliste, Spielerseite, Leaderfilter. Prüfen
am Handy und am Desktop, Changelog Eintrag.

## Aufwand und Tradeoffs

Rund 870 Replays am Tag, seit dem 10.10. schon 12.125, bis zum Event etwa 25.000 Logs. Der erste Lauf lädt sie alle,
danach nur die neuen. Veröffentlicht werden nur die Replays der Top 50, sonst wächst die
Seite um mehrere hundert MB.

Die selbst gerechnete Rangliste kennt nur Spieler, die in der Zeit gespielt haben, und
ihren Stand nach der letzten Partie. Sie ist dafür sofort da, minütlich aktuell und ohne
Bildschirm und OCR. Ein Name aus dem Log kann vom Namen in der Spielrangliste abweichen.

## Open questions

- Was zeigt der Schalter „Event Leader“? Vorschlag: die erlaubten Leader mit allen
  Gegnern, und in der Matrix nur Gegner aus der Liste. Nur Partien mit zwei erlaubten
  Leadern wären näher am Event, aber mit 637 Partien zu dünn für fast jedes Matchup.
- Datum des Events, damit die Rangliste bis dahin sicher läuft.
- Top 50 für Replays reicht, oder lieber alle Partien der erlaubten Leader?
