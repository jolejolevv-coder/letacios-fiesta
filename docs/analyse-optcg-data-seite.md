# Analyse der Seite optcg-data.pages.dev: was wir übernehmen können

Stand 02.11.2026. Gelesen wurde die öffentliche Seite (Stand "Last updated 2026-11-01") und ihr Quellcode auf GitHub, nichts ausgeführt, nichts heruntergeladen. Die Seite ist ein Fanprojekt von `alexfrey317`, ohne Lizenz. Wir übernehmen **Ideen und Verhalten**, keinen Code und keine Dateien. Bei jeder Zeile steht, woher die Daten bei uns kämen und ob die Regeln passen.

Grenzen: Leser konnten bei großen Seiten nur den Anfang wörtlich lesen, der Rest war eine Zusammenfassung des Abruftools. Das ist unten dort vermerkt. Unseren Bestand habe ich aus `docs/uebergabe.md` und dem Code ersehen, nicht Reiter für Reiter in der laufenden Seite geprüft.

## Aufbau der Seite

Navigation: Ladder, Leaders, Matchups, Counter, Replays. Es gibt keine Karten, Deck oder Meta Seite, keine Hilfe, kein About. Alle Auswertungen haben dieselben Zeitreiter **Yesterday, Last 7 Days, Last 30 Days, Last 90 Days, Spoiler Queue** und eigene Adressen (`/1d/leaders/`, `/30d/matchups/`, `/spoiler/leaders/`). Keine Abfrageparameter außer `/counter/?vs=<CODE>` und `/replays/?a=&b=`. Fußzeile: "Standard ranked data, refreshed once a day" und der Hinweis, dass es kein offizielles Projekt ist. Ein "Install" Knopf in der Kopfzeile (vermutlich Installation als App, Ziel nicht gelesen).

## Seiten im Einzelnen

| Seite | Was sie zeigt | Quelle bei ihm |
|---|---|---|
| Ladder `/` | Standard Ladder, 10.000 Spieler, 200 je Seite. Spalten Rang, Spieler, Bounty, Partien mit Sieg und Niederlage, Siegquote, drei häufigste Leader mit Quote und Partienzahl. Filter Land und Leader, Sortierung Rang, Bounty, meiste Partien, Siegquote. Karten oben: höchster Bounty, Bounty auf Platz 1000, Partien der Top 1000, Spielerzahl. Hinweis auf die Ladder Rücksetzung vom 26.10. | OPBounty Web API |
| Spoiler Queue `/spoiler/` | Eigene Ladder der Vorabqueue, Top 2.000, Stand 14 Tage | OPBounty `mode_1` |
| Leaders `/leaders/` | Tabelle aller Leader: Rang, Veränderung gegen gestern, Karte, gewichtete und rohe Siegquote, Spielrate, Partien, Piloten, Quote als Erster und als Zweiter, Anzahl in den Top 1000. Selten gespielte Leader (unter 0,25 %) unter einem Trenner mit Hinweis "kleine Stichprobe" | Card Kaizoku |
| Leader Seite `/leaders/<CODE>/` | Kennzahlen, Tageskurve der Siegquote, Matchup Zeile mit 18 Gegnern (je Siegquote, Partien, als Erster, als Zweiter, Link auf Study), Spiegel Auswertung (Erster gegen Zweiter, welche Karten im Spiegel nützen oder schaden), Zugkurve (häufigste Spielzüge je Zug, nach Seite und Gegner), Starthand Analyse, Decklisten (Sortierung, Filter "nur Listen mit Karte X"), Beste Piloten, Kartenverwendung | Kaizoku, Spiegel Zahlen aus dem Partienarchiv |
| Matchups `/matchups/` | Matrix der 16 meistgespielten Leader, Zeile gegen Spalte, Siegquote und Partienzahl je Zelle | Kaizoku und OPBounty |
| Counter `/counter/` | "Was schlägt meine Gegner": mehrere Leader wählen, die Tabelle reiht, was sie schlägt (Score, rohe Quote gegen die Auswahl, Untergrenze "Floor", Partien, Gesamtquote, Aufschlüsselung je Wahl). Tabelle blieb im Abruf leer, wohl clientseitig gerendert | Aus der Matrix gerechnet |
| Replays `/replays/` | Study Games, siehe `docs/recherche-github-tools.md` | Firestore Replays |
| Spielerseite `/players/<id>/` | Kopf mit Rang, Land, Partien, Siegquote, durchschnittliche Dauer, "Mains X mit N %", Abdeckungszeile "Decklisten bekannt für N von M Partien". Bountyverlauf, Tabelle der gespielten Leader (Partien, Sieg %, als Erster, als Zweiter, Anteil, aufgezeichnet, Siegquote des Leaders in der Ladder), gespielte Decks je Gegnerleader mit Quote und Deckliste (kopierbar), letzte Partien mit Gegner, Ergebnis, Bounty und Replay Link, Vorabqueue Bereich | OPBounty, Firestore |

