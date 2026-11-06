---
name: Letacios Fiesta
description: Die Ladderstatistik als ruhiges Werkzeug, warmes Schwarz mit Haarlinien, ein blauer Akzent, Zahlen in Mono, Suche über ⌘K.
colors:
  akzent: "#2c66d6"
  akzent-band: "#3170e0"
  akzent-hell: "#93b3f3"
  akzent-flaeche: "rgba(44, 102, 214, 0.14)"
  akzent-rand: "rgba(44, 102, 214, 0.55)"
  auf-akzent: "#ffffff"
  grund: "#08090a"
  kopfzeile: "#0c0d10"
  karton: "#0f1013"
  karton-hoch: "#16171c"
  rueck: "#16171c"
  flaeche-2: "#1e1f25"
  text: "#f2f2f0"
  text-2: "#9ca3af"
  text-3: "#7c828d"
  hover: "rgba(255, 255, 255, 0.035)"
  linie: "rgba(255, 255, 255, 0.06)"
  linie-stark: "rgba(255, 255, 255, 0.12)"
  linie-hover: "rgba(255, 255, 255, 0.2)"
  fehler: "#f1a194"
  gewinnt: "#86e0c2"
  verliert: "#f0917c"
  gewinnt-ton: "#35b388"
  verliert-ton: "#d65a44"
  stroh: "#e8a33d"
typography:
  kopf:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.15
  marke:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  bedienung:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1
  abschnitt:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
  etikett:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.1
  kennwert:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1, 'lnum' 1"
  zahl:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: "'tnum' 1, 'lnum' 1"
  kbd:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
rounded:
  r-klein: "6px"
  r: "10px"
  r-gross: "12px"
  kartenbild: "3px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  abschnitt: "28px"
components:
  karte:
    backgroundColor: "{colors.karton}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-gross}"
  knopf-voll:
    backgroundColor: "{colors.akzent}"
    textColor: "{colors.auf-akzent}"
    typography: "{typography.bedienung}"
    rounded: "{rounded.r-klein}"
    padding: "0 14px"
    height: "36px"
  knopf-rand:
    backgroundColor: "{colors.karton-hoch}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-klein}"
    padding: "0 14px"
    height: "36px"
  feld:
    backgroundColor: "{colors.karton-hoch}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-klein}"
    padding: "7px 11px"
    height: "36px"
  suche-knopf:
    backgroundColor: "{colors.karton-hoch}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.r-klein}"
    height: "34px"
  reiter:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.bedienung}"
    rounded: "{rounded.r-klein}"
    padding: "8px 11px"
  reiter-aktiv:
    backgroundColor: "{colors.flaeche-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-klein}"
    padding: "8px 11px"
  etikett:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.etikett}"
    rounded: "{rounded.r}"
    padding: "3px 6px 2px"
  etikett-akzent:
    backgroundColor: "transparent"
    textColor: "{colors.akzent-hell}"
    typography: "{typography.etikett}"
    rounded: "{rounded.r}"
    padding: "3px 6px 2px"
  tafel:
    backgroundColor: "{colors.karton}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-gross}"
  rueck-blatt:
    backgroundColor: "{colors.rueck}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-gross}"
    padding: "16px 16px 14px"
  palette:
    backgroundColor: "{colors.karton}"
    textColor: "{colors.text}"
    rounded: "{rounded.r-gross}"
    width: "560px"
---

# Design System: Letacios Fiesta

## Overview

**Creative North Star: "Das Werkzeug"**

Seit dem 02.11.2026 trägt Fiesta das Design „Werkzeug“, Richtung B aus `specs/features/redesign.md`, im Stil von Linear und Raycast. Abgeleitet ist diese Datei aus `src/index.css` (die Tokens in `:root` sind die echten Werte), `src/main.jsx` (Geist Variable und Geist Mono Variable über Fontsource) und `src/App.jsx`. Fiesta spiegelt Metacoach nicht mehr; die Namen der CSS Variablen stammen noch von dort, ihre Werte sind neu.

Ein zentrierter Rahmen (höchstens 1180 px) mit Kopf (Sombrero, Satzchip, Suchfeld mit ⌘K), darunter die neun Reiter als Pillen in einer Zeile, der Inhalt und die Fußzeile. Unter 760 px liegt eine untere Leiste im Daumenbereich (Decks, Matchups, Matrix, Ladder, More); More öffnet ein Blatt mit den übrigen Reitern (`.mehr-blatt`).

