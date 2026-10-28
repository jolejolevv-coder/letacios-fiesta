# Kartenquelle tcgcsv

Entwurf vom 24.10.2026, am selben Tag freigegeben: Bilder in 1000 px, und alle vorhandenen
Bilder werden einmal durch die von tcgcsv ersetzt, damit alle gleich aussehen.

## Goal

Kartendaten und Kartenbilder kommen aus einer Quelle, tcgcsv.com, damit neue Sets und
Promos schnell und ohne Handarbeit auf Fiesta stehen. Kaizoku ergänzt nur Daten, die dort
noch fehlen.

## Was gemessen ist (24.10.2026)

Unsere Sätze nennen 1.617 Karten. Es fehlen:

| Quelle | fehlt | Bilder |
|---|---|---|
| Punk Records (heute) | 51, vor allem OP18 und Promos ab P-116 | keine eigenen, nur Link auf die offizielle Seite |
| tcgcsv.com | 16: acht aus OP18, sechs Promos, P-999, XOP12-040 | alle vorhanden, 200 px und 1000 px |
| Kaizoku `card_data.json` | 2: P-999, XOP12-040 (Platzhalter) | gesperrt, 403 außerhalb der Seite |

tcgcsv ist ein täglicher Spiegel der TCGplayer Daten (Kategorie 68 = One Piece), ohne
Login und ohne Schlüssel, aktualisiert gegen 20 Uhr UTC. 87 Gruppen (Sets, Decks, Promos),
der ganze Abruf dauerte 6 s. Ohne eigenen User-Agent antwortet die Seite mit 401.
OP18 erscheint am 20.11.2026, bis dahin führt tcgcsv nur die Karten aus dem Vorverkauf.
Kosten und Counter von Kaizoku und Punk Records waren bei allen gemeinsamen Karten gleich.

Endpunkte:
* Gruppen: `https://tcgcsv.com/tcgplayer/68/groups`
* Karten einer Gruppe: `https://tcgcsv.com/tcgplayer/68/{groupId}/products`
* Bild: `imageUrl` aus dem Produkt, `_200w.jpg` durch `_in_1000x1000.jpg` ersetzbar
* Ersatz: `https://cdn.cardkaizoku.com/card_data.json`

Felder bei tcgcsv in `extendedData`: `Number`, `Color`, `CardType`, `Cost`, `Counterplus`,
`Description`. Varianten (Parallel, Manga) sind eigene Produkte mit derselben Nummer.

## Scope

In scope:
- `namen_holen` in `aktualisieren.py` liest tcgcsv statt Punk Records und schreibt
  `karten.json.gz` im selben Format wie heute (`n`, `f`, `k`, `a`, `c`). Die Seite ändert
  sich nicht.
- Der Counter der Events kommt aus dem Kartentext (`Description`), mit dem vorhandenen
  Muster `EVENT_COUNTER`.
- Je Nummer zählt das erste Produkt, das keine Variante ist; sonst das erste überhaupt.
- Kaizoku füllt nur Nummern auf, die tcgcsv nicht kennt, mit denselben Feldern.
- `bilder_kopieren` holt die Bilder bei tcgcsv in 1000 px und verkleinert sie wie heute
  mit `bild_ablegen`. Reihenfolge: vorhandenes Bild aus tcgcsv im Zwischenspeicher, tcgcsv,
  `bilder_nachtrag/` nur für Karten ohne Bild dort. Sim und offizielle Seite entfallen.
- Einmaliger Austausch: Alle vorhandenen Bilder werden durch die von tcgcsv ersetzt. Eine
  Kennung der Bildquelle im Zwischenspeicher (etwa `img/quelle.txt` mit `tcgcsv-1000`)
  sagt, ob ein Bild schon neu ist; fehlt sie oder ist sie alt, lädt der Lauf alle Bilder
  neu. Bilder, die tcgcsv nicht hat, bleiben wie sie sind.
- Fällt eine Quelle aus oder ändert sich ihr Format, schreibt der Lauf `::warning::` und
  macht mit dem Rest weiter. Fällt tcgcsv ganz aus, bleibt `karten.json.gz` vom Vortag
  stehen statt leer zu werden.
- Tests mit kleinen Beispielantworten beider Quellen, ohne Netz.

Out of scope:
- Die großen Bilder von Metacoach (`/fiesta/bilder/`).
- Preise, Seltenheit, japanische Texte.
- Bilder von Kaizoku. Sie sind außerhalb der Seite gesperrt, das umgehen wir nicht.
- `player-stats` und Partien von Kaizoku.

## Acceptance criteria

