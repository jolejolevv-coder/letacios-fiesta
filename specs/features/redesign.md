# Redesign „Werkzeug“ (Richtung B, Linear / Raycast)

Stand 02.11.2026, Entwurf zur Freigabe. Vergleichsseite der vier Richtungen:
`.impeccable/vorschau/richtungen.html` (lokal, gitignored).

## Goal

Fiesta bekommt ein eigenes, ruhiges Werkzeuggesicht im Stil von Linear und Raycast (warmes
Schwarz, Haarlinien, ein Akzent, Zahlen in Mono, Suchfeld mit ⌘K und am Handy eine untere
Leiste), damit Leader, Listen und Matchups schneller zu lesen und zu erreichen sind.

## Einordnung

Redesign · Overhaul nach dem `redesign-protocol` des Skills `web-design-engineer`: neue
Bildsprache, aber Produkt, Inhalte, Daten und alle technischen Verträge bleiben.

Folge, vom Nutzer mit der Wahl von B angenommen: Fiesta und Metacoach sehen danach nicht mehr
gleich aus. `PRODUCT.md` (Positioning, Design Direction) und `DESIGN.md` werden umgeschrieben.

Entscheidungen des Nutzers vom 02.11.2026: Richtung B, alle Reiter, nur dunkel, am Handy eine
untere Leiste.

```text
Mode:        Overhaul
Preserve:    Inhalte und Reihenfolge der Reiter, Nummerierung jeder Liste, Rückseite einer
             Zeile statt neuer Ansicht, Raute und kursiv für Schätzungen, Sombrero in Stroh,
             Seegrün und Ziegelrot für Winrates in Matrix und Matchups, englische Oberfläche
Improve:     Kopf und Navigation, Kennzahlen als Kacheln, Tabellen als gerahmte Blöcke,
             Handy Navigation im Daumenbereich, Suche nach Leadern über ⌘K
Remove:      blaues Kopfband, Laminatglanz, Zebra (ersetzt durch Haarlinien), Saira und
             Source Sans 3
Dials:       visual variance 4, motion 3, information density 7, asset dependence 3,
             brand fidelity 6
Höchstes Risiko: CSS Umbau von 3.191 Zeilen in index.css bricht einzelne Ansichten
             (Replaybrett, Guide Belege, Analyze) unbemerkt
Fallback:    alles auf eigenem Branch, live bleibt der alte Stand bis zum Merge
```

## Designsystem

Die Namen der CSS Variablen in `src/index.css` bleiben (`--grund`, `--karton`, `--akzent` …),
nur ihre Werte ändern sich. So bleiben 486 Verwendungen gültig, und kein JSX enthält feste Farben.

| Rolle | Token | Wert heute | Wert neu |
|---|---|---|---|
| Grund | `--grund` | `#0b0c0f` | `#08090a` |
| Fläche | `--karton` | `#16181d` | `#0f1013` |
| Fläche hoch (Kacheln, aktiv) | `--karton-hoch` | `#1c1f25` | `#16171c` |
| Fläche Rückseite | `--rueck` | `#111929` | `#1e1f25` |
| Haarlinie | `--linie` | `rgba(236,231,220,.085)` | `rgba(255,255,255,.06)` |
| Haarlinie stark | `--linie-stark` | `rgba(236,231,220,.17)` | `rgba(255,255,255,.12)` |
| Text | `--text` | `#ece7dc` | `#f2f2f0` |
| Text 2 | `--text-2` | `#aca79c` | `#9ca3af` |
| Text 3 | `--text-3` | `#8a867e` | `#6b7280` (auf Kontrast 4.5 prüfen, sonst `#7c828d`) |
| Akzent | `--akzent` | `#2c66d6` | bleibt `#2c66d6`, nur Fokus, Kennungen, aktive Wahl |
| Akzent hell | `--akzent-hell` | `#93b3f3` | bleibt |
| Zebra | `--zebra` | `rgba(236,231,220,.03)` | `transparent` |
| Gewinnt / verliert | `--gewinnt`, `--verliert` | bleiben | bleiben |
| Stroh | Sombrero | `#e8a33d` | bleibt, nur Marke |

