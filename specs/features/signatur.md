# Signatur „Fiesta in Leaderfarbe“

Stand 02.11.2026, freigegeben und gebaut. Vorschau: `.impeccable/vorschau/signatur-2.html`
(lokal), erste Runde mit vier Richtungen in `.impeccable/vorschau/signatur.html`.

## Goal

Fiesta bekommt ein unverwechselbares Gesicht aus zwei Quellen: die Marke Fiesta (Sombrero in
Stroh, Girlande aus Papel Picado, wippender Hut, freundliche leere Zustände) und die Kartenfarben
des gewählten Leaders, die alles färben, was zu ihm gehört.

## Entscheidungen des Nutzers (02.11.2026)

Richtung 1 (Leaderfarbe) und 3 (Fiesta Marke) ja. Richtung 2 (Bounty Plakat) nein, „tacky“.
Richtung 4 nein. Neue Ideen erwünscht, gesammelt in der Vorschau unter „Was ich noch überlegt habe“.

## Rollen der Farben

* Leaderfarbe (`--lf1`, `--lf2` aus `karten.json` Feld `f`: r, g, b, p, y, s): Farbschein und
  großes Leaderbild im Kopf, Hauptkachel, Unterstrich des aktiven Reiters, Fähnchen der Girlande,
  `theme-color` am Handy. Nie auf Zahlen, damit Rot und Grün der Karten nicht mit den Signalen der
  Win rate kollidieren. Schwarz (s) wird als Silber `#a1a1aa` gezeigt.
* Stroh `#e8a33d`: Marke. Sombrero, jedes zweite oder dritte Fähnchen, leere Zustände, Ladezeichen,
  aktiver Reiter auf Seiten ohne Leader.
* Blau `--akzent`: nur noch Fokusring und Auswahl in Feldern.
* Seegrün und Ziegelrot: unverändert nur für Win rates.

## Scope

* In scope:
  * Leaderseiten (Decklists, Matchups, Mulligan, Guide, Analyze): Kopf mit Farbschein, großes
    Leaderbild weich angeschnitten, Farbpunkte und Farbnamen unter dem Titel, Hauptkachel getönt,
    aktiver Reiter mit Unterstrich in Leaderfarbe, am Handy Leaderknopf getönt und untere Leiste.
  * Girlande aus Papel Picado über dem Kopf, als SVG, Fähnchen in Leaderfarben und Stroh, auf
    Seiten ohne Leader in Fiestafarben. Beim Wechsel des Leaders flattert sie einmal.
  * `theme-color` folgt der Leaderfarbe.
  * Farbpunkte vor den Leadernamen in Matrix, Matchups und in der ⌘K Suche.
  * Ladezeichen: wippender Sombrero statt Text. Leere Zustände mit Hut und Fiestaton, sachlich,
    mit Hinweis, was man tun kann (Texte englisch).
  * Doku: `DESIGN.md`, `.impeccable/design.json`, Changelog.
* Out of scope:
  * Bounty Plakat, neue Schrift, helles Thema.
  * Datenpipeline, Datenformate, Rechenlogik.
  * Hutband in Leaderfarbe und Konfetti, solange nicht freigegeben (siehe Open questions).

## Acceptance criteria

- [x] Auf jeder Leaderseite tragen Kopf, Hauptkachel, aktiver Reiter und Girlande die Kartenfarben
      des Leaders; zweifarbige Leader als Verlauf und abwechselnde Fähnchen.
- [x] Keine Zahl ist in Leaderfarbe gesetzt; Win rates bleiben Seegrün, Ziegelrot oder neutral.
- [x] Seiten ohne Leader zeigen die Girlande in Fiestafarben und den aktiven Reiter in Stroh.
- [x] Am Handy färbt sich die Browserleiste (`theme-color`) mit dem Leader.
- [x] Die Girlande flattert beim Leaderwechsel einmal, bei `prefers-reduced-motion` gar nicht.
- [x] Ladezustände zeigen den wippenden Hut, alle `leer-satz` Texte sind überarbeitet.
- [x] Kontrast von Text auf getönten Flächen mindestens 4.5.
- [x] Kein seitliches Scrollen am Handy außer Matrix und Replaybrett.
- [x] Kein messbarer Leistungsverlust: Girlande als SVG ohne Bilder, keine neue Schrift.
- [x] `npm test` und `npx vite build` grün, Prüfung bei 1440, 1100 und 375 px.

## Implementation plan

Phase 1: Leaderfarben aus `karten.json` als Funktion `leaderFarben(id)` mit Test; CSS Variablen
`--lf1`, `--lf2` am Wurzelelement, Kopf, Hauptkachel, Reiter, Handy Leaderknopf, `theme-color`.
Phase 2: Girlande als Komponente mit Flattern, Fiestafarben auf Seiten ohne Leader.
Phase 3: Farbpunkte in Matrix, Matchups und Suche; Ladehut und leere Zustände.
Phase 4: Prüfung, Doku, Changelog, PR.

## Open questions

- Hutband des Sombreros in Leaderfarbe? Empfehlung: nein, die Marke bleibt ganz Stroh.
- Konfetti beim neuen Datentag? Empfehlung: nein, nutzt sich beim täglichen Besuch ab.
- Großes Leaderbild: die lokalen Bilder tragen „SAMPLE“; live prüfen, ob die echten Bilder als
  Hintergrund ruhig genug wirken.