Auffällig: Mehrere Kennzahlen sind auf der Seite nirgends erklärt ("Wtd WR", "Edge", "Floor", "Lift", die Zahl in der Matrixzelle, Bereich der Bountykurve). Auch die Quelle wechselt je nach Seite (Ladder: OPBounty, Leader Seiten: Kaizoku).

## Abgleich mit unserer Seite

Unsere Reiter: Decks, Matchups, Matrix, Ranking, Ladder, Mulligan, Guide, Analyze my replay, Changelog. Dazu Spielerseiten mit Replay.

| Idee von ihm | Haben wir? | Quelle bei uns | Regeln | Wert | Aufwand |
|---|---|---|---|---|---|
| Zeitreiter 1 Tag, 7, 30, 90 Tage auf Leader, Matchups, Counter | Teilweise: Tagesdateien liegen vor (`public/tage`), Tage und Fenster sind bei uns vorhanden | CDN `mode_0`, eigene Tagesdateien | ja | hoch, macht alles andere vergleichbar | mittel |
| Veränderung des Rangs gegen gestern (Δ 1D) und Trenner "selten gespielt, kleine Stichprobe" | Nein | CDN | ja | mittel, löst nebenbei die offene Frage nach Signalfarben ohne Partienzahl | klein |
| Leader Seite mit Tageskurve der Siegquote | Nein | CDN Tagesdateien | ja | hoch | mittel |
| Spiegel Auswertung (Erster gegen Zweiter, Karten, die im Spiegel nützen) | Nein | Replays und Logs, First/Second haben wir bereits | ja | mittel | mittel |
| Zugkurve (häufigste Spielzüge je Zug, nach Seite und Gegner) | Teilweise: Guide, `zuglager.js` | Replay Logs | ja | mittel | mittel bis hoch |
| Starthand Analyse | Teilweise: Reiter Mulligan | Replay Logs, Mulligan Dateien | ja | klein | klein |
| Beste Piloten je Leader | Teilweise: Ranking und Spielerseiten | Bestenliste (Top 100) und Replays | ja | mittel | klein |
| Counter Finder: Leader wählen, reiht, was sie schlägt | Nein | gerechnet aus unserer Matrix, Auswahl mehrerer Gegner, Score aus Siegquote und Partienzahl | ja | hoch, ist neu | mittel |
| Kartenverwendung mit Auswirkung auf die Siegquote ("Lift") | Teilweise: Wertnetz | Replays | ja | mittel | mittel |
| Decklisten mit Sortierung und Filter "nur Listen mit Karte X", "Copy for sim" | Teilweise: Decks | eigene Daten | ja | mittel, "Copy for sim" ist klein | klein |
| Spielerseite mit Bountyverlauf | Nein (nur Top 100 täglich, 20 Tage Cache) | Bestenliste Web API täglich | ja | mittel | klein bis mittel |
| Spielerseite: Leader Tabelle mit Erster und Zweiter Quote, Decks je Gegnerleader | Teilweise | Replays | ja | mittel | mittel |
| Abdeckungszeile "Deckliste bekannt für N von M Partien" | Nein | haben wir (30 % Abdeckung), Zahl liegt vor | ja | hoch für Ehrlichkeit der Zahlen | klein |
| Hinweis auf Ladder Rücksetzung und Trennung der Zeit davor | Nein | `ladderResets` (Datum aus der Bestenliste) | ja | klein | klein |
| Vorabqueue (Spoiler/Special): Ladder, Leaders, Matchups | Nein | CDN `mode_1` (dort spielt seit 2.7.8 die eingebettete Sim) | ja | unklar, da mode_1 bei uns gemischt ist | mittel |
| Länderfilter in der Ladder | Nein | `country` der Web API, nur für die Top 100 | ja | klein | klein |
| Wischhinweise, Schließen per Wischen in Vorschauen | Teilweise | | ja | klein | klein |
| Installieren als App ("Install") | Nein | | ja | klein | klein |
| Fest verlinkbare Adressen je Leader und Zeitraum | Ja für Leader (`?leader=`), Zeitraum nein | | ja | klein | klein |

