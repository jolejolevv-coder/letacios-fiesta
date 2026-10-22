---
name: Letacios Fiesta
description: Die Ladderstatistik im Design der Spielhilfe von Metacoach, ein dunkles Kartonblatt mit blauem Kopfband und nummerierten Zeilen.
basis: ~/Downloads/meta-coach/DESIGN.md (Spielhilfe, 22.10.2026)
colors:
  akzent: "#2c66d6"
  akzent-band: "#3170e0"
  akzent-tief: "#1d4aa6"
  akzent-hell: "#93b3f3"
  akzent-flaeche: "rgba(44, 102, 214, 0.15)"
  akzent-rand: "rgba(44, 102, 214, 0.55)"
  stroh: "#e8a33d"
  grund: "#0b0c0f"
  karton: "#16181d"
  karton-hoch: "#1c1f25"
  rueck: "#111929"
  text: "#ece7dc"
  text-2: "#aca79c"
  text-3: "#8a867e"
  zebra: "rgba(236, 231, 220, 0.03)"
  hover: "rgba(236, 231, 220, 0.045)"
  linie: "rgba(236, 231, 220, 0.085)"
  linie-stark: "rgba(236, 231, 220, 0.17)"
  fehler: "#f1a194"
typography:
  kopf: "Saira Semi Condensed 600, 25px (Handy 21px)"
  marke: "Saira Semi Condensed 700, 19px (Handy 16px)"
  zahl: "Saira Semi Condensed 500, 13.5px, tabular-nums"
  label: "Saira Semi Condensed 600, 11 bis 12.5px, Versalien, 0.1em"
  body: "Source Sans 3 Variable 400, 15px/1.45"
rounded:
  r: "10px"
  kartenbild: "3px"
---

# Design System: Letacios Fiesta

## Overview

Fiesta trägt seit dem 22.10.2026 das Design "Spielhilfe" von Metacoach. Abgeleitet ist diese
Datei aus dem, was gebaut ist: `src/index.css` beginnt mit der unveränderten CSS von
`meta-coach/web/src/index.css`, darunter folgen die Ergänzungen aus der Vorschau
(`.impeccable/vorschau/fiesta.css`) und die Teile, die nur Fiesta hat (Quelle im Band,
Matchups, Ranking, Spielerseite, Changelog, Analyze, Replaybrett). Für Farben, Schrift,
Rundung, Schatten und die Regeln dahinter gilt das DESIGN.md von Metacoach; hier steht nur,
was Fiesta daraus macht und was es zusätzlich hat.

Ein zentriertes Blatt (höchstens 1180 px) mit blauem Kopfband, darunter die neun Reiter, der
Inhalt und eine Fußzeile mit Stand der Daten und der Lesart der Raute. Am Handy (unter 760 px)
wird das Blatt randlos, die Reiter stehen in zwei Zeilen (fünf und vier) mit Kurznamen.

## Colors

Genau eine Buntfarbe, Turn Order Blau, mit ihren Abstufungen; dazu Papierweiß in drei Stufen
auf fast schwarzem Karton. Die einzige zweite Farbe ist das **Stroh** (`#e8a33d`) des Sombreros
im Kopfband, in der Anmeldung und im Favicon. Gut und schlecht stehen nie in Grün und Rot:
eine Winrate ist fett in Papierweiß ab 55 %, normal in Bleistift dazwischen und blass unter
45 % (`wrKlasse` in `App.jsx`, Konstanten `GUT` und `SCHWACH`). Das gilt für Decklisten,
Leaderleiste, Matchups, Matrix, Ranking, Ladder, Mulligan und Spielerseite.

Wo früher Farbe war, steht jetzt Helligkeit oder Strich:
- Matrix: Zellen ohne Farbfläche, fett, normal oder blass; der Spiegel trägt einen Rahmenring.
- Ranking: das Rating fett ab 8,5, blass unter 7.
- Partien: W als blaues Etikett, L als graues.
- Replay: Life als hellblaue Striche, Angriffspfeil in Hellem Blau mit dunklem Saum, die Art
  eines Ereignisses über die Helligkeit des linken Strichs.
- Fehler stehen in Fehlerrot (`--fehler`), sonst nichts.

## Typography

Saira Semi Condensed (Fontsource, 400 bis 700) für Marke, Titel, Labels und jede Zahl;
Source Sans 3 Variable (aufrecht und kursiv) für Sätze. Zahlen in Zellen tragen die Klasse
`z` (Tabellenziffern), im Replay `zahl`. Schätzungen aus dem Wertnetz stehen kursiv mit
hellblauer Raute (`sch`), echte Ladderzahlen aufrecht (`z`).

## Layout

- **Leaderbezogene Reiter** (Decklists, Matchups, Mulligan): links die Leaderleiste (268 px,
  klebt beim Scrollen, nummeriert, mit Suche und Sortierschalter), rechts Titel mit Kartenbild
  36 px und Kennzeile, darunter der Inhalt. Unter 960 px wird die Leiste zu einem Knopf mit dem
  gewählten Leader, die Liste klappt darunter auf.