Schrift: Geist (Text und Überschriften, 400 bis 600) und Geist Mono (alle Zahlen, Kartennummern,
Chips, Tastenkürzel), als Fontsource Pakete `@fontsource-variable/geist` und
`@fontsource-variable/geist-mono` (je 5.3.0, nur latin; Geist mit echtem Kursivschnitt für
Schätzungen). Überschriften 600 mit −0.02em.
Größen: Seitentitel 22, Kachelwert 19 Mono, Text 14 bis 15, Tabellen 12.5 Mono, Etiketten 11.5.

Abstände 4, 8, 12, 16, 24, 40. Radien 6 (Chips, Reiter, Zeilen), 10 (Kacheln, Felder),
12 (Tabellenblöcke, Rückseite). Schatten nur `0 1px 2px rgba(0,0,0,.3)` auf schwebenden Tafeln.
Bewegung: 150 ms ease out für Hover, 350 ms `cubic-bezier(0.22, 1, 0.36, 1)` für Aufklappen,
nichts federt, `prefers-reduced-motion` schaltet ab.

## Scope

* In scope:
  * Tokens und Schriften (`src/index.css`, `src/main.jsx`, `index.html` mit `theme-color` und
    Grundfarbe, `package.json`).
  * Rahmen: Kopf mit Sombrero, Suchfeld (⌘K) und Satzchip, Reiter am Rechner als Pillen in einer
    Zeile, Fuß.
  * Handy unter 760 px: untere Leiste mit Decks, Matchups, Matrix, Ladder, More. More öffnet ein
    Blatt mit Ranking, Mulligan, Guide, Analyze, Changelog. Player und Replay bleiben Unterseiten
    ohne eigenen Platz in der Leiste.
  * Alle Ansichten: Decklists, Matchups, Matrix, Rankings, Leaderboard, Player, Replay, Mulligan,
    Guide, Analyze my replay, Changelog und die Anmeldung. Kennzahlen als Kacheln, Tabellen als
    gerahmte Blöcke, Rückseite einer Zeile als Tafel mit 12 px Radius.
  * ⌘K Palette: Suche über die Leader des geladenen Satzes, Enter öffnet den Leader im aktuellen
    Reiter (oder in Decklists, wenn der Reiter keinen Leader kennt). Am Handy ein Tipp auf das
    Suchfeld.
  * Doku: `DESIGN.md`, `PRODUCT.md`, `.impeccable/design.json`, ein Eintrag in `src/changelog.js`.
* Out of scope:
  * Helles Thema, Umschalter.
  * Datenpipeline (`aktualisieren.py`, `frische_partien.py` usw.), `verschluesseln.py`,
    `src/daten.js`, Datenformat der Sätze, Rechenlogik (`zuglager.js`, `wertnetz.js`,
    `spielbewertung.js`, `winrate.js`).
  * Metacoach selbst.
  * Neue Inhalte, neue Kennzahlen, neue Reiter.

## Geschützte Verträge

* Pfade `/decklists`, `/matchups`, `/matrix`, `/rankings`, `/leaderboard`, `/player`, `/replay`,
  `/mulligan`, `/guide`, `/analyze`, `/changelog`, die alten Pfade `/analysis` und `/book`, die
  Abfragen `?leader=`, `&sort=`, `?id=`, `?p=` und die Kopie als `404.html`.
* Reihenfolge und Namen der Reiter (`REITER` in `src/App.jsx`), keiner fällt weg.
* Datenformat der Sätze und der Weg über `verschluesseln.py` und `src/daten.js`, das Passwort.
* `noindex`, englische Oberfläche, nur dunkel.
* Am Handy kein seitliches Scrollen der Seite, nur Matrix und Replaybrett in ihrer Fläche.
* Zugänglichkeit: `aria-current` auf dem aktiven Reiter, Tastaturbedienung der Rückseiten,
  sichtbarer Fokus.

