# Referenzdaten für "Analyze my replay"

Gerechnet am 22.10.2026 auf dem Bazzite mit `tools/fiesta_referenz.py` aus Metacoach,
Wertnetz vom 2026-10-22T0120, Book von Rocks.D.Xebec (OP17-039) vom 2026-10-22T07:23 UTC,
Zuglager Version 3. Sie dienen dem Abgleich von `src/zuglager.js`, der Bewertung und des
Wertnetzes in JavaScript mit Python (Toleranz 0,1 Punkte Siegchance).

## Logs

Zwanzig eigene Partien des Nutzers mit Rocks.D.Xebec, zehn first und zehn second, vierzehn
verschiedene Gegner. Die Logs selbst liegen nicht im Repo, weil darin die Namen der Gegner
stehen. Sie liegen auf dem Bazzite unter `/var/mnt/data/metacoach/eigene/`:

| Log | Gegner | Sitz | Sieg |
|---|---|---|---|
| 2026-09-24T22.12.41.log | OP08-058 | first | ja |
| 2026-09-25T06.25.35.log | OP13-004 | first | ja |
| 2026-09-25T06.33.23.log | OP16-001 | first | ja |
| 2026-09-25T06.40.48.log | OP17-039 | second | nein |
| 2026-09-25T06.45.42.log | OP17-020 | second | ja |
| 2026-09-25T07.15.57.log | OP17-039 | second | ja |
| 2026-09-25T07.31.59.log | OP09-062 | first | nein |
| 2026-09-25T12.50.23.log | OP17-058 | first | nein |
| 2026-09-25T16.33.56.log | OP11-041 | second | ja |
| 2026-09-29T23.09.17.log | OP05-098 | first | ja |
| 2026-09-30T13.09.11.log | OP17-039 | first | nein |
| 2026-09-30T15.11.42.log | OP12-061 | first | ja |
| 2026-09-30T18.12.47.log | OP17-058 | second | ja |
| 2026-09-30T18.18.34.log | OP14-041 | first | ja |
| 2026-09-30T18.56.30.log | OP09-062 | second | ja |
| 2026-10-01T08.54.27.log | OP15-058 | second | ja |
| 2026-10-01T20.33.37.log | OP12-020 | first | ja |
| 2026-10-01T21.00.40.log | OP12-061 | second | ja |
| 2026-10-02T10.32.48.log | OP17-079 | second | ja |
| 2026-10-02T10.45.09.log | OP05-098 | second | nein |

Am Mac liegen dieselben Logs im Ordner von OPTCGSim
(`~/Library/Application Support/com.Batsu.OPTCGSim/CombatLogs/AutoSaved/`). In allen
zwanzig ist der Nutzer Spieler 1.

## Dateien je Log `<id>`

* `<id>.zuglager.json`: die Ausgabe von `zug_lager.partie_lesen` (Felder `leader`, `erster`,
  `sieger`, `lagen`, `zuege`, `angriffe`, `mulligan`), Spieler als 1 und 2, ohne Namen.
* `<id>.bewertung.json`: `nr` (eigene Nummer), `bewertung` als Ausgabe von
  `spielbewertung.partie_bewerten` für die eigene Seite (Noten, Accuracy, Entscheidungen mit
  Optionen, Hinweise; die Lagen sind deutsch wie in Python) und `kurve`, die Siegchance beider
  Spieler (`v1`, `v2` in Prozent) am Ende jedes Halbzugs.
* `<id>.netz.json`: 50 Lagen gleichmäßig über die Partie, je Fall `eingabe` (Zeile wie
  `book.lage_zeile`), `nummern` (Karten und Leader als Index ins Netz), `zaehl` (die 13
  Zählmerkmale) und `p_sieg` (0 bis 1).

`index.json` nennt alle Logs mit Serverpfad, Gegner, Sitz, Sieg und Accuracy.

## Eingaben (nicht im Repo)

`eingaben/` ist in `.gitignore`: das Wertnetz im Format von `tools/fiesta_export.py`
(`wertnetz.json.gz`, entspricht dem entschlüsselten `/fiesta/netz/wertnetz.json.gz.enc`), das
Book `book_OP17-039.json.gz` und `kartenwerte.json` (Counter und Kosten der vorkommenden
Karten). Ohne diesen Ordner laufen nur die Tests des Lesers; Netz und Bewertung brauchen genau
diese Stände, weil das Netz jede Nacht neu lernt. Neu erzeugen auf dem Bazzite:

    cd ~/meta-coach && .venv/bin/python tools/fiesta_referenz.py --ziel ~/.cache/metacoach_referenz
