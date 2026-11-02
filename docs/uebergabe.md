# Übergabe Letacios Fiesta

Stand 28.10.2026. Neue Sitzungen lesen zuerst diese Datei und `specs/roadmap.md`, dann
bei Bedarf `README.md`, `PRODUCT.md` und `DESIGN.md`.

## Stand 28.10.2026

Ins Archiv `docs/uebergabe-archiv-2026-10-28.md` verschoben (Statistikquellen, Abdeckung der Replays, Upload Bedingungen, Bazzite Update Notice).

## Stand 02.11.2026

Seit v2.7.8 (29.10.) ist CDN mode_0 sauber (EB05 60 bis 70 %), eingebettete Sim spielt in
mode_1. Entscheidung des Nutzers am 02.11.: Formatsatz und Formaterkennung nur noch aus CDN
mode_0 ab 29.10., Replay Code dafür gelöscht (Spec `specs/features/format-aus-cdn.md`).
Spielerseiten, Reiter Replays und Metacoach bleiben bei den Replays. Steht das CDN länger als
zwei Tage, warnt die Action, der Satz bleibt stehen. Gebaut auf Branch `claude/format-aus-cdn`,
Tests grün, Probelauf: 29.10. bis 01.11., 9.295 Partien, EB05 64 %. Offen: Push und Merge nach
OK des Nutzers, danach den Lauf der Action prüfen. Annahme: der gespeicherte Start 27.10. wird
beim Lesen auf 29.10. gezogen. Update Log: seit 29.10. keine neue Meldung von OPBounty.

## Redesign 02.11.2026

Branch `claude/website-redesign-bc8edc`. Nutzer wählte nach der Vergleichsseite
(`.impeccable/vorschau/richtungen.html`, gitignored) Richtung B Linear / Raycast, alle Reiter,
nur dunkel, am Handy untere Leiste. Spec `specs/features/redesign.md` freigegeben, v0 freigegeben.
Alle fünf Phasen gebaut: Tokens und Geist, Rahmen mit Pillen und unterer Leiste, alle Ansichten
bei 1280 und 390 px geprüft (kein seitliches Scrollen), ⌘K Palette (`Palette` in App.jsx, Logik
in `src/leadersuche.js`, Test `tests/leadersuche.test.js`), Doku und Changelog. Tests und Build
grün. Committet auf dem Branch, nicht gepusht; Push und Merge nur mit Ok des Nutzers.
Vorschau: launch.json Eintrag `redesign` (`.impeccable/review/vite.redesign.mjs`, Port 5181,
Daten aus dem Hauptcheckout). `.impeccable/config.json` (Hook Ausnahmen) bleibt uncommittet.

Annahmen: Palette öffnet den Leader in Decks, Matchups, Matrix (als Fokus), Mulligan und Guide im
selben Reiter, aus allen anderen in Decklists. Text 3 `#7c828d` hat 5.16 auf Grund, aber nur 4.25
auf `--flaeche-2`; dort steht er kaum. Schriften laden latin 83 KB statt vorher 130 KB; das CSS
wächst gzip um etwa 1 KB.

## Signatur 02.11.2026 (gebaut, wartet auf Push)

Spec `specs/features/signatur.md` freigegeben („Freigeben, loslegen“), alle vier Phasen gebaut
auf `claude/website-redesign-bc8edc` (mit main abgeglichen, PR 19 und 20 drin).
`src/leaderfarben.js` (Test `tests/leaderfarben.test.js`) liefert Leaderfarben aus `karten.json`
Feld `f`; App setzt `--lf1`, `--lf2`, Klasse `mit-leaderfarbe` und `theme-color` auf Decklists,
Matchups und Mulligan. `src/Girlande.jsx`: Papel Picado über dem Kopf, flattert beim Wechsel.
Farbpunkte in Matrix, Matchups, ⌘K. `.laedt` zeigt den wippenden Hut, `p.leer-satz` den stillen
Hut, Texte überarbeitet. Geprüft bei 1440, 1100, 375: kein seitliches Scrollen, keine Zahl in
Leaderfarbe. Ältere Abschnitte ins Archiv `docs/uebergabe-archiv-2026-10-28.md`.

Annahmen: Guide und Analyze my replay bekommen keine Leaderfarbe, sie haben keinen Leaderkopf
und wählen den Leader selbst (`LEADER_KOPF` in App.jsx). Leere Zeilen in Listen (Palette, Leiste) ohne Hut. Offene
Fragen der Spec (Hutband, Konfetti) bleiben bei Nein.

## Nächste Schritte