**Key Characteristics:**
- Nur dunkel, warmes Schwarz, flach; Tiefe kommt aus Haarlinien und einer Stufe hellerer Fläche.
- Ein Akzent, Turn Order Blau, nur für Fokus, Kennungen und aktive Wahl.
- Geist für Text und Überschriften, Geist Mono mit Tabellenziffern für jede Zahl.
- Tabellen sind gerahmte Blöcke mit 12 px Radius, Kennzahlen sind Kacheln; kein Zebra.
- Keine Großbuchstaben als Auszeichnung, Labels stehen in normaler Schreibung.
- Details auf der Rückseite der Zeile statt in einer neuen Ansicht.

## Colors

Fast schwarzer Grund, drei Flächenstufen, Weiß in Tönungen als Linie, dazu ein Blau.

### Primary
- **Turn Order Blau** (`akzent`): voller Knopf, Auswahl, Rand eines aktiven Feldes, Ladeband, Textauswahl, Kopienzahlen.
- **Blau Hover** (`akzent-band`): nur Hover des vollen Knopfs.
- **Helles Blau** (`akzent-hell`): blaue Schrift auf dunkler Fläche, Fokusring, Cursor, Raute der Schätzung, aktive Sortierspalte, Links.
- **Blaue Fläche** (`akzent-flaeche`) und **Blauer Rand** (`akzent-rand`): gewählte Zeile, gedrückter Schalter, aktueller Replayschritt.

