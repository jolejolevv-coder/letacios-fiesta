# Kaizoku Daten: wo sie in die vorhandenen Reiter passen

Stand 02.11.2026. Gebaut sind die Abrufe (Stufen A, B, C) und ein eigener Reiter "Kaizoku" sowie ein Abschnitt auf der Spielerseite. Diese Datei sagt, wo die Daten in die **bestehenden** Reiter gehören, wenn du sie dort statt (oder zusätzlich zu) dem eigenen Reiter willst. Nichts davon ist gebaut.

Grundregel: Kaizoku und unsere Zahlen kommen aus verschiedenen Quellen und Stichproben. Sie dürfen nebeneinander stehen, aber nie in einer Zahl vermischt werden. Jede Stelle trägt den Quellenhinweis.

| Datei | Inhalt | Passt in | Wie |
|---|---|---|---|
| `kaizoku.json.gz` (A) | je Leader Partien, rohe und gewichtete Siegquote, Spielrate, First/Second, Gegnerliste | **Ranking** | Spalte "Kaizoku weighted" neben unserer Wertung, sortierbar |
| | | **Matchups** | Zeile je Gegner bekommt "Kaizoku" als zweite Zahl (Partien und Siegquote) zum Vergleich |
| | | **Matrix** | Umschalter "Source: ours / Kaizoku", dieselbe Matrix, andere Quelle |
| | Decklisten je Leader mit Bilanz je Gegnerleader | **Decklists** | Umschalter "Source: ours / Kaizoku" oder Kaizoku Listen unter unseren. Das Record klappt die Bilanz je Gegner auf (hier fehlt sie in unseren Daten, weil die Quelle nur Summen führt). Der Schlüssel `deckSchluessel` passt, so lassen sich gleiche Listen beider Quellen verbinden |
| `kaizoku_b.json.gz` (B) `karten` | Nutzung und Siegquote je Karte im Deck | **Analysis / Mulligan** | neben unseren Kartenwerten, oder im Deckreiter als "In X % der Decks" an jeder Karte |
| `hand` | häufigste Karten in der Starthand | **Mulligan** | Vergleich mit unseren Starthandzahlen |
| `kurve` | häufigste Spielzüge je Zug und Seite | **Guide** und die Zugauswertung (`zuglager.js`) | als Vergleichsspalte "Kaizoku: häufigster Zug" |
| `tech` | Karten, die gegen einen Gegner besonders helfen (nur starke Belege) | **Matchups** | unter dem Gegner: "Tech: A, B, C" |
| `kaizoku_spieler.json.gz` (C) | Decklisten und Bilanz je Gegnerleader der Top 100 | **Spielerseite** (gebaut) und **Decklists** "Played by" | zusätzliche Quelle für "wer spielt diese Liste", wo unsere letzten neun Partien nichts hergeben |

Empfohlene Reihenfolge: Ranking Spalte (klein), Decklists Umschalter (der größte Gewinn wegen der Bilanz je Gegner), Matchups mit Tech, danach Matrix.

## Grenzen

* **Stufe C deckt nur einen Teil.** In einer Probe von 20 Spielern der Top 100 wurden 5 zugeordnet. Bei den anderen findet die Suche keinen Namen: Kaizoku sieht nur Partien aus dem Simulator, und viele spielen im offiziellen Client. Das ist keine Fehlzuordnung, sondern fehlende Daten. Zwei weitere Treffer wurden verworfen, weil keiner ihrer Leader zu dem Spieler der Bestenliste passte.
* **Die Quelle ist die von Kaizoku, nicht die von OPBounty.** Die Stichprobe ist eine andere (Simulator, letzte Woche) und die gewichtete Quote ist deren eigene Rechnung ohne veröffentlichte Formel.
* **Das Format kann sich ohne Ankündigung ändern.** Jeder Abruf prüft die Form und bricht bei Unsinn ab; die Seite zeigt dann den Reiter ohne Daten, der Rest läuft weiter.
* **Datenschutz bei Stufe C:** Es gehen die Namen der Top 100 an Kaizoku. Das Ergebnis liegt nur verschlüsselt in der Seite, nicht im Repo, und im Log stehen nur Zahlen.