0. PR 10 und PR 11 am 28.10. gemergt, Lauf 40647237206 grün: 8.829 Replays, First/Second
   bei 7.724, EB05 56 %, Event 24 von 25 Leadern, `format.zustand.json` geschrieben. Als
   Nächstes Selbstlauf Phase 2 (Kartendaten, vor dem 20.11.): gebaut auf Branch
   `claude/tcgcsv-daten` (PR 12), Kaizoku zuerst, tcgcsv füllt Lücken, Warnung „Karten ohne
   Daten“. Danach Selbstlauf Phase 3 (Wachen für CDN und Firestore Zugang, Event Ablauf `bis`).
1. Kartenquelle tcgcsv: Phase 2 (Bilder) ist live seit PR 6 (c887775). Erster Lauf der
   Action: 2.218 Bilder ersetzt, 49 noch nicht von tcgcsv (`img/offen.txt`, Vorverkauf OP18
   und alte Promos), 16 ganz ohne Bild (OP18-065, OP18-091, P-087 bis P-151). Als Nächstes
   Phase 1 (Daten aus tcgcsv, Kaizoku als Ersatz) in einer frischen Sitzung bauen.
2. Freigabe für `zuordnung-leaderzahl.md` holen (hart oder nur Tiebreak), dann in
   `spieler_daten.py` bauen und gegen die Liste vom 24.10. nachrechnen.
3. Offen aus der Designkritik, nur auf Wunsch: Signalfarben bei Winrates ohne Partienzahl im
   Ladder, Umbruch der Kartenleiste am Handy, gleichnamige Leader.

## Werkzeuge dieser Sitzung

Firestore Abfragen auf Replays gehen lokal mit `firestore.Db()` und
`frische_partien.replays_suchen(db, ende, tage)`. Das CDN liefert Rohdateien unter
`stats/raw/<key>`, den Index unter `stats/files.json`. Zum Entschlüsseln fehlt im lokalen
Python das Paket `cryptography`, Node mit `crypto` geht.

## Was es ist

Private Statistikseite für OPTCG auf fiesta.nahobinoco.com. Sie ist statisch auf GitHub Pages
(Repo `jolejolevv-coder/letacios-fiesta`, öffentlich), und alle Daten sind mit AES-GCM hinter
einem Passwort verschlüsselt (`verschluesseln.py`, `src/daten.js`). Die Oberfläche ist englisch.
Die Action „Veroeffentlichen“ baut bei jedem Push. Ein Push braucht das Ok des Nutzers, außer er
sagt „push direkt“.

## Datenwege

* **Ladder:** Seit dem 20.10.2026 kommt sie per Bildschirmfoto und OCR aus dem Spielclient auf dem
  Bazzite. Das Speicherauslesen ist blockiert und wird nie vorgeschlagen. Der Timer läuft
  stündlich um :30 UTC. Der Servercheckout liegt unter `~/opbounty-ladder/seite`, nie von Hand
  verändern.
* **Replay Analysen:** Metacoach rechnet sie nachts (`meta-coach/tools/fiesta_analyse.py`) und
  pusht sie verschlüsselt nach `public/analyse/`. Rund 290 Replays haben im Speicher von
  OPBounty kein Log und bleiben ohne Analyse.
* **Guide (Book) und Wertnetz:** Sie kommen NICHT aus dem Repo, sondern direkt von Metacoach
  (`https://meta.nahobinoco.com/fiesta/book/...`, `/fiesta/netz/...`, verschlüsselt mit dem
  Passwort von Fiesta). Der Abruf läuft über `metacoachHolen` in `src/daten.js`.
* **Große Kartenbilder** kommen von Metacoach über `/fiesta/bilder/<nr>.jpg` (`grossesBild` in
  `src/daten.js`).
* **Counter Werte der Karten** setzt `aktualisieren.py` in `karten.json.gz` (Feld `c`).

## Reiter

* Decks, Matchups, Matrix, Ranking, Ladder, Mulligan, Guide, Analyze my replay und Changelog.
* **Matrix:** Fokus auf einen Leader (`?leader=`) und Sortierung (`&sort=wr`).
* **Farben:** Seegrün `--gewinnt` und Ziegelrot `--verliert`, die Tönung wächst mit dem Abstand
  von 50 %.
* **Guide:** „Show evidence“ je Zug mit Advice, Next best und Hold.
* **Analyze my replay:** rechnet im Browser (`src/zuglager.js`, `src/wertnetz.js`,
  `src/spielbewertung.js`). Gegen 20 Prüfpartien in `tests/referenz/` ist es deckungsgleich mit
  Python.
* **Kartenvorschau:** ein Tipp auf eine Karte in offener Deckliste, im Guide oder im Mulligan.
* **Changelog:** ein englischer Eintrag je Tag mit sichtbarer Änderung in `src/changelog.js`,
  gepflegt bei jedem Push.

## Design

