# Angriffspfeile im Replay

Entwurf vom 30.09.2026, am selben Tag freigegeben und umgesetzt.

## Goal

Im Replay zeigt ein Pfeil vom Angreifer zu seinem Ziel, solange ein Angriff laeuft, damit
man auf dem Brett sieht, wer wen angreift, statt es in der Ereigniszeile zu lesen.

## Datenlage, am 30.09.2026 nachgesehen

Jede Angriffszeile im Log nennt beide Karten, der Angreifer zuerst:

    [You] Dracule Mihawk [OP14-020] attacking Nico Robin [OP09-062]

`schritteBauen` in `src/App.jsx` wertet diese Zeile heute schon aus, um den Angreifer zu
resten (`restenNachId`). Danach folgen bis zum Ende des Kampfs Zeilen wie "Blocks",
"Counter", "vs" und genau eine Ergebniszeile. Gezaehlt ueber alle lokalen Replays:
"Attack Fails" 3574, "hit for" 2923, "Destroyed" 2265, "Blocks" 358. Bei Banish steht
statt "hit for" die Zeile "Trash ... from Life".

## Scope

**In scope**

* Pfeil vom Angreifer (Leader oder Charakter) zum Ziel (Leader oder Charakter), ueber
  beide Brettseiten hinweg.
* Blockt ein Charakter, springt die Pfeilspitze auf den Blocker.
* Der Pfeil steht vom Angriffsschritt bis einschliesslich der Ergebniszeile, dann
  verschwindet er. Ein neuer Angriff oder "End Turn" beendet ihn ebenfalls.
* Funktioniert beim Schrittweise Klicken, beim Abspielen und in allen Zoomstufen,
  auch auf dem Telefon und wenn das Brett seitlich gerollt wird.

**Out of scope**

* Pfeile fuer Effekte (K.O. durch Effekte, Bounce, Don anlegen).
* Eine Animation, die den Pfeil zeichnet. Er erscheint einfach, und wer weniger
  Bewegung eingestellt hat, sieht ohnehin keine.

## Entscheidungen, die ich vorschlage

* **Welcher Platz, wenn dieselbe Karte zweimal liegt:** Angreifer ist der Platz, den
  `restenNachId` gerade restet. Ziel ist der erste gerestete Platz mit dieser Karte,
  denn angreifen darf man laut Regelwerk nur den Leader oder gerestete Charaktere.
* **Farbe:** ein eigenes Orange (`--angriff`, #ff9f0a). Blau steht auf der Seite fuer
  den eigenen Spieler, Rot fuer Niederlagen; beides waere doppelt belegt.
* **Tests:** Im Frontend gibt es noch keinen Testlauf. `schritteBauen` und seine
  Hilfsfunktionen ziehen dafuer aus `src/App.jsx` in eine eigene Datei `src/replay.js`
  um, unveraendert bis auf den neuen Teil, und werden mit dem eingebauten Testlauf von
  Node geprueft (`node --test`, Skript `npm test`). Kein neues Paket. Tradeoff: ein
  Umzug von rund 300 Zeilen, dafuer ist die Replay Logik zum ersten Mal testbar.
* **Technik:** eine SVG Ebene ueber beiden Brettern. Die Kartenplaetze bekommen ein
  Datenattribut, die Ebene misst deren Lage nach jedem Schritt und bei Groessenaenderung
  neu. Kein neues Paket.

## Acceptance criteria

- [x] Beim Angriffsschritt zeigt ein Pfeil vom Angreifer auf das Ziel, auch vom Leader
      auf den gegnerischen Leader.
- [x] Nach "Blocks" zeigt die Spitze auf den Blocker.
- [x] Nach der Ergebniszeile ("hit for", "Destroyed", "Attack Fails", "from Life") ist
      der Pfeil im naechsten Schritt weg.
- [x] Liegt dieselbe Karte zweimal auf dem Brett, zeigt der Pfeil auf den richtigen
      Platz (Angreifer: der gerade gerestete; Ziel: der gerestete).
- [x] Der Pfeil sitzt richtig in allen Zoomstufen, nach dem Rollen des Bretts und auf
      375 Pixel Breite.
- [x] Tests fuer die Zuordnung in `schritteBauen`: einfacher Angriff, Leader auf
      Leader, Block, doppelte Karte, Ende nach der Ergebniszeile.
- [x] Im Browser an einem echten Replay geprueft.

## Implementation plan

**Phase 1, Daten.** `schritteBauen` haengt an jeden Schritt eines laufenden Kampfs ein
Feld `angriff` mit Seite und Platz von Angreifer und Ziel. Tests dazu.

**Phase 2, Anzeige.** Datenattribute an den Kartenplaetzen in `Brett`, die SVG Ebene im
Replay, Farbe als Token. Pruefung im Browser an einem echten Replay, Desktop und
Telefonbreite.

## Ergebnis, 30.09.2026

`schritteBauen` und seine Helfer liegen jetzt in `src/replay.js`, zehn Tests in
`tests/replay.test.js` (`npm test`). Gegen alle 373 lokalen Replays geprueft: 8957 von
9122 Angriffszeilen bekommen einen Pfeil, und bei keinem zeigt ein Ende auf eine andere
Karte als die in der Zeile genannte. Nach jeder Ergebniszeile ist der Pfeil im naechsten
Schritt weg, ohne Ausnahme. 330 von 358 Blocks setzen die Spitze auf den Blocker.

Drei Dinge kamen bei dieser Pruefung heraus, alle behoben:

1. **Das Ziel verschwand schon beim Angriff.** Das Spiel schreibt die Bewegung einer
   zerstoerten Karte in den Trash direkt hinter die Angriffszeile, noch vor "vs" und
   "Destroyed". Bei 872 Angriffen. Jetzt bleibt die Karte bis zum Kampfende verblasst
   an ihrem alten Platz stehen (ein "Geist", nur Anzeige), und der Pfeil zeigt auf sie.
   Der Stand selbst ist unveraendert.
2. **Spiegel und Promos.** Die Kartenliste einer Zeile fuehrt jede Nummer nur einmal,
   bei "Mihawk attacking Mihawk" fehlte das Ziel (808 Faelle). Promonummern wie P-107
   erkannte das Muster nicht. Die Angriffszeile wird jetzt selbst gelesen.
3. **Falsche Angriffe.** "... is no longer blocked from attacking" zaehlte als Angriff
   und restete die Karte, ein Fehler aus der Zeit vor den Pfeilen. Das Muster verlangt
   jetzt "] attacking ".

Im Browser geprueft an einem echten Replay: Leader auf Leader, Leader auf zerstoerten
Charakter, Charakter auf Charakter, Block mit anschliessend zerstoertem Blocker, dazu
375 Pixel Breite, Zoom 200 Prozent und seitlich gerolltes Brett.

**Bekannte Luecke.** Die restlichen rund 100 Angriffe ohne Pfeil stammen aus aelteren
Logs, in denen die Sprecher "You" und "Opponent" heissen statt wie die Spieler. Dort
stimmen schon die Restmarken nicht; das ist ein eigenes Thema.

## Open questions

- Keine.