## Acceptance criteria

- [ ] Alle Pfade und Abfragen oben laden die gleiche Ansicht wie vorher, Zurück im Browser
      funktioniert wie vorher.
- [ ] Alle neun Reiter sind am Rechner in einer Zeile und am Handy über Leiste oder More
      erreichbar.
- [ ] Untere Leiste am Handy liegt über dem Inhalt, achtet auf `safe-area-inset-bottom`, Tipp
      Ziele mindestens 44 px.
- [ ] ⌘K (und Ctrl K) öffnet die Palette, Pfeiltasten und Enter wählen, Escape schließt, der Fokus
      kehrt zurück.
- [ ] Keine feste Farbe außerhalb der Tokens in `:root`, keine Schrift außer Geist und Geist Mono.
- [ ] Kontrast Text 3 auf Grund mindestens 4.5.
- [ ] Bei 390 px Breite scrollt keine Ansicht seitlich (außer Matrix und Replaybrett in ihrer
      Fläche).
- [ ] Raute und kursiv für Schätzungen bleiben erkennbar.
- [ ] `npm test` und `npx vite build` grün; das CSS wächst um höchstens 10 KB gzip, die Schriften
      wiegen zusammen nicht mehr als heute (Saira 4 Schnitte plus Source Sans 3).
- [ ] Jede Ansicht bei 1280 und 390 px lokal mit entschlüsselten Vorschaudaten geprüft.
- [ ] `DESIGN.md`, `PRODUCT.md`, `.impeccable/design.json` und Changelog beschreiben den neuen
      Stand.

## Implementation plan

Phase 1, Tokens und Schriften: Werte in `:root` tauschen, Geist Pakete statt Saira und Source
Sans 3, `index.html` anpassen, Laminatglanz und Zebra entfernen. Danach trägt schon jede Ansicht
die neuen Farben.

Phase 2, Rahmen (v0): Kopf mit Suchfeld und Satzchip, Reiter als Pillen, untere Leiste und More
Blatt am Handy, Fuß. Lokal zeigen (eigene Vite Prüfkonfiguration auf diesen Worktree, Port 5181,
Daten aus `.impeccable/vorschau/oeffentlich`). Hier hole ich dein Ok für die Richtung am
echten Code, bevor die Ansichten folgen.

Phase 3, Ansichten: Decklists, Matchups, Matrix, Rankings, Leaderboard und Player, danach
Replay, Mulligan, Guide, Analyze, Changelog und Anmeldung. Kacheln, gerahmte Tabellen,
Rückseiten, Zustände (Laden, leer, Fehler, Fokus, Hover).

Phase 4, ⌘K Palette: Komponente in `src/App.jsx`, Leader aus dem geladenen Satz, Tastatur und
Fokus wie oben. Ein kleiner Test für die Suchlogik (Treffer nach Name und Kartennummer) in
`tests/`.

Phase 5, Prüfung und Doku: alle Ansichten bei 1280 und 390 px, Kontrast, Bundlegröße, `npm test`,
`npx vite build`, Doku und Changelog, Commit auf `claude/website-redesign-bc8edc`. Push und Merge
nur mit deinem Ok.

## Open questions

- Soll die ⌘K Palette neben Leadern auch Karten finden (springt dann zu Decklists mit dem Filter
  „Contains card“)? Annahme ohne Antwort: nur Leader.
- Der Design Hook meldet Geist als zu häufig genutzte Schrift. Bleibt Geist wie in der
  Vergleichsseite, oder nehme ich für Text und Überschriften Instrument Sans (eigenständiger,
  ebenso ruhig) und behalte Geist Mono nur für Zahlen? Annahme ohne Antwort: Geist.
- Zwei neue Abhängigkeiten (`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`),
  zwei fallen weg (`@fontsource/saira-semi-condensed`, `@fontsource-variable/source-sans-3`).
  Einverstanden?