- **Tafeln**: jede Liste ist eine `ol.tafel` mit `.zeile` und `.vorn`, Spaltenköpfe in
  `.tafel-spalten.spalten` (sortierbare Köpfe sind Knöpfe, aktiv in Hellem Blau mit Pfeil).
  Am Handy fallen die Köpfe weg und die Zeile ordnet sich über `grid-template-areas` in zwei bis
  drei Zeilen, Zahlen tragen dann ihr Label über `data-label`.
- **Rückseite**: Decklisten und Partien drehen sich beim Tipp um und zeigen darunter die
  Rückseite (Liste nach Namen in zwei Spalten, Record, Std. error, Duration, Copy decklist,
  Played by; bei Partien Watch replay und raw log). Inhalt entsteht erst beim ersten Öffnen.
- **Matrix**: Tabelle in eigener Scrollfläche, erste Spalte klebt. Am Handy zeigt sie zuerst die
  Top 8, ein Knopf holt alle gewählten.
- **Ladder**: eine Zeile je Spieler mit Bounty und bis zu drei Leadern aus den Daten (der erste
  mit Name). Games, Win rate und Time erscheinen nur, wenn die Daten Partien führen
  (`mitZahlen`), seit OPBounty 2.7 also nicht.
- **Guide**: Schritte mit Nummernfeld und Faden wie das Book von Metacoach, Hilfezeilen mit
  Zeichen (Karte, Hand, Schwert, Schild, Krone), rechts die Seitenleiste mit Zeichen, Lesart,
  Sprung zu Zug und Quelle.
- **Analyze my replay**: ohne Log drei nummerierte Schritte (finden, speichern, öffnen); mit Log
  zuerst Analysis (Accuracy beider Spieler, Noten als Etiketten), dann die Siegkurve als Fläche
  mit 50 % gestrichelt und Fehlerstrichen, dann die nummerierte Tafel der Entscheidungen. Das
  Brett des Replay Viewers liegt darunter aufklappbar (`details.allezahlen`).
- **Replay Viewer**: funktional unverändert. Steuerleiste aus Randknöpfen (am Handy 44 px),
  Analyse über dem Brett, Brett im Zonenraster. Seine Klassen tragen ein r (`rseite`, `rzone`,
  `rmitte`, `rkarten`, `rhand`, `rkopf`), damit sie nicht mit Feld, Karte und Mitte der
  Spielhilfe zusammenstoßen.
- **Kopf**: Marke mit Sombrero links, rechts der Quellenchip mit Satz und Partienzahl; er öffnet
  eine Tafel im Stil einer Rückseite (Ready sets oder Date range, Queue, Bounty). Unter den
  Reitern läuft beim Laden ein blaues Band.
- **Anmeldung**: ein kleines Blatt mit Sombrero 72 px, Name, Passwortfeld und vollem Knopf.

## Components

Aus Metacoach übernommen und unverändert: Blatt, Band, Reiter, Abschnitt mit auslaufender Linie,
Kartenbild im Rahmenring, Etikett, Balken, Hantel, Drehknopf, Rückseite, Tab, Segmentwahl
(`sitzwahl`, `schalter`), Knöpfe (`voll`, `rand`, `leise`), Feld, Notiz, Meldung, Schritte und
Hilfezeilen, Seitenleiste. Die Zeichen sind SVG Striche (`Zeichen` in `App.jsx`, dieselben Pfade
wie in `meta-coach/web/src/teile.tsx`).

Nur in Fiesta:
- **Kartenstreifen** (`.streifen`): die Deckliste als Reihe aus 20 px Kartenbildern mit blauer
  Kopienzahl unten rechts, am Handy 19 px.
- **Quelle im Band** (`.quelle-chip`, `.quelle-tafel`).
- **Siegkurve** (`Siegkurve`): blaue Linie über Blauer Fläche, 50 % gestrichelt.
- **Chronik** (`.chronik`): Changelog mit Datum links in Hellem Blau und gestreiften Punkten.

## Do's and Don'ts

- **Do** jede neue Liste als nummerierte Tafel bauen und am Handy über Rasterflächen umordnen;
  Listen mit `truncate` brauchen `min-width: 0` auf Raster und Kindern.
- **Do** Details auf die Rückseite der Zeile legen statt in eine neue Ansicht.
- **Do** bei 390 px messen, dass keine Seite seitlich scrollt (`.impeccable/review/aufnahmen.py`).
- **Don't** Grün und Rot einführen, auch nicht für Sieg und Niederlage.
- **Don't** große Kartenbilder oder Kartenraster bauen; Kartenbilder bleiben 16 bis 36 px, nur
  das Replaybrett zeigt Karten groß, weil es ein Spieltisch ist.
- **Don't** Klassen wie `.feld`, `.karte`, `.mitte`, `.don`, `.partien` oder `.laedt` für
  eigene Zwecke verwenden; sie gehören der Spielhilfe.
