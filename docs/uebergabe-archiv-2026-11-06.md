# Übergabe Archiv 06.11.2026

Verschoben aus `docs/uebergabe.md` am 06.11.2026, wörtlich und unverändert. Nur nach Bedarf per grep lesen. Der Stand der Abschnitte ist der jeweils genannte Tag; Branches wie `claude/haerten-5ddc19` sind inzwischen gemergt.

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

Kaizoku Auswahl (02.11.2026, spaeter): fuenf Quellen statt zwei: EB05 (OP17 + EB05 Standard) alle und top 20, OP17 Standard alle, top 20 und top 10 (`eb05_lw_p_top10` gibt es bei Kaizoku nicht). Dateien jetzt `kaizoku_<datensatz>.json.gz` und `..._b.json.gz`, Schluessel in der Quellenwahl `kaizoku_<datensatz>`. Die Dateien `kaizoku.json.gz`, `kaizoku_b.json.gz`, `kaizoku_top*.gz` entfallen. Decklists zeigen bei Kaizoku nur den Quellenhinweis, keine Kartenwerte, Starthand, Zugkurve. Unsere eigenen Saetze (alte Formate) sind unveraendert; Kaizoku hat auch op15, op16 und weitere Formate im Manifest, nicht eingebaut.

Guide ohne Kaizoku (02.11.2026, Entscheidung des Nutzers): Kaizoku kommt nicht in den Guide. Zugkurve, Starthand und Kartenwerte aus `kaizoku_*_b.json.gz` bleiben ungenutzt; nur `tech` wird in Matchups gebraucht. Die frueheren Notizen "Zugkurve fuer den Guide" sind damit erledigt.

## Stand 04.11.2026, Wache und Meldungen

Lauf 41849437102 war rot, die Seite aber aktuell (Web API). Die Wache maß nur das Alter der OCR
Datei vom Bazzite. Jetzt kennt sie die Quelle (`bestenliste_quelle`): API geliefert heißt grün
mit Warnung. Der Bazzite Lauf scheiterte an vier uupd Meldungen über „nächste Seite“; neu ist
`werkzeuge/meldungen_still.py`, im Mitschnitt eingebunden. Ursache der Meldungen: Bazzite Image
mit Plasma 6.8 verträgt die nachinstallierten X11 Pakete nicht, das Systemupdate steht seit dem
27.10. (Bazzite auf 44.20261026). Entscheidung des Nutzers offen: X11 behalten oder Mitschnitt
auf Wayland. Guide lernt auf Wunsch weiter ab 24.09., keine neue Meta (Entscheidung 02.11.).
Alles auf Branch `claude/meldungen-still`, samt Logzeile „Formatsatz aus dem CDN“.

## Stand 06.11.2026, Spielerseite schwarz

Klick auf einen Spieler der Top 100 (gemeldet: MircoMorsico) machte die Seite schwarz. Ursache:
`KaizokuListe` wurde beim Umbau „Kaizoku als Dataset“ (82a930e) gelöscht, die Spielerseite
rendert sie aber für jeden Spieler mit Daten in `kaizoku_spieler.json.gz`; React warf
`ReferenceError` ohne Error Boundary. Komponente und CSS (`kz-listen`, `kz-kopf`) sind zurück, lokal
mit Testdatei geprüft (Prüfkonfiguration `.impeccable/review/vite.kz.mjs`, Port 5181). Branch
`claude/top100-klick`. Offen, nur auf Wunsch: eine Error Boundary, damit ein Fehler in einem Teil
nicht die ganze Seite leert.

## Stand 06.11.2026, Härten gebaut (wartet auf Push)

Spec `specs/features/haerten.md` (freigegeben 06.11.) umgesetzt auf Branch `claude/haerten-5ddc19`,
aufbauend auf `claude/spielerseite-api`. Error Boundary `src/Fehlergrenze.jsx` um jeden Reiter
(key = Reiter) und um die App (`main.jsx`). Ladefehler zeigen die normale Hülle mit Meldung für
Besucher, Reiter ohne Satz (Leaderboard, Player, Replay, Guide, Analyze, Changelog) laufen weiter.
`?id=` und `?p=` bleiben stehen. `daten.js`: Fehlschläge in `holen` werden vergessen,
`schluessel.json` nur bei 404 (oder index.html vom Vite Server) als unverschlüsselt gemerkt,
sonst `EntsperrFehler` mit Grund netz, kaputt, krypto. Leerer Satz zeigt „No games in this range“.
Touchziele 44 px bis 760 px (Block am Ende von `index.css`, Tokens `--touch`, `--dreh-bild`).
Tests in `tests/daten.test.js`, `npm test` und Build grün. Geprüft in der Vorschau
`.impeccable/review/vite.haerten.mjs` (gitignored, Port 5182, Fehler per Cookie `probe=`:
satz404, leersatz, krypto, wurf, ohnespieler, ohnegegner, ohnedecks) bei 375 px und Desktop.

Annahmen: Ein leerer Zeitraum ohne Tagesdateien ist ein leerer Satz statt Fehler. Die erste
Leaderwahl nach dem Laden ersetzt den Verlaufseintrag statt einen zweiten anzulegen. Der
Drehknopf bleibt am Handy optisch 26 px, die Trefferfläche ist 44 px (negativer Rand).
Offen: Push und PR nur mit OK des Nutzers.

## Stand 06.11.2026 abends, Härten gemergt, Optimieren als Spec

