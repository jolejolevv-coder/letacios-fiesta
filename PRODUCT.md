# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Eine kleine Gruppe von One Piece TCG Spielern, die das Seitenpasswort kennt. Sie öffnen Fiesta
am Handy und am Rechner, oft neben dem Spiel oder kurz vor einer Partie. Vier Aufgaben, alle
gleich wichtig: einen Leader und eine Liste wählen, ein Matchup nachsehen (first oder second),
Bestenliste und Spieler ansehen, Replays guter Spieler und eigene Partien nachspielen.

## Product Purpose

Fiesta zeigt die Ladderstatistik von OPBounty als eigene Seite: Decklisten und Matchups je
Leader, die Matrix, Rankings, die Top 100 der Western Ladder, Spielerseiten, Mulligan und Guide
aus Metacoach, die Analyse eigener Logs und einen Replay Viewer. Erfolg heißt: die Antwort auf
"was spiele ich, und wie spiele ich es gegen dieses Deck" steht nach wenigen Sekunden da, am
Handy wie am Rechner.

## Positioning

Fiesta zeigt, was der OPBounty Client selbst nicht zeigt: den Sitzsplit first und second,
tagesgenaue Zeiträume statt fertiger Sätze, die Leaderaufstellung der Top 100 und einen Replay
Viewer mit Angriffspfeilen. Fiesta und Metacoach sehen seit dem 22.10.2026 gleich aus: dieselbe
Spielhilfe, zwei Werkzeuge.

## Design Direction

Fiesta folgt der Richtung "Spielhilfe" von Metacoach (`~/Downloads/meta-coach/DESIGN.md`): die
laminierte Kurzreferenz, die neben der Playmat liegt. Ein dunkles Kartonblatt mit blauem
Kopfband, darunter nummerierte Zeilen mit Zebra, Zahlen rechtsbündig in Saira, Details auf der
Rückseite einer Zeile statt in neuen Ansichten. Abgelehnt sind Kacheln, Kartenraster mit großen
Bildern und gute oder schlechte Werte in Grün und Rot. Was gebaut ist, beschreibt `DESIGN.md`.

## Operating Context

* Daten: öffentliche Tagesstatistik vom CDN des Spiels (`aktualisieren.py`), die Bestenliste
  vom Bildschirm des echten Clients auf dem Bazzite (seit OPBounty 2.7 per OCR), Replays aus
  Firestore, Mulligan, Guide und Wertnetz aus Metacoach.
* Jeden Morgen baut die GitHub Action neu, verschlüsselt alles und lädt es auf GitHub Pages.
* Spielbegriffe bleiben englisch: Leader, first, second, bounty, matchup, win rate, mulligan.

## Capabilities and Constraints

* React 18, Tailwind 4, GSAP, Vite; die Oberfläche steckt in `src/App.jsx`, das Aussehen in
  `src/index.css` (Grundlage ist die CSS von Metacoach, darunter die Ergänzungen für Fiesta).
* Schriften als Fontsource Pakete: Saira Semi Condensed (400 bis 700) und Source Sans 3 Variable.
* Die ganze Seite liegt AES verschlüsselt hinter einem Passwort und ist nicht für Suchmaschinen
  gedacht (`noindex`).
* Rund 2200 Kartenbilder, 120 Pixel breit; gezeigt werden sie klein (16 bis 36 Pixel), als
  Streifen und neben Namen.
* Bindend: die Oberfläche bleibt englisch, kein Reiter fällt weg, am Handy scrollt keine Seite
  seitlich (nur die Matrix und das Replaybrett in ihrer eigenen Fläche), und nichts darf die
  Ladezeit am Handy merklich verschlechtern.

## Brand Commitments

* Name "Letacios Fiesta". "Letacios" ist ein Insider Witz der Gruppe und wird auf der Seite
  nicht erklärt.
* Die Marke ist ein flacher, geometrischer Sombrero in Strohgelb `#e8a33d` (`src/Sombrero.jsx`,
  auch das Favicon). Sein Stroh ist die einzige zweite Farbe neben Turn Order Blau.
* Die Seite bleibt nur dunkel.

## Evidence on Hand

Echte Daten aus der Ladder, Kartenbilder, Replays. Keine Zitate, Kunden oder Auszeichnungen;
nichts davon wird erfunden.

## Product Principles

1. Die Zahl zuerst: jede Ansicht beantwortet eine Frage, bevor sie schmückt.
2. Handy und Rechner sind gleichwertig.
3. Jede Liste ist nummeriert und gestreift; Details stehen auf der Rückseite der Zeile.
4. Schätzungen kursiv mit Raute, echte Ladderzahlen aufrecht.
5. Schnell bleibt Pflicht.
