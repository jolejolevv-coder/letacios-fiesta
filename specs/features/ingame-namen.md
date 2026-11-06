# Ingame Namen der Top 100 (mehr frische Replays je Spieler)

Stand 06.11.2026, freigegeben am 06.11.2026 (Gedächtnis im Repo, Schwelle 95 %).

## Ausgangslage
`frische_partien.py` ordnet die Replays der letzten fünf Tage über den Ingame Namen im Log
(„himm#7921“) einem Spieler der Bestenliste zu. Den Namen lernt es nur aus Partien im
Schnappschuss `PublicUsers`, deren Replay existiert und die kein Mirror sind. Im Lauf vom
06.11. waren das 37 Logs, daraus 24 Namen von 95 Spielern. Ergebnis: 89 frische Partien für
18 Spieler, die Top 3 haben kein einziges Replay.

Messungen vom 06.11. (lokal, ausgeliefertes Artefakt von Lauf 42191370761):
Der Gegner im Schnappschuss als zweite Lernquelle bringt 0 zusätzliche Namen. Ingame Name
gleich Bestenlistenname oder Login trifft nur bei 11 von 24 bekannten Namen zu und kennt
Namen wie „You“ oder „Newuser123“. Beides taugt nicht als Brücke.

Was trägt: in den 395 Western Replays der fünf Tage stehen beide Ingame Namen samt Bounty
und Leader je Seite. Die Web API der Bestenliste liefert je Spieler die aktuelle Bounty und
die gespielten Leader mit Partien. Ein Name, dessen letzte Bounty nahe an genau einer
Bestenlistenbounty liegt und dessen Leader zu den Leadern dieses Spielers passen, ist sehr
wahrscheinlich dieser Spieler.

## Goal
Mehr Spieler der Top 100 bekommen frische Partien mit Replay, indem Ingame Namen dauerhaft
gemerkt und zusätzlich über Bounty und Leader erkannt werden.

## Scope
- In scope: Gedächtnis der gelernten Namen über Läufe hinweg; Erkennung über Bounty und
  Leader mit Messung der Trefferquote vorab; Zählung im Log der Action.
- Out of scope: Namensähnlichkeit als Brücke; mehr Profile aus `PublicUsers` holen; Änderungen
  an der Seite; Upload Bedingungen des Clients.

## Acceptance criteria
- [x] Gelernte Namen bleiben über Läufe erhalten, als `ingame_namen.json.gz.enc` im Repo
      (nur verschlüsselt, Klartext gitignored). Ein Name, der später einem anderen Spieler
      zugeordnet wird, ersetzt den alten Eintrag nicht stillschweigend: Konflikte fliegen raus
      und werden gezählt.
- [x] Erkennung über Bounty und Leader ist gegen die bekannten Namen gemessen: mindestens
      95 % Precision (falsche Zuordnungen höchstens 1 von 20). Unter dieser Schwelle wird
      Phase 2 nicht eingebaut, das Ergebnis steht in dieser Spec.
- [ ] Ein Lauf der Action ordnet frische Partien mindestens doppelt so vielen Spielern zu wie
      am 06.11. (18), oder die Spec nennt den gemessenen Grund, warum nicht.
- [x] Log der Action nennt nur Zahlen: Namen aus Schnappschuss, aus Gedächtnis, aus Bounty,
      Konflikte. Keine Namen (öffentliches Repo).
- [x] Python Tests für Gedächtnis und Konflikte (10 neu, `tests/test_frische_partien.py`
      19 grün). Bountyerkennung entfällt, siehe Ergebnis. Die zwei Ladefehler in
      `test_bestenliste_ocr` und `test_bildschirm` bestanden schon vorher (lokal fehlt pillow).

## Ergebnis Phase 2 (06.11.2026)
Messung mit `werkzeuge/ingame_bounty_messung.py` gegen das ausgelieferte Artefakt von Lauf
42191370761: 395 Replays, 231 Ingame Namen, 24 Belege, davon 18 in den Replays. Über das ganze
Raster (Abstand 5 bis 40, Vorsprung 0 bis 20) gibt es 0 richtige und 0 bis 3 falsche
Zuordnungen, Precision 0. Phase 3 wird deshalb nicht gebaut.

Grund: die Bounty im Replay Dokument (`winner_bounty`, `loser_bounty`) ist nicht die Bounty
der Bestenliste. Bei den 18 Belegen liegt sie 100 bis 900 darunter und springt zwischen den
Partien eines Spielers um bis zu 1.900 (etwa 1.668, dann 3.602). Als Fingerabdruck taugt sie
nicht. Die Leader passen dagegen bei 17 von 18; allein sind sie bei 100 Spielern und einem
engen Meta aber nicht eindeutig.

Damit trägt nur das Gedächtnis. Es wächst mit jedem Lauf um die Namen aus neuen
Schnappschusspartien mit Replay. Das dritte Kriterium (36 Spieler) lässt sich erst nach einigen
Läufen prüfen; der Stand steht dann im Log unter „Gedaechtnis“.

## Implementation plan
Phase 1, Gedächtnis: `namen_laden()` und `namen_speichern()` in `frische_partien.py`,
Zusammenführen mit den neu gelernten Namen, Konfliktregel, Commit der `.enc` Datei durch die
Action (wie die bestehende Nachzieh Stufe im Workflow). Tests.

Phase 2, Messung: Skript in `werkzeuge/`, das für jeden Ingame Namen aus den Replays der fünf
Tage die letzte Bounty und die Leader bildet, den Kandidaten aus der Bestenliste wählt und
gegen die bekannten 24 Namen prüft. Parameter: Abstand der Bounty, Mindestabstand zum
zweitbesten Kandidaten, Leaderüberdeckung. Ergebnis mit Precision und Recall in diese Spec.

Phase 3, Einbau (nur bei bestandener Messung): Erkennung in `frische_partien.py` als zweite
Quelle nach dem Schnappschuss, Treffer gehen ins Gedächtnis. Tests, Lauf der Action prüfen.

Tradeoffs: Das Gedächtnis kostet einen Commit je Lauf mit neuen Namen; ein Actions Cache
wäre ohne Commits, verfällt aber und ist lokal nicht lesbar. Die Bountyerkennung kann irren;
eine falsche Zuordnung zeigt fremde Partien auf einer Spielerseite, deshalb die harte
Schwelle vor dem Einbau und eine Zuordnung nur bei eindeutigem Abstand zum Zweitbesten.

## Open questions
- Gedächtnis als verschlüsselte Datei im Repo (Vorschlag) oder als Actions Cache?
- Reicht 95 % Precision als Schwelle, oder willst du strenger sein?