PR 30 (Härten) am 06.11. gemergt, Merge Commit 044040a. Nächster Schritt auf Wunsch des Nutzers:
`/impeccable optimize` für P2-7 und P2-8. Spec `specs/features/optimieren.md` auf Branch
`claude/optimieren` geschrieben, am 06.11. freigegeben und gebaut: Replay Log nur bei offenem
Protokoll, `zeitraumLaden` holt in Gruppen zu drei und rechnet über `neuerSammler()` (daten.js)
laufend ein, Tage danach aus dem Zwischenspeicher. Tests grün (81), Build grün, in der Vorschau
geprüft. Die Vorschau `.impeccable/review/vite.haerten.mjs` liefert jetzt auch `/tage/` aus
`public/tage` des Hauptcheckouts und ein künstliches Replay mit 200 Ereignissen unter `/replays/`.
Annahme: Wechsel zurück auf einen früheren Zeitraum parst die Tage neu (aus dem Browser Cache).
Offen: Push und PR nur mit OK des Nutzers.


# Nachtrag beim Merge von PR 34 (06.11.2026)

## Replaypfade 06.11.2026 (Branch `claude/replay-pfade`)

Gemeldet: kein Replay ließ sich laden. Ursache: seit etwa W43 legt der Client Replays als
`<Verlierer>_<Hash>.log` ab, das Wochenetikett weicht von der ISO Woche ab; unser gerechneter
Pfad traf nie. Fix nach Spec `specs/features/replay-pfade.md` (freigegeben): `spieler_daten.py`
holt den echten Pfad aus Firestore `Replays` (wie der Client), `replays_holen.py` zählt je
Woche und trägt fehlende Replays aus, die Seite zeigt dort keinen Knopf. Nur etwa jede fünfte
Partie wird überhaupt hochgeladen. Annahmen: neuer Branch ab main, unabhängig von PR 35; die
Austragung läuft nicht, wenn kein einziges Replay gefunden wurde (Storage Ausfall). Offen:
Push und PR nach OK, danach im Action Log die Zeile „je Woche gefunden“ prüfen und ein Replay
vom 05.11. oder später auf der Seite öffnen. Dieses File ist über 10 KB; Archivieren nach dem
Merge von PR 33 und 35, sonst Konflikte.

## Polish 06.11.2026

Härten (PR 30) und Optimieren (PR 31) sind in main. Branch `claude/polish` ab main b90f2f2 im
Worktree `website-redesign-bc8edc`. Spec `specs/features/polish.md` freigegeben (alle vier Punkte) und umgesetzt, Ergebnis
in der Spec. Gemergt als PR 33 am 06.11. Vorschau: launch.json Eintrag `polish` (`.impeccable/review/vite.polish.mjs`,
gitignored, Port 5183, liefert auch `/tage/` aus dem Hauptcheckout).

## Bilder und Leistung 06.11.2026

Polish ist als PR 33 gemergt. Lighthouse auf Produktionsbuild
mit lokalen Daten (launch.json `lighthouse`, `vite preview --config .impeccable/review/vite.polish.mjs`,
Port 5184, Ausgabe `.impeccable/review/dist-lh`): Decklists Leistung 71 Handy / 56 Rechner, LCP 26,3 s /
6,3 s, CLS 0,104 / 0,415. Ursache: Kartenbilder 600 px WebP vom CDN (290 KB) statt eigener 120 px JPG
(9 KB). Spec `specs/features/bilder-leistung.md` freigegeben, Leaderbild bleibt scharf vom CDN.
Branch `claude/bilder-leistung` ab main a045e1b. Annahme: Basis main statt claude/polish, damit die PRs
unabhängig bleiben; neue CSS Regeln daher nicht am Dateiende (dort ändert PR 33).
Umgesetzt und committet (7538d2e), Ergebnis in der Spec. Decklists Handy 77 Punkte, LCP 6,3 s;
Ziel 90 und 2,5 s nicht erreicht, LCP Element ist das scharfe Leaderbild vom CDN (Probe mit eigener
Datei: 86 und 4,1 s). Nutzer entschied danach: Leaderbild aus eigener Datei (c6f3adb), Decklists Handy 86 und 4,1 s,
Rechner 99 und 0,8 s. Offen: Push und PR. Rückblick für
roadmap.md steht noch aus; erst nach dem Merge von PR 33 anhängen, sonst Konflikt am Dateiende.

## Ladepfad am Handy 06.11.2026 (Extrarunde, spät)
Spec `specs/features/ladepfad-handy.md`, freigegeben, alle vier Phasen gebaut auf `claude/bilder-leistung` (zusammen mit Bilder und Leistung ein PR). Ergebnis und Rückblick stehen in der Spec: FCP 1,7 auf 0,9 s, `index.js` 130 auf 73 KB gz, Daten laden parallel zum JS; LCP am Handy simuliert weiter 4,1 bis 4,4 s, 85 bis 87 Punkte, weil der Satz (161 KB) die Leitung bestimmt.

Annahmen: „push und merke“ des Nutzers als Push und PR gelesen, nicht als Merge (Merge stellt die Produktion um, Verschlüsselung nur lokal mit Node nachgestellt).

Offen für morgen: Merge nach OK des Nutzers; Replay mit echtem Brett und Handygröße prüfen; nächster Hebel (Leaderbild vor dem Satz aus `?leader=`, oder Kopfdatei des Satzes) entscheiden; Rückblick Bilder und Leistung und Ladepfad in roadmap.md, sobald PR 33 gemergt ist; diese Datei ist über 10 KB und gehört archiviert.
