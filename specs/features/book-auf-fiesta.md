# Book auf Fiesta

Spec vom 22.10.2026, freigegeben am selben Tag mit dem direkten Weg. Gehört zu
`~/Downloads/meta-coach/specs/features/phase6-book.md` (Book aus Phase 6c) und ist die
Grundlage für `eigenes-replay-analysieren.md`.

## Goal

Fiesta zeigt das Book von Metacoach (was spiele ich in welchem Zug, wie verteidige ich, Mulligan)
für jeden Leader mit Book. Fiesta holt es direkt bei Metacoach ab, damit es nicht ins Repo von
Fiesta muss.

## Wunsch des Nutzers vom 22.10.2026

* Das Book soll auch auf Fiesta laufen; alles andere bleibt auf Metacoach.
* Möglichst nicht ins Repo hochladen, sondern „von Metacoach selber abfragen“.
* Falls doch das Repo: einmal wöchentlich reicht.
* Der hergeleitete Windows Pfad für die Logs ist in Ordnung (betrifft `eigenes-replay-analysieren.md`).

## Weg der Daten: direkt von Metacoach (Empfehlung)

* Nach dem Nachtschritt `book` verschlüsselt ein neuer Schritt `fiesta_book` jede Book Datei
  mit dem Verfahren und dem Salz von Fiesta (`verschluesseln.py` aus dem Fiesta Repo, Passwort
  aus `~/.fiesta_passwort`, wie `tools/fiesta_analyse.py`). Ablage auf dem Bazzite unter
  `ergebnisse/fiesta/book/<leader>.json.gz.enc` und `_leader.json.gz.enc`.
* Metacoach liefert diese Dateien unter `https://meta.nahobinoco.com/fiesta/book/<datei>` aus,
  **ohne Anmeldung**, weil sie nur Geheimtext sind: lesen kann sie nur, wer das Passwort von
  Fiesta hat, also genau die Leute, die Fiesta ohnehin sehen. Die Route liefert nur Dateien aus
  diesem einen Ordner (Name gegen eine feste Form geprüft, kein Pfad), nur GET, mit CORS allein
  für `https://fiesta.nahobinoco.com`.
* Ändert sich das Salz von Fiesta (neues Passwort), verschlüsselt der Schritt in der nächsten
  Nacht neu; bis dahin zeigt Fiesta „Book currently unavailable“.

Tradeoffs gegenüber dem Repo:

* **Plus:** Das Repo wächst nicht (wöchentlich wären es rund 5 MB je Fassung, nachts rund
  150 MB im Monat). Das Book ist jeden Morgen frisch, nicht nur einmal pro Woche.
* **Minus:** Das Book auf Fiesta hängt am Bazzite und am Cloudflare Tunnel. Ist der Server aus,
  zeigt Fiesta den Book Reiter mit einem Hinweis, der Rest von Fiesta läuft weiter wie heute.
* **Minus:** Metacoach bekommt seine erste Route ohne Anmeldung. Sie gibt nur Geheimtext
  heraus, keine Klartextdaten und keine Schnittstelle. Wer ohne Passwort Kartennummern als
  Dateinamen errät, erfährt nur, dass es für diesen Leader ein Book gibt.

Rückfall, falls der direkte Weg nicht gewünscht ist: derselbe Schritt pusht einmal pro Woche
nach `public/book/` im Servercheckout, wie heute `analyse/` und `mulligan/`.

## Anzeige in Fiesta

* Neuer Reiter **Book** (englisch, im Stil von Fiesta, ohne neues Design; Entscheidung vom
  20.10.2026). Leaderwahl wie im Mulligan Reiter, dazu Gegner und Sitz.
* Inhalt wie das Book in Metacoach, in Sätzen: Mulligan (aus dem ganzen Feld, Behalten und
  Mischen), je eigenem Zug 1 bis 7 Spielen, Angreifen, Verteidigen im Zug des Gegners, was die
  starken Spieler anders machen. Zahlen klein dahinter.
* Die Satzbausteine aus `meta-coach/web/src/saetze.ts` werden nach `src/book.js` übertragen,
  auf Englisch, mit denselben Grenzen (Standard Play ab 90 %, Wert über 1 Punkt, halten unter
  minus 2,5, Mulligan Abstand 3 Punkte, mindestens 30 Partien je Zelle).
* Changelog Eintrag am Tag, an dem der Reiter sichtbar wird.

## Out of scope

* Übersicht, Spickzettel, Mein Spiel, Metas bleiben nur auf Metacoach.
* Metacoach selbst ändert sein Book nicht.
* Analyze my replay (eigene Spec, baut hierauf auf und holt das Wertnetz auf demselben Weg).

## Acceptance criteria

* [ ] Die Route liefert nur Dateien aus `ergebnisse/fiesta/book/`, ohne Anmeldung, nur GET,
      CORS nur für Fiesta; jeder andere Name gibt 404. Tests in Metacoach.
* [ ] Eine von Metacoach verschlüsselte Datei entschlüsselt Fiesta mit dem normalen Passwort
      (Test mit festem Passwort und Salz auf beiden Seiten).
* [ ] Der Book Reiter zeigt für Rocks.D.Xebec gegen Kaido first und second dieselben Ratschläge
      wie das Book in Metacoach (gleiche Karten, gleiche Grenzen), nur englisch.
* [ ] Ist Metacoach nicht erreichbar, zeigt der Reiter einen Hinweis, alle anderen Reiter
      laufen unverändert.
* [ ] Am Handy kein seitliches Scrollen.
* [ ] Im Repo von Fiesta liegt kein Book.

## Implementation plan

1. Metacoach: Nachtschritt `fiesta_book` nach `book`, Route `/fiesta/book/{datei}` mit CORS,
   Tests.
2. Fiesta: `holen` um eine fremde Basis erweitern (`metacoachHolen`), `src/book.js` mit den
   englischen Sätzen und Tests, Reiter Book.
3. Abnahme gegen Metacoach an zwei Matchups, Changelog Eintrag, Push nach Freigabe.

## Open questions

* keine; direkter Weg gewählt.