Seit dem 02.11.2026 „Werkzeug“ (Linear / Raycast), eigenes Gesicht statt der Spielhilfe aus
Metacoach. Quellen der Wahrheit sind
`DESIGN.md` und `.impeccable/design.json`. Der Sombrero bleibt strohgelb.

## Lokal prüfen ohne Passwort

`npx vite --config .impeccable/review/vite.review.mjs` (Port 5180), mit entschlüsselten Daten aus
`.impeccable/vorschau/oeffentlich`. Das Passwort aus `~/.fiesta_passwort` wird nie eingetippt
und nie ausgegeben.

## Tests

`npm test` (58 Tests) und `npx vite build`.

## Zuletzt behoben

* Die Spielerseite stürzte bei einer Partie mit unbekanntem Leader ab. Abgefangen in `Bild`.
* Die Liste im Mulligan ragte am Handy über den Rand. Behoben mit grid-cols-1 und min-w-0.

## Regeln

* Nicht den Entwickler von OPBounty kontaktieren.
* Nur PublicUsers lesen.
* Nie `standalone` setzen.
* Keine Gedankenstriche in Texten.
* Mihawk OP14-020 ignorieren.

## Stand 02.11.2026, Bestenliste per Web API

Spec `specs/features/bestenliste-web-api.md` (freigegeben). Phase 0 und 1 gebaut auf Branch
`claude/recherche-github-tools-69b80a`: `bestenliste_api.py`, Schalter `--api` in
`bestenliste_einbauen.py`, 12 Tests. `playerId` der API ist die `user_id`. Offen: Phase 2
(Parallelbetrieb, Vergleich gegen die OCR Liste), Entscheidung wo der Abruf läuft
(Empfehlung Bazzite), dann Phase 3 Umschalten. Replay Gefühl und Kaizoku Daten haben
Entwürfe in `specs/features/`. Recherche: `docs/recherche-github-tools.md`.

Entscheidung 02.11.2026: Der Abruf der Bestenliste läuft in der GitHub Action. Phase 2 gebaut:
Schritt "Bestenliste Web API gegen OCR" in `veroeffentlichen.yml`, Skript
`werkzeuge/bestenliste_vergleich.py` (nur Zahlen im Log, weil das Repo öffentlich ist).
Nach dem Merge eine Woche die Zusammenfassungen der täglichen Läufe lesen, dann Phase 3
(Umschalten). Der Schritt braucht `SEITEN_PASSWORT`, das es schon gibt. Nicht geprüft: ob
GitHub Runner von der API geblockt werden (erster Lauf zeigt es).

## Stand 02.11.2026 abends, Phase 3 gebaut

Bestenliste: Action holt zuerst per Web API (`bestenliste_einbauen.py --api`), bei Fehlern bleibt die OCR Liste. Offen: Merge von PR 19 (nur dort läuft die Action), erster Lauf zeigt, ob GitHub Runner zugelassen sind, sonst Abruf auf dem Bazzite. Als Nächstes laut Nutzer: Spielerseite mit Bountyverlauf aus der API und den Decks, gegen die der Spieler verloren hat (Spec nötig). Analyse: docs/analyse-optcg-data-seite.md.

## Stand 02.11.2026 spät

PR 19 gemerged, erster Lauf mit Web API grün (100 Spieler, 100 mit user_id; 88 mit Spielerdaten, vorher 73; 74 Spieler mit Replays, 235 Replays im Bestand). PR 20: Winrate aus API Summen, Zeitspalte ausgeblendet ohne Daten, Kartenbilder zuerst vom CDN static.dotgg.gg (WebP, preconnect), Rückfall auf eigene JPG. Als Nächstes: Spec Spielerseite (Bountyverlauf aus API, Niederlagen gegen Decks).

## Verworfen am 02.11.2026

Bilanz je Gegnerleader (Spielerseite und Decklisten): Quelle liefert je Liste nur Summen, Ausschnitt aus Spielerpartien reicht dem Nutzer nicht. PR 21 geschlossen, nichts gemerged.

## Kaizoku Stufe A (02.11.2026)

`kaizoku_holen.py` holt manifest, stats und decklist von cdn.cardkaizoku.com (Datensatz op17_lw_p, 3 Abrufe, 0,4 s Abstand) nach `public/kaizoku.json.gz` (nicht im Repo, 97 KB gepackt). Reiter Kaizoku in der App. Decklisten tragen die Bilanz je Gegnerleader. Offen: Stufe B (Hände, Kurve, Matchuptech), Stufe C nur nach Ok; Anzeige im Browser mit echten Daten noch nicht angesehen.

## Stand 02.11.2026 spät, Auftrag "alle drei Stufen Kaizoku"