### Secondary
- **Weiß auf Blau** (`auf-akzent`): Schrift auf vollem Blau.
- **Stroh** (`stroh`, #e8a33d): Sombrero, Favicon, jedes zweite Fähnchen der Girlande, Ladehut und Hut der leeren Zustände, aktiver Reiter auf Seiten ohne Leader. Die Markenfarbe; sie erbt den Akzent nicht.
- **Leaderfarbe** (`--lf1`, `--lf2`, aus `karten.json` Feld `f` über `src/leaderfarben.js`): Rot #e5484d, Grün #30a46c, Blau #3e7bfa, Lila #9b5de5, Gelb #f5c518, Schwarz als Silber #a1a1aa. Nur auf Decklists, Matchups und Mulligan: Farbschein und großes Bild im Leaderkopf, Hauptkachel, Unterstrich des aktiven Reiters, Fähnchen, `theme-color`. Ohne Leader stehen beide auf Stroh.
- **Fiestafarben** (`FIESTA` in `src/leaderfarben.js`): Stroh, Rosa #e05d6f, Grün, Lila, Blau; nur die Girlande auf Seiten ohne Leader.

### Signal
Zwei gedämpfte Töne nur für die Lesart einer Winrate, nie für Flächen der Oberfläche, Knöpfe oder Auswahl.
- **Seegrün** (`gewinnt`, #86e0c2): gewinnt.
- **Ziegelrot** (`verliert`, #f0917c): verliert. Wärmer als Fehlerrot, damit eine schwache Winrate nicht wie ein Fehler aussieht.
- **Tönung** einer Matrixzelle: die satteren Mitteltöne `gewinnt-ton` #35b388 und `verliert-ton` #d65a44 mit höchstens 28 % Deckung (`--ton-max`), Stärke wächst mit dem Abstand von 50 % (`ton` in `src/winrate.js`).

### Neutral
- **Grund** (`grund`, #08090a), **Kopfzeile** (`kopfzeile`, #0c0d10, Spaltenköpfe der Tafeln), **Karton** (`karton`, #0f1013, Rahmen und Tafeln), **Karton hoch** (`karton-hoch`, #16171c, Kacheln, Felder, Rückseite), **Fläche 2** (`flaeche-2`, #1e1f25, aktiver Reiter, geöffneter Chip, Tastenkürzel).
- **Text** (#f2f2f0), **Text 2** (#9ca3af), **Text 3** (#7c828d): drei Stufen. Text 3 hat 5,16:1 auf Grund und ist die schwächste erlaubte Schrift.
- **Linie** (6 % Weiß), **Linie stark** (12 %), **Linie hover** (20 %), **Hover** (3,5 %): die Tönungsleiter aus Weiß; sie ersetzt Zebra (`--zebra` ist `transparent`).
- **Fehlerrot** (`fehler`): nur Fehler.

### Named Rules
**The One Blue Rule.** Turn Order Blau ist die einzige Buntfarbe der Bedienung, und es erscheint nur als Fokus, Kennung oder aktive Wahl, nie als Fläche zur Dekoration. Stroh gehört der Marke.

**The Leader Color Rule.** Die Kartenfarben des Leaders färben Flächen, Ränder, Fähnchen und Punkte, nie eine Zahl, damit Rot und Grün der Karten nicht mit den Signalen der Winrate kollidieren. Farbpunkte (`Farbpunkte` in App.jsx) stehen vor Leadernamen in Matrix, Matchups und ⌘K.

**The Two Signals Rule.** Gut und schlecht einer Winrate stehen in Seegrün und Ziegelrot, sonst nirgends: ab 55 % fett in Seegrün, unter 45 % in Ziegelrot, dazwischen Text 2 (`wrKlasse` und `ton` in `src/winrate.js`). Ohne Wert steht Text 3, nie Rot. Die Matrix tönt jede Zelle in Richtung ihrer Seite; der Spiegel trägt einen Rahmenring. Das Rating im Ranking ist keine Winrate.

**The Hairline Rule.** Trennung durch eine Haarlinie von 1 px oder eine Stufe hellerer Fläche, nie durch Zebra, Verlauf oder Glanz.

## Typography

**Display und Body Font:** Geist Variable (400 bis 600, mit echtem Kursivschnitt, Rückfall `ui-sans-serif`, `system-ui`)
**Zahlenfont:** Geist Mono Variable (`--zahl-font`, Rückfall `ui-monospace`)

**Character:** Geist trägt alles Gelesene, Geist Mono alles Gemessene. Überschriften 600 mit leicht negativem Zeichenabstand. Zahlen tragen die Klasse `z` (500, Tabellenziffern, lining), Kennwerte stehen in Mono. Eine Schätzung (`sch`) steht in Geist kursiv, Text 2, hinter der hellblauen Raute; echte Ladderzahlen stehen aufrecht.

### Hierarchy
- **Kopf** (600, 25px, am Handy 21px): Seitentitel. **Marke** (600, 16px): Name im Kopf.
- **Lead** (400, 16px, höchstens 76ch), **Body** (400, 14.5px; Grundtext), **Klein** (400, 13px).
- **Bedienung** (500, 13.5px): Reiter, Knöpfe, Links, Suchfeld.
- **Abschnitt** (500, 13px, Text 2, mit auslaufender Haarlinie), **Etikett** (500, 11.5px).
- **Kennwert** (Mono 500, 18px, am Handy 17px): Wert einer Kachel (`.kennzeile dd`). **Zahl** (Mono 500, 12.5 bis 14.5px): Zellen und Tabellen. Andere Größen gibt es nur für die freigestellten Fälle in `.impeccable/config.json` (Polish 06.11.2026). Am Handy stehen Eingabefelder auf 16px, damit iOS beim Fokus nicht heranzoomt. **Tastenkürzel** (Mono 500, 11px).

### Named Rules
**The Printed Numbers Rule.** Jede echte Zahl steht in Geist Mono mit Tabellenziffern und ist aufrecht; eine Schätzung steht kursiv in Text 2 hinter der hellblauen Raute.

**The No Caps Rule.** Labels, Spaltenköpfe und Etiketten stehen in normaler Schreibung, ohne `text-transform` und ohne gesperrten Zeichenabstand. Rang entsteht aus Größe, Gewicht und Text 2 gegen Text.

## Layout

- **Rahmen**: Kopf, Reiter, Inhalt (Innenrand 24 px), Fuß mit Stand der Daten und Lesart der Raute. Das ⌘K Suchfeld im Kopf öffnet die Palette (`Palette`, höchstens acht Leader, Pfeile, Enter, Escape); am Handy genügt ein Tipp.
- **Leaderbezogene Reiter** (Decklists, Matchups, Mulligan): links die Leaderleiste (268 px, klebt, nummeriert, mit Suche), rechts Titel mit Kartenbild und Kennzeile aus Kacheln. Unter 960 px wird die Leiste zu einem Knopf.
- **Tafeln**: jede Liste ist eine `ol.tafel` mit `.zeile` und `.vorn`, davor die Spalten auf Kopfzeile. Der Block hat Haarlinie und 12 px Radius. Am Handy fallen die Köpfe weg und die Zeile ordnet sich über `grid-template-areas`, Zahlen tragen dann ihr Label über `data-label`.
- **Rückseite**: Decklisten und Partien klappen die Rückseite unter der Zeile auf (Rückseitenfläche, Haarlinie stark, 12 px Radius, 350 ms). Inhalt entsteht erst beim ersten Öffnen.
- **Matrix**: Tabelle in eigener Scrollfläche, erste Spalte klebt. **Replay Viewer**: Zonenraster, Klassen mit r (`rseite`, `rzone`).
- **Handy**: unter 760 px ist der Rahmen randlos, `.reiter` weicht der unteren Leiste (`.unten-leiste`, Tippziele ab 44 px, `safe-area-inset-bottom`), More öffnet `.mehr-blatt`. Player und Replay haben keinen Platz in der Leiste.

Abstände: 4, 8, 12, 16, 24 und 28 px. Umbrüche: 960 px (Leiste wird Knopf), 760 px (Handy), 639 und 1024 px (Replaybrett), 600 px (Decktabelle).

## Elevation & Depth

Flach. Die Ebenen sind Grund, Karton, Karton hoch und Fläche 2, getrennt von Haarlinien. Aktiver Reiter und gewählte Leaderzeile tragen einen inneren Ring in Linie stark. Schatten tragen nur schwebende Tafeln: Palette und Quellentafel `0 12px 32px rgba(0,0,0,.5)`, die Kartenvorschau `0 18px 50px`, Kleinteile `--schatten` (`0 1px 2px`).

**The Floating Only Rule.** Schatten gibt es nur für Dinge, die über der Seite schweben. Tafeln, Kacheln, Zeilen, Knöpfe und Felder bleiben flach.

## Shapes

**The Three Radii Rule.** 6 px für Reiter, Knöpfe, Felder und Chips (`--r-klein`); 10 px für Kacheln, Etiketten und Balken (`--r`); 12 px für Tabellenblöcke, Rückseiten, Palette und Quellentafel (`--r-gross`). Ausnahmen sind dinghaft: Kartenbilder und Replaykarten 3 px, Tastenkürzel 4 px, Lifestriche 2 px, der Hantelpunkt rund. Ränder sind Haarlinien von 1 px; die Ablage in Analyze und ein fehlendes Kartenbild tragen einen gestrichelten Rand.

## Motion

**The Calm Motion Rule.** Hover und Farbwechsel 150 ms ease out (`--dauer-kurz`), Aufklappen und Erscheinen 350 ms mit `cubic-bezier(0.22, 1, 0.36, 1)` (`--dauer`, `--kurve`). Nichts federt. `prefers-reduced-motion` schaltet Übergänge und Versatz ab. Der Zähler der Kennzeile (`Zaehler`) springt dann auf den Endwert. Zwei Ausnahmen mit Charakter: die Girlande (`src/Girlande.jsx`) flattert einmal 900 ms beim Leaderwechsel, der Ladehut (`.laedt::before`) wippt; beide stehen bei reduzierter Bewegung still.

## Components

- **Knöpfe** (`voll`, `rand`, `leise`): 36 px hoch, 6 px Radius. Voll in Blau, Rand auf Karton hoch mit Haarlinie stark, leise ohne Fläche. Deaktiviert 45 % Deckung.
- **Feld**: Karton hoch, Haarlinie stark, Fokus als Ring in Hellem Blau.
- **Reiter** (`.reiter a`): Pillen, Text 2; aktiv (`aria-current="page"`) Fläche 2 mit innerem Ring. **Untere Leiste** und **More Blatt**: nur am Handy.
- **Kachel** (`.kennzeile`): Wert in Mono 18px, Beschriftung in Text 3, Fläche Karton hoch.
- **Etikett**: Haarlinie stark, Text 2; `akzent` mit blauem Rand und Hellem Blau; `offen` gepunktet in Text 3; `voll` in Blau.
- **Quellenchip** (`.quelle-chip`): öffnet die Quellentafel, geöffnet auf Fläche 2 mit gedrehtem Pfeil.
- **Kartenstreifen**, **Siegkurve**, **Chronik**, **Ereignisliste im Replay**, **Fehlendes Kartenbild**, **Kartenvorschau** (Schleier aus Grund, Dialog mit gefangenem Fokus), **Matrix im Fokus** (`?leader=`, `&sort=`): wie gebaut, Farben aus den Tokens oben.
- **Palette**: Karton, Haarlinie stark, 12 px Radius, Auswahl auf Fläche 2 mit Ring, Eingabe oben, Tastenkürzel als Mono.

## Do's and Don'ts

### Do:
- **Do** jede neue Liste als nummerierte Tafel bauen und am Handy über Rasterflächen umordnen; Listen mit `truncate` brauchen `min-width: 0`.
- **Do** Details auf die Rückseite der Zeile legen statt in eine neue Ansicht.
- **Do** Werte nur über Variablen aus `:root` setzen, keine festen Farben im JSX.
- **Do** bei 390 px messen, dass keine Seite seitlich scrollt.

### Don't:
- **Don't** Blau als Dekoration oder Fläche einsetzen; es markiert Fokus, Kennung, aktive Wahl.
- **Don't** Seegrün und Ziegelrot für etwas anderes als eine Winrate nehmen.
- **Don't** Zebra, Laminatglanz oder Verläufe zurückholen.
- **Don't** Großbuchstaben oder gesperrten Zeichenabstand für Labels nehmen.
- **Don't** große Kartenbilder oder Kartenraster in die Seite bauen; groß zeigen nur das Replaybrett und die Kartenvorschau.
- **Don't** Klassen wie `.feld`, `.karte`, `.mitte`, `.don`, `.partien` oder `.laedt` für eigene Zwecke verwenden.
- **Don't** Art oder Zustand einer Zeile über einen farbigen Strich am linken Rand zeigen; dafür gibt es Etiketten.
