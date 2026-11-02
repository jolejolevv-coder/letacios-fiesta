# Replay Viewer: Gefühl und Funktionen nach dem Vorbild

Entwurf vom 02.11.2026, wartet auf Freigabe. Grundlage: `docs/recherche-github-tools.md`. Unser Viewer bleibt, also Aufbau, Auswertung (`ReplayAnalyse`) und Anbindung an die Spielerseite. Übernommen wird, wie sich das Brett anfühlt und was die Karten tun. Code aus `optcg-data` wird nicht kopiert (keine Lizenz), nachgebaut wird das Verhalten in unserem Design (`DESIGN.md`, Spielhilfe).

## Goal

Das Replay Brett fühlt sich an wie das im Vorbild: größere Karten, die auf Berührung reagieren, ein Klick zeigt Karte oder Zone, und die Bedienung hat dieselben Abkürzungen.

## Scope

In scope (nach dem Vorbild, jeweils gegen den Bestand geprüft: wir haben heute Karten mit 52 Pixel, gedrehte Karten mit 180 ms, Angriffspfeile, Tempo, Zoomstufen, Tastatur im Replay und eine Kartenvorschau außerhalb des Bretts):

1. **Karte anheben:** auf Berührung kleine Verschiebung nach oben und leichte Vergrößerung (beim Vorbild 3 Pixel und 1,03 in 0,15 Sekunden, auf dem Handy aus).
2. **Klick auf eine Karte im Brett:** große Ansicht mit Name, Schließen mit Escape oder Tippen (Kartenvorschau existiert, ist am Brett nicht eingehängt).
3. **Zonen anklicken (Peek):** Deck, Trash, Leben und Hand je Seite öffnen eine Liste. Trash mit oberster Karte zuerst, Leben verdeckt, Hand offen, Deck zeigt die nächsten bekannten Karten und dann den Rest aus der Deckliste ohne Reihenfolge.
4. **Kartenanzeigen:** DON!! Zahl, Powerwechsel mit Vorzeichen (grün und rot), Gegenwehr als "+N", Kampfpower, Statustext.
5. **Hervorhebung:** Angreifer und Ziel mit farbigem Schein (heute Pfeil).
6. **Umschalter:** Hände verbergen (merkt sich der Browser), Seiten tauschen.
7. **Bedienung:** Schieberegler, zugweise vor und zurück, Leertaste, j und k, Pos1 und Ende, Wischen auf dem Handy.
8. **Ereignisliste:** zehn Zeilen bis zum aktuellen Schritt, Arten farblich getrennt (Angriff, Treffer, Gegenwehr, Block, Ende), Sitzabzeichen, Kartenchips im Text.
9. **Deckliste kopieren** im Simulatorformat.

Out of scope: seine Auswahl nach Leaderpaar (eigener Spec), Darstellung als feste Sim Koordinaten, sein Farbschema (dunkel, Gelb) und seine Schrift.

## Acceptance criteria

- [ ] Bestandsaufnahme: je Punkt 1 bis 9 steht im Spec, ob vorhanden, teilweise oder neu.
- [ ] Jeder neue Punkt funktioniert per Maus, Tastatur und Touch. Fokus sichtbar, `prefers-reduced-motion` schaltet Bewegung ab.
- [ ] Das Brett bleibt am Handy bedienbar (Knöpfe mindestens 44 Pixel, kein Seitenscroll).
- [ ] Tests für die Zonenlisten (Trash, Leben, Hand, Deck) gegen die vorhandenen Prüfpartien in `tests/referenz/`.
- [ ] Optik nach `DESIGN.md`, geprüft im Browser in hell und dunkel.

## Implementation plan

Phase 1: Bestandsaufnahme und Layout des Bretts (größere Karten, Anheben), Vorschau am Brett einhängen.
Phase 2: Zonen Peek, Anzeigen auf den Karten, Hervorhebung.
Phase 3: Bedienung (Regler, Tasten, Wischen), Umschalter, Ereignisliste.
Phase 4: Deckliste kopieren, Politur.

## Open questions

* Sollen die Karten insgesamt größer werden (heute 52 Pixel) oder nur das Verhalten kommen?
* Soll die Seitenaufteilung Brett links und Ereignisse rechts (Vorbild, ab 860 Pixel Breite) die heutige Anordnung ersetzen?
* Welche der neun Punkte zuerst?