Nutzer: "Bau alle drei Stufen" (A, B, C) und "erkläre, wo man die Daten in unsere vorhandenen Reiter einbaut". Stufe A ist PR 22 (offen, nicht gemerged). B und C kommen auf denselben Branch. Stufe C (Spielerabfragen `POST api.cardkaizoku.com/search`, `GET /player-stats`) ist damit ausdrücklich freigegeben; es gehen nur Namen der Top 100 hinaus, Ergebnis nur verschlüsselt ins Paket. Dateien in Scratchpad (manifest, cardstats 607 KB, leaderboard 9 KB, matchuptech 458 KB, hands 24 KB, curve 1,1 MB): Formate noch zu lesen. Vorbild für die Formate: github.com/alexfrey317/optcg-data `ingest/sources/kaizoku_curves.py` und `kaizoku_players.py`, nur Idee, kein Code kopieren.

## Kaizoku als Dataset (umgesetzt 02.11.2026)

Der Reiter "Kaizoku stats" ist weg (`/kaizoku` leitet auf Decklists). Kaizoku ist in der Quellenauswahl unter "Data set" waehlbar ("Card Kaizoku, last week (other source)", Schluessel `kaizoku`). `kaizokuZuSatz` in `src/daten.js` bildet `kaizoku.json.gz` auf die Leader Form von `eindampfen` ab (Test: `tests/kaizoku_satz.test.js`), danach rechnen Decklists, Ranking, Matchups und Matrix ohne Sonderweg. Stufe B (`kaizoku_b.json.gz`): Karten, Starthand, Zugkurve in Decklists, Techkarten in Matchups, nur wenn die Quelle Kaizoku ist. Das Record einer Kaizoku Liste klappt die volle Bilanz je Gegnerleader auf. Spielerseite "Kaizoku (last 28 days)" unveraendert.

PR 21 Reste: `src/niederlagen.js`, sein Test und der Record Knopf in der Deckzeile sind NICHT ungenutzt (Record Knopf zeigt bei unseren Daten die bekannten Partien je Gegner), deshalb geblieben.

Annahmen:
* Kaizoku kennt keine Partienzahl als Erster oder Zweiter. Je Leader wird mit der Haelfte der Partien geschaetzt (Quote stimmt, Anzahl ist keine Messung); je Liste und je Gegner bleiben First und Second leer ("–"), Dauer ebenso. Die Seite sagt das unter den Kaizoku Teilen.
* Kaizoku nur im Modus "Ready sets", nicht im Zeitraum.
* Das Passwort Gate und die verschluesselten Dateien sind unveraendert; `kaizoku*.json.gz` wird wie bisher von der Action geschrieben.
Geprueft im Browser mit echten Daten (Decklists, Matchups, Matrix, Ranking), Tests und Build gruen.

## Kaizoku Datensatz EB05 (02.11.2026)

`kaizoku_holen.py` und `kaizoku_wochen.py` holen jetzt `eb05_lw_p` (aktuelle Woche, Standardformat OP17 + EB05, 237.356 Partien, 114 Leader mit OP18 Leadern) statt `op17_lw_p` (98.296 Partien, ohne EB05). Stufe B gibt es in der Quelle fuer `eb05_lw_p`; die Zugkurve nur als `lw`. Weitere Datensaetze im Manifest: `op17_p` (ganzes Format, 5,8 Mio., ohne Stufe B), `op17`, `*_top20`/`*_top10` (nur beste Spieler), `eb05_lw`. Nicht eingebaut, auf Wunsch moeglich. Gepackt 139 KB plus 65 KB.

Zweite Kaizoku Quelle (02.11.2026): `eb05_lw_p_top20`, dieselbe Woche nur mit den besten Spielern (Kaizoku nennt es "top20"; die genaue Auswahl ist nicht dokumentiert, die Seite nennt sie "top players"). Dateien `kaizoku_top.json.gz` und `kaizoku_top_b.json.gz`, in `.gitignore`. Beide Skripte holen beide Datensaetze einzeln, ein Ausfall nimmt den anderen nicht mit. In der Quellenauswahl heissen sie "Card Kaizoku, OP17 + EB05 Standard, last week" und "..., top players" (`KAIZOKU_QUELLEN` in `src/daten.js`). Neue Kaizoku Quelle = ein Eintrag dort plus ein Eintrag in `DATENSAETZE` (`kaizoku_holen.py`) und `ZIELE` (`kaizoku_wochen.py`).

Decklists zeigen bei Quelle Kaizoku keine Kartenwerte, Starthand und Zugkurve mehr (Wunsch des Nutzers). Die Zugkurve (`kurve` in `kaizoku_b*.json.gz`) ist fuer den Guide vorgesehen, noch nicht gebaut. Techkarten bleiben in Matchups.