- [ ] `karten.json.gz` kennt mindestens alle Karten, die heute drin sind, plus die 49, die
      Kaizoku ergänzt. Gemessen gegen die Karten der Sätze vom selben Lauf.
- [ ] Kosten und Counter weichen bei keiner Karte vom heutigen Stand ab, außer wo die alte
      Quelle nichts hatte.
- [ ] EB05-026 und OP18-091 haben ein Bild.
- [ ] Nach dem ersten Lauf stammen alle Bilder, die tcgcsv kennt, von tcgcsv; der Lauf
      meldet, wie viele ersetzt wurden und welche alt geblieben sind.
- [ ] Der Lauf meldet die Karten ohne Daten und ohne Bild mit Nummer.
- [ ] Ohne Netz zu tcgcsv bricht der Lauf nicht ab, die Warnung steht im Log der Action.
- [ ] Der Teil Karten und Bilder dauert in der Action unter einer Minute, wenn der
      Bildspeicher gefüllt ist. Der einmalige Austausch darf länger dauern (rund 2.900
      Bilder), muss aber unter dem Zeitlimit der Action bleiben.
- [ ] Python Tests, `npm test` und `npx vite build` laufen durch.

## Stand 24.10.2026

Phase 2 (Bilder) zuerst gebaut, auf Wunsch des Nutzers. Lokal: voller Austausch 24 s,
1.582 Bilder von tcgcsv, Folgelauf 9 s. Bilder aus dem OP18 Vorverkauf liefert TCGplayer
noch mit 403; diese Karten nehmen den Nachtrag und stehen in `img/offen.txt`, bis tcgcsv
sie liefert. Ohne Bild bleiben EB05-061 und OP18-091. Phase 1 (Daten) ist offen.

## Implementation plan

Phase 1, Daten: `tcgcsv_holen` (Gruppen und Produkte), `kaizoku_holen`, `karte_aus_tcgcsv`
und `karte_aus_kaizoku` als reine Umrechner, `namen_holen` setzt beides zusammen. Tests mit
Beispieldateien unter `tests/beispiele/`. Lauf gegen die echten Quellen, Vergleich mit dem
heutigen `karten.json.gz`.

Phase 2, Bilder: `bilder_kopieren` nimmt die Bild URLs aus Phase 1 statt Sim und offizieller
Seite. `BILDQUELLE` und der Abruf von Punk Records fallen weg. `werkzeuge/bilder_nachtragen.py`
bleibt für Notfälle. Prüfen in der lokalen Vorschau, Changelog Eintrag.

## Tradeoffs

tcgcsv ist inoffiziell und lebt von Patreon, Nutzungsbedingungen sind keine genannt. Fällt
es weg, stehen neue Karten ohne Daten da, bis wir umstellen; alte Bilder bleiben im
Speicher. Punk Records hat dasselbe Risiko und ist heute schon langsamer bei neuen Sets.
Kaizoku als Ersatz ist eine undokumentierte Datei eines Dritten; sie füllt nur Lücken,
ihr Ausfall kostet also höchstens die neuesten Karten. Die Bilder sind wie heute Material
von Bandai.

Der Austausch aller Bilder kostet einmal rund 2.900 Abrufe. Er macht das Aussehen
einheitlich. Die Bilder liegen im Zwischenspeicher der Action, nicht im Repo.

## Stand 28.10.2026, Phase 1 (Daten)

Gebaut, mit geänderter Reihenfolge der Quellen (Nutzer, 28.10.2026: „bevorzuge Kaizoku wegen
der Richtigkeit“). Gemessen: Kaizoku kennt 61 Karten aus dem OP18 Vorverkauf, tcgcsv 42;
Abruf 0,2 s gegen 4,5 s. tcgcsv hatte bei 33 Karten fehlende oder falsche Kosten und Counter,
Kaizoku stimmte dort mit Punk Records überein. Darum: Kaizoku zuerst, tcgcsv füllt fehlende
Nummern und Felder, die Datei vom Vortag füllt, wenn eine Quelle ausfällt. Punk Records
entfällt. Vergleich mit Punk Records: 2.964 statt 2.850 Karten, keine fehlt, Kosten und
Art gleich, ein Counter weg (OP11-020, ein [Main] Event ohne Counter, also alt falsch),
acht Namen anders geschrieben (etwa „Kouzuki“). Die Bilder bleiben bei tcgcsv.

## Entschieden

- Bilder in 1000 px laden und verkleinern (Nutzer, 24.10.2026).
- Alle vorhandenen Bilder einmalig ersetzen, nicht nur fehlende laden (Nutzer, 24.10.2026).

## Open questions

- Keine.