## Was nur mit Kaizoku Daten ginge (Regel gelockert, Stufe nach `specs/features/kaizoku-daten.md`)

* Gewichtete Siegquote ("Wtd WR"), Spielrate und Pilotenzahl je Leader mit Bewertung gegenüber der rohen Quote.
* Decklisten mit Piloten und Siegquote, "beste Listen".
* Zugkurve nach Gegner (`curve`), Techkarten je Matchup (`matchuptech`), Starthand (`hands`).

Das meiste davon können wir auch **selbst aus Replays und CDN rechnen**, nur dünner (30 % Abdeckung). Kaizoku hat die größere Stichprobe. Der Preis ist die Abhängigkeit von einer fremden Datei, deren Aufbau er selbst ohne Ankündigung ändern kann.

## Was wir nicht übernehmen

* **Zehntausend Spieler:** Du brauchst nur die Top 100.
* **Spielerseiten mit Zeitstempel und Gegnernamen für jedermann:** Er zeigt Namen und Uhrzeiten von Gegnern auf öffentlichen Seiten. Bei uns bleiben Spielerdaten verschlüsselt, das ändern wir nicht.
* **Land und Spielzeiten einzelner Personen:** Seine Seite lässt daraus Spielgewohnheiten ablesen. Nicht übernehmen.
* **Nicht erklärte Kennzahlen:** Wo wir etwas übernehmen, bekommt die Kennzahl eine Erklärung auf der Seite.
* **Sein Code, sein Design, seine Dateien:** keine Lizenz.

## Reihenfolge (Empfehlung)

1. **Abdeckungszeile und "kleine Stichprobe" Trenner** (klein, macht unsere Zahlen ehrlicher, löst die offene Signalfarbenfrage).
2. **Zeitreiter 1/7/30/90 Tage** auf Leader und Matchups, dazu Δ gegen gestern.
3. **Leader Seite** mit Tageskurve, Matchup Zeile, Starthand und Spiegel Auswertung.
4. **Counter Finder** aus unserer Matrix.
5. **Spielerseite**: Bountyverlauf aus der Web API, Leader Tabelle mit Erster und Zweiter.
6. Kaizoku Stufe A und B, wenn die Stichprobe der Replays nicht reicht.

Jeder Punkt braucht vor dem Bau einen eigenen Spec mit Abnahmekriterien. Keiner ist freigegeben.

## Offene Fragen

* Soll die Vorabqueue (`mode_1`) überhaupt eine eigene Auswertung bekommen? Bei uns spielt dort seit 2.7.8 die eingebettete Sim, sie ist also gemischt.
* Zeitfenster als Reiter oder als Auswahl? Die Seite nutzt Reiter mit eigenen Adressen. Unsere Seite nutzt bisher Abfrageparameter.
* "Installieren": ist eine App Installation gewünscht?
